/**
 * 藥物資料庫去重腳本
 *
 * 找出 medication_drug_database 中 drug_name 完全相同的記錄，
 * 每組只保留一筆，優先保留有 drug_code 的；
 * 若同組都有或都無 drug_code，則保留填寫欄位最多的那筆（最「豐富」的）。
 *
 * 用法：
 *   預覽（不刪除）：
 *     SUPABASE_SERVICE_ROLE_KEY=xxx node dedup_drug_database.mjs
 *
 *   實際執行刪除：
 *     SUPABASE_SERVICE_ROLE_KEY=xxx node dedup_drug_database.mjs --execute
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const DRY_RUN = !process.argv.includes('--execute');

if (!KEY) {
  console.error('❌ 請先設定 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY);

/** 計算一筆記錄填了多少個有意義的欄位（越多越優先保留） */
function completenessScore(row) {
  const fields = ['drug_code', 'drug_type', 'administration_route', 'unit', 'photo_url', 'notes'];
  return fields.reduce((score, f) => score + (row[f] != null && row[f] !== '' ? 1 : 0), 0);
}

/**
 * 判斷一組重複記錄是否「有疑問」（多筆帶有不同 drug_code）。
 * 若是，擱置不處理（避免誤刪有意義的不同編號）。
 */
function isAmbiguous(rows) {
  const codes = [...new Set(
    rows
      .map(r => r.drug_code?.trim())
      .filter(c => c)          // 排除空值
  )];
  return codes.length > 1;     // 2 個以上不同 code → 有疑問
}

/** 從一組重複記錄中選出要保留的那一筆，回傳其 id */
function pickKeeper(rows) {
  return [...rows].sort((a, b) => {
    const aHasCode = a.drug_code != null && a.drug_code !== '';
    const bHasCode = b.drug_code != null && b.drug_code !== '';

    // 有 drug_code 的優先
    if (aHasCode && !bHasCode) return -1;
    if (!aHasCode && bHasCode) return 1;

    // 同樣有/無 drug_code，填寫欄位多的優先
    const diff = completenessScore(b) - completenessScore(a);
    if (diff !== 0) return diff;

    // 最後以建立時間（較舊的）作為穩定排序
    return new Date(a.created_at) - new Date(b.created_at);
  })[0].id;
}

async function main() {
  console.log(DRY_RUN
    ? '🔍 預覽模式（不會實際刪除）— 加上 --execute 旗標才真正執行\n'
    : '⚠️  執行模式 — 將正式刪除重複項目\n');

  // 1. 取得全部記錄（分頁查詢，每次 1000 筆）
  let allRows = [];
  let pageNo = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: pageData, error } = await supabase
      .from('medication_drug_database')
      .select('*')
      .order('drug_name', { ascending: true })
      .range(pageNo * PAGE_SIZE, (pageNo + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      process.exit(1);
    }

    if (!pageData || pageData.length === 0) break;
    allRows = allRows.concat(pageData);
    pageNo++;
  }

  console.log(`📦 共 ${allRows.length} 筆藥物記錄`);

  // 2. 按 drug_name 分組
  const groups = new Map();
  for (const row of allRows) {
    const key = row.drug_name.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  // 3. 找出重複組
  const duplicateGroups = [...groups.values()].filter(g => g.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ 沒有重複項目，無需處理。');
    return;
  }

  console.log(`\n🔁 找到 ${duplicateGroups.length} 組重複名稱，共涉及 ${duplicateGroups.reduce((s, g) => s + g.length, 0)} 筆記錄：\n`);

  const toDelete = [];

  let skipped = 0;

  for (const group of duplicateGroups) {
    // 有多個不同 drug_code → 有疑問，擱置
    if (isAmbiguous(group)) {
      console.log(`  ⏸  擱置（多個不同編號）：${group[0].drug_name}`);
      for (const r of group) {
        console.log(`       [${r.id}] code=${r.drug_code || '—'}`);
      }
      console.log('');
      skipped++;
      continue;
    }

    const keeperId = pickKeeper(group);
    const keeper = group.find(r => r.id === keeperId);
    const deletes = group.filter(r => r.id !== keeperId);

    console.log(`  藥名：${keeper.drug_name}`);
    console.log(`    ✅ 保留 [${keeperId}] code=${keeper.drug_code || '—'}  欄位分=${completenessScore(keeper)}`);
    for (const d of deletes) {
      console.log(`    🗑  刪除 [${d.id}] code=${d.drug_code || '—'}  欄位分=${completenessScore(d)}`);
      toDelete.push(d.id);
    }
    console.log('');
  }

  console.log(`共將刪除 ${toDelete.length} 筆重複記錄，擱置 ${skipped} 組有疑問的項目。`);

  if (DRY_RUN) {
    console.log('\n📝 預覽結束。加上 --execute 旗標重新執行以實際刪除。');
    return;
  }

  // 4. 批次刪除（每次最多 100 筆，避免 URL 過長）
  console.log('\n🚀 開始刪除...');
  const BATCH = 100;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error: delErr } = await supabase
      .from('medication_drug_database')
      .delete()
      .in('id', batch);

    if (delErr) {
      console.error(`❌ 第 ${i + 1}～${i + batch.length} 筆刪除失敗:`, delErr.message);
      process.exit(1);
    }
    deleted += batch.length;
    console.log(`  已刪除 ${deleted} / ${toDelete.length}...`);
  }

  console.log(`\n✅ 完成！成功刪除 ${deleted} 筆重複記錄。`);
}

main();
