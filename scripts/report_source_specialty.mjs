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

async function main() {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('new_medication_prescriptions')
      .select('medication_source,medication_source_specialty,medication_name,status')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const emptySpecBySource = {};
  const nonEmptySpecBySource = {};

  for (const r of all) {
    const src = r.medication_source || '';
    const spec = r.medication_source_specialty || '';
    if (spec) {
      if (!nonEmptySpecBySource[src]) nonEmptySpecBySource[src] = new Set();
      nonEmptySpecBySource[src].add(spec);
    } else {
      if (!emptySpecBySource[src]) emptySpecBySource[src] = { count: 0, examples: new Set() };
      emptySpecBySource[src].count += 1;
      emptySpecBySource[src].examples.add(r.medication_name);
    }
  }

  console.log('=== 有專科的來源（已有對照） ===');
  for (const [src, specs] of Object.entries(nonEmptySpecBySource).sort()) {
    console.log(`  ${src} → ${Array.from(specs).join(' / ')}`);
  }

  console.log('\n=== 專科為空的來源（需要你給對照） ===');
  for (const [src, info] of Object.entries(emptySpecBySource).sort((a, b) => b[1].count - a[1].count)) {
    const examples = Array.from(info.examples).slice(0, 5).join(', ');
    console.log(`  ${src}（${info.count} 筆） 例：${examples}`);
  }

  console.log('\n=== 總結 ===');
  console.log(`專科為空總筆數：${Object.values(emptySpecBySource).reduce((a, b) => a + b.count, 0)}`);
  console.log(`有專科總筆數：${all.length - Object.values(emptySpecBySource).reduce((a, b) => a + b.count, 0)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
