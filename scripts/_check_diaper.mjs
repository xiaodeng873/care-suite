import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const norm = t => (t || '').toString().slice(0, 5);
const hkToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// 院友（facility 1，在住）
const pats = {};
let from = 0;
while (true) {
  const { data } = await sb.from('院友主表').select('院友id, 中文姓名, 在住狀態, 入住日期, facility_id').eq('facility_id', 1).range(from, from + 999);
  if (!data?.length) break;
  data.forEach(p => pats[p.院友id] = p);
  from += 1000; if (data.length < 1000) break;
}

// 任務
let tasks = [], f2 = 0;
while (true) {
  const { data } = await sb.from('patient_health_tasks').select('*').eq('facility_id', 1).range(f2, f2 + 999);
  if (!data?.length) break;
  tasks = tasks.concat(data); f2 += 1000; if (data.length < 1000) break;
}
const MONITOR = ['生命表徵', '體溫', '體重', '體重控制', '血糖控制', '血糖', '血壓'];
const isMonitor = t => MONITOR.includes(t.health_record_type);
const vitalTypes = ty => ty === '生命表徵' ? ['血壓', '脈搏', '血含氧量', '呼吸'] : [ty];

const dsTasks = tasks.filter(t => isMonitor(t) && (t.specific_times || []).length > 0 &&
  t.specific_times.some(tm => { const h = +norm(tm).split(':')[0]; return h >= 13 && h <= 20; }));
console.log('dinner/snack monitoring tasks (fac 1):', dsTasks.length);

// 相關院友近 14 天記錄
const patientIds = [...new Set(dsTasks.map(t => t.patient_id))];
const dateFrom = new Date(Date.now() + 8 * 3600 * 1000); dateFrom.setDate(dateFrom.getDate() - 14);
const dateFromStr = dateFrom.toISOString().slice(0, 10);
let recs = [], f3 = 0;
while (true) {
  const { data } = await sb.from('健康監測記錄').select('院友id, 監測類型, 記錄日期, 記錄時間, 任務id, 備註')
    .in('院友id', patientIds).gte('記錄日期', dateFromStr).range(f3, f3 + 999);
  if (!data?.length) break;
  recs = recs.concat(data); f3 += 1000; if (data.length < 1000) break;
}
console.log('records in window:', recs.length);

const toMin = t => { const [h, m] = norm(t).split(':').map(Number); return h * 60 + m; };
const TOL = 30;

for (const t of dsTasks) {
  const p = pats[t.patient_id];
  if (!p || p.在住狀態 !== '在住') continue;
  const times = t.specific_times.map(norm);
  const matchTypes = vitalTypes(t.health_record_type);
  const myRecs = recs.filter(r => r.院友id === t.patient_id);
  let issues = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + 8 * 3600 * 1000); d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    const dayRecs = myRecs.filter(r => r.記錄日期 === dStr);
    // dashboard 判定
    const ok = times.every(time => dayRecs.some(r =>
      (r.任務id === t.id || matchTypes.includes(r.監測類型)) && Math.abs(toMin(r.記錄時間) - toMin(time)) <= TOL));
    const anyRecord = dayRecs.length > 0;
    if (!ok && anyRecord) {
      issues.push(`${dStr}: 任務時間[${times.join(',')}] 記錄=${dayRecs.map(r => r.監測類型 + '@' + norm(r.記錄時間) + (r.任務id === t.id ? '(任務)' : '')).join(' ')}`);
    }
  }
  if (issues.length) {
    console.log(`\n${p.中文姓名} | ${t.health_record_type} | times=${JSON.stringify(times)} | notes=${t.notes} | freq=${t.frequency_value}${t.frequency_unit}`);
    issues.forEach(s => console.log('  ', s));
  }
}
console.log('\ndone, hkToday =', hkToday);
