import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 錯誤: 需要設置 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY 環境變量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  try {
    console.log('📋 正在讀取遷移文件...');
    
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251222000002_add_rls_to_intake_output_items.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 開始執行遷移...');
    console.log('遷移文件: 20251222000002_add_rls_to_intake_output_items.sql');
    console.log('');
    
    // 分割 SQL 語句並逐個執行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        console.log('執行:', statement.substring(0, 80) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.error('❌ 錯誤:', error);
          throw error;
        }
      }
    }
    
    console.log('');
    console.log('✅ 遷移完成！');
    console.log('');
    console.log('已為以下表啟用 RLS 並添加策略:');
    console.log('  - intake_items');
    console.log('  - output_items');
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error);
    process.exit(1);
  }
}

runMigration();
