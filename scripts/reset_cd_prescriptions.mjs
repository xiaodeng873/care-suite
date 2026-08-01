import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const BED_MIN = parseInt(process.env.BED_RANGE_MIN || '202', 10);
const BED_MAX = parseInt(process.env.BED_RANGE_MAX || '287', 10);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數：請提供 VITE_SUPABASE_URL / SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseBedFloor(bed) {
  const m = (bed || '').toString().match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function isInBedRange(bed) {
  const floor = parseBedFloor(bed);
  return floor !== null && floor >= BED_MIN && floor <= BED_MAX;
}

async function fetchAll(table, select) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`讀取 ${table} 失敗：${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不刪除）' : '正式執行'}`);
  console.log(`C/D 床位範圍：${BED_MIN}-${BED_MAX}`);

  const patients = await fetchAll('院友主表', '院友id,床號,中文姓名,在住狀態');
  const cdPatientIds = patients
    .filter(p => isInBedRange(p.床號))
    .map(p => p.院友id);

  console.log(`C/D 區院友人數：${cdPatientIds.length}`);

  if (cdPatientIds.length === 0) {
    console.log('沒有符合條件的院友，無需清理。');
    return;
  }

  // 找出這些院友的所有處方
  const prescriptions = await fetchAll('new_medication_prescriptions', 'id,patient_id,medication_name,frequency_value');
  const toDelete = prescriptions.filter(rx => cdPatientIds.includes(rx.patient_id));

  console.log(`處方總數：${prescriptions.length}`);
  console.log(`C/D 區院友處方將刪除：${toDelete.length}`);

  if (DRY_RUN) {
    console.log('\nDRY-RUN 預覽前 20 筆將刪除：');
    const patientMap = new Map(patients.map(p => [p.院友id, p]));
    for (const d of toDelete.slice(0, 20)) {
      const p = patientMap.get(d.patient_id);
      console.log(`  rx=${d.id} patient=${d.patient_id} ${p ? p.床號 + ' ' + p.中文姓名 : 'unknown'} ${d.medication_name || ''}`);
    }
    return;
  }

  let deleted = 0;
  let failed = 0;
  const BATCH = 100;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batchIds = toDelete.slice(i, i + BATCH).map(d => d.id);
    const { error } = await supabase.from('new_medication_prescriptions').delete().in('id', batchIds);
    if (error) {
      console.error(`刪除批次 ${i + 1}-${i + batchIds.length} 失敗：${error.message}`);
      failed += batchIds.length;
    } else {
      deleted += batchIds.length;
    }
  }
  console.log(`\n實際刪除：${deleted} 筆，失敗：${failed} 筆`);
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
