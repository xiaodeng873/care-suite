import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { X, PartyPopper, Users, Search, CheckSquare, Square, Calendar, AlertTriangle, User, Building2 } from 'lucide-react';
import { usePatients, type PatientActivityRecord } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';
import {
  ACTIVITY_CATEGORY_GROUPS,
  ACTIVITY_BOOLEAN_FIELDS,
  type ActivityBooleanField,
  detectAbsenceForDate,
  getPatientCareFlags,
  hasNonIndividualActivity,
} from '../utils/activityRecordStatus';
import BedNumberImprint from './BedNumberImprint';
import type { Patient } from '../lib/database';

interface ActivityRecordModalProps {
  onClose: () => void;
  defaultPatientId?: number;
  record?: PatientActivityRecord; // 編輯模式：單筆記錄
}

type ActivityState = {
  other_activity: string;
  notes: string;
  recorder: string;
} & Record<ActivityBooleanField, boolean>;

type AbsenceState = {
  is_absent: boolean;
  absence_reason: string;
};

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hongKongTime.toISOString().split('T')[0];
};

const makeEmptyActivity = (recorderDefault: string): ActivityState => {
  const base: Partial<ActivityState> = {
    other_activity: '',
    notes: '',
    recorder: recorderDefault,
  };
  ACTIVITY_BOOLEAN_FIELDS.forEach(f => { base[f] = false; });
  return base as ActivityState;
};

