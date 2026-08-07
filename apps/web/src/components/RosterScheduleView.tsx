import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile, UserEmploymentDetails, UserLeaveRecord, PublicHoliday, EmploymentPosition, UserShiftAssignment } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS, getEmploymentPosition } from '@care-suite/shared';
import { AlertCircle, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { getRosterUserBalance, getPositionOptions, toGridPosition, buildDailyCompliance } from '../utils/roster';
import type { ComplianceRow } from '../utils/roster';
import type { SpecificHoursConfig } from '../utils/facilityNatureSettings';
import { GRID_POSITIONS } from '../utils/facilityNatureSettings';
import type { StaffingResult } from '../utils/staffingRequirements';

interface RosterScheduleViewProps {
  year: number;
  month: number;
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  leaveRecords: UserLeaveRecord[];
  publicHolidays: PublicHoliday[];
  shiftAssignments: UserShiftAssignment[];
  specificHours: SpecificHoursConfig;
  staffingResult: StaffingResult | null;
  dailyRequirements: { position: string; hours: number; peakHeadcount: number }[];
  hasContractHours: boolean;
  stations: { id: string; name: string }[];
  stationPriority: (string | null)[];
  onStationPriorityChange: (priority: (string | null)[]) => void;
  currentUserId: string;
  isAdmin: boolean;
  loading?: boolean;
  onCellClick: (user: UserProfile, date: string) => void;
  onLeaveClick: (record: UserLeaveRecord) => void;
  onMoveLeave?: (record: UserLeaveRecord, targetDate: string) => void;
  onCheckConflicts?: () => void;
}

const LEAVE_BADGE_COLORS: Record<NonNullable<UserLeaveRecord['leave_type']>, string> = {
  AL: 'bg-green-500',
  PRD: 'bg-blue-500',
  DO: 'bg-purple-400',
  SL: 'bg-red-500',
  CL: 'bg-orange-400',
  NPL: 'bg-gray-400',
  PH: 'bg-yellow-400',
  SH: 'bg-pink-400',
};

const ASSISTANT_DEPARTMENTS = new Set(['社工', '膳食', '衛生']);

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function userMatchesPositionFilter(user: UserProfile, filter: string): boolean {
  if (!filter) return true;
  const primary = getEmploymentPosition(user);
  if (toGridPosition(primary) === filter) return true;
  if ((user.secondary_positions || []).some((p) => toGridPosition(p) === filter)) return true;
  if (filter === '助理員' && ASSISTANT_DEPARTMENTS.has(user.department)) return true;
  return false;
}

function buildComplianceTooltip(row: ComplianceRow, hasContractHours: boolean): string {
  const parts: string[] = [];
  if (hasContractHours) {
    const hoursIcon = row.hoursOk ? '✓' : '⚠';
    const hoursSuffix = row.hoursOk ? '' : ' 工時不足';
    parts.push(`工時：${hoursIcon} ${row.actualHours.toFixed(1)}/${row.requiredHours.toFixed(1)} hr${hoursSuffix}`);
  }
  if (row.hasSpecificSlotRequirement) {
    const slotIcon = row.specificSlotOk ? '✓' : '⚠';
    const segments = row.specificSegments
      .map((s) => `${s.label} ${s.actual}/${s.required} 人`)
      .join('；');
    parts.push(`特定鐘點：${slotIcon} ${segments}`);
  } else {
    parts.push('特定鐘點：— 無特定鐘點');
  }
  return parts.join(' ');
}

function userDisplayPositions(user: UserProfile): string {
  const primary = getEmploymentPosition(user);
  const parts: string[] = [];
  if (primary) parts.push(primary);
  const secondary = (user.secondary_positions || []).filter((p) => p !== primary);
  if (secondary.length) parts.push(...secondary);
  if (parts.length === 0 && user.department) parts.push(user.department);
  return parts.join('、') || '未設定';
}

export const RosterScheduleView: React.FC<RosterScheduleViewProps> = ({
  year,
  month,
  users,
  employmentDetails,
  leaveRecords,
  publicHolidays,
  shiftAssignments,
  specificHours,
  staffingResult,
  dailyRequirements,
  hasContractHours,
  stations,
  stationPriority,
  onStationPriorityChange,
  currentUserId,
  isAdmin,
  loading,
  onCellClick,
  onLeaveClick,
  onMoveLeave,
  onCheckConflicts,
}) => {
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const [positionFilter, setPositionFilter] = useState<EmploymentPosition | ''>('');
  const [draggedRecord, setDraggedRecord] = useState<UserLeaveRecord | null>(null);

  // 防止拖曳放開時觸發瀏覽器預設導航（導致整頁重新載入）
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const leaveMap = useMemo(() => {
    const map = new Map<string, UserLeaveRecord>();
    for (const record of leaveRecords) {
      map.set(`${record.user_id}|${record.leave_date}`, record);
    }
    return map;
  }, [leaveRecords]);

  const visibleUsers = useMemo(() => {
    if (!isAdmin) return users.filter((u) => u.id === currentUserId);
    if (!positionFilter) return users;
    return users.filter((u) => userMatchesPositionFilter(u, positionFilter));
  }, [users, isAdmin, currentUserId, positionFilter]);

  const positionOptions = useMemo(() => getPositionOptions(users), [users]);

  const requiredHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of dailyRequirements) map[r.position] = r.hours;
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
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const date = formatDate(year, month, d);
      return {
        date,
        rows: buildDailyCompliance(
          date,
          requiredHoursMap,
          requiredHourly,
          specificHours,
          users,
          employmentDetails,
          shiftAssignments,
        ),
      };
    });
  }, [daysInMonth, year, month, requiredHoursMap, requiredHourly, specificHours, users, employmentDetails, shiftAssignments]);

  const compliancePositions = useMemo(() => {
    const set = new Set<string>();
    for (const day of complianceByDay) {
      for (const row of day.rows) set.add(row.position);
    }
    // 保持穩定順序：先 dailyRequirements 有的，再其他
    const result: string[] = [];
    for (const r of dailyRequirements) if (set.has(r.position)) result.push(r.position);
    for (const p of Array.from(set).sort()) if (!result.includes(p)) result.push(p);
    return result;
  }, [complianceByDay, dailyRequirements]);

  const handleMoveStation = (index: number, direction: -1 | 1) => {
    const next = [...stationPriority];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onStationPriorityChange(next);
  };

  const stationName = (id: string | null) => {
    if (id === null) return '未分區';
    return stations.find((s) => s.id === id)?.name ?? id;
  };

  if (loading) {
    return <p className="text-sm text-gray-500">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      {/* 主管控制列 */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">職位過濾</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as EmploymentPosition | '')}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">居住區優先順序</label>
            <div className="flex items-center gap-1">
              {stationPriority.map((id, index) => (
                <div key={id ?? 'unassigned'} className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-2 py-1">
                  <span className="text-xs text-gray-700">{stationName(id)}</span>
                  <div className="flex flex-col ml-1">
                    <button
                      type="button"
                      onClick={() => handleMoveStation(index, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="上移"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStation(index, 1)}
                      disabled={index === stationPriority.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="下移"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {onCheckConflicts && (
            <button
              type="button"
              onClick={onCheckConflicts}
              className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
            >
              檢查衝突
            </button>
          )}
        </div>
      )}

      {/* 每日職位達標概覽 */}
      {isAdmin && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">每日職位達標概覽</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-[6rem]">
                    職位 \ 日
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="px-1 py-2 text-center font-medium text-gray-600 min-w-[1.8rem]">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compliancePositions.map((position) => (
                  <tr key={position} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 font-medium text-gray-700 sticky left-0 bg-white">{position}</td>
                    {complianceByDay.map((day) => {
                      const row = day.rows.find((r) => r.position === position);
                      const ok = !row || (hasContractHours ? row.hoursOk && row.specificSlotOk : row.specificSlotOk);
                      return (
                        <td key={day.date} className="px-1 py-1.5 text-center">
                          {row ? (
                            ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                            ) : (
                              <span title={buildComplianceTooltip(row, hasContractHours)} className="inline-block">
                                <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />
                              </span>
                            )
                          ) : (
                            <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-100" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {compliancePositions.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="px-4 py-4 text-center text-gray-400">
                      暫無職位達標資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 員工預排表 */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-[8rem]">
                員工
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-[8rem] bg-gray-50 min-w-[10rem]">
                額度
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const date = new Date(year, month - 1, d);
                const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
                const isSunday = date.getDay() === 0;
                return (
                  <th
                    key={d}
                    className={`px-1 py-2 text-center font-semibold min-w-[2.5rem] border border-gray-300 bg-white ${
                      isSunday ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    <div>{d}</div>
                    <div className="text-[10px]">{weekday}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 2} className="px-4 py-6 text-center text-gray-400">
                  暫無適用職位員工
                </td>
              </tr>
            )}
            {visibleUsers.map((user) => {
              const balance = getRosterUserBalance(user.id, employmentDetails, leaveRecords, publicHolidays, year, month);
              return (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white min-w-[8rem]">
                    <div>{user.name_zh}</div>
                    <div className="text-[10px] text-gray-500 font-normal">{userDisplayPositions(user)}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 sticky left-[8rem] bg-white min-w-[10rem]">
                    <div className="space-y-0.5">
                      <div>DO {balance.doBalance >= 0 ? `+${balance.doBalance}` : balance.doBalance}</div>
                      <div>PRD {balance.prdBalance >= 0 ? `+${balance.prdBalance}` : balance.prdBalance}</div>
                      {employmentDetails[user.id]?.public_holiday_type === 'PH' && (
                        <div>PH {balance.phBalance >= 0 ? `+${balance.phBalance}` : balance.phBalance}</div>
                      )}
                      {employmentDetails[user.id]?.public_holiday_type === 'SH' && (
                        <div>SH {balance.shBalance >= 0 ? `+${balance.shBalance}` : balance.shBalance}</div>
                      )}
                      <div>AL {balance.alBalance >= 0 ? `+${balance.alBalance}` : balance.alBalance}</div>
                    </div>
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dateStr = formatDate(year, month, d);
                    const record = leaveMap.get(`${user.id}|${dateStr}`);
                    const canEdit = isAdmin || user.id === currentUserId;
                    const recordTitle = record
                      ? record.record_type === 'leave'
                        ? `${dateStr} ${record.leave_type ? LEAVE_TYPE_LABELS[record.leave_type] : ''}${record.urgency === 'mandatory' ? '（必須）' : ''}`
                        : `${dateStr} 特定上班 ${record.availability_start_time}-${record.availability_end_time}${record.urgency === 'mandatory' ? '（必須）' : ''}`
                      : '';
                    const isDropTarget = draggedRecord && !record && draggedRecord.user_id === user.id && draggedRecord.leave_date !== dateStr;
                    return (
                      <td
                        key={d}
                        className={`px-0 py-1 text-center align-middle border border-gray-200 ${
                          isDropTarget ? 'bg-blue-50' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = isDropTarget ? 'move' : 'none';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isDropTarget && onMoveLeave) {
                            onMoveLeave(draggedRecord, dateStr);
                          }
                          setDraggedRecord(null);
                        }}
                      >
                        {record ? (
                          <button
                            type="button"
                            draggable={canEdit}
                            onDragStart={(e) => {
                              setDraggedRecord(record);
                              e.dataTransfer.setData('application/x-roster-leave-id', record.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedRecord(null)}
                            onClick={() => canEdit && onLeaveClick(record)}
                            disabled={!canEdit}
                            className={`inline-flex items-center justify-center min-w-[1.75rem] h-6 rounded-sm text-[10px] text-white font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                              record.record_type === 'leave' && record.leave_type
                                ? LEAVE_BADGE_COLORS[record.leave_type]
                                : 'bg-blue-400'
                            }`}
                            title={recordTitle}
                            aria-label={recordTitle}
                          >
                            {record.record_type === 'leave' ? (
                              <span className="flex items-center gap-0.5 px-1">
                                {record.leave_type}
                                {record.urgency === 'mandatory' && <span className="text-[8px]">⚡</span>}
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 px-1">
                                {record.availability_start_time?.slice(0, 2)}-{record.availability_end_time?.slice(0, 2)}
                                {record.urgency === 'mandatory' && <span className="text-[8px]">⚡</span>}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => canEdit && onCellClick(user, dateStr)}
                            disabled={!canEdit}
                            className={`w-6 h-6 rounded-sm inline-block border border-gray-300 bg-white disabled:opacity-30 disabled:cursor-not-allowed ${
                              isDropTarget ? 'bg-blue-100 hover:bg-blue-200 border-blue-300' : 'hover:bg-gray-100'
                            }`}
                            aria-label={`${user.name_zh} ${dateStr} 預排`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RosterScheduleView;
