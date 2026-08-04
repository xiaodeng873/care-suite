import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ 錯誤: 需要設置 SUPABASE_ANON_KEY 環境變量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runFix() {
  try {
    console.log('🔧 正在修復 RLS 策略...');
    console.log('');
    
    // 方法1: 嘗試直接執行 SQL
    const statements = [
      'ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE output_items ENABLE ROW LEVEL SECURITY',
      `CREATE POLICY "Enable all for authenticated users on intake_items" ON intake_items FOR ALL USING (auth.role() = 'authenticated')`,
      `CREATE POLICY "Enable all for authenticated users on output_items" ON output_items FOR ALL USING (auth.role() = 'authenticated')`
    ];
    
    for (const sql of statements) {
      console.log('嘗試執行:', sql.substring(0, 60) + '...');
      try {
        // 使用 from().select() 是因為某些操作可能需要這樣做
        const { data, error } = await supabase.rpc('exec', { query: sql });
        if (error) {
          console.log('⚠️  此方法不支援，需要手動執行');
        } else {
          console.log('✅ 成功');
        }
      } catch (e) {
        console.log('⚠️  無法通過 API 執行 DDL 語句');
      }
    }
    
    console.log('');
    console.log('📋 請手動執行以下 SQL:');
    console.log('');
    console.log('1. 登入 Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. 選擇項目 → SQL Editor');
    console.log('3. 執行以下 SQL:');
    console.log('');
    console.log('-------------------');
    statements.forEach(s => console.log(s + ';'));
    console.log('-------------------');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

runFix();
