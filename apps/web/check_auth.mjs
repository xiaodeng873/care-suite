import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';

const supabase = createClient(supabaseUrl, supabaseKey);

// 檢查 RLS 政策
console.log('測試資料庫連線和 RLS 政策...\n');

// 嘗試查詢院友主表
const patientsResult = await supabase
  .from('院友主表')
  .select('院友id, 中文姓名', { count: 'exact' })
  .limit(5);

console.log('院友主表查詢:');
console.log('  錯誤:', patientsResult.error || '無');
console.log('  記錄數:', patientsResult.count);
console.log('  樣本:', patientsResult.data ? patientsResult.data.length : 0, '筆');

// 嘗試查詢健康記錄
const healthResult = await supabase
  .from('健康記錄主表')
  .select('*', { count: 'exact' })
  .limit(5);

console.log('\n健康記錄主表查詢:');
console.log('  錯誤:', healthResult.error || '無');
console.log('  記錄數:', healthResult.count);
console.log('  樣本:', healthResult.data ? healthResult.data.length : 0, '筆');

if (healthResult.data && healthResult.data.length > 0) {
  console.log('\n第一筆記錄:');
  console.log(JSON.stringify(healthResult.data[0], null, 2));
}
