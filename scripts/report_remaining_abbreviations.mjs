import { createClient } from '@supabase/supabase-js';

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
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function containsEnglish(str) {
  return /[A-Za-z]/.test(str || '');
}

async function main() {
  const rx = await fetchAll('new_medication_prescriptions', 'medication_source,medication_source_specialty,medication_name');

  const sourceAbbrevs = {};
  const specialtyAbbrevs = {};

  for (const r of rx) {
    const src = r.medication_source || '';
    const spec = r.medication_source_specialty || '';

    if (containsEnglish(src)) {
      if (!sourceAbbrevs[src]) sourceAbbrevs[src] = { count: 0, examples: new Set() };
      sourceAbbrevs[src].count += 1;
      sourceAbbrevs[src].examples.add(r.medication_name);
    }

    if (containsEnglish(spec)) {
      if (!specialtyAbbrevs[spec]) specialtyAbbrevs[spec] = { count: 0, examples: new Set() };
      specialtyAbbrevs[spec].count += 1;
      specialtyAbbrevs[spec].examples.add(r.medication_name);
    }
  }

  console.log('=== 仍未轉成中文的醫院來源（含英文字母） ===');
  for (const [src, info] of Object.entries(sourceAbbrevs).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${src}（${info.count} 筆） 例：${Array.from(info.examples).slice(0, 5).join(', ')}`);
  }

  console.log('\n=== 仍未轉成中文的專科（含英文字母） ===');
  for (const [spec, info] of Object.entries(specialtyAbbrevs).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${spec}（${info.count} 筆） 例：${Array.from(info.examples).slice(0, 5).join(', ')}`);
  }

  console.log('\n=== 其他可疑專科（非標準專科列表） ===');
  // 這裡列出所有專科，不論是否含英文
  const allSpecs = {};
  for (const r of rx) {
    const spec = r.medication_source_specialty || '';
    if (!spec) continue;
    if (!allSpecs[spec]) allSpecs[spec] = { count: 0, examples: new Set() };
    allSpecs[spec].count += 1;
    allSpecs[spec].examples.add(r.medication_name);
  }
  for (const [spec, info] of Object.entries(allSpecs).sort((a, b) => b[1].count - a[1].count)) {
    if (!/[\u4e00-\u9fa5]/.test(spec) || containsEnglish(spec)) {
      console.log(`  ${spec}（${info.count} 筆） 例：${Array.from(info.examples).slice(0, 3).join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
