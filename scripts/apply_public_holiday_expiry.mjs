// =====================================================
// 套用公眾假期 30 天有效期 migration
// 用法：node --env-file=.env scripts/apply_public_holiday_expiry.mjs
// 需要 SUPABASE_SERVICE_ROLE_KEY 與 VITE_SUPABASE_URL
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ 請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260808110000_public_holiday_expiry.sql');
const migrationSql = readFileSync(migrationPath, 'utf-8');

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

async function columnsExist() {
  const { data, error } = await supabase.rpc('exec_sql_readonly', {
    query_text: `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_public_holiday_details' AND column_name IN ('reference_public_holiday_id', 'expiry_date')`,
  });
  if (error) {
    console.log('⚠️ 無法檢查欄位，假設 migration 尚未執行:', error.message);
    return false;
  }
  const rows = Array.isArray(data) ? data : [];
  const names = new Set(rows.map((r) => r.column_name));
  return names.has('reference_public_holiday_id') && names.has('expiry_date');
}

async function runSql(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    throw new Error(`無法透過 RPC 執行 DDL：${error.message}`);
  }
}

async function main() {
  console.log('🚀 套用公眾假期 30 天有效期 migration');

  const exists = await columnsExist();
  if (!exists) {
    console.log('📝 欄位尚未建立，嘗試透過 Supabase CLI 套用 migration...');
    try {
      await runSql(migrationSql);
      console.log('✅ Migration 已套用');
    } catch (rpcErr) {
      console.error(`❌ ${rpcErr.message}`);
      console.log('\n請改用 Supabase CLI 手動套用：');
      console.log('  npx supabase db push --include-all --yes');
      console.log('\n或在 Supabase Dashboard SQL Editor 貼上：');
      console.log(migrationSql);
      process.exit(1);
    }
  } else {
    console.log('✅ 欄位已存在，跳過 DDL，只重建系統發放行');
  }

  // 為所有已設定 PH/SH 的用戶重建系統發放行
  console.log('🔄 重建公眾假期系統發放行...');
  const today = toDateStr(new Date());

  const { data: users, error: uErr } = await supabase
    .from('user_employment_details')
    .select('user_id, public_holiday_type, public_holiday_start_date')
    .not('public_holiday_type', 'is', null)
    .not('public_holiday_start_date', 'is', null);
  if (uErr) throw uErr;

  let insertedTotal = 0;
  for (const u of users ?? []) {
    const type = u.public_holiday_type;
    const start = u.public_holiday_start_date;
    if (!type || !start || start > today) continue;

    const { data: holidays, error: hErr } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('type', type)
      .gte('holiday_date', start)
      .lte('holiday_date', today)
      .order('holiday_date', { ascending: true });
    if (hErr) throw hErr;

    const grants = [];
    for (const h of holidays ?? []) {
      const [hy, hm] = h.holiday_date.split('-').map(Number);
      const recordDate = `${hy}-${String(hm).padStart(2, '0')}-01`;
      grants.push({
        user_id: u.user_id,
        record_date: recordDate,
        detail_type: 'grant',
        days: 1,
        remark: h.name,
        reference_public_holiday_id: h.id,
        expiry_date: addDays(h.holiday_date, 30),
        is_system: true,
      });
    }

    if (grants.length === 0) continue;

    const { error: delErr } = await supabase
      .from('user_public_holiday_details')
      .delete()
      .eq('user_id', u.user_id)
      .eq('is_system', true)
      .eq('detail_type', 'grant');
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from('user_public_holiday_details').insert(grants);
    if (insErr) throw insErr;

    insertedTotal += grants.length;
    console.log(`  ✓ user ${u.user_id}: ${grants.length} 筆 ${type} grant`);
  }

  console.log(`✅ 共重建 ${insertedTotal} 筆系統發放行`);
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
