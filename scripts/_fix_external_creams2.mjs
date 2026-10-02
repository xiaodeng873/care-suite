import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 第二輪：劑型=藥膏 且 途徑=外用（名唔含 cream/oint 嘅漏網，例如 PARAFFIN SOFT WHITE / ISOCONAZOLE CR）
const { data: empties } = await supabase
  .from('new_medication_prescriptions')
  .select('id, medication_name, administration_route, dosage_form, status')
  .or('dosage_amount.is.null,dosage_amount.eq.')
  .or('special_dosage_instruction.is.null,special_dosage_instruction.eq.')
  .eq('dosage_form', '藥膏')
  .eq('administration_route', '外用');

console.log(`藥膏+外用兩者皆空: ${(empties || []).length} 張`);
if ((empties || []).length > 0) {
  const { error } = await supabase
    .from('new_medication_prescriptions')
    .update({ special_dosage_instruction: '搽患處' })
    .in('id', empties.map(r => r.id));
  console.log(error ? `UPDATE 失敗: ${error.message}` : `已補「搽患處」: ${empties.length} 張`);
  for (const r of empties.slice(0, 5)) console.log('  樣例:', r.medication_name);
}
