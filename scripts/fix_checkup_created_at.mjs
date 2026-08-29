// 修正：同批插入的體檢記錄 created_at 相同，導致 UI 把 2025 舊記錄誤認為「當前記錄」
// 做法：同一院友的多筆記錄按 last_doctor_signature_date 排序，created_at 逐筆 +1 秒（越新的簽署日期 created_at 越大）
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: pats } = await supabase.from('院友主表').select('院友id, 床號').like('床號', 'D%');
const dIds = new Set((pats || []).map(p => p.院友id));
const { data, error } = await supabase.from('annual_health_checkups').select('id, patient_id, last_doctor_signature_date, created_at');
if (error) { console.error(error); process.exit(1); }

const groups = new Map();
for (const r of data || []) {
  if (!dIds.has(r.patient_id)) continue;
  if (!groups.has(r.patient_id)) groups.set(r.patient_id, []);
  groups.get(r.patient_id).push(r);
}

const base = new Date('2026-08-29T08:00:00Z').getTime();
let updated = 0;
for (const [pid, rows] of groups) {
  if (rows.length < 2) continue;
  rows.sort((a, b) => new Date(a.last_doctor_signature_date) - new Date(b.last_doctor_signature_date));
  for (let i = 0; i < rows.length; i++) {
    const newTs = new Date(base + i * 1000).toISOString();
    if (rows[i].created_at === newTs) continue;
    const { error: e } = await supabase.from('annual_health_checkups').update({ created_at: newTs }).eq('id', rows[i].id);
    if (e) { console.error('更新失敗 id=' + rows[i].id, e); process.exit(1); }
    updated++;
  }
}
console.log(`✅ 已修正 ${updated} 筆 created_at（${groups.size} 位院友中，多筆記錄者按簽署日期排序）`);
