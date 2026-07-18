import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { X, PartyPopper, Users, Search, CheckSquare, Square, Calendar, AlertTriangle, User } from 'lucide-react';
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

interface ActivityRecordModalProps {
  onClose: () => void;
  defaultPatientId?: number;
  record?: PatientActivityRecord; // 編輯模式：單筆記錄
}

type PatientEntryState = {
  is_absent: boolean;
  absence_reason: string;
  other_activity: string;
  notes: string;
  recorder: string;
} & Record<ActivityBooleanField, boolean>;

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hongKongTime.toISOString().split('T')[0];
};

const makeEmptyEntry = (recorderDefault: string): PatientEntryState => {
  const base: any = {
    is_absent: false,
    absence_reason: '',
    other_activity: '',
    notes: '',
    recorder: recorderDefault,
  };
  ACTIVITY_BOOLEAN_FIELDS.forEach(f => { base[f] = false; });
  return base as PatientEntryState;
};

const ActivityRecordModal: React.FC<ActivityRecordModalProps> = ({ onClose, defaultPatientId, record }) => {
  const { patients, healthAssessments, hospitalEpisodes, addActivityRecords, updateActivityRecord } = usePatients();
  const { displayName } = useAuth();
  const isEdit = !!record;

  const [recordDate, setRecordDate] = useState(record?.record_date ?? getHongKongDate());
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(
    new Set(record ? [record.patient_id] : defaultPatientId ? [defaultPatientId] : [])
  );
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [entries, setEntries] = useState<Record<number, PatientEntryState>>(() => {
    if (record) {
      const base: any = {
        is_absent: record.is_absent,
        absence_reason: record.absence_reason ?? '',
        other_activity: record.other_activity ?? '',
        notes: record.notes ?? '',
        recorder: record.recorder ?? displayName ?? '',
      };
      ACTIVITY_BOOLEAN_FIELDS.forEach(f => { base[f] = !!(record as any)[f]; });
      return { [record.patient_id]: base as PatientEntryState };
    }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmPatientIds, setConfirmPatientIds] = useState<number[] | null>(null);

  const activePatients = useMemo(() => {
    return [...patients].filter(p => p.在住狀態 === '在住').sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    if (!deferredSearch) return activePatients;
    return activePatients.filter(p =>
      matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, deferredSearch) ||
      matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, deferredSearch) ||
      matchBedNumber(p.床號, deferredSearch) ||
      fuzzyMatch(p.身份證號碼, deferredSearch)
    ).sort((a, b) => comparePatientsForSearch(a, b, deferredSearch));
  }, [activePatients, deferredSearch]);

  // 選定院友變動時，建立/移除 entry（新增模式才自動處理）
  useEffect(() => {
    if (isEdit) return;
    setEntries(prev => {
      const next = { ...prev };
      selectedPatientIds.forEach(pid => {
        if (!next[pid]) {
          const absence = detectAbsenceForDate(pid, recordDate, hospitalEpisodes);
          next[pid] = {
            ...makeEmptyEntry(displayName ?? ''),
            is_absent: !!absence?.isAbsent,
            absence_reason: absence?.reason ?? '',
          };
        }
      });
      Object.keys(next).forEach(key => {
        const pid = Number(key);
        if (!selectedPatientIds.has(pid)) delete next[pid];
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientIds]);

  // 日期變動時，重新偵測缺席（新增模式）
  useEffect(() => {
    if (isEdit) return;
    setEntries(prev => {
      const next = { ...prev };
      selectedPatientIds.forEach(pid => {
        if (!next[pid]) return;
        const absence = detectAbsenceForDate(pid, recordDate, hospitalEpisodes);
        next[pid] = {
          ...next[pid],
          is_absent: !!absence?.isAbsent,
          absence_reason: absence ? absence.reason : next[pid].absence_reason,
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

  const updateEntry = (patientId: number, updates: Partial<PatientEntryState>) => {
    setEntries(prev => ({ ...prev, [patientId]: { ...prev[patientId], ...updates } }));
  };

  const buildRecordPayload = (patientId: number) => {
    const entry = entries[patientId];
    const payload: any = {
      patient_id: patientId,
      record_date: recordDate,
      other_activity: entry.is_absent ? '' : (entry.other_activity || ''),
      notes: entry.notes || '',
      is_absent: entry.is_absent,
      absence_reason: entry.is_absent ? (entry.absence_reason || '') : '',
      recorder: entry.recorder || '',
    };
    ACTIVITY_BOOLEAN_FIELDS.forEach(f => { payload[f] = entry.is_absent ? false : !!entry[f]; });
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
    for (const pid of selectedPatientIds) {
      const entry = entries[pid];
      if (entry?.is_absent && !entry.absence_reason?.trim()) {
        const p = patients.find(pp => pp.院友id === pid);
        alert(`請填寫 ${p?.中文姓名 ?? ''} 的缺席原因`);
        return;
      }
    }

    const flaggedPatientIds = Array.from(selectedPatientIds).filter(pid => {
      const entry = entries[pid];
      if (!entry || entry.is_absent) return false;
      const flags = getPatientCareFlags(pid, healthAssessments);
      if (!flags.isBedridden && !flags.isNasogastric) return false;
      return hasNonIndividualActivity(entry as any);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-100">
                <PartyPopper className="h-6 w-6 text-pink-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEdit ? '編輯活動記錄' : '新增活動記錄'}
              </h2>
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

          {!isEdit && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <label className="form-label flex flex-wrap items-center gap-2 mb-0">
                  <Users className="h-4 w-4" />
                  <span>選擇院友 ({selectedPatientIds.size}/{filteredPatients.length})</span>
                </label>
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
              <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-200">
                {filteredPatients.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">沒有找到符合條件的院友</div>
                ) : (
                  filteredPatients.map(patient => {
                    const isSelected = selectedPatientIds.has(patient.院友id);
                    return (
                      <div
                        key={patient.院友id}
                        onClick={() => handleTogglePatient(patient.院友id)}
                        className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                      >
                        {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-gray-400" />}
                        <span className="font-medium text-gray-900">{patient.床號} {patient.中文姓氏}{patient.中文名字}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {selectedPatientList.map(patient => {
              const entry = entries[patient.院友id];
              if (!entry) return null;
              const flags = getPatientCareFlags(patient.院友id, healthAssessments);
              return (
                <div key={patient.院友id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                        {patient.院友相片 ? (
                          <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{patient.床號} {patient.中文姓氏}{patient.中文名字}</span>
                      {(flags.isBedridden || flags.isNasogastric) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {flags.isBedridden ? '長期臥床' : ''}{flags.isBedridden && flags.isNasogastric ? '/' : ''}{flags.isNasogastric ? '鼻胃管' : ''}
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entry.is_absent}
                        onChange={(e) => updateEntry(patient.院友id, { is_absent: e.target.checked })}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-red-700">缺席</span>
                    </label>
                  </div>

                  {entry.is_absent ? (
                    <div>
                      <label className="form-label">缺席原因 *</label>
                      <input
                        type="text"
                        value={entry.absence_reason}
                        onChange={(e) => updateEntry(patient.院友id, { absence_reason: e.target.value })}
                        className="form-input"
                        placeholder="例如：住院 - 東區醫院 / 外出 / 拒絕參與"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                        {ACTIVITY_CATEGORY_GROUPS.map(group => (
                          <div key={group.title} className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2">{group.title}</div>
                            <div className="space-y-1.5">
                              {group.items.map(item => (
                                <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!entry[item.field]}
                                    onChange={(e) => updateEntry(patient.院友id, { [item.field]: e.target.checked } as any)}
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
                            value={entry.other_activity}
                            onChange={(e) => updateEntry(patient.院友id, { other_activity: e.target.value })}
                            className="form-input"
                            placeholder="其他活動內容"
                          />
                        </div>
                        <div>
                          <label className="form-label">備註</label>
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) => updateEntry(patient.院友id, { notes: e.target.value })}
                            className="form-input"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="mt-3">
                    <label className="form-label">記錄人員</label>
                    <input
                      type="text"
                      value={entry.recorder}
                      onChange={(e) => updateEntry(patient.院友id, { recorder: e.target.value })}
                      className="form-input max-w-xs"
                    />
                  </div>
                </div>
              );
            })}
            {selectedPatientList.length === 0 && (
              <div className="text-center py-8 text-gray-500">請先選擇院友</div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">取消</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? '儲存中...' : (isEdit ? '更新活動記錄' : '新增活動記錄')}
            </button>
          </div>
        </form>
      </div>

      {confirmPatientIds && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]" onClick={() => setConfirmPatientIds(null)}>
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
              {confirmPatientIds.map(pid => {
                const p = patients.find(pp => pp.院友id === pid);
                return <li key={pid}>{p?.床號} {p?.中文姓名}</li>;
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmPatientIds(null)}>取消</button>
              <button
                className="btn-primary"
                onClick={async () => {
                  setConfirmPatientIds(null);
                  await doSubmit();
                }}
              >
                確認並儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityRecordModal;
