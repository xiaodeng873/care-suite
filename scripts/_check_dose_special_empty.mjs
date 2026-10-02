import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 服用份量 (dosage_amount) 與特殊用法 (special_dosage_instruction) 兩者皆空的處方
const { data, error } = await supabase
  .from('new_medication_prescriptions')
  .select('id, patient_id, medication_name, dosage_amount, dosage_unit, special_dosage_instruction, status, is_prn, created_at')
  .or('dosage_amount.is.null,dosage_amount.eq.')
  .or('special_dosage_instruction.is.null,special_dosage_instruction.eq.');
if (error) { console.log('ERROR', error.message); process.exit(1); }
console.log('兩者皆空總數:', data.length);

if (data.length > 0) {
  const ids = [...new Set(data.map(r => r.patient_id))];
  const { data: ps } = await supabase.from('院友主表').select('院友id, 中文姓名, 床號').in('院友id', ids);
  const pmap = new Map((ps || []).map(p => [p.院友id, p]));
  for (const r of data) {
    const p = pmap.get(r.patient_id) || {};
    console.log(`[${r.status}] ${p.床號 || '?'} ${p.中文姓名 || '?'} | ${r.medication_name} | 份量=${JSON.stringify(r.dosage_amount)}${r.dosage_unit ? r.dosage_unit : ''} | 特殊=${JSON.stringify(r.special_dosage_instruction)} | PRN=${r.is_prn} | ${r.created_at?.slice(0, 10)}`);
  }
}
