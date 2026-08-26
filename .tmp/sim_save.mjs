// 模擬 EmploymentDetailsSection.handleSave 的完整流程，逐步報告錯誤
// 用法: node .tmp/sim_save.mjs <user_id> [user_id...]
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, anon);

// ---- 移植 getExpectedRestDayGrants ----
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function getExpectedRestDayGrants(startDate, weeklyWorkDays, today = new Date()) {
  if (!startDate || weeklyWorkDays == null || weeklyWorkDays <= 0 || weeklyWorkDays > 6) return { grants: [], totalFraction: 0 };
  const rest = 7 - weeklyWorkDays;
  const integerDO = Math.floor(rest);
  const fraction = parseFloat((rest - integerDO).toFixed(1));
  if (integerDO <= 0 && fraction <= 0) return { grants: [], totalFraction: 0 };
  const todayStr = fmt(today);
  if (startDate > todayStr) return { grants: [], totalFraction: 0 };
  const grants = [];
  let count = 0;
  const [y, m, d] = startDate.split('-').map(Number);
  const cursor = new Date(y, m - 1, d + Math.floor(weeklyWorkDays));
  while (fmt(cursor) <= todayStr) {
    if (integerDO > 0) grants.push({ record_date: fmt(cursor), days: integerDO });
    count += 1;
    cursor.setDate(cursor.getDate() + 7);
  }
  return { grants, totalFraction: parseFloat((fraction * count).toFixed(1)) };
}
const chunk = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };

async function simulate(userId) {
  console.log('\n===== user', userId, '=====');
  const { data: det, error: e0 } = await supabase.from('user_employment_details').select('*').eq('user_id', userId).maybeSingle();
  if (e0) { console.log('讀取 details 失敗:', e0); return; }
  const origTime = det?.default_work_start_time ?? null;
  console.log('原 default_work_start_time =', origTime, '| weekly_work_days =', det?.weekly_work_days, '| rest_start =', det?.rest_day_start_date, '| al_days =', det?.annual_leave_days_per_year, '| ph =', det?.public_holiday_type);

  // 1) upsert（與 handleSave 相同 payload，只改 default_work_start_time 為測試值）
  const payload = {
    user_id: userId,
    weekly_contract_hours: det?.weekly_contract_hours ?? null,
    daily_contract_hours: det?.daily_contract_hours ?? null,
    default_work_start_time: '07:00',
    weekly_work_days: det?.weekly_work_days ?? null,
    hours_balance: det?.hours_balance ?? 0,
    rest_day_start_date: det?.rest_day_start_date ?? null,
    annual_leave_days_per_year: det?.annual_leave_days_per_year ?? null,
    annual_leave_start_date: det?.annual_leave_start_date ?? null,
    public_holiday_type: det?.public_holiday_type ?? null,
    public_holiday_start_date: det?.public_holiday_start_date ?? null,
    preferred_station_primary: det?.preferred_station_primary ?? null,
    preferred_station_secondary: det?.preferred_station_secondary ?? [],
    stations_forbidden: det?.stations_forbidden ?? [],
    updated_at: new Date().toISOString(),
  };
  const { error: eUpsert } = await supabase.from('user_employment_details').upsert(payload, { onConflict: 'user_id' });
  console.log('步驟1 upsert:', eUpsert ? `失敗 ${JSON.stringify(eUpsert)}` : 'OK');
  if (eUpsert) return;

  // 2) materializeGrants (年假 RPC)
  if (payload.annual_leave_start_date && payload.annual_leave_days_per_year) {
    const { error } = await supabase.rpc('sync_annual_leave_grants_for_user', { p_user_id: userId });
    console.log('步驟2 年假RPC:', error ? `失敗 ${JSON.stringify(error)}` : 'OK');
  }

  // 3) materializeRestGrants
  if (payload.rest_day_start_date && payload.weekly_work_days) {
    const { grants, totalFraction } = getExpectedRestDayGrants(payload.rest_day_start_date, Number(payload.weekly_work_days));
    const expectedDates = new Set(grants.map(g => g.record_date));
    const { data: allGrants, error: fetchErr } = await supabase
      .from('user_rest_day_details').select('id, record_date, is_system')
      .eq('user_id', userId).eq('detail_type', 'grant').order('created_at', { ascending: true });
    if (fetchErr) { console.log('步驟3 查詢休息日獲得行: 失敗', JSON.stringify(fetchErr)); }
    else {
      const seen = new Set(); const dup = []; const manual = new Set(); const kept = new Set();
      for (const row of allGrants ?? []) {
        if (seen.has(row.record_date)) { dup.push(row.id); continue; }
        seen.add(row.record_date);
        if (row.is_system) { if (expectedDates.has(row.record_date)) kept.add(row.record_date); else dup.push(row.id); }
        else manual.add(row.record_date);
      }
      console.log(`步驟3 現有grant=${(allGrants ?? []).length} 預期=${grants.length} 待刪重複=${dup.length}`);
      for (const batch of chunk(dup, 100)) {
        const { error } = await supabase.from('user_rest_day_details').delete().in('id', batch);
        if (error) { console.log('步驟3 刪除重複: 失敗', JSON.stringify(error)); break; }
      }
      const missing = grants.filter(g => !manual.has(g.record_date) && !kept.has(g.record_date));
      console.log(`步驟3 待補=${missing.length}`);
      for (const batch of chunk(missing.map(g => ({ user_id: userId, record_date: g.record_date, detail_type: 'grant', days: g.days, remark: '系統自動發放', is_system: true, created_by: null })), 100)) {
        const { error } = await supabase.from('user_rest_day_details').insert(batch);
        if (error) { console.log('步驟3 插入獲得行: 失敗', JSON.stringify(error)); break; }
      }
      const { count: prdCount, error: countErr } = await supabase
        .from('user_leave_records').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('leave_type', 'PRD');
      if (countErr) console.log('步驟3 統計PRD: 失敗', JSON.stringify(countErr));
      const net = Math.max(0, totalFraction - (prdCount ?? 0));
      const fraction = parseFloat((net - Math.floor(net)).toFixed(1));
      const { error: updErr } = await supabase.from('user_employment_details')
        .update({ rest_day_fraction: fraction, updated_at: new Date().toISOString() }).eq('user_id', userId);
      console.log('步驟3 更新fraction:', updErr ? `失敗 ${JSON.stringify(updErr)}` : `OK (fraction=${fraction})`);
    }
  }

  // 4) materializePublicHolidayGrants
  if (payload.public_holiday_type && payload.public_holiday_start_date) {
    const { error } = await supabase.rpc('sync_public_holiday_grants_for_user', { p_user_id: userId });
    console.log('步驟4 公假RPC:', error ? `失敗 ${JSON.stringify(error)}` : 'OK');
  }

  // 驗證 upsert 是否真的落庫
  const { data: check } = await supabase.from('user_employment_details').select('default_work_start_time').eq('user_id', userId).maybeSingle();
  console.log('落庫後 default_work_start_time =', check?.default_work_start_time);

  // 還原
  const { error: eRestore } = await supabase.from('user_employment_details')
    .update({ default_work_start_time: origTime, updated_at: new Date().toISOString() }).eq('user_id', userId);
  console.log('還原:', eRestore ? `失敗 ${JSON.stringify(eRestore)}` : 'OK');
}

for (const id of process.argv.slice(2)) await simulate(id);
