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

async function runMigration() {
  try {
    console.log('📋 正在读取迁移文件...');
    
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251222000000_create_intake_output_records.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 开始执行迁移...');
    console.log('迁移文件: 20251222000000_create_intake_output_records.sql');
    console.log('');
    
    // 使用 rpc 执行 SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      // 如果 exec_sql 函数不存在，尝试直接执行
      console.log('⚠️  exec_sql 函数不可用，尝试分段执行...');
      
      // 分割SQL语句
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`📝 共 ${statements.length} 条SQL语句`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        console.log(`\n执行语句 ${i + 1}/${statements.length}:`);
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
        
        try {
          // 对于某些语句，需要使用不同的方法
          if (statement.includes('CREATE TABLE')) {
            // 使用 PostgreSQL REST API
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query: statement })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ 执行失败: ${errorText}`);
            } else {
              console.log('✅ 执行成功');
            }
          }
        } catch (err) {
          console.error(`❌ 执行语句时出错:`, err.message);
        }
      }
      
      console.log('\n⚠️  注意: 由于API限制，某些语句可能需要手动在 Supabase Dashboard 中执行');
      console.log('\n请按以下步骤手动执行迁移:');
      console.log('1. 访问 https://supabase.com/dashboard/project/mzeptzwuqvpjspxgnzkp/sql');
      console.log('2. 打开 SQL Editor');
      console.log('3. 复制以下迁移文件内容:');
      console.log('   supabase/migrations/20251222000000_create_intake_output_records.sql');
      console.log('4. 粘贴到 SQL Editor 中并点击 RUN');
      
    } else {
      console.log('✅ 迁移执行成功!');
      console.log(data);
    }
    
    // 验证表是否创建成功
    console.log('\n🔍 验证表是否创建...');
    const { data: tableData, error: tableError } = await supabase
      .from('intake_output_records')
      .select('*')
      .limit(1);
    
    if (tableError) {
      if (tableError.code === '42P01') {
        console.log('❌ 表不存在，请手动执行迁移');
        console.log('\n📋 手动执行步骤:');
        console.log('1. 打开 Supabase Dashboard: https://supabase.com/dashboard/project/mzeptzwuqvpjspxgnzkp');
        console.log('2. 进入 SQL Editor');
        console.log('3. 复制文件内容: supabase/migrations/20251222000000_create_intake_output_records.sql');
        console.log('4. 粘贴并执行');
      } else {
        console.log('⚠️  检查表时出错:', tableError.message);
        console.log('可能需要手动验证');
      }
    } else {
      console.log('✅ 表 intake_output_records 已成功创建!');
      console.log('✅ 数据库迁移完成!');
    }
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
