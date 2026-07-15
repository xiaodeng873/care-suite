import React, { useState, useEffect, useMemo } from 'react';
import { X, Pill, Calendar, Clock, User, AlertTriangle, Plus, Trash2, Sparkles } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import DrugAutocomplete from './DrugAutocomplete';
import OCRPrescriptionBlock from './OCRPrescriptionBlock';
import { mapOCRDataToPrescriptionForm, getConfidenceColor, getConfidenceIcon } from '../utils/ocrFieldMapper';
import { getMedicationSettings, INSTITUTION_GROUPS, getInstitutionCategory } from '../utils/medicationSettings';
import { computeEstimatedEndDate } from '../utils/estimatedEndDate';
import { supabase } from '../lib/supabase';

interface PrescriptionModalProps {
  prescription?: any;
  onClose: () => void;
}

const LAST_RX_KEY = (patientId: string | number) => `care_suite_last_rx_${patientId}`;

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ prescription, onClose }) => {
  const { addPrescription, updatePrescription, patients } = usePatients();
  // 每次開啟 modal 時讀取一次（已儲存的設定）
  const medSettings = useMemo(() => getMedicationSettings(), []);

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

  const normalizeDateToISO = (value: unknown): string => {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState(() => {
    // 新增處方，且有预填院友 id，嘗試從 localStorage 讀取該院友上次登記的處方水指
    let prefill: { prescription_date?: string; start_date?: string; medication_source?: string } = {};
    if (!prescription?.id && prescription?.patient_id) {
      try {
        const raw = localStorage.getItem(LAST_RX_KEY(prescription.patient_id));
        if (raw) prefill = JSON.parse(raw);
      } catch { /* ignore */ }
    }
    return {
      patient_id: prescription?.patient_id || '',
      medication_name: prescription?.medication_name || '',
      medication_source: prescription?.medication_source || prefill.medication_source || '',
      medication_source_specialty: prescription?.medication_source_specialty || '',
      medication_quantity: prescription?.medication_quantity || '',
      prescription_date: prescription?.prescription_date || prefill.prescription_date || getHongKongDate(),
      start_date: prescription?.start_date || prefill.start_date || getHongKongDate(),
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
    };
  });

  const [startDateMode, setStartDateMode] = useState<'manual' | 'admission'>('manual');
  const selectedPatient = patients.find((p: any) => String(p?.院友id) === String(formData.patient_id));
  const admissionDateIso = normalizeDateToISO(selectedPatient?.入住日期);

  // 所選機構的類別（ha/dh/other），供藥物數量必填判定
  const institutionCategory = useMemo(
    () => getInstitutionCategory(formData.medication_source, medSettings),
    [formData.medication_source, medSettings]
  );
  // 是否需要藥物數量（機構屬醫管局/衛生署 且 單位為粒或膠囊）
  const quantityRequired = useMemo(
    () => (institutionCategory === 'ha' || institutionCategory === 'dh')
      && ['粒', '膠囊'].includes(formData.dosage_unit),
    [institutionCategory, formData.dosage_unit]
  );
  // 預計結束日期（僅在無明確結束日期時推算）
  const estimatedEndDate = useMemo(
    () => computeEstimatedEndDate({
      prescription_date: formData.prescription_date,
      end_date: formData.end_date,
      medication_quantity: formData.medication_quantity,
      dosage_amount: formData.dosage_amount,
      daily_frequency: formData.daily_frequency,
      medication_time_slots: formData.medication_time_slots,
      frequency_type: formData.frequency_type,
      frequency_value: formData.frequency_value,
      specific_weekdays: formData.specific_weekdays,
      is_odd_even_day: formData.is_odd_even_day,
    }),
    [formData.prescription_date, formData.end_date, formData.medication_quantity, formData.dosage_amount, formData.daily_frequency, formData.medication_time_slots, formData.frequency_type, formData.frequency_value, formData.specific_weekdays, formData.is_odd_even_day]
  );

  const [inspectionRules, setInspectionRules] = useState(
    prescription?.inspection_rules || []
  );

  const [newTimeSlot, setNewTimeSlot] = useState('');

  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string>('');
  const [showContradictionModal, setShowContradictionModal] = useState(false);
  const [contradictionDetails, setContradictionDetails] = useState<string>('');

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

  useEffect(() => {
    if (startDateMode !== 'admission') return;
    if (!admissionDateIso) return;
    setFormData(prev => (prev.start_date === admissionDateIso ? prev : { ...prev, start_date: admissionDateIso }));
  }, [startDateMode, admissionDateIso]);

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

    // 驗證服用時間點數量與每日服用次數的一致性（矛盾時以 Modal 提醒）
    const freqLabel = (n: number): string => ({ 1: 'QD（每日1次）', 2: 'BID（每日2次）', 3: 'TID（每日3次）', 4: 'QID（每日4次）' }[n] ?? `每日${n}次`);

    if (!formData.is_prn) {
      const expectedTimeSlots = formData.daily_frequency || 1;
      const actualTimeSlots = formData.medication_time_slots.length;
      if (actualTimeSlots !== expectedTimeSlots) {
        setContradictionDetails(
          `定服藥物的服用時間點數量與每日服用次數不符。\n\n每日次數：${freqLabel(expectedTimeSlots)}\n已設時間點：${actualTimeSlots} 個\n\n請補齊全部 ${expectedTimeSlots} 個時間點，或將每日次數改為 ${actualTimeSlots}。`
        );
        setShowContradictionModal(true);
        return;
      }
    } else {
      if (formData.medication_time_slots.length > formData.daily_frequency) {
        setContradictionDetails(
          `需要時服（PRN）的時間點數量超過每日次數上限。\n\n每日次數上限：${freqLabel(formData.daily_frequency)}\n已設時間點：${formData.medication_time_slots.length} 個\n\n請移除多餘的時間點，或將每日次數上限調高。`
        );
        setShowContradictionModal(true);
        return;
      }
    }

    // 驗證停用處方必須有結束日期
    if (formData.status === 'inactive' && !formData.end_date) {
      setValidationError('停用處方必須設定結束日期');
      return;
    }

    // 停用攔截：若是現有處方且狀態從非停用改為停用，檢查是否有逾期未完成的執核派記錄
    if (formData.status === 'inactive' && prescription?.id && prescription?.status !== 'inactive') {
      const { data: pendingRecords, error: checkError } = await supabase
        .from('medication_workflow_records')
        .select('scheduled_date, scheduled_time')
        .eq('prescription_id', prescription.id)
        .eq('dispensing_status', 'pending');

      if (!checkError && pendingRecords && pendingRecords.length > 0) {
        const now = new Date();
        const overdueRecords = pendingRecords.filter(r => {
          const dt = new Date(`${r.scheduled_date}T${r.scheduled_time}`);
          return dt < now;
        });
        if (overdueRecords.length > 0) {
          const overdueDates = [...new Set(overdueRecords.map(r => r.scheduled_date))]
            .sort()
            .join('\n');
          setValidationError(
            `無法停用：以下日期有未完成的執核派記錄，請先在 eMAR 補齊後再停用：\n${overdueDates}`
          );
          return;
        }
      }
    }

    // 驗證：機構屬醫管局/衛生署 且 單位為粒/膠囊 時，藥物數量必填
    if (quantityRequired) {
      const q = parseFloat(String(formData.medication_quantity));
      if (!formData.medication_quantity || !Number.isFinite(q) || q <= 0) {
        setValidationError('此來源（醫管局／衛生署）且單位為粒／膠囊的處方，必須輸入有效的藥物數量才能儲存');
        return;
      }
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
        medication_source_specialty: formData.medication_source_specialty || null,
        medication_quantity: formData.medication_quantity,
        estimated_end_date: estimatedEndDate || null,
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
        // 成功新增後將門診日期、開始日期、藥物來源儲存至 localStorage 位院友
        if (formData.patient_id) {
          try {
            localStorage.setItem(LAST_RX_KEY(formData.patient_id), JSON.stringify({
              prescription_date: formData.prescription_date,
              start_date: formData.start_date,
              medication_source: formData.medication_source,
            }));
          } catch { /* ignore quota errors */ }
        }
      }
      
      onClose();
    } catch (error: any) {
      // 若 DB 欄位不存在（migration 未套用），退回不含新欄位重試
      const msg: string = error?.message || error?.error_description || JSON.stringify(error) || '';
      const isColumnMissing = msg.includes('column') && (msg.includes('does not exist') || msg.includes('unknown'));
      if (isColumnMissing) {
        try {
          const { medication_source_specialty: _sp, estimated_end_date: _ed, ...fallbackData } = prescriptionData as any;
          if (prescription && prescription.id) {
            await updatePrescription({ id: prescription.id, ...fallbackData });
          } else {
            await addPrescription(fallbackData);
          }
          onClose();
          return;
        } catch (retryError) {
          console.error('儲存處方失敗（退回重試）:', retryError);
        }
      }
      console.error('儲存處方失敗:', error);
      setValidationError('儲存處方失敗，請重試');
    }
  };

  const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
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
                    const matchedPatient = patients.find((p: any) => String(p?.院友id) === String(patientId));
                    const matchedAdmissionDate = normalizeDateToISO(matchedPatient?.入住日期);
                    setFormData(prev => ({
                      ...prev,
                      patient_id: patientId,
                      start_date: startDateMode === 'admission' && matchedAdmissionDate
                        ? matchedAdmissionDate
                        : prev.start_date,
                    }));
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
                  藥物來源機構 *
                  {renderFieldIndicator('medication_source')}
                </label>
                <select
                  name="medication_source"
                  value={formData.medication_source}
                  onChange={handleChange}
                  className={getFieldClassName('medication_source', 'form-input')}
                  required
                >
                  <option value="">— 請選擇機構 —</option>
                  {INSTITUTION_GROUPS.map((g) => {
                    const list = (medSettings[g.key] as string[]) || [];
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={g.label} label={g.label}>
                        {list.map((src) => (
                          <option key={src} value={src}>{src}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {/* 舊資料相容：若目前值不在任何清單中，仍可顯示 */}
                  {formData.medication_source &&
                    !INSTITUTION_GROUPS.some(g => ((medSettings[g.key] as string[]) || []).includes(formData.medication_source)) && (
                    <option value={formData.medication_source}>{formData.medication_source}（既有）</option>
                  )}
                </select>
              </div>

              <div>
                <label className="form-label">
                  藥物來源專科
                  {renderFieldIndicator('medication_source_specialty')}
                </label>
                <select
                  name="medication_source_specialty"
                  value={formData.medication_source_specialty}
                  onChange={handleChange}
                  className={getFieldClassName('medication_source_specialty', 'form-input')}
                >
                  <option value="">— 請選擇專科（選填）—</option>
                  {medSettings.專科.map((sp) => (
                    <option key={sp} value={sp}>{sp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  藥物數量{quantityRequired && ' *'}
                  {renderFieldIndicator('medication_quantity')}
                </label>
                <input
                  type="number"
                  name="medication_quantity"
                  value={formData.medication_quantity}
                  onChange={handleChange}
                  className={getFieldClassName('medication_quantity', 'form-input')}
                  placeholder="例如：30"
                  min="0"
                  step="0.5"
                  required={quantityRequired}
                />
                {quantityRequired && (
                  <p className="text-xs text-amber-600 mt-1">此來源屬醫管局／衛生署，須輸入藥物數量。</p>
                )}
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
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="text-lg font-medium text-gray-900">服用時間設定</h3>
              </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  開始日期 *
                </label>
                <div className="flex gap-4 mb-2">
                  {([
                    { value: 'manual', label: '手動輸入日期' },
                    { value: 'admission', label: '入住前（日期不詳）' },
                  ] as const).map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="startDateMode"
                        value={value}
                        checked={startDateMode === value}
                        onChange={() => {
                          setStartDateMode(value);
                          if (value === 'admission') {
                            if (admissionDateIso) {
                              setFormData(prev => ({ ...prev, start_date: admissionDateIso }));
                            } else {
                              setValidationError('此院友尚未設定入住日期，請先在院友資料補上，或改用手動輸入開始日期。');
                            }
                          }
                        }}
                        className="accent-blue-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {startDateMode === 'admission' && admissionDateIso ? (
                  <>
                    <input type="hidden" name="start_date" value={formData.start_date} />
                    <input
                      type="text"
                      value="不詳"
                      className="form-input bg-gray-100 text-gray-500"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-gray-400 mt-1">入住前 — 以入住日（{admissionDateIso}）作記錄</p>
                  </>
                ) : (
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                )}
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
                <label className="form-label">結束日期 {formData.end_date
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">短期藥物</span>
                : <span className="text-xs font-semibold px-2 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">如屬長期藥物無需填寫</span>
              }</label>
                
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

            {/* 預計結束日期（推算值，僅在沒有明確結束日期的長期藥物顯示） */}
            {!formData.end_date && (
              <div className="mt-2 rounded-lg border border-dashed border-blue-300 bg-white/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">預計結束日期</span>
                  {estimatedEndDate
                    ? <span className="text-sm font-semibold text-blue-700">{estimatedEndDate}</span>
                    : <span className="text-sm text-gray-400">需填藥物數量、服用份量、每日次數方可推算</span>}
                </div>
              </div>
            )}
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
                  {medSettings.劑型.map(v => <option key={v} value={v}>{v}</option>)}
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
                  {medSettings.服用途徑.map(v => <option key={v} value={v}>{v}</option>)}
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
                  {medSettings.每日次數.map(n => {
                    const labels: Record<number,string> = {1:'QD',2:'BD',3:'TDS',4:'QID'};
                    return <option key={n} value={n}>{labels[n] ? `${labels[n]} (每日${n}次)` : `每日${n}次`}</option>;
                  })}
                </select>
              </div>

              {/* 服用份量/單位 與 特殊用法 互斥選擇 */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      name="dosage_type"
                      checked={!formData.special_dosage_instruction}
                      onChange={() => setFormData(prev => ({ ...prev, special_dosage_instruction: '' }))}
                      className="form-radio"
                    />
                    <span className="text-sm font-medium">使用份量和單位</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        {medSettings.服用單位.map(v => <option key={v} value={v}>{v}</option>)}
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
                      {medSettings.特殊用法.filter(v => v !== '適量').map(v => <option key={v} value={v}>{v}</option>)}
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
                  {medSettings.服用時段.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                  className="btn-secondary flex flex-wrap items-center gap-2 text-sm h-8"
                  title="根據服用次數和服用時段智能分配時間點"
                >
                  <Clock className="h-4 w-4" />
                  <span>智能分配時間 {formData.meal_timing && `(${formData.meal_timing})`}</span>
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
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
                  className="btn-secondary flex flex-wrap items-center gap-2 h-8 px-3 text-sm"
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
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-2 bg-white border border-yellow-300 rounded-lg"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
                檢測項設定
              </h3>
              <button
                type="button"
                onClick={addInspectionRule}
                className="btn-secondary flex flex-wrap items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增檢測項</span>
              </button>
            </div>

            {inspectionRules.length > 0 ? (
              <div className="space-y-3">
                {inspectionRules.map((rule, index) => (
                  <div key={index} className="bg-white border border-orange-200 rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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
                          <option value="block_dispensing">停服</option>
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
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
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

      {/* 處方矛盾提醒 Modal */}
      {showContradictionModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[60] bg-black bg-opacity-60"
          onClick={() => setShowContradictionModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">處方資料有矛盾</h3>
                <p className="text-sm text-amber-800 whitespace-pre-line">{contradictionDetails}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                onClick={() => setShowContradictionModal(false)}
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionModal;