import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type {
  UserProfile,
  UserEmploymentDetails,
  UserShiftAssignment,
  UserLeaveRecord,
  StationShiftSetting,
  EmploymentPosition,
  ShiftName,
  PublicHoliday,
} from '@care-suite/shared';
import { SHIFT_NAME_LABELS, getEmploymentPosition } from '@care-suite/shared';
import { supabase, useAuth } from '../context/AuthContext';
import RosterShiftCard from './RosterShiftCard';
import RosterConflictModal from './RosterConflictModal';
import { generateAutoRoster } from '../utils/autoRoster';
import type { AutoRosterConflict } from '../utils/autoRoster';
import { getWeekRange,
  getWeekDays,
  getActiveShiftSettings,
  buildShiftAssignmentMap,
  getDailyContractHours,
  getAssignmentEndTime,
  getShiftEndTime,
  getDragStartTime,
  buildDailyCompliance,
  toGridPosition,
  normalizeTime,
  type WeekDay,
} from '../utils/roster';
import type { SpecificHoursConfig } from '../utils/facilityNatureSettings';
import { GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { StaffingResult } from '../utils/staffingRequirements';

const ASSISTANT_DEPARTMENTS = new Set(['社工', '膳食', '衛生']);

function userCanFillPosition(user: UserProfile, position: string): boolean {
  const primary = getEmploymentPosition(user);
  if (toGridPosition(primary) === position) return true;
  if ((user.secondary_positions || []).some((p) => toGridPosition(p) === position)) return true;
  if (
    position === '保健員' &&
    (primary === '註冊護士' ||
      primary === '登記護士' ||
      (user.secondary_positions || []).some((p) => p === '註冊護士' || p === '登記護士'))
  ) {
    return true;
  }
  if (position === '助理員' && ASSISTANT_DEPARTMENTS.has(user.department)) return true;
  return false;
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
  selectedPosition: EmploymentPosition;
  dailyRequirements: DailyRequirement[];
  hasContractHours: boolean;
  draggedUserId: string | null;
  leaveRecords: UserLeaveRecord[];
  stationPriority: (string | null)[];
  onWeekChange: (anchor: Date) => void;
  onLeaveRecordsChange?: () => void;
  onPositionChange: (position: EmploymentPosition) => void;
  onAssignmentChange: () => void;
  onSettingsChange: () => void;
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
  const selectedGridPosition = toGridPosition(selectedPosition);

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

  const assignmentMap = useMemo(() => buildShiftAssignmentMap(shiftAssignments), [shiftAssignments]);

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

  // 初始化班次設定編輯狀態，永遠提供早/午/晚三班可選
  useEffect(() => {
    if (editingStation) {
      const existing = getActiveShiftSettings(shiftSettings, editingStation.id, selectedPosition);
      const defaults: { shift_name: ShiftName; start_time: string }[] = [
        { shift_name: '早班', start_time: '07:00' },
        { shift_name: '午班', start_time: '13:00' },
        { shift_name: '晚班', start_time: '22:00' },
      ];
      const merged = defaults.map((d, index) => {
        const found = existing.find((s) => s.shift_name === d.shift_name);
        if (found) return { ...found, sort_order: index + 1 };
        return {
          id: `new-${d.shift_name}`,
          station_id: editingStation.id,
          position: selectedPosition,
          shift_name: d.shift_name,
          start_time: d.start_time,
          is_active: false,
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

    // 從排班表內拖曳：移動或交換班次
    if (sourceAssignmentId) {
      if (!canEdit) return;
      const source = shiftAssignments.find((a) => a.id === sourceAssignmentId);
      if (!source) return;

      // 拖回原位則不處理
      if (
        source.work_date === date &&
        source.station_id === stationId &&
        source.shift_name === shift.shift_name
      ) {
        return;
      }

      const targetKey = `${stationId ?? 'unassigned'}|${shift.shift_name}|${date}`;
      const targetList = assignmentMap.byKey.get(targetKey) || [];
      const target = targetList[0];

      try {
        if (target) {
          // 交換兩個班次
          const now = new Date().toISOString();
          const sourceStartTime = getDragStartTime(employmentDetails[source.user_id], shift.start_time);
          const targetStartTime = getDragStartTime(employmentDetails[target.user_id], source.start_time);
          const sourceEndTime = getEndTimeForUser(source.user_id, sourceStartTime);
          const targetEndTime = getEndTimeForUser(target.user_id, targetStartTime);
          const sourceUpdate = {
            work_date: date,
            station_id: stationId,
            shift_name: shift.shift_name,
            position: selectedGridPosition,
            start_time: sourceStartTime,
            end_time: sourceEndTime,
            updated_at: now,
          };
          const targetUpdate = {
            work_date: source.work_date,
            station_id: source.station_id,
            shift_name: source.shift_name,
            position: source.position,
            start_time: targetStartTime,
            end_time: targetEndTime,
            updated_at: now,
          };
          const e1 = await withEndTimeFallback(
            async () => await supabase.from('user_shift_assignments').update(sourceUpdate).eq('id', source.id),
            async () => await supabase.from('user_shift_assignments').update(withoutEndTime(sourceUpdate)).eq('id', source.id),
          );
          const e2 = await withEndTimeFallback(
            async () => await supabase.from('user_shift_assignments').update(targetUpdate).eq('id', target.id),
            async () => await supabase.from('user_shift_assignments').update(withoutEndTime(targetUpdate)).eq('id', target.id),
          );
          if (e1) throw e1;
          if (e2) throw e2;
        } else {
          // 移動到空白時段
          const sourceStartTime = getDragStartTime(employmentDetails[source.user_id], shift.start_time);
          const endTime = getEndTimeForUser(source.user_id, sourceStartTime);
          const updatePayload = {
            work_date: date,
            station_id: stationId,
            shift_name: shift.shift_name,
            position: selectedGridPosition,
            start_time: sourceStartTime,
            end_time: endTime,
            updated_at: new Date().toISOString(),
          };
          const error = await withEndTimeFallback(
            async () => await supabase.from('user_shift_assignments').update(updatePayload).eq('id', source.id),
            async () => await supabase.from('user_shift_assignments').update(withoutEndTime(updatePayload)).eq('id', source.id),
          );
          if (error) throw error;
        }
        onAssignmentChange();
      } catch (err) {
        console.error('移動/交換班次失敗:', err);
        alert(getSupabaseErrorMessage(err, '移動/交換班次失敗'));
      }
      return;
    }

    // 從左側員工列拖曳：新增班次
    if (!sourceUserId) return;
    if (!canEdit) return;

    const sourceUser = users.find((u) => u.id === sourceUserId);
    if (!sourceUser) return;
    if (!userCanFillPosition(sourceUser, selectedGridPosition)) {
      alert('該員工職位不符合此排班表');
      return;
    }

    const targetKey = `${stationId ?? 'unassigned'}|${shift.shift_name}|${date}`;
    const existingInCell = assignmentMap.byKey.get(targetKey)?.some((a) => a.user_id === sourceUserId);
    if (existingInCell) {
      alert('該員工在該時段已有班次');
      return;
    }

    try {
      const sourceStartTime = getDragStartTime(employmentDetails[sourceUserId], shift.start_time);
      const endTime = getEndTimeForUser(sourceUserId, sourceStartTime);
      const insertPayload = {
        user_id: sourceUserId,
        work_date: date,
        station_id: stationId,
        position: selectedGridPosition,
        shift_name: shift.shift_name,
        start_time: sourceStartTime,
        end_time: endTime,
        created_by: userProfile?.id ?? null,
      };
      const error = await withEndTimeFallback(
        async () => await supabase.from('user_shift_assignments').insert(insertPayload),
        async () => await supabase.from('user_shift_assignments').insert(withoutEndTime(insertPayload)),
      );
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('新增班次失敗:', err);
      alert(getSupabaseErrorMessage(err, '新增班次失敗'));
    }
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
        position: selectedGridPosition,
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

  const stationColumns = useMemo<(Station | null)[]>(() => [...stations, null], [stations]);

  const allShiftNames = useMemo<ShiftName[]>(() => {
    const set = new Set<ShiftName>();
    for (const station of stationColumns) {
      const id = station?.id ?? null;
      for (const s of getActiveShiftSettings(shiftSettings, id, selectedPosition)) {
        set.add(s.shift_name);
      }
    }
    const order: ShiftName[] = ['早班', '午班', '晚班'];
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
    const currentRow = dayCompliance?.rows.find((r) => r.position === selectedGridPosition);
    const dayAllOk = !currentRow || (hasContractHours ? currentRow.hoursOk && currentRow.specificSlotOk : currentRow.specificSlotOk);
    const expanded = complianceExpanded.has(day.date);

    return (
      <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
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
                      <span>{station?.name ?? '未分區'}</span>
                      <button
                        type="button"
                        onClick={() => canEdit && setEditingStation(station ?? { id: null, name: '未分區' })}
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
              {allShiftNames.map((shiftName) => (
                <tr key={`${day.date}-${shiftName}`} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">
                    {SHIFT_NAME_LABELS[shiftName]}
                  </td>
                  {stationColumns.map((station) => {
                    const stationId = station?.id ?? null;
                    const shift = getStationShift(stationId, shiftName);
                    const key = `${stationId ?? 'unassigned'}|${shiftName}|${day.date}`;
                    const list = assignmentMap.byKey.get(key) || [];
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
                          {list.map((assignment) => {
                            const user = users.find((u) => u.id === assignment.user_id);
                            if (!user) return null;
                            return (
                              <RosterShiftCard
                                key={assignment.id}
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
                              />
                            );
                          })}
                          {list.length === 0 && !disabled && (
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
              ))}
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
            <span className="text-sm font-semibold text-gray-800">當日人手達標檢查</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${dayAllOk ? 'text-green-700' : 'text-amber-700'}`}>
              {currentRow ? (dayAllOk ? '人手達標' : '人手不足') : '無要求'}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </div>
        </button>
        {expanded && (
          <div className="px-3 py-2 border-t border-gray-200 bg-white">
            {currentRow ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {hasContractHours && (
                  <div className={currentRow.hoursOk ? 'text-green-700' : 'text-red-700'}>
                    <span className="font-medium">工時：</span>
                    {currentRow.actualHours.toFixed(1)}/{currentRow.requiredHours.toFixed(1)} h
                    <span className="ml-1 text-[10px]">{currentRow.hoursOk ? '工時達標' : '工時不足'}</span>
                  </div>
                )}
                {currentRow.hasSpecificSlotRequirement ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-700">特定鐘點：</span>
                    {currentRow.specificSegments.map((s, idx) => {
                      const segOk = s.actual >= s.required;
                      let unit: string;
                      if (currentRow.position === '保健員') unit = '當量';
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
            ) : (
              <div className="text-xs text-gray-400">該職位當天無要求</div>
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedPosition}
          onChange={(e) => onPositionChange(e.target.value as EmploymentPosition)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          {Array.from(new Set(users.map((u) => toGridPosition(getEmploymentPosition(u))).filter((p): p is EmploymentPosition => !!p))).map((pos) => (
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
