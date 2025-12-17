import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testWithAuth() {
  console.log('=== Supabase 数据库测试（需要登录）===\n');
  
  const email = await question('请输入邮箱: ');
  const password = await question('请输入密码: ');
  
  console.log('\n正在登录...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password.trim()
  });
  
  if (authError) {
    console.error('登录失败:', authError.message);
    rl.close();
    return;
  }
  
  console.log('✓ 登录成功！用户:', authData.user.email);
  console.log('');
  
  // 检查表记录数
  console.log('=== 统计记录数 ===');
  
  const tables = [
    'patrol_rounds',
    'diaper_change_records',
    'restraint_observation_records',
    'position_change_records'
  ];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`${table}: 错误 - ${error.message}`);
    } else {
      console.log(`${table}: ${count} 条记录`);
      
      // 显示最新的3条记录
      const { data: records } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (records && records.length > 0) {
        console.log(`  最新记录:`);
        records.forEach((r, i) => {
          const dateField = table.includes('patrol') ? 'patrol_date' : 
                           table.includes('diaper') ? 'change_date' : 
                           table.includes('restraint') ? 'observation_date' : 'change_date';
          console.log(`    ${i+1}. ID: ${r.id.substring(0, 8)}... | 日期: ${r[dateField]} | 记录者: ${r.recorder}`);
        });
      }
    }
    console.log('');
  }
  
  rl.close();
}

testWithAuth().catch(err => {
  console.error('发生错误:', err);
  rl.close();
});
