import React, { useMemo } from 'react';
import type { UserProfile, UserEmploymentDetails, UserLeaveRecord, PublicHoliday } from '@care-suite/shared';
import { LEAVE_TYPE_LABELS } from '@care-suite/shared';
import { getRosterExpectedCounts, getRosterUsedCounts } from '../utils/leaveValidation';

interface RosterScheduleViewProps {
  year: number;
  month: number;
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  leaveRecords: UserLeaveRecord[];
  publicHolidays: PublicHoliday[];
  loading?: boolean;
  onCellClick: (user: UserProfile, date: string) => void;
  onLeaveClick: (record: UserLeaveRecord) => void;
}

const LEAVE_BADGE_COLORS: Record<UserLeaveRecord['leave_type'], string> = {
  AL: 'bg-green-500',
  PRD: 'bg-blue-500',
  DO: 'bg-purple-400',
  SL: 'bg-red-500',
  CL: 'bg-orange-400',
  NPL: 'bg-gray-400',
  PH: 'bg-yellow-400',
  SH: 'bg-pink-400',
};

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const RosterScheduleView: React.FC<RosterScheduleViewProps> = ({
  year,
  month,
  users,
  employmentDetails,
  leaveRecords,
  publicHolidays,
  loading,
  onCellClick,
  onLeaveClick,
}) => {
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const leaveMap = useMemo(() => {
    const map = new Map<string, UserLeaveRecord>();
    for (const record of leaveRecords) {
      map.set(`${record.user_id}|${record.leave_date}`, record);
    }
    return map;
  }, [leaveRecords]);

  const userStats = useMemo(() => {
    const stats: Record<
      string,
      {
        expected: { doExpected: number; prdExpected: number; phExpected: number; shExpected: number };
        used: ReturnType<typeof getRosterUsedCounts>;
        prdAvailable: number;
      }
    > = {};
    for (const user of users) {
      const details = employmentDetails[user.id];
      const userLeaves = leaveRecords.filter((l) => l.user_id === user.id);
      const expected = getRosterExpectedCounts(
        details?.weekly_work_days ?? null,
        details?.rest_day_fraction ?? 0,
        publicHolidays,
        year,
        month,
        details?.rest_day_start_date,
      );
      const used = getRosterUsedCounts(userLeaves, year, month);
      const prdAvailable = Math.max(0, Math.floor((details?.rest_day_fraction ?? 0) + expected.prdExpected));
      stats[user.id] = { expected, used, prdAvailable };
    }
    return stats;
  }, [users, employmentDetails, leaveRecords, publicHolidays, year, month]);

  if (loading) {
    return <p className="text-sm text-gray-500">載入中...</p>;
  }

  return (
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
              return (
                <th
                  key={d}
                  className="px-1 py-2 text-center font-medium text-gray-600 min-w-[2.5rem]"
                >
                  <div>{d}</div>
                  <div className="text-[10px] text-gray-400">{weekday}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={daysInMonth + 2} className="px-4 py-6 text-center text-gray-400">
                暫無適用職位員工
              </td>
            </tr>
          )}
          {users.map((user) => {
            const stats = userStats[user.id];
            return (
              <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white min-w-[8rem]">
                  {user.name_zh}
                </td>
                <td className="px-3 py-2 text-gray-600 sticky left-[8rem] bg-white min-w-[10rem]">
                  {stats ? (
                    <div className="space-y-0.5">
                      <div>DO {stats.used.doUsed}/{stats.expected.doExpected}</div>
                      <div>PRD {stats.used.prdUsed}/{stats.prdAvailable}</div>
                      <div>PH {stats.used.phUsed}/{stats.expected.phExpected}</div>
                      <div>SH {stats.used.shUsed}/{stats.expected.shExpected}</div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const dateStr = formatDate(year, month, d);
                  const record = leaveMap.get(`${user.id}|${dateStr}`);
                  return (
                    <td key={d} className="px-0 py-1 text-center align-middle">
                      {record ? (
                        <button
                          type="button"
                          onClick={() => onLeaveClick(record)}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-sm text-[10px] text-white font-medium ${LEAVE_BADGE_COLORS[record.leave_type]} hover:opacity-80`}
                          title={`${dateStr} ${LEAVE_TYPE_LABELS[record.leave_type]}`}
                        >
                          {record.leave_type}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onCellClick(user, dateStr)}
                          className="w-6 h-6 rounded-sm hover:bg-gray-200 inline-block"
                          aria-label={`${user.name_zh} ${dateStr} 預排假期`}
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
  );
};

export default RosterScheduleView;
