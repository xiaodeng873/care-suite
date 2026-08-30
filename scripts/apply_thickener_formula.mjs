#!/usr/bin/env node
// 執行 thickener_formula 欄位 migration
// 用法: SUPABASE_SERVICE_ROLE_KEY='your_key_here' node apply_thickener_formula.mjs

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
  `ALTER TABLE meal_guidance ADD COLUMN IF NOT EXISTS thickener_formula text`,
  `COMMENT ON COLUMN meal_guidance.thickener_formula IS '凝固粉配方（普遍配方 / 清透配方），僅在 needs_thickener = true 時使用'`,
];

async function run() {
  console.log('🚀 開始執行 thickener_formula 欄位 migration...\n');

  for (const sql of statements) {
    const preview = sql.substring(0, 80) + (sql.length > 80 ? '...' : '');
    process.stdout.write(`  → ${preview} `);
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
      console.log(`\n     ⚠️  exec_sql 不可用: ${error.message}`);
      console.log(`     ℹ️  請手動在 Supabase Dashboard SQL Editor 執行以下語句:`);
      console.log(`     ${sql};\n`);
    } else {
      console.log('✅');
    }
  }

  // 驗證欄位是否存在
  console.log('\n🔍 驗證欄位...');
  const { error } = await supabase
    .from('meal_guidance')
    .select('thickener_formula')
    .limit(1);

  if (!error) {
    console.log('  ✅ meal_guidance.thickener_formula 欄位存在');
  } else {
    console.log(`  ❌ meal_guidance: ${error.message}`);
  }

  console.log('\n完成。');
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
