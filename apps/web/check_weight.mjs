import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';

const supabase = createClient(supabaseUrl, supabaseKey);

const result = await supabase
  .from('健康記錄主表')
  .select('記錄類型, 體重, 記錄日期')
  .order('記錄日期', { ascending: false })
  .limit(1000);

console.log('查詢結果:', result.error || '成功');
console.log('記錄數:', result.data ? result.data.length : 0);

if (result.data) {
  const stats = {
    生命表徵: 0,
    血糖控制: 0,
    體重控制: 0,
    生命表徵_有體重: 0,
    體重控制_有體重: 0
  };
  
  result.data.forEach(r => {
    if (r.記錄類型 === '生命表徵') stats.生命表徵++;
    if (r.記錄類型 === '血糖控制') stats.血糖控制++;
    if (r.記錄類型 === '體重控制') stats.體重控制++;
    if (r.記錄類型 === '生命表徵' && r.體重 != null) stats.生命表徵_有體重++;
    if (r.記錄類型 === '體重控制' && r.體重 != null) stats.體重控制_有體重++;
  });
  
  console.log('\n統計結果:');
  console.log(JSON.stringify(stats, null, 2));
}
