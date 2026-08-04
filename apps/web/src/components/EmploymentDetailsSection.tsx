import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Plus, Edit2, Trash2, X } from 'lucide-react';
import {
  UserProfile,
  UserAnnualLeaveDetail,
  UserRestDayDetail,
  UserLeaveRecord,
  LeaveType,
  WorkPattern,
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
} from '@care-suite/shared';
import { supabase } from '../lib/supabase';
import { useStationData } from '../context/facility/StationContext';
import { getExpectedAnnualLeaveGrants } from '../utils/annualLeave';
import { getExpectedRestDayGrants } from '../utils/restDays';

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

/** 請假概況矩陣各假別標記顏色 */
const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  AL: 'bg-green-500',
  PRD: 'bg-blue-500',
  DO: 'bg-purple-400',
  SL: 'bg-red-500',
  CL: 'bg-orange-400',
  NPL: 'bg-gray-400',
};

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

/** 明細表類型：年假 / 休息日（兩表結構相同，邏輯共用） */
type DetailTable = 'al' | 'rest';

const DETAIL_TABLE_NAMES: Record<DetailTable, string> = {
  al: 'user_annual_leave_details',
  rest: 'user_rest_day_details',
};

const DETAIL_TABLE_LABELS: Record<DetailTable, string> = {
  al: '年假',
  rest: '休息日',
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
  const [workPattern, setWorkPattern] = useState<WorkPattern | null>(null);
  const [weeklyContractHours, setWeeklyContractHours] = useState('');
  const [weeklyMinHours, setWeeklyMinHours] = useState('');
  const [weeklyMaxHours, setWeeklyMaxHours] = useState('');
  const [dailyMinHours, setDailyMinHours] = useState('');
  const [dailyMaxHours, setDailyMaxHours] = useState('');
  const [hoursBalance, setHoursBalance] = useState('0');
  const [weeklyRestDays, setWeeklyRestDays] = useState('');
  const [restDayStartDate, setRestDayStartDate] = useState(user.hire_date || '');
  const [annualLeaveDaysPerYear, setAnnualLeaveDaysPerYear] = useState('');
  const [annualLeaveStartDate, setAnnualLeaveStartDate] = useState(user.hire_date || '');
  const [preferredPrimary, setPreferredPrimary] = useState('');
  const [preferredSecondary, setPreferredSecondary] = useState<string[]>([]);
  const [stationsForbidden, setStationsForbidden] = useState<string[]>([]);
  /** 載入時的年假起始日，用於偵測更改 */
  const [initialStartDate, setInitialStartDate] = useState<string | null>(null);
  /** 載入時的休息日起始日，用於偵測更改 */
  const [initialRestStartDate, setInitialRestStartDate] = useState<string | null>(null);

  // ----- 年假明細 -----
  const [leaveDetails, setLeaveDetails] = useState<UserAnnualLeaveDetail[]>([]);
  const [detailTableOpen, setDetailTableOpen] = useState(false);
  const [leaveRowModal, setLeaveRowModal] = useState<LeaveRowModalState | null>(null);
  const [leaveRowError, setLeaveRowError] = useState<string | null>(null);
  const [leaveRowSaving, setLeaveRowSaving] = useState(false);

  // ----- 休息日明細 -----
  const [restDetails, setRestDetails] = useState<UserRestDayDetail[]>([]);
  const [restDetailTableOpen, setRestDetailTableOpen] = useState(false);

  // ----- 工時結餘抹平 Modal -----
  const [balanceModal, setBalanceModal] = useState<{ remark: string } | null>(null);
  const [balanceModalError, setBalanceModalError] = useState<string | null>(null);
  const [balanceSaving, setBalanceSaving] = useState(false);

  // ----- 請假概況 -----
  const [leaveRecords, setLeaveRecords] = useState<UserLeaveRecord[]>([]);
  const now = new Date();
  const [matrixMonth, setMatrixMonth] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

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

  // ----- 年假獲得行 lazy 補齊 -----
  const materializeGrants = useCallback(
    async (startDate: string, daysPerYear: number | null, existing: UserAnnualLeaveDetail[]) => {
      const expected = getExpectedAnnualLeaveGrants(startDate, daysPerYear);
      if (expected.length === 0) return;
      // 與 DB 中 is_system=true 的獲得行按 record_date 比對，缺則補；多出的系統行不刪
      const existingDates = new Set(
        existing.filter(d => d.detail_type === 'grant' && d.is_system).map(d => d.record_date),
      );
      const missing = expected.filter(g => !existingDates.has(g.record_date));
      if (missing.length === 0) return;
      const { error } = await supabase.from('user_annual_leave_details').insert(
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
    },
    [user.id, currentUserId],
  );

  // ----- 休息日獲得行 lazy 補齊（起始日一次 + 逢周日發放） -----
  const materializeRestGrants = useCallback(
    async (startDate: string, weeklyDays: number | null, existing: UserRestDayDetail[]) => {
      const expected = getExpectedRestDayGrants(startDate, weeklyDays);
      if (expected.length === 0) return;
      const existingDates = new Set(
        existing.filter(d => d.detail_type === 'grant' && d.is_system).map(d => d.record_date),
      );
      const missing = expected.filter(g => !existingDates.has(g.record_date));
      if (missing.length === 0) return;
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
        { data: records, error: e3 },
        { data: restRows, error: e5 },
      ] = await Promise.all([
        supabase.from('user_employment_details').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('user_annual_leave_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('user_leave_records').select('*').eq('user_id', user.id),
        supabase
          .from('user_rest_day_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e5) throw e5;

      if (details) {
        setWorkPattern(details.work_pattern);
        setWeeklyContractHours(details.weekly_contract_hours?.toString() ?? '');
        setWeeklyMinHours(details.weekly_min_hours?.toString() ?? '');
        setWeeklyMaxHours(details.weekly_max_hours?.toString() ?? '');
        setDailyMinHours(details.daily_min_hours?.toString() ?? '');
        setDailyMaxHours(details.daily_max_hours?.toString() ?? '');
        setHoursBalance(details.hours_balance?.toString() ?? '0');
        setWeeklyRestDays(details.weekly_rest_days?.toString() ?? '');
        // 休息日計算起始日預設 = 入職日期
        setRestDayStartDate(details.rest_day_start_date ?? user.hire_date ?? '');
        setInitialRestStartDate(details.rest_day_start_date ?? user.hire_date ?? null);
        setAnnualLeaveDaysPerYear(details.annual_leave_days_per_year?.toString() ?? '');
        // 年假計算起始日預設 = 入職日期
        setAnnualLeaveStartDate(details.annual_leave_start_date ?? user.hire_date ?? '');
        setInitialStartDate(details.annual_leave_start_date ?? user.hire_date ?? null);
        setPreferredPrimary(details.preferred_station_primary ?? '');
        setPreferredSecondary(details.preferred_station_secondary ?? []);
        setStationsForbidden(details.stations_forbidden ?? []);
      } else {
        setAnnualLeaveStartDate(user.hire_date || '');
        setInitialStartDate(user.hire_date || null);
        setRestDayStartDate(user.hire_date || '');
        setInitialRestStartDate(user.hire_date || null);
      }

      let detailRows = (rows ?? []) as UserAnnualLeaveDetail[];
      // lazy 補齊年假獲得行
      const startDate = details?.annual_leave_start_date ?? user.hire_date ?? null;
      const daysPerYear = details?.annual_leave_days_per_year ?? null;
      if (startDate && daysPerYear) {
        await materializeGrants(startDate, daysPerYear, detailRows);
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
      const weeklyDays = details?.weekly_rest_days ?? null;
      if (restStart && weeklyDays) {
        await materializeRestGrants(restStart, weeklyDays, restDetailRows);
        const { data: refreshedRest, error: e6 } = await supabase
          .from('user_rest_day_details')
          .select('*')
          .eq('user_id', user.id)
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true });
        if (e6) throw e6;
        restDetailRows = (refreshedRest ?? []) as UserRestDayDetail[];
      }
      setRestDetails(restDetailRows);
      setLeaveRecords((records ?? []) as UserLeaveRecord[]);
    } catch (err) {
      console.error('載入僱傭詳情失敗:', err);
      setMessage({ type: 'error', text: '載入僱傭詳情失敗' });
    } finally {
      setLoading(false);
    }
  }, [user.id, user.hire_date, materializeGrants, materializeRestGrants]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ----- 儲存僱傭詳情 -----
  const handleSave = async () => {
    setMessage(null);

    // 驗證所有數字欄位是 0.5 的倍數
    const numericInputs: Array<[string, string, boolean]> = [
      ['每周合約時間', weeklyContractHours, false],
      ['每周最少時間', weeklyMinHours, false],
      ['每周最多時間', weeklyMaxHours, false],
      ['每天最少時間', dailyMinHours, false],
      ['每天最多時間', dailyMaxHours, false],
      ['工時結餘', hoursBalance, true],
      ['每周休息日', weeklyRestDays, false],
      ['每年年假天數', annualLeaveDaysPerYear, false],
    ];
    const parsed: Record<string, number | null> = {};
    for (const [label, value, allowNegative] of numericInputs) {
      const p = parseHalf(value);
      if (p === 'invalid' || (p !== null && !allowNegative && p < 0)) {
        setMessage({ type: 'error', text: `${label}必須是 0.5 的倍數${allowNegative ? '' : '且不可為負數'}` });
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
    const hasSystemRestGrants = restDetails.some(d => d.detail_type === 'grant' && d.is_system);
    if (restStartChanged && hasSystemRestGrants) {
      const ok = window.confirm('更改起始日會令所有系統發放的休息日獲得明細重新計算，不能繼承。確定更改？');
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
      if (restStartChanged && hasSystemRestGrants) {
        const { error } = await supabase
          .from('user_rest_day_details')
          .delete()
          .eq('user_id', user.id)
          .eq('is_system', true);
        if (error) throw error;
      }

      const { error } = await supabase.from('user_employment_details').upsert(
        {
          user_id: user.id,
          work_pattern: workPattern,
          weekly_contract_hours: parsed['每周合約時間'],
          weekly_min_hours: parsed['每周最少時間'],
          weekly_max_hours: parsed['每周最多時間'],
          daily_min_hours: parsed['每天最少時間'],
          daily_max_hours: parsed['每天最多時間'],
          hours_balance: parsed['工時結餘'] ?? 0,
          weekly_rest_days: parsed['每周休息日'],
          rest_day_start_date: restDayStartDate || null,
          annual_leave_days_per_year: parsed['每年年假天數'],
          annual_leave_start_date: annualLeaveStartDate || null,
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
        const { data: rows } = await supabase
          .from('user_annual_leave_details')
          .select('*')
          .eq('user_id', user.id);
        await materializeGrants(annualLeaveStartDate, parsed['每年年假天數'], (rows ?? []) as UserAnnualLeaveDetail[]);
      }
      if (restDayStartDate && parsed['每周休息日']) {
        const { data: rows } = await supabase
          .from('user_rest_day_details')
          .select('*')
          .eq('user_id', user.id);
        await materializeRestGrants(restDayStartDate, parsed['每周休息日'], (rows ?? []) as UserRestDayDetail[]);
      }

      setInitialStartDate(annualLeaveStartDate || null);
      setInitialRestStartDate(restDayStartDate || null);
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
  const balanceFor = (table: DetailTable) => (table === 'al' ? leaveBalance : restBalance);

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

    // 透支硬阻止（只限年假；休息日可透支無上限）：編輯時先還原原行影響再計算
    const y = parseHalf(annualLeaveDaysPerYear);
    if (table === 'al' && detailType === 'usage' && y !== null && y !== 'invalid' && y > 0) {
      let newBalance = balance - days;
      if (mode === 'edit' && row!.detail_type === 'usage') newBalance += row!.days;
      if (newBalance < -y) {
        setLeaveRowError(`透支不可超過每年 ${fmt(y)} 天`);
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

  // ----- 優先指派局住區（勾選衝突時自動從另一組移除） -----
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

  // ----- 請假概況矩陣 -----
  const daysInMonth = new Date(matrixMonth.y, matrixMonth.m, 0).getDate();
  const shiftMonth = (delta: number) => {
    setMatrixMonth(prev => {
      const total = (prev.m - 1) + delta;
      return { y: prev.y + Math.floor(total / 12), m: (total % 12) + 1 };
    });
  };
  const leaveRecordSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of leaveRecords) set.add(`${r.leave_date}|${r.leave_type}`);
    return set;
  }, [leaveRecords]);

  // ----- 小組件 -----
  const renderHalfInput = (
    label: string,
    value: string,
    setter: (v: string) => void,
    opts: { unit?: string; min?: number } = {},
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={0.5}
          min={opts.min ?? 0}
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
                    <td className="py-1.5 pr-3 whitespace-nowrap">{row.record_date}</td>
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
              {/* 1. 工作日安排 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">工作日安排</h4>
                <div className="flex items-center gap-6">
                  {(['輪班', '一至五'] as WorkPattern[]).map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={workPattern === p}
                        onChange={e => setWorkPattern(e.target.checked ? p : null)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. 工作時間 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">工作時間</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderHalfInput('每周合約時間', weeklyContractHours, setWeeklyContractHours, { unit: '小時' })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {renderHalfInput('每周最少', weeklyMinHours, setWeeklyMinHours, { unit: '小時' })}
                  {renderHalfInput('每周最多', weeklyMaxHours, setWeeklyMaxHours, { unit: '小時' })}
                  {renderHalfInput('每天最少', dailyMinHours, setDailyMinHours, { unit: '小時' })}
                  {renderHalfInput('每天最多', dailyMaxHours, setDailyMaxHours, { unit: '小時' })}
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
                  {renderHalfInput('每周休息日', weeklyRestDays, setWeeklyRestDays, { unit: '天' })}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">休息日計算起始日</label>
                    <input
                      type="date"
                      value={restDayStartDate}
                      onChange={e => setRestDayStartDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  由起始日發放一次每周休息日天數，之後逢周日發放；可透支無上限、可累積無上限。
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                  <span>
                    按起始日至今應獲得：<span className="font-medium">{fmt(restSystemGrantTotal)}</span> 天
                  </span>
                  <span>
                    累積：<span className={`font-medium ${restBalance < 0 ? 'text-red-600' : ''}`}>{fmt(restBalance)}</span> 天
                  </span>
                  <span>
                    已使用：<span className="font-medium">{fmt(restUsageTotal)}</span> 天
                  </span>
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
                    <input
                      type="date"
                      value={annualLeaveStartDate}
                      onChange={e => setAnnualLeaveStartDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
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

              {/* 5. 優先指派局住區 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">優先指派局住區</h4>
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

              {/* 6. 請假概況 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">請假概況</h4>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="上月"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 min-w-[5rem] text-center">
                    {matrixMonth.y}-{String(matrixMonth.m).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="下月"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-2 py-1 text-left font-medium text-gray-500 sticky left-0 bg-gray-50">
                          假別
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <th key={i + 1} className="px-1 py-1 font-medium text-gray-500 text-center min-w-[1.5rem]">
                            {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {LEAVE_TYPES.map(t => (
                        <tr key={t} className="border-b border-gray-100">
                          <td className="px-2 py-1 whitespace-nowrap text-gray-700 sticky left-0 bg-white">
                            {LEAVE_TYPE_LABELS[t]} {t}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const dateStr = `${matrixMonth.y}-${String(matrixMonth.m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                            const hasLeave = leaveRecordSet.has(`${dateStr}|${t}`);
                            return (
                              <td key={i + 1} className="px-1 py-1 text-center">
                                {hasLeave && (
                                  <span
                                    className={`inline-block h-4 w-4 rounded-sm ${LEAVE_TYPE_COLORS[t]}`}
                                    title={`${dateStr} ${LEAVE_TYPE_LABELS[t]}`}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                <input
                  type="date"
                  value={leaveRowModal.record_date}
                  onChange={e => setLeaveRowModal(prev => (prev ? { ...prev, record_date: e.target.value } : prev))}
                  className={inputClass}
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
