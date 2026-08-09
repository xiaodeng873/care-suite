// =====================================================
// 排班管理測試用假資料產生器
// 用法：node --env-file=.env scripts/seed_roster_test_data.mjs
// 需要 SUPABASE_SERVICE_ROLE_KEY 與 VITE_SUPABASE_URL
// =====================================================

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function ceilStep(value, step) {
  return Math.ceil(value / step) * step;
}

async function getFacilityData() {
  const { data: fs, error: e1 } = await supabase
    .from('facility_settings')
    .select('nature_bed_counts')
    .eq('id', 1)
    .maybeSingle();
  if (e1) throw e1;

  const { count: residents, error: e2 } = await supabase
    .from('院友主表')
    .select('院友id', { count: 'exact', head: true })
    .eq('在住狀態', '在住');
  if (e2) throw e2;

  return { fs, residents };
}

function computeNeeds(residents, bedCounts) {
  const a1Beds = bedCounts['甲一買位'] || 0;
  const hasA1 = a1Beds > 0;
  const hasAnyBeds = Object.values(bedCounts).some((n) => n > 0);

  const hwEquiv = Math.ceil(residents / 30);
  const cwPeak = Math.ceil(residents / 20);
  const asPeak = Math.ceil(residents / 40);
  const rnReq = hasA1 ? 1 : 0;
  const hwPeak = hasA1 ? Math.max(0, hwEquiv - 2) : hwEquiv;

  const adminH = 7;
  const nurseH = hasA1 ? ceilStep((96 * a1Beds) / 40 / 7, 0.5) : 0;
  const hwH = nurseH;
  const cwH = hasA1 ? ceilStep((384 * a1Beds) / 40 / 7, 0.5) : 0;
  const asH = hasA1 ? ceilStep((192 * a1Beds) / 40 / 7, 0.5) : 0;

  return [
    { position: '主管', count: hasAnyBeds ? Math.max(2, Math.ceil(adminH / 8)) : 0, field: 'other_position', value: '主管', department: '行政', prefix: 'admin', en: 'Admin' },
    // 甲一買位「護士」工時 52.5h 是 RN+EN 合計，不必全部 RN；只需保證有 1 名 RN 覆蓋 8h 註冊護士特定要求
    { position: '註冊護士', count: Math.max(2, rnReq, Math.ceil(8 / 8)), field: 'nursing_position', value: '註冊護士', department: '護理', prefix: 'rn', en: 'RN' },
    { position: '登記護士', count: Math.max(2, Math.ceil(nurseH / 8) - 2), field: 'nursing_position', value: '登記護士', department: '護理', prefix: 'en', en: 'EN' },
    { position: '保健員', count: Math.max(hwPeak, Math.ceil(hwH / 8)), field: 'nursing_position', value: '保健員', department: '護理', prefix: 'ha', en: 'HA' },
    { position: '護理員', count: Math.max(cwPeak, Math.ceil(cwH / 8)), field: 'nursing_position', value: '護理員', department: '護理', prefix: 'cw', en: 'CW' },
    { position: '清潔員', count: Math.max(asPeak, Math.ceil(asH / 8)), field: 'other_position', value: '清潔員', department: '庶務', prefix: 'as', en: 'Asst' },
  ].filter((g) => g.count > 0);
}

function buildUserRows(needs) {
  const rows = [];
  for (const g of needs) {
    for (let i = 1; i <= g.count; i++) {
      const username = `test-roster-${g.prefix}-${i}`;
      rows.push({
        username,
        password_hash: 'dummypw',
        name_zh: `測試${g.position}${i}`,
        name_en: `Test ${g.en} ${i}`,
        department: g.department,
        [g.field]: g.value,
        secondary_positions: [],
        hire_date: '2024-01-01',
        employment_type: '正職',
        role: 'staff',
        is_active: true,
        login_qr_code_id: `${username}-qr`,
      });
    }
  }
  return rows;
}

async function cleanupTestUsers() {
  const { data: users, error: e1 } = await supabase
    .from('user_profiles')
    .select('id')
    .like('username', 'test-roster-%');
  if (e1) throw e1;
  const ids = (users || []).map((u) => u.id);
  if (ids.length === 0) return;

  await supabase.from('user_shift_assignments').delete().in('user_id', ids);
  await supabase.from('user_employment_details').delete().in('user_id', ids);
  await supabase.from('user_leave_records').delete().in('user_id', ids);
  await supabase.from('user_profiles').delete().in('id', ids);
}

async function main() {
  const { fs, residents } = await getFacilityData();
  const bedCounts = fs?.nature_bed_counts || {};
  console.log('在住院友：', residents);
  console.log('院舍宿位：', bedCounts);

  const needs = computeNeeds(residents || 0, bedCounts);
  console.log('預計生成人數：');
  for (const cfg of needs) {
    console.log(`  ${cfg.position}: ${cfg.count}`);
  }

  const userRows = buildUserRows(needs);
  console.log(`\n總共將插入 ${userRows.length} 名測試員工`);

  await cleanupTestUsers();

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert(userRows)
    .select('id');
  if (insertError) throw insertError;

  const details = (inserted || []).map((u) => ({
    user_id: u.id,
    weekly_contract_hours: 40,
    daily_contract_hours: 8,
    default_work_start_time: '07:00',
    weekly_work_days: 5,
    hours_balance: 0,
    rest_day_fraction: 0,
    accumulated_rest_days: 0,
    rest_day_start_date: '2024-01-01',
    annual_leave_days_per_year: 12,
    annual_leave_start_date: '2024-01-01',
    public_holiday_type: 'PH',
    public_holiday_start_date: '2024-01-01',
    preferred_station_secondary: [],
    stations_forbidden: [],
  }));

  const { error: detailsError } = await supabase
    .from('user_employment_details')
    .insert(details);
  if (detailsError) throw detailsError;

  console.log(`\n✅ 已成功插入 ${inserted?.length || 0} 名測試員工及僱傭詳情`);
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
