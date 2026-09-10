#!/usr/bin/env node
// 執行 vaccination_records.vaccine_category 欄位 migration
// 用法: 由 repo root 執行 `node scripts/apply_vaccination_category_migration.mjs`（.env 已有 SERVICE_ROLE_KEY）

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ 請提供 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const statements = [
  `ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS vaccine_category text`,
  `COMMENT ON COLUMN vaccination_records.vaccine_category IS '疫苗類別：流感疫苗 / 肺炎鏈球菌疫苗 / 新冠疫苗 / 其他疫苗（打印時舊記錄冇類別會用疫苗名稱關鍵字推斷）'`,
];

async function run() {
  console.log('🚀 開始執行 vaccine_category 欄位 migration...\n');

  for (const sql of statements) {
    const short = sql.length > 70 ? sql.slice(0, 70) + '...' : sql;
    console.log(`   執行: ${short}`);

    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
      console.error(`\n❌ 執行失敗: ${error.message}\n`);
      process.exit(1);
    }
    console.log('   ✅ 成功\n');
  }

  console.log('🎉 vaccine_category migration 全部完成！');
}

run();
