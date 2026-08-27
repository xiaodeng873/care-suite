import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 需要设置 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MIGRATION_FILE = '20260827000001_remove_one_shift_per_day_constraint.sql';

async function runMigration() {
  try {
    console.log(`📋 正在读取迁移文件 ${MIGRATION_FILE}...`);

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', MIGRATION_FILE);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 开始执行迁移...');

    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ 迁移执行失败:', error.message);
      console.log('\n📋 请手动在 Supabase SQL Editor 执行以下文件:');
      console.log(`   supabase/migrations/${MIGRATION_FILE}`);
      process.exit(1);
    }

    console.log('✅ 迁移执行成功!');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
