#!/usr/bin/env node
// 執行疫苗意向查詢訊息設定欄位 migration（對 live DB 直接 ALTER）
// 用法: node scripts/apply_vaccination_message_settings.mjs
// 環境變數取自專案根目錄 .env：
//   SUPABASE_ACCESS_TOKEN（Supabase Management API，必要）
//   VITE_SUPABASE_URL（用以取出 project ref）

import fs from 'fs';

// 從專案根目錄 .env 載入環境變量
const envPath = new URL('../.env', import.meta.url);
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // 無 .env 時改用既有環境變數
}

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_URL = process.env.VITE_SUPABASE_URL || 'https://mzeptzwuqvpjspxgnzkp.supabase.co';

if (!ACCESS_TOKEN) {
  console.error('❌ 請提供 SUPABASE_ACCESS_TOKEN 環境變數');
  process.exit(1);
}

const ref = PROJECT_URL.replace(/^https?:\/\//, '').split('.')[0];
const ENDPOINT = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const statements = [
  `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_message_template text`,
  `COMMENT ON COLUMN user_profiles.vaccination_message_template IS '疫苗意向查詢 WhatsApp 訊息模板'`,
  `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccine_name text`,
  `COMMENT ON COLUMN user_profiles.vaccination_vaccine_name IS '疫苗意向查詢訊息：疫苗名稱'`,
  `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccine_name_2 text`,
  `COMMENT ON COLUMN user_profiles.vaccination_vaccine_name_2 IS '疫苗意向查詢訊息：疫苗名稱2（第二種疫苗，可留空）'`,
  `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_vaccination_date text`,
  `COMMENT ON COLUMN user_profiles.vaccination_vaccination_date IS '疫苗意向查詢訊息：接種日期'`,
  `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS vaccination_deadline text`,
  `COMMENT ON COLUMN user_profiles.vaccination_deadline IS '疫苗意向查詢訊息：簽署截止日期'`,
];

async function exec(sql) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return body;
}

async function run() {
  console.log('🚀 開始執行 vaccination_message_settings 欄位 migration...\n');

  let failed = false;
  for (const sql of statements) {
    const preview = sql.substring(0, 80) + (sql.length > 80 ? '...' : '');
    process.stdout.write(`  → ${preview} `);
    try {
      await exec(sql);
      console.log('✅');
    } catch (err) {
      failed = true;
      console.log(`\n     ❌ 失敗: ${err.message}`);
      console.log(`     ℹ️  請手動在 Supabase Dashboard SQL Editor 執行: ${sql};`);
    }
  }

  // 驗證欄位是否存在
  console.log('\n🔍 驗證欄位...');
  try {
    const result = await exec(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name LIKE 'vaccination_%' ORDER BY column_name`
    );
    const cols = JSON.parse(result).map(r => r.column_name);
    const expected = ['vaccination_deadline', 'vaccination_message_template', 'vaccination_vaccination_date', 'vaccination_vaccine_name'];
    const missing = expected.filter(c => !cols.includes(c));
    if (missing.length === 0) {
      console.log('  ✅ user_profiles 四個 vaccination_* 欄位已存在');
    } else {
      console.log(`  ❌ 缺少欄位: ${missing.join(', ')}`);
      failed = true;
    }
  } catch (err) {
    console.log(`  ❌ 驗證失敗: ${err.message}`);
    failed = true;
  }

  if (failed) {
    console.error('\n⚠️ 部分語句失敗，請檢查上方訊息');
    process.exit(1);
  }
  console.log('\n完成。');
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
