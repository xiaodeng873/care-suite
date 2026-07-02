import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, User } from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import type { Bed, Patient } from '../../lib/database';
import { t2s } from '../utils/chinese';

interface PatientListPageProps {
  onSelectPatient: (bed: Bed, patient: Patient) => void;
}

const PatientListPage: React.FC<PatientListPageProps> = ({ onSelectPatient }) => {
  const { patients, stations, beds, loading } = usePatients();
  const [search, setSearch] = useState('');
  const [selectedStation, setSelectedStation] = useState('all');

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

  const handleSelect = (patient: Patient) => {
    if (!patient.bed_id) return;
    const bed = beds.find(b => b.id === patient.bed_id);
    if (bed) onSelectPatient(bed, patient);
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
              return (
                <li key={patient.院友id}>
                  <button
                    onClick={() => handleSelect(patient)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    {patient.院友相片 ? (
                      <img
                        src={patient.院友相片}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{t2s(patient.中文姓名)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {patient.床號}
                        {station && ` · ${t2s(station.name)}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
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
