import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) 服用份量 + 特殊用法兩者皆空 → 外用药膏（CREAM / OINT）統一補「搽患處」
const { data: empties } = await supabase
  .from('new_medication_prescriptions')
  .select('id, medication_name, administration_route, dosage_form, status')
  .or('dosage_amount.is.null,dosage_amount.eq.')
  .or('special_dosage_instruction.is.null,special_dosage_instruction.eq.');

const isCream = (n) => /cream|oint/i.test(n || '');
const creams = (empties || []).filter(r => isCream(r.medication_name));
const others = (empties || []).filter(r => !isCream(r.medication_name));

console.log(`兩者皆空總數: ${(empties || []).length}；屬外用药膏(CREAM/OINT): ${creams.length}；其他: ${others.length}`);

if (creams.length > 0) {
  const { error } = await supabase
    .from('new_medication_prescriptions')
    .update({ special_dosage_instruction: '搽患處' })
    .in('id', creams.map(r => r.id));
  console.log(error ? `UPDATE 失敗: ${error.message}` : `已補「搽患處」: ${creams.length} 張`);
}
console.log('\n未補（非药膏，需人手決定）:');
for (const r of others) console.log(`  [${r.status}] ${r.medication_name} | 途徑=${r.administration_route ?? ''} | 劑型=${r.dosage_form ?? ''}`);

// 2) 口服藥兩者皆空（藥名不含 cream/oint，而 途徑/劑型 含 口服）
const oral = (empties || []).filter(r =>
  !isCream(r.medication_name) &&
  (/口服/.test(`${r.administration_route ?? ''}${r.dosage_form ?? ''}`) || /tablet|tab|cap(sule)?\b|藥水|syrup|suspension/i.test(r.medication_name || ''))
);
console.log(`\n口服藥兩者皆空: ${oral.length} 張`);
for (const r of oral) console.log(`  [${r.status}] ${r.medication_name} | 途徑=${r.administration_route ?? ''} | 劑型=${r.dosage_form ?? ''}`);
