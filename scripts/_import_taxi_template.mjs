// 一次性：將輪椅的士安排通知訊息模板匯入所有非 test 用戶
// 只寫 taxi 鍵，companion/family 留空（讀取端會用預設值）
// 用法：node scripts/_import_taxi_template.mjs        （DRY RUN）
//       node scripts/_import_taxi_template.mjs apply
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  key = readFileSync('apps/web/.env', 'utf-8').split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))?.split('=')[1]?.trim();
}
if (!key) { console.error('缺少 SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', key, { auth: { autoRefreshToken: false, persistSession: false } });
const APPLY = process.argv[2] === 'apply';

const TAXI_TEMPLATE = '預約日期：{覆診日期}（{覆診星期}）\n上車時間：{出發時間}\n起點：{院舍名稱}\n目的地：{覆診地點}\n預約：來回程\n同行人數(不計院友)：1職員陪診\n院友姓名：{居住區}{院友名稱}\n聯絡電話：';

const { data: users, error } = await supabase
  .from('user_profiles')
  .select('id, username, followup_message_templates')
  .not('username', 'ilike', 'test%')
  .not('username', 'ilike', 'rb_%');
if (error) { console.error('查詢失敗:', error.message); process.exit(1); }

console.log(`共 ${users.length} 個用戶`);
for (const u of users) {
  const existing = u.followup_message_templates ?? {};
  const merged = { ...existing, taxi: { template: TAXI_TEMPLATE, phone: existing.taxi?.phone ?? '' } };
  console.log(`${u.username}: taxi 模板${existing.taxi ? '（覆蓋舊版）' : ''}`);
  if (APPLY) {
    const { error: upErr } = await supabase.from('user_profiles').update({ followup_message_templates: merged }).eq('id', u.id);
    if (upErr) console.error(`  ${u.username} 更新失敗: ${upErr.message}`);
  }
}
console.log(APPLY ? '完成' : '（DRY RUN，未寫入）');
