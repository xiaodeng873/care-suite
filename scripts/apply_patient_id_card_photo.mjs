#!/usr/bin/env node
// 執行 院友主表.身份證相片 欄位 migration
// 用法: SUPABASE_SERVICE_ROLE_KEY='your_key_here' node apply_patient_id_card_photo.mjs

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
  `ALTER TABLE "院友主表" ADD COLUMN IF NOT EXISTS "身份證相片" text`,
  `COMMENT ON COLUMN "院友主表"."身份證相片" IS '身份證圖留檔（base64 data URL，由 AI 助護身份證分析流程寫入）'`,
];

async function run() {
  console.log('🚀 開始執行 院友主表.身份證相片 欄位 migration...\n');

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
  const { error } = await supabase
    .from('院友主表')
    .select('身份證相片')
    .limit(1);

  if (!error) {
    console.log('  ✅ 院友主表.身份證相片 欄位存在');
  } else {
    console.log(`  ❌ 院友主表: ${error.message}`);
  }

  console.log('\n完成。');
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
