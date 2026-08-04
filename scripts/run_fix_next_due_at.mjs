/**
 * 一次性修正所有 patient_health_tasks 的 next_due_at
 *
 * 修正兩個 bug：
 * 1. Timezone bug：findFirstMissingDate 用 toISOString() (UTC) 查 記錄日期 → 差一天
 * 2. Patient-fallback bug：查詢時包含其他任務的同類型記錄 → next_due_at 跳幾十天
 *
 * 策略：為每個受影響任務重新計算 next_due_at
 *   - 只用 任務id 精確匹配查健康記錄（舊記錄 任務id=null 才用後備）
 *   - 用本地日期字串（不用 toISOString()）
 *   - 從 last_completed_date - 14 天掃描，找第一個未完成日期
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 需要設置 SUPABASE_SERVICE_ROLE_KEY 環境變量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── 輔助函數 ───────────────────────────────────────────────────

/** 本地日期字串（YYYY-MM-DD），不受 timezone 影響 */
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 判斷某天是否有排程（僅 daily/weekly/monthly freq=1 場景） */
function isScheduled(task, date) {
  const createdAt = task.created_at ? new Date(task.created_at) : null;
  if (createdAt) {
    const cd = new Date(createdAt);
    cd.setHours(0, 0, 0, 0);
    const dd = new Date(date);
    dd.setHours(0, 0, 0, 0);
    if (dd < cd) return false;
  }

  if (task.frequency_unit === 'daily') return true;

  if (task.frequency_unit === 'weekly') {
    if (!task.specific_days_of_week?.length) return false;
    const jsDay = date.getDay(); // 0=Sun..6=Sat
    const dbDay = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
    return task.specific_days_of_week.includes(dbDay);
  }

  if (task.frequency_unit === 'monthly') {
    if (!task.specific_days_of_month?.length) return false;
    return task.specific_days_of_month.includes(date.getDate());
  }

  return false;
}

/**
 * 查詢某日期是否有本任務的記錄（正確版：排除其他任務的記錄）
 * 回傳已完成的時間點 Set（'HH:MM' 格式）
 */
async function getCompletedTimesForDate(task, dateStr) {
  const { data, error } = await supabase
    .from('健康監測記錄')
    .select('記錄時間, 任務id, 院友id, 監測類型')
    .eq('記錄日期', dateStr)
    .or(`任務id.eq.${task.id},and(院友id.eq.${task.patient_id},監測類型.eq.${task.health_record_type})`);

  if (error || !data) return new Set();

  const filtered = data.filter(r => {
    if (r.任務id === task.id) return true;
    if (r.任務id === null) return r.院友id === task.patient_id && r.監測類型 === task.health_record_type;
    return false;
  });

  return new Set(filtered.map(r => (r.記錄時間 || '').substring(0, 5)));
}

/**
 * 找第一個未完成日期（修正版）
 * 最多掃描 maxDays 天（預設 60）
 */
async function findFirstMissingDateFixed(task, startDate, maxDays = 60) {
  const checkDate = new Date(startDate);
  checkDate.setHours(0, 0, 0, 0);
  const specificTimes = task.specific_times?.length ? task.specific_times : null;

  for (let i = 0; i < maxDays; i++) {
    if (isScheduled(task, checkDate)) {
      const dateStr = localDateStr(checkDate); // 本地日期，非 UTC
      const completedTimes = await getCompletedTimesForDate(task, dateStr);

      if (specificTimes) {
        // 找第一個未完成的時間點
        for (const t of specificTimes) {
          if (!completedTimes.has(t.substring(0, 5))) {
            const [h, m] = t.split(':').map(Number);
            checkDate.setHours(h, m, 0, 0);
            return checkDate;
          }
        }
      } else {
        // 無指定時間點：只要該日有記錄即算完成
        if (completedTimes.size === 0) {
          checkDate.setHours(8, 0, 0, 0);
          return checkDate;
        }
      }
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }

  // 超過掃描上限：設為明天
  checkDate.setDate(checkDate.getDate() + 1);
  const time = task.specific_times?.[0] || '08:00';
  const [h, m] = time.split(':').map(Number);
  checkDate.setHours(h, m, 0, 0);
  return checkDate;
}

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
  console.log('🔍 讀取受影響任務...');

  const { data: tasks, error } = await supabase
    .from('patient_health_tasks')
    .select('id, patient_id, health_record_type, frequency_unit, frequency_value, specific_times, specific_days_of_week, specific_days_of_month, last_completed_at, next_due_at, is_recurring, created_at')
    .not('last_completed_at', 'is', null)
    .not('next_due_at', 'is', null)
    .eq('is_recurring', true);

  if (error) {
    console.error('❌ 讀取失敗:', error.message);
    process.exit(1);
  }

  console.log(`📋 共 ${tasks.length} 個任務需要修正`);

  let successCount = 0;
  let errorCount = 0;
  let unchangedCount = 0;

  // 批次處理，每批 10 個（避免過多並行 DB 連接）
  const BATCH = 10;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);

    await Promise.all(batch.map(async (task) => {
      try {
        // startDate = last_completed 日 - 14 天（本地午夜）
        const lastCompletedDate = task.last_completed_at.substring(0, 10); // YYYY-MM-DD in UTC
        // 用 UTC date string 解析為本地 Date
        const base = new Date(lastCompletedDate + 'T00:00:00');
        base.setDate(base.getDate() - 14);
        base.setHours(0, 0, 0, 0);

        const nextDue = await findFirstMissingDateFixed(task, base);
        const newNextDueAt = nextDue.toISOString();
        const oldNextDueAt = task.next_due_at;

        // 只在有變化時更新
        if (newNextDueAt === oldNextDueAt) {
          unchangedCount++;
          return;
        }

        const { error: updateErr } = await supabase
          .from('patient_health_tasks')
          .update({ next_due_at: newNextDueAt })
          .eq('id', task.id);

        if (updateErr) {
          console.error(`  ❌ 任務 ${task.id} 更新失敗: ${updateErr.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`  ❌ 任務 ${task.id} 發生錯誤: ${err.message}`);
        errorCount++;
      }
    }));

    // 進度報告
    if ((i + BATCH) % 100 === 0 || i + BATCH >= tasks.length) {
      const done = Math.min(i + BATCH, tasks.length);
      console.log(`  進度：${done}/${tasks.length} (已修正 ${successCount}，未變 ${unchangedCount}，失敗 ${errorCount})`);
    }
  }

  console.log('');
  console.log('✅ 完成！');
  console.log(`   已修正: ${successCount}`);
  console.log(`   無需修正: ${unchangedCount}`);
  console.log(`   失敗: ${errorCount}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
