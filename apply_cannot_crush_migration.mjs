#!/usr/bin/env node
// 執行 cannot_crush 欄位 migration
// 用法: SUPABASE_SERVICE_ROLE_KEY='your_key_here' node apply_cannot_crush_migration.mjs

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
  `ALTER TABLE medication_drug_database ADD COLUMN IF NOT EXISTS cannot_crush boolean DEFAULT false`,
  `COMMENT ON COLUMN medication_drug_database.cannot_crush IS '藥物是否不可碎藥（true = 不可碎藥）'`,
  `ALTER TABLE new_medication_prescriptions ADD COLUMN IF NOT EXISTS cannot_crush boolean DEFAULT false`,
  `COMMENT ON COLUMN new_medication_prescriptions.cannot_crush IS '該處方的藥物是否不可碎藥（true = 不可碎藥）'`,
  `CREATE INDEX IF NOT EXISTS idx_medication_drug_database_cannot_crush ON medication_drug_database(cannot_crush) WHERE cannot_crush = true`,
  `CREATE INDEX IF NOT EXISTS idx_new_medication_prescriptions_cannot_crush ON new_medication_prescriptions(cannot_crush) WHERE cannot_crush = true`,
];

async function run() {
  console.log('🚀 開始執行 cannot_crush 欄位 migration...\n');

  for (const sql of statements) {
    const preview = sql.substring(0, 80) + (sql.length > 80 ? '...' : '');
    process.stdout.write(`  → ${preview} `);
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
      // fallback: try direct query via from().rpc()
      console.log(`\n     ⚠️  exec_sql 不可用: ${error.message}`);
      console.log(`     ℹ️  請手動在 Supabase Dashboard SQL Editor 執行以下語句:`);
      console.log(`     ${sql};\n`);
    } else {
      console.log('✅');
    }
  }

  // 驗證欄位是否存在
  console.log('\n🔍 驗證欄位...');
  const { data: drugData, error: drugError } = await supabase
    .from('medication_drug_database')
    .select('cannot_crush')
    .limit(1);
  
  const { data: rxData, error: rxError } = await supabase
    .from('new_medication_prescriptions')
    .select('cannot_crush')
    .limit(1);

  if (!drugError) {
    console.log('  ✅ medication_drug_database.cannot_crush 欄位存在');
  } else {
    console.log(`  ❌ medication_drug_database: ${drugError.message}`);
  }

  if (!rxError) {
    console.log('  ✅ new_medication_prescriptions.cannot_crush 欄位存在');
  } else {
    console.log(`  ❌ new_medication_prescriptions: ${rxError.message}`);
  }

  console.log('\n完成。');
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
