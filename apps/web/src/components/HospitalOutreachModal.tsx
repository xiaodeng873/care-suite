import React, { useState } from 'react';
import { X, Guitar as Hospital, Calendar, Clock, Pill, User, AlertTriangle, MessageCircle, Copy, Plus, Trash2, Stethoscope } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface MedicationSource {
  id: string;
  medication_bag_date: string;
  prescription_weeks: number;
  outreach_medication_source: string;
}

interface HospitalOutreachModalProps {
  record?: any;
  onClose: () => void;
}

const HospitalOutreachModal: React.FC<HospitalOutreachModalProps> = ({ record, onClose }) => {
  const { addHospitalOutreachRecord, updateHospitalOutreachRecord, doctorVisitSchedule } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  // 初始化 medicationSources 狀態
  const initialMedicationSources = () => {
    if (record?.medication_sources && Array.isArray(record.medication_sources) && record.medication_sources.length > 0) {
      return record.medication_sources.map((source: any) => ({
        id: source.id || `temp-${Date.now()}-${Math.random()}`,
        medication_bag_date: source.medication_bag_date || getHongKongDate(),
        prescription_weeks: source.prescription_weeks || 4,
        outreach_medication_source: source.outreach_medication_source || ''
      }));
    } else if (record?.medication_bag_date) {
      return [{
        id: `temp-${Date.now()}`,
        medication_bag_date: record.medication_bag_date,
        prescription_weeks: record.prescription_weeks || 4,
        outreach_medication_source: record.outreach_medication_source || ''
      }];
    }
    return [{ id: `temp-${Date.now()}`, medication_bag_date: getHongKongDate(), prescription_weeks: 4, outreach_medication_source: '' }];
  };

  const [formData, setFormData] = useState({
    patient_id: record?.patient_id || '',
    outreach_appointment_date: record?.outreach_appointment_date || '',
    medication_pickup_arrangement: record?.medication_pickup_arrangement || '每次詢問',
    remarks: record?.remarks || ''
  });

  const [medicationSources, setMedicationSources] = useState<MedicationSource[]>(initialMedicationSources);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 計算藥完日期
  const calculateMedicationEndDate = (bagDate: string, weeks: number): string => {
    if (!bagDate) return '';

    const startDate = new Date(bagDate);
    if (isNaN(startDate.getTime())) return '';

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (weeks * 7) - 1);
    return endDate.toISOString().split('T')[0];
  };

  // 獲取最新的藥完日期
  const getLatestMedicationEndDate = (): string | null => {
    if (medicationSources.length === 0) return null;
    
    const endDates = medicationSources.map(source => 
      calculateMedicationEndDate(source.medication_bag_date, source.prescription_weeks)
    ).filter(dateString => {
      const date = new Date(dateString);
      return !isNaN(date.getTime());
    });
    
    if (endDates.length === 0) return null;
    
    return endDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  };

  // 新增藥物來源
  const addMedicationSource = () => {
    const newSource: MedicationSource = {
      id: `temp-${Date.now()}-${Math.random()}`,
      medication_bag_date: getHongKongDate(),
      prescription_weeks: 4,
      outreach_medication_source: ''
    };
    setMedicationSources([...medicationSources, newSource]);
  };

  // 移除藥物來源
  const removeMedicationSource = (id: string) => {
    if (medicationSources.length > 1) {
      setMedicationSources(medicationSources.filter(source => source.id !== id));
    }
  };

  // 更新藥物來源
  const updateMedicationSource = (id: string, field: keyof MedicationSource, value: string | number) => {
    setMedicationSources(medicationSources.map(source => 
      source.id === id ? { ...source, [field]: value } : source
    ));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 驗證表單
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.patient_id) {
      newErrors.patient_id = '請選擇院友';
    }

    if (medicationSources.length === 0) {
      newErrors.medication_sources = '至少需要一個藥物來源';
    } else {
      medicationSources.forEach((source, index) => {
        if (!source.medication_bag_date) {
          newErrors[`medication_bag_date_${index}`] = '請選擇藥袋日期';
        }
        if (!source.prescription_weeks || source.prescription_weeks < 1) {
          newErrors[`prescription_weeks_${index}`] = '處方週數必須大於0';
        }
      });
    }

    if (!formData.medication_pickup_arrangement) {
      newErrors.medication_pickup_arrangement = '請選擇取藥安排';
    }

    // 驗證覆診日期
    if (formData.outreach_appointment_date) {
      const latestEndDate = getLatestMedicationEndDate();
      if (latestEndDate && new Date(formData.outreach_appointment_date) > new Date(latestEndDate)) {
        newErrors.outreach_appointment_date = '覆診日期不能晚於藥完日期';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // 準備提交資料
      const submitData = {
        ...formData,
        patient_id: parseInt(formData.patient_id),
        medication_sources: medicationSources.map(source => ({
          medication_bag_date: source.medication_bag_date,
          prescription_weeks: source.prescription_weeks,
          medication_end_date: calculateMedicationEndDate(source.medication_bag_date, source.prescription_weeks),
          outreach_medication_source: source.outreach_medication_source
        })),
        // 為了向後兼容，使用第一個藥物來源作為主要資訊
        medication_bag_date: medicationSources[0].medication_bag_date,
        prescription_weeks: medicationSources[0].prescription_weeks,
        medication_end_date: calculateMedicationEndDate(medicationSources[0].medication_bag_date, medicationSources[0].prescription_weeks),
        outreach_medication_source: medicationSources[0].outreach_medication_source
      };

      if (record) {
        await updateHospitalOutreachRecord({ ...submitData, id: record.id });
      } else {
        await addHospitalOutreachRecord(submitData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存醫院外展記錄失敗:', error);
      alert('儲存失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Hospital className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {record ? '編輯醫院外展記錄' : '新增醫院外展記錄'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 選擇院友 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-600" />
              選擇院友
            </h3>
            
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, patient_id: patientId }))}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
              {errors.patient_id && (
                <p className="text-red-500 text-sm mt-1">{errors.patient_id}</p>
              )}
            </div>
          </div>

          {/* 藥物來源 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Pill className="h-5 w-5 mr-2 text-blue-600" />
                藥物來源
              </h3>
              {medicationSources.length < 5 && (
                <button
                  type="button"
                  onClick={addMedicationSource}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增藥物來源</span>
                </button>
              )}
            </div>

            {errors.medication_sources && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
                <p className="text-red-500 text-sm">{errors.medication_sources}</p>
              </div>
            )}

            <div className="space-y-4">
              {medicationSources.map((source, index) => (
                <div key={source.id} className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">藥物來源 {index + 1}</h4>
                    {medicationSources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicationSource(source.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">
                        藥袋日期 *
                      </label>
                      <input
                        type="date"
                        value={source.medication_bag_date}
                        onChange={(e) => updateMedicationSource(source.id, 'medication_bag_date', e.target.value)}
                        className={`form-input ${errors[`medication_bag_date_${index}`] ? 'border-red-300' : ''}`}
                        required
                      />
                      {errors[`medication_bag_date_${index}`] && (
                        <p className="text-red-500 text-sm mt-1">{errors[`medication_bag_date_${index}`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">
                        處方週數 *
                      </label>
                      <input
                        type="number"
                        value={source.prescription_weeks}
                        onChange={(e) => updateMedicationSource(source.id, 'prescription_weeks', parseInt(e.target.value) || 1)}
                        className={`form-input ${errors[`prescription_weeks_${index}`] ? 'border-red-300' : ''}`}
                        min="1"
                        max="52"
                        required
                      />
                      {errors[`prescription_weeks_${index}`] && (
                        <p className="text-red-500 text-sm mt-1">{errors[`prescription_weeks_${index}`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">
                        藥完日期（自動計算）
                      </label>
                      <input
                        type="date"
                        value={calculateMedicationEndDate(source.medication_bag_date, source.prescription_weeks)}
                        className="form-input bg-gray-100"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="form-label">
                        藥物出處
                      </label>
                      <select
                        value={source.outreach_medication_source}
                        onChange={(e) => updateMedicationSource(source.id, 'outreach_medication_source', e.target.value)}
                        className="form-input"
                      >
                        <option value="">請選擇藥物出處</option>
                        <option value="KWH/CGAS">KWH/CGAS</option>
                        <option value="KCH/PGT">KCH/PGT</option>
                        <option value="出院病房配發">出院病房配發</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {medicationSources.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>尚未新增藥物來源</p>
                  <p className="text-sm">點擊上方「新增藥物來源」按鈕開始記錄</p>
                </div>
              )}
            </div>
          </div>

          {/* 覆診安排 */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2 text-green-600" />
              覆診安排
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  覆診日期
                </label>
                <select
                  value={formData.outreach_appointment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, outreach_appointment_date: e.target.value }))}
                  className={`form-input ${errors.outreach_appointment_date ? 'border-red-300' : ''}`}
                >
                  <option value="">未安排</option>
                  {(doctorVisitSchedule ?? [])
                    .filter(schedule => {
                      const latestEndDate = getLatestMedicationEndDate();
                      if (!latestEndDate) return true;
                      return new Date(schedule.visit_date) <= new Date(latestEndDate);
                    })
                    .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
                    .map(schedule => (
                      <option key={schedule.id} value={schedule.visit_date}>
                        {new Date(schedule.visit_date).toLocaleDateString('zh-TW')} 
                        {schedule.doctor_name && ` - ${schedule.doctor_name}`}
                        {schedule.specialty && ` (${schedule.specialty})`}
                      </option>
                    ))}
                </select>
                {errors.outreach_appointment_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.outreach_appointment_date}</p>
                )}
                {getLatestMedicationEndDate() && (
                  <p className="text-xs text-gray-600 mt-1">
                    覆診日期不能晚於藥完日期：{new Date(getLatestMedicationEndDate()!).toLocaleDateString('zh-TW')}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">
                  取藥安排 *
                </label>
                <select
                  value={formData.medication_pickup_arrangement}
                  onChange={(e) => setFormData(prev => ({ ...prev, medication_pickup_arrangement: e.target.value }))}
                  className={`form-input ${errors.medication_pickup_arrangement ? 'border-red-300' : ''}`}
                  required
                >
                  <option value="家人自取">家人自取</option>
                  <option value="院舍代勞">院舍代勞</option>
                  <option value="每次詢問">每次詢問</option>
                </select>
                {errors.medication_pickup_arrangement && (
                  <p className="text-red-500 text-sm mt-1">{errors.medication_pickup_arrangement}</p>
                )}
              </div>
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">備註</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="輸入相關備註..."
            />
          </div>

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {record ? '更新記錄' : '新增記錄'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HospitalOutreachModal;