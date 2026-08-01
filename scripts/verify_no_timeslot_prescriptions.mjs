import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  const rxs = await fetchAll('new_medication_prescriptions', 'id,patient_id,medication_name,medication_time_slots,frequency_value,administration_route,dosage_unit,status');
  const patients = await fetchAll('院友主表', '院友id,床號,中文姓名');
  const patientMap = new Map(patients.map(p => [p.院友id, p]));

  const emptySlots = rxs.filter(rx => !rx.medication_time_slots || rx.medication_time_slots.length === 0);
  console.log(`處方總數：${rxs.length}`);
  console.log(`time_slots 為空：${emptySlots.length}`);

  // 按狀態統計
  const byStatus = {};
  for (const rx of emptySlots) {
    byStatus[rx.status || 'null'] = (byStatus[rx.status || 'null'] || 0) + 1;
  }
  console.log('按狀態統計 time_slots 為空：', byStatus);

  // 列出前 30 筆
  console.log('\n前 30 筆 time_slots 為空的處方：');
  for (const rx of emptySlots.slice(0, 30)) {
    const p = patientMap.get(rx.patient_id);
    console.log(`  ${p ? p.床號 : '?'} ${p ? p.中文姓名 : '?'} | ${rx.medication_name} | ${rx.frequency_value} | ${rx.administration_route} | ${rx.dosage_unit} | ${rx.status}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
