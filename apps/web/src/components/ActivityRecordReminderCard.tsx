import React, { useMemo } from 'react';
import { PartyPopper, ArrowRight } from 'lucide-react';
import { getActivityRecordOverdueInfo } from '../utils/activityRecordStatus';
import BedNumberImprint from './BedNumberImprint';
import type { Patient, PatientActivityRecord } from '../lib/database';

interface ActivityRecordReminderCardProps {
  patients: Patient[];
  activityRecords: PatientActivityRecord[];
  onAddActivityRecord: (patient: Patient) => void;
}

const ActivityRecordReminderCard: React.FC<ActivityRecordReminderCardProps> = ({
  patients,
  activityRecords,
  onAddActivityRecord,
}) => {
  const overduePatients = useMemo(() => {
    const now = new Date();
    return patients
      .filter(p => p.在住狀態 === '在住')
      .map(p => ({ patient: p, info: getActivityRecordOverdueInfo(p.院友id, activityRecords, now) }))
      .filter(item => item.info.isOverdue)
      .sort((a, b) => a.patient.床號.localeCompare(b.patient.床號, 'zh-Hant', { numeric: true }));
  }, [patients, activityRecords]);

  if (overduePatients.length === 0) return null;

  const { previousMonthYear, previousMonthMonth } = overduePatients[0].info;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-pink-100">
          <PartyPopper className="h-6 w-6 text-pink-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">活動記錄提醒</h2>
          <p className="text-sm text-gray-600">
            {previousMonthYear}年{previousMonthMonth}月參與活動少於 2 次，共 {overduePatients.length} 位院友
          </p>
        </div>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {overduePatients.map(({ patient, info }) => (
          <button
            key={patient.院友id}
            onClick={() => onAddActivityRecord(patient)}
            className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2"
          >
            <div className="flex items-center gap-2">
              <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500 w-12 shrink-0" />
              <span className="text-sm text-gray-800">{patient.中文姓名}</span>
              <span className="text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                僅 {info.previousMonthCount} 次
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActivityRecordReminderCard;
