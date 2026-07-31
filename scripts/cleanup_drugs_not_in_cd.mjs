import { createClient } from '@supabase/supabase-js';

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

const DRUG_NAME_NOISE = new Set([
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'fc', 'film', 'coated', 'film-coated', 'extended', 'release', 'er', 'sr', 'cr',
  'blister', 'box', 'bottle', 'hospital', 'pack',
  'inj', 'injection', 'syr', 'syrup', 'ointment', 'oint', 'cream', 'solution', 'soln',
  'drop', 'drops', 'nasal', 'spray', 'patch', 'powder', 'powd', 'inhaler', 'inhl',
  'turbuhaler', 'penfill', 'suppository', 'supp', 'suspension', 'susp', 'sachet',
  'hm', 'as', 'besylate', 'fumarate', 'hcl', 'sodium', 'calcium', 'potassium',
]);

function normalizeDrugName(name) {
  let s = (name || '').toString().toLowerCase();
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/[\/\,\-–—.+&]/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean).map(t => t.trim()).filter(t => !DRUG_NAME_NOISE.has(t) && !/^(as|fc|er|sr|cr)$/i.test(t));
  const normalized = tokens.map(t => {
    if (/^\d+(\.\d+)?microgram(s)?$/.test(t)) return t.replace(/micrograms?/,'mcg');
    return t;
  });
  return normalized.sort().join(' ');
}

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

  const patients = await fetchAll('院友主表', '院友id,床號,中文姓名,在住狀態');
  const cdPatientIds = new Set(
    patients
      .filter(p => p.在住狀態 === '在住' && isInBedRange(p.床號))
      .map(p => p.院友id)
  );
  console.log(`C/D 區在住院友數：${cdPatientIds.size}`);

  const prescriptions = await fetchAll('new_medication_prescriptions', 'patient_id,medication_name');
  const cdRxNames = new Set();
  let cdRxCount = 0;
  for (const r of prescriptions) {
    if (cdPatientIds.has(r.patient_id)) {
      cdRxCount += 1;
      if (r.medication_name) cdRxNames.add(normalizeDrugName(r.medication_name));
    }
  }
  console.log(`C/D 區處方數：${cdRxCount}，使用藥物種類：${cdRxNames.size}`);

  const drugs = await fetchAll('medication_drug_database', 'id,drug_name');
  console.log(`藥物資料庫總數：${drugs.length}`);

  // 以「藥物資料庫中的名稱」與「C/D 處方中的藥物名稱」精確比對
  const usedExactNames = new Set(
    prescriptions
      .filter(r => cdPatientIds.has(r.patient_id) && r.medication_name)
      .map(r => r.medication_name.trim())
  );

  const unused = [];
  const used = [];
  for (const d of drugs) {
    if (usedExactNames.has(d.drug_name.trim())) {
      used.push(d);
    } else {
      unused.push(d);
    }
  }

  console.log(`C/D 區處方中不同藥物名稱：${usedExactNames.size} 種`);
  console.log(`C/D 區正使用（藥物資料庫內精確吻合）：${used.length} 種`);
  console.log(`C/D 區未使用將刪除：${unused.length} 種`);

  if (DRY_RUN) {
    console.log('\nDRY-RUN 預覽前 20 筆將刪除藥物：');
    for (const d of unused.slice(0, 20)) console.log(`  - ${d.drug_name}`);
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const d of unused) {
    const { error } = await supabase.from('medication_drug_database').delete().eq('id', d.id);
    if (error) {
      console.error(`刪除 ${d.drug_name} 失敗：${error.message}`);
      failed += 1;
    } else {
      deleted += 1;
    }
  }
  console.log(`\n實際刪除：${deleted} 種，失敗：${failed} 種`);
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
