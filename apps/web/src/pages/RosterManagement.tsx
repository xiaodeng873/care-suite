import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import PublicHolidayModal from '../components/PublicHolidayModal';
import RosterScheduleView from '../components/RosterScheduleView';
import RosterLeaveModal from '../components/RosterLeaveModal';
import RosterEmployeeCard from '../components/RosterEmployeeCard';
import RosterScheduleGrid from '../components/RosterScheduleGrid';
import type {
  PublicHoliday,
  PublicHolidayType,
  UserEmploymentDetails,
  UserLeaveRecord,
  UserProfile,
  UserRestDayDetail,
  UserPublicHolidayDetail,
  LeaveType,
  StationShiftSetting,
  UserShiftAssignment,
  EmploymentPosition,
} from '@care-suite/shared';
import { getEmploymentPosition, ALL_POSITIONS } from '@care-suite/shared';
import { usePatients } from '../context/PatientContext';
import type { RosterLeaveContext } from '../utils/leaveValidation';
import { getRosterExpectedCounts, getRosterUsedCounts } from '../utils/leaveValidation';
import { getPositionOptions, getWeekRange } from '../utils/roster';
import { loadFacilityNatureSettings, DEFAULT_SPECIFIC_HOURS_CONFIG, GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { SpecificHoursConfig } from '../utils/facilityNatureSettings';
import { computeDualRedLineStaffing, computeStaffingRequirements } from '../utils/staffingRequirements';
import type { StaffingResult } from '../utils/staffingRequirements';
import { useDebounce } from '../hooks/useDebounce';

type Tab = 'roster' | 'leave' | 'holiday';

const HOLIDAY_TYPE_LABELS: Record<PublicHolidayType, string> = {
  PH: '銀行假期',
  SH: '勞工假期',
};

interface Station {
  id: string;
  name: string;
  code?: string | null;
}

interface RosterUser {
  profile: UserProfile;
  details: UserEmploymentDetails | null;
  restDetails: UserRestDayDetail[];
  phDetails: UserPublicHolidayDetail[];
}

const RosterManagement: React.FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const { allPatients } = usePatients();
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
  const [phDetailsMap, setPhDetailsMap] = useState<Record<string, UserPublicHolidayDetail[]>>({});
  const [loading, setLoading] = useState(true);

  // 排班資料
  const [stations, setStations] = useState<Station[]>([]);
  const [shiftSettings, setShiftSettings] = useState<StationShiftSetting[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<UserShiftAssignment[]>([]);
  const [dailyRequirements, setDailyRequirements] = useState<{ position: string; hours: number; peakHeadcount: number }[]>([]);
  const [specificHours, setSpecificHours] = useState<SpecificHoursConfig>(DEFAULT_SPECIFIC_HOURS_CONFIG);
  const [staffingResult, setStaffingResult] = useState<StaffingResult | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<EmploymentPosition | ''>('');
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  // 左側篩選
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [filterPosition, setFilterPosition] = useState<EmploymentPosition | ''>('');
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
  } | null>(null);

  // 下個月游標（假期預排）
  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(() => {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { y: next.getFullYear(), m: next.getMonth() + 1 };
  });

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
        map[d.user_id] = d as UserEmploymentDetails;
      }
      setEmploymentMap(map);
    };

    loadUsers().catch((err) => {
      console.error('載入員工失敗:', err);
      alert('載入員工失敗');
    });
  }, []);

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
      ] = await Promise.all([
        supabase.from('stations').select('id, name, code').order('name', { ascending: true }),
        supabase.from('station_shift_settings').select('*').order('station_id', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('user_shift_assignments').select('*').in('user_id', userIds).gte('work_date', startStr).lte('work_date', endStr),
      ]);

      if (eStations) throw eStations;
      if (eSettings) throw eSettings;
      if (eAssignments) throw eAssignments;

      setStations((stationsData ?? []) as Station[]);
      setShiftSettings((settingsData ?? []) as StationShiftSetting[]);
      setShiftAssignments((assignments ?? []) as UserShiftAssignment[]);

      // 載入院舍設定並計算每日人手要求
      const facilitySettings = await loadFacilityNatureSettings();
      const currentResidents = allPatients.filter((p) => p.在住狀態 === '在住').length;
      const staffingInput = {
        bedCounts: facilitySettings.bedCounts,
        specific: facilitySettings.specific,
        currentResidents,
      };
      const dualRedLine = computeDualRedLineStaffing(staffingInput);
      const staffingReqResult = computeStaffingRequirements(staffingInput);
      setDailyRequirements(
        Object.entries(dualRedLine.dailyHours).map(([position, hours]) => ({
          position,
          hours,
          peakHeadcount: dualRedLine.peakHeadcount[position] ?? 0,
        })),
      );
      setSpecificHours(facilitySettings.specific);
      setStaffingResult(staffingReqResult);

      // 預設選中第一個有員工的職位
      const positionOptions = getPositionOptions(users);
      setSelectedPosition((prev) => {
        if (prev) return prev;
        return positionOptions[0] ?? '';
      });
    } catch (err) {
      console.error('載入排班資料失敗:', err);
      alert('載入排班資料失敗');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [users, weekAnchor, allPatients]);

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
      setShiftAssignments((data ?? []) as UserShiftAssignment[]);
    } catch (err) {
      console.error('重新載入班次失敗:', err);
      alert('重新載入班次失敗');
    }
  }, [users, weekAnchor]);

  useEffect(() => {
    if (activeTab !== 'roster') return;
    loadRosterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weekAnchor, users.length, allPatients.length]);

  // 防止拖曳放開時觸發瀏覽器預設導航（導致整頁重新載入）
  useEffect(() => {
    if (activeTab !== 'roster') return;
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
  const loadLeaveData = useCallback(async () => {
    if (users.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const start = `${monthCursor.y}-${String(monthCursor.m).padStart(2, '0')}-01`;
      const end = `${monthCursor.y}-${String(monthCursor.m).padStart(2, '0')}-${new Date(monthCursor.y, monthCursor.m, 0).getDate()}`;
      const userIds = users.map((u) => u.id);

      const [
        { data: leaves, error: e1 },
        { data: holidays, error: e2 },
        { data: restDetails, error: e3 },
        { data: phDetails, error: e4 },
      ] = await Promise.all([
        supabase.from('user_leave_records').select('*').in('user_id', userIds).gte('leave_date', start).lte('leave_date', end),
        supabase.from('public_holidays').select('*').gte('holiday_date', `${monthCursor.y}-01-01`).lte('holiday_date', `${monthCursor.y}-12-31`).order('holiday_date', { ascending: true }),
        supabase.from('user_rest_day_details').select('*').in('user_id', userIds),
        supabase.from('user_public_holiday_details').select('*').in('user_id', userIds),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      setLeaveRecords((leaves ?? []) as UserLeaveRecord[]);
      setPublicHolidays((holidays ?? []) as PublicHoliday[]);

      const rMap: Record<string, UserRestDayDetail[]> = {};
      for (const d of (restDetails ?? []) as UserRestDayDetail[]) {
        (rMap[d.user_id] ??= []).push(d);
      }
      setRestDetailsMap(rMap);

      const pMap: Record<string, UserPublicHolidayDetail[]> = {};
      for (const d of (phDetails ?? []) as UserPublicHolidayDetail[]) {
        (pMap[d.user_id] ??= []).push(d);
      }
      setPhDetailsMap(pMap);
    } catch (err) {
      console.error('載入假期預排資料失敗:', err);
      alert('載入假期預排資料失敗');
    } finally {
      setLoading(false);
    }
  }, [users, monthCursor]);

  useEffect(() => {
    if (activeTab !== 'leave') return;
    loadLeaveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthCursor.y, monthCursor.m, users.length]);

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

  const getUserBalances = (userId: string) => {
    const details = employmentMap[userId];
    const expected = getRosterExpectedCounts(
      details?.weekly_work_days ?? null,
      details?.rest_day_fraction ?? 0,
      publicHolidays,
      monthCursor.y,
      monthCursor.m,
      details?.rest_day_start_date,
    );
    const userLeaves = leaveRecords.filter((l) => l.user_id === userId);
    const used = getRosterUsedCounts(userLeaves, monthCursor.y, monthCursor.m);

    const restGrantTotal = (restDetailsMap[userId] ?? [])
      .filter((d) => d.detail_type === 'grant' && d.is_system)
      .reduce((s, d) => s + d.days, 0);
    const restUsageTotal = (restDetailsMap[userId] ?? [])
      .filter((d) => d.detail_type === 'usage')
      .reduce((s, d) => s + d.days, 0);
    const doBalance = restGrantTotal - restUsageTotal;

    const phGrantTotal = (phDetailsMap[userId] ?? [])
      .filter((d) => d.detail_type === 'grant' && d.is_system && d.remark?.includes('PH'))
      .reduce((s, d) => s + d.days, 0);
    const shGrantTotal = (phDetailsMap[userId] ?? [])
      .filter((d) => d.detail_type === 'grant' && d.is_system && d.remark?.includes('SH'))
      .reduce((s, d) => s + d.days, 0);

    return {
      doBalance: doBalance + expected.doExpected,
      restDayFraction: details?.rest_day_fraction ?? 0,
      prdExpected: expected.prdExpected,
      phAvailable: phGrantTotal + expected.phExpected - used.phUsed,
      shAvailable: shGrantTotal + expected.shExpected - used.shUsed,
    };
  };

  const getUsedHolidayIds = (userId: string) => {
    const ids = new Set<string>();
    for (const l of leaveRecords) {
      if (l.user_id === userId && (l.leave_type === 'PH' || l.leave_type === 'SH') && l.reference_public_holiday_id) {
        ids.add(l.reference_public_holiday_id);
      }
    }
    return ids;
  };

  const handleCellClick = (user: UserProfile, date: string) => {
    setLeaveModal({ user, initialDate: date });
  };

  const handleLeaveClick = async (record: UserLeaveRecord) => {
    if (!window.confirm(`確定刪除 ${record.leave_date} 的 ${record.leave_type} 預排？`)) return;
    try {
      const { error: e1 } = await supabase.from('user_leave_records').delete().eq('id', record.id);
      if (e1) throw e1;

      if (record.leave_type === 'DO') {
        const { error: e2 } = await supabase
          .from('user_rest_day_details')
          .delete()
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      } else if (record.leave_type === 'PRD') {
        const details = employmentMap[record.user_id];
        const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) + 1);
        const { error: e2 } = await supabase
          .from('user_employment_details')
          .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
          .eq('user_id', record.user_id);
        if (e2) throw e2;
      } else if (record.leave_type === 'PH' || record.leave_type === 'SH') {
        const { error: e2 } = await supabase
          .from('user_public_holiday_details')
          .delete()
          .eq('user_id', record.user_id)
          .eq('record_date', record.leave_date)
          .eq('detail_type', 'usage');
        if (e2) throw e2;
      }

      await loadLeaveData();
    } catch (err) {
      console.error('刪除預排失敗:', err);
      alert('刪除預排失敗');
    }
  };

  const handleSaveLeave = async (payload: {
    leaveDate: string;
    leaveType: LeaveType;
    referencePublicHolidayId?: string | null;
  }) => {
    if (!leaveModal) return;
    const userId = leaveModal.user.id;

    const { data: inserted, error: e1 } = await supabase
      .from('user_leave_records')
      .insert({
        user_id: userId,
        leave_date: payload.leaveDate,
        leave_type: payload.leaveType,
        reference_public_holiday_id: payload.referencePublicHolidayId ?? null,
      })
      .select()
      .single();
    if (e1) throw e1;

    if (payload.leaveType === 'DO') {
      const { error: e2 } = await supabase.from('user_rest_day_details').insert({
        user_id: userId,
        record_date: payload.leaveDate,
        detail_type: 'usage',
        days: 1,
        remark: '排班預排 DO',
        is_system: false,
      });
      if (e2) throw e2;
    } else if (payload.leaveType === 'PRD') {
      const details = employmentMap[userId];
      const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) - 1);
      const { error: e2 } = await supabase
        .from('user_employment_details')
        .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (e2) throw e2;
    } else if (payload.leaveType === 'PH' || payload.leaveType === 'SH') {
      const holiday = publicHolidays.find((h) => h.id === payload.referencePublicHolidayId);
      const { error: e2 } = await supabase.from('user_public_holiday_details').insert({
        user_id: userId,
        record_date: payload.leaveDate,
        detail_type: 'usage',
        days: 1,
        remark: `排班預排 ${payload.leaveType}: ${holiday?.name ?? ''}`,
        is_system: false,
      });
      if (e2) throw e2;
    }

    setLeaveRecords((prev) => [...prev, inserted as UserLeaveRecord]);
    setEmploymentMap((prev) => {
      const details = prev[userId];
      if (!details || payload.leaveType !== 'PRD') return prev;
      return {
        ...prev,
        [userId]: { ...details, rest_day_fraction: Math.max(0, details.rest_day_fraction - 1) },
      };
    });

    await loadLeaveData();
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
      publicHolidays,
    };
  }, [leaveModal, leaveRecords, publicHolidays, employmentMap, restDetailsMap, phDetailsMap, monthCursor]);

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
    const ph = holidays.filter((h) => h.type === 'PH');
    const sh = holidays.filter((h) => h.type === 'SH');
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
                <td className="px-4 py-2 whitespace-nowrap">{h.holiday_date}</td>
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
  const positionOptions = useMemo(() => getPositionOptions(users), [users]);

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
      list = list.filter((u) => {
        const primary = getEmploymentPosition(u);
        if (primary === filterPosition) return true;
        return (u.secondary_positions || []).includes(filterPosition);
      });
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
      details?.rest_day_fraction ?? 0,
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">排班管理</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
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
      </div>

      {activeTab === 'roster' && (
        <div className="flex gap-4 h-[calc(100vh-12rem)]">
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
                onChange={(e) => setFilterPosition(e.target.value as EmploymentPosition | '')}
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
              draggedUserId={draggedUserId}
              onWeekChange={setWeekAnchor}
              onPositionChange={setSelectedPosition}
              onAssignmentChange={loadAssignmentsOnly}
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
              點擊空格預排假期，點擊已排假期刪除
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
              loading={loading}
              onCellClick={handleCellClick}
              onLeaveClick={handleLeaveClick}
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

      {leaveModal && leaveModalContext && (
        <RosterLeaveModal
          isOpen
          onClose={() => setLeaveModal(null)}
          onSave={handleSaveLeave}
          user={leaveModal.user}
          initialDate={leaveModal.initialDate}
          context={leaveModalContext}
        />
      )}
    </div>
  );
};

export default RosterManagement;
