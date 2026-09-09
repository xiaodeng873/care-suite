import React, { useState, useMemo } from 'react';
import { X, Syringe, Calendar, Plus, Trash2, Search, Users, User } from 'lucide-react';
import { usePatientData, useFilteredPatients, type VaccinationRecord } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import BedNumberImprint from './BedNumberImprint';
import OCRDocumentBlock from './OCRDocumentBlock';
import { formatDisplayDate } from '../utils/dateFormat';
import DateInput from './DateInput';
import { matchChineseName, matchEnglishName, matchPatientBedNumber, compareBedNumbers } from '../utils/searchUtils';

interface VaccinationRecordModalProps {
  patientId?: number;
  existingRecords?: VaccinationRecord[];
  prefilledData?: any;
  /** 對話設定嘅疫苗名稱1/2，連同現有記錄嘅疫苗名一齊做下拉建議 */
  suggestedVaccineNames?: string[];
  onClose: () => void;
}

interface VaccinationItem {
  id: string;
  vaccination_date: string;
  vaccine_item: string;
}

type TabMode = 'single' | 'batch';

const VaccinationRecordModal: React.FC<VaccinationRecordModalProps> = ({
  patientId,
  existingRecords = [],
  prefilledData,
  suggestedVaccineNames = [],
  onClose
}) => {
  const { vaccinationRecords, addVaccinationRecord } = usePatientData();
  const patients = useFilteredPatients();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const initialPatientId: number | undefined = prefilledData?.patient_id || patientId;

  const [activeTab, setActiveTab] = useState<TabMode>(initialPatientId ? 'single' : 'batch');
  const [vaccinationItems, setVaccinationItems] = useState<VaccinationItem[]>([
    {
      id: Date.now().toString(),
      vaccination_date: prefilledData?.vaccination_date || getHongKongDate(),
      vaccine_item: prefilledData?.vaccine_item || ''
    }
  ]);
  // 單項 tab：一個院友；批量 tab：多位院友
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>(initialPatientId);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(
    new Set(initialPatientId ? [initialPatientId] : [])
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [residencyFilter, setResidencyFilter] = useState('在住');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');

  // 疫苗名稱建議：對話設定嘅名稱1/2 + 現有記錄出現過嘅疫苗名（按中文排序，去重）
  const vaccineSuggestions = useMemo(() => {
    const fromRecords = vaccinationRecords.map(r => (r.vaccine_item || '').trim());
    const all = [...suggestedVaccineNames, ...fromRecords].map(s => s.trim()).filter(Boolean);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [vaccinationRecords, suggestedVaccineNames]);

  // 批量 tab 院友清單：按搜索 + 在住狀態篩選，按床號排序
  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim();
    return patients
      .filter(p => {
        const matchesResidency = !residencyFilter || p.在住狀態 === residencyFilter;
        const matchesSearch = !term ||
          matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, term) ||
          matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, term) ||
          matchPatientBedNumber(p, term);
        return matchesResidency && matchesSearch;
      })
      .sort((a, b) => compareBedNumbers(a.床號 || '', b.床號 || ''));
  }, [patients, patientSearch, residencyFilter]);

  const handleOCRComplete = (extractedData: any) => {
    setOcrError('');

    if (extractedData.patient_id) {
      setSelectedPatientId(extractedData.patient_id);
      setSelectedPatientIds(new Set([extractedData.patient_id]));
    }

    if (extractedData.records && Array.isArray(extractedData.records)) {
      const newItems = extractedData.records.map((record: any) => ({
        id: Date.now().toString() + Math.random(),
        vaccination_date: record.疫苗接種日期 || record.vaccination_date || getHongKongDate(),
        vaccine_item: record.疫苗項目 || record.vaccine_item || ''
      }));
      setVaccinationItems(newItems);
    } else {
      setVaccinationItems([{
        id: Date.now().toString(),
        vaccination_date: extractedData.疫苗接種日期 || extractedData.vaccination_date || getHongKongDate(),
        vaccine_item: extractedData.疫苗項目 || extractedData.vaccine_item || ''
      }]);
    }
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  const addVaccinationItem = () => {
    setVaccinationItems([
      ...vaccinationItems,
      {
        id: Date.now().toString(),
        vaccination_date: getHongKongDate(),
        vaccine_item: ''
      }
    ]);
  };

  const removeVaccinationItem = (id: string) => {
    if (vaccinationItems.length > 1) {
      setVaccinationItems(vaccinationItems.filter(item => item.id !== id));
    }
  };

  const updateVaccinationItem = (id: string, field: keyof VaccinationItem, value: string) => {
    setVaccinationItems(vaccinationItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const togglePatient = (id: number) => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrors(prev => ({ ...prev, patients: '' }));
  };

  const selectAllFiltered = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => next.add(p.院友id));
      return next;
    });
    setErrors(prev => ({ ...prev, patients: '' }));
  };

  const invertFiltered = () => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      filteredPatients.forEach(p => {
        if (next.has(p.院友id)) next.delete(p.院友id);
        else next.add(p.院友id);
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPatientIds(new Set());
  };

  const selectedCount = activeTab === 'single' ? (selectedPatientId ? 1 : 0) : selectedPatientIds.size;
  const totalRecords = vaccinationItems.length * selectedCount;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (activeTab === 'single') {
      if (!selectedPatientId) {
        newErrors.patient_id = '請選擇院友';
      }
    } else if (selectedPatientIds.size === 0) {
      newErrors.patients = '請勾選至少一位院友';
    }

    vaccinationItems.forEach((item, index) => {
      if (!item.vaccination_date) {
        newErrors[`vaccination_date_${index}`] = '請選擇注射日期';
      }
      if (!item.vaccine_item.trim()) {
        newErrors[`vaccine_item_${index}`] = '請輸入疫苗項目';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const targetPatientIds = activeTab === 'single'
        ? [selectedPatientId!]
        : Array.from(selectedPatientIds);

      let created = 0;
      for (const pid of targetPatientIds) {
        for (const item of vaccinationItems) {
          await addVaccinationRecord({
            patient_id: pid,
            vaccination_date: item.vaccination_date,
            vaccine_item: item.vaccine_item.trim(),
            vaccination_unit: '',
            remarks: ''
          });
          created++;
        }
      }

      alert(`成功新增 ${created} 筆疫苗記錄`);
      onClose();
    } catch (error) {
      console.error('Error saving vaccination records:', error);
      alert('儲存疫苗記錄失敗，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const singlePatient = patients.find(p => p.院友id === selectedPatientId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Syringe className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">新增疫苗記錄</h2>
              <p className="text-sm text-gray-500">
                {activeTab === 'single' && singlePatient ? (
                  <>
                    {singlePatient.中文姓名} - 床號: <BedNumberImprint patient={singlePatient} size="sm" />
                    {' '}× {vaccinationItems.length} 個疫苗項目
                  </>
                ) : (
                  <>已勾選 {activeTab === 'single' ? 0 : selectedPatientIds.size} 位院友 × {vaccinationItems.length} 個疫苗項目</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <OCRDocumentBlock
            documentType="vaccination"
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
              <span className="text-red-600 text-sm">{ocrError}</span>
            </div>
          )}

          <div className="border-b border-gray-200">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 flex items-center gap-2 ${
                  activeTab === 'single'
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="h-4 w-4" />
                <span>單項</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batch')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 flex items-center gap-2 ${
                  activeTab === 'batch'
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>批量</span>
              </button>
            </div>
          </div>

          {activeTab === 'single' ? (
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <span className="text-red-500">*</span>
                <span>院友</span>
              </label>
              <PatientAutocomplete
                value={selectedPatientId?.toString() || ''}
                onChange={(patientIdStr) => {
                  setSelectedPatientId(parseInt(patientIdStr));
                  setErrors(prev => ({ ...prev, patient_id: '' }));
                }}
                placeholder="搜索院友姓名或床號..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
              {errors.patient_id && (
                <p className="mt-1 text-sm text-red-600">{errors.patient_id}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="form-label mb-0 flex items-center gap-2">
                  <span className="text-red-500">*</span> 選擇院友
                </label>
                <span className="text-sm text-green-600 font-medium">已勾選 {selectedPatientIds.size} 人</span>
              </div>

              <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索院友姓名或床號..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="form-input pl-10"
                  />
                </div>
                <select
                  value={residencyFilter}
                  onChange={(e) => setResidencyFilter(e.target.value)}
                  className="form-input w-auto"
                >
                  <option value="在住">在住</option>
                  <option value="待入住">待入住</option>
                  <option value="已退住">已退住</option>
                  <option value="">全部</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={selectAllFiltered} className="btn-secondary text-sm">全選</button>
                  <button type="button" onClick={invertFiltered} className="btn-secondary text-sm">反選</button>
                  <button type="button" onClick={clearSelection} className="btn-secondary text-sm text-red-600">清除</button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto p-2">
                {filteredPatients.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                    {filteredPatients.map(p => (
                      <label
                        key={p.院友id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                          selectedPatientIds.has(p.院友id) ? 'bg-green-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPatientIds.has(p.院友id)}
                          onChange={() => togglePatient(p.院友id)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <BedNumberImprint patient={p} size="sm" />
                        <span className="text-sm text-gray-900">{p.中文姓名}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">冇符合條件嘅院友</p>
                )}
              </div>
              {errors.patients && (
                <p className="text-sm text-red-600">{errors.patients}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <label className="form-label mb-0">
                <span className="text-red-500">*</span> 疫苗項目（名稱 + 接種日期成對）
              </label>
              <button
                type="button"
                onClick={addVaccinationItem}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>新增項目</span>
              </button>
            </div>

            {vaccinationItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                  {vaccinationItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVaccinationItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label flex flex-wrap items-center gap-2">
                      <Syringe className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>疫苗項目 / 名稱</span>
                    </label>
                    <input
                      type="text"
                      list="vaccine-name-suggestions"
                      value={item.vaccine_item}
                      onChange={(e) => {
                        updateVaccinationItem(item.id, 'vaccine_item', e.target.value);
                        setErrors(prev => ({ ...prev, [`vaccine_item_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`vaccine_item_${index}`] ? 'border-red-500' : ''}`}
                      placeholder="例如：流感疫苗"
                    />
                    {errors[`vaccine_item_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`vaccine_item_${index}`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label flex flex-wrap items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>注射日期</span>
                    </label>
                    <DateInput
                      value={item.vaccination_date}
                      onChange={(value) => {
                        updateVaccinationItem(item.id, 'vaccination_date', value);
                        setErrors(prev => ({ ...prev, [`vaccination_date_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`vaccination_date_${index}`] ? 'border-red-500' : ''}`}
                    />
                    {errors[`vaccination_date_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`vaccination_date_${index}`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <datalist id="vaccine-name-suggestions">
              {vaccineSuggestions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {activeTab === 'single' && existingRecords.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">現有疫苗記錄</h3>
              <div className="space-y-2">
                {existingRecords.map((record, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      {formatDisplayDate(record.vaccination_date)}
                    </span>
                    <span className="text-gray-900 font-medium">{record.vaccine_item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800">
              預覽：{vaccinationItems.length} 個疫苗項目 × {selectedCount} 位院友 = 將新增 {totalRecords} 筆記錄
            </p>
            <ul className="mt-2 space-y-1">
              {vaccinationItems.map(item => (
                <li key={item.id} className="text-sm text-green-700">
                  ・{item.vaccine_item.trim() || '（未填名稱）'} @ {item.vaccination_date ? formatDisplayDate(item.vaccination_date) : '（未填日期）'} × {selectedCount} 人
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '儲存中...' : `新增 ${totalRecords} 筆記錄`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaccinationRecordModal;
