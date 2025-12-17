import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';

console.log('=== 检查 Supabase 客户端配置 ===\n');
console.log('Supabase URL:', SUPABASE_URL);
console.log('Anon Key (前20字符):', SUPABASE_ANON_KEY.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('\n客户端创建成功');
console.log('Rest URL:', supabase.rest.url);
console.log('Auth URL:', supabase.auth.url);

// 测试连接
console.log('\n=== 测试 API 连接 ===');
const { data, error } = await supabase.from('patrol_rounds').select('count', { count: 'exact', head: true });
if (error) {
  console.log('❌ 连接失败:', error.message);
} else {
  console.log('✓ API 连接正常');
}
