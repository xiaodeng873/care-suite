import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_NAMES = [
  '陳睿智', '霍穎豪', '黃麗安', '梁健兒', '郭惠蓮',
  '何淑慧', '關錦霞', '王兆基', '李淑怡', '劉富卿', '蕭菊',
  '李柏湖', '劉豔芬', '梁嘉榮', '鄧業燁', '譚漢斌', '蔡幸鑫',
  '何梓健', '羅泳僖', '王梓榆', '莫家熾',
];

async function main() {
  // 1. 查詢 2026-09 所有預排記錄
  const { data: records, error: recError } = await supabase
    .from('user_leave_records')
    .select('id, user_id, leave_date, leave_type, record_type, is_auto')
    .gte('leave_date', '2026-09-01')
    .lte('leave_date', '2026-09-30')
    .order('user_id')
    .order('leave_date');

  if (recError) {
    console.error('查詢預排記錄失敗:', recError);
    process.exit(1);
  }

  console.log(`=== 2026-09 現有預排記錄：共 ${records.length} 筆 ===`);
  const byType = {};
  for (const r of records) {
    byType[r.leave_type] = (byType[r.leave_type] || 0) + 1;
  }
  console.log('按假別統計:', byType);

  // 2. 查詢目標員工
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, name_zh, username, is_active')
    .in('name_zh', TARGET_NAMES);

  if (userError) {
    console.error('查詢員工失敗:', userError);
    process.exit(1);
  }

  console.log(`\n=== 目標員工 ID 對照（${users.length} 人）===`);
  const nameToId = {};
  for (const u of users) {
    nameToId[u.name_zh] = u.id;
    console.log(`${u.name_zh}: ${u.id} (active=${u.is_active})`);
  }

  const missing = TARGET_NAMES.filter((n) => !nameToId[n]);
  if (missing.length > 0) {
    console.log('\n⚠️ 找不到的員工:', missing);
  }

  // 3. 查詢 2026-09-26 公眾假期
  const { data: holidays, error: holError } = await supabase
    .from('public_holidays')
    .select('id, holiday_date, name, type')
    .eq('holiday_date', '2026-09-26');

  if (holError) {
    console.error('查詢公眾假期失敗:', holError);
    process.exit(1);
  }

  console.log('\n=== 2026-09-26 公眾假期 ===');
  console.log(holidays);
}

main().catch(console.error);
