import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile, UserEmploymentDetails, UserLeaveRecord, PublicHoliday, UserShiftAssignment } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS, getEmploymentPosition } from '@care-suite/shared';
import { AlertCircle, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { getRosterUserBalance, getRosterGroupOptions, buildDailyCompliance, buildPreScheduleDailyCompliance, formatShiftTimeAbbreviation, getShiftEndTime, getAssignmentPositionForTable, toGridPosition } from '../utils/roster';
import type { ComplianceRow, PreScheduleSegmentConflict } from '../utils/roster';
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
  complianceMode?: 'actual' | 'preSchedule';
  preScheduleConflicts?: PreScheduleSegmentConflict[];
  getUserFullBalances?: (userId: string) => {
    doBalance: number;
    doAccumulated: number;
    doEstimated: number;
    restDayFraction: number;
    prdExpected: number;
    prdEstimated: number;
    phAvailable: number;
    phAccumulated: number;
    phEstimated: number;
    shAvailable: number;
    shAccumulated: number;
    shEstimated: number;
    alBalance: number;
    alAccumulated: number;
    alEstimated: number;
    whb: number;
  } | null;
}

const LEAVE_BADGE_COLORS: Record<NonNullable<UserLeaveRecord['leave_type']>, string> = {
  AL: 'bg-green-500',
  PRD: 'bg-blue-500',
  DO: 'bg-purple-400',
  SL: 'bg-red-500',
  NPL: 'bg-gray-400',
  PH: 'bg-yellow-400',
  SH: 'bg-pink-400',
};



function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const signed = (n: number): string => String(n);

/** WHB 顯示：正數不帶 +，負數帶 − */
const whbSigned = (n: number): string => (n >= 0 ? String(n) : String(n));

const isPartTime = (user: UserProfile): boolean => user.employment_type === '兼職';

