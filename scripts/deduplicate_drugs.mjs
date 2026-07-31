import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數：請提供 VITE_SUPABASE_URL / SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
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
    const { data, error } = await supabase.from(table).select(select).order('id').range(from, from + PAGE - 1);
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

  const drugs = await fetchAll('medication_drug_database', 'id,drug_name');
  console.log(`藥物資料庫總數：${drugs.length}`);

  const groups = new Map();
  for (const d of drugs) {
    const name = (d.drug_name || '').trim();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(d);
  }

  const duplicates = [];
  let totalDup = 0;
  for (const [name, list] of groups) {
    if (list.length > 1) {
      duplicates.push({ name, count: list.length, keep: list[0].id, delete: list.slice(1).map(d => d.id) });
      totalDup += list.length - 1;
    }
  }

  console.log(`重複藥物名稱組數：${duplicates.length}`);
  console.log(`重複筆數（將刪除）：${totalDup}`);
  console.log(`去重後預計剩餘：${drugs.length - totalDup}`);

  if (DRY_RUN) {
    console.log('\nDRY-RUN 預覽前 20 組重複：');
    for (const g of duplicates.slice(0, 20)) {
      console.log(`  "${g.name}" 共 ${g.count} 筆，保留 id=${g.keep}，刪除 ${g.delete.join(', ')}`);
    }
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const g of duplicates) {
    for (const id of g.delete) {
      const { error } = await supabase.from('medication_drug_database').delete().eq('id', id);
      if (error) {
        console.error(`刪除 "${g.name}" id=${id} 失敗：${error.message}`);
        failed += 1;
      } else {
        deleted += 1;
      }
    }
  }
  console.log(`\n實際刪除：${deleted} 筆，失敗：${failed} 筆`);
  console.log(`去重後剩餘：${drugs.length - deleted} 筆`);
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
