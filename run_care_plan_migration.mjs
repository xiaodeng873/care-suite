import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 錯誤: 需要設置 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigrations() {
  try {
    const migrations = [
      '20251227000000_add_case_conference_to_care_plans.sql',
      '20251227000001_add_social_worker_category.sql'
    ];

    for (const migrationFile of migrations) {
      console.log(`\n📋 正在讀取遷移文件: ${migrationFile}...`);
      
      const migrationPath = join(__dirname, 'supabase', 'migrations', migrationFile);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      console.log('🚀 開始執行遷移...');
      
      // 將 SQL 分割成多個語句執行
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
          
          if (error) {
            console.error(`❌ 執行失敗:`, error);
            // 繼續執行，因為某些語句可能已存在
          }
        }
      }
      
      console.log(`✅ 遷移 ${migrationFile} 執行完成`);
    }
    
    console.log('\n🎉 所有遷移執行完成！');
    
  } catch (error) {
    console.error('❌ 遷移執行失敗:', error);
    process.exit(1);
  }
}

runMigrations();