function userMatchesPositionFilter(user: UserProfile, filter: string): boolean {
  if (!filter) return true;
  return getAssignmentPositionForTable(user, filter) !== null;
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
    parts.push(`${row.isA1Contract ? '甲一買位' : '特定鐘點'}：${slotIcon} ${segments}`);
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
  complianceMode = 'actual',
  getUserFullBalances,
}) => {
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const [positionFilter, setPositionFilter] = useState<string>('');
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

  const holidayMap = useMemo(() => {
    const map = new Map<string, PublicHoliday>();
    for (const h of publicHolidays) map.set(h.holiday_date, h);
    return map;
  }, [publicHolidays]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, UserShiftAssignment[]>();
    for (const assignment of shiftAssignments) {
      const key = `${assignment.user_id}|${assignment.work_date}`;
      const list = map.get(key) || [];
      list.push(assignment);
      map.set(key, list);
    }
    return map;
  }, [shiftAssignments]);

  const visibleUsers = useMemo(() => {
    const base = !isAdmin
      ? users.filter((u) => u.id === currentUserId)
      : !positionFilter
        ? users
        : users.filter((u) => userMatchesPositionFilter(u, positionFilter));
    // 按職位排序：註冊護士 > 登記護士 > 保健員 > 其他（同級保持原順序）
    const rank = (u: UserProfile): number => {
      const p = getEmploymentPosition(u);
      if (p === '註冊護士') return 0;
      if (p === '登記護士') return 1;
      if (p === '保健員') return 2;
      return 3;
    };
    return base
      .map((u, i) => ({ u, i }))
      .sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i)
      .map(({ u }) => u);
  }, [users, isAdmin, currentUserId, positionFilter]);

  const positionOptions = useMemo(() => getRosterGroupOptions(users), [users]);

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
      const rows =
        complianceMode === 'preSchedule'
          ? buildPreScheduleDailyCompliance(
              date,
              requiredHoursMap,
              requiredHourly,
              specificHours,
              users,
              employmentDetails,
              leaveRecords,
            )
          : buildDailyCompliance(
              date,
              requiredHoursMap,
              requiredHourly,
              specificHours,
              users,
              employmentDetails,
              shiftAssignments,
            );
      return {
        date,
        rows,
      };
    });
  }, [
    daysInMonth,
    year,
    month,
    requiredHoursMap,
    requiredHourly,
    specificHours,
    users,
    employmentDetails,
    shiftAssignments,
    leaveRecords,
    complianceMode,
  ]);

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

  // 職位過濾同時套用於侯召概覽（只顯示對應職位列；達標數據仍以全體員工計算）
  const visibleCompliancePositions = useMemo(() => {
    if (!positionFilter) return compliancePositions;
    if (positionFilter === '行政' || positionFilter === '庶務') return [];
    if (positionFilter === '護士/保健員') {
      return compliancePositions.filter((p) => p === '註冊/登記護士' || p === '保健員');
    }
    const grid = toGridPosition(positionFilter);
    return compliancePositions.filter((p) => p === grid);
  }, [compliancePositions, positionFilter]);

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
              onChange={(e) => setPositionFilter(e.target.value)}
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

      {/* 每日職位侯召概覽 */}
      {isAdmin && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">每日職位侯召概覽</div>
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
                {visibleCompliancePositions.map((position) => (
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
                {visibleCompliancePositions.length === 0 && (
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
      <div className="max-h-[75vh] overflow-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 sticky top-0 left-0 z-30 bg-gray-50 min-w-[8rem]">
                員工
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 sticky top-0 left-[8rem] z-30 bg-gray-50 min-w-[4rem]">
                累積
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 sticky top-0 z-10 bg-gray-50 min-w-[4rem]">
                預計{month}月收穫
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const date = new Date(year, month - 1, d);
                const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
                const isSunday = date.getDay() === 0;
                const holiday = holidayMap.get(formatDate(year, month, d));
                return (
                  <th
                    key={d}
                    className={`px-1 py-2 text-center font-semibold min-w-[3rem] border border-gray-300 sticky top-0 z-10 bg-gray-50 ${
                      isSunday || holiday ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    <div>{d}</div>
                    <div className="text-[10px]">{weekday}</div>
                    {holiday && (
                      <div
                        className="text-[9px] leading-tight text-red-600 font-normal"
                        title={`${holiday.name}（${holiday.type === 'SH' ? '勞工假期' : '銀行假期'}）`}
                      >
                        {holiday.name}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 3} className="px-4 py-6 text-center text-gray-400">
                  暫無適用職位員工
                </td>
              </tr>
            )}
            {visibleUsers.map((user) => {
              const full = getUserFullBalances?.(user.id);
              const monthly = getRosterUserBalance(user.id, employmentDetails, leaveRecords, publicHolidays, year, month);
              const balance = full
                ? {
                    doBalance: full.doBalance,
                    prdBalance: full.restDayFraction,
                    phBalance: full.phAvailable,
                    shBalance: full.shAvailable,
                    alBalance: full.alBalance,
                  }
                : monthly;
              return (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white min-w-[8rem]">
                    <div>{user.name_zh}</div>
                    <div className="text-[10px] text-gray-500 font-normal">{userDisplayPositions(user)}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-600 sticky left-[8rem] bg-white min-w-[4rem]">
                    {full ? (
                      isPartTime(user) ? (
                        <span className="text-gray-400">兼職不適用</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div>DO {signed(full.doAccumulated)}</div>
                          <div>PRD {signed(full.restDayFraction)}</div>
                          {employmentDetails[user.id]?.public_holiday_type === 'PH' && (
                            <div>PH {signed(full.phAccumulated)}</div>
                          )}
                          {employmentDetails[user.id]?.public_holiday_type === 'SH' && (
                            <div>SH {signed(full.shAccumulated)}</div>
                          )}
                          <div>AL {signed(full.alAccumulated)}</div>
                          <div className="text-blue-600">WHB {whbSigned(full.whb)}</div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-0.5">
                        <div>DO {signed(balance.doBalance)}</div>
                        <div>PRD {signed(balance.prdBalance)}</div>
                        {employmentDetails[user.id]?.public_holiday_type === 'PH' && (
                          <div>PH {signed(balance.phBalance)}</div>
                        )}
                        {employmentDetails[user.id]?.public_holiday_type === 'SH' && (
                          <div>SH {signed(balance.shBalance)}</div>
                        )}
                        <div>AL {signed(balance.alBalance)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-600 bg-white min-w-[4rem]">
                    {full ? (
                      isPartTime(user) ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {full.doEstimated !== 0 && <div>DO {signed(full.doEstimated)}</div>}
                          {full.prdEstimated !== 0 && <div>PRD {signed(full.prdEstimated)}</div>}
                          {employmentDetails[user.id]?.public_holiday_type === 'PH' && full.phEstimated !== 0 && (
                            <div>PH {signed(full.phEstimated)}</div>
                          )}
                          {employmentDetails[user.id]?.public_holiday_type === 'SH' && full.shEstimated !== 0 && (
                            <div>SH {signed(full.shEstimated)}</div>
                          )}
                          {full.alEstimated !== 0 && <div>AL {signed(full.alEstimated)}</div>}
                        </div>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dateStr = formatDate(year, month, d);
                    const record = leaveMap.get(`${user.id}|${dateStr}`);
                    const assignments = assignmentMap.get(`${user.id}|${dateStr}`) ?? [];
                    const shiftAbbrev =
                      assignments.length > 0
                        ? formatShiftTimeAbbreviation(
                            assignments[0].start_time,
                            assignments[0].end_time ||
                              getShiftEndTime(assignments[0].start_time, employmentDetails[user.id]?.daily_contract_hours),
                          )
                        : null;
                    const canEdit = isAdmin || user.id === currentUserId;
                    const recordTitle = record
                      ? record.record_type === 'leave'
                        ? `${dateStr} ${record.leave_type ? LEAVE_TYPE_LABELS[record.leave_type] : ''}${record.urgency === 'mandatory' ? '（必須）' : ''}${record.is_overridden ? '【待調整】' : ''}`
                        : `${dateStr} 特定上班 ${record.availability_start_time}-${record.availability_end_time}${record.urgency === 'mandatory' ? '（必須）' : ''}${record.is_overridden ? '【待調整】' : ''}`
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
                            } ${record.is_overridden ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
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
                        ) : shiftAbbrev ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[4rem] h-6 rounded-sm text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
                            title={`已排班次 ${shiftAbbrev}`}
                          >
                            {shiftAbbrev}
                          </span>
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
