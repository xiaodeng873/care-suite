import React, { useState, useEffect } from 'react';
import { X, Pill, Calendar, Clock, User, AlertTriangle, Plus, Trash2, Sparkles } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import DrugAutocomplete from './DrugAutocomplete';
import OCRPrescriptionBlock from './OCRPrescriptionBlock';
import { mapOCRDataToPrescriptionForm, getConfidenceColor, getConfidenceIcon } from '../utils/ocrFieldMapper';

interface PrescriptionModalProps {
  prescription?: any;
  onClose: () => void;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ prescription, onClose }) => {
  const { addPrescription, updatePrescription, patients } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const getHongKongTime = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[1].slice(0, 5);
  };

  const [formData, setFormData] = useState({
    patient_id: prescription?.patient_id || '',
    medication_name: prescription?.medication_name || '',
    medication_source: prescription?.medication_source || '',
    medication_quantity: prescription?.medication_quantity || '',
    prescription_date: prescription?.prescription_date || getHongKongDate(),
    start_date: prescription?.start_date || getHongKongDate(),
    start_time: prescription?.start_time || getHongKongTime(),
    end_date: prescription?.end_date || '',
    end_time: prescription?.end_time || '',
    duration_days: prescription?.duration_days || '',
    dosage_form: prescription?.dosage_form || '',
    administration_route: prescription?.administration_route || '',
    dosage_amount: prescription?.dosage_amount || '',
    dosage_unit: prescription?.dosage_unit || '',
    special_dosage_instruction: prescription?.special_dosage_instruction || '',
    daily_frequency: prescription?.daily_frequency || 1,
    frequency_type: prescription?.frequency_type || 'daily',
    frequency_value: prescription?.frequency_value || 1,
    specific_weekdays: prescription?.specific_weekdays || [],
    is_odd_even_day: prescription?.is_odd_even_day || 'none',
    medication_time_slots: prescription?.medication_time_slots || [],
    meal_timing: prescription?.meal_timing || '',
    is_prn: prescription?.is_prn || false,
    preparation_method: prescription?.preparation_method || 'advanced',
    status: prescription?.status || 'pending_change',
    notes: prescription?.notes || ''
  });

  const [inspectionRules, setInspectionRules] = useState(
    prescription?.inspection_rules || []
  );

  const [newTimeSlot, setNewTimeSlot] = useState('');

  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // 清除驗證錯誤訊息
    if (validationError) {
      setValidationError('');
    }

    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 1
      }));
    } else {
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: value
        };

        // 當劑型改變時，自動設定備藥方式
        if (name === 'dosage_form') {
          const immediatePreparationForms = ['藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'];
          const advancedPreparationForms = ['片劑', '膠囊'];
          if (immediatePreparationForms.includes(value)) {
            newData.preparation_method = 'immediate';
          } else if (advancedPreparationForms.includes(value)) {
            newData.preparation_method = 'advanced';
          }
        }

        return newData;
      });
    }
  };

  const handleWeekdayChange = (day: number, checked: boolean) => {
    if (validationError) setValidationError('');
    setFormData(prev => ({
      ...prev,
      specific_weekdays: checked
        ? [...prev.specific_weekdays, day].sort()
        : prev.specific_weekdays.filter(d => d !== day)
    }));
  };

  const addTimeSlot = () => {
    if (newTimeSlot && !formData.medication_time_slots.includes(newTimeSlot)) {
      if (validationError) setValidationError('');
      setFormData(prev => ({
        ...prev,
        medication_time_slots: [...prev.medication_time_slots, newTimeSlot].sort()
      }));
      setNewTimeSlot('');
    }
  };

  const getAutoTimeSlots = (dailyFrequency: number, mealTiming: string): string[] => {
    let times: string[] = [];

    if (dailyFrequency === 1) {
      switch (mealTiming) {
        case '早餐前':
        case '餐前':
          times = ['07:00'];
          break;
        case '午餐前':
          times = ['11:00'];
          break;
        case '早上':
        case '早餐時':
          times = ['08:00'];
          break;
        case '午餐時':
        case '中午':
          times = ['12:00'];
          break;
        case '晚餐時':
          times = ['16:00'];
          break;
        case '晚上':
        case '睡前':
          times = ['20:00'];
          break;
        default:
          times = ['08:00'];
      }
    } else if (dailyFrequency === 2) {
      const firstTime = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
      times = [firstTime, '16:00'];
    } else if (dailyFrequency === 3) {
      const firstTime = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
      times = [firstTime, '12:00', '16:00'];
    } else if (dailyFrequency === 4) {
      const firstTime = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
      times = [firstTime, '12:00', '16:00', '20:00'];
    } else if (dailyFrequency === 5) {
      times = ['08:00', '12:00', '16:00', '20:00', '00:00'];
    } else if (dailyFrequency === 6) {
      times = ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00'];
    } else if (dailyFrequency === 7) {
      times = ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00', '02:00'];
    } else if (dailyFrequency === 8) {
      times = ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00', '02:00', '05:00'];
    } else {
      const targetCount = Math.max(1, dailyFrequency);
      const interval = 24 / targetCount;
      for (let i = 0; i < targetCount; i++) {
        const hour = Math.floor(8 + (i * interval)) % 24;
        times.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }

    return times.sort();
  };

  const removeTimeSlot = (timeSlot: string) => {
    if (validationError) setValidationError('');
    setFormData(prev => ({
      ...prev,
      medication_time_slots: prev.medication_time_slots.filter(slot => slot !== timeSlot)
    }));
  };

  useEffect(() => {
    if (formData.daily_frequency && formData.medication_time_slots.length === 0 && !prescription) {
      const autoTimes = getAutoTimeSlots(formData.daily_frequency, formData.meal_timing);
      setFormData(prev => ({
        ...prev,
        medication_time_slots: autoTimes
      }));
    }
  }, [formData.daily_frequency, formData.meal_timing]);

  const addInspectionRule = () => {
    setInspectionRules(prev => [...prev, {
      id: `temp-${Date.now()}`,
      vital_sign_type: '上壓',
      condition_operator: 'gt',
      condition_value: 0,
      action_if_met: 'block_dispensing'
    }]);
  };

  const removeInspectionRule = (index: number) => {
    setInspectionRules(prev => prev.filter((_, i) => i !== index));
  };

  const updateInspectionRule = (index: number, field: string, value: any) => {
    setInspectionRules(prev => prev.map((rule, i) => 
      i === index ? { ...rule, [field]: value } : rule
    ));
  };

  const handleOCRComplete = (extractedData: any, confidenceScores: Record<string, number>) => {
    const { formData: mappedData, confidences } = mapOCRDataToPrescriptionForm(
      extractedData,
      confidenceScores,
      patients
    );

    const filledFields = new Set<string>();
    Object.entries(mappedData).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        filledFields.add(key);
      }
    });

    // 當劑型為特定類型時，自動設定備藥方式
    const immediatePreparationForms = ['藥水', '注射劑', '外用藥膏', '滴劑', '皮膚貼劑'];
    const advancedPreparationForms = ['片劑', '膠囊'];
    if (mappedData.dosage_form && immediatePreparationForms.includes(mappedData.dosage_form)) {
      mappedData.preparation_method = 'immediate';
    } else if (mappedData.dosage_form && advancedPreparationForms.includes(mappedData.dosage_form)) {
      mappedData.preparation_method = 'advanced';
    }

    setFormData(prev => ({
      ...prev,
      ...mappedData
    }));

    setOcrFilledFields(filledFields);
    setFieldConfidences(confidences);
  };

  const handleOCRError = (error: string) => {
    alert(`OCR錯誤: ${error}`);
  };

  const clearOCRData = () => {
    setOcrFilledFields(new Set());
    setFieldConfidences({});
  };

  const acceptAllOCRData = () => {
    setOcrFilledFields(new Set());
    setFieldConfidences({});
  };

  const getFieldClassName = (fieldName: string, baseClassName: string) => {
    if (ocrFilledFields.has(fieldName)) {
      const confidence = fieldConfidences[fieldName] || 0;
      return `${baseClassName} ${getConfidenceColor(confidence)}`;
    }
    return baseClassName;
  };

  const renderFieldIndicator = (fieldName: string) => {
    if (!ocrFilledFields.has(fieldName)) return null;
    const confidence = fieldConfidences[fieldName] || 0;
    const icon = getConfidenceIcon(confidence);
    const level = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    const color = level === 'high' ? 'text-blue-600' : level === 'medium' ? 'text-yellow-600' : 'text-orange-600';

    return (
      <span className={`inline-flex items-center ml-2 ${color}`} title={`信心度: ${(confidence * 100).toFixed(0)}%`}>
        <Sparkles className="h-3 w-3" />
        <span className="text-xs ml-0.5">{icon}</span>
      </span>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.patient_id || !formData.medication_name) {
      setValidationError('請填寫院友和藥物名稱');
      return;
    }

    if (formData.frequency_type === 'weekly_days' && formData.specific_weekdays.length === 0) {
      setValidationError('選擇逢星期服時，請至少選擇一個星期幾');
      return;
    }

    if (formData.frequency_type === 'every_x_days' && formData.frequency_value < 1) {
      setValidationError('隔日服的天數必須大於0');
      return;
    }

    if (formData.frequency_type === 'every_x_months' && formData.frequency_value < 1) {
      setValidationError('隔月服的月數必須大於0');
      return;
    }

    // 驗證服用時間點數量與每日服用次數的一致性
    if (!formData.is_prn) {
      // 非PRN藥物：服用時間點數量必須與每日服用次數相同
      const expectedTimeSlots = formData.daily_frequency || 1;
      const actualTimeSlots = formData.medication_time_slots.length;

      if (actualTimeSlots !== expectedTimeSlots) {
        setValidationError(`非PRN藥物的服用時間點數量必須與每日服用次數相同。\n\n目前設定：每日${expectedTimeSlots}次\n實際時間點：${actualTimeSlots}個\n\n請調整服用時間點或每日服用次數。`);
        return;
      }
    } else {
      // PRN藥物：至少需要一個服用時間點，且服用時間點的數量不能超過每日服用次數
      if (formData.medication_time_slots.length === 0) {
        setValidationError('PRN藥物至少需要設定一個服用時間點');
        return;
      }
      if (formData.medication_time_slots.length > formData.daily_frequency) {
        setValidationError(`PRN藥物的服用時間點數量 (${formData.medication_time_slots.length}) 不能超過每日服用次數 (${formData.daily_frequency})。`);
        return;
      }
    }

    // 驗證停用處方必須有結束日期
    if (formData.status === 'inactive' && !formData.end_date) {
      setValidationError('停用處方必須設定結束日期');
      return;
    }

    // 驗證結束日期不能早於開始日期
    if (formData.end_date && formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        setValidationError('結束日期不能早於開始日期');
        return;
      }
    }

    try {
      const prescriptionData = {
        patient_id: formData.patient_id,
        medication_name: formData.medication_name,
        medication_source: formData.medication_source,
        medication_quantity: formData.medication_quantity,
        prescription_date: formData.prescription_date,
        start_date: formData.start_date,
        start_time: formData.start_time,
        end_date: formData.end_date || null,
        end_time: formData.end_time || null,
        duration_days: formData.duration_days === '' ? null : (typeof formData.duration_days === 'string' ? parseInt(formData.duration_days) : formData.duration_days),
        dosage_form: formData.dosage_form,
        administration_route: formData.administration_route,
        dosage_amount: formData.dosage_amount,
        dosage_unit: formData.dosage_unit,
        special_dosage_instruction: formData.special_dosage_instruction,
        daily_frequency: formData.daily_frequency,
        frequency_type: formData.frequency_type,
        frequency_value: formData.frequency_value,
        specific_weekdays: formData.specific_weekdays,
        is_odd_even_day: formData.is_odd_even_day,
        medication_time_slots: formData.medication_time_slots,
        meal_timing: formData.meal_timing,
        is_prn: formData.is_prn,
        preparation_method: formData.preparation_method,
        status: formData.status,
        notes: formData.notes,
        inspection_rules: inspectionRules.filter(rule =>
          rule.vital_sign_type && rule.condition_operator && rule.condition_value
        )
      };

      // Clean up undefined fields and empty strings for numeric fields
      Object.keys(prescriptionData).forEach(key => {
        if (prescriptionData[key] === undefined) {
          delete prescriptionData[key];
        }
      });

      if (prescription && prescription.id) {
        await updatePrescription({
          id: prescription.id,
          ...prescriptionData
        });
      } else {
        await addPrescription(prescriptionData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存處方失敗:', error);
      setValidationError('儲存處方失敗，請重試');
    }
  };

  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {prescription ? '編輯處方' : '新增處方'}
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
          {/* 驗證錯誤訊息 */}
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 mb-1">驗證錯誤</h4>
                <p className="text-sm text-red-700 whitespace-pre-line">{validationError}</p>
              </div>
              <button
                type="button"
                onClick={() => setValidationError('')}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* OCR 智能識別區塊 */}
          <OCRPrescriptionBlock
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

      
          {/* 基本資訊 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">基本資訊</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <User className="h-4 w-4 inline mr-1" />
                  院友 *
                  {renderFieldIndicator('patient_id')}
                </label>
                <PatientAutocomplete
                  value={formData.patient_id}
                  onChange={(patientId) => {
                    if (validationError) setValidationError('');
                    setFormData(prev => ({ ...prev, patient_id: patientId }));
                  }}
                  placeholder="搜索院友..."
                  className={getFieldClassName('patient_id', '')}
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
              </div>

              <div>
                <label className="form-label">
                  <Pill className="h-4 w-4 inline mr-1" />
                  藥物名稱 *
                  {renderFieldIndicator('medication_name')}
                </label>
                <DrugAutocomplete
                  value={formData.medication_name}
                  onChange={(drugName, drugData) => {
                    if (validationError) setValidationError('');
                    setFormData(prev => ({
                      ...prev,
                      medication_name: drugName,
                      dosage_form: drugData?.dosage_form || prev.dosage_form,
                      administration_route: drugData?.administration_route || prev.administration_route
                    }));
                  }}
                  placeholder="搜索或輸入藥物名稱..."
                  className={getFieldClassName('medication_name', '')}
                />
              </div>

              <div>
                <label className="form-label">
                  藥物來源
                  {renderFieldIndicator('medication_source')}
                </label>
                <input
                  type="text"
                  name="medication_source"
                  value={formData.medication_source}
                  onChange={handleChange}
                  className={getFieldClassName('medication_source', 'form-input')}
                  placeholder="例如：醫院、診所、藥房"
                />
              </div>

              <div>
                <label className="form-label">
                  藥物數量
                  {renderFieldIndicator('medication_quantity')}
                </label>
                <input
                  type="text"
                  name="medication_quantity"
                  value={formData.medication_quantity}
                  onChange={handleChange}
                  className={getFieldClassName('medication_quantity', 'form-input')}
                  placeholder="例如：30片、100ml"
                />
              </div>

              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  處方日期 *
                  {renderFieldIndicator('prescription_date')}
                </label>
                <input
                  type="date"
                  name="prescription_date"
                  value={formData.prescription_date}
                  onChange={handleChange}
                  className={getFieldClassName('prescription_date', 'form-input')}
                  required
                />
              </div>
            </div>
          </div>

          {/* 服用時間設定 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">服用時間設定</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  開始日期 *
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  <Clock className="h-4 w-4 inline mr-1" />
                  開始時間
                </label>
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">
                  服用日數
                  {renderFieldIndicator('duration_days')}
                </label>
                <input
                  type="number"
                  name="duration_days"
                  value={formData.duration_days}
                  onChange={(e) => {
                    const days = parseInt(e.target.value);
                    setFormData(prev => {
                      const newData = { ...prev, duration_days: e.target.value };
                      if (!isNaN(days) && days > 0 && prev.start_date) {
                        const startDate = new Date(prev.start_date);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + days);
                        newData.end_date = endDate.toISOString().split('T')[0];
                      }
                      return newData;
                    });
                  }}
                  className={getFieldClassName('duration_days', 'form-input')}
                  placeholder="例如：7"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">填寫後會自動計算結束日期</p>
              </div>

              <div>
                <label className="form-label">結束日期</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">結束時間</label>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* 服用資訊 */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">服用資訊</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">
                  劑型
                  {renderFieldIndicator('dosage_form')}
                </label>
                <select
                  name="dosage_form"
                  value={formData.dosage_form}
                  onChange={handleChange}
                  className={getFieldClassName('dosage_form', 'form-input')}
                >
                  <option value="">請選擇劑型</option>
                  <option value="片劑">片劑</option>
                  <option value="膠囊">膠囊</option>
                  <option value="藥水">藥水</option>
                  <option value="注射劑">注射劑</option>
                  <option value="外用藥膏">外用藥膏</option>
                  <option value="滴劑">滴劑</option>
                  <option value="皮膚貼劑">皮膚貼劑</option>
                </select>
              </div>

              <div>
                <label className="form-label">
                  服用途徑
                  {renderFieldIndicator('administration_route')}
                </label>
                <select
                  name="administration_route"
                  value={formData.administration_route}
                  onChange={handleChange}
                  className={getFieldClassName('administration_route', 'form-input')}
                >
                  <option value="">請選擇途徑</option>
                  <option value="口服">口服</option>
                  <option value="注射">注射</option>
                  <option value="外用">外用</option>
                  <option value="滴眼">滴眼</option>
                  <option value="滴耳">滴耳</option>
                  <option value="鼻胃管">鼻胃管</option>
                  <option value="吸入">吸入</option>
                </select>
              </div>

              <div>
                <label className="form-label">每日服用次數</label>
                <select
                  name="daily_frequency"
                  value={formData.daily_frequency}
                  onChange={(e) => {
                    const newFrequency = parseInt(e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      daily_frequency: newFrequency
                    }));
                  }}
                  className="form-input"
                >
                  <option value={1}>QD (每日1次)</option>
                  <option value={2}>BD (每日2次)</option>
                  <option value={3}>TDS (每日3次)</option>
                  <option value={4}>QID (每日4次)</option>
                  <option value={5}>每日5次</option>
                  <option value={6}>每日6次</option>
                  <option value={8}>每日8次</option>
                </select>
              </div>

              {/* 服用份量/單位 與 特殊用法 互斥選擇 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dosage_type"
                      checked={!formData.special_dosage_instruction}
                      onChange={() => setFormData(prev => ({ ...prev, special_dosage_instruction: '' }))}
                      className="form-radio"
                    />
                    <span className="text-sm font-medium">使用份量和單位</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="dosage_type"
                      checked={!!formData.special_dosage_instruction}
                      onChange={() => setFormData(prev => ({
                        ...prev,
                        special_dosage_instruction: '適量',
                        dosage_amount: '',
                        dosage_unit: ''
                      }))}
                      className="form-radio"
                    />
                    <span className="text-sm font-medium">使用特殊用法</span>
                  </label>
                </div>

                {!formData.special_dosage_instruction ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">服用份量</label>
                      <input
                        type="number"
                        name="dosage_amount"
                        value={formData.dosage_amount}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="1"
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="form-label">單位</label>
                      <select
                        name="dosage_unit"
                        value={formData.dosage_unit}
                        onChange={handleChange}
                        className="form-input"
                      >
                        <option value="">請選擇單位</option>
                        <option value="粒">粒</option>
                        <option value="片">片</option>
                        <option value="膠囊">膠囊</option>
                        <option value="毫升">毫升</option>
                        <option value="滴">滴</option>
                        <option value="口">口</option>
                        <option value="支">支</option>
                        <option value="包">包</option>
                        <option value="茶匙">茶匙</option>
                        <option value="湯匙">湯匙</option>
                        <option value="mg">mg</option>
                        <option value="ml">ml</option>
                        <option value="g">g</option>
                        <option value="mcg">mcg</option>
                        <option value="IU">IU</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">特殊用法</label>
                    <select
                      name="special_dosage_instruction"
                      value={formData.special_dosage_instruction}
                      onChange={handleChange}
                      className="form-input"
                    >
                      <option value="適量">適量</option>
                      <option value="搽患處">搽患處</option>
                      <option value="貼在皮膚上">貼在皮膚上</option>
                      <option value="薄薄一層">薄薄一層</option>
                      <option value="按需要使用">按需要使用</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">服用時段</label>
                <select
                  name="meal_timing"
                  value={formData.meal_timing}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="">請選擇時段</option>
                  <option value="餐前">餐前</option>
                  <option value="進餐時">進餐時</option>
                  <option value="餐後">餐後</option>
                  <option value="早餐前">早餐前</option>
                  <option value="早餐時">早餐時</option>
                  <option value="早餐後">早餐後</option>
                  <option value="午餐前">午餐前</option>
                  <option value="午餐時">午餐時</option>
                  <option value="午餐後">午餐後</option>
                  <option value="晚餐前">晚餐前</option>
                  <option value="晚餐時">晚餐時</option>
                  <option value="晚餐後">晚餐後</option>
                  <option value="早上">早上</option>
                  <option value="中午">中午</option>
                  <option value="晚上">晚上</option>
                  <option value="睡前">睡前</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_prn"
                  name="is_prn"
                  checked={formData.is_prn}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_prn" className="text-sm font-medium text-gray-700">
                  需要時 (PRN)
                </label>
              </div>

              <div>
                <label className="form-label">備藥方式</label>
                <select
                  name="preparation_method"
                  value={formData.preparation_method}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="immediate">即時備藥</option>
                  <option value="advanced">提前備藥</option>
                  <option value="custom">自理</option>
                </select>
              </div>
            </div>
          </div>

          {/* 服用頻率 */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">服用頻率</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">頻率類型 *</label>
                <select
                  name="frequency_type"
                  value={formData.frequency_type}
                  onChange={handleChange}
                  className="form-input"
                  required
                >
                  <option value="daily">每日服</option>
                  <option value="every_x_days">隔X日服</option>
                  <option value="every_x_months">隔X月服</option>
                  <option value="weekly_days">逢星期X服</option>
                  <option value="odd_even_days">單日/雙日服</option>
                  <option value="hourly">每小時</option>
                </select>
              </div>

              {(formData.frequency_type === 'every_x_days' || 
                formData.frequency_type === 'every_x_months' || 
                formData.frequency_type === 'hourly') && (
                <div>
                  <label className="form-label">
                    {formData.frequency_type === 'every_x_days' && '間隔天數'}
                    {formData.frequency_type === 'every_x_months' && '間隔月數'}
                    {formData.frequency_type === 'hourly' && '服用次數'}
                  </label>
                  <input
                    type="number"
                    name="frequency_value"
                    value={formData.frequency_value}
                    onChange={handleChange}
                    className="form-input"
                    min="1"
                    required
                  />
                </div>
              )}

              {formData.frequency_type === 'weekly_days' && (
                <div className="md:col-span-2">
                  <label className="form-label">選擇星期幾 *</label>
                  <div className="grid grid-cols-7 gap-2">
                    {dayNames.map((dayName, index) => (
                      <label key={index} className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={formData.specific_weekdays.includes(index + 1)}
                          onChange={(e) => handleWeekdayChange(index + 1, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm">{dayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.frequency_type === 'odd_even_days' && (
                <div>
                  <label className="form-label">單日/雙日</label>
                  <select
                    name="is_odd_even_day"
                    value={formData.is_odd_even_day}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="odd">單日</option>
                    <option value="even">雙日</option>
                  </select>
                </div>
              )}
            </div>

            {/* 服用時間點 - 移到服用頻率區塊 */}
            <div className="mt-6 pt-4 border-t border-yellow-200">
              <label className="form-label">服用時間點</label>
              
              <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <div className="text-sm text-yellow-800 space-y-1">
                  <p><strong>非PRN藥物：</strong>服用時間點數量必須與每日服用次數相同</p>
                  <p><strong>PRN藥物：</strong>可設定多個時間點，護士可在需要時選擇給予</p>
                </div>
              </div>
              
              {/* 自動分配時間按鈕 */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => {
                    const frequency = formData.daily_frequency || 1;
                    const autoTimes = getAutoTimeSlots(frequency, formData.meal_timing);

                    setFormData(prev => ({
                      ...prev,
                      medication_time_slots: autoTimes
                    }));
                  }}
                  className="btn-secondary flex items-center space-x-2 text-sm h-8"
                  title="根據服用次數和服用時段智能分配時間點"
                >
                  <Clock className="h-4 w-4" />
                  <span>智能分配時間 {formData.meal_timing && `(${formData.meal_timing})`}</span>
                </button>
              </div>
              
              <div className="flex space-x-2 mb-3">
                <input
                  type="time"
                  value={newTimeSlot}
                  onChange={(e) => setNewTimeSlot(e.target.value)}
                  className="form-input h-8"
                  placeholder="選擇時間"
                />
                <button
                  type="button"
                  onClick={addTimeSlot}
                  disabled={!newTimeSlot || formData.medication_time_slots.includes(newTimeSlot)}
                  className="btn-secondary flex items-center space-x-2 h-8 px-3 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增時間</span>
                </button>
              </div>
              
              {formData.medication_time_slots.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">已設定的服用時間：</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {formData.medication_time_slots.map((timeSlot, index) => (
                      <div
                        key={timeSlot}
                        className="flex items-center justify-between p-2 bg-white border border-yellow-300 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-900">{timeSlot}</span>
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(timeSlot)}
                          className="text-red-600 hover:text-red-800 ml-2"
                          title="移除此時間"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">尚未設定服用時間</p>
                  <p className="text-xs">請在上方選擇時間並點擊「新增時間」</p>
                </div>
              )}
            </div>
          </div>

          {/* 檢測項設定 */}
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                檢測項設定
              </h3>
              <button
                type="button"
                onClick={addInspectionRule}
                className="btn-secondary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增檢測項</span>
              </button>
            </div>

            {inspectionRules.length > 0 ? (
              <div className="space-y-3">
                {inspectionRules.map((rule, index) => (
                  <div key={index} className="bg-white border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">檢測項 {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeInspectionRule(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="form-label">檢測項目</label>
                        <select
                          value={rule.vital_sign_type}
                          onChange={(e) => updateInspectionRule(index, 'vital_sign_type', e.target.value)}
                          className="form-input"
                        >
                          <option value="上壓">上壓</option>
                          <option value="下壓">下壓</option>
                          <option value="脈搏">脈搏</option>
                          <option value="血糖值">血糖值</option>
                          <option value="呼吸">呼吸</option>
                          <option value="血含氧量">血含氧量</option>
                          <option value="體溫">體溫</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">條件</label>
                        <select
                          value={rule.condition_operator}
                          onChange={(e) => updateInspectionRule(index, 'condition_operator', e.target.value)}
                          className="form-input"
                        >
                          <option value="gt">大於</option>
                          <option value="lt">小於</option>
                          <option value="gte">大於或等於</option>
                          <option value="lte">小於或等於</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">閾值</label>
                        <input
                          type="number"
                          value={rule.condition_value}
                          onChange={(e) => updateInspectionRule(index, 'condition_value', parseFloat(e.target.value) || 0)}
                          className="form-input"
                          placeholder="輸入數值"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <label className="form-label">動作</label>
                        <select
                          value={rule.action_if_met}
                          onChange={(e) => updateInspectionRule(index, 'action_if_met', e.target.value)}
                          className="form-input"
                        >
                          <option value="block_dispensing">阻止派藥</option>
                          <option value="warning_only">僅警告</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">暫無檢測項設定</p>
                <p className="text-xs">檢測項用於在派藥前檢查院友的生命表徵是否符合安全條件</p>
              </div>
            )}
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">注意事項</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-input"
              rows={1}
              placeholder="輸入處方相關的注意事項或備註..."
            />
          </div>

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {prescription ? '更新處方' : '新增處方'}
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

export default PrescriptionModal;