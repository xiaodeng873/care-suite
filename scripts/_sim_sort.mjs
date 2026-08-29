import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const [{ data: checkups }, { data: patients }] = await Promise.all([
  supabase.from('annual_health_checkups').select('id, patient_id, last_doctor_signature_date, next_due_date, created_at'),
  supabase.from('院友主表').select('院友id, 床號, 中文姓名, 在住狀態').eq('在住狀態', '在住'),
]);
const pmap = new Map((patients||[]).map(p => [p.院友id, p]));
// 與頁面相同的過濾：只顯示在住
const filtered = (checkups||[]).filter(c => pmap.has(c.patient_id));
// 分組（與新代碼一致）
const map = new Map();
filtered.forEach(c => { if (!map.has(c.patient_id)) map.set(c.patient_id, []); map.get(c.patient_id).push(c); });
const groups = [...map.entries()].map(([patientId, list]) => ({
  patientId,
  checkups: list.sort((a,b) => {
    const sa = a.last_doctor_signature_date ? new Date(a.last_doctor_signature_date).getTime() : 0;
    const sb = b.last_doctor_signature_date ? new Date(b.last_doctor_signature_date).getTime() : 0;
    if (sb !== sa) return sb - sa;
    return new Date(b.created_at) - new Date(a.created_at);
  }),
}));
// 以當前記錄 next_due_date 升序
groups.sort((a,b) => {
  const ca = a.checkups[0], cb = b.checkups[0];
  const va = ca.next_due_date ? new Date(ca.next_due_date).getTime() : 0;
  const vb = cb.next_due_date ? new Date(cb.next_due_date).getTime() : 0;
  if (va !== vb) return va - vb;
  const sa = ca.last_doctor_signature_date ? new Date(ca.last_doctor_signature_date).getTime() : 0;
  const sb = cb.last_doctor_signature_date ? new Date(cb.last_doctor_signature_date).getTime() : 0;
  return sb - sa;
});
console.log('總組數:', groups.length);
groups.slice(0, 20).forEach((g, i) => {
  const p = pmap.get(g.patientId);
  const cur = g.checkups[0];
  const oldDues = g.checkups.slice(1).map(c => c.next_due_date).join(',');
  console.log(`${String(i+1).padStart(2)}. ${p.床號} ${p.中文姓名} | 當前due=${cur.next_due_date}（sig ${cur.last_doctor_signature_date}）${oldDues ? ' | 舊記錄due=' + oldDues : ''}`);
});