const ActivityRecordModal: React.FC<ActivityRecordModalProps> = ({ onClose, defaultPatientId, record }) => {
  const { patients, stations, healthAssessments, hospitalEpisodes, addActivityRecords, updateActivityRecord } = usePatients();
  const { displayName } = useAuth();
  const isEdit = !!record;

  const [recordDate, setRecordDate] = useState(record?.record_date ?? getHongKongDate());
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(
    new Set(record ? [record.patient_id] : defaultPatientId ? [defaultPatientId] : [])
  );
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);

  // 共享活動內容：一套 checkbox 對應所有「可出席」已選院友
  const [sharedActivity, setSharedActivity] = useState<ActivityState>(() => {
    if (record) {
      const base: Partial<ActivityState> = {
        other_activity: record.other_activity ?? '',
        notes: record.notes ?? '',
        recorder: record.recorder ?? displayName ?? '',
      };
      ACTIVITY_BOOLEAN_FIELDS.forEach(f => { base[f] = !!(record as Record<ActivityBooleanField, boolean>)[f]; });
      return base as ActivityState;
    }
    return makeEmptyActivity(displayName ?? '');
  });

  // 缺席狀態由系統邏輯判斷（來自 hospital_episodes），用戶不可手動更改
  const [absenceMap, setAbsenceMap] = useState<Record<number, AbsenceState>>(() => {
    if (record) {
      return {
        [record.patient_id]: {
          is_absent: record.is_absent,
          absence_reason: record.absence_reason ?? '',
        }
      };
    }
    return {};
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmPatientIds, setConfirmPatientIds] = useState<number[] | null>(null);

  const activePatients = useMemo(() => {
    return [...patients].filter(p => p.在住狀態 === '在住').sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  const stationFilteredPatients = useMemo(() => {
    if (stationFilter === 'all') return activePatients;
    return activePatients.filter(p => p.station_id === stationFilter);
  }, [activePatients, stationFilter]);

  const filteredPatients = useMemo(() => {
    if (!deferredSearch) return stationFilteredPatients;
    return stationFilteredPatients.filter(p =>
      matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, deferredSearch) ||
      matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, deferredSearch) ||
      matchBedNumber(p.床號, deferredSearch) ||
      fuzzyMatch(p.身份證號碼, deferredSearch)
    ).sort((a, b) => comparePatientsForSearch(a, b, deferredSearch));
  }, [stationFilteredPatients, deferredSearch]);

  // 選定院友變動時，建立/移除缺席狀態（新增模式才自動處理）
  useEffect(() => {
    if (isEdit) return;
    setAbsenceMap(prev => {
      const next: Record<number, AbsenceState> = {};
      selectedPatientIds.forEach(pid => {
        if (prev[pid]) {
          next[pid] = prev[pid];
        } else {
          const absence = detectAbsenceForDate(pid, recordDate, hospitalEpisodes);
          next[pid] = {
            is_absent: !!absence?.isAbsent,
            absence_reason: absence?.reason ?? '',
          };
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientIds]);

  // 日期變動時，重新偵測缺席（新增模式）
  useEffect(() => {
    if (isEdit) return;
    setAbsenceMap(prev => {
      const next: Record<number, AbsenceState> = {};
      selectedPatientIds.forEach(pid => {
        const existing = prev[pid];
        const absence = detectAbsenceForDate(pid, recordDate, hospitalEpisodes);
        next[pid] = {
          ...existing,
          is_absent: !!absence?.isAbsent,
          absence_reason: absence ? absence.reason : (existing?.absence_reason ?? ''),
        };
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordDate]);

  const handleTogglePatient = (patientId: number) => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => next.add(p.院友id));
      return next;
    });
  };

  const clearAll = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => next.delete(p.院友id));
      return next;
    });
  };

  const invertSelection = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => {
        if (next.has(p.院友id)) next.delete(p.院友id);
        else next.add(p.院友id);
      });
      return next;
    });
  };

  const buildRecordPayload = (patientId: number): Omit<PatientActivityRecord, 'id' | 'created_at' | 'updated_at'> => {
    const absence = absenceMap[patientId] ?? { is_absent: false, absence_reason: '' };
    const isAbsent = absence.is_absent;
    const absenceReason = absence.absence_reason || '住院/外出';
    const payload: Omit<PatientActivityRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patientId,
      record_date: recordDate,
      other_activity: isAbsent ? '' : (sharedActivity.other_activity || ''),
      notes: isAbsent ? `無法參加: ${absenceReason}` : (sharedActivity.notes || ''),
      is_absent: isAbsent,
      absence_reason: isAbsent ? absenceReason : '',
      recorder: sharedActivity.recorder || '',
    };
    ACTIVITY_BOOLEAN_FIELDS.forEach(f => {
      (payload as unknown as Record<ActivityBooleanField, boolean>)[f] = isAbsent ? false : !!sharedActivity[f];
    });
    return payload;
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      if (isEdit && record) {
        await updateActivityRecord(record.id, buildRecordPayload(record.patient_id));
      } else {
        const records = Array.from(selectedPatientIds).map(pid => buildRecordPayload(pid));
        await addActivityRecords(records);
      }
      onClose();
    } catch (error) {
      console.error('儲存活動記錄失敗:', error);
      alert('儲存失敗，請重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPatientIds.size === 0) {
      alert('請選擇至少一位院友');
      return;
    }
    if (!recordDate) {
      alert('請選擇日期');
      return;
    }

    const flaggedPatientIds = Array.from(selectedPatientIds).filter(pid => {
      const absence = absenceMap[pid];
      if (absence?.is_absent) return false;
      const flags = getPatientCareFlags(pid, healthAssessments);
      if (!flags.isBedridden && !flags.isNasogastric) return false;
      return hasNonIndividualActivity(sharedActivity as unknown as PatientActivityRecord);
    });

    if (flaggedPatientIds.length > 0) {
      setConfirmPatientIds(flaggedPatientIds);
      return;
    }

    await doSubmit();
  };

  const selectedPatientList = useMemo(
    () => Array.from(selectedPatientIds).map(pid => patients.find(p => p.院友id === pid)).filter(Boolean) as typeof patients,
    [selectedPatientIds, patients]
  );

  const presentCount = useMemo(() => {
    return selectedPatientList.filter(p => !absenceMap[p.院友id]?.is_absent).length;
  }, [selectedPatientList, absenceMap]);

  const absentCount = selectedPatientList.length - presentCount;

  // 編輯模式：維持單一筆記錄的表單（無左右分割）
  if (isEdit) {
    const patient = selectedPatientList[0];
    const absence = absenceMap[record?.patient_id ?? 0] ?? { is_absent: false, absence_reason: '' };
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-100">
                  <PartyPopper className="h-6 w-6 text-pink-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">編輯活動記錄</h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                日期 *
              </label>
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="form-input max-w-xs"
                required
              />
            </div>

            {patient && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                  {patient.院友相片 ? (
                    <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900"><BedNumberImprint patient={patient} size="sm" className="font-medium text-gray-900" /> {patient.中文姓氏}{patient.中文名字}</p>
                  {absence.is_absent ? (
                    <p className="text-sm text-red-600">無法參加: {absence.absence_reason || '住院/外出'}</p>
                  ) : (
                    <p className="text-sm text-green-600">出席</p>
                  )}
                </div>
              </div>
            )}

            <ActivityForm
              sharedActivity={sharedActivity}
              setSharedActivity={setSharedActivity}
              disabled={absence.is_absent}
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary">取消</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? '儲存中...' : '更新活動記錄'}
              </button>
            </div>
          </form>
        </div>

        {confirmPatientIds && (
          <ConfirmModal
            patientIds={confirmPatientIds}
            patients={patients}
            onCancel={() => setConfirmPatientIds(null)}
            onConfirm={doSubmit}
          />
        )}
      </div>
    );
  }

  // 新增模式：左右分割
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-100">
                <PartyPopper className="h-6 w-6 text-pink-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">新增活動記錄</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左側：日期、居住區、搜尋、院友清單 */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    日期 *
                  </label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    居住區
                  </label>
                  <select
                    value={stationFilter}
                    onChange={(e) => setStationFilter(e.target.value)}
                    className="form-input"
                  >
                    <option value="all">全部居住區</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <label className="form-label flex flex-wrap items-center gap-2 mb-0">
                    <Users className="h-4 w-4" />
                    <span>院友清單（已選 {selectedPatientIds.size} / {filteredPatients.length}）</span>
                  </label>
                  <div className="flex items-center gap-2 text-sm">
                    <button type="button" onClick={selectAll} className="text-blue-600 hover:text-blue-700">全選</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={invertSelection} className="text-blue-600 hover:text-blue-700">反選</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={clearAll} className="text-gray-500 hover:text-gray-700">清除</button>
                  </div>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋院友姓名或床號..."
                    className="form-input pl-10"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto divide-y divide-gray-200">
                  {filteredPatients.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">沒有找到符合條件的院友</div>
                  ) : (
                    filteredPatients.map(patient => {
                      const isSelected = selectedPatientIds.has(patient.院友id);
                      const absence = absenceMap[patient.院友id];
                      return (
                        <div
                          key={patient.院友id}
                          onClick={() => handleTogglePatient(patient.院友id)}
                          className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600 flex-shrink-0" /> : <Square className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate"><BedNumberImprint patient={patient} size="sm" className="font-medium text-gray-900" /> {patient.中文姓氏}{patient.中文名字}</div>
                            {absence?.is_absent && (
                              <div className="text-xs text-red-600 mt-0.5">無法參加: {absence.absence_reason || '住院/外出'}</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 右側：活動內容 */}
            <div className="space-y-4">
              {selectedPatientIds.size > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">已選院友：</span>
                    <span className="text-sm text-green-700">出席 {presentCount} 人</span>
                    {absentCount > 0 && (
                      <span className="text-sm text-red-600">無法參加 {absentCount} 人</span>
                    )}
                  </div>

                  <ActivityForm
                    sharedActivity={sharedActivity}
                    setSharedActivity={setSharedActivity}
                    disabled={presentCount === 0}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-500">
                  <Users className="h-12 w-12 text-gray-300 mb-3" />
                  <p>請先從左側選擇院友</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-6 mt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">取消</button>
            <button type="submit" disabled={submitting || selectedPatientIds.size === 0} className="btn-primary">
              {submitting ? '儲存中...' : '新增活動記錄'}
            </button>
          </div>
        </form>
      </div>

      {confirmPatientIds && (
        <ConfirmModal
          patientIds={confirmPatientIds}
          patients={patients}
          onCancel={() => setConfirmPatientIds(null)}
          onConfirm={doSubmit}
        />
      )}
    </div>
  );
};

// 共享活動表單（新增/編輯共用）
interface ActivityFormProps {
  sharedActivity: ActivityState;
  setSharedActivity: React.Dispatch<React.SetStateAction<ActivityState>>;
  disabled?: boolean;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ sharedActivity, setSharedActivity, disabled }) => {
  return (
    <div className={`border border-gray-200 rounded-lg p-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">活動內容</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {ACTIVITY_CATEGORY_GROUPS.map(group => (
          <div key={group.title} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">{group.title}</div>
            <div className="space-y-1.5">
              {group.items.map(item => (
                <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!sharedActivity[item.field]}
                    onChange={(e) => setSharedActivity(prev => ({ ...prev, [item.field]: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">其他</label>
          <input
            type="text"
            value={sharedActivity.other_activity}
            onChange={(e) => setSharedActivity(prev => ({ ...prev, other_activity: e.target.value }))}
            className="form-input"
            placeholder="其他活動內容"
          />
        </div>
        <div>
          <label className="form-label">備註</label>
          <input
            type="text"
            value={sharedActivity.notes}
            onChange={(e) => setSharedActivity(prev => ({ ...prev, notes: e.target.value }))}
            className="form-input"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="form-label">記錄人員</label>
        <input
          type="text"
          value={sharedActivity.recorder}
          onChange={(e) => setSharedActivity(prev => ({ ...prev, recorder: e.target.value }))}
          className="form-input max-w-xs"
        />
      </div>
    </div>
  );
};

// 臥床/鼻胃飼確認對話框
interface ConfirmModalProps {
  patientIds: number[];
  patients: Patient[];
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ patientIds, patients, onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]" onClick={onCancel}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">請確認</h3>
        </div>
        <p className="text-sm text-gray-700 mb-3">
          以下院友為長期臥床或鼻胃飼，但本次記錄勾選了「個人活動」以外的活動類別，請確認是否屬實：
        </p>
        <ul className="list-disc list-inside text-sm text-gray-800 mb-4 space-y-1">
          {patientIds.map(pid => {
            const p = patients.find(pp => pp.院友id === pid);
            return <li key={pid}>{p && <BedNumberImprint patient={p} size="sm" className="text-gray-800" />} {p?.中文姓名}</li>;
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={onConfirm}>
            確認並儲存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityRecordModal;
