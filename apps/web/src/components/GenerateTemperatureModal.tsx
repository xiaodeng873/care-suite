import React, { useMemo, useState } from 'react';
import { X, Thermometer, CheckSquare, Square } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { syncTaskStatus } from '../lib/database';
import type { HealthRecord } from '../lib/database';
import { isInHospital } from '../utils/careRecordHelper';

interface GenerateTemperatureModalProps {
  onClose: () => void;
}

const TARGET_TIME = '08:00';

const GenerateTemperatureModal: React.FC<GenerateTemperatureModalProps> = ({ onClose }) => {
  const {
    patients,
    stations,
    healthRecords,
    patientHealthTasks,
    admissionRecords,
    hospitalEpisodes,
    addHealthRecordsForSession,
    refreshData,
    refreshHealthTaskData,
  } = usePatients();
  const { displayName } = useAuth();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };
  const targetDate = useMemo(() => getHongKongDate(), []);

  const [stationFilter, setStationFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 當天在住院友（依居住區篩選、床號排序）
  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => p.在住狀態 === '在住')
      .filter(p => (stationFilter === 'all' ? true : p.station_id === stationFilter))
      .sort((a, b) => (a.床號 || '').localeCompare(b.床號 || '', 'zh-Hant', { numeric: true }));
  }, [patients, stationFilter]);

  // 正在缺席（生效中的缺席事件 或 is_hospitalized 任一為真）
  const isAbsent = useMemo(() => {
    const map = new Map<number, boolean>();
    patients.forEach(p => {
      const absent = isInHospital(p, targetDate, TARGET_TIME, admissionRecords, hospitalEpisodes) || !!p.is_hospitalized;
      map.set(p.院友id, absent);
    });
    return map;
  }, [patients, admissionRecords, hospitalEpisodes, targetDate]);

  // 當天已有體溫記錄者
  const hasTemperatureToday = useMemo(() => {
    const set = new Set<number>();
    healthRecords.forEach(r => {
      if (r.監測類型 === '體溫' && r.記錄日期 === targetDate && r.數值 !== null) {
        set.add(r.院友id);
      }
    });
    return set;
  }, [healthRecords, targetDate]);

  // 預設勾選 = 在住 且 非缺席 且 當天尚無體溫記錄
  const eligibleIds = useMemo(() => {
    return filteredPatients
      .filter(p => !isAbsent.get(p.院友id) && !hasTemperatureToday.has(p.院友id))
      .map(p => p.院友id);
  }, [filteredPatients, isAbsent, hasTemperatureToday]);

  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);
  // 首次/篩選變更時，依預設勾選合資格者
  const effectiveSelected = selectedIds ?? new Set<number>(eligibleIds);

  const toggleOne = (id: number) => {
    setSelectedIds(() => {
      const next = new Set(effectiveSelected);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filteredPatients.map(p => p.院友id)));
  const clearAll = () => setSelectedIds(new Set());
  const resetDefault = () => setSelectedIds(new Set(eligibleIds));
  const invertSelection = () => {
    setSelectedIds(() => {
      const next = new Set<number>();
      filteredPatients.forEach(p => { if (!effectiveSelected.has(p.院友id)) next.add(p.院友id); });
      return next;
    });
  };

  const allSelected = filteredPatients.length > 0 && filteredPatients.every(p => effectiveSelected.has(p.院友id));

  const generateRandomTemperature = () => {
    // 隨機 36.0 – 37.1（含），1 位小數
    return parseFloat((36.0 + Math.random() * 1.1).toFixed(1));
  };

  const handleGenerate = async () => {
    const ids = Array.from(effectiveSelected);
    if (ids.length === 0) {
      setError('請至少勾選一位院友');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const taskByPatient = new Map<number, string>();
      patientHealthTasks.forEach(t => {
        if (t.health_record_type === '體溫' && !taskByPatient.has(t.patient_id)) {
          taskByPatient.set(t.patient_id, t.id);
        }
      });

      const records: Omit<HealthRecord, '記錄id' | '建立時間'>[] = ids.map(id => ({
        院友id: id,
        任務id: taskByPatient.get(id),
        記錄日期: targetDate,
        記錄時間: TARGET_TIME,
        監測類型: '體溫',
        數值: generateRandomTemperature(),
        記錄人員: displayName || undefined,
      }));

      await addHealthRecordsForSession(records);

      // 與其他監測任務一致：同步各受影響任務的下次到期狀態
      const affectedTaskIds = new Set<string>();
      records.forEach(r => { if (r.任務id) affectedTaskIds.add(r.任務id); });
      for (const taskId of affectedTaskIds) {
        try {
          await syncTaskStatus(taskId);
        } catch (e) {
          console.error('[GenerateTemperatureModal] syncTaskStatus 失敗:', taskId, e);
        }
      }

      if (refreshHealthTaskData) await refreshHealthTaskData();
      if (refreshData) await refreshData();

      setSuccess(`已為 ${ids.length} 位院友生成 ${TARGET_TIME} 體溫記錄`);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error('生成體溫記錄失敗:', err);
      setError(err instanceof Error ? err.message : '生成失敗，請重試');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Thermometer className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">一鍵生成體溫</h2>
              <p className="text-sm text-gray-500">{targetDate} {TARGET_TIME}．隨機 36.0–37.1°C</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">居住區</label>
            <select
              value={stationFilter}
              onChange={(e) => { setStationFilter(e.target.value); setSelectedIds(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">全部居住區</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                選擇院友（已選 {effectiveSelected.size} / {filteredPatients.length}）
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={resetDefault} className="text-sm text-blue-600 hover:text-blue-700">預設</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">全選</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={invertSelection} className="text-sm text-blue-600 hover:text-blue-700">反選</button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-md max-h-72 overflow-y-auto divide-y divide-gray-100">
              {filteredPatients.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">沒有符合條件的院友</p>
              ) : (
                filteredPatients.map(p => {
                  const absent = isAbsent.get(p.院友id);
                  const measured = hasTemperatureToday.has(p.院友id);
                  return (
                    <button
                      key={p.院友id}
                      type="button"
                      onClick={() => toggleOne(p.院友id)}
                      className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50"
                    >
                      {effectiveSelected.has(p.院友id) ? (
                        <CheckSquare className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="font-mono text-gray-500 w-12">{p.床號}</span>
                      <span className="text-gray-900 flex-1">{p.中文姓名}</span>
                      {absent && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">缺席</span>
                      )}
                      {measured && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">已量度</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {filteredPatients.length > 0 && (
              <button type="button" onClick={allSelected ? clearAll : selectAll} className="mt-1 text-xs text-gray-500 hover:text-gray-700">
                {allSelected ? '取消全選' : '全選'}
              </button>
            )}
            <p className="mt-2 text-xs text-gray-500">預設已勾選「在住、非缺席、當天尚無體溫」之院友。</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={isGenerating}>取消</button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || effectiveSelected.size === 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-orange-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Thermometer className="h-4 w-4" />
                <span>生成體溫（{effectiveSelected.size}）</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateTemperatureModal;
