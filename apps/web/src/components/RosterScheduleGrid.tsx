import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import type {
  UserProfile,
  UserEmploymentDetails,
  UserShiftAssignment,
  StationShiftSetting,
  EmploymentPosition,
} from '@care-suite/shared';
import { SHIFT_NAME_LABELS, getEmploymentPosition } from '@care-suite/shared';
import { supabase, useAuth } from '../context/AuthContext';
import RosterShiftCard from './RosterShiftCard';
import { getWeekRange,
  getWeekDays,
  getActiveShiftSettings,
  buildShiftAssignmentMap,
  getDailyContractHours,
  getShiftEndTime,
  buildDailyCompliance,
  toGridPosition,
} from '../utils/roster';
import type { SpecificHoursConfig } from '../utils/facilityNatureSettings';
import { GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { StaffingResult } from '../utils/staffingRequirements';

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
  draggedUserId: string | null;
  onWeekChange: (anchor: Date) => void;
  onPositionChange: (position: EmploymentPosition) => void;
  onAssignmentChange: () => void;
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
  draggedUserId,
  onWeekChange,
  onPositionChange,
  onAssignmentChange,
}) => {
  const { userProfile } = useAuth();
  const { start, end } = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const days = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
  const [editingStation, setEditingStation] = useState<Station | { id: null; name: string } | null>(null);
  const [localSettings, setLocalSettings] = useState<StationShiftSetting[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [complianceExpanded, setComplianceExpanded] = useState(true);

  const assignmentMap = useMemo(() => buildShiftAssignmentMap(shiftAssignments), [shiftAssignments]);

  // 初始化班次設定編輯狀態
  useEffect(() => {
    if (editingStation) {
      setLocalSettings(getActiveShiftSettings(shiftSettings, editingStation.id).map((s) => ({ ...s })));
    }
  }, [editingStation, shiftSettings]);

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
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (
    e: React.DragEvent,
    date: string,
    stationId: string | null,
    shift: StationShiftSetting,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const userId = draggedUserId || e.dataTransfer.getData('userId') || e.dataTransfer.getData('text/plain');
    if (!userId) return;

    const existing = assignmentMap.byUserDate.get(`${userId}|${date}`);
    if (existing) {
      alert('該員工當日已有班次');
      return;
    }

    try {
      const { error } = await supabase.from('user_shift_assignments').insert({
        user_id: userId,
        work_date: date,
        station_id: stationId,
        shift_name: shift.shift_name,
        start_time: shift.start_time,
        created_by: userProfile?.id ?? null,
      });
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('新增班次失敗:', err);
      alert(err instanceof Error ? err.message : '新增班次失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定移除這個班次？')) return;
    try {
      const { error } = await supabase.from('user_shift_assignments').delete().eq('id', id);
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('刪除班次失敗:', err);
      alert('刪除班次失敗');
    }
  };

  const handleUpdateStartTime = async (id: string, startTime: string) => {
    try {
      const { error } = await supabase
        .from('user_shift_assignments')
        .update({ start_time: startTime, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      onAssignmentChange();
    } catch (err) {
      console.error('更新班次時間失敗:', err);
      alert('更新班次時間失敗');
    }
  };

  const handleSaveSettings = async () => {
    if (!editingStation) return;
    setSavingSettings(true);
    try {
      const stationId = editingStation.id;
      const deleteQuery =
        stationId === null
          ? supabase.from('station_shift_settings').delete().is('station_id', null)
          : supabase.from('station_shift_settings').delete().eq('station_id', stationId);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      const inserts = localSettings
        .filter((s) => s.is_active)
        .map((s, i) => ({
          station_id: stationId,
          shift_name: s.shift_name,
          start_time: s.start_time,
          is_active: true,
          sort_order: i + 1,
        }));
      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('station_shift_settings').insert(inserts);
        if (insertError) throw insertError;
      }
      onAssignmentChange();
      setEditingStation(null);
    } catch (err) {
      console.error('儲存班次設定失敗:', err);
      alert(err instanceof Error ? err.message : '儲存班次設定失敗');
    } finally {
      setSavingSettings(false);
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

  const renderStationBlock = (station: Station | null) => {
    const stationId = station?.id ?? null;
    const stationName = station?.name ?? '未分區';
    const activeShifts = getActiveShiftSettings(shiftSettings, stationId);

    if (activeShifts.length === 0) return null;

    return (
      <div key={stationId ?? 'unassigned'} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">{stationName}</span>
          <button
            type="button"
            onClick={() => setEditingStation(station ?? { id: null, name: '未分區' })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Settings2 className="h-3.5 w-3.5" />
            班次設定
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-2 text-left font-medium text-gray-600 w-24 sticky left-0 bg-gray-50">班次</th>
                {days.map((day) => (
                  <th
                    key={day.date}
                    className={`px-2 py-2 text-center font-medium text-gray-600 min-w-[10rem] ${day.weekdayIndex === 0 ? 'text-red-500' : ''}`}
                  >
                    <div>{day.weekday}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{day.dayOfMonth}日</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeShifts.map((shift) => (
                <tr key={shift.shift_name} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                    <div>{SHIFT_NAME_LABELS[shift.shift_name]}</div>
                    <div className="text-[10px] text-gray-400">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {shift.start_time} 起
                    </div>
                  </td>
                  {days.map((day) => {
                    const key = `${stationId ?? 'unassigned'}|${shift.shift_name}|${day.date}`;
                    const list = assignmentMap.byKey.get(key) || [];
                    return (
                      <td
                        key={day.date}
                        className="px-1 py-1 align-top min-h-[4rem] border-l border-gray-50 bg-gray-50/30 hover:bg-blue-50/30"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.date, stationId, shift)}
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
                                endTime={getShiftEndTime(assignment.start_time, getDailyContractHours(employmentDetails[user.id]))}
                                onUpdateTime={handleUpdateStartTime}
                                onDelete={handleDelete}
                              />
                            );
                          })}
                          {list.length === 0 && (
                            <div className="text-[10px] text-gray-300 text-center py-2 border border-dashed border-gray-200 rounded min-h-[2.5rem] flex items-center justify-center">
                              拖入排班
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

  const allOk = useMemo(
    () => complianceByDay.every((day) => day.rows.every((r) => r.hoursOk && r.specificSlotOk)),
    [complianceByDay],
  );

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

      {/* 排班區 */}
      <div className="flex-1 overflow-y-auto pr-2 mb-4">
        {renderStationBlock(null)}
        {stations.map((station) => renderStationBlock(station))}
      </div>

      {/* 本週人手達標檢查 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setComplianceExpanded((v) => !v)}
          className={`w-full px-3 py-2 border-b border-gray-200 flex items-center justify-between ${allOk ? 'bg-green-50' : 'bg-amber-50'}`}
        >
          <div className="flex items-center gap-2">
            {allOk ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
            <span className="text-sm font-semibold text-gray-800">本週人手達標檢查（雙紅線）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${allOk ? 'text-green-700' : 'text-amber-700'}`}>
              {allOk ? '全部達標' : '有未達標項目'}
            </span>
            {complianceExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </div>
        </button>
        {complianceExpanded && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-24 sticky left-0 bg-gray-50">職位</th>
                  {complianceByDay.map((day) => (
                    <th key={day.date} className={`px-2 py-1.5 text-center font-medium text-gray-600 min-w-[8rem] ${day.weekday === '日' ? 'text-red-500' : ''}`}>
                      <div>{day.weekday}</div>
                      <div className="text-[10px] text-gray-400">{day.date.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const positions = new Set<string>();
                  for (const day of complianceByDay) {
                    for (const row of day.rows) positions.add(row.position);
                  }
                  return Array.from(positions).map((position) => (
                    <tr key={position} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-medium text-gray-700 sticky left-0 bg-white">{position}</td>
                      {complianceByDay.map((day) => {
                        const row = day.rows.find((r) => r.position === position);
                        if (!row) return <td key={day.date} className="px-2 py-1.5 text-center text-gray-300">—</td>;
                        return (
                          <td key={day.date} className="px-2 py-1.5 text-center">
                            <div className={row.hoursOk ? 'text-green-700' : 'text-red-700'}>
                              <span className="font-medium">{row.actualHours.toFixed(1)}/{row.requiredHours.toFixed(1)} h</span>
                              {!row.hoursOk && <span className="ml-1 text-[10px]">工時不足</span>}
                            </div>
                            {row.hasSpecificSlotRequirement ? (
                              <div className="space-y-0.5">
                                {row.specificSegments.map((s, idx) => {
                                  const segOk = s.actual >= s.required;
                                  return (
                                    <div
                                      key={idx}
                                      className={`text-[10px] ${segOk ? 'text-green-700' : 'text-red-700'}`}
                                      title={`${s.label} 需要 ${s.required} 人，實際 ${s.actual} 人`}
                                    >
                                      {segOk ? '✓' : '⚠'} {s.label} {s.actual}/{s.required} 人
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-400">— 無特定鐘點</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 班次設定 Modal */}
      {editingStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{editingStation.name} 班次設定</h3>
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
