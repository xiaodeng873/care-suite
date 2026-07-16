import React, { useMemo, useState } from 'react';
import { X, Activity, CheckSquare, Square, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { generateBloodPressureRecordWorksheet } from '../utils/bloodPressureRecordWorksheetGenerator';

interface BloodPressureWorksheetModalProps {
  onClose: () => void;
}

const BloodPressureWorksheetModal: React.FC<BloodPressureWorksheetModalProps> = ({ onClose }) => {
  const { patients, stations } = usePatients();

  const getHongKongDate = () => {
    const now = new Date();
    return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  };
  const getDateBefore = (days: number) => {
    const now = new Date();
    const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    hk.setDate(hk.getDate() - days);
    return hk.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getDateBefore(29));
  const [endDate, setEndDate] = useState(getHongKongDate());
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [residencyFilter, setResidencyFilter] = useState<'在住' | '已退住'>('在住');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [quickSearch, setQuickSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => residencyFilter === '在住' ? p.在住狀態 === '在住' : p.在住狀態 === '已退住')
      .filter(p => stationFilter === 'all' ? true : p.station_id === stationFilter)
      .sort((a, b) => (a.床號 || '').localeCompare(b.床號 || '', 'zh-Hant', { numeric: true }));
  }, [patients, residencyFilter, stationFilter]);

  const handleQuickSearch = (term: string) => {
    setQuickSearch(term);
    if (!term.trim()) return;
    const t = term.trim().toLowerCase();
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => {
        const name = `${p.中文姓氏 ?? ''}${p.中文名字 ?? ''}${p.中文姓名 ?? ''}`;
        if ((p.床號 || '').toLowerCase().includes(t) || name.includes(t)) next.add(p.院友id);
      });
      return next;
    });
  };
  const allSelected = filteredPatients.length > 0 && filteredPatients.every(p => selectedIds.has(p.院友id));
  const displayPatients = quickSearch.trim()
    ? filteredPatients.filter(p => {
        const t = quickSearch.trim().toLowerCase();
        const name = `${p.中文姓氏 ?? ''}${p.中文名字 ?? ''}${p.中文姓名 ?? ''}`;
        return (p.床號 || '').toLowerCase().includes(t) || name.includes(t);
      })
    : filteredPatients;

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filteredPatients.map(p => p.院友id)));
  const invertSelection = () => {
    setSelectedIds(prev => {
      const next = new Set<number>();
      filteredPatients.forEach(p => { if (!prev.has(p.院友id)) next.add(p.院友id); });
      return next;
    });
  };

  const handleExport = async () => {
    if (startDate > endDate) { setError('起始日期不可晚於結束日期'); return; }
    if (selectedIds.size === 0) { setError('請至少勾選一位院友'); return; }
    setIsGenerating(true);
    setError(null);
    setSuccess(false);
    try {
      await generateBloodPressureRecordWorksheet(startDate, endDate, Array.from(selectedIds));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('生成生命表徵觀察記錄表失敗:', err);
      setError('生成失敗，請檢查網絡連線後重試');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">生命表徵觀察記錄表</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">起始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">結束日期</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">居住區</label>
              <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">全部居住區</option>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">在住狀態</label>
              <select value={residencyFilter} onChange={e => setResidencyFilter(e.target.value as '在住' | '已退住')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="在住">在住</option>
                <option value="已退住">退住</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                選擇院友（已選 {selectedIds.size} / {filteredPatients.length}）
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">全選</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={invertSelection} className="text-sm text-blue-600 hover:text-blue-700">反選</button>
              </div>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={quickSearch}
                onChange={e => handleQuickSearch(e.target.value)}
                placeholder="輸入姓名或床號自動勾選..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredPatients.length === 0
                ? <p className="px-4 py-3 text-sm text-gray-500">沒有符合條件的院友</p>
                : displayPatients.map(p => (
                  <button key={p.院友id} type="button" onClick={() => toggleOne(p.院友id)}
                    className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50">
                    {selectedIds.has(p.院友id)
                      ? <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      : <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    <span className="font-mono text-gray-500 w-12">{p.床號}</span>
                    <span className="text-gray-900">{p.中文姓名}</span>
                  </button>
                ))}
            </div>
            {filteredPatients.length > 0 && (
              <button type="button" onClick={allSelected ? () => setSelectedIds(new Set()) : selectAll}
                className="mt-1 text-xs text-gray-500 hover:text-gray-700">
                {allSelected ? '取消全選' : '全選'}
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800">記錄表已成功生成！打印視窗已開啟</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 border-t border-gray-200">
          <button onClick={onClose} disabled={isGenerating}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">取消</button>
          <button onClick={handleExport} disabled={isGenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2">
            {isGenerating ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>生成中...</span></>
            ) : (
              <><Activity className="h-4 w-4" /><span>列印</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BloodPressureWorksheetModal;
