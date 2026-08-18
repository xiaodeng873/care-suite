import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Search, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import PublicHolidayModal from '../components/PublicHolidayModal';
import PatientPrintModal from '../components/PatientPrintModal';
import type { PrintDocumentOptions } from '../components/PatientPrintModal';
import { formatDisplayDate, formatTimeToHHMM } from '../utils/dateFormat';
import ConfirmOverrideModal from '../components/ConfirmOverrideModal';
import RosterScheduleView from '../components/RosterScheduleView';
import RosterLeaveModal, { type RosterLeaveModalPayload } from '../components/RosterLeaveModal';
import RosterEmployeeCard from '../components/RosterEmployeeCard';
import RosterScheduleGrid from '../components/RosterScheduleGrid';
import type {
  PublicHoliday,
  PublicHolidayType,
  UserEmploymentDetails,
  UserLeaveRecord,
  UserProfile,
  UserRestDayDetail,
  UserAnnualLeaveDetail,
  StationShiftSetting,
  UserShiftAssignment,
} from '@care-suite/shared';
import { getEmploymentPosition } from '@care-suite/shared';
import { usePatientData } from '../context/PatientContext';
import type { RosterLeaveContext } from '../utils/leaveValidation';
import { getRosterExpectedCounts, getRosterUsedCounts } from '../utils/leaveValidation';
import {
  getRosterGroupOptions,
  getWeekRange,
  normalizeTime,
  formatDate,
  formatTime,
  getShiftDayRequiredHourly,
  shiftDayWindowToShiftHours,
  getSpecificWindowsForPosition,
  getPreScheduleAvailableByShiftHour,
  getAssignmentPositionForTable,
  getAssignmentDurationHours,
} from '../utils/roster';
import { addDays } from '../utils/shiftDay';
import type { PreScheduleSegmentConflict } from '../utils/roster';
import { getExpectedRestDayGrants } from '../utils/restDays';
import { getExpectedAnnualLeaveGrants } from '../utils/annualLeave';
import { loadFacilityNatureSettings, DEFAULT_SPECIFIC_HOURS_CONFIG, GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { SpecificHoursConfig, GridPosition } from '../utils/facilityNatureSettings';
import { computeDualRedLineStaffing, computeStaffingRequirements, timeToMinutes } from '../utils/staffingRequirements';
import type { StaffingResult } from '../utils/staffingRequirements';
import { ROSTER_PRINT_DEPARTMENTS } from '../utils/rosterPrintGenerator';
import type { RosterPrintDocumentId, UserFullBalances } from '../utils/rosterPrintGenerator';
import { useDebounce } from '../hooks/useDebounce';

type Tab = 'roster' | 'leave' | 'holiday';

/** 純計算某員工在目標月份的餘額（WHB / 休息日 / 年假 / 公眾假期） */
function computeUserBalancesForMonth(
  userId: string,
  year: number,
  month: number,
  monthAssignments: UserShiftAssignment[],
  leaveRecords: UserLeaveRecord[],
  employmentMap: Record<string, UserEmploymentDetails>,
  publicHolidays: PublicHoliday[],
  restDetailsMap: Record<string, UserRestDayDetail[]>,
  annualDetailsMap: Record<string, UserAnnualLeaveDetail[]>,
): UserFullBalances {
  const details = employmentMap[userId];
  const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
  const expected = getRosterExpectedCounts(
    details?.weekly_work_days ?? null,
    publicHolidays,
    year,
    month,
    details?.rest_day_start_date,
  );

  // 預估額度：只對「下一個月或更遠」的目標月顯示，並於「目標月前一個月的 1 日」起出現
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const targetMonthStart = new Date(year, month - 1, 1);
  const prevMonthStart = new Date(year, month - 2, 1);
  const showEstimated = targetMonthStart > currentMonthStart && today >= prevMonthStart;

  // ---------- 休息日（DO / PRD）----------
  const restRows = restDetailsMap[userId] ?? [];
  const restExpected = getExpectedRestDayGrants(details?.rest_day_start_date, details?.weekly_work_days);
  const restSystemTotal = restExpected.grants.reduce((s, g) => s + g.days, 0);
  const restManualGrant = restRows
    .filter((d) => d.detail_type === 'grant' && !d.is_system)
    .reduce((s, d) => s + d.days, 0);
  const restUsage = restRows
    .filter((d) => d.detail_type === 'usage')
    .reduce((s, d) => s + d.days, 0);
  const restWriteoff = restRows
    .filter((d) => d.detail_type === 'writeoff')
    .reduce((s, d) => s + d.days, 0);
  const doAccumulated = restSystemTotal + restManualGrant - restUsage - restWriteoff;
  const doEstimated = showEstimated ? expected.doExpected : 0;
  const prdAccumulated = details?.rest_day_fraction ?? 0;
  const prdEstimated = showEstimated ? expected.prdExpected : 0;

  // ---------- 有薪年假 ----------
  const alRows = annualDetailsMap[userId] ?? [];
  const alExpected = getExpectedAnnualLeaveGrants(details?.annual_leave_start_date, details?.annual_leave_days_per_year);
  const alSystemTotal = alExpected.reduce((s, g) => s + g.days, 0);
  const alManualGrant = alRows
    .filter((d) => d.detail_type === 'grant' && !d.is_system)
    .reduce((s, d) => s + d.days, 0);
  const alUsage = alRows
    .filter((d) => d.detail_type === 'usage')
    .reduce((s, d) => s + d.days, 0);
  const alWriteoff = alRows
    .filter((d) => d.detail_type === 'writeoff')
    .reduce((s, d) => s + d.days, 0);
  const alAccumulated = alSystemTotal + alManualGrant - alUsage - alWriteoff;
  const alEstimated = showEstimated
    ? alExpected.filter((g) => g.record_date.startsWith(targetMonthStr)).reduce((s, g) => s + g.days, 0)
    : 0;

  // ---------- 公眾假期（PH / SH）----------
  const usedHolidayIds = new Set<string>();
  for (const l of leaveRecords) {
    if (
      l.user_id === userId &&
      l.record_type === 'leave' &&
      !l.is_overridden &&
      (l.leave_type === 'PH' || l.leave_type === 'SH') &&
      l.reference_public_holiday_id
    ) {
      usedHolidayIds.add(l.reference_public_holiday_id);
    }
  }
  const phType = details?.public_holiday_type;
  const phStart = details?.public_holiday_start_date;
  const todayStr = new Date().toISOString().slice(0, 10);

  let phAccumulated = 0;
  let phEstimated = 0;
  let shAccumulated = 0;
  let shEstimated = 0;
  if (phType && phStart) {
    const userHolidays = publicHolidays.filter(
      (h) => h.type === phType && h.holiday_date >= phStart,
    );
    const unexpired = userHolidays.filter(
      (h) => addDays(h.holiday_date, 30) >= todayStr,
    );
    const unusedUnexpired = unexpired.filter((h) => !usedHolidayIds.has(h.id));
    const accumulated = unusedUnexpired.length;
    const estimated = showEstimated
      ? userHolidays.filter((h) => h.holiday_date.startsWith(targetMonthStr)).length
      : 0;
    if (phType === 'PH') {
      phAccumulated = accumulated;
      phEstimated = estimated;
    } else {
      shAccumulated = accumulated;
      shEstimated = estimated;
    }
  }

  // ---------- 工時結算 WHB（當月已排班工時 − 合約工時累積） ----------
  let whb = 0;
  const userDailyHours = details?.daily_contract_hours ?? 8;
  for (const a of monthAssignments) {
    if (a.user_id !== userId) continue;
    const workedHours = getAssignmentDurationHours(a, userDailyHours);
    whb += workedHours - userDailyHours;
  }

  return {
    doBalance: doAccumulated + doEstimated,
    doAccumulated,
    doEstimated,
    restDayFraction: prdAccumulated,
    prdExpected: expected.prdExpected,
    prdEstimated,
    alBalance: alAccumulated + alEstimated,
    alAccumulated,
    alEstimated,
    phAvailable: phAccumulated + phEstimated,
    phAccumulated,
    phEstimated,
    shAvailable: shAccumulated + shEstimated,
    shAccumulated,
    shEstimated,
    whb,
  };
}

const HOLIDAY_TYPE_LABELS: Record<PublicHolidayType, string> = {
  PH: '銀行假期',
  SH: '勞工假期',
};

interface Station {
  id: string;
  name: string;
  code?: string | null;
}

function userCanFillPosition(user: UserProfile, position: string): boolean {
  return getAssignmentPositionForTable(user, position) !== null;
}

const RosterManagement: React.FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const { allPatients } = usePatientData();
  const isAdminUser = isAdmin();
  const [activeTab, setActiveTab] = useState<Tab>('roster');

  // 排班表：預設本週
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // 員工與僱傭詳情
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [employmentMap, setEmploymentMap] = useState<Record<string, UserEmploymentDetails>>({});
  const [leaveRecords, setLeaveRecords] = useState<UserLeaveRecord[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [restDetailsMap, setRestDetailsMap] = useState<Record<string, UserRestDayDetail[]>>({});
  const [annualDetailsMap, setAnnualDetailsMap] = useState<Record<string, UserAnnualLeaveDetail[]>>({});
  const [loading, setLoading] = useState(true);

  // 排班資料
  const [stations, setStations] = useState<Station[]>([]);
  const [shiftSettings, setShiftSettings] = useState<StationShiftSetting[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<UserShiftAssignment[]>([]);
  const [dailyRequirements, setDailyRequirements] = useState<{ position: string; hours: number; peakHeadcount: number }[]>([]);
  const [hasContractHours, setHasContractHours] = useState(false);
  const [specificHours, setSpecificHours] = useState<SpecificHoursConfig>(DEFAULT_SPECIFIC_HOURS_CONFIG);
  const [staffingResult, setStaffingResult] = useState<StaffingResult | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  // 左側篩選
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [filterPosition, setFilterPosition] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'position' | 'daily_hours'>('name');

  // 假期設定 state
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [deleteIds, setDeleteIds] = useState<Set<string>>(new Set());

  // 預排 modal state
  const [leaveModal, setLeaveModal] = useState<{
    user: UserProfile;
    initialDate?: string;
    editingRecord?: UserLeaveRecord;
  } | null>(null);

  // 下個月游標（假期預排）
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(() => {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { y: next.getFullYear(), m: next.getMonth() + 1 };
  });

  // 假期預排頁專用：整月班次指派與居住區優先順序
  const [monthShiftAssignments, setMonthShiftAssignments] = useState<UserShiftAssignment[]>([]);
  const [stationPriority, setStationPriority] = useState<(string | null)[]>([]);

  // 預排衝突檢查結果
  const [preScheduleConflicts, setPreScheduleConflicts] = useState<PreScheduleSegmentConflict[]>([]);
  const [preScheduleConflictModalOpen, setPreScheduleConflictModalOpen] = useState(false);

  // 列印綜合文件（排班管理 tab）
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [pendingLeaveConflict, setPendingLeaveConflict] = useState<{
    userId: string;
    payload: RosterLeaveModalPayload;
    oldRecord?: UserLeaveRecord;
  } | null>(null);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - 1 + i);
  }, []);

  // 載入員工與僱傭詳情
  useEffect(() => {
    const loadUsers = async () => {
      const { data: profiles, error: e1 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_active', true)
        .order('name_zh', { ascending: true });
      if (e1) throw e1;

      const applicable = (profiles ?? []).filter((p) => getEmploymentPosition(p));
      setUsers(applicable);

      if (applicable.length === 0) {
        setEmploymentMap({});
        return;
      }

      const { data: details, error: e2 } = await supabase
        .from('user_employment_details')
        .select('*')
        .in(
          'user_id',
          applicable.map((p) => p.id),
        );
      if (e2) throw e2;

      const map: Record<string, UserEmploymentDetails> = {};
      for (const d of details ?? []) {
        map[d.user_id] = {
          ...d,
          default_work_start_time: normalizeTime(d.default_work_start_time) || d.default_work_start_time,
        } as UserEmploymentDetails;
      }
      setEmploymentMap(map);
    };

    loadUsers().catch((err) => {
      console.error('載入員工失敗:', err);
      alert('載入員工失敗');
    });
  }, []);

  // 載入院舍設定並計算每日人手要求（排班表與假期預排頁共用）
  const loadFacilityStaffing = useCallback(async () => {
    try {
      const facilitySettings = await loadFacilityNatureSettings();
      const currentResidents = allPatients.filter((p) => p.在住狀態 === '在住').length;
      const staffingInput = {
        bedCounts: facilitySettings.bedCounts,
        specific: facilitySettings.specific,
        currentResidents,
        contractHours: facilitySettings.contractHours,
      };
      const dualRedLine = computeDualRedLineStaffing(staffingInput);
      const staffingReqResult = computeStaffingRequirements(staffingInput);
      console.log('[loadFacilityStaffing]', {
        bedCounts: facilitySettings.bedCounts,
        currentResidents,
        dailyHours: dualRedLine.dailyHours,
        peakHeadcount: dualRedLine.peakHeadcount,
        gridSample: staffingReqResult.grid.slice(7, 15).map((row) => row.slice(0, 5)),
      });
      setDailyRequirements(
        Object.entries(dualRedLine.dailyHours).map(([position, hours]) => ({
          position,
          hours,
          peakHeadcount: dualRedLine.peakHeadcount[position] ?? 0,
        })),
      );
      setHasContractHours(dualRedLine.hasContractHours);
      setSpecificHours(facilitySettings.specific);
      setStaffingResult(staffingReqResult);
    } catch (err) {
      console.error('[loadFacilityStaffing] 計算人手要求失敗:', err);
      setDailyRequirements([]);
      setStaffingResult(null);
    }
  }, [allPatients]);

  // 載入排班表所需資料
  const loadRosterData = useCallback(async (showLoading = true) => {
    if (users.length === 0) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const userIds = users.map((u) => u.id);
      const { start, end } = getWeekRange(weekAnchor);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

      const [
        { data: stationsData, error: eStations },
        { data: settingsData, error: eSettings },
        { data: assignments, error: eAssignments },
        { data: weekLeaves, error: eLeaves },
      ] = await Promise.all([
        supabase.from('stations').select('id, name, code').order('name', { ascending: true }),
        supabase.from('station_shift_settings').select('*').order('station_id', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('user_shift_assignments').select('*').in('user_id', userIds).gte('work_date', startStr).lte('work_date', endStr),
        supabase.from('user_leave_records').select('*').in('user_id', userIds).gte('leave_date', startStr).lte('leave_date', endStr),
      ]);

      if (eStations) throw eStations;
      if (eSettings) throw eSettings;
      if (eAssignments) throw eAssignments;
      if (eLeaves) throw eLeaves;

      setStations((stationsData ?? []) as Station[]);
      setShiftSettings(
        (settingsData ?? []).map((s) => ({
          ...s,
          start_time: normalizeTime(s.start_time) || s.start_time,
        })) as StationShiftSetting[],
      );
      setShiftAssignments(
        (assignments ?? []).map((a) => ({
          ...a,
          start_time: normalizeTime(a.start_time) || a.start_time,
          end_time: normalizeTime(a.end_time) || a.end_time,
        })) as UserShiftAssignment[],
      );
      setLeaveRecords((weekLeaves ?? []) as UserLeaveRecord[]);

      // 預設選中第一個有員工的職位分頁
      const rosterOptions = getRosterGroupOptions(users);
      setSelectedPosition((prev) => {
        if (prev) return prev;
        return rosterOptions[0] ?? '';
      });
    } catch (err) {
      console.error('載入排班資料失敗:', err);
      alert('載入排班資料失敗');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [users, weekAnchor]);

  // 拖曳/刪除班次後只靜默重新載入當週 assignments，避免整個排班表閃爍
  const loadAssignmentsOnly = useCallback(async () => {
    if (users.length === 0) return;
    try {
      const userIds = users.map((u) => u.id);
      const { start, end } = getWeekRange(weekAnchor);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('user_shift_assignments')
        .select('*')
        .in('user_id', userIds)
        .gte('work_date', startStr)
        .lte('work_date', endStr);
      if (error) throw error;
      setShiftAssignments(
        (data ?? []).map((a) => ({
          ...a,
          start_time: normalizeTime(a.start_time) || a.start_time,
          end_time: normalizeTime(a.end_time) || a.end_time,
        })) as UserShiftAssignment[],
      );
    } catch (err) {
      console.error('重新載入班次失敗:', err);
      alert('重新載入班次失敗');
    }
  }, [users, weekAnchor]);

  // 班次設定儲存後靜默重新載入班次設定與當週 assignments
  const reloadShiftSettingsAndAssignments = useCallback(async () => {
    if (users.length === 0) return;
    try {
      const userIds = users.map((u) => u.id);
      const { start, end } = getWeekRange(weekAnchor);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const [
        { data: settingsData, error: eSettings },
        { data: assignments, error: eAssignments },
      ] = await Promise.all([
        supabase.from('station_shift_settings').select('*').order('station_id', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('user_shift_assignments').select('*').in('user_id', userIds).gte('work_date', startStr).lte('work_date', endStr),
      ]);
      if (eSettings) throw eSettings;
      if (eAssignments) throw eAssignments;
      setShiftSettings(
        (settingsData ?? []).map((s) => ({
          ...s,
          start_time: normalizeTime(s.start_time) || s.start_time,
        })) as StationShiftSetting[],
      );
      setShiftAssignments(
        (assignments ?? []).map((a) => ({
          ...a,
          start_time: normalizeTime(a.start_time) || a.start_time,
          end_time: normalizeTime(a.end_time) || a.end_time,
        })) as UserShiftAssignment[],
      );
    } catch (err) {
      console.error('重新載入班次設定失敗:', err);
      alert('重新載入班次設定失敗');
    }
  }, [users, weekAnchor]);

  useEffect(() => {
    if (activeTab !== 'roster') return;
    loadRosterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weekAnchor, users.length]);

  // 院舍設定／在住人數變化時重新計算人手要求
  useEffect(() => {
    if (activeTab !== 'roster' && activeTab !== 'leave') return;
    loadFacilityStaffing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allPatients]);

  // 防止拖曳放開時觸發瀏覽器預設導航（排班表與假期預排頁都有拖曳）
  useEffect(() => {
    if (activeTab !== 'roster' && activeTab !== 'leave') return;
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, [activeTab]);

  // 載入假期預排資料
  const loadLeaveData = useCallback(async (showLoading = true) => {
    if (users.length === 0) {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const start = `${monthCursor.y}-${String(monthCursor.m).padStart(2, '0')}-01`;
      const end = `${monthCursor.y}-${String(monthCursor.m).padStart(2, '0')}-${new Date(monthCursor.y, monthCursor.m, 0).getDate()}`;
      const userIds = users.map((u) => u.id);
      const holidayStart = '2020-01-01';
      const holidayEnd = `${new Date().getFullYear() + 1}-12-31`;

      const [
        { data: leaves, error: e1 },
        { data: holidays, error: e2 },
        { data: restDetails, error: e3 },
        { data: annualDetails, error: e7 },
        { data: stationsData, error: e5 },
        { data: monthAssignments, error: e6 },
      ] = await Promise.all([
        supabase.from('user_leave_records').select('*').in('user_id', userIds).gte('leave_date', start).lte('leave_date', end),
        supabase.from('public_holidays').select('*').gte('holiday_date', holidayStart).lte('holiday_date', holidayEnd).order('holiday_date', { ascending: true }),
        supabase.from('user_rest_day_details').select('*').in('user_id', userIds),
        supabase.from('user_annual_leave_details').select('*').in('user_id', userIds),
        supabase.from('stations').select('id, name, code').order('name', { ascending: true }),
        supabase.from('user_shift_assignments').select('*').in('user_id', userIds).gte('work_date', start).lte('work_date', end),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e7) throw e7;
      if (e5) throw e5;
      if (e6) throw e6;

      setLeaveRecords(
        (leaves ?? []).map((l) => ({
          ...l,
          availability_start_time: l.availability_start_time ? normalizeTime(l.availability_start_time) || l.availability_start_time : l.availability_start_time,
          availability_end_time: l.availability_end_time ? normalizeTime(l.availability_end_time) || l.availability_end_time : l.availability_end_time,
        })) as UserLeaveRecord[],
      );
      setPublicHolidays((holidays ?? []) as PublicHoliday[]);
      setMonthShiftAssignments(
        (monthAssignments ?? []).map((a) => ({
          ...a,
          start_time: normalizeTime(a.start_time) || a.start_time,
          end_time: normalizeTime(a.end_time) || a.end_time,
        })) as UserShiftAssignment[],
      );

      const loadedStations = (stationsData ?? []) as Station[];
      setStations(loadedStations);
      if (stationPriority.length === 0 && loadedStations.length > 0) {
        setStationPriority([...loadedStations.map((s) => s.id), null]);
      }

      const rMap: Record<string, UserRestDayDetail[]> = {};
      for (const d of (restDetails ?? []) as UserRestDayDetail[]) {
        (rMap[d.user_id] ??= []).push(d);
      }
      setRestDetailsMap(rMap);

      const aMap: Record<string, UserAnnualLeaveDetail[]> = {};
      for (const d of (annualDetails ?? []) as UserAnnualLeaveDetail[]) {
        (aMap[d.user_id] ??= []).push(d);
      }
      setAnnualDetailsMap(aMap);

      await loadFacilityStaffing();
    } catch (err) {
      console.error('載入假期預排資料失敗:', err);
      alert('載入假期預排資料失敗');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [users, monthCursor, stationPriority.length, loadFacilityStaffing]);

  useEffect(() => {
    if (activeTab !== 'leave') return;
    loadLeaveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthCursor.y, monthCursor.m, users.length]);

  // 列印 modal 左側員工欄的項目（姓名 + 職位小字）
  const rosterEmployeeItems = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name_zh,
        detail: getEmploymentPosition(u) ?? '',
        department: u.department ?? '',
      })),
    [users],
  );

  // 打開列印 modal 時補載另一 tab 的資料，確保預排表與排班表的資料都齊
  const handleOpenPrintModal = async () => {
    setPrintModalOpen(true);
    const loads: Promise<unknown>[] = [];
    if (activeTab === 'roster') loads.push(loadLeaveData(false));
    else if (activeTab === 'leave') loads.push(loadRosterData(false));
    else loads.push(loadLeaveData(false), loadRosterData(false));
    await Promise.all(loads);
  };

  // 列印綜合文件（排班管理 tab）：產生預排表/排班表 HTML 並列印
  const handleRosterPrint = async (
    documentIds: string[],
    printOptions?: PrintDocumentOptions,
  ) => {
    setPrintModalOpen(false);
    const rosterDocIds = documentIds.filter(
      (id): id is RosterPrintDocumentId => id === 'roster_pre_schedule' || id === 'roster_schedule',
    );
    if (rosterDocIds.length === 0) return; // 此入口只用排班管理 tab
    const [{ generateRosterPrintPages }, { printGroupedHtml }, { getFacilitySettings }] = await Promise.all([
      import('../utils/rosterPrintGenerator'),
      import('../utils/printUtils'),
      import('../utils/facilitySettings'),
    ]);
    const settings = await getFacilitySettings();

    // 列印月份統一由 modal 決定（預設當月）
    const printYearMonth = printOptions?.rosterYearMonth ?? new Date().toISOString().slice(0, 7);
    const [printYear, printMonth] = printYearMonth.split('-').map((n) => Number(n));
    const monthStart = `${printYear}-${String(printMonth).padStart(2, '0')}-01`;
    const monthEnd = `${printYear}-${String(printMonth).padStart(2, '0')}-${new Date(printYear, printMonth, 0).getDate()}`;
    const userIds = users.map((u) => u.id);

    const [
      { data: leaves, error: eLeaves },
      { data: assignments, error: eAssignments },
    ] = await Promise.all([
      supabase.from('user_leave_records').select('*').in('user_id', userIds).gte('leave_date', monthStart).lte('leave_date', monthEnd),
      supabase.from('user_shift_assignments').select('*').in('user_id', userIds).gte('work_date', monthStart).lte('work_date', monthEnd),
    ]);
    if (eLeaves) throw eLeaves;
    if (eAssignments) throw eAssignments;

    const printLeaveRecords = (leaves ?? []).map((l) => ({
      ...l,
      availability_start_time: l.availability_start_time ? normalizeTime(l.availability_start_time) || l.availability_start_time : l.availability_start_time,
      availability_end_time: l.availability_end_time ? normalizeTime(l.availability_end_time) || l.availability_end_time : l.availability_end_time,
    })) as UserLeaveRecord[];
    const printMonthAssignments = (assignments ?? []).map((a) => ({
      ...a,
      start_time: normalizeTime(a.start_time) || a.start_time,
      end_time: normalizeTime(a.end_time) || a.end_time,
    })) as UserShiftAssignment[];

    // 只輸出 modal 左欄被勾選的員工（未傳名單時視為全選）
    const selectedIds = printOptions?.rosterUserIds ? new Set(printOptions.rosterUserIds) : null;
    const printUsers = selectedIds ? users.filter((u) => selectedIds.has(u.id)) : users;
    const files = generateRosterPrintPages(
      {
        users: printUsers,
        employmentDetails: employmentMap,
        stations,
        shiftSettings,
        weekAnchor,
        weekAssignments: shiftAssignments,
        year: printYear,
        month: printMonth,
        monthAssignments: printMonthAssignments,
        scheduleMonthAssignments: printMonthAssignments,
        leaveRecords: printLeaveRecords,
        publicHolidays,
        specificHours,
        staffingResult,
        dailyRequirements,
        hasContractHours,
        getUserFullBalances: (userId) =>
          computeUserBalancesForMonth(
            userId,
            printYear,
            printMonth,
            printMonthAssignments,
            printLeaveRecords,
            employmentMap,
            publicHolidays,
            restDetailsMap,
            annualDetailsMap,
          ),
        facilityName: settings.facilityNameZh,
      },
      {
        documents: rosterDocIds,
        departments: printOptions?.rosterDepartments ?? [...ROSTER_PRINT_DEPARTMENTS],
        outputMode: printOptions?.rosterOutputMode ?? 'combined',
        includeBalance: printOptions?.rosterIncludeBalance ?? true,
        includeCompliance: printOptions?.rosterIncludeCompliance ?? false,
      },
    );
    // 預排表為 A4 landscape、排班表為 A4 portrait，printGroupedHtml 可混合方向列印
    printGroupedHtml(files.flatMap((f) => f.pages), 'roster-print-iframe');
  };

  // 假期設定載入
  const loadHolidays = useCallback(async () => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .gte('holiday_date', start)
      .lte('holiday_date', end)
      .order('holiday_date', { ascending: true });
    if (error) {
      alert(`讀取假期失敗：${error.message}`);
    } else {
      setHolidays((data || []) as PublicHoliday[]);
    }
  }, [year]);

  useEffect(() => {
    if (activeTab !== 'holiday') return;
    loadHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, year]);

  // 預排相關計算
  const shiftMonth = (delta: number) => {
    setMonthCursor((prev) => {
      const next = new Date(prev.y, prev.m - 1 + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() + 1 };
    });
  };

  // 預排衝突檢查：按假期預排記錄計算當天可候召人數，排除放假及有特定上班時間者
  const handleCheckConflicts = useCallback(() => {
    if (!staffingResult) {
      setPreScheduleConflicts([]);
      setPreScheduleConflictModalOpen(true);
      return;
    }
    const conflicts: PreScheduleSegmentConflict[] = [];
    const daysInMonth = new Date(monthCursor.y, monthCursor.m, 0).getDate();
    const positionsToCheck: GridPosition[] = ['護理員', '助理員', '保健員', '註冊/登記護士'];

    const requiredHourly: Record<string, number[]> = {};
    for (let c = 0; c < GRID_POSITIONS.length; c++) {
      requiredHourly[GRID_POSITIONS[c]] = staffingResult.grid.map((row) => row[c]);
    }

    const shiftHourToTime = (shiftHour: number): string =>
      formatTime((shiftHour + 7) % 24, 0);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(monthCursor.y, monthCursor.m, d);
      const requiredByShiftHour = getShiftDayRequiredHourly(dateStr, requiredHourly);

      for (const position of positionsToCheck) {
        const windows = getSpecificWindowsForPosition(position, specificHours);
        if (windows.length === 0) continue;

        const { available: availableByShiftHour, equivalent: equivalentByShiftHour } =
          getPreScheduleAvailableByShiftHour(dateStr, position, users, leaveRecords);

        const req = requiredByShiftHour[position];

        for (const { label, segment } of windows) {
          const { startH, endH } = shiftDayWindowToShiftHours(segment);
          let currentGap: { start: number; end: number; required: number; actualPeople: number; equivalent: number } | null = null;
          for (let h = startH; h < endH; h++) {
            const shiftHour = ((h % 24) + 24) % 24;
            const required = req?.[shiftHour] ?? 0;
            if (required <= 0) {
              if (currentGap) {
                conflicts.push({
                  date: dateStr,
                  position,
                  windowLabel: label,
                  windowTime: `${segment.start}-${segment.end}`,
                  gapTime: `${shiftHourToTime(currentGap.start)}-${shiftHourToTime(currentGap.end)}`,
                  required: currentGap.required,
                  actualPeople: currentGap.actualPeople,
                  equivalent: currentGap.equivalent,
                });
                currentGap = null;
              }
              continue;
            }
            const actualPeople = availableByShiftHour[shiftHour] ?? 0;
            const equivalent = equivalentByShiftHour[shiftHour] ?? 0;
            if (equivalent < required) {
              if (!currentGap || currentGap.required !== required || currentGap.equivalent !== equivalent) {
                if (currentGap) {
                  conflicts.push({
                    date: dateStr,
                    position,
                    windowLabel: label,
                    windowTime: `${segment.start}-${segment.end}`,
                    gapTime: `${shiftHourToTime(currentGap.start)}-${shiftHourToTime(currentGap.end)}`,
                    required: currentGap.required,
                    actualPeople: currentGap.actualPeople,
                    equivalent: currentGap.equivalent,
                  });
                }
                currentGap = { start: h, end: h + 1, required, actualPeople, equivalent };
              } else {
                currentGap.end = h + 1;
              }
            } else if (currentGap) {
              conflicts.push({
                date: dateStr,
                position,
                windowLabel: label,
                windowTime: `${segment.start}-${segment.end}`,
                gapTime: `${shiftHourToTime(currentGap.start)}-${shiftHourToTime(currentGap.end)}`,
                required: currentGap.required,
                actualPeople: currentGap.actualPeople,
                equivalent: currentGap.equivalent,
              });
              currentGap = null;
            }
          }
          if (currentGap) {
            conflicts.push({
              date: dateStr,
              position,
              windowLabel: label,
              windowTime: `${segment.start}-${segment.end}`,
              gapTime: `${shiftHourToTime(currentGap.start)}-${shiftHourToTime(currentGap.end)}`,
              required: currentGap.required,
              actualPeople: currentGap.actualPeople,
              equivalent: currentGap.equivalent,
            });
          }
        }
      }
    }

    setPreScheduleConflicts(conflicts);
    setPreScheduleConflictModalOpen(true);
  }, [monthCursor, leaveRecords, users, specificHours, staffingResult]);

  const getUsedHolidayIds = useCallback(
    (userId: string) => {
      const ids = new Set<string>();
      for (const l of leaveRecords) {
        if (
          l.user_id === userId &&
          l.record_type === 'leave' &&
          !l.is_overridden &&
          (l.leave_type === 'PH' || l.leave_type === 'SH') &&
          l.reference_public_holiday_id
        ) {
          ids.add(l.reference_public_holiday_id);
        }
      }
      return ids;
    },
    [leaveRecords],
  );

  const getUserBalances = useCallback(
    (userId: string) =>
      computeUserBalancesForMonth(
        userId,
        monthCursor.y,
        monthCursor.m,
        monthShiftAssignments,
        leaveRecords,
        employmentMap,
        publicHolidays,
        restDetailsMap,
        annualDetailsMap,
      ),
    [
      employmentMap,
      publicHolidays,
      monthCursor,
      restDetailsMap,
      annualDetailsMap,
      monthShiftAssignments,
      leaveRecords,
    ],
  );

  const handleCellClick = (user: UserProfile, date: string) => {
    setLeaveModal({ user, initialDate: date });
  };

  const handleLeaveClick = (record: UserLeaveRecord) => {
    const user = users.find((u) => u.id === record.user_id);
    if (!user) return;
    setLeaveModal({ user, editingRecord: record });
  };

  const handleDeleteLeave = useCallback(async () => {
    if (!leaveModal?.editingRecord) return;
    const record = leaveModal.editingRecord;
    try {
      const { error: e1 } = await supabase.from('user_leave_records').delete().eq('id', record.id);
      if (e1) throw e1;

      if (record.record_type === 'leave' && record.leave_type === 'DO') {
        const { error: e2 } = await supabase
          .from('user_rest_day_details')
          .delete()
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      } else if (record.record_type === 'leave' && record.leave_type === 'PRD') {
        const details = employmentMap[record.user_id];
        const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) + 1);
        const { error: e2 } = await supabase
          .from('user_employment_details')
          .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
          .eq('user_id', record.user_id);
        if (e2) throw e2;
      } else if (record.record_type === 'leave' && (record.leave_type === 'PH' || record.leave_type === 'SH')) {
        const { error: e2 } = await supabase
          .from('user_public_holiday_details')
          .delete()
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('reference_public_holiday_id', record.reference_public_holiday_id)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      }

      await loadLeaveData();
    } catch (err) {
      console.error('刪除預排失敗:', err);
      throw new Error('刪除預排失敗');
    }
  }, [leaveModal, employmentMap, loadLeaveData]);

  const handleMoveLeave = async (record: UserLeaveRecord, targetDate: string) => {
    const isOwn = record.user_id === userProfile?.id;
    if (!isAdminUser && !isOwn) return;
    if (record.leave_date === targetDate) return;
    const exists = leaveRecords.some(
      (l) => l.user_id === record.user_id && l.leave_date === targetDate && l.id !== record.id,
    );
    if (exists) {
      alert('目標日期已有預排記錄');
      return;
    }
    try {
      await supabase.from('user_leave_records').update({ leave_date: targetDate, updated_at: new Date().toISOString() }).eq('id', record.id);

      if (record.record_type === 'leave' && record.leave_type === 'DO') {
        await supabase
          .from('user_rest_day_details')
          .update({ record_date: targetDate })
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('detail_type', 'usage');
      } else if (record.record_type === 'leave' && (record.leave_type === 'PH' || record.leave_type === 'SH')) {
        await supabase
          .from('user_public_holiday_details')
          .update({ record_date: targetDate })
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('reference_public_holiday_id', record.reference_public_holiday_id)
          .eq('detail_type', 'usage');
      }

      setLeaveRecords((prev) =>
        prev.map((l) => (l.id === record.id ? { ...record, leave_date: targetDate, updated_at: new Date().toISOString() } : l)),
      );
    } catch (err) {
      console.error('移動預排失敗:', err);
      alert('移動預排失敗');
    }
  };

  const executeSaveLeave = async (payload: RosterLeaveModalPayload, oldRecord?: UserLeaveRecord) => {
    if (!leaveModal) return;
    const userId = leaveModal.user.id;

    // 編輯時：先刪除舊記錄及相關明細，再以新資料插入（避免 leave_type / date 改變後明細錯亂）
    if (oldRecord) {
      const { error: eDel } = await supabase.from('user_leave_records').delete().eq('id', oldRecord.id);
      if (eDel) throw eDel;

      if (oldRecord.record_type === 'leave' && oldRecord.leave_type === 'DO') {
        const { error: e2 } = await supabase
          .from('user_rest_day_details')
          .delete()
          .eq('user_id', userId)
          .eq('record_date', oldRecord.leave_date)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      } else if (oldRecord.record_type === 'leave' && oldRecord.leave_type === 'PRD') {
        const details = employmentMap[userId];
        const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) + 1);
        const { error: e2 } = await supabase
          .from('user_employment_details')
          .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (e2) throw e2;
      } else if (oldRecord.record_type === 'leave' && (oldRecord.leave_type === 'PH' || oldRecord.leave_type === 'SH')) {
        const { error: e2 } = await supabase
          .from('user_public_holiday_details')
          .delete()
          .eq('user_id', userId)
          .eq('record_date', oldRecord.leave_date)
          .eq('reference_public_holiday_id', oldRecord.reference_public_holiday_id)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      }

      setLeaveRecords((prev) => prev.filter((l) => l.id !== oldRecord.id));
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      leave_date: payload.leaveDate,
      record_type: payload.recordType,
      urgency: payload.urgency,
      leave_type: payload.recordType === 'leave' ? payload.leaveType : null,
      reference_public_holiday_id:
        payload.recordType === 'leave' && (payload.leaveType === 'PH' || payload.leaveType === 'SH')
          ? payload.referencePublicHolidayId ?? null
          : null,
      availability_start_time: payload.recordType === 'availability' ? payload.availabilityStartTime : null,
      availability_end_time: payload.recordType === 'availability' ? payload.availabilityEndTime : null,
      is_overridden: false,
    };

    const { data: inserted, error: e1 } = await supabase
      .from('user_leave_records')
      .insert(insertPayload)
      .select()
      .single();
    if (e1) throw e1;

    const leaveType = payload.recordType === 'leave' ? payload.leaveType : null;

    if (leaveType === 'DO') {
      const { error: e2 } = await supabase.from('user_rest_day_details').insert({
        user_id: userId,
        record_date: payload.leaveDate,
        detail_type: 'usage',
        days: 1,
        remark: '排班預排 DO',
        is_system: false,
      });
      if (e2) throw e2;
    } else if (leaveType === 'PRD') {
      const details = employmentMap[userId];
      const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) - 1);
      const { error: e2 } = await supabase
        .from('user_employment_details')
        .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (e2) throw e2;
    } else if (leaveType === 'PH' || leaveType === 'SH') {
      const holiday = publicHolidays.find((h) => h.id === payload.referencePublicHolidayId);
      const { error: e2 } = await supabase.from('user_public_holiday_details').insert({
        user_id: userId,
        record_date: payload.leaveDate,
        detail_type: 'usage',
        days: 1,
        remark: `排班預排 ${leaveType}: ${holiday?.name ?? ''}`,
        reference_public_holiday_id: holiday?.id ?? null,
        expiry_date: holiday ? addDays(holiday.holiday_date, 30) : null,
        is_system: false,
      });
      if (e2) throw e2;
    }

    setLeaveRecords((prev) => [
      ...prev,
      {
        ...inserted,
        availability_start_time: inserted.availability_start_time
          ? normalizeTime(inserted.availability_start_time) || inserted.availability_start_time
          : inserted.availability_start_time,
        availability_end_time: inserted.availability_end_time
          ? normalizeTime(inserted.availability_end_time) || inserted.availability_end_time
          : inserted.availability_end_time,
      } as UserLeaveRecord,
    ]);
    setEmploymentMap((prev) => {
      const details = prev[userId];
      if (!details || leaveType !== 'PRD') return prev;
      return {
        ...prev,
        [userId]: { ...details, rest_day_fraction: Math.max(0, details.rest_day_fraction - 1) },
      };
    });

    await loadLeaveData();
  };

  const handleSaveLeave = async (payload: RosterLeaveModalPayload) => {
    if (!leaveModal) return;
    const userId = leaveModal.user.id;
    const oldRecord = leaveModal.editingRecord;

    // 檢查是否與已排班次衝突
    const conflictingAssignments = monthShiftAssignments.filter(
      (a) => a.user_id === userId && a.work_date === payload.leaveDate,
    );
    const hasShiftConflict =
      conflictingAssignments.length > 0 &&
      (payload.recordType === 'leave' ||
        (payload.recordType === 'availability' &&
          payload.availabilityStartTime &&
          payload.availabilityEndTime &&
          conflictingAssignments.some((a) => {
            const s = timeToMinutes(payload.availabilityStartTime!);
            const e = timeToMinutes(payload.availabilityEndTime!);
            const as = timeToMinutes(a.start_time ?? '00:00');
            const ae = timeToMinutes(a.end_time ?? '00:00');
            return s < ae && e > as;
          })));

    if (hasShiftConflict) {
      setPendingLeaveConflict({ userId, payload, oldRecord });
      return;
    }

    await executeSaveLeave(payload, oldRecord);
  };

  const leaveModalContext: RosterLeaveContext | null = useMemo(() => {
    if (!leaveModal) return null;
    const balances = getUserBalances(leaveModal.user.id);
    return {
      year: monthCursor.y,
      month: monthCursor.m,
      existingLeaves: leaveRecords.filter((l) => l.user_id === leaveModal.user.id),
      usedHolidayIds: getUsedHolidayIds(leaveModal.user.id),
      doBalance: balances.doBalance,
      restDayFraction: balances.restDayFraction,
      prdExpected: balances.prdExpected,
      alBalance: balances.alBalance,
      publicHolidays,
      publicHolidayType: employmentMap[leaveModal.user.id]?.public_holiday_type ?? null,
    };
  }, [leaveModal, leaveRecords, publicHolidays, monthCursor, getUserBalances, getUsedHolidayIds, employmentMap]);

  // 假期設定表格
  const handleDelete = async (id: string) => {
    if (!window.confirm('確定刪除此假期？')) return;
    setDeleteIds((prev) => new Set(prev).add(id));
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    if (error) {
      alert(`刪除失敗：${error.message}`);
    } else {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    }
    setDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = (saved: PublicHoliday) => {
    setHolidays((prev) => {
      const exists = prev.find((h) => h.id === saved.id);
      if (exists) {
        return prev.map((h) => (h.id === saved.id ? saved : h));
      }
      return [...prev, saved].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    });
    setModalOpen(false);
    setEditingHoliday(null);
  };

  const grouped = useMemo(() => {
    const ph = holidays
      .filter((h) => h.type === 'PH')
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    const sh = holidays
      .filter((h) => h.type === 'SH')
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    return { ph, sh };
  }, [holidays]);

  const renderHolidayTable = (type: PublicHolidayType, list: PublicHoliday[]) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {HOLIDAY_TYPE_LABELS[type]}（{list.length} 個）
        </h3>
        {isAdminUser && (
          <button
            type="button"
            onClick={() => {
              setEditingHoliday(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            新增{type === 'PH' ? '銀行' : '勞工'}假期
          </button>
        )}
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">日期</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">名稱</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-gray-400">
                  暫無{HOLIDAY_TYPE_LABELS[type]}
                </td>
              </tr>
            )}
            {list.map((h) => (
              <tr key={h.id} className="border-t border-gray-100">
                <td className="px-4 py-2 whitespace-nowrap">{formatDisplayDate(h.holiday_date)}</td>
                <td className="px-4 py-2">{h.name}</td>
                <td className="px-4 py-2 text-right">
                  {isAdminUser ? (
                    <span className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHoliday(h);
                          setModalOpen(true);
                        }}
                        disabled={deleteIds.has(h.id)}
                        className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
                        title="編輯"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        disabled={deleteIds.has(h.id)}
                        className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                        title="刪除"
                      >
                        刪除
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 左側員工卡片篩選
  const positionOptions = useMemo(() => getRosterGroupOptions(users), [users]);

  const filteredEmployeeCards = useMemo(() => {
    let list = users;
    if (deferredSearch.trim()) {
      const term = deferredSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.name_zh.toLowerCase().includes(term) ||
          (u.name_en?.toLowerCase().includes(term) ?? false) ||
          (u.id_number?.toLowerCase().includes(term) ?? false),
      );
    }
    if (filterPosition) {
      list = list.filter((u) => userCanFillPosition(u, filterPosition));
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name_zh.localeCompare(b.name_zh);
      if (sortBy === 'position') {
        const pa = getEmploymentPosition(a) || '';
        const pb = getEmploymentPosition(b) || '';
        return pa.localeCompare(pb) || a.name_zh.localeCompare(b.name_zh);
      }
      if (sortBy === 'daily_hours') {
        const ha = employmentMap[a.id]?.daily_contract_hours ?? 0;
        const hb = employmentMap[b.id]?.daily_contract_hours ?? 0;
        return hb - ha || a.name_zh.localeCompare(b.name_zh);
      }
      return 0;
    });
    return list;
  }, [users, deferredSearch, filterPosition, sortBy, employmentMap]);

  const getBalanceForCard = (user: UserProfile, dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number);
    const details = employmentMap[user.id];
    const expected = getRosterExpectedCounts(
      details?.weekly_work_days ?? null,
      publicHolidays,
      y,
      m,
      details?.rest_day_start_date,
    );
    const userLeaves = leaveRecords.filter((l) => l.user_id === user.id && l.leave_date === dateStr);
    const used = getRosterUsedCounts(userLeaves, y, m);
    return {
      doBalance: expected.doExpected - used.doUsed,
      prdBalance: expected.prdExpected - used.prdUsed,
      alBalance: (details?.annual_leave_days_per_year ?? 0) - used.alUsed,
    };
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <nav className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === 'roster'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              排班表
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === 'leave'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              假期預排
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('holiday')}
              className={`pb-2 text-sm font-medium border-b-2 ${
                activeTab === 'holiday'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              假期設定
            </button>
          </nav>
          <button
            type="button"
            onClick={handleOpenPrintModal}
            className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            列印
          </button>
        </div>
      </div>

      {activeTab === 'roster' && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* 左側：員工卡片列 */}
          <div className="w-72 flex flex-col gap-3 flex-shrink-0">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜尋姓名、身份證..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有職位</option>
                {positionOptions.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'position' | 'daily_hours')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">排序：姓名</option>
                <option value="position">排序：職位</option>
                <option value="daily_hours">排序：每日工時</option>
              </select>
            </div>

            <div
              className="flex-1 overflow-y-auto space-y-2 pr-1 select-none"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {filteredEmployeeCards.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">沒有符合條件的員工</p>
              )}
              {filteredEmployeeCards.map((user) => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const balances = getBalanceForCard(user, todayStr);
                return (
                  <RosterEmployeeCard
                    key={user.id}
                    user={user}
                    details={employmentMap[user.id] ?? null}
                    doBalance={balances.doBalance}
                    prdBalance={balances.prdBalance}
                    alBalance={balances.alBalance}
                    draggable={isAdminUser && !!selectedPosition && userCanFillPosition(user, selectedPosition)}
                    onDragStart={() => setDraggedUserId(user.id)}
                    onDragEnd={() => setDraggedUserId(null)}
                  />
                );
              })}
            </div>
          </div>

          {/* 右側：排班區 */}
          {loading ? (
            <LoadingScreen pageName="排班表" />
          ) : selectedPosition ? (
            <RosterScheduleGrid
              users={users}
              employmentDetails={employmentMap}
              stations={stations}
              shiftAssignments={shiftAssignments}
              shiftSettings={shiftSettings}
              specificHours={specificHours}
              staffingResult={staffingResult}
              weekAnchor={weekAnchor}
              selectedPosition={selectedPosition}
              dailyRequirements={dailyRequirements}
              hasContractHours={hasContractHours}
              draggedUserId={draggedUserId}
              onWeekChange={setWeekAnchor}
              onPositionChange={(position) => {
                setSelectedPosition(position);
                setFilterPosition(position);
              }}
              leaveRecords={leaveRecords}
              stationPriority={stationPriority}
              onAssignmentChange={loadAssignmentsOnly}
              onLeaveRecordsChange={() => loadRosterData(false)}
              onSettingsChange={reloadShiftSettingsAndAssignments}
              onViewLeaveTab={() => setActiveTab('leave')}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              暫無適用排班的職位
            </div>
          )}
        </div>
      )}

      {activeTab === 'leave' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[8rem] text-center">
              {monthCursor.y}年 {monthCursor.m}月
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-500">
              點擊空格新增預排，點擊已排預排編輯
            </span>
          </div>

          {loading ? (
            <LoadingScreen pageName="假期預排" />
          ) : (
            <RosterScheduleView
              year={monthCursor.y}
              month={monthCursor.m}
              users={users}
              employmentDetails={employmentMap}
              leaveRecords={leaveRecords}
              publicHolidays={publicHolidays}
              shiftAssignments={monthShiftAssignments}
              specificHours={specificHours}
              staffingResult={staffingResult}
              dailyRequirements={dailyRequirements}
              hasContractHours={hasContractHours}
              stations={stations}
              stationPriority={stationPriority}
              onStationPriorityChange={setStationPriority}
              currentUserId={userProfile?.id ?? ''}
              isAdmin={isAdminUser}
              loading={loading}
              onCellClick={handleCellClick}
              onLeaveClick={handleLeaveClick}
              onMoveLeave={handleMoveLeave}
              onCheckConflicts={handleCheckConflicts}
              complianceMode="preSchedule"
              preScheduleConflicts={preScheduleConflicts}
              getUserFullBalances={getUserBalances}
            />
          )}
        </div>
      )}

      {activeTab === 'holiday' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700">年度</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {!isAdminUser && (
              <span className="text-xs text-gray-500">（僅開發者/主管可編輯假期）</span>
            )}
          </div>

          {activeTab === 'holiday' && loading ? (
            <LoadingScreen pageName="假期設定" />
          ) : (
            <>
              {renderHolidayTable('PH', grouped.ph)}
              {renderHolidayTable('SH', grouped.sh)}
            </>
          )}
        </div>
      )}

      {activeTab === 'holiday' && modalOpen && (
        <PublicHolidayModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingHoliday(null);
          }}
          onSave={handleSave}
          initial={editingHoliday}
          defaultYear={year}
        />
      )}

      {printModalOpen && (
        <PatientPrintModal
          patients={[]}
          initialTab="排班管理"
          rosterEmployees={rosterEmployeeItems}
          onClose={() => setPrintModalOpen(false)}
          onPrint={async (_patients, documentIds, _startDate, _endDate, _contentMode, printOptions) => {
            await handleRosterPrint(documentIds, printOptions);
          }}
        />
      )}

      {leaveModal && leaveModalContext && (
        <RosterLeaveModal
          isOpen
          onClose={() => setLeaveModal(null)}
          onSave={handleSaveLeave}
          onDelete={leaveModal.editingRecord ? handleDeleteLeave : undefined}
          user={leaveModal.user}
          initialDate={leaveModal.initialDate}
          editingRecord={leaveModal.editingRecord}
          context={leaveModalContext}
        />
      )}

      {pendingLeaveConflict && (
        <ConfirmOverrideModal
          isOpen
          title="預排與排班衝突"
          onClose={() => setPendingLeaveConflict(null)}
          secondaryLabel="查看排班表"
          onSecondary={() => {
            setPendingLeaveConflict(null);
            setActiveTab('roster');
          }}
        >
          <div className="space-y-2">
            <p>
              <span className="font-medium">{pendingLeaveConflict.oldRecord ? '修改後' : '新增'}的預排</span>與以下現有班次重疊，無法新增：
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {monthShiftAssignments
                .filter(
                  (a) =>
                    a.user_id === pendingLeaveConflict.userId &&
                    a.work_date === pendingLeaveConflict.payload.leaveDate,
                )
                .map((a) => {
                  const station = stations.find((s) => s.id === a.station_id);
                  return (
                    <li key={a.id}>
                      {station?.name ?? '未分配居住區'} / {a.shift_name} / {formatTimeToHHMM(a.start_time)}-{formatTimeToHHMM(a.end_time)}
                    </li>
                  );
                })}
            </ul>
            <p className="text-gray-500">
              請先到排班表刪除衝突班次，或改由排班表直接調整。此處不再提供「仍要預排」。
            </p>
          </div>
        </ConfirmOverrideModal>
      )}

      {preScheduleConflictModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">預排人手衝突檢查</h3>
              <button
                type="button"
                onClick={() => setPreScheduleConflictModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {preScheduleConflicts.length === 0 ? (
                <p className="text-sm text-green-700">本月預排無人手衝突。</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">以下日期職位在特定鐘點時段人手不足（未預排放假且無特定上班時間者視為可候召）：</p>
                  {preScheduleConflicts.map((c, idx) => (
                    <div key={idx} className="text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800">
                      <div className="font-medium">{c.date} {c.position} {c.gapTime}</div>
                      <div className="text-red-700">
                        {c.position === '保健員'
                          ? `${c.windowLabel}（${c.windowTime}）：需要 ${c.required} 名保健員人手，可候召 ${c.actualPeople} 人（等效 ${c.equivalent} 人），人手不足`
                          : `${c.windowLabel}（${c.windowTime}）：需要 ${c.required} 人，可候召 ${c.actualPeople} 人，人手不足`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setPreScheduleConflictModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterManagement;
