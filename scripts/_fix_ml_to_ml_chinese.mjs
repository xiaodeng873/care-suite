// 一次性資料修正：所有 dosage_unit 為 ml（不分大小寫）→「毫升」；
// 藥物設定（facility_settings.medication_settings）服用單位清單移除 'ml'
// 用法：node scripts/_fix_ml_to_ml_chinese.mjs        （DRY RUN）
//       node scripts/_fix_ml_to_ml_chinese.mjs apply
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  key = readFileSync('apps/web/.env', 'utf-8').split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))?.split('=')[1]?.trim();
}
if (!key) { console.error('缺少 SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', key, { auth: { autoRefreshToken: false, persistSession: false } });
const APPLY = process.argv[2] === 'apply';

async function fixPrescriptions() {
  const { data: rows, error } = await supabase
    .from('new_medication_prescriptions')
    .select('id, medication_name, dosage_amount, dosage_unit')
    .ilike('dosage_unit', 'ml');
  if (error) { console.error('查詢 new_medication_prescriptions 失敗:', error.message); return; }
  console.log(`new_medication_prescriptions: ${rows.length} 筆 dosage_unit=ml`);
  for (const r of rows) console.log(`  #${r.id} ${r.medication_name} ${r.dosage_amount}${r.dosage_unit} → ${r.dosage_amount}毫升`);
  if (APPLY && rows.length) {
    const ids = rows.map(r => r.id);
    const { error: upErr } = await supabase.from('new_medication_prescriptions').update({ dosage_unit: '毫升' }).in('id', ids);
    console.log(upErr ? `  更新失敗: ${upErr.message}` : `  已更新 ${ids.length} 筆`);
  }
}

async function fixDrugDatabase() {
  // 先探測欄名：dosage_unit 或 unit
  for (const col of ['dosage_unit', 'unit']) {
    const { data, error } = await supabase.from('medication_drug_database').select('id, drug_name, ' + col).ilike(col, 'ml');
    if (error) continue; // 欄不存在，試下一個
    console.log(`medication_drug_database.${col}: ${data.length} 筆 =ml`);
    for (const r of data) console.log(`  #${r.id} ${r.drug_name}`);
    if (APPLY && data.length) {
      const { error: upErr } = await supabase.from('medication_drug_database').update({ [col]: '毫升' }).in('id', data.map(r => r.id));
      console.log(upErr ? `  更新失敗: ${upErr.message}` : `  已更新 ${data.length} 筆`);
    }
    return;
  }
  console.log('medication_drug_database: 搵唔到 dosage_unit/unit 欄，跳過');
}

async function fixFacilitySettings() {
  const { data: rows, error } = await supabase.from('facility_settings').select('id, facility_id, medication_settings');
  if (error) { console.error('查詢 facility_settings 失敗:', error.message); return; }
  for (const r of rows ?? []) {
    const ms = r.medication_settings;
    if (!ms?.服用單位?.includes('ml')) continue;
    const newList = ms.服用單位.filter(u => u !== 'ml');
    console.log(`facility_settings #${r.id} (facility_id=${r.facility_id}): 服用單位 ${ms.服用單位.length} 項 → ${newList.length} 項（移除 ml）`);
    if (APPLY) {
      const { error: upErr } = await supabase.from('facility_settings')
        .update({ medication_settings: { ...ms, 服用單位: newList }, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      console.log(upErr ? `  更新失敗: ${upErr.message}` : '  已更新');
    }
  }
}

await fixPrescriptions();
await fixDrugDatabase();
await fixFacilitySettings();
if (!APPLY) console.log('（DRY RUN，未寫入）');
