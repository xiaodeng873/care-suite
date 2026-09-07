// D 站任務調整：
// 1) 所有 D 站在住院友嘅任務：start_date 改為 2026-09-06（香港時間），並按 App 同款邏輯重算 next_due_at；
//    specific_times（特定時間）不變；DB 無 start_time 欄位（開始時間只在表單用於計算）
// 2) 為每位 D 站在住院友新增體溫任務：每日1次、特定時間 08:00、備註「定期」、start_date 2026-09-06
//    （已有 體溫+08:00 任務者跳過）
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// ===== 移植 apps/web/src/utils/taskScheduler.ts 嘅 calculateNextDueDate（保持 App 行為一致）=====
const MONITORING_TYPES = new Set(['血壓', '脈搏', '體溫', '血含氧量', '呼吸', '血糖值', '體重', '生命表徵', '血糖控制', '體重控制']);
const isMonitoringTask = (t) => MONITORING_TYPES.has(t);

function calculateNextDueDate(task, fromDate) {
  if (!task.is_recurring) return fromDate || new Date();
  const nextDueDate = new Date(fromDate || new Date());
  switch (task.frequency_unit) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + (task.frequency_value || 1));
      break;
    case 'weekly':
      if (task.specific_days_of_week && task.specific_days_of_week.length > 0) {
        const currentDayOfWeek = nextDueDate.getDay();
        const targetDays = task.specific_days_of_week.map(d => d === 7 ? 0 : d).sort((a, b) => a - b);
        if (!targetDays.includes(currentDayOfWeek)) {
          let daysToAdd = null;
          for (let i = 1; i <= 7; i++) {
            if (targetDays.includes((currentDayOfWeek + i) % 7)) { daysToAdd = i; break; }
          }
          if (daysToAdd !== null) nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);
          else nextDueDate.setDate(nextDueDate.getDate() + 7);
        }
      } else {
        nextDueDate.setDate(nextDueDate.getDate() + (task.frequency_value || 1) * 7);
      }
      break;
    case 'monthly':
      if (task.specific_days_of_month && task.specific_days_of_month.length > 0) {
        const currentDate = nextDueDate.getDate();
        const futureTargetDays = task.specific_days_of_month.filter(d => d > currentDate);
        if (futureTargetDays.length > 0) {
          nextDueDate.setDate(Math.min(...futureTargetDays));
        } else {
          nextDueDate.setMonth(nextDueDate.getMonth() + (task.frequency_value || 1));
          nextDueDate.setDate(Math.min(...task.specific_days_of_month));
        }
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + (task.frequency_value || 1));
      }
      break;
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + (task.frequency_value || 1));
      break;
    default:
      nextDueDate.setDate(nextDueDate.getDate() + 1);
  }
  if (task.specific_times && task.specific_times.length > 0) {
    const timeStr = task.specific_times[0];
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      nextDueDate.setHours(hours, minutes, 0, 0);
    }
  } else if (isMonitoringTask(task.health_record_type)) {
    nextDueDate.setHours(8, 0, 0, 0);
  }
  return nextDueDate;
}
// ===== 移植完畢 =====

const START_DATE_HKT = new Date('2026-09-06T00:00:00+08:00');
const START_DATE_ISO = START_DATE_HKT.toISOString();

// 1. D 站在住院友
const residents = await fetch(
  `${BASE}/院友主表?facility_id=eq.1&在住狀態=eq.在住&床號=like.D*&select=院友id,中文姓名,床號&limit=1000`,
  { headers: H }
).then(r => r.json());
if (!Array.isArray(residents)) { console.error('院友查詢失敗', residents); process.exit(1); }
const residentIds = residents.map(p => p.院友id);
console.log(`D 站在住院友: ${residents.length} 位`);

// 2. 呢批院友嘅所有任務
const tasks = await fetch(
  `${BASE}/patient_health_tasks?patient_id=in.(${residentIds.join(',')})&select=*&limit=5000`,
  { headers: H }
).then(r => r.json());
if (!Array.isArray(tasks)) { console.error('任務查詢失敗', tasks); process.exit(1); }
console.log(`現有任務: ${tasks.length} 個`);

// 3. 逐個更新 start_date + next_due_at
let updated = 0, updateFailed = 0;
for (const t of tasks) {
  const nextDue = calculateNextDueDate(t, new Date(START_DATE_HKT));
  const res = await fetch(`${BASE}/patient_health_tasks?id=eq.${t.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ start_date: START_DATE_ISO, next_due_at: nextDue.toISOString() }),
  });
  if (res.ok) updated++;
  else { updateFailed++; console.error('更新失敗', t.id, res.status, await res.text()); }
}
console.log(`任務已改 2026-09-06 起計: ${updated} 個，失敗 ${updateFailed} 個`);

// 4. 新增體溫任務（每日1次 08:00 定期）；已有 體溫+08:00 者跳過
const existingTemp = new Set(
  tasks
    .filter(t => t.health_record_type === '體溫' && (t.specific_times || []).includes('08:00'))
    .map(t => t.patient_id)
);
const mockTempTask = {
  is_recurring: true,
  frequency_unit: 'daily',
  frequency_value: 1,
  specific_times: ['08:00'],
  specific_days_of_week: [],
  specific_days_of_month: [],
  health_record_type: '體溫',
};
const nextDueTemp = calculateNextDueDate(mockTempTask, new Date(START_DATE_HKT));
const toCreate = residentIds.filter(id => !existingTemp.has(id));
console.log(`已有體溫(08:00)任務跳過: ${residentIds.length - toCreate.length} 位；準備新增: ${toCreate.length} 位`);

if (toCreate.length) {
  const rows = toCreate.map(pid => ({
    patient_id: pid,
    health_record_type: '體溫',
    frequency_unit: 'daily',
    frequency_value: 1,
    specific_times: ['08:00'],
    specific_days_of_week: [],
    specific_days_of_month: [],
    notes: '定期',
    is_recurring: true,
    start_date: START_DATE_ISO,
    next_due_at: nextDueTemp.toISOString(),
    facility_id: 1,
  }));
  const res = await fetch(`${BASE}/patient_health_tasks`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  const body = await res.json();
  if (!res.ok) { console.error('新增失敗:', res.status, JSON.stringify(body).slice(0, 500)); process.exit(1); }
  console.log(`已新增體溫任務: ${body.length} 個（next_due_at=${nextDueTemp.toISOString()}）`);
}
