// test-nonrecurring-task-end：回歸測試「非循環限期任務（is_recurring=false + end_date）到期自行結束」
// 基於陳振常（C235-2）真實事件：藥物調節非循環任務 end=2026-09-14，之後仍然每日當逾期/未完成，
// isTaskScheduledForDate 完全無 end_date 邊界，任務永遠唔結束。
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
  },
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/taskScheduler.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, { });
  const { isTaskEnded, isTaskScheduledForDate, getTaskStatus, isTaskOverdue, isTaskPendingToday, isTaskDueSoon, getFirstIncompleteMonitoringDate } = mod.exports;

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const tom = new Date(today); tom.setDate(tom.getDate() + 1);
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const at = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

  const checks = [];
  const check = (name, ok) => checks.push([name, ok]);

  // ===== isTaskEnded 基本語義 =====
  check('非循環 + end 已過 → 已結束', isTaskEnded({ is_recurring: false, end_date: fmt(yest) + ' 23:59:00' }));
  check('非循環 + end 仲未過（聽日）→ 未結束', !isTaskEnded({ is_recurring: false, end_date: fmt(tom) + ' 08:00:00' }));
  check('非循環 + end 今日但時間未過 → 未結束', !isTaskEnded({ is_recurring: false, end_date: fmt(today) + ' 23:59:00' }, at(today, 8, 0)));
  check('循環任務（is_recurring=true）→ 永遠未結束', !isTaskEnded({ is_recurring: true, end_date: fmt(yest) + ' 00:00:00' }));
  check('非循環但冇 end_date → 未結束', !isTaskEnded({ is_recurring: false, end_date: null }));
  check('is_recurring 未定義（舊資料）→ 當循環，未結束', !isTaskEnded({ end_date: fmt(yest) + ' 00:00:00' }));

  // ===== isTaskScheduledForDate：end 日期之後唔再排程 =====
  const nrDaily = { frequency_unit: 'daily', frequency_value: 1, is_recurring: false, end_date: fmt(daysAgo(2)) + ' 15:01:00', start_date: fmt(daysAgo(5)), created_at: new Date(daysAgo(6)).toISOString() };
  check('非循環：end 日之前排程', isTaskScheduledForDate(nrDaily, at(daysAgo(3), 8, 0)));
  check('非循環：end 當日仍然排程（嗰日嘅記錄仍然有效）', isTaskScheduledForDate(nrDaily, at(daysAgo(2), 8, 0)));
  check('非循環：end 之後唔排程（核心修正）', !isTaskScheduledForDate(nrDaily, at(yest, 8, 0)));
  check('非循環：今日唔排程', !isTaskScheduledForDate(nrDaily, at(today, 8, 0)));
  const rDaily = { frequency_unit: 'daily', frequency_value: 1, is_recurring: true, start_date: fmt(daysAgo(5)), created_at: new Date(daysAgo(6)).toISOString() };
  check('循環：唔受 end 影響（冇 end 照舊每日排程）', isTaskScheduledForDate(rDaily, at(today, 8, 0)));
  const legacyDaily = { frequency_unit: 'daily', frequency_value: 1, start_date: fmt(daysAgo(5)), created_at: new Date(daysAgo(6)).toISOString() };
  check('舊資料（冇 is_recurring 欄位）照舊排程', isTaskScheduledForDate(legacyDaily, at(today, 8, 0)));

  // ===== getTaskStatus：已結束狀態 =====
  const endedTask = { id: 'e1', patient_id: 61, health_record_type: '生命表徵', frequency_unit: 'daily', frequency_value: 1, is_recurring: false, end_date: fmt(yest) + ' 15:01:00', start_date: fmt(daysAgo(9)), next_due_at: fmt(daysAgo(9)) + 'T00:00:00Z', specific_times: ['08:00'] };
  check('已過 end 嘅非循環監測任務 → ended（陳振常場景）', getTaskStatus(endedTask, new Set(), fmt(today)) === 'ended');
  const liveNrTask = { ...endedTask, id: 'e2', end_date: fmt(tom) + ' 08:00:00' };
  check('未過 end 嘅非循環任務 → 唔係 ended', getTaskStatus(liveNrTask, new Set(), fmt(today)) !== 'ended');

  // ===== getFirstIncompleteMonitoringDate：已結束 → null（唔再追未完成日）=====
  check('已結束任務冇未完成日期', getFirstIncompleteMonitoringDate(endedTask, new Set()) === null);

  // ===== isTaskOverdue / PendingToday / DueSoon：已結束一律 false =====
  check('已結束唔算逾期（就算 next_due 過去+冇記錄）', !isTaskOverdue(endedTask, new Set(), fmt(today)));
  check('已結束唔算今日待辦', !isTaskPendingToday(endedTask, new Set(), fmt(today)));
  check('已結束唔算即將到期', !isTaskDueSoon(endedTask, new Set(), fmt(today)));

  // ===== 未結束嘅非循環任務行為不變：end 前嘅欠數日仍然追 =====
  const missedNr = { ...endedTask, id: 'e3', end_date: fmt(tom) + ' 23:59:00', start_date: fmt(daysAgo(3)) };
  check('未結束非循環任務仍然可以 overdue', ['overdue', 'pending'].includes(getTaskStatus(missedNr, new Set(), fmt(today))));

  let pass = 0, fail = 0;
  for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); ok ? pass++ : fail++; }
  console.log(`\n${pass}/${checks.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
