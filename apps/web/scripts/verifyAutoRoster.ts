/**
 * 一次性驗證腳本：用真實 DB 數據模擬 2026-08-09 護士/保健員一鍵排班（空白重排），
 * 核對新邏輯的實際輸出。用法：cd apps/web && npx vite-node scripts/verifyAutoRoster.ts
 */
import { supabase } from '../src/lib/supabase';
import { generateAutoRoster } from '../src/utils/autoRoster';
import { loadFacilityNatureSettings } from '../src/utils/facilityNatureSettings';
import {
  computeDualRedLineStaffing,
  computeStaffingRequirements,
} from '../src/utils/staffingRequirements';
import { getEmploymentPosition } from '@care-suite/shared';

async function main() {
  const date = '2026-08-09';

  const { data: profiles, error: e1 } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('is_active', true);
  if (e1) throw e1;
  const users = (profiles ?? []).filter((p: any) => getEmploymentPosition(p));
  const userIds = users.map((u: any) => u.id);

  const { data: details, error: e2 } = await supabase
    .from('user_employment_details')
    .select('*')
    .in('user_id', userIds);
  if (e2) throw e2;
  const employmentDetails = Object.fromEntries(
    (details ?? []).map((d: any) => [d.user_id, d]),
  );

  const { data: stationsData, error: e3 } = await supabase
    .from('stations')
    .select('id, name, code')
    .order('name', { ascending: true });
  if (e3) throw e3;
  const stations = (stationsData ?? []).map((s: any) => ({ id: s.id, name: s.name }));
  const stationPriority = [...stations.map((s: any) => s.id), null];

  const { data: rawShiftSettings, error: e4 } = await supabase
    .from('station_shift_settings')
    .select('*');
  if (e4) throw e4;
  // DB 時間帶秒（07:00:00），UI 會 normalize；這裡同樣處理，避免 Date 解析失敗
  const shiftSettings = (rawShiftSettings ?? []).map((s: any) => ({
    ...s,
    start_time: typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time,
  }));

  const { data: leaves, error: e5 } = await supabase
    .from('user_leave_records')
    .select('*')
    .in('user_id', userIds)
    .eq('leave_date', date);
  if (e5) throw e5;

  // 院友主表經 supabase client 查詢有問題；在住人數已用 CLI 驗證為 249
  const count = 249;

  const facilitySettings = await loadFacilityNatureSettings();
  const staffingInput = {
    bedCounts: facilitySettings.bedCounts,
    specific: facilitySettings.specific,
    currentResidents: count ?? 0,
  };
  const dual = computeDualRedLineStaffing(staffingInput);
  const staffingResult = computeStaffingRequirements(staffingInput);
  const dailyRequirements = Object.entries(dual.dailyHours).map(([position, hours]) => ({
    position,
    hours,
    peakHeadcount: dual.peakHeadcount[position] ?? 0,
  }));

  const result = generateAutoRoster({
    date,
    position: '護士/保健員',
    users,
    employmentDetails,
    stations,
    stationPriority,
    shiftSettings: shiftSettings ?? [],
    existingAssignments: [],
    dailyRequirements,
    staffingResult,
    specific: facilitySettings.specific,
    leaveRecords: leaves ?? [],
  } as any);

  const nameOf = (id: string) => users.find((u: any) => u.id === id)?.name_zh ?? id;
  const stationOf = (id: string | null) =>
    id === null ? '未分區' : stations.find((s: any) => s.id === id)?.name ?? id;

  // debug: 吳玉蓮（測試保健員7）的僱傭詳情與可用時段
  const ngId = '8d2662f5-f9de-4d67-8a6b-dfd34d54227a';
  console.log('=== DEBUG 吳玉蓮 ===');
  console.log('profile:', JSON.stringify(users.find((u: any) => u.id === ngId)));
  console.log('details:', JSON.stringify(employmentDetails[ngId]));

  console.log('=== 輸入 ===');
  console.log('在住人數:', count);
  console.log('dailyRequirements:', JSON.stringify(dailyRequirements));
  console.log(
    '班次設定:',
    (shiftSettings ?? [])
      .filter((s: any) => s.position === '護士/保健員')
      .map((s: any) => `${stationOf(s.station_id)} ${s.shift_name} ${s.start_time}`),
  );
  console.log('=== 模擬輸出（空白重排） ===');
  const sorted = [...result.insertions].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (const ins of sorted) {
    console.log(`${stationOf(ins.station_id)} | ${ins.shift_name} | ${ins.start_time} | ${nameOf(ins.user_id)}`);
  }
  console.log('共', result.insertions.length, '人');
  console.log('initialDeficit:', result.initialDeficit, '→ finalDeficit:', result.finalDeficit);
  console.log('=== 達標檢查 ===');
  for (const row of result.finalCompliance) {
    console.log(
      row.position,
      `工時 ${row.actualHours}/${row.requiredHours}`,
      row.hoursOk ? 'OK' : '不足',
      '| 特定鐘點:',
      row.specificSlotOk ? 'OK' : '不足',
      JSON.stringify(row.specificSegments),
    );
  }
}

main().catch((e) => {
  console.error('ERROR:', JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})));
  process.exit(1);
});
