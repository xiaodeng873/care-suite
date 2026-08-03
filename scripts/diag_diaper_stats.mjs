import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fetchAll(table, select) {
  const pageSize = 1000;
  let start = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(start, start + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  return all;
}

const records = await fetchAll('diaper_change_records', 'patient_id,change_date,urine_count,core_count');
const tabs = await fetchAll('patient_care_tabs', 'patient_id,tab_type,is_hidden');
const patients = await fetchAll('院友主表', '院友id,床號,中文姓名,在住狀態');

const recordPatients = new Set(records.map(r => r.patient_id));
const diaperTabPatients = new Set(tabs.filter(t => t.tab_type === 'diaper' && !t.is_hidden).map(t => t.patient_id));

const withUrine = records.filter(r => r.urine_count != null && r.urine_count > 0).length;
const withCore = records.filter(r => r.core_count != null && r.core_count > 0).length;

const months = [...new Set(records.map(r => String(r.change_date).slice(0, 7)))].sort();

const inTabNotInRecords = [...diaperTabPatients].filter(id => !recordPatients.has(id));
const inRecordsNotInTab = [...recordPatients].filter(id => !diaperTabPatients.has(id));

const nameOf = id => {
  const p = patients.find(x => x.院友id === id);
  return p ? `${p.中文姓名}(${p.床號},${p.在住狀態})` : `#${id}(不在主表)`;
};

console.log('diaper_change_records 總行數:', records.length);
console.log('有記錄的院友數:', recordPatients.size);
console.log('urine_count > 0 的行數:', withUrine, ' core_count > 0 的行數:', withCore);
console.log('記錄月份範圍:', months[0], '至', months[months.length - 1], ' 共', months.length, '個月');
console.log('開啟換片tab的院友數(is_hidden=false):', diaperTabPatients.size);
console.log('有tab但無任何記錄行:', inTabNotInRecords.length, inTabNotInRecords.map(nameOf).join(', '));
console.log('有記錄但無tab:', inRecordsNotInTab.length, inRecordsNotInTab.map(nameOf).join(', '));
