import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type {
  UserProfile,
  UserEmploymentDetails,
  UserShiftAssignment,
  UserLeaveRecord,
  StationShiftSetting,
  ShiftName,
  PublicHoliday,
} from '@care-suite/shared';
import { SHIFT_NAME_LABELS, getEmploymentPosition, LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { supabase, useAuth } from '../context/AuthContext';
import RosterShiftCard from './RosterShiftCard';
import RosterConflictModal from './RosterConflictModal';
import ConfirmOverrideModal from './ConfirmOverrideModal';
import ConflictTicker from './ConflictTicker';
import { generateAutoRoster } from '../utils/autoRoster';
import type { AutoRosterConflict } from '../utils/autoRoster';
import {
  getWeekRange,
  getWeekDays,
  getActiveShiftSettings,
  buildShiftAssignmentMap,
  getDailyContractHours,
  getAssignmentEndTime,
  getShiftEndTime,
  getDragStartTime,
  buildDailyCompliance,
  getRosterGroupOptions,
  isSingleShiftGroup,
  getAssignmentPositionForTable,
  normalizeTime,
  getSpecificWorkingTimeWindow,
  isShiftInWindow,
  type WeekDay,
  type ComplianceRow,
} from '../utils/roster';
import { getAssignmentShiftDay } from '../utils/shiftDay';
import type { SpecificHoursConfig } from '../utils/facilityNatureSettings';
import { GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { StaffingResult } from '../utils/staffingRequirements';
import { timeToMinutes } from '../utils/staffingRequirements';

function userCanFillPosition(user: UserProfile, position: string): boolean {
  return getAssignmentPositionForTable(user, position) !== null;
}

/** 檢查班次是否落在員工常態化特定上班時間窗口內 */
function findWindowConflict(
  userId: string,
  startTime: string,
  endTime: string,
  employmentDetails: Record<string, UserEmploymentDetails>,
): string | null {
  const window = getSpecificWorkingTimeWindow(employmentDetails[userId]);
  if (!window) return null;
  if (isShiftInWindow(window, startTime, endTime)) return null;
  return `該員工已設定特定上班時間 ${window.start}-${window.end}，此班次時間不在允許範圍內`;
}

/** 檢查排班時段是否與預排請假/單次 availability 衝突（以每天早上 07:00 為排班日起點） */
function findLeaveConflict(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  leaveRecords: UserLeaveRecord[],
): UserLeaveRecord | null {
  const shiftDay = getAssignmentShiftDay(date, startTime);
  for (const r of leaveRecords) {
    if (r.user_id !== userId || r.leave_date !== shiftDay) continue;
    if (r.record_type === 'leave') return r;
    if (r.record_type === 'availability' && r.availability_start_time && r.availability_end_time) {
      const s = timeToMinutes(startTime);
      const e = timeToMinutes(endTime);
      const rs = timeToMinutes(r.availability_start_time);
      const re = timeToMinutes(r.availability_end_time);
      if (s < re && e > rs) return r;
    }
  }
  return null;
}

interface Station {
  id: string;
  name: string;
  code?: string | null;
}

interface DailyRequirement {
  position: string;
  hours: number;
  peakHeadcount: number;
}

interface RosterScheduleGridProps {
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  stations: Station[];
  shiftAssignments: UserShiftAssignment[];
  shiftSettings: StationShiftSetting[];
  specificHours: SpecificHoursConfig;
  staffingResult: StaffingResult | null;
  weekAnchor: Date;
  selectedPosition: string;
  dailyRequirements: DailyRequirement[];
  hasContractHours: boolean;
  draggedUserId: string | null;
  leaveRecords: UserLeaveRecord[];
  stationPriority: (string | null)[];
  onWeekChange: (anchor: Date) => void;
  onLeaveRecordsChange?: () => void;
  onPositionChange: (position: string) => void;
  onAssignmentChange: () => void;
  onSettingsChange: () => void;
  onViewLeaveTab?: () => void;
}

export const RosterScheduleGrid: React.FC<RosterScheduleGridProps> = ({
  users,
  employmentDetails,
  stations,
  shiftAssignments,
  shiftSettings,
  specificHours,
  staffingResult,
  weekAnchor,
  selectedPosition,
  dailyRequirements,
  hasContractHours,
  draggedUserId,
  leaveRecords,
  stationPriority,
  onWeekChange,
  onPositionChange,
  onAssignmentChange,
  onLeaveRecordsChange,
  onSettingsChange,
  onViewLeaveTab,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const canEdit = isAdmin();
  const { start, end } = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const days = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
  const [editingStation, setEditingStation] = useState<Station | { id: null; name: string } | null>(null);
  const [localSettings, setLocalSettings] = useState<StationShiftSetting[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [complianceExpanded, setComplianceExpanded] = useState<Set<string>>(() => new Set(days.map((d) => d.date)));
  const toggleDayExpanded = (date: string) => {
    setComplianceExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  const [autoRosterLoading, setAutoRosterLoading] = useState<string | null>(null);
  const [draggedAssignmentId, setDraggedAssignmentId] = useState<string | null>(null);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [conflicts, setConflicts] = useState<AutoRosterConflict[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingRosterInsert, setPendingRosterInsert] = useState<{
    payload: Record<string, unknown>;
    conflict: UserLeaveRecord;
  } | null>(null);
  const [pendingWindowOverride, setPendingWindowOverride] = useState<{
    sourceAssignmentId: string | null;
    sourceUserIdFromList: string | null;
    date: string;
    stationId: string | null;
    shift: StationShiftSetting;
    dropTarget: { assignmentId: string; insertBefore: boolean } | null;
  } | null>(null);
  const selectedGridPosition = selectedPosition;
  /** 行政排班頁不分居住區，全域一欄 */
  const isGlobalTab = selectedPosition === '行政';
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ id: string; insertBefore: boolean } | null>(null);

  const overriddenAssignments = useMemo(
    () => shiftAssignments.filter((a) => a.is_overridden),
    [shiftAssignments],
  );

  const tickerItems = useMemo(() => {
    const items: import('./ConflictTicker').TickerItem[] = [];
    for (const a of overriddenAssignments) {
      const user = users.find((u) => u.id === a.user_id);
      const station = stations.find((s) => s.id === a.station_id);
      items.push({
        id: `override-${a.id}`,
        text: `${a.work_date} ${station?.name ?? '未分區'} ${user?.name_zh ?? a.user_id} ${a.shift_name} 班次被標為待調整`,
        onClick: () => setHighlightDate(a.work_date),
      });
    }
    return items;
  }, [overriddenAssignments, users, stations]);

  useEffect(() => {
    if (!highlightDate) return;
    const el = document.getElementById(`day-block-${highlightDate}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-red-400');
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-red-400');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightDate]);

  // 載入當週涉及年份的公眾假期，用於在日期列顯示假期名稱
  useEffect(() => {
    const years = new Set(days.map((d) => Number(d.date.slice(0, 4))));
    const load = async () => {
      const startStr = `${Math.min(...years)}-01-01`;
      const endStr = `${Math.max(...years)}-12-31`;
      const { data, error } = await supabase
        .from('public_holidays')
        .select('*')
        .gte('holiday_date', startStr)
        .lte('holiday_date', endStr)
        .order('holiday_date', { ascending: true });
      if (!error) setPublicHolidays((data ?? []) as PublicHoliday[]);
    };
    load();
  }, [days]);

  const assignmentMap = useMemo(
    () => buildShiftAssignmentMap(shiftAssignments, users, selectedGridPosition),
    [shiftAssignments, users, selectedGridPosition],
  );

  const getSupabaseErrorMessage = (err: unknown, fallback: string): string => {
    if (err && typeof err === 'object') {
      if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
        return (err as { message: string }).message;
      }
      if ('error' in err && typeof (err as { error: unknown }).error === 'string') {
        return (err as { error: string }).error;
      }
      if ('details' in err && typeof (err as { details: unknown }).details === 'string') {
        return (err as { details: string }).details;
      }
    }
    if (err instanceof Error) return err.message;
    return fallback;
  };

  const isMissingColumnError = (err: unknown, column: string): boolean => {
    const message = getSupabaseErrorMessage(err, '').toLowerCase();
    return message.includes('column') && message.includes(column.toLowerCase()) && message.includes('does not exist');
  };

  const withEndTimeFallback = async (
    operation: () => Promise<{ error: unknown }>,
    fallback: () => Promise<{ error: unknown }>,
  ): Promise<unknown> => {
    const result = await operation();
    if (result.error && isMissingColumnError(result.error, 'end_time')) {
      return (await fallback()).error;
    }
    return result.error;
  };

  const withoutEndTime = <T extends Record<string, unknown>>(payload: T): Omit<T, 'end_time'> => {
    return Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'end_time')) as Omit<T, 'end_time'>;
  };

  // 初始化班次設定編輯狀態：所有部門均可選早/日/午/晚四班；單班制部門（行政、專職、庶務）無既有設定時預設只啟用日班
  useEffect(() => {
    if (editingStation) {
      const existing = getActiveShiftSettings(shiftSettings, editingStation.id, selectedPosition);
      const isSingle = isSingleShiftGroup(selectedPosition);
      const defaults: { shift_name: ShiftName; start_time: string }[] = [
        { shift_name: '早班', start_time: '07:00' },
        { shift_name: '日班', start_time: '08:00' },
        { shift_name: '午班', start_time: '13:00' },
        { shift_name: '晚班', start_time: '22:00' },
      ];
      const hasExisting = existing.length > 0;
      const merged = defaults.map((d, index) => {
        const found = existing.find((s) => s.shift_name === d.shift_name);
        if (found) return { ...found, sort_order: index + 1 };
        return {
          id: `new-${d.shift_name}`,
          station_id: editingStation.id,
          position: selectedPosition,
          shift_name: d.shift_name,
          start_time: d.start_time,
          is_active: isSingle && d.shift_name === '日班' && !hasExisting,
          sort_order: index + 1,
          created_at: '',
          updated_at: '',
        } as StationShiftSetting;
      });
      setLocalSettings(merged);
    }
  }, [editingStation, shiftSettings, selectedPosition]);

  const handlePrevWeek = () => {
    const next = new Date(weekAnchor);
    next.setDate(weekAnchor.getDate() - 7);
    onWeekChange(next);
  };

  const handleNextWeek = () => {
    const next = new Date(weekAnchor);
    next.setDate(weekAnchor.getDate() + 7);
    onWeekChange(next);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedAssignmentId ? 'move' : 'copy';
  };

  const getEndTimeForUser = (userId: string, startTime: string) => {
    return getShiftEndTime(startTime, getDailyContractHours(employmentDetails[userId]));
  };

  const processDrop = async (
    sourceAssignmentId: string | null,
    sourceUserIdFromList: string | null,
    date: string,
    stationId: string | null,
    shift: StationShiftSetting,
    dropTarget: { assignmentId: string; insertBefore: boolean } | null,
    skipWindowCheck = false,
  ) => {
    if (!canEdit) return;

    const sourceAssignment = sourceAssignmentId
      ? shiftAssignments.find((a) => a.id === sourceAssignmentId)
      : null;

    let sourceUserId: string | null = null;
    let sourceUser: UserProfile | undefined;
    let actualPosition: string | null = null;

    if (sourceAssignment) {
      sourceUserId = sourceAssignment.user_id;
      sourceUser = users.find((u) => u.id === sourceUserId);
      if (!sourceUser) return;
      actualPosition =
        sourceAssignment.position ||
        getAssignmentPositionForTable(sourceUser, selectedGridPosition) ||
        null;
      if (!actualPosition) {
        alert('該員工職位不符合此排班表');
        return;
      }
    } else if (sourceUserIdFromList) {
      sourceUserId = sourceUserIdFromList;
      sourceUser = users.find((u) => u.id === sourceUserId);
      if (!sourceUser) return;
      actualPosition = getAssignmentPositionForTable(sourceUser, selectedGridPosition);
      if (!actualPosition) {
        alert('該員工職位不符合此排班表');
        return;
      }
    } else {
      return;
    }

    // 行政表主管單日限制
    if (selectedGridPosition === '行政' && actualPosition === '主管') {
      const hasSupervisor = shiftAssignments.some((a) => {
        if (a.id === sourceAssignment?.id) return false;
        if (a.work_date !== date) return false;
        const u = users.find((usr) => usr.id === a.user_id);
        if (!u) return false;
        const pos = a.position === '行政' || a.position === '庶務' ? getEmploymentPosition(u) : a.position;
        return pos === '主管';
      });
      if (hasSupervisor) {
        alert('當天行政表已有一位主管當值，不能安排另一位主管');
        return;
      }
    }

    const targetKey = `${stationId ?? 'unassigned'}|${shift.shift_name}|${date}`;

    // 新增時檢查同 cell 是否已有同員工
    if (!sourceAssignment) {
      const existingInCell = assignmentMap.byKey.get(targetKey)?.some((a) => a.user_id === sourceUserId);
      if (existingInCell) {
        alert('該員工在該時段已有班次');
        return;
      }
    }

    const sourceStartTime = getDragStartTime(employmentDetails[sourceUserId || ''], shift.start_time);
    const endTime = getEndTimeForUser(sourceUserId || '', sourceStartTime);

    // 拖回原位（同 key 且無指定插入目標）則不處理
    if (
      sourceAssignment &&
      sourceAssignment.work_date === date &&
      sourceAssignment.station_id === stationId &&
      sourceAssignment.shift_name === shift.shift_name &&
      !dropTarget
    ) {
      return;
    }

    // 檢查常態化特定上班時間窗口；若衝突，讓主管決定是否 override
    if (!skipWindowCheck) {
      const windowConflict = findWindowConflict(sourceUserId || '', sourceStartTime, endTime, employmentDetails);
      if (windowConflict) {
        setPendingWindowOverride({
          sourceAssignmentId,
          sourceUserIdFromList,
          date,
          stationId,
          shift,
          dropTarget,
        });
        return;
      }
    }

    // 新增時檢查預排衝突
    if (!sourceAssignment) {
      const conflict = findLeaveConflict(sourceUserId || '', date, sourceStartTime, endTime, leaveRecords);
      if (conflict) {
        setPendingRosterInsert({
          payload: {
            user_id: sourceUserId,
            work_date: date,
            station_id: stationId,
            position: actualPosition,
            shift_name: shift.shift_name,
            start_time: sourceStartTime,
            end_time: endTime,
            created_by: userProfile?.id ?? null,
          },
          conflict,
        });
        return;
      }
    }

    // 計算新排序
    const targetList = (assignmentMap.byKey.get(targetKey) || []).filter(
      (a) => a.id !== sourceAssignment?.id,
    );
    if (targetList.some((a) => a.user_id === sourceUserId)) {
      alert('該員工在該時段已有班次');
      return;
    }
    let insertIndex = targetList.length;
    if (dropTarget) {
      const idx = targetList.findIndex((a) => a.id === dropTarget.assignmentId);
      if (idx >= 0) {
        insertIndex = dropTarget.insertBefore ? idx : idx + 1;
      }
    }

    const sourceOriginKey = sourceAssignment
      ? `${sourceAssignment.station_id ?? 'unassigned'}|${sourceAssignment.shift_name}|${sourceAssignment.work_date}`
      : null;
    const sourceOriginList =
      sourceOriginKey && sourceOriginKey !== targetKey
        ? (assignmentMap.byKey.get(sourceOriginKey) || []).filter((a) => a.id !== sourceAssignment?.id)
        : null;

    const now = new Date().toISOString();

    try {
      // 移動 source assignment
      if (sourceAssignment) {
        const sourceUpdate = {
          work_date: date,
          station_id: stationId,
          shift_name: shift.shift_name,
          position: actualPosition,
          start_time: sourceStartTime,
          end_time: endTime,
          sort_order: insertIndex,
          updated_at: now,
        };
        const error = await withEndTimeFallback(
          async () => await supabase.from('user_shift_assignments').update(sourceUpdate).eq('id', sourceAssignment.id),
          async () =>
            await supabase.from('user_shift_assignments').update(withoutEndTime(sourceUpdate)).eq('id', sourceAssignment.id),
        );
        if (error) throw error;
      } else {
        const insertPayload = {
          user_id: sourceUserId,
          work_date: date,
          station_id: stationId,
          position: actualPosition,
          shift_name: shift.shift_name,
          start_time: sourceStartTime,
          end_time: endTime,
          created_by: userProfile?.id ?? null,
          sort_order: insertIndex,
        };
        const error = await withEndTimeFallback(
          async () => await supabase.from('user_shift_assignments').insert(insertPayload),
          async () => await supabase.from('user_shift_assignments').insert(withoutEndTime(insertPayload)),
        );
        if (error) throw error;
      }

      // 重新編號 target key 內所有卡片
      const targetSortUpdates = targetList.map((a, i) => ({
        id: a.id,
        sort_order: i < insertIndex ? i : i + 1,
      }));
      for (const upd of targetSortUpdates) {
        const { error } = await supabase
          .from('user_shift_assignments')
          .update({ sort_order: upd.sort_order, updated_at: now })
          .eq('id', upd.id);
        if (error) throw error;
      }

      // 若跨 key 移動，重新編號原 key 的卡片
      if (sourceOriginList) {
        for (let i = 0; i < sourceOriginList.length; i++) {
          const { error } = await supabase
            .from('user_shift_assignments')
            .update({ sort_order: i, updated_at: now })
            .eq('id', sourceOriginList[i].id);
          if (error) throw error;
        }
      }

      onAssignmentChange();
    } catch (err) {
      console.error(sourceAssignment ? '移動班次失敗:' : '新增班次失敗:', err);
      alert(getSupabaseErrorMessage(err, sourceAssignment ? '移動班次失敗' : '新增班次失敗'));
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    date: string,
    stationId: string | null,
    shift: StationShiftSetting,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceAssignmentId = draggedAssignmentId || e.dataTransfer.getData('assignmentId');
    const sourceUserId = draggedUserId || e.dataTransfer.getData('userId') || e.dataTransfer.getData('text/plain');

    await processDrop(sourceAssignmentId || null, sourceUserId || null, date, stationId, shift, null);
  };

  const handleDropOnCard = async (
    e: React.DragEvent,
    assignmentId: string,
    insertBefore: boolean,
    date: string,
    stationId: string | null,
    shift: StationShiftSetting,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);

    const sourceAssignmentId = draggedAssignmentId || e.dataTransfer.getData('assignmentId');
    const sourceUserId = draggedUserId || e.dataTransfer.getData('userId') || e.dataTransfer.getData('text/plain');

    // 拖曳自己到自己上不做任何事
    if (sourceAssignmentId && sourceAssignmentId === assignmentId) {
      return;
    }

    await processDrop(sourceAssignmentId || null, sourceUserId || null, date, stationId, shift, {
      assignmentId,
      insertBefore,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('user_shift_assignments').delete().eq('id', id);
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('刪除班次失敗:', err);
      alert(getSupabaseErrorMessage(err, '刪除班次失敗'));
    }
  };

  const confirmInsertAssignment = async () => {
    if (!pendingRosterInsert) return;
    const { payload, conflict } = pendingRosterInsert;
    setPendingRosterInsert(null);
    try {
      const targetKey = `${payload.station_id ?? 'unassigned'}|${payload.shift_name}|${payload.work_date}`;
      const existingCount = assignmentMap.byKey.get(targetKey)?.length ?? 0;
      const payloadWithSort = { ...payload, sort_order: existingCount };
      const error = await withEndTimeFallback(
        async () => await supabase.from('user_shift_assignments').insert(payloadWithSort),
        async () => await supabase.from('user_shift_assignments').insert(withoutEndTime(payloadWithSort)),
      );
      if (error) throw error;

      // 直接刪除衝突的預排記錄及相關明細
      if (conflict.record_type === 'leave') {
        const { error: delError } = await supabase.from('user_leave_records').delete().eq('id', conflict.id);
        if (delError) throw delError;

        if (conflict.leave_type === 'DO') {
          await supabase
            .from('user_rest_day_details')
            .delete()
            .eq('user_id', conflict.user_id)
            .eq('record_date', conflict.leave_date)
            .eq('detail_type', 'usage');
        } else if (conflict.leave_type === 'PRD') {
          const details = employmentDetails[conflict.user_id];
          const newFraction = Math.max(0, (details?.rest_day_fraction ?? 0) + 1);
          await supabase
            .from('user_employment_details')
            .update({ rest_day_fraction: newFraction, updated_at: new Date().toISOString() })
            .eq('user_id', conflict.user_id);
        } else if (conflict.leave_type === 'PH' || conflict.leave_type === 'SH') {
          await supabase
            .from('user_public_holiday_details')
            .delete()
            .eq('user_id', conflict.user_id)
            .eq('record_date', conflict.leave_date)
            .eq('detail_type', 'usage');
        }
      }

      onAssignmentChange();
      onLeaveRecordsChange?.();
    } catch (err) {
      console.error('新增班次失敗:', err);
      alert(getSupabaseErrorMessage(err, '新增班次失敗'));
    }
  };

  const confirmWindowOverride = async () => {
    if (!pendingWindowOverride) return;
    const { sourceAssignmentId, sourceUserIdFromList, date, stationId, shift, dropTarget } = pendingWindowOverride;
    setPendingWindowOverride(null);
    await processDrop(sourceAssignmentId, sourceUserIdFromList, date, stationId, shift, dropTarget, true);
  };

  const handleUpdateShiftTime = async (id: string, startTime: string, endTime: string) => {
    try {
      const updatePayload = {
        start_time: startTime.slice(0, 5),
        end_time: endTime.slice(0, 5),
        updated_at: new Date().toISOString(),
      };
      const error = await withEndTimeFallback(
        async () => await supabase.from('user_shift_assignments').update(updatePayload).eq('id', id),
        async () => await supabase.from('user_shift_assignments').update(withoutEndTime(updatePayload)).eq('id', id),
      );
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('更新班次時間失敗:', err);
      alert(getSupabaseErrorMessage(err, '更新班次時間失敗'));
    }
  };

  const handleSaveSettings = async () => {
    if (!editingStation) return;
    setSavingSettings(true);
    try {
      const stationId = editingStation.id;
      const position = selectedPosition;

      const doSave = async (withPosition: boolean): Promise<unknown> => {
        // 先刪除該居住區、該職位的既有設定
        let deleteQuery = supabase.from('station_shift_settings').delete();
        if (stationId === null) {
          deleteQuery = deleteQuery.is('station_id', null);
        } else {
          deleteQuery = deleteQuery.eq('station_id', stationId);
        }
        if (withPosition) {
          if (position) {
            deleteQuery = deleteQuery.eq('position', position);
          } else {
            deleteQuery = deleteQuery.is('position', null);
          }
        }
        const { error: deleteError } = await deleteQuery;
        if (deleteError) return deleteError;

        const inserts = localSettings
          .filter((s) => s.is_active)
          .map((s, i) => ({
            station_id: stationId,
            ...(withPosition ? { position } : {}),
            shift_name: s.shift_name,
            start_time: normalizeTime(s.start_time) || s.start_time,
            is_active: true,
            sort_order: i + 1,
          }));
        if (inserts.length > 0) {
          const { error: insertError } = await supabase.from('station_shift_settings').insert(inserts);
          if (insertError) return insertError;
        }
        return null;
      };

      let error = await doSave(true);
      if (error && isMissingColumnError(error, 'position')) {
        error = await doSave(false);
      }
      if (error) throw error;

      onSettingsChange();
      setEditingStation(null);
    } catch (err) {
      console.error('儲存班次設定失敗:', err);
      alert(getSupabaseErrorMessage(err, '儲存班次設定失敗'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAutoRoster = async (date: string) => {
    if (!selectedPosition) return;
    setAutoRosterLoading(date);
    try {
      const result = generateAutoRoster({
        date,
        position: selectedPosition,
        users,
        employmentDetails,
        stations,
        stationPriority,
        shiftSettings,
        existingAssignments: shiftAssignments,
        dailyRequirements,
        staffingResult,
        specific: specificHours,
        leaveRecords,
      });

      if (result.insertions.length > 0) {
        const inserts = result.insertions.map((ins) => ({
          user_id: ins.user_id,
          work_date: ins.work_date,
          station_id: ins.station_id,
          position: ins.position,
          shift_name: ins.shift_name,
          start_time: ins.start_time,
          end_time: getShiftEndTime(
            ins.start_time,
            getDailyContractHours(employmentDetails[ins.user_id]),
          ),
          created_by: userProfile?.id ?? null,
        }));

        const error = await withEndTimeFallback(
          async () => await supabase.from('user_shift_assignments').insert(inserts),
          async () =>
            await supabase.from('user_shift_assignments').insert(
              inserts.map((ins) => withoutEndTime(ins)),
            ),
        );
        if (error) throw error;

        await onAssignmentChange();
      }

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setConflictModalOpen(true);
      }
    } catch (err) {
      console.error('一鍵排班失敗:', err);
      alert(getSupabaseErrorMessage(err, '一鍵排班失敗'));
    } finally {
      setAutoRosterLoading(null);
    }
  };

  const handleOverrideConflict = async (userId: string, date: string) => {
    try {
      const { error } = await supabase
        .from('user_leave_records')
        .update({
          is_overridden: true,
          overridden_by: userProfile?.id ?? null,
          overridden_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('leave_date', date)
        .eq('record_type', 'leave')
        .eq('urgency', 'preferred')
        .eq('is_overridden', false);
      if (error) throw error;

      setConflicts((prev) =>
        prev.filter((c) => !(c.user_id === userId && c.date === date && c.urgency === 'preferred')),
      );
      onLeaveRecordsChange?.();
    } catch (err) {
      console.error('override 預排失敗:', err);
      alert(getSupabaseErrorMessage(err, 'override 預排失敗'));
    }
  };

  const toggleShiftActive = (index: number) => {
    setLocalSettings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_active: !next[index].is_active };
      return next;
    });
  };

  const updateShiftTime = (index: number, startTime: string) => {
    setLocalSettings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], start_time: startTime };
      return next;
    });
  };

  const stationColumns = useMemo<(Station | null)[]>(
    () => (isGlobalTab ? [null] : [...stations, null]),
    [stations, isGlobalTab],
  );

  const allShiftNames = useMemo<ShiftName[]>(() => {
    const set = new Set<ShiftName>();
    for (const station of stationColumns) {
      const id = station?.id ?? null;
      for (const s of getActiveShiftSettings(shiftSettings, id, selectedPosition)) {
        set.add(s.shift_name);
      }
    }
    const order: ShiftName[] = ['早班', '日班', '午班', '晚班'];
    return order.filter((name) => set.has(name));
  }, [stationColumns, shiftSettings, selectedPosition]);

  const getStationShift = (
    stationId: string | null,
    shiftName: ShiftName,
  ): StationShiftSetting | undefined => {
    return getActiveShiftSettings(shiftSettings, stationId, selectedPosition).find(
      (s) => s.shift_name === shiftName,
    );
  };

  const renderDayBlock = (day: WeekDay) => {
    const holiday = publicHolidays.find((h) => h.holiday_date === day.date);
    const dateLabel = `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}/${day.date.slice(0, 4)} 星期${day.weekday}`;
    const dayCompliance = complianceByDay.find((d) => d.date === day.date);
    let complianceRows: ComplianceRow[] = [];
    let complianceLabel = '當日人手達標檢查';
    if (selectedGridPosition === '行政' || selectedGridPosition === '庶務') {
      const assistantRow = dayCompliance?.rows.find((r) => r.position === '助理員');
      if (assistantRow) complianceRows = [assistantRow];
      complianceLabel = '當日助理員達標檢查';
    } else if (selectedGridPosition === '護士/保健員') {
      const nurseRow = dayCompliance?.rows.find((r) => r.position === '註冊/登記護士');
      const hwRow = dayCompliance?.rows.find((r) => r.position === '保健員');
      complianceRows = [nurseRow, hwRow].filter(Boolean) as ComplianceRow[];
      complianceLabel = '當日護士/保健員達標檢查';
    } else {
      const row = dayCompliance?.rows.find((r) => r.position === selectedGridPosition);
      if (row) complianceRows = [row];
    }
    const dayAllOk = complianceRows.length === 0 || complianceRows.every((r) => (hasContractHours ? r.hoursOk && r.specificSlotOk : r.specificSlotOk));
    const expanded = complianceExpanded.has(day.date);
    // 本週最後一天（星期六）顯示一周工時統計，只限當前分頁相關且買位有指定工時的職位
    const isLastDay = day.date === days[days.length - 1]?.date;
    const weeklyRows = isLastDay
      ? weeklyHoursStats.filter((s) => complianceRows.some((r) => r.position === s.position))
      : [];

    return (
      <div
        key={day.date}
        id={`day-block-${day.date}`}
        className="border border-gray-200 rounded-lg overflow-hidden"
      >
        {/* 日期列 */}
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${day.weekdayIndex === 0 ? 'text-red-500' : 'text-gray-800'}`}>
              {dateLabel}
            </span>
            {holiday && <span className="text-xs text-red-600">({holiday.name})</span>}
          </div>
          <div className="flex items-center gap-2">
            {dayAllOk ? (
              <span className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> 人手達標
              </span>
            ) : (
              <span className="text-xs text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> 人手不足
              </span>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleAutoRoster(day.date)}
                disabled={autoRosterLoading === day.date}
                className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {autoRosterLoading === day.date ? '排班中…' : '一鍵排班'}
              </button>
            )}
          </div>
        </div>

        {/* 當日排班表 */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-32 sticky left-0 bg-gray-50 z-10">
                  班次
                </th>
                {stationColumns.map((station) => (
                  <th
                    key={station?.id ?? 'unassigned'}
                    className="px-2 py-2 text-center font-medium text-gray-600 min-w-[12rem] bg-gray-50"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span>{station?.name ?? (isGlobalTab ? '全域' : '未分區')}</span>
                      <button
                        type="button"
                        onClick={() => canEdit && setEditingStation(station ?? { id: null, name: isGlobalTab ? '全域' : '未分區' })}
                        disabled={!canEdit}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Settings2 className="h-3 w-3" />
                        班次設定
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allShiftNames.map((shiftName) => {
                const shiftLabel = SHIFT_NAME_LABELS[shiftName];
                return (
                  <tr key={`${day.date}-${shiftName}`} className="border-t border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">
                      {shiftLabel}
                    </td>
                  {stationColumns.map((station) => {
                    const stationId = station?.id ?? null;
                    const shift = getStationShift(stationId, shiftName);
                    const key = `${stationId ?? 'unassigned'}|${shiftName}|${day.date}`;
                    const list = assignmentMap.byKey.get(key) || [];
                    // 只顯示屬於當前職位頁的卡片（護士/保健員合併顯示；行政/庶務以實際職位或舊分頁標記匹配）。
                    // 若該員工的真實職位屬於當前分頁（即使 a.position 是舊分頁或其他分頁標記），也顯示，避免工時統計有人但畫面看不到人。
                    const visibleList = list.filter((a) => {
                      const user = users.find((u) => u.id === a.user_id);
                      const userBelongsToTab = user ? userCanFillPosition(user, selectedGridPosition) : false;
                      if (a.position) {
                        if (a.position === selectedGridPosition) return true;
                        if (selectedGridPosition === '護士/保健員' && (
                          a.position === '註冊護士' ||
                          a.position === '登記護士' ||
                          a.position === '保健員' ||
                          a.position === '註冊/登記護士'
                        )) return true;
                        if (selectedGridPosition === '行政' && (a.position === '主管' || a.position === '文員' || a.position === '會計' || a.position === '社工' || a.position === '社工助理' || a.position === '行政')) return true;
                        if (selectedGridPosition === '庶務' && (a.position === '廚師' || a.position === '清潔員' || a.position === '庶務')) return true;
                        return userBelongsToTab;
                      }
                      return userBelongsToTab;
                    });
                    const disabled = !shift;
                    return (
                      <td
                        key={stationId ?? 'unassigned'}
                        className={`px-1 py-1 align-top min-h-[4rem] border-l border-gray-50 ${
                          disabled ? 'bg-gray-100' : 'bg-gray-50/30 hover:bg-blue-50/30'
                        }`}
                        onDragOver={disabled ? undefined : handleDragOver}
                        onDrop={
                          disabled || !shift
                            ? undefined
                            : (e) => handleDrop(e, day.date, stationId, shift)
                        }
                      >
                        <div className="space-y-1 min-h-[3rem]">
                          {visibleList.map((assignment) => {
                            const user = users.find((u) => u.id === assignment.user_id);
                            if (!user) return null;
                            return (
                              <div
                                key={assignment.id}
                                className={`rounded ${assignment.is_overridden ? 'border border-dashed border-red-400 bg-red-50/50 p-0.5' : ''}`}
                              >
                                {assignment.is_overridden && (
                                  <div className="text-[10px] text-red-600 font-medium px-1">待調整</div>
                                )}
                                <RosterShiftCard
                                  user={user}
                                  assignment={assignment}
                                  endTime={getAssignmentEndTime(
                                    assignment,
                                    getDailyContractHours(employmentDetails[user.id]),
                                  )}
                                  readOnly={!canEdit}
                                  onUpdateTime={handleUpdateShiftTime}
                                  onDelete={handleDelete}
                                  onDragStart={() => setDraggedAssignmentId(assignment.id)}
                                  onDragEnd={() => setDraggedAssignmentId(null)}
                                  onDragOverItem={(_, id, before) => setDragOverItem({ id, insertBefore: before })}
                                  onDropItem={(e, id, before) =>
                                    shift ? handleDropOnCard(e, id, before, day.date, stationId, shift) : undefined
                                  }
                                  onDragLeaveItem={() => setDragOverItem(null)}
                                  isDragOver={dragOverItem?.id === assignment.id}
                                  insertBefore={dragOverItem?.id === assignment.id ? dragOverItem.insertBefore : undefined}
                                />
                              </div>
                            );
                          })}
                          {visibleList.length === 0 && !disabled && (
                            <div className="text-[10px] text-gray-300 text-center py-2 border border-dashed border-gray-200 rounded min-h-[2.5rem] flex items-center justify-center">
                              拖入排班
                            </div>
                          )}
                          {disabled && (
                            <div className="text-[10px] text-gray-300 text-center py-2 min-h-[2.5rem] flex items-center justify-center">
                              無此班次
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        {/* 當日人手達標檢查 */}
        <button
          type="button"
          onClick={() => toggleDayExpanded(day.date)}
          className={`w-full px-3 py-2 border-t border-gray-200 flex items-center justify-between ${dayAllOk ? 'bg-green-50' : 'bg-amber-50'}`}
        >
          <div className="flex items-center gap-2">
            {dayAllOk ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
            <span className="text-sm font-semibold text-gray-800">{complianceLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${dayAllOk ? 'text-green-700' : 'text-amber-700'}`}>
              {complianceRows.length > 0 ? (dayAllOk ? '人手達標' : '人手不足') : '無要求'}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </div>
        </button>
        {expanded && (
          <div className="px-3 py-2 border-t border-gray-200 bg-white">
            {complianceRows.length > 0 ? (
              <div className="space-y-1">
                {complianceRows.map((currentRow) => (
                  <div key={currentRow.position} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-medium text-gray-700 min-w-[5rem]">{currentRow.position}</span>
                    {hasContractHours && (
                      <div className={currentRow.hoursOk ? 'text-green-700' : 'text-red-700'}>
                        <span className="font-medium">工時：</span>
                        {currentRow.actualHours.toFixed(1)}/{currentRow.requiredHours.toFixed(1)} h
                        <span className="ml-1 text-[10px]">{currentRow.hoursOk ? '工時達標' : '工時不足'}</span>
                      </div>
                    )}
                    {currentRow.hasSpecificSlotRequirement ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-gray-700">{currentRow.isA1Contract ? '甲一買位：' : '特定鐘點：'}</span>
                        {currentRow.specificSegments.map((s, idx) => {
                          const segOk = s.actual >= s.required;
                          let unit: string;
                          if (currentRow.position === '保健員') unit = '人手';
                          else if (currentRow.position === '註冊/登記護士') unit = '小時';
                          else unit = '人';
                          return (
                            <div
                              key={idx}
                              className={`text-[10px] ${segOk ? 'text-green-700' : 'text-red-700'}`}
                              title={`${s.label} 需要 ${s.required} ${unit}，實際 ${s.actual} ${unit}`}
                            >
                              {segOk ? '✓' : '⚠'} {s.label} {s.actual}/{s.required} {unit} {segOk ? '人手達標' : '人手不足'}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">— 無特定鐘點</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400">該職位當天無要求</div>
            )}
            {weeklyRows.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-1">一周工時統計</p>
                <div className="space-y-1">
                  {weeklyRows.map((s) => (
                    <div key={s.position} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="font-medium text-gray-700 min-w-[5rem]">{s.position}</span>
                      <div className={s.ok ? 'text-green-700' : 'text-red-700'}>
                        <span className="font-medium">本週工時：</span>
                        {s.actual.toFixed(1)}/{s.required.toFixed(1)} h
                        <span className="ml-1 text-[10px]">{s.ok ? '一週達標' : '一週不足'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const requiredHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of dailyRequirements) {
      map[r.position] = r.hours;
    }
    return map;
  }, [dailyRequirements]);

  const requiredHourly = useMemo(() => {
    if (!staffingResult) return {};
    const map: Record<string, number[]> = {};
    for (let c = 0; c < GRID_POSITIONS.length; c++) {
      const pos = GRID_POSITIONS[c];
      map[pos] = Array.from({ length: 24 }, (_, h) => staffingResult.grid[h]?.[c] ?? 0);
    }
    return map;
  }, [staffingResult]);

  const complianceByDay = useMemo(() => {
    return days.map((day) => ({
      date: day.date,
      weekday: day.weekday,
      rows: buildDailyCompliance(
        day.date,
        requiredHoursMap,
        requiredHourly,
        specificHours,
        users,
        employmentDetails,
        shiftAssignments,
      ),
    }));
  }, [days, requiredHoursMap, requiredHourly, specificHours, users, employmentDetails, shiftAssignments]);

  // 一周工時統計：只計買位要求有指定工時的職位，於本週最後一天（星期六）的達標檢查內顯示
  const weeklyHoursStats = useMemo(() => {
    if (!hasContractHours) return [];
    return dailyRequirements
      .filter((r) => r.hours > 0)
      .map((r) => {
        const actual = complianceByDay.reduce((sum, d) => {
          const row = d.rows.find((cr) => cr.position === r.position);
          return sum + (row?.actualHours ?? 0);
        }, 0);
        const required = r.hours * days.length;
        return { position: r.position, actual, required, ok: actual >= required };
      });
  }, [hasContractHours, dailyRequirements, complianceByDay, days]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedPosition}
          onChange={(e) => onPositionChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          {getRosterGroupOptions(users).map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[10rem] text-center">
            {start.getFullYear()}年{start.getMonth() + 1}月{start.getDate()}日 - {end.getMonth() + 1}月{end.getDate()}日
          </span>
          <button
            type="button"
            onClick={handleNextWeek}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {tickerItems.length > 0 && (
          <div className="flex-1 min-w-0">
            <ConflictTicker items={tickerItems} />
          </div>
        )}
      </div>

      {/* 日區塊列表：日期 > 排班表 > 達標檢查 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {allShiftNames.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm border border-gray-200 rounded-lg">
            暫無 {selectedPosition} 的班次設定，請先按「班次設定」新增
          </div>
        ) : (
          days.map((day) => renderDayBlock(day))
        )}
      </div>

      {/* 衝突提示 Modal */}
      <RosterConflictModal
        isOpen={conflictModalOpen}
        conflicts={conflicts}
        users={users}
        onClose={() => setConflictModalOpen(false)}
        onOverride={canEdit ? handleOverrideConflict : undefined}
      />

      {/* 排班與預排衝突 Modal */}
      {pendingRosterInsert && (
        <ConfirmOverrideModal
          isOpen
          title="排班與預排衝突"
          onClose={() => setPendingRosterInsert(null)}
          onConfirm={confirmInsertAssignment}
          confirmLabel="仍要排班"
          secondaryLabel="查看預排表"
          onSecondary={() => {
            setPendingRosterInsert(null);
            onViewLeaveTab?.();
          }}
        >
          <div className="space-y-2">
            <p>
              <span className="font-medium">新增的班次</span>與該員工當日預排重疊：
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                日期：{pendingRosterInsert.conflict.leave_date}
                <br />
                預排：
                {pendingRosterInsert.conflict.record_type === 'leave'
                  ? pendingRosterInsert.conflict.leave_type
                    ? LEAVE_TYPE_LABELS[pendingRosterInsert.conflict.leave_type]
                    : '放假'
                  : `特定上班 ${pendingRosterInsert.conflict.availability_start_time}-${pendingRosterInsert.conflict.availability_end_time}`}
              </li>
            </ul>
            <p className="text-gray-500">
              點擊「仍要排班」會強制寫入，並直接刪除衝突的預排事件（包括 DO/PRD/PH/SH 的相關額度扣減會自動回復）。
            </p>
          </div>
        </ConfirmOverrideModal>
      )}

      {/* 特定上班時間窗口 override Modal */}
      {pendingWindowOverride && (
        <ConfirmOverrideModal
          isOpen
          title="特定上班時間衝突"
          onClose={() => setPendingWindowOverride(null)}
          onConfirm={confirmWindowOverride}
          confirmLabel="仍要排班"
        >
          <div className="space-y-2">
            <p>
              該班次時間超出員工僱傭詳情中設定的「特定上班時間」窗口。
            </p>
            <p className="text-gray-500">
              點擊「仍要排班」會強制寫入此班次；仍可隨後手動調整時間。
            </p>
          </div>
        </ConfirmOverrideModal>
      )}

      {/* 班次設定 Modal */}
      {editingStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{editingStation.name} {selectedPosition} 班次設定</h3>
              <button
                type="button"
                onClick={() => setEditingStation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              {localSettings.map((setting, index) => (
                <div key={setting.shift_name} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm w-24">
                    <input
                      type="checkbox"
                      checked={setting.is_active}
                      onChange={() => toggleShiftActive(index)}
                      className="h-4 w-4"
                    />
                    {SHIFT_NAME_LABELS[setting.shift_name]}
                  </label>
                  <input
                    type="time"
                    value={setting.start_time}
                    onChange={(e) => updateShiftTime(index, e.target.value)}
                    disabled={!setting.is_active}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-400">開始時間</span>
                </div>
              ))}
              {localSettings.length === 0 && (
                <p className="text-sm text-gray-500">暫無班次設定</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button
                type="button"
                onClick={() => setEditingStation(null)}
                disabled={savingSettings}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterScheduleGrid;
