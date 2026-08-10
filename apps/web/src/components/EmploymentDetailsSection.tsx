import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, X } from 'lucide-react';
import {
  UserProfile,
  UserAnnualLeaveDetail,
  UserRestDayDetail,
  UserPublicHolidayDetail,
  PublicHoliday,
} from '@care-suite/shared';
import { supabase } from '../lib/supabase';
import { useStationData } from '../context/facility/StationContext';
import { getExpectedAnnualLeaveGrants } from '../utils/annualLeave';
import { formatDisplayDate } from '../utils/dateFormat';
import DateInput from '../components/DateInput';
import {
  getExpectedRestDayGrants,
  getExpectedMonthlyRestDays,
  weeklyRestDays,
} from '../utils/restDays';
import { getExpectedPublicHolidayGrants, loadPublicHolidaysRange } from '../utils/publicHolidays';
import { normalizeTime } from '../utils/roster';

// =====================================================
// 僱傭詳情區塊（用戶管理 Modal 內，編輯適用職位用戶時顯示）
// 資料讀寫獨立於用戶表單，有自己的「儲存僱傭詳情」按鈕
// =====================================================

interface EmploymentDetailsSectionProps {
  user: UserProfile;
  currentUserId: string | null;
}

/** 數字顯示：整數不帶小數位，否則一位小數 */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 計算兩個 YYYY-MM-DD 之間相差天數（end - start） */
function daysBetween(start: string, end: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const ms = parse(end) - parse(start);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** 檢查字串是否為有效的 0.5 倍數數字（空白回傳 null 表示未填） */
const parseHalf = (s: string): number | null | 'invalid' => {
  if (s.trim() === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return 'invalid';
  if (Math.round(n * 2) !== n * 2) return 'invalid';
  return n;
};

const DETAIL_TYPE_LABELS: Record<UserAnnualLeaveDetail['detail_type'], string> = {
  grant: '獲得',
  usage: '使用',
  writeoff: '抹平',
};

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

/** 明細表類型：年假 / 休息日 / 公眾假期（三表結構相同，邏輯共用） */
type DetailTable = 'al' | 'rest' | 'ph';

const DETAIL_TABLE_NAMES: Record<DetailTable, string> = {
  al: 'user_annual_leave_details',
  rest: 'user_rest_day_details',
  ph: 'user_public_holiday_details',
};

const DETAIL_TABLE_LABELS: Record<DetailTable, string> = {
  al: '年假',
  rest: '休息日',
  ph: '公眾假期',
};

/** 年假/休息日明細新增/編輯 Modal 的表單狀態 */
interface LeaveRowModalState {
  mode: 'add-usage' | 'add-writeoff' | 'edit';
  table: DetailTable;
  /** 編輯時的原行 */
  row?: UserAnnualLeaveDetail;
  record_date: string;
  days: string;
  remark: string;
}

const EmploymentDetailsSection: React.FC<EmploymentDetailsSectionProps> = ({ user, currentUserId }) => {
  const { stations } = useStationData();

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ----- 僱傭詳情表單（數字欄位以字串保存，'' = null） -----
  const [weeklyContractHours, setWeeklyContractHours] = useState('');
  const [dailyContractHours, setDailyContractHours] = useState('');
  const [defaultWorkStartTime, setDefaultWorkStartTime] = useState('');
  const [weeklyWorkDays, setWeeklyWorkDays] = useState('');
  const [hoursBalance, setHoursBalance] = useState('0');
  const [restDayStartDate, setRestDayStartDate] = useState(user.hire_date || '');
  const [annualLeaveDaysPerYear, setAnnualLeaveDaysPerYear] = useState('');
  const [annualLeaveStartDate, setAnnualLeaveStartDate] = useState(user.hire_date || '');
  const [publicHolidayType, setPublicHolidayType] = useState<'' | 'PH' | 'SH'>('');
  const [publicHolidayStartDate, setPublicHolidayStartDate] = useState(user.hire_date || '');
  const [preferredPrimary, setPreferredPrimary] = useState('');
  const [preferredSecondary, setPreferredSecondary] = useState<string[]>([]);
  const [stationsForbidden, setStationsForbidden] = useState<string[]>([]);
  /** 載入時的年假起始日，用於偵測更改 */
  const [initialStartDate, setInitialStartDate] = useState<string | null>(null);
  /** 載入時的休息日起始日，用於偵測更改 */
  const [initialRestStartDate, setInitialRestStartDate] = useState<string | null>(null);
  /** 載入時的每周工作天數，用於偵測更改 */
  const [initialWeeklyWorkDays, setInitialWeeklyWorkDays] = useState<string | null>(null);
  /** 載入時的公眾假期起始日，用於偵測更改 */
  const [initialPublicHolidayStartDate, setInitialPublicHolidayStartDate] = useState<string | null>(null);

  /** 載入時的公眾假期類型，用於偵測更改 */
  const [initialPublicHolidayType, setInitialPublicHolidayType] = useState<'' | 'PH' | 'SH'>('');

  // ----- 年假明細 -----
  const [leaveDetails, setLeaveDetails] = useState<UserAnnualLeaveDetail[]>([]);
  const [detailTableOpen, setDetailTableOpen] = useState(false);
  const [leaveRowModal, setLeaveRowModal] = useState<LeaveRowModalState | null>(null);
  const [leaveRowError, setLeaveRowError] = useState<string | null>(null);
  const [leaveRowSaving, setLeaveRowSaving] = useState(false);

  // ----- 休息日明細 -----
  const [restDetails, setRestDetails] = useState<UserRestDayDetail[]>([]);
  const [restDetailTableOpen, setRestDetailTableOpen] = useState(false);
  const [restDayFraction, setRestDayFraction] = useState(0);

  // ----- 下月 DO / PRD 預估 -----
  const nextMonthRestEstimate = useMemo(() => {
    const workDays = parseHalf(weeklyWorkDays);
    if (workDays === 'invalid' || workDays === null || workDays <= 0) return null;
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return getExpectedMonthlyRestDays(
      workDays,
      next.getFullYear(),
      next.getMonth() + 1,
      restDayStartDate,
    );
  }, [weeklyWorkDays, restDayStartDate]);

  // ----- 公眾假期明細 -----
  const [publicHolidayDetails, setPublicHolidayDetails] = useState<UserPublicHolidayDetail[]>([]);
  const [publicDetailTableOpen, setPublicDetailTableOpen] = useState(false);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);

  // ----- 工時結餘抹平 Modal -----
  const [balanceModal, setBalanceModal] = useState<{ remark: string } | null>(null);
  const [balanceModalError, setBalanceModalError] = useState<string | null>(null);
  const [balanceSaving, setBalanceSaving] = useState(false);

  // ----- 計算值 -----
  const systemGrantTotal = useMemo(
    () => leaveDetails.filter(d => d.detail_type === 'grant' && d.is_system).reduce((s, d) => s + d.days, 0),
    [leaveDetails],
  );
  const grantTotal = useMemo(
    () => leaveDetails.filter(d => d.detail_type === 'grant').reduce((s, d) => s + d.days, 0),
    [leaveDetails],
  );
  const usageTotal = useMemo(
    () => leaveDetails.filter(d => d.detail_type === 'usage').reduce((s, d) => s + d.days, 0),
    [leaveDetails],
  );
  const writeoffTotal = useMemo(
    () => leaveDetails.filter(d => d.detail_type === 'writeoff').reduce((s, d) => s + d.days, 0),
    [leaveDetails],
  );
  /** 累積 = Σgrant − Σusage − Σwriteoff（可負） */
  const leaveBalance = grantTotal - usageTotal - writeoffTotal;

  // ----- 休息日計算值 -----
  const restSystemGrantTotal = useMemo(
    () => restDetails.filter(d => d.detail_type === 'grant' && d.is_system).reduce((s, d) => s + d.days, 0),
    [restDetails],
  );
  const restUsageTotal = useMemo(
    () => restDetails.filter(d => d.detail_type === 'usage').reduce((s, d) => s + d.days, 0),
    [restDetails],
  );
  /** 累積 = Σgrant − Σusage − Σwriteoff（可透支無上限、可累積無上限） */
  const restBalance = useMemo(() => {
    const grant = restDetails.filter(d => d.detail_type === 'grant').reduce((s, d) => s + d.days, 0);
    const writeoff = restDetails.filter(d => d.detail_type === 'writeoff').reduce((s, d) => s + d.days, 0);
    return grant - restUsageTotal - writeoff;
  }, [restDetails, restUsageTotal]);

  // ----- 公眾假期計算值 -----
  const todayStrForPh = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const phGrantRows = useMemo(
    () => publicHolidayDetails.filter(d => d.detail_type === 'grant'),
    [publicHolidayDetails],
  );
  const phUsageRows = useMemo(
    () => publicHolidayDetails.filter(d => d.detail_type === 'usage'),
    [publicHolidayDetails],
  );
  const phWriteoffRows = useMemo(
    () => publicHolidayDetails.filter(d => d.detail_type === 'writeoff'),
    [publicHolidayDetails],
  );
  /** 未過期的 grant（系統 + 手動） */
  const phUnexpiredGrantRows = useMemo(
    () => phGrantRows.filter(d => !d.expiry_date || d.expiry_date >= todayStrForPh),
    [phGrantRows, todayStrForPh],
  );
  const phExpiredTotal = useMemo(
    () => phGrantRows.filter(d => d.expiry_date && d.expiry_date < todayStrForPh).reduce((s, d) => s + d.days, 0),
    [phGrantRows, todayStrForPh],
  );
  const phUsageTotal = useMemo(
    () => phUsageRows.reduce((s, d) => s + d.days, 0),
    [phUsageRows],
  );
  const phWriteoffTotal = useMemo(
    () => phWriteoffRows.reduce((s, d) => s + d.days, 0),
    [phWriteoffRows],
  );
  /** 有效累積 = 未過期 grant − 使用 − 抹平 */
  const phBalance = useMemo(
    () => phUnexpiredGrantRows.reduce((s, d) => s + d.days, 0) - phUsageTotal - phWriteoffTotal,
    [phUnexpiredGrantRows, phUsageTotal, phWriteoffTotal],
  );
  /** 已用假期 ID 集合（用於倒數清單） */
  const phUsedHolidayIds = useMemo(
    () => new Set(phUsageRows.map(d => d.reference_public_holiday_id).filter(Boolean) as string[]),
    [phUsageRows],
  );
  /** 未用且未過期的公眾假期清單（供倒數顯示） */
  const phUnusedHolidayList = useMemo(() => {
    const list: { name: string; holiday_date: string; expiry_date: string; daysLeft: number }[] = [];
    for (const g of phUnexpiredGrantRows) {
      if (!g.reference_public_holiday_id) continue;
      if (phUsedHolidayIds.has(g.reference_public_holiday_id)) continue;
      const holiday = publicHolidays.find(h => h.id === g.reference_public_holiday_id);
      if (!holiday || !g.expiry_date) continue;
      const daysLeft = daysBetween(todayStrForPh, g.expiry_date);
      if (daysLeft < 0) continue;
      list.push({
        name: holiday.name,
        holiday_date: holiday.holiday_date,
        expiry_date: g.expiry_date,
        daysLeft,
      });
    }
    list.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    return list;
  }, [phUnexpiredGrantRows, phUsedHolidayIds, publicHolidays, todayStrForPh]);

  // ----- 年假獲得行 lazy 補齊 -----
  const materializeGrants = useCallback(
    async (startDate: string, daysPerYear: number | null) => {
      const expected = getExpectedAnnualLeaveGrants(startDate, daysPerYear);
      if (expected.length === 0) return;
      // 清理所有系統發放的獲得行，再重新寫入預期日期，避免重複或舊起始日遺留
      const { error: deleteErr } = await supabase
        .from('user_annual_leave_details')
        .delete()
        .eq('user_id', user.id)
        .eq('is_system', true)
        .eq('detail_type', 'grant');
      if (deleteErr) throw deleteErr;
      const { error } = await supabase.from('user_annual_leave_details').insert(
        expected.map(g => ({
          user_id: user.id,
          record_date: g.record_date,
          detail_type: 'grant',
          days: g.days,
          remark: '系統自動發放',
          is_system: true,
          created_by: currentUserId,
        })),
      );
      if (error) throw error;
    },
    [user.id, currentUserId],
  );

  // ----- 休息日獲得行 lazy 補齊（起始日一次 + 逢周日發放整數 DO；fraction 累積） -----
  const materializeRestGrants = useCallback(
    async (startDate: string, weeklyWorkDays: number | null) => {
      if (!weeklyWorkDays || weeklyWorkDays <= 0) return;
      const { grants, totalFraction } = getExpectedRestDayGrants(startDate, weeklyWorkDays);
      const expectedDates = new Set(grants.map(g => g.record_date));

      // 1) 先取出所有獲得行，按建立時間由舊到新排序
      const { data: allGrants, error: fetchErr } = await supabase
        .from('user_rest_day_details')
        .select('id, record_date, is_system')
        .eq('user_id', user.id)
        .eq('detail_type', 'grant')
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;

      const seenDates = new Set<string>();
      const duplicateIds: string[] = [];
      const manualDates = new Set<string>();
      const keptSystemDates = new Set<string>();
      for (const row of (allGrants ?? []) as { id: string; record_date: string; is_system: boolean }[]) {
        if (seenDates.has(row.record_date)) {
          // 同一日期已存在，視為重複行
          duplicateIds.push(row.id);
          continue;
        }
        seenDates.add(row.record_date);
        if (row.is_system) {
          if (expectedDates.has(row.record_date)) {
            keptSystemDates.add(row.record_date);
          } else {
            // 舊起始日或舊每周工作天數遺留的系統行
            duplicateIds.push(row.id);
          }
        } else {
          manualDates.add(row.record_date);
        }
      }

      // 2) 刪除重複行及過期的系統行
      if (duplicateIds.length > 0) {
        const { error: deleteErr } = await supabase
          .from('user_rest_day_details')
          .delete()
          .in('id', duplicateIds);
        if (deleteErr) throw deleteErr;
      }

      // 3) 補回尚未覆蓋的預期系統發放日
      const missing = grants.filter(
        g => !manualDates.has(g.record_date) && !keptSystemDates.has(g.record_date),
      );
      if (missing.length > 0) {
        const { error } = await supabase.from('user_rest_day_details').insert(
          missing.map(g => ({
            user_id: user.id,
            record_date: g.record_date,
            detail_type: 'grant',
            days: g.days,
            remark: '系統自動發放',
            is_system: true,
            created_by: currentUserId,
          })),
        );
        if (error) throw error;
      }

      // 更新 rest_day_fraction：總累積 fraction 減去已預排的 PRD 數量
      const { count: prdCount, error: countErr } = await supabase
        .from('user_leave_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('leave_type', 'PRD');
      if (countErr) throw countErr;
      const fraction = Math.max(0, parseFloat((totalFraction - (prdCount ?? 0)).toFixed(1)));
      const { error: updateErr } = await supabase
        .from('user_employment_details')
        .update({ rest_day_fraction: fraction, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;
    },
    [user.id, currentUserId],
  );

  // ----- 公眾假期獲得行 lazy 補齊（按單一假期發放，30 天內有效） -----
  const materializePublicHolidayGrants = useCallback(
    async (
      startDate: string,
      type: 'PH' | 'SH',
      holidayCache: PublicHoliday[],
    ) => {
      const expected = getExpectedPublicHolidayGrants(startDate, type, holidayCache);
      if (expected.length === 0) return;
      // 清理所有系統發放的獲得行，再重新寫入預期假期，避免重複或舊起始日遺留
      const { error: deleteErr } = await supabase
        .from('user_public_holiday_details')
        .delete()
        .eq('user_id', user.id)
        .eq('is_system', true)
        .eq('detail_type', 'grant');
      if (deleteErr) throw deleteErr;
      const { error } = await supabase.from('user_public_holiday_details').insert(
        expected.map(g => ({
          user_id: user.id,
          record_date: g.record_date,
          detail_type: 'grant',
          days: g.days,
          remark: g.remark,
          reference_public_holiday_id: g.reference_public_holiday_id,
          expiry_date: g.expiry_date,
          is_system: true,
          created_by: currentUserId,
        })),
      );
      if (error) throw error;
    },
    [user.id, currentUserId],
  );

  // ----- 載入 -----
  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [
        { data: details, error: e1 },
        { data: rows, error: e2 },
        { data: restRows, error: e5 },
        { data: phRows, error: e7 },
      ] = await Promise.all([
        supabase.from('user_employment_details').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('user_annual_leave_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('user_rest_day_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('user_public_holiday_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e5) throw e5;
      if (e7) throw e7;

      if (details) {
        setWeeklyContractHours(details.weekly_contract_hours?.toString() ?? '');
        setDailyContractHours(details.daily_contract_hours?.toString() ?? '');
        setDefaultWorkStartTime(normalizeTime(details.default_work_start_time) ?? details.default_work_start_time ?? '');
        setWeeklyWorkDays(details.weekly_work_days?.toString() ?? '');
        setHoursBalance(details.hours_balance?.toString() ?? '0');
        setRestDayFraction(details.rest_day_fraction ?? 0);
        // 休息日計算起始日預設 = 入職日期
        setRestDayStartDate(details.rest_day_start_date ?? user.hire_date ?? '');
        setInitialRestStartDate(details.rest_day_start_date ?? user.hire_date ?? null);
        setInitialWeeklyWorkDays(details.weekly_work_days?.toString() ?? null);
        setAnnualLeaveDaysPerYear(details.annual_leave_days_per_year?.toString() ?? '');
        // 年假計算起始日預設 = 入職日期
        setAnnualLeaveStartDate(details.annual_leave_start_date ?? user.hire_date ?? '');
        setInitialStartDate(details.annual_leave_start_date ?? user.hire_date ?? null);
        setPublicHolidayType(details.public_holiday_type ?? '');
        setPublicHolidayStartDate(details.public_holiday_start_date ?? user.hire_date ?? '');
        setInitialPublicHolidayStartDate(details.public_holiday_start_date ?? user.hire_date ?? null);
        setInitialPublicHolidayType(details.public_holiday_type ?? '');
        setPreferredPrimary(details.preferred_station_primary ?? '');
        setPreferredSecondary(details.preferred_station_secondary ?? []);
        setStationsForbidden(details.stations_forbidden ?? []);
      } else {
        setAnnualLeaveStartDate(user.hire_date || '');
        setInitialStartDate(user.hire_date || null);
        setRestDayStartDate(user.hire_date || '');
        setInitialRestStartDate(user.hire_date || null);
        setPublicHolidayStartDate(user.hire_date || '');
        setInitialPublicHolidayStartDate(user.hire_date || null);
      }

      let detailRows = (rows ?? []) as UserAnnualLeaveDetail[];
      // lazy 補齊年假獲得行
      const startDate = details?.annual_leave_start_date ?? user.hire_date ?? null;
      const daysPerYear = details?.annual_leave_days_per_year ?? null;
      if (startDate && daysPerYear) {
        await materializeGrants(startDate, daysPerYear);
        const { data: refreshed, error: e4 } = await supabase
          .from('user_annual_leave_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true });
        if (e4) throw e4;
        detailRows = (refreshed ?? []) as UserAnnualLeaveDetail[];
      }
      setLeaveDetails(detailRows);

      let restDetailRows = (restRows ?? []) as UserRestDayDetail[];
      // lazy 補齊休息日獲得行
      const restStart = details?.rest_day_start_date ?? user.hire_date ?? null;
      const workDaysForRest = details?.weekly_work_days ?? null;
      if (restStart && workDaysForRest) {
        await materializeRestGrants(restStart, workDaysForRest);
        const { data: refreshedRest, error: e6 } = await supabase
          .from('user_rest_day_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true });
        if (e6) throw e6;
        restDetailRows = (refreshedRest ?? []) as UserRestDayDetail[];
        // 重新載入 employment details 以取得更新後的 rest_day_fraction
        const { data: refreshedDetails, error: eDetails } = await supabase
          .from('user_employment_details')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (eDetails) throw eDetails;
        if (refreshedDetails) {
          setRestDayFraction(refreshedDetails.rest_day_fraction ?? 0);
        }
      }
      setRestDetails(restDetailRows);

      let publicHolidayDetailRows = (phRows ?? []) as UserPublicHolidayDetail[];
      // lazy 補齊公眾假期獲得行
      const phStart = details?.public_holiday_start_date ?? user.hire_date ?? null;
      const phType = details?.public_holiday_type ?? null;
      if (phStart && phType) {
        const today = new Date();
        const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const holidayCache = await loadPublicHolidaysRange(phStart, endStr, phType);
        setPublicHolidays(holidayCache);
        await materializePublicHolidayGrants(phStart, phType, holidayCache);
        const { data: refreshedPh, error: e8 } = await supabase
          .from('user_public_holiday_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true });
        if (e8) throw e8;
        publicHolidayDetailRows = (refreshedPh ?? []) as UserPublicHolidayDetail[];
      } else {
        setPublicHolidays([]);
      }
      setPublicHolidayDetails(publicHolidayDetailRows);
    } catch (err) {
      console.error('載入僱傭詳情失敗:', err);
      setMessage({ type: 'error', text: '載入僱傭詳情失敗' });
    } finally {
      setLoading(false);
    }
  }, [user.id, user.hire_date, materializeGrants, materializeRestGrants, materializePublicHolidayGrants]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ----- 儲存僱傭詳情 -----
  const handleSave = async () => {
    setMessage(null);

    // 驗證所有數字欄位是 0.5 的倍數
    const numericInputs: Array<[string, string, boolean]> = [
      ['每周合約時間', weeklyContractHours, false],
      ['每天合約工時', dailyContractHours, false],
      ['每周工作天數', weeklyWorkDays, false],
      ['工時結餘', hoursBalance, true],
      ['每年年假天數', annualLeaveDaysPerYear, false],
    ];
    const parsed: Record<string, number | null> = {};
    for (const [label, value, allowNegative] of numericInputs) {
      const p = parseHalf(value);
      if (p === 'invalid' || (p !== null && !allowNegative && p < 0)) {
        setMessage({ type: 'error', text: `${label}必須是 0.5 的倍數${allowNegative ? '' : '且不可為負數'}` });
        return;
      }
      if (label === '每周工作天數' && p !== null && p > 6) {
        setMessage({ type: 'error', text: '每周工作天數不可大於 6' });
        return;
      }
      parsed[label] = p;
    }

    const startChanged = (annualLeaveStartDate || null) !== initialStartDate;
    const hasSystemGrants = leaveDetails.some(d => d.detail_type === 'grant' && d.is_system);
    if (startChanged && hasSystemGrants) {
      const ok = window.confirm('更改起始日會令所有系統發放的年假獲得明細重新計算，不能繼承。確定更改？');
      if (!ok) return;
    }

    const restStartChanged = (restDayStartDate || null) !== initialRestStartDate;
    const weeklyWorkDaysChanged = (weeklyWorkDays || null) !== initialWeeklyWorkDays;
    const hasSystemRestGrants = restDetails.some(d => d.detail_type === 'grant' && d.is_system);
    if ((restStartChanged || weeklyWorkDaysChanged) && hasSystemRestGrants) {
      const reason = restStartChanged && weeklyWorkDaysChanged
        ? '起始日及每周工作天數'
        : restStartChanged
          ? '起始日'
          : '每周工作天數';
      const ok = window.confirm(`更改${reason}會令所有系統發放的休息日獲得明細重新計算，不能繼承。確定更改？`);
      if (!ok) return;
    }

    const phStartChanged = (publicHolidayStartDate || null) !== initialPublicHolidayStartDate;
    const phTypeChanged = publicHolidayType !== initialPublicHolidayType;
    const hasSystemPhGrants = publicHolidayDetails.some(d => d.detail_type === 'grant' && d.is_system);
    if ((phStartChanged || phTypeChanged) && hasSystemPhGrants) {
      const ok = window.confirm('更改公眾假期類型或起始日會令所有系統發放的公眾假期明細重新計算，不能繼承。確定更改？');
      if (!ok) return;
    }

    setSaving(true);
    try {
      if (startChanged && hasSystemGrants) {
        // 刪除全部系統獲得行，按新起始日重新產生；使用行與抹平行保留
        const { error } = await supabase
          .from('user_annual_leave_details')
          .delete()
          .eq('user_id', user.id)
          .eq('is_system', true);
        if (error) throw error;
      }
      if ((restStartChanged || weeklyWorkDaysChanged) && hasSystemRestGrants) {
        const { error } = await supabase
          .from('user_rest_day_details')
          .delete()
          .eq('user_id', user.id)
          .eq('is_system', true);
        if (error) throw error;
      }
      if ((phStartChanged || phTypeChanged) && hasSystemPhGrants) {
        const { error } = await supabase
          .from('user_public_holiday_details')
          .delete()
          .eq('user_id', user.id)
          .eq('is_system', true);
        if (error) throw error;
      }

      const { error } = await supabase.from('user_employment_details').upsert(
        {
          user_id: user.id,
          weekly_contract_hours: parsed['每周合約時間'],
          daily_contract_hours: parsed['每天合約工時'],
          default_work_start_time: normalizeTime(defaultWorkStartTime) || defaultWorkStartTime || null,
          weekly_work_days: parsed['每周工作天數'],
          hours_balance: parsed['工時結餘'] ?? 0,
          rest_day_start_date: restDayStartDate || null,
          annual_leave_days_per_year: parsed['每年年假天數'],
          annual_leave_start_date: annualLeaveStartDate || null,
          public_holiday_type: publicHolidayType || null,
          public_holiday_start_date: publicHolidayStartDate || null,
          preferred_station_primary: preferredPrimary || null,
          preferred_station_secondary: preferredSecondary,
          stations_forbidden: stationsForbidden,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;

      // 按（可能已更改的）起始日補齊系統獲得行
      if (annualLeaveStartDate && parsed['每年年假天數']) {
        await materializeGrants(annualLeaveStartDate, parsed['每年年假天數']);
      }
      if (restDayStartDate && parsed['每周工作天數']) {
        await materializeRestGrants(restDayStartDate, parsed['每周工作天數']);
      }
      if (publicHolidayType && publicHolidayStartDate) {
        const today = new Date();
        const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const holidayCache = await loadPublicHolidaysRange(publicHolidayStartDate, endStr, publicHolidayType);
        await materializePublicHolidayGrants(publicHolidayStartDate, publicHolidayType, holidayCache);
      }

      setInitialStartDate(annualLeaveStartDate || null);
      setInitialRestStartDate(restDayStartDate || null);
      setInitialWeeklyWorkDays(weeklyWorkDays || null);
      setInitialPublicHolidayStartDate(publicHolidayStartDate || null);
      setInitialPublicHolidayType(publicHolidayType);
      setMessage({ type: 'success', text: '僱傭詳情已儲存' });
      await loadData();
    } catch (err) {
      console.error('儲存僱傭詳情失敗:', err);
      setMessage({ type: 'error', text: '儲存僱傭詳情失敗' });
    } finally {
      setSaving(false);
    }
  };

  // ----- 工時結餘抹平 -----
  const handleBalanceWriteoff = async () => {
    if (!balanceModal) return;
    const remark = balanceModal.remark.trim();
    if (!remark) {
      setBalanceModalError('請輸入備註');
      return;
    }
    setBalanceSaving(true);
    setBalanceModalError(null);
    try {
      const previousValue = Number(hoursBalance) || 0;
      const { error: e1 } = await supabase.from('user_balance_adjustments').insert({
        user_id: user.id,
        balance_type: 'hours',
        previous_value: previousValue,
        new_value: 0,
        remark,
        created_by: currentUserId,
      });
      if (e1) throw e1;
      // 把工時結餘設 0（upsert 只更新該欄位）
      const { error: e2 } = await supabase.from('user_employment_details').upsert(
        {
          user_id: user.id,
          hours_balance: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (e2) throw e2;
      setHoursBalance('0');
      setBalanceModal(null);
      setMessage({ type: 'success', text: '結餘已抹平' });
    } catch (err) {
      console.error('抹平結餘失敗:', err);
      setBalanceModalError('抹平失敗，請重試');
    } finally {
      setBalanceSaving(false);
    }
  };

  // ----- 年假 / 休息日 使用、抹平行 -----
  const balanceFor = (table: DetailTable) => {
    if (table === 'al') return leaveBalance;
    if (table === 'ph') return phBalance;
    return restBalance;
  };

  const openAddUsage = (table: DetailTable) => {
    setLeaveRowError(null);
    setLeaveRowModal({
      mode: 'add-usage',
      table,
      record_date: new Date().toISOString().slice(0, 10),
      days: '',
      remark: '',
    });
  };

  const openAddWriteoff = (table: DetailTable) => {
    setLeaveRowError(null);
    setLeaveRowModal({
      mode: 'add-writeoff',
      table,
      record_date: new Date().toISOString().slice(0, 10),
      days: fmt(balanceFor(table)),
      remark: '',
    });
  };

  const openEditRow = (table: DetailTable, row: UserAnnualLeaveDetail) => {
    setLeaveRowError(null);
    setLeaveRowModal({
      mode: 'edit',
      table,
      row,
      record_date: row.record_date,
      days: row.days.toString(),
      remark: row.remark ?? '',
    });
  };

  const handleLeaveRowSave = async () => {
    if (!leaveRowModal) return;
    setLeaveRowError(null);
    const { mode, row, table } = leaveRowModal;
    const tableName = DETAIL_TABLE_NAMES[table];
    const tableLabel = DETAIL_TABLE_LABELS[table];
    const balance = balanceFor(table);
    const detailType = mode === 'edit' ? row!.detail_type : mode === 'add-usage' ? 'usage' : 'writeoff';
    const remark = leaveRowModal.remark.trim();

    if (!leaveRowModal.record_date) {
      setLeaveRowError('請選擇日期');
      return;
    }
    if (detailType === 'writeoff' && !remark) {
      setLeaveRowError('抹平必須填寫備註');
      return;
    }

    // 天數：新增抹平行自動 = 當前累積值；編輯抹平行不可改天數
    let days: number;
    if (detailType === 'writeoff') {
      days = mode === 'add-writeoff' ? balance : row!.days;
      if (days <= 0) {
        setLeaveRowError(`累積${tableLabel}為 0 或負數，不可抹平`);
        return;
      }
    } else {
      const p = parseHalf(leaveRowModal.days);
      if (p === 'invalid' || p === null || p <= 0) {
        setLeaveRowError('天數必須是 0.5 的倍數且大於 0');
        return;
      }
      days = p;
    }

    // 透支硬阻止：年假不可超過每年額度；公眾假期不可透支（即不可低於 0）；休息日可透支無上限
    if (table === 'al' && detailType === 'usage') {
      const y = parseHalf(annualLeaveDaysPerYear);
      if (y !== null && y !== 'invalid' && y > 0) {
        let newBalance = balance - days;
        if (mode === 'edit' && row!.detail_type === 'usage') newBalance += row!.days;
        if (newBalance < -y) {
          setLeaveRowError(`年假透支不可超過每年 ${fmt(y)} 天`);
          return;
        }
      }
    }
    if (table === 'ph' && detailType === 'usage') {
      let newBalance = balance - days;
      if (mode === 'edit' && row!.detail_type === 'usage') newBalance += row!.days;
      if (newBalance < 0) {
        setLeaveRowError('公眾假期不可透支下月額度');
        return;
      }
    }

    setLeaveRowSaving(true);
    try {
      if (mode === 'edit') {
        const { error } = await supabase
          .from(tableName)
          .update({
            record_date: leaveRowModal.record_date,
            days,
            remark: remark || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert({
          user_id: user.id,
          record_date: leaveRowModal.record_date,
          detail_type: detailType,
          days,
          remark: remark || null,
          is_system: false,
          created_by: currentUserId,
        });
        if (error) throw error;
      }
      setLeaveRowModal(null);
      await loadData();
    } catch (err) {
      console.error('儲存明細失敗:', err);
      setLeaveRowError('儲存失敗，請重試');
    } finally {
      setLeaveRowSaving(false);
    }
  };

  const handleDeleteRow = async (table: DetailTable, row: UserAnnualLeaveDetail) => {
    if (!window.confirm(`確定刪除 ${row.record_date} 的「${DETAIL_TYPE_LABELS[row.detail_type]}」記錄？`)) return;
    try {
      const { error } = await supabase.from(DETAIL_TABLE_NAMES[table]).delete().eq('id', row.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('刪除明細失敗:', err);
      setMessage({ type: 'error', text: '刪除失敗，請重試' });
    }
  };

  // ----- 優先指派居住區（勾選衝突時自動從另一組移除） -----
  const handlePrimaryChange = (id: string) => {
    setPreferredPrimary(id);
    if (id) {
      setPreferredSecondary(prev => prev.filter(s => s !== id));
      setStationsForbidden(prev => prev.filter(s => s !== id));
    }
  };

  const toggleSecondary = (id: string) => {
    if (preferredSecondary.includes(id)) {
      setPreferredSecondary(prev => prev.filter(s => s !== id));
    } else {
      setPreferredSecondary(prev => [...prev, id]);
      setStationsForbidden(prev => prev.filter(s => s !== id));
      if (preferredPrimary === id) setPreferredPrimary('');
    }
  };

  const toggleForbidden = (id: string) => {
    if (stationsForbidden.includes(id)) {
      setStationsForbidden(prev => prev.filter(s => s !== id));
    } else {
      setStationsForbidden(prev => [...prev, id]);
      setPreferredSecondary(prev => prev.filter(s => s !== id));
      if (preferredPrimary === id) setPreferredPrimary('');
    }
  };

  // ----- 小組件 -----
  const renderHalfInput = (
    label: string,
    value: string,
    setter: (v: string) => void,
    opts: { unit?: string; min?: number; max?: number } = {},
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={0.5}
          min={opts.min ?? 0}
          max={opts.max}
          value={value}
          onChange={e => setter(e.target.value)}
          placeholder="無限制"
          className={inputClass}
        />
        {opts.unit && <span className="text-sm text-gray-500 whitespace-nowrap">{opts.unit}</span>}
      </div>
    </div>
  );

  /** 年假 / 休息日共用的用度明細表（可摺疊，預設摺疊） */
  const renderDetailTable = (
    table: DetailTable,
    details: UserAnnualLeaveDetail[],
    balance: number,
    isOpen: boolean,
    toggle: () => void,
  ) => (
    <div className="mt-3 border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg"
      >
        <span className="text-sm font-medium text-gray-700">用度明細表</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 border-t border-gray-200">
          <div className="flex gap-2 py-2">
            <button
              type="button"
              onClick={() => openAddUsage(table)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> 新增使用
            </button>
            <button
              type="button"
              onClick={() => openAddWriteoff(table)}
              disabled={balance <= 0}
              title={balance <= 0 ? `累積${DETAIL_TABLE_LABELS[table]}為 0 或負數，不可抹平` : undefined}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> 新增抹平
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-1.5 pr-3 font-medium">日期</th>
                  <th className="py-1.5 pr-3 font-medium">類型</th>
                  <th className="py-1.5 pr-3 font-medium">天數</th>
                  <th className="py-1.5 pr-3 font-medium">備註</th>
                  <th className="py-1.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {details.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-gray-400">
                      暫無記錄
                    </td>
                  </tr>
                )}
                {details.map(row => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDisplayDate(row.record_date)}</td>
                    <td className="py-1.5 pr-3">
                      {DETAIL_TYPE_LABELS[row.detail_type]}
                      {row.is_system && <span className="ml-1 text-xs text-gray-400">（系統）</span>}
                    </td>
                    <td className="py-1.5 pr-3">{fmt(row.days)}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{row.remark ?? ''}</td>
                    <td className="py-1.5 whitespace-nowrap">
                      {!row.is_system && (
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRow(table, row)}
                            className="p-1 text-gray-500 hover:text-blue-600"
                            title="編輯"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(table, row)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const hoursBalanceNum = Number(hoursBalance) || 0;

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* 區塊標題（可摺疊，預設摺疊） */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-lg"
      >
        <span className="text-lg font-medium text-gray-900">僱傭詳情</span>
        {expanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-6 border-t border-gray-200 pt-4">
          {message && (
            <div
              className={`px-4 py-3 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">載入中...</p>
          ) : (
            <>
              {/* 1. 工作時間 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">工作時間</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderHalfInput('每周合約時間', weeklyContractHours, setWeeklyContractHours, { unit: '小時' })}
                  {renderHalfInput('每天合約工時', dailyContractHours, setDailyContractHours, { unit: '小時' })}
                  {renderHalfInput('每周工作天數', weeklyWorkDays, setWeeklyWorkDays, { unit: '天', max: 6 })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">特定上班時間</label>
                    <input
                      type="time"
                      value={defaultWorkStartTime}
                      onChange={e => setDefaultWorkStartTime(e.target.value)}
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      未設定則無限制；有填寫時視為強制可用時段，班次必須落在「特定上班時間」至「特定上班時間＋每天合約工時」範圍內，優先於工時與特定鐘點。
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">工時結餘</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="number"
                      step={0.5}
                      value={hoursBalance}
                      onChange={e => setHoursBalance(e.target.value)}
                      className={`${inputClass} w-32`}
                    />
                    <span className="text-sm text-gray-600">
                      {hoursBalanceNum > 0
                        ? `院舍現欠職員 ${fmt(hoursBalanceNum)} 小時`
                        : hoursBalanceNum < 0
                          ? `職員現欠院舍 ${fmt(-hoursBalanceNum)} 小時`
                          : '結餘為 0'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceModalError(null);
                        setBalanceModal({ remark: '' });
                      }}
                      disabled={hoursBalanceNum === 0}
                      className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      抹平
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. 休息日 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">休息日</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">每周休息天數</label>
                    <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                      {(() => {
                        const d = parseHalf(weeklyWorkDays);
                        if (d === 'invalid' || d === null || d <= 0) return '—';
                        return fmt(weeklyRestDays(d));
                      })()}{' '}
                      天
                    </p>
                    <p className="text-xs text-gray-500 mt-1">由「每周工作天數」自動計算（7 − 每周工作天數）</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">休息日計算起始日</label>
                    <DateInput
                      value={restDayStartDate}
                      onChange={v => setRestDayStartDate(v)}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  由起始日發放一次每周休息天數，之後逢周日發放；可透支無上限、可累積無上限。
                  小數部分累積為 PRD，滿 1 天方可預排。
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                  <span>
                    DO 已獲得：<span className="font-medium">{fmt(restSystemGrantTotal)}</span> 天
                  </span>
                  <span>
                    DO 已使用：<span className="font-medium">{fmt(restUsageTotal)}</span> 天
                  </span>
                  <span>
                    PRD 累積：<span className="font-medium">{fmt(restDayFraction)}</span> 天
                  </span>
                  {nextMonthRestEstimate && (
                    <span className="text-blue-600">
                      下月預估：DO {nextMonthRestEstimate.doDays} 天 / PRD {nextMonthRestEstimate.prdDays} 天
                    </span>
                  )}
                </div>
                {renderDetailTable('rest', restDetails, restBalance, restDetailTableOpen, () =>
                  setRestDetailTableOpen(prev => !prev),
                )}
              </div>

              {/* 4. 有薪年假 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">有薪年假</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderHalfInput('每年', annualLeaveDaysPerYear, setAnnualLeaveDaysPerYear, { unit: '天' })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">年假計算起始日</label>
                    <DateInput
                      value={annualLeaveStartDate}
                      onChange={v => setAnnualLeaveStartDate(v)}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  按入職日／指定起始日起計，受僱每滿一個月發放，滿 3 個月起可享用；可透支無上限、可累積無上限。
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                  <span>
                    按起始日至今應獲得：<span className="font-medium">{fmt(systemGrantTotal)}</span> 天
                  </span>
                  <span>
                    累積：<span className={`font-medium ${leaveBalance < 0 ? 'text-red-600' : ''}`}>{fmt(leaveBalance)}</span> 天
                  </span>
                  <span>
                    已使用：<span className="font-medium">{fmt(usageTotal)}</span> 天
                  </span>
                </div>

                {renderDetailTable('al', leaveDetails, leaveBalance, detailTableOpen, () =>
                  setDetailTableOpen(prev => !prev),
                )}
              </div>

              {/* 5. 公眾假期 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">公眾假期</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">假期類型</label>
                    <select
                      value={publicHolidayType}
                      onChange={e => setPublicHolidayType(e.target.value as '' | 'PH' | 'SH')}
                      className={inputClass}
                    >
                      <option value="">無</option>
                      <option value="PH">銀行假期（PH）</option>
                      <option value="SH">勞工假期（SH）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">公眾假期計算起始日</label>
                    <DateInput
                      value={publicHolidayStartDate}
                      onChange={v => setPublicHolidayStartDate(v)}
                      disabled={!publicHolidayType}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  由起始日當月起，每月 1 日按當月假期日數自動發放；每個假期須在假期當日後 30 天內用完，逾期失效。
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                  <span>
                    未過期額度：<span className={`font-medium ${phBalance < 0 ? 'text-red-600' : ''}`}>{fmt(phBalance)}</span> 天
                  </span>
                  <span>
                    已使用：<span className="font-medium">{fmt(phUsageTotal)}</span> 天
                  </span>
                  {phExpiredTotal > 0 && (
                    <span className="text-red-600">
                      已過期：<span className="font-medium">{fmt(phExpiredTotal)}</span> 天
                    </span>
                  )}
                </div>
                {publicHolidayType && phUnusedHolidayList.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600 mb-1.5">未用假期倒數（有效期至）</p>
                    <div className="flex flex-wrap gap-2">
                      {phUnusedHolidayList.map(h => (
                        <span
                          key={h.holiday_date}
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs ${
                            h.daysLeft <= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {h.name}
                          <span className="ml-1 text-[10px] opacity-80">
                            ({formatDisplayDate(h.holiday_date)} 剩 {h.daysLeft} 天)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {renderDetailTable('ph', publicHolidayDetails, phBalance, publicDetailTableOpen, () =>
                  setPublicDetailTableOpen(prev => !prev),
                )}
              </div>

              {/* 6. 優先指派居住區 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">優先指派居住區</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">最優先區</label>
                    <select
                      value={preferredPrimary}
                      onChange={e => handlePrimaryChange(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">（無）</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">次優先區</label>
                    <div className="border border-gray-300 rounded-lg px-3 py-2 max-h-32 overflow-y-auto space-y-1">
                      {stations.length === 0 && <p className="text-sm text-gray-400">暫無局住區</p>}
                      {stations.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={preferredSecondary.includes(s.id)}
                            onChange={() => toggleSecondary(s.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">不可前往</label>
                    <div className="border border-gray-300 rounded-lg px-3 py-2 max-h-32 overflow-y-auto space-y-1">
                      {stations.length === 0 && <p className="text-sm text-gray-400">暫無局住區</p>}
                      {stations.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={stationsForbidden.includes(s.id)}
                            onChange={() => toggleForbidden(s.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  不選擇「不可前往」的局住區，自動指派仍有可能派往該區。
                </p>
              </div>

              {/* 儲存按鈕（獨立於用戶表單） */}
              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '儲存中...' : '儲存僱傭詳情'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 工時結餘抹平備註 Modal（自製，不用 window.prompt） */}
      {balanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">抹平工時結餘</h3>
              <button type="button" onClick={() => setBalanceModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {balanceModalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {balanceModalError}
                </div>
              )}
              <p className="text-sm text-gray-600">
                目前結餘：
                <span className="font-medium">{fmt(hoursBalanceNum)}</span>
                {' 小時'}
                ，確認後將設為 0 並記錄此次調整。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註 *</label>
                <textarea
                  value={balanceModal.remark}
                  onChange={e => setBalanceModal(prev => (prev ? { ...prev, remark: e.target.value } : prev))}
                  rows={3}
                  placeholder="請輸入抹平原因"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBalanceModal(null)}
                  disabled={balanceSaving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleBalanceWriteoff}
                  disabled={balanceSaving || !balanceModal.remark.trim()}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {balanceSaving ? '處理中...' : '確認抹平'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 年假 / 休息日 使用、抹平行 新增編輯 Modal */}
      {leaveRowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {leaveRowModal.mode === 'edit'
                  ? `編輯「${DETAIL_TYPE_LABELS[leaveRowModal.row!.detail_type]}」記錄`
                  : leaveRowModal.mode === 'add-usage'
                    ? '新增使用'
                    : '新增抹平'}
              </h3>
              <button type="button" onClick={() => setLeaveRowModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {leaveRowError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {leaveRowError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                <DateInput
                  value={leaveRowModal.record_date}
                  onChange={v => setLeaveRowModal(prev => (prev ? { ...prev, record_date: v } : prev))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">天數 *</label>
                {leaveRowModal.mode === 'add-usage' ||
                (leaveRowModal.mode === 'edit' && leaveRowModal.row!.detail_type === 'usage') ? (
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={leaveRowModal.days}
                    onChange={e => setLeaveRowModal(prev => (prev ? { ...prev, days: e.target.value } : prev))}
                    className={inputClass}
                  />
                ) : (
                  <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                    {leaveRowModal.days} 天（= 當前累積值）
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備註{(leaveRowModal.mode === 'add-writeoff' ||
                    (leaveRowModal.mode === 'edit' && leaveRowModal.row!.detail_type === 'writeoff')) && ' *'}
                </label>
                <textarea
                  value={leaveRowModal.remark}
                  onChange={e => setLeaveRowModal(prev => (prev ? { ...prev, remark: e.target.value } : prev))}
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLeaveRowModal(null)}
                  disabled={leaveRowSaving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleLeaveRowSave}
                  disabled={leaveRowSaving}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {leaveRowSaving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploymentDetailsSection;
