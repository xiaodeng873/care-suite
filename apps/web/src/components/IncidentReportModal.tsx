import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Calendar, User, FileText, Activity, Plus, Trash2 } from 'lucide-react';
import { usePatients, type IncidentReport } from '../context/PatientContext';
import { useRecords } from '../context/merged/RecordsContext';
import PatientAutocomplete from './PatientAutocomplete';
import { getIncidentPresetOptions, createIncidentPresetOption, deleteIncidentPresetOption, type IncidentPresetOption } from '../lib/database';

interface IncidentReportModalProps {
  report?: IncidentReport;
  onClose: () => void;
}

const IncidentReportModal: React.FC<IncidentReportModalProps> = ({ report, onClose }) => {
  const { patients, addIncidentReport, updateIncidentReport } = usePatients();
  const { patrolRounds } = useRecords();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: report?.patient_id?.toString() || '',
    incident_date: report?.incident_date || getHongKongDate(),
    incident_time: report?.incident_time || '',
    incident_type: report?.incident_type || '跌倒',
    other_incident_type: report?.other_incident_type || '',
    location: report?.location || '',
    other_location: report?.other_location || '',
    patient_activity: report?.patient_activity || '',
    other_patient_activity: report?.other_patient_activity || '',
    physical_discomfort: report?.physical_discomfort || {},
    unsafe_behavior: report?.unsafe_behavior || {},
    environmental_factors: report?.environmental_factors || {},
    witness_found_by: report?.witness_found_by || { type: '', details: '' },
    injury_location: report?.injury_location || '',
    incident_details: report?.incident_details || '',
    treatment_date: report?.treatment_date || '',
    treatment_time: report?.treatment_time || '',
    vital_signs: report?.vital_signs || {},
    consciousness_level: report?.consciousness_level || '',
    limb_movement: report?.limb_movement || { status: '', details: '', abnormal_limbs: [] },
    injury_situation: report?.injury_situation || {},
    patient_complaint: report?.patient_complaint || '',
    immediate_treatment: report?.immediate_treatment || {},
    medical_arrangement: report?.medical_arrangement || '',
    ambulance_call_time: report?.ambulance_call_time || '',
    ambulance_arrival_time: report?.ambulance_arrival_time || '',
    ambulance_departure_time: report?.ambulance_departure_time || '',
    hospital_destination: report?.hospital_destination || '',
    last_patrol_time: report?.last_patrol_time || '',
    family_notification_date: report?.family_notification_date || '',
    family_notification_time: report?.family_notification_time || '',
    family_name: report?.family_name || '',
    family_relationship: report?.family_relationship || '',
    other_family_relationship: report?.other_family_relationship || '',
    contact_phone: report?.contact_phone || '',
    notifying_staff_name: report?.notifying_staff_name || '',
    notifying_staff_position: report?.notifying_staff_position || '',
    hospital_treatment: report?.hospital_treatment || {},
    hospital_admission: report?.hospital_admission || {},
    return_time: report?.return_time || '',
    submit_to_social_welfare: report?.submit_to_social_welfare || false,
    submit_to_headquarters: report?.submit_to_headquarters || false,
    immediate_improvement_actions: report?.immediate_improvement_actions || '',
    prevention_methods: report?.prevention_methods || '',
    reporter_signature: report?.reporter_signature || '',
    reporter_position: report?.reporter_position || '',
    report_date: report?.report_date || getHongKongDate(),
    director_review_date: report?.director_review_date || '',
    submit_to_headquarters_flag: report?.submit_to_headquarters_flag || false,
    submit_to_social_welfare_flag: report?.submit_to_social_welfare_flag || false
  });

  const locationOptions = ['客廳/飯廳', '走廊', '廁所', '浴室', '床邊', '其他地方'];
  const activityOptions = ['躺臥', '站立', '步行', '起身下床/上床', '過床/椅/便椅/沖涼椅', '進食', '梳洗', '如廁', '洗澡', '穿/脫衣服', '其他'];
  const discomfortOptions = ['下肢乏力', '關節疼痛', '暈眩', '暈倒', '心跳', '胸部劑痛', '其他', '不適用'];
  const unsafeBehaviorOptions = ['不安全的動作', '沒有使用合適輔助工具', '沒有找人幫助', '其他', '不適用'];
  const environmentalOptions = ['地面濕滑/不平', '光線不足', '傢俬移動(如輪椅/便椅未上鎖)', '雜物障礙', '褲過長', '鞋覆問題', '被別人碰到', '其他', '不適用'];
  const consciousnessOptions = ['清醒', '混亂', '昏迷'];
  const injuryOptions = ['無皮外傷', '表皮擦損', '瘀腫', '骨折', '其他'];
  const treatmentOptions = ['包紮傷口', '其他', '不適用'];
  const medicalArrangementOptions = ['急症室', '門診', '醫生到診', '沒有送院'];
  const relationshipOptions = ['保證人', '監護人', '家人', '其他'];
  const hospitalTreatmentOptions = ['照X光', '預防破傷風針注射', '洗傷口', '縫針', '不需要留醫', '返回護理院/家', '其他治療(例如藥物等)', '醫院留醫'];

  const handleCheckboxChange = (category: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const newCategoryData = { ...prev[category] };

      // 如果選擇「不適用」，清空其他所有選項
      if (option === '不適用' && checked) {
        // 清空該類別的所有其他選項
        Object.keys(newCategoryData).forEach(key => {
          if (key !== '不適用') {
            newCategoryData[key] = false;
          }
        });
        newCategoryData['不適用'] = true;
      }
      // 如果選擇其他選項，取消「不適用」
      else if (option !== '不適用' && checked && newCategoryData['不適用']) {
        newCategoryData['不適用'] = false;
        newCategoryData[option] = true;
      }
      // 正常處理
      else {
        newCategoryData[option] = checked;
      }

      return {
        ...prev,
        [category]: newCategoryData
      };
    });
  };

  const handleHospitalTreatmentChange = (option: string, checked: boolean) => {
    setFormData(prev => {
      const newHospitalTreatment = { ...prev.hospital_treatment };

      // 如果選擇「不需要留醫」，取消「醫院留醫」及其子選項
      if (option === '不需要留醫' && checked) {
        newHospitalTreatment['醫院留醫'] = false;
        newHospitalTreatment['觀察病房'] = false;
      }

      // 如果選擇「醫院留醫」，取消「不需要留醫」
      if (option === '醫院留醫' && checked) {
        newHospitalTreatment['不需要留醫'] = false;
      }

      // 如果取消「醫院留醫」，也取消「觀察病房」
      if (option === '醫院留醫' && !checked) {
        newHospitalTreatment['觀察病房'] = false;
      }

      // 設置當前選項的值
      newHospitalTreatment[option] = checked;

      return {
        ...prev,
        hospital_treatment: newHospitalTreatment
      };
    });
  };

  const handleLimbMovementChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      limb_movement: {
        ...prev.limb_movement,
        [field]: value
      }
    }));
  };

  const handleLimbCheckboxChange = (limb: string, checked: boolean) => {
    setFormData(prev => {
      const currentLimbs = prev.limb_movement?.abnormal_limbs || [];
      const newLimbs = checked
        ? [...currentLimbs, limb]
        : currentLimbs.filter(l => l !== limb);

      return {
        ...prev,
        limb_movement: {
          ...prev.limb_movement,
          abnormal_limbs: newLimbs
        }
      };
    });
  };

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPatrolTimePopover, setShowPatrolTimePopover] = useState(false);
  const [recentPatrolTimes, setRecentPatrolTimes] = useState<Array<{ time: string; date: string }>>([]);
  
  // 預設選項相關狀態
  const [immediateImprovementOptions, setImmediateImprovementOptions] = useState<IncidentPresetOption[]>([]);
  const [preventionMethodsOptions, setPreventionMethodsOptions] = useState<IncidentPresetOption[]>([]);
  const [showImmediateOptionsModal, setShowImmediateOptionsModal] = useState(false);
  const [showPreventionOptionsModal, setShowPreventionOptionsModal] = useState(false);
  const [selectedImmediateOptions, setSelectedImmediateOptions] = useState<Set<string>>(new Set());
  const [selectedPreventionOptions, setSelectedPreventionOptions] = useState<Set<string>>(new Set());
  const [newImmediateActionText, setNewImmediateActionText] = useState('');
  const [newPreventionMethodText, setNewPreventionMethodText] = useState('');

  // 日期時間格式化函數 - 中文格式 "年月日時分"
  const formatDateTimeChinese = (date: string, time?: string) => {
    let result = '';
    if (date) {
      const [year, month, day] = date.split('-');
      result = `${year}年${parseInt(month)}月${parseInt(day)}日`;
    }
    if (time) {
      const [hour, minute] = time.split(':');
      result += `${parseInt(hour)}時${parseInt(minute)}分`;
    }
    return result;
  };

  // 載入預設選項
  useEffect(() => {
    const loadPresetOptions = async () => {
      try {
        const [immediateOptions, preventionOptions] = await Promise.all([
          getIncidentPresetOptions('immediate_improvement_actions'),
          getIncidentPresetOptions('prevention_methods')
        ]);
        setImmediateImprovementOptions(immediateOptions);
        setPreventionMethodsOptions(preventionOptions);
      } catch (error) {
        console.error('載入預設選項失敗:', error);
        alert(`預設選項載入失敗：${error instanceof Error ? error.message : '請確保 Supabase 表格已創建'}`);
      }
    };
    
    loadPresetOptions();
  }, []);

  // 當彈出表格顯示時，獲取最近的巡房時間
  useEffect(() => {
    if (showPatrolTimePopover && formData.patient_id && formData.incident_date && patrolRounds.length > 0) {
      const patientId = parseInt(formData.patient_id);
      const incidentDate = formData.incident_date;

      // 篩選該院友在意外發生日期之前的巡房記錄
      const recentPatrols = patrolRounds
        .filter(pr => pr.patient_id === patientId && pr.patrol_date <= incidentDate)
        .sort((a, b) => {
          // 先按日期倒序，再按時間倒序，找最近的
          const dateCompare = new Date(b.patrol_date).getTime() - new Date(a.patrol_date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return (b.patrol_time || '').localeCompare(a.patrol_time || '');
        })
        .slice(0, 5) // 只顯示最近 5 筆
        .map(pr => ({
          time: pr.patrol_time || '',
          date: pr.patrol_date
        }));

      setRecentPatrolTimes(recentPatrols);
    }
  }, [showPatrolTimePopover, formData.patient_id, formData.incident_date, patrolRounds]);

  // 生成意外經過摘要
  const generateIncidentSummary = () => {
    const patient = patients.find(p => p.院友id === parseInt(formData.patient_id));
    if (!patient) {
      alert('請先選擇院友');
      return;
    }

    // 日期時間格式化
    const incidentDateFormatted = formatDateTimeChinese(formData.incident_date, formData.incident_time);
    
    let summary = '';

    // 基本信息
    summary += `院友${patient.中文姓名}於${incidentDateFormatted}，在${formData.location || ''}${formData.patient_activity || ''}時`;

    // 身體不適（如有且不是"不適用"）
    const discomfortReasons = Object.entries(formData.physical_discomfort || {})
      .filter(([key, val]) => val === true && key !== '不適用')
      .map(([key]) => key);
    if (discomfortReasons.length > 0) {
      summary += `，院友${discomfortReasons.join('、')}`;
    }

    // 不安全行為（如有且不是"不適用"）
    const unsafeBehaviors = Object.entries(formData.unsafe_behavior || {})
      .filter(([key, val]) => val === true && key !== '不適用')
      .map(([key]) => key === '其他' ? (formData.unsafe_behavior['其他說明'] || '其他') : key);
    if (unsafeBehaviors.length > 0) {
      summary += `及${unsafeBehaviors.join('、')}`;
    }

    // 環境/個人因素（如有且不是"不適用"）
    const envFactors = Object.entries(formData.environmental_factors || {})
      .filter(([key, val]) => val === true && key !== '不適用')
      .map(([key]) => key === '其他' ? (formData.environmental_factors['其他說明'] || '其他') : key);
    if (envFactors.length > 0) {
      summary += `，加上${envFactors.join('、')}`;
    }

    // 事故性質
    summary += `，導致${formData.incident_type}${formData.other_incident_type ? '（' + formData.other_incident_type + '）' : ''}`;

    // 最後巡房時間
    if (formData.last_patrol_time) {
      summary += `，最後巡房時間${formData.last_patrol_time}`;
    }

    // 目擊者/發現者（若未填寫名字則不顯示）
    if (formData.witness_found_by?.type && formData.witness_found_by?.details) {
      const typeAction = formData.witness_found_by.type === 'witness' ? '目擊' : '發現';
      summary += `，由${formData.witness_found_by.details}${typeAction}`;
    }

    // 著地部位
    if (formData.injury_location) {
      summary += `，院友${formData.injury_location}著地`;
    }

    // 清醒程度
    if (formData.consciousness_level) {
      summary += `，院友當時${formData.consciousness_level}`;
    }

    // 四肢活動
    if (formData.limb_movement?.status) {
      const limbStatus = formData.limb_movement.status === '正常'
        ? '正常'
        : `不正常（${(formData.limb_movement.abnormal_limbs || []).join('、')}）${formData.limb_movement.details ? '（' + formData.limb_movement.details + '）' : ''}`;
      summary += `，四肢活動${limbStatus}`;
    }

    // 受傷情況
    const injuries = Object.entries(formData.injury_situation || {})
      .filter(([, val]) => val === true)
      .map(([key]) => {
        if (key === '其他') {
          return formData.injury_situation['其他'] ? `其他（${formData.injury_situation['其他']}）` : '其他';
        }
        const locationKey = `${key}位置`;
        if (formData.injury_situation[locationKey]) {
          return `${key}（${formData.injury_situation[locationKey]}）`;
        }
        return key;
      });
    if (injuries.length > 0) {
      summary += `，${injuries.join('、')}`;
    }

    // 院友申訴
    if (formData.patient_complaint) {
      summary += `，申訴${formData.patient_complaint}`;
    } else {
      summary += `，沒有申訴`;
    }

    // 血壓、脈搏、呼吸、體溫、血含氧量
    const vitalSigns = formData.vital_signs || {};
    if (vitalSigns.blood_pressure_systolic && vitalSigns.blood_pressure_diastolic) {
      summary += `，院友當時血壓${vitalSigns.blood_pressure_systolic}/${vitalSigns.blood_pressure_diastolic}mmHg`;
    }
    if (vitalSigns.pulse) {
      summary += `，${vitalSigns.pulse}/min`;
    }
    if (vitalSigns.respiration) {
      summary += `，${vitalSigns.respiration}/min`;
    }
    if (vitalSigns.temperature) {
      summary += `，${vitalSigns.temperature}°C`;
    }
    if (vitalSigns.oxygen_saturation) {
      summary += `，${vitalSigns.oxygen_saturation}%`;
    }

    // 即時處理
    const treatments = Object.entries(formData.immediate_treatment || {})
      .filter(([key, val]) => val === true && key !== '不適用')
      .map(([key]) => key === '其他' ? (formData.immediate_treatment['其他說明'] || '其他') : key);
    if (treatments.length > 0) {
      summary += `，職員即時為院友${treatments.join('、')}`;
    }

    // 家屬通知信息
    if (formData.notifying_staff_position || formData.notifying_staff_name || formData.family_notification_date || formData.family_notification_time) {
      summary += `，並由${formData.notifying_staff_position || ''}${formData.notifying_staff_name || ''}於${formatDateTimeChinese(formData.family_notification_date, formData.family_notification_time)}通知${formData.family_relationship || ''}${formData.family_name || ''}`;
    }

    // 就診安排
    if (formData.medical_arrangement) {
      let medicalArrangementText = formData.medical_arrangement;
      
      // 根據實際選項值轉換為摘要文案
      if (formData.medical_arrangement === '急症室') {
        medicalArrangementText = '前往急症室';
      } else if (formData.medical_arrangement === '門診') {
        medicalArrangementText = '前往門診';
      } else if (formData.medical_arrangement === '醫生到診') {
        medicalArrangementText = '等待醫生到診';
      } else if (formData.medical_arrangement === '沒有送院') {
        medicalArrangementText = '保持觀察，無需送院';
      }
      
      summary += `，商議後決定${medicalArrangementText}`;
    }

    // 醫院診治情況
    if (formData.hospital_treatment && Object.keys(formData.hospital_treatment).length > 0) {
      const hospitalTreatments = Object.entries(formData.hospital_treatment)
        .filter(([, val]) => val === true)
        .map(([key]) => key);
      if (hospitalTreatments.length > 0) {
        summary += `，院友需要${hospitalTreatments.join('、')}`;
      }
    }

    summary += '。';

    // 直接插入到 incident_details，不顯示預覽框
    setFormData(prev => ({
      ...prev,
      incident_details: summary
    }));
    
   
  };

  // 插入選中的即時改善行動選項到 textarea
  const insertSelectedImmediateActions = () => {
    const selectedTexts = immediateImprovementOptions
      .filter(opt => selectedImmediateOptions.has(opt.id))
      .map(opt => opt.option_text);
    
    if (selectedTexts.length === 0) return;
    
    const newText = selectedTexts.join('；');
    setFormData(prev => ({
      ...prev,
      immediate_improvement_actions: prev.immediate_improvement_actions 
        ? `${prev.immediate_improvement_actions}；${newText}`
        : newText
    }));
    
    setSelectedImmediateOptions(new Set());
    setShowImmediateOptionsModal(false);
  };

  // 插入選中的預防方法選項到 textarea
  const insertSelectedPreventionMethods = () => {
    const selectedTexts = preventionMethodsOptions
      .filter(opt => selectedPreventionOptions.has(opt.id))
      .map(opt => opt.option_text);
    
    if (selectedTexts.length === 0) return;
    
    const newText = selectedTexts.join('；');
    setFormData(prev => ({
      ...prev,
      prevention_methods: prev.prevention_methods 
        ? `${prev.prevention_methods}；${newText}`
        : newText
    }));
    
    setSelectedPreventionOptions(new Set());
    setShowPreventionOptionsModal(false);
  };

  // 添加新的即時改善行動選項
  const addNewImmediateAction = async () => {
    if (!newImmediateActionText.trim()) {
      alert('請輸入新的即時改善行動');
      return;
    }

    const newOption = await createIncidentPresetOption('immediate_improvement_actions', newImmediateActionText);
    if (newOption) {
      setImmediateImprovementOptions(prev => [...prev, newOption]);
      setNewImmediateActionText('');
    }
  };

  // 添加新的預防方法選項
  const addNewPreventionMethod = async () => {
    if (!newPreventionMethodText.trim()) {
      alert('請輸入新的預防方法');
      return;
    }

    const newOption = await createIncidentPresetOption('prevention_methods', newPreventionMethodText);
    if (newOption) {
      setPreventionMethodsOptions(prev => [...prev, newOption]);
      setNewPreventionMethodText('');
    }
  };

  // 刪除預設選項
  const deletePresetOption = async (id: string, optionType: 'immediate_improvement_actions' | 'prevention_methods') => {
    if (!window.confirm('確定要刪除此選項嗎？')) return;

    const success = await deleteIncidentPresetOption(id);
    if (success) {
      if (optionType === 'immediate_improvement_actions') {
        setImmediateImprovementOptions(prev => prev.filter(opt => opt.id !== id));
      } else {
        setPreventionMethodsOptions(prev => prev.filter(opt => opt.id !== id));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: string[] = [];

    // 基本必填欄位驗證
    if (!formData.patient_id) {
      errors.push('請選擇院友');
    }

    if (!formData.incident_date) {
      errors.push('請輸入意外發生日期');
    }

    if (!formData.reporter_signature) {
      errors.push('請輸入填報人簽名');
    }

    if (!formData.reporter_position) {
      errors.push('請輸入填報人職位');
    }

    // 時間邏輯驗證
    if (formData.ambulance_call_time && formData.ambulance_arrival_time) {
      if (formData.ambulance_call_time >= formData.ambulance_arrival_time) {
        errors.push('召車時間必須早於到達時間');
      }
    }

    if (formData.ambulance_arrival_time && formData.ambulance_departure_time) {
      if (formData.ambulance_departure_time <= formData.ambulance_arrival_time) {
        errors.push('離開時間必須晚於到達時間');
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);

    try {
      const reportData = {
        ...formData,
        patient_id: parseInt(formData.patient_id),
        incident_time: formData.incident_time || null,
        treatment_date: formData.treatment_date || null,
        treatment_time: formData.treatment_time || null,
        ambulance_call_time: formData.ambulance_call_time || null,
        ambulance_arrival_time: formData.ambulance_arrival_time || null,
        ambulance_departure_time: formData.ambulance_departure_time || null,
        family_notification_date: formData.family_notification_date || null,
        family_notification_time: formData.family_notification_time || null,
        return_time: formData.return_time || null,
        last_patrol_time: formData.last_patrol_time || null,
        director_review_date: formData.director_review_date || null
      };

      if (report) {
        await updateIncidentReport({
          ...reportData,
          id: report.id,
          created_at: report.created_at,
          updated_at: report.updated_at
        });
      } else {
        await addIncidentReport(reportData);
      }

      onClose();
    } catch (error) {
      console.error('儲存意外事件報告失敗:', error);
      setValidationErrors(['儲存意外事件報告失敗，請重試']);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {report ? '編輯意外事件報告' : '新增意外事件報告'}
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
          {/* 基本資訊 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              基本資訊
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>

              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  意外發生日期 *
                </label>
                <input
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  意外發生時間
                </label>
                <input
                  type="time"
                  value={formData.incident_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, incident_time: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="form-label">事故性質</label>
                <div className="space-y-2">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.incident_type === '跌倒'}
                      onChange={() => setFormData(prev => ({ ...prev, incident_type: '跌倒', other_incident_type: '' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">跌倒</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.incident_type === '其他'}
                      onChange={() => setFormData(prev => ({ ...prev, incident_type: '其他' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">其他</span>
                  </label>
                  {formData.incident_type === '其他' && (
                    <input
                      type="text"
                      value={formData.other_incident_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, other_incident_type: e.target.value }))}
                      className="form-input text-sm ml-6"
                      placeholder="請輸入其他事故性質..."
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">地點</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {locationOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.location === option}
                        onChange={() => setFormData(prev => ({ ...prev, location: option, other_location: '' }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.location === '其他地方' && (
                  <input
                    type="text"
                    value={formData.other_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, other_location: e.target.value }))}
                    className="form-input text-sm mt-2"
                    placeholder="請輸入其他地點..."
                  />
                )}
              </div>
            </div>
          </div>

          {/* 意外發生經過 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-orange-600" />
              意外發生經過
            </h3>

            <div className="space-y-4">
              <div>
                <label className="form-label">院友活動</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {activityOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.patient_activity === option}
                        onChange={() => setFormData(prev => ({ ...prev, patient_activity: option, other_patient_activity: '' }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.patient_activity === '其他' && (
                  <input
                    type="text"
                    value={formData.other_patient_activity}
                    onChange={(e) => setFormData(prev => ({ ...prev, other_patient_activity: e.target.value }))}
                    className="form-input text-sm mt-2"
                    placeholder="請輸入其他活動..."
                  />
                )}
              </div>

              <div>
                <label className="form-label">院友身體不適（複選）</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {discomfortOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.physical_discomfort[option] || false}
                        onChange={(e) => handleCheckboxChange('physical_discomfort', option, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.physical_discomfort['其他'] && (
                  <input
                    type="text"
                    value={formData.physical_discomfort['其他說明'] || ''}
                    onChange={(e) => handleCheckboxChange('physical_discomfort', '其他說明', e.target.value)}
                    className="form-input text-sm mt-2"
                    placeholder="請詳細說明..."
                  />
                )}
              </div>

              <div>
                <label className="form-label">院友不安全的行為（複選）</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {unsafeBehaviorOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.unsafe_behavior[option] || false}
                        onChange={(e) => handleCheckboxChange('unsafe_behavior', option, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.unsafe_behavior['不安全的動作'] && (
                  <input
                    type="text"
                    value={formData.unsafe_behavior['不安全的動作說明'] || ''}
                    onChange={(e) => handleCheckboxChange('unsafe_behavior', '不安全的動作說明', e.target.value)}
                    className="form-input text-sm mt-2"
                    placeholder="請詳細說明不安全的動作..."
                  />
                )}
                {formData.unsafe_behavior['其他'] && (
                  <input
                    type="text"
                    value={formData.unsafe_behavior['其他說明'] || ''}
                    onChange={(e) => handleCheckboxChange('unsafe_behavior', '其他說明', e.target.value)}
                    className="form-input text-sm mt-2"
                    placeholder="請詳細說明..."
                  />
                )}
              </div>

              <div>
                <label className="form-label">環境/個人因素（複選）</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {environmentalOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.environmental_factors[option] || false}
                        onChange={(e) => handleCheckboxChange('environmental_factors', option, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
                {formData.environmental_factors['其他'] && (
                  <input
                    type="text"
                    value={formData.environmental_factors['其他說明'] || ''}
                    onChange={(e) => handleCheckboxChange('environmental_factors', '其他說明', e.target.value)}
                    className="form-input text-sm mt-2"
                    placeholder="請詳細說明..."
                  />
                )}
              </div>

              {/* 目擊者/發現者、受傷部位、最後巡房時間（三欄均分） */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 目擊者/發現者 */}
                <div>
                  <label className="form-label">目擊者/發現者</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          witness_found_by: {
                            type: formData.witness_found_by?.type === 'witness' ? '' : 'witness',
                            details: ''
                          }
                        }))}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                          formData.witness_found_by?.type === 'witness'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        目擊者
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          witness_found_by: {
                            type: formData.witness_found_by?.type === 'found_by' ? '' : 'found_by',
                            details: ''
                          }
                        }))}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                          formData.witness_found_by?.type === 'found_by'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        發現者
                      </button>
                    </div>
                    {(formData.witness_found_by?.type === 'witness' || formData.witness_found_by?.type === 'found_by') && (
                      <textarea
                        value={formData.witness_found_by?.details || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          witness_found_by: {
                            ...prev.witness_found_by,
                            details: e.target.value
                          }
                        }))}
                        className="form-input text-sm"
                        rows={1}
                        placeholder="請詳細描述..."
                      />
                    )}
                  </div>
                </div>

                {/* 著地部位 */}
                <div>
                  <label className="form-label">著地部位</label>
                  <textarea
                    value={formData.injury_location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, injury_location: e.target.value }))}
                    className="form-input text-sm"
                    rows={1}
                    placeholder="請詳細描述著地部位..."
                  />
                </div>

                {/* 最後巡房時間 */}
                <div>
                  <label className="form-label">最後巡房時間</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={formData.last_patrol_time || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_patrol_time: e.target.value }))}
                      onFocus={() => setShowPatrolTimePopover(true)}
                      className="form-input text-sm"
                    />
                    {showPatrolTimePopover && recentPatrolTimes.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-300 rounded shadow-lg z-10">
                        <div className="p-2 bg-gray-100 border-b text-xs font-semibold text-gray-700">
                          最近巡房時間
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {recentPatrolTimes.map((pt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, last_patrol_time: pt.time }));
                                setShowPatrolTimePopover(false);
                              }}
                              className="w-full text-left px-2 py-2 text-sm hover:bg-blue-100 border-b"
                            >
                              {pt.time} (日期: {pt.date})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 意外發生經過詳情 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-orange-600" />
              詳情
            </h3>
            <div className="flex justify-between items-center mb-2">
              <label className="form-label">詳細經過說明</label>
              <button
                type="button"
                onClick={generateIncidentSummary}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                生成意外經過摘要
              </button>
            </div>
            <textarea
              value={formData.incident_details}
              onChange={(e) => setFormData(prev => ({ ...prev, incident_details: e.target.value }))}
              className="form-input"
              rows={4}
              placeholder="請詳細描述意外發生的經過..."
            />
          </div>

          {/* 意外發生後處理 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-green-600" />
              意外發生後處理
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">處理日期</label>
                <input
                  type="date"
                  value={formData.treatment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, treatment_date: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">處理時間</label>
                <input
                  type="time"
                  value={formData.treatment_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, treatment_time: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">生命表徵檢查</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">血壓（收縮壓）</label>
                    <input
                      type="number"
                      value={formData.vital_signs?.blood_pressure_systolic || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, blood_pressure_systolic: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="mmHg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">血壓（舒張壓）</label>
                    <input
                      type="number"
                      value={formData.vital_signs?.blood_pressure_diastolic || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, blood_pressure_diastolic: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="mmHg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">脈搏</label>
                    <input
                      type="number"
                      value={formData.vital_signs?.pulse || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, pulse: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="/min"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">呼吸</label>
                    <input
                      type="number"
                      value={formData.vital_signs?.respiration || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, respiration: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="/min"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">體溫</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.vital_signs?.temperature || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, temperature: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="°C"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">血含氧量</label>
                    <input
                      type="number"
                      value={formData.vital_signs?.oxygen_saturation || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, oxygen_saturation: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="%"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">血糖</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.vital_signs?.blood_sugar || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, vital_signs: { ...prev.vital_signs, blood_sugar: e.target.value } }))}
                      className="form-input text-sm"
                      placeholder="mmol/L"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">清醒程度</label>
                <div className="flex flex-wrap gap-4">
                  {consciousnessOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.consciousness_level === option}
                        onChange={() => setFormData(prev => ({ ...prev, consciousness_level: option }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">四肢活動情況</label>
                <div className="space-y-2">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.limb_movement?.status === '正常'}
                      onChange={() => handleLimbMovementChange('status', '正常')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">正常</span>
                  </label>
                  <div>
                    <label className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.limb_movement?.status === '不正常'}
                        onChange={() => handleLimbMovementChange('status', '不正常')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">不正常</span>
                    </label>
                    {formData.limb_movement?.status === '不正常' && (
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {['左手', '右手', '左腳', '右腳'].map(limb => (
                            <label key={limb} className="flex flex-wrap items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.limb_movement?.abnormal_limbs?.includes(limb) || false}
                                onChange={(e) => handleLimbCheckboxChange(limb, e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">{limb}</span>
                            </label>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">詳情</label>
                          <textarea
                            value={formData.limb_movement?.details || ''}
                            onChange={(e) => handleLimbMovementChange('details', e.target.value)}
                            className="form-input text-sm"
                            rows={2}
                            placeholder="請詳細說明..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">受傷情況（複選）</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {injuryOptions.map(option => (
                    <div key={option} className="space-y-1">
                      <label className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.injury_situation[option] || false}
                          onChange={(e) => handleCheckboxChange('injury_situation', option, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                      {formData.injury_situation[option] && (option === '瘀腫' || option === '骨折' || option === '其他') && (
                        <input
                          type="text"
                          value={formData.injury_situation[`${option}位置`] || ''}
                          onChange={(e) => handleCheckboxChange('injury_situation', `${option}位置`, e.target.value)}
                          className="form-input text-sm ml-6"
                          placeholder={option === '其他' ? '請詳細說明...' : '請輸入位置...'}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">院友申訴</label>
                <textarea
                  value={formData.patient_complaint}
                  onChange={(e) => setFormData(prev => ({ ...prev, patient_complaint: e.target.value }))}
                  className="form-input"
                  rows={2}
                  placeholder="請輸入院友申訴..."
                />
              </div>

              <div>
                <label className="form-label">即時處理（複選）</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {treatmentOptions.map(option => (
                    <div key={option} className="space-y-1">
                      <label className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.immediate_treatment[option] || false}
                          onChange={(e) => handleCheckboxChange('immediate_treatment', option, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                      {formData.immediate_treatment[option] && option === '其他' && (
                        <input
                          type="text"
                          value={formData.immediate_treatment['其他說明'] || ''}
                          onChange={(e) => handleCheckboxChange('immediate_treatment', '其他說明', e.target.value)}
                          className="form-input text-sm ml-6"
                          placeholder="請詳細說明..."
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">就診安排</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {medicalArrangementOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.medical_arrangement === option}
                        onChange={() => setFormData(prev => ({ ...prev, medical_arrangement: option }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.medical_arrangement === '急症室' && (
                <div className="border-l-4 border-blue-500 pl-4">
                  <label className="form-label text-blue-700">救護車資訊</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600">召車時間</label>
                      <input
                        type="time"
                        value={formData.ambulance_call_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, ambulance_call_time: e.target.value }))}
                        className="form-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">到達時間</label>
                      <input
                        type="time"
                        value={formData.ambulance_arrival_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, ambulance_arrival_time: e.target.value }))}
                        className="form-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">離開時間</label>
                      <input
                        type="time"
                        value={formData.ambulance_departure_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, ambulance_departure_time: e.target.value }))}
                        className="form-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">送往醫院</label>
                      <input
                        type="text"
                        value={formData.hospital_destination}
                        onChange={(e) => setFormData(prev => ({ ...prev, hospital_destination: e.target.value }))}
                        className="form-input text-sm"
                        placeholder="請輸入醫院名稱..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 通知家屬 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">通知家屬</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">通知日期</label>
                <input
                  type="date"
                  value={formData.family_notification_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, family_notification_date: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">通知時間</label>
                <input
                  type="time"
                  value={formData.family_notification_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, family_notification_time: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">家屬姓名</label>
                <input
                  type="text"
                  value={formData.family_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, family_name: e.target.value }))}
                  className="form-input"
                  placeholder="請輸入家屬姓名..."
                />
              </div>
              <div>
                <label className="form-label">聯絡電話</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  className="form-input"
                  placeholder="請輸入聯絡電話..."
                />
              </div>
              <div>
                <label className="form-label">家屬與院友關係</label>
                <div className="space-y-2">
                  {relationshipOptions.map(option => (
                    <label key={option} className="flex flex-wrap items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.family_relationship === option}
                        onChange={() => setFormData(prev => ({ ...prev, family_relationship: option, other_family_relationship: '' }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                  {formData.family_relationship === '其他' && (
                    <input
                      type="text"
                      value={formData.other_family_relationship}
                      onChange={(e) => setFormData(prev => ({ ...prev, other_family_relationship: e.target.value }))}
                      className="form-input text-sm ml-6"
                      placeholder="請輸入關係..."
                    />
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="form-label">負責通知職員姓名</label>
                  <input
                    type="text"
                    value={formData.notifying_staff_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, notifying_staff_name: e.target.value }))}
                    className="form-input"
                    placeholder="請輸入職員姓名..."
                  />
                </div>
                <div>
                  <label className="form-label">職位</label>
                  <input
                    type="text"
                    value={formData.notifying_staff_position}
                    onChange={(e) => setFormData(prev => ({ ...prev, notifying_staff_position: e.target.value }))}
                    className="form-input"
                    placeholder="請輸入職位..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 院友在醫院診治情況 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">院友在醫院診治情況</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {hospitalTreatmentOptions.map(option => (
                <div key={option} className="space-y-1">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.hospital_treatment[option] || false}
                      onChange={(e) => handleHospitalTreatmentChange(option, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                  {formData.hospital_treatment[option] && option === '其他治療(例如藥物等)' && (
                    <input
                      type="text"
                      value={formData.hospital_treatment['其他治療說明'] || ''}
                      onChange={(e) => handleCheckboxChange('hospital_treatment', '其他治療說明', e.target.value)}
                      className="form-input text-sm ml-6"
                      placeholder="請詳細說明..."
                    />
                  )}
                  {formData.hospital_treatment[option] && option === '醫院留醫' && (
                    <div className="ml-6 space-y-3">
                      {/* 觀察病房選項 */}
                      <label className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.hospital_treatment['觀察病房'] || false}
                          onChange={(e) => handleCheckboxChange('hospital_treatment', '觀察病房', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">觀察病房</span>
                      </label>
                      {/* 只有在沒有勾選觀察病房時才顯示醫院資訊輸入 */}
                      {!formData.hospital_treatment['觀察病房'] && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={formData.hospital_admission?.hospital || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, hospital_admission: { ...prev.hospital_admission, hospital: e.target.value } }))}
                            className="form-input text-sm"
                            placeholder="醫院..."
                          />
                          <input
                            type="text"
                            value={formData.hospital_admission?.floor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, hospital_admission: { ...prev.hospital_admission, floor: e.target.value } }))}
                            className="form-input text-sm"
                            placeholder="樓層..."
                          />
                          <input
                            type="text"
                            value={formData.hospital_admission?.ward || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, hospital_admission: { ...prev.hospital_admission, ward: e.target.value } }))}
                            className="form-input text-sm"
                            placeholder="病房..."
                          />
                          <input
                            type="text"
                            value={formData.hospital_admission?.bed_number || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, hospital_admission: { ...prev.hospital_admission, bed_number: e.target.value } }))}
                            className="form-input text-sm"
                            placeholder="床號..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {formData.hospital_treatment['返回護理院/家'] && !formData.hospital_treatment['醫院留醫'] && (
              <div className="mt-3">
                <label className="text-xs text-gray-600">回院時間</label>
                <input
                  type="time"
                  value={formData.return_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, return_time: e.target.value }))}
                  className="form-input text-sm"
                />
              </div>
            )}
          </div>

          {/* 事後跟進 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">事後跟進</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">1. 呈交「特別事故報告」予社署安老院牌照事務處</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.submit_to_social_welfare === true}
                      onChange={() => setFormData(prev => ({ ...prev, submit_to_social_welfare: true }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">需要</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.submit_to_social_welfare === false}
                      onChange={() => setFormData(prev => ({ ...prev, submit_to_social_welfare: false }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">不需要</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="form-label">2. 呈交「特別事故報告」(1)副本或「特別事故報告」(院舍存檔用)予總部</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.submit_to_headquarters === true}
                      onChange={() => setFormData(prev => ({ ...prev, submit_to_headquarters: true }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">需要</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.submit_to_headquarters === false}
                      onChange={() => setFormData(prev => ({ ...prev, submit_to_headquarters: false }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">不需要</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="form-label">3. 院方的即時改善行動</label>
                  <button
                    type="button"
                    onClick={() => setShowImmediateOptionsModal(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    選擇預設選項
                  </button>
                </div>
                <textarea
                  value={formData.immediate_improvement_actions}
                  onChange={(e) => setFormData(prev => ({ ...prev, immediate_improvement_actions: e.target.value }))}
                  className="form-input"
                  rows={3}
                  placeholder="請輸入院方的即時改善行動..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="form-label">4. 院方預防意外再次發生的方法</label>
                  <button
                    type="button"
                    onClick={() => setShowPreventionOptionsModal(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    選擇預設選項
                  </button>
                </div>
                <textarea
                  value={formData.prevention_methods}
                  onChange={(e) => setFormData(prev => ({ ...prev, prevention_methods: e.target.value }))}
                  className="form-input"
                  rows={3}
                  placeholder="請輸入預防方法..."
                />
              </div>
            </div>
          </div>

          {/* 簽署資訊 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">簽署資訊</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">填報人姓名 *</label>
                <input
                  type="text"
                  value={formData.reporter_signature}
                  onChange={(e) => setFormData(prev => ({ ...prev, reporter_signature: e.target.value }))}
                  className="form-input"
                  placeholder="請輸入填報人簽名..."
                  required
                />
              </div>
              <div>
                <label className="form-label">職位 *</label>
                <input
                  type="text"
                  value={formData.reporter_position}
                  onChange={(e) => setFormData(prev => ({ ...prev, reporter_position: e.target.value }))}
                  className="form-input"
                  placeholder="請輸入職位..."
                  required
                />
              </div>
              <div>
                <label className="form-label">填報日期</label>
                <input
                  type="date"
                  value={formData.report_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, report_date: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">院長批閱日期</label>
                <input
                  type="date"
                  value={formData.director_review_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, director_review_date: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="form-label">院長批閱選項</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.submit_to_headquarters_flag || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, submit_to_headquarters_flag: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">呈交總部</span>
                </label>
                <label className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.submit_to_social_welfare_flag || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, submit_to_social_welfare_flag: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">呈交社署</span>
                </label>
              </div>
            </div>
          </div>

          {/* 錯誤提示 */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800 mb-2">請修正以下錯誤：</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 提交按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                        <button
              type="submit"
              className="btn-primary flex-1"
              
            >
              {report ? '更新意外事件報告' : '新增意外事件報告'}
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

        {/* 即時改善行動預設選項模態框 */}
        {showImmediateOptionsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white">
                <h3 className="text-lg font-medium">院方的即時改善行動</h3>
                <button onClick={() => setShowImmediateOptionsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* 預設選項清單 */}
                <div className="space-y-2 mb-4 border-b pb-4">
                  <h4 className="font-medium text-sm text-gray-700">預設選項</h4>
                  {immediateImprovementOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">沒有預設選項</p>
                  ) : (
                    immediateImprovementOptions.map(option => (
                      <div key={option.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedImmediateOptions.has(option.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedImmediateOptions);
                            if (e.target.checked) {
                              newSelected.add(option.id);
                            } else {
                              newSelected.delete(option.id);
                            }
                            setSelectedImmediateOptions(newSelected);
                          }}
                          className="h-4 w-4 mt-1 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 break-words">{option.option_text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePresetOption(option.id, 'immediate_improvement_actions')}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 新增選項 */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-medium text-sm text-gray-700">新增選項</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newImmediateActionText}
                      onChange={(e) => setNewImmediateActionText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addNewImmediateAction();
                        }
                      }}
                      className="form-input text-sm flex-1"
                      placeholder="輸入新選項..."
                    />
                    <button
                      type="button"
                      onClick={addNewImmediateAction}
                      className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      新增
                    </button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-2 p-4 border-t bg-white">
                <button
                  type="button"
                  onClick={insertSelectedImmediateActions}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  插入選中的選項
                </button>
                <button
                  type="button"
                  onClick={() => setShowImmediateOptionsModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 預防方法預設選項模態框 */}
        {showPreventionOptionsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white">
                <h3 className="text-lg font-medium">院方預防意外再次發生的方法</h3>
                <button onClick={() => setShowPreventionOptionsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* 預設選項清單 */}
                <div className="space-y-2 mb-4 border-b pb-4">
                  <h4 className="font-medium text-sm text-gray-700">預設選項</h4>
                  {preventionMethodsOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">沒有預設選項</p>
                  ) : (
                    preventionMethodsOptions.map(option => (
                      <div key={option.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedPreventionOptions.has(option.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedPreventionOptions);
                            if (e.target.checked) {
                              newSelected.add(option.id);
                            } else {
                              newSelected.delete(option.id);
                            }
                            setSelectedPreventionOptions(newSelected);
                          }}
                          className="h-4 w-4 mt-1 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 break-words">{option.option_text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePresetOption(option.id, 'prevention_methods')}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 新增選項 */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-medium text-sm text-gray-700">新增選項</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPreventionMethodText}
                      onChange={(e) => setNewPreventionMethodText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addNewPreventionMethod();
                        }
                      }}
                      className="form-input text-sm flex-1"
                      placeholder="輸入新選項..."
                    />
                    <button
                      type="button"
                      onClick={addNewPreventionMethod}
                      className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      新增
                    </button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-2 p-4 border-t bg-white">
                <button
                  type="button"
                  onClick={insertSelectedPreventionMethods}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  插入選中的選項
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreventionOptionsModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentReportModal;
