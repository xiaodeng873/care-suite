import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, User } from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import type { Bed, Patient } from '../../lib/database';
import { t2s } from '../utils/chinese';
import BedNumberImprint from '../../components/BedNumberImprint';
import { TIME_SLOTS, DIAPER_CHANGE_SLOTS, INTAKE_OUTPUT_SLOTS, parseDiaperSlotStartTime, isSlotOverdue, formatDate } from '../../utils/careRecordHelper';

interface PatientListPageProps {
  onSelectPatient: (bed: Bed, patient: Patient, initialDate?: string) => void;
}

const PatientListPage: React.FC<PatientListPageProps> = ({ onSelectPatient }) => {
  const { patients, stations, beds, loading, patrolRounds, diaperChangeRecords, restraintObservationRecords, positionChangeRecords } = usePatients();
  const [search, setSearch] = useState('');
  const [selectedStation, setSelectedStation] = useState('all');

  // 計算患者最早的逾期任務日期
  const getEarliestOverdueDate = (patientId: number): string | null => {
    const overdueDates = new Set<string>();
    
    // 需要回顧過去30天的紀錄
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 生成過去30天的所有日期
    const dateSet = new Set<string>();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateSet.add(`${year}-${month}-${day}`);
    }

    // 檢查巡房記錄：對每一天的每個時段，如果未填且逾期，標記為逾期
    dateSet.forEach(dateStr => {
      TIME_SLOTS.forEach(slot => {
        // 檢查是否存在該時段的記錄
        const hasRecord = patrolRounds.some(
          r => r.patient_id === patientId && r.patrol_date === dateStr
        );
        // 如果未填且逾期，則為逾期任務
        if (!hasRecord && isSlotOverdue(dateStr, slot)) {
          overdueDates.add(dateStr);
        }
      });
    });

    // 檢查換片記錄
    dateSet.forEach(dateStr => {
      DIAPER_CHANGE_SLOTS.forEach(slot => {
        const startTime = parseDiaperSlotStartTime(slot.time);
        const hasRecord = diaperChangeRecords.some(
          r => r.patient_id === patientId && r.change_date === dateStr
        );
        if (!hasRecord && isSlotOverdue(dateStr, startTime)) {
          overdueDates.add(dateStr);
        }
      });
    });

    // 檢查約束觀察記錄
    dateSet.forEach(dateStr => {
      TIME_SLOTS.forEach(slot => {
        const hasRecord = restraintObservationRecords.some(
          r => r.patient_id === patientId && r.observation_date === dateStr
        );
        if (!hasRecord && isSlotOverdue(dateStr, slot)) {
          overdueDates.add(dateStr);
        }
      });
    });

    // 檢查翻身記錄
    dateSet.forEach(dateStr => {
      TIME_SLOTS.forEach(slot => {
        const hasRecord = positionChangeRecords.some(
          r => r.patient_id === patientId && r.change_date === dateStr
        );
        if (!hasRecord && isSlotOverdue(dateStr, slot)) {
          overdueDates.add(dateStr);
        }
      });
    });

    if (overdueDates.size === 0) return null;
    
    // 返回最早的日期
    const dates = Array.from(overdueDates).sort();
    return dates[0];
  };

  const activePatients = useMemo(
    () => patients.filter(p => p.在住狀態 === '在住'),
    [patients]
  );

  const filtered = useMemo(() => {
    let list = activePatients;
    if (selectedStation !== 'all') {
      list = list.filter(p => p.station_id === selectedStation);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.中文姓名?.toLowerCase().includes(q) ||
        p.床號?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activePatients, selectedStation, search]);

  const handleSelect = (patient: Patient, initialDate?: string) => {
    if (!patient.bed_id) return;
    const bed = beds.find(b => b.id === patient.bed_id);
    if (bed) onSelectPatient(bed, patient, initialDate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 搜索欄 */}
      <div className="p-3 space-y-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索姓名或床号…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedStation}
          onChange={e => setSelectedStation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全部区域</option>
          {stations.map(s => (
            <option key={s.id} value={s.id}>{t2s(s.name)}</option>
          ))}
        </select>
      </div>

      {/* 院友列表 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <User className="w-12 h-12 opacity-30" />
            <p className="text-sm">没有找到院友</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(patient => {
              const station = stations.find(s => s.id === patient.station_id);
              const earliestOverdueDate = getEarliestOverdueDate(patient.院友id);
              return (
                <li key={patient.院友id}>
                  <button
                    onClick={() => handleSelect(patient)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      {patient.院友相片 ? (
                        <img
                          src={patient.院友相片}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      {earliestOverdueDate && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{t2s(patient.中文姓名)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <BedNumberImprint patient={patient} size="sm" className="text-xs text-gray-500" />
                        {station && ` · ${t2s(station.name)}`}
                      </p>
                    </div>
                    {earliestOverdueDate ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(patient, earliestOverdueDate);
                        }}
                        className="ml-2 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 active:bg-red-200 transition-colors cursor-pointer"
                        title={`逾期任務：${earliestOverdueDate}`}
                      >
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PatientListPage;
