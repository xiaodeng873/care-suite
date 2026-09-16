// test-overdue-card-flow：回歸測試「逾期合併卡片補錄後，再點卡片只彈未完成類型」
// 基於黃逸綺 2026-09-16 真實事件：補完 09-15 生命表徵後再點卡片仍然彈生命表徵（仲輸入咗重複記錄），
// 血糖最後要經其他途徑先補到（記錄任務id=∅）。
// 修復：Dashboard.handleTaskClick 用 isTaskCompletedForDate 過濾 任務清單，已完成嘅類型唔再彈。
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
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { isTaskCompletedForDate, taskRecordVitalTypes } = mod.exports;

  // 完全複製 Dashboard recordLookup / recordTimes 嘅建鍵邏輯
  const normalizeTime = (t) => (t || '').split(':').slice(0, 2).join(':');
  const buildIndexes = (records) => {
    const recordLookup = new Set();
    const recordTimes = new Map();
    const toMin = (t) => { const [h, m] = normalizeTime(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    records.forEach(r => {
      const nt = normalizeTime(r.記錄時間);
      if (r.任務id) { recordLookup.add(`${r.任務id}_${r.記錄日期}_${nt}`); recordLookup.add(`${r.任務id}_${r.記錄日期}`); }
      const pid = r.院友id?.toString() || '';
      recordLookup.add(`${pid}_${r.監測類型}_${r.記錄日期}_${nt}`);
      recordLookup.add(`${pid}_${r.監測類型}_${r.記錄日期}`);
      const minutes = toMin(r.記錄時間);
      const keys = [`${pid}_${r.監測類型}_${r.記錄日期}`];
      if (r.任務id) keys.push(`${r.任務id}_${r.記錄日期}`);
      keys.forEach(k => { if (!recordTimes.has(k)) recordTimes.set(k, []); recordTimes.get(k).push(minutes); });
    });
    return { recordLookup, recordTimes };
  };

  const D = '2026-09-15';
  const vitalTask = { id: 'f5435373', patient_id: 102, health_record_type: '生命表徵', specific_times: ['07:30'] };
  const sugarTask = { id: 'dc08dc99', patient_id: 102, health_record_type: '血糖值', specific_times: ['07:30'] };

  const vitalRecords = ['血壓', '脈搏', '血含氧量', '呼吸'].map(tp => ({
    院友id: 102, 任務id: 'f5435373', 監測類型: tp, 記錄日期: D, 記錄時間: '07:30:00',
  }));

  const checks = [];
  const check = (name, ok) => checks.push([name, ok]);

  // ===== 核心場景：黃逸綺事件 — 補完生命表徵後，群組過濾應只剩血糖 =====
  {
    const { recordLookup, recordTimes } = buildIndexes(vitalRecords); // 血糖仲未輸入
    const group = [vitalTask, sugarTask];
    const remaining = group.filter(t => !isTaskCompletedForDate(t, D, recordLookup, recordTimes));
    check('事件重放：補完生命表徵後再點卡片，任務清單只剩血糖', remaining.length === 1 && remaining[0].id === 'dc08dc99');
  }

  // ===== 第一次點卡片（兩個都未完成）：兩個都彈 =====
  {
    const { recordLookup, recordTimes } = buildIndexes([]);
    const group = [vitalTask, sugarTask];
    const remaining = group.filter(t => !isTaskCompletedForDate(t, D, recordLookup, recordTimes));
    check('初次點卡片：生命表徵+血糖一齊彈', remaining.length === 2);
  }

  // ===== 容忍度邊界 =====
  {
    const lateOk = vitalRecords.map(r => ({ ...r, 記錄時間: '07:45:00' }));   // +15min
    const { recordLookup, recordTimes } = buildIndexes(lateOk);
    check('07:45 記錄（+15min 容差內）算完成', isTaskCompletedForDate(vitalTask, D, recordLookup, recordTimes));
  }
  {
    const tooLate = vitalRecords.map(r => ({ ...r, 記錄時間: '08:05:00' }));   // +35min
    const { recordLookup, recordTimes } = buildIndexes(tooLate);
    check('08:05 記錄（超出 ±30min）算未完成', !isTaskCompletedForDate(vitalTask, D, recordLookup, recordTimes));
  }

  // ===== 生命表徵只輸入血壓一項都算完成（同完成判定語義一致：四項任一命中）=====
  {
    const { recordLookup, recordTimes } = buildIndexes([vitalRecords[0]]);
    check('生命表徵只輸血壓都算完成', isTaskCompletedForDate(vitalTask, D, recordLookup, recordTimes));
  }

  // ===== 血糖記錄冇任務id（事件入面 12:44:39 嗰筆）都應命中後備鍵 =====
  {
    const noTaskId = [{ 院友id: 102, 任務id: null, 監測類型: '血糖值', 記錄日期: D, 記錄時間: '07:30:00' }];
    const { recordLookup, recordTimes } = buildIndexes(noTaskId);
    check('冇任務id 嘅血糖記錄（院友+類型後備鍵）算完成', isTaskCompletedForDate(sugarTask, D, recordLookup, recordTimes));
  }

  // ===== 冇特定時間點嘅任務：當日有記錄即可 =====
  {
    const noTimeTask = { id: 'nt1', patient_id: 102, health_record_type: '血糖值', specific_times: [] };
    const { recordLookup, recordTimes } = buildIndexes([{ 院友id: 102, 任務id: 'nt1', 監測類型: '血糖值', 記錄日期: D, 記錄時間: '14:30:00' }]);
    check('冇時間點任務：當日任何時間有記錄算完成', isTaskCompletedForDate(noTimeTask, D, recordLookup, recordTimes));
    const empty = buildIndexes([]);
    check('冇時間點任務：當日冇記錄算未完成', !isTaskCompletedForDate(noTimeTask, D, empty.recordLookup, empty.recordTimes));
  }

  // ===== 體重：唔講求時間，當日有記錄即可（體重記錄時間係 00:00）=====
  {
    const weightTask = { id: 'w1', patient_id: 102, health_record_type: '體重', specific_times: ['08:00'] };
    const { recordLookup, recordTimes } = buildIndexes([{ 院友id: 102, 任務id: 'w1', 監測類型: '體重', 記錄日期: D, 記錄時間: '00:00:00' }]);
    check('體重：08:00 時間點但記錄 00:00 都算完成（唔行容差）', isTaskCompletedForDate(weightTask, D, recordLookup, recordTimes));
  }

  // ===== 全部完成嘅後備：remaining 空 → 用原群組（Dashboard 語義）=====
  {
    const { recordLookup, recordTimes } = buildIndexes([...vitalRecords, { 院友id: 102, 任務id: 'dc08dc99', 監測類型: '血糖值', 記錄日期: D, 記錄時間: '07:30:00' }]);
    const group = [vitalTask, sugarTask];
    const remaining = group.filter(t => !isTaskCompletedForDate(t, D, recordLookup, recordTimes));
    check('全部完成時 remaining 為空（Dashboard 後備用原群組）', remaining.length === 0);
  }

  // ===== taskRecordVitalTypes 冇變 =====
  check('taskRecordVitalTypes(生命表徵) 仍然係四項',
    JSON.stringify(taskRecordVitalTypes('生命表徵')) === JSON.stringify(['血壓', '脈搏', '血含氧量', '呼吸']));

  let pass = 0, fail = 0;
  for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); ok ? pass++ : fail++; }
  console.log(`\n${pass}/${checks.length} PASS`);
  process.exit(fail ? 1 : 0);
})();
