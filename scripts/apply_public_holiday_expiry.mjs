// =====================================================
// 套用公眾假期 30 天有效期並重建系統發放行
// 用法：node --env-file=.env scripts/apply_public_holiday_expiry.mjs
// 需要 SUPABASE_SERVICE_ROLE_KEY 與 VITE_SUPABASE_URL
// =====================================================

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ 請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function syncFunctionExists() {
  const { data, error } = await supabase.rpc('exec_sql_readonly', {
    query_text: `SELECT 1 FROM pg_proc WHERE proname = 'sync_public_holiday_grants_for_user'`,
  });
  if (error) {
    console.error('⚠️ 無法檢查同步函數:', error.message);
    return false;
  }
  return (Array.isArray(data) ? data : []).length > 0;
}

async function main() {
  console.log('🚀 套用公眾假期系統發放行同步');

  const exists = await syncFunctionExists();
  if (!exists) {
    console.error('❌ 未找到 sync_public_holiday_grants_for_user');
    console.log('請先執行 Supabase migration：');
    console.log('  npx supabase db push');
    process.exit(1);
  }

  // 為所有已設定 PH/SH 的用戶重建系統發放行
  console.log('🔄 重建公眾假期系統發放行...');
  const today = new Date().toISOString().slice(0, 10);

  const { data: users, error: uErr } = await supabase
    .from('user_employment_details')
    .select('user_id, public_holiday_type, public_holiday_start_date')
    .not('public_holiday_type', 'is', null)
    .not('public_holiday_start_date', 'is', null);
  if (uErr) throw uErr;

  let synced = 0;
  for (const u of users ?? []) {
    const type = u.public_holiday_type;
    const start = u.public_holiday_start_date;
    if (!type || !start || start > today) continue;

    const { error: rpcErr } = await supabase.rpc('sync_public_holiday_grants_for_user', {
      p_user_id: u.user_id,
    });
    if (rpcErr) throw new Error(`同步 user ${u.user_id} 失敗：${rpcErr.message}`);

    synced++;
    console.log(`  ✓ user ${u.user_id}: ${type} 同步完成`);
  }

  console.log(`✅ 共為 ${synced} 位用戶同步公眾假期系統發放行`);
  console.log('\n⚠️  注意：現有 usage 明細若缺少 reference_public_holiday_id，將無法對應到具體假期。');
  console.log('   如需要，可手動在 SQL Editor 執行：');
  console.log(`   UPDATE user_public_holiday_details u
   SET reference_public_holiday_id = p.id,
       expiry_date = p.holiday_date + INTERVAL '30 days'
   FROM public_holidays p
   WHERE u.detail_type = 'usage'
     AND u.reference_public_holiday_id IS NULL
     AND (u.remark ILIKE '%' || p.name || '%' OR u.record_date BETWEEN p.holiday_date AND p.holiday_date + INTERVAL '30 days')
     AND p.type = (SELECT public_holiday_type FROM user_employment_details e WHERE e.user_id = u.user_id);`);
}

main().catch((err) => {
  console.error('❌ 套用失敗:', err);
  process.exit(1);
});
