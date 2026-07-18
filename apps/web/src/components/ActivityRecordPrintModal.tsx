import React, { useState, useMemo, useDeferredValue } from 'react';
import { X, Printer, Search, CheckSquare, Square, Calendar, Users, AlertTriangle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';
import { printActivityRecordForm } from '../utils/activityRecordPrintFormHtml';

interface ActivityRecordPrintModalProps {
  onClose: () => void;
}

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hongKongTime.toISOString().split('T')[0];
};

const firstDayOfMonth = (dateStr: string) => `${dateStr.slice(0, 7)}-01`;

const ActivityRecordPrintModal: React.FC<ActivityRecordPrintModalProps> = ({ onClose }) => {
  const { patients, activityRecords } = usePatients();
  const today = getHongKongDate();
  const [startDate, setStartDate] = useState(firstDayOfMonth(today));
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState('');

  const activePatients = useMemo(() => {
    return patients
      .filter(p => p.在住狀態 === '在住')
      .sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    if (!deferredSearch) return activePatients;
    return activePatients
      .filter(p =>
        matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, deferredSearch) ||
        matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, deferredSearch) ||
        matchBedNumber(p.床號, deferredSearch) ||
        fuzzyMatch(p.身份證號碼, deferredSearch)
      )
      .sort((a, b) => comparePatientsForSearch(a, b, deferredSearch));
  }, [activePatients, deferredSearch]);

  const toggleSelect = (id: number) => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filteredPatients.length > 0 && filteredPatients.every(p => selectedPatientIds.has(p.院友id));

  const toggleSelectAll = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredPatients.forEach(p => next.delete(p.院友id));
      } else {
        filteredPatients.forEach(p => next.add(p.院友id));
      }
      return next;
    });
  };

  const handlePrint = async () => {
    if (selectedPatientIds.size === 0) {
      setError('請至少選擇一位院友');
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError('請確認日期範圍正確');
      return;
    }
    setError('');
    setIsPrinting(true);
    try {
      const selectedPatients = activePatients.filter(p => selectedPatientIds.has(p.院友id));
      const recordsByPatient = new Map<number, typeof activityRecords>();
      selectedPatients.forEach(p => {
        const records = activityRecords.filter(
          r => r.patient_id === p.院友id && r.record_date >= startDate && r.record_date <= endDate
        );
        recordsByPatient.set(p.院友id, records);
      });
      await printActivityRecordForm(selectedPatients, recordsByPatient);
      onClose();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">列印活動記錄表</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" /> 日期範圍
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
              />
              <span className="text-gray-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <Users className="w-4 h-4" /> 選擇院友（已選 {selectedPatientIds.size} 位）
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                {allFilteredSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                {allFilteredSelected ? '取消全選' : '全選'}
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜尋床號或姓名..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredPatients.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">沒有符合的院友</div>
              )}
              {filteredPatients.map(p => (
                <label
                  key={p.院友id}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPatientIds.has(p.院友id)}
                    onChange={() => toggleSelect(p.院友id)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-500 w-12 shrink-0">{p.床號}</span>
                  <span className="text-gray-800">{p.中文姓名}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            <Printer className="w-4 h-4" /> {isPrinting ? '準備列印中...' : '確認列印'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityRecordPrintModal;
