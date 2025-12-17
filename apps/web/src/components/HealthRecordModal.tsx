import React, { useState } from 'react';
import { X, Heart, Activity, Droplets, Scale, User, Calendar, Clock, AlertTriangle, ChevronDown, ChevronUp, Sparkles, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import { isInHospital } from '../utils/careRecordHelper';
import { getRecentHealthRecordsByPatient } from '../lib/database';
import { generateHealthRecordSuggestions, GeneratedHealthData } from '../utils/healthRecordGenerator';

interface HealthRecordModalProps {
  record?: any;
  initialData?: {
    patient?: { 院友id: number; 中文姓名?: string; 床號?: string };
    task?: {
      id: string;
      health_record_type: string;
      next_due_at: string;
      specific_times?: string[];
    };
    預設記錄類型?: string;
    預設日期?: string;
    預設時間?: string;
  };
  onClose: () => void;
  onTaskCompleted?: (recordDateTime: Date) => void;
}

const HealthRecordModal: React.FC<HealthRecordModalProps> = ({ record, initialData, onClose, onTaskCompleted }) => {
  const { addHealthRecord, updateHealthRecord, patients, hospitalEpisodes, admissionRecords } = usePatients();
  const { displayName } = useAuth();

  // 日期確認模態框 state (需在 useEffect 之前宣告)
  const [showDateWarningModal, setShowDateWarningModal] = useState(false);
  const [isDateWarningConfirmed, setIsDateWarningConfirmed] = useState(false);

  // 使用 ref 來存儲確認和取消的處理函數
  const dateWarningHandlersRef = React.useRef<{
    confirm: () => void;
    cancel: () => void;
  }>({
    confirm: () => {},
    cancel: () => {}
  });

  // ESC 鍵關閉主模態框
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDateWarningModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, showDateWarningModal]);

  // 日期確認模態框鍵盤事件 (Enter 確認, ESC 取消)
  React.useEffect(() => {
    if (!showDateWarningModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dateWarningHandlersRef.current.confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dateWarningHandlersRef.current.cancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDateWarningModal]);

  const getHongKongDateTime = (dateString?: string) => {
    const date = dateString ? new Date(dateString) : new Date();
    const hongKongTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));

    const year = hongKongTime.getFullYear();
    const month = (hongKongTime.getMonth() + 1).toString().padStart(2, '0');
    const day = hongKongTime.getDate().toString().padStart(2, '0');
    const hours = hongKongTime.getHours().toString().padStart(2, '0');
    const minutes = hongKongTime.getMinutes().toString().padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    };
  };

  const generateRandomDefaults = (recordType: string) => {
    if (recordType === '生命表徵') {
      return {
        體溫: (Math.random() * 0.9 + 36.0).toFixed(1),
        血含氧量: Math.floor(Math.random() * 5 + 95).toString(),
        呼吸頻率: Math.floor(Math.random() * 9 + 14).toString()
      };
    }
    return {};
  };

  const initialPatientId = record?.院友id?.toString() || initialData?.patient?.院友id?.toString() || '';
  const initialRecordTypeForDefaults = initialData?.預設記錄類型 || initialData?.task?.health_record_type || '生命表徵';
  const initialRandomDefaults = record ? {} : (initialData?.task ? generateRandomDefaults(initialRecordTypeForDefaults) : {});

  // 檢查院友在指定日期時間是否入院中（包括住院和外出就醫）
  const checkPatientAbsent = (patientId: string, recordDate: string, recordTime: string): boolean => {
    console.log('[checkPatientAbsent] 開始檢查:', { patientId, recordDate, recordTime });

    if (!patientId || !recordDate || !recordTime) {
      console.log('[checkPatientAbsent] 缺少必要參數，返回 false');
      return false;
    }

    const patient = patients.find(p => p.院友id.toString() === patientId.toString());
    if (!patient) {
      console.log('[checkPatientAbsent] 找不到院友，返回 false');
      return false;
    }

    console.log('[checkPatientAbsent] 找到院友:', patient.中文姓名);

    // 檢查是否在入院期間（使用 careRecordHelper 的 isInHospital 函數）
    const inHospital = isInHospital(patient, recordDate, recordTime, admissionRecords, hospitalEpisodes);

    console.log('[checkPatientAbsent] isInHospital 結果:', inHospital);

    return inHospital;
  };

  const getDefaultDateTime = () => {
    if (record) {
      return { date: record.記錄日期, time: record.記錄時間 };
    }

    const hongKongDateTime = getHongKongDateTime(initialData?.預設日期 || initialData?.task?.next_due_at);

    // [修正] 優先順序：預設時間 > 任務的第一個時間點 > 當前時間
    const specificTime = initialData?.預設時間 || initialData?.task?.specific_times?.[0];

    return {
      date: hongKongDateTime.date,
      time: specificTime || hongKongDateTime.time
    };
  };

  const { date: defaultRecordDate, time: defaultRecordTime } = getDefaultDateTime();

  console.log('[HealthRecordModal] 準備計算 initialIsPatientAbsent:', {
    initialPatientId,
    defaultRecordDate,
    defaultRecordTime,
    預設日期: initialData?.預設日期,
    預設時間: initialData?.預設時間,
    hasRecord: !!record
  });

  const initialIsPatientAbsent = checkPatientAbsent(
    initialPatientId,
    initialData?.預設日期 || initialData?.task?.next_due_at?.split('T')[0] || defaultRecordDate,
    initialData?.預設時間 || initialData?.task?.specific_times?.[0] || defaultRecordTime
  );

  console.log('[HealthRecordModal] initialIsPatientAbsent 結果:', initialIsPatientAbsent);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 生成器狀態管理
  type GeneratorStatus = 'idle' | 'loading' | 'generated' | 'error' | 'no-data';
  const [generatorStatus, setGeneratorStatus] = useState<GeneratorStatus>('idle');
  const [isGeneratorCollapsed, setIsGeneratorCollapsed] = useState(true);
  const [generatedData, setGeneratedData] = useState<GeneratedHealthData | null>(null);
  const [generatedRecordCount, setGeneratedRecordCount] = useState<number>(0);

  const [formData, setFormData] = useState({
    院友id: initialPatientId,
    記錄類型: record?.記錄類型 || initialRecordTypeForDefaults,
    記錄日期: defaultRecordDate,
    記錄時間: defaultRecordTime,
    血壓收縮壓: record?.血壓收縮壓?.toString() || (initialIsPatientAbsent ? '' : ''),
    血壓舒張壓: record?.血壓舒張壓?.toString() || (initialIsPatientAbsent ? '' : ''),
    脈搏: record?.脈搏?.toString() || (initialIsPatientAbsent ? '' : ''),
    體溫: record?.體溫?.toString() || (initialIsPatientAbsent ? '' : initialRandomDefaults.體溫 || ''),
    血含氧量: record?.血含氧量?.toString() || (initialIsPatientAbsent ? '' : initialRandomDefaults.血含氧量 || ''),
    呼吸頻率: record?.呼吸頻率?.toString() || (initialIsPatientAbsent ? '' : initialRandomDefaults.呼吸頻率 || ''),
    血糖值: record?.血糖值?.toString() || (initialIsPatientAbsent ? '' : ''),
    體重: record?.體重?.toString() || (initialIsPatientAbsent ? '' : ''),
    備註: record?.備註 || (initialIsPatientAbsent && !record ? '無法量度原因: 入院' : ''),
    記錄人員: record?.記錄人員 || displayName || '',
    isAbsent: record ? (record.備註?.includes('無法量度') || false) : initialIsPatientAbsent,
    absenceReason: record ? '' : (initialIsPatientAbsent ? '入院' : ''),
    customAbsenceReason: ''
  });

  // 組件掛載時記錄初始狀態
  React.useEffect(() => {
    console.log('[HealthRecordModal] 組件掛載，初始表單數據:', {
      院友id: formData.院友id,
      記錄日期: formData.記錄日期,
      記錄時間: formData.記錄時間,
      isAbsent: formData.isAbsent,
      absenceReason: formData.absenceReason,
      備註: formData.備註,
      initialIsPatientAbsent
    });
  }, []);

  // 計算當前院友是否在指定日期時間處於入院狀態（用於 UI 顯示）
  const currentIsPatientAbsent = React.useMemo(() => {
    console.log('[HealthRecordModal] 計算 currentIsPatientAbsent:', {
      院友id: formData.院友id,
      記錄日期: formData.記錄日期,
      記錄時間: formData.記錄時間,
      admissionRecordsCount: admissionRecords.length,
      hospitalEpisodesCount: hospitalEpisodes.length,
      admissionRecords: admissionRecords.filter(r => r.patient_id === formData.院友id)
    });
    const result = checkPatientAbsent(formData.院友id, formData.記錄日期, formData.記錄時間);
    console.log('[HealthRecordModal] currentIsPatientAbsent 結果:', result);
    return result;
  }, [formData.院友id, formData.記錄日期, formData.記錄時間, admissionRecords, hospitalEpisodes]);

  // 當院友ID、日期或時間改變時，檢查是否在入院期間並自動設定
  React.useEffect(() => {
    console.log('[HealthRecordModal] useEffect 觸發 - 檢查入院狀態:', {
      院友id: formData.院友id,
      記錄日期: formData.記錄日期,
      記錄時間: formData.記錄時間,
      hasRecord: !!record,
      currentIsPatientAbsent,
      currentFormIsAbsent: formData.isAbsent,
      currentAbsenceReason: formData.absenceReason,
      hospitalEpisodesCount: hospitalEpisodes.length,
      admissionRecordsCount: admissionRecords.length
    });

    // [診斷] 打印該院友的所有住院事件
    if (formData.院友id) {
      const patientEpisodes = hospitalEpisodes.filter(ep => ep.patient_id === formData.院友id);
      console.log('[HealthRecordModal] 🏥 該院友的住院事件:', patientEpisodes);
    }

    if (formData.院友id && formData.記錄日期 && formData.記錄時間 && !record) {
      const isAbsent = currentIsPatientAbsent;

      console.log('[HealthRecordModal] 條件檢查通過，準備自動設定:', {
        isAbsent,
        currentFormIsAbsent: formData.isAbsent,
        shouldAutoSet: isAbsent && !formData.isAbsent,
        shouldClear: !isAbsent && formData.isAbsent && formData.absenceReason === '入院'
      });

      if (isAbsent && !formData.isAbsent) {
        // 在入院期間，自動設定為無法量度
        console.log('[HealthRecordModal] 🔴 自動設定為入院狀態');
        setFormData(prev => ({
          ...prev,
          isAbsent: true,
          absenceReason: '入院',
          備註: '無法量度原因: 入院',
          血壓收縮壓: '', 血壓舒張壓: '', 脈搏: '', 體溫: '', 血含氧量: '', 呼吸頻率: '', 血糖值: '', 體重: ''
        }));
      } else if (!isAbsent && formData.isAbsent && formData.absenceReason === '入院') {
        // 不在入院期間，清除自動設定的入院狀態
        console.log('[HealthRecordModal] 🟢 清除入院狀態');
        setFormData(prev => ({
          ...prev,
          isAbsent: false,
          absenceReason: '',
          備註: ''
        }));
      } else {
        console.log('[HealthRecordModal] ⚪ 無需改變狀態');
      }
    } else {
      console.log('[HealthRecordModal] 條件未通過，不執行自動設定');
    }
  }, [formData.院友id, formData.記錄日期, formData.記錄時間, record, currentIsPatientAbsent, hospitalEpisodes]);

  React.useEffect(() => {
    if (record?.備註?.includes('無法量度原因:')) {
      const reasonMatch = record.備註.match(/無法量度原因:\s*(.+)/);
      if (reasonMatch) {
       const reason = reasonMatch[1].trim();
       const predefinedReasons = ['入院', '回家', '拒絕'];
       if (predefinedReasons.includes(reason)) {
         setFormData(prev => ({ ...prev, isAbsent: true, absenceReason: reason }));
       } else {
         setFormData(prev => ({ ...prev, isAbsent: true, absenceReason: '其他', customAbsenceReason: reason }));
       }
      }
    }
  }, [record]);

  React.useEffect(() => {
    if (formData.記錄類型 === '體重控制') {
      setFormData(prev => ({ ...prev, 記錄時間: '00:00' }));
    }
  }, [formData.記錄類型]);

  const getCurrentHongKongDate = (): string => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Hong_Kong"}));
    return hongKongTime.toISOString().split('T')[0];
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAbsenceChange = (checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        isAbsent: true,
        血壓收縮壓: '', 血壓舒張壓: '', 脈搏: '', 體溫: '', 血含氧量: '', 呼吸頻率: '', 血糖值: '', 體重: '',
        備註: prev.absenceReason ? `無法量度原因: ${prev.absenceReason}` : '無法量度'
      }));
    } else {
      setFormData(prev => ({ ...prev, isAbsent: false, absenceReason: '', 備註: '' }));
    }
  };

  const handleAbsenceReasonChange = (reason: string) => {
   if (reason === '其他') {
     setFormData(prev => ({ ...prev, absenceReason: reason, customAbsenceReason: '', 備註: '無法量度原因: ' }));
   } else {
     setFormData(prev => ({ ...prev, absenceReason: reason, customAbsenceReason: '', 備註: reason ? `無法量度原因: ${reason}` : '無法量度' }));
   }
 };
 
 React.useEffect(() => {
   if (formData.absenceReason === '其他' && formData.customAbsenceReason) {
     setFormData(prev => ({ ...prev, 備註: `無法量度原因: ${prev.customAbsenceReason}` }));
   }
 }, [formData.customAbsenceReason]);

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.院友id) errors.push('請選擇院友');
    if (!formData.記錄日期) errors.push('請填寫記錄日期');
    if (formData.記錄類型 !== '體重控制' && !formData.記錄時間) errors.push('請填寫記錄時間');

    if (!formData.isAbsent) {
      if (formData.記錄類型 === '生命表徵') {
        const hasVitalSign = formData.血壓收縮壓 || formData.血壓舒張壓 || formData.脈搏 || formData.體溫 || formData.血含氧量 || formData.呼吸頻率;
        if (!hasVitalSign) errors.push('至少需要填寫一項生命表徵數值');
      } else if (formData.記錄類型 === '血糖控制' && !formData.血糖值) {
        errors.push('請填寫血糖值');
      } else if (formData.記錄類型 === '體重控制' && !formData.體重) {
        errors.push('請填寫體重');
      }
    } else {
      if (!formData.absenceReason) errors.push('請選擇原因');
    }
    return errors;
  };

  // 生成器處理函數
  const handleGenerateData = async () => {
    if (!formData.院友id) {
      alert('請先選擇院友');
      return;
    }

    console.log('[生成器] 開始生成數據:', {
      院友id: formData.院友id,
      記錄類型: formData.記錄類型
    });

    setGeneratorStatus('loading');
    setIsGeneratorCollapsed(false);

    try {
      const recentRecords = await getRecentHealthRecordsByPatient(
        parseInt(formData.院友id),
        formData.記錄類型,
        5
      );

      console.log('[生成器] 獲取到的記錄:', recentRecords);

      const result = generateHealthRecordSuggestions(recentRecords, formData.記錄類型);

      console.log('[生成器] 生成結果:', result);

      if (result.success && result.data) {
        setGeneratedData(result.data);
        setGeneratedRecordCount(result.recordCount || 0);
        setGeneratorStatus('generated');
        console.log('[生成器] 生成成功，數據已設置');

        // 自動填入表單
        setFormData(prev => ({
          ...prev,
          ...result.data
        }));
      } else if (result.error === 'no-data') {
        console.log('[生成器] 無歷史數據');
        setGeneratorStatus('no-data');
      } else {
        console.log('[生成器] 生成失敗:', result.error);
        setGeneratorStatus('error');
      }
    } catch (error) {
      console.error('[生成器] 發生錯誤:', error);
      setGeneratorStatus('error');
    }
  };

  const handleRegenerateData = async () => {
    await handleGenerateData();
  };

  // 當院友、記錄類型改變時，重置生成器
  React.useEffect(() => {
    setGeneratorStatus('idle');
    setGeneratedData(null);
    setGeneratedRecordCount(0);
  }, [formData.院友id, formData.記錄類型]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    const currentDate = getCurrentHongKongDate();
    const recordDate = formData.記錄日期;

    if (recordDate < currentDate && !isDateWarningConfirmed) {
      setShowDateWarningModal(true);
      return;
    }

    if (isDateWarningConfirmed) setIsDateWarningConfirmed(false);
    await saveRecord();
  };

  const saveRecord = async () => {
    console.log('[saveRecord] 開始儲存，設置 isSubmitting=true');
    setIsSubmitting(true);

    const recordData = {
      院友id: parseInt(formData.院友id),
      task_id: initialData?.task?.id || record?.task_id || null,
      記錄日期: formData.記錄日期,
      記錄時間: formData.記錄類型 === '體重控制' ? '00:00' : formData.記錄時間,
      記錄類型: formData.記錄類型 as any,
      血壓收縮壓: formData.血壓收縮壓 ? parseInt(formData.血壓收縮壓) : null,
      血壓舒張壓: formData.血壓舒張壓 ? parseInt(formData.血壓舒張壓) : null,
      脈搏: formData.脈搏 ? parseInt(formData.脈搏) : null,
      體溫: formData.體溫 ? parseFloat(formData.體溫) : null,
      血含氧量: formData.血含氧量 ? parseInt(formData.血含氧量) : null,
      呼吸頻率: formData.呼吸頻率 ? parseInt(formData.呼吸頻率) : null,
      血糖值: formData.血糖值 ? parseFloat(formData.血糖值) : null,
      體重: formData.體重 ? parseFloat(formData.體重) : null,
      備註: formData.備註 || null,
      記錄人員: formData.記錄人員 || null,
    };

    console.log('[saveRecord] 準備儲存的資料:', recordData);

    try {
      if (record) {
        console.log('[saveRecord] 更新現有記錄');
        await updateHealthRecord({ 記錄id: record.記錄id, ...recordData });
        console.log('[saveRecord] 更新成功，準備關閉 Modal');
        onClose();
        console.log('[saveRecord] 已調用 onClose()');
      } else {
        console.log('[saveRecord] 新增記錄');
        await addHealthRecord(recordData);
        console.log('[saveRecord] 新增成功，準備關閉 Modal');
        onClose();
        console.log('[saveRecord] 已調用 onClose()');

        if (onTaskCompleted && initialData?.task?.id) {
          console.log('[saveRecord] 調用 onTaskCompleted', {
            taskId: initialData.task.id,
            recordDate: formData.記錄日期,
            recordTime: formData.記錄時間
          });
          const recordDateTime = new Date(`${formData.記錄日期}T${formData.記錄時間}`);
          onTaskCompleted(initialData.task.id, recordDateTime);
          console.log('[saveRecord] onTaskCompleted 已調用');
        } else {
          console.log('[saveRecord] 不需要調用 onTaskCompleted', {
            hasCallback: !!onTaskCompleted,
            hasTaskId: !!initialData?.task?.id
          });
        }
      }
      console.log('[saveRecord] 儲存流程完成，重置 isSubmitting=false');
      setIsSubmitting(false);
    } catch (error) {
      console.error('[saveRecord] 儲存失敗:', error);
      alert(`儲存失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      setIsSubmitting(false);
    }
  };

  const handleDateWarningConfirm = async () => {
    setShowDateWarningModal(false);
    setIsDateWarningConfirmed(true);
    await saveRecord();
  };

  const handleDateWarningCancel = () => {
    setShowDateWarningModal(false);
    setIsDateWarningConfirmed(false);
  };

  // 更新 ref 中的處理函數
  dateWarningHandlersRef.current.confirm = handleDateWarningConfirm;
  dateWarningHandlersRef.current.cancel = handleDateWarningCancel;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {formData.記錄類型 === '生命表徵' && <Activity className="h-5 w-5 text-blue-600" />}
              {formData.記錄類型 === '血糖控制' && <Droplets className="h-5 w-5 text-red-600" />}
              {formData.記錄類型 === '體重控制' && <Scale className="h-5 w-5 text-green-600" />}
              <h2 className="text-xl font-semibold text-gray-900">
                {record ? '編輯監測記錄' : '新增監測記錄'}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="form-label">記錄人員</label>
                <input
                  type="text"
                  value={formData.記錄人員}
                  onChange={(e) => updateFormData('記錄人員', e.target.value)}
                  className="form-input"
                  placeholder="記錄人員姓名"
                />
              </div>
              <div>
                <label className="form-label">記錄類型 *</label>
                <select
                  value={formData.記錄類型}
                  onChange={(e) => updateFormData('記錄類型', e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="生命表徵">生命表徵</option>
                  <option value="血糖控制">血糖控制</option>
                  <option value="體重控制">體重控制</option>
                </select>
              </div>
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  記錄日期 *
                </label>
                <input
                  type="date"
                  value={formData.記錄日期}
                  onChange={(e) => updateFormData('記錄日期', e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {formData.記錄類型 === '體重控制' ? '記錄時間' : '記錄時間 *'}
                </label>
                <input
                  type="time"
                  value={formData.記錄時間}
                  onChange={(e) => updateFormData('記錄時間', e.target.value)}
                  className="form-input"
                  required={formData.記錄類型 !== '體重控制'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-4">
              <div>
                <label className="form-label">
                  <User className="h-4 w-4 inline mr-1" />
                  院友 *
                </label>
                <PatientAutocomplete
                  value={formData.院友id}
                  onChange={(patientId) => updateFormData('院友id', patientId)}
                  placeholder="搜索院友..."
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
              </div>

              <div>
                <label className="form-label">監測狀態</label>
                <div className={`p-3 rounded-lg border ${
                  currentIsPatientAbsent ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isAbsent}
                      onChange={(e) => handleAbsenceChange(e.target.checked)}
                      className={`h-4 w-4 focus:ring-orange-500 border-gray-300 rounded ${
                        currentIsPatientAbsent ? 'text-red-600 focus:ring-red-500' : 'text-orange-600 focus:ring-orange-500'
                      }`}
                    />
                    <label className={`text-sm font-medium cursor-pointer ${
                      currentIsPatientAbsent ? 'text-red-800' : 'text-orange-800'
                    }`}>
                      院友未能進行監測
                      {currentIsPatientAbsent && <span className="ml-1 text-red-600 font-bold">(入院中)</span>}
                    </label>
                  </div>

                  {formData.isAbsent && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <label className={`text-sm ${currentIsPatientAbsent ? 'text-red-700' : 'text-orange-700'}`}>原因:</label>
                        <select
                          value={formData.absenceReason}
                          onChange={(e) => handleAbsenceReasonChange(e.target.value)}
                          className="form-input text-sm flex-1"
                          required={formData.isAbsent}
                          disabled={currentIsPatientAbsent && formData.absenceReason === '入院'}
                        >
                          <option value="">請選擇</option>
                          <option value="入院">入院</option>
                          <option value="回家">回家</option>
                          <option value="拒絕">拒絕</option>
                          <option value="其他">其他</option>
                        </select>
                      </div>
                      {formData.absenceReason === '其他' && (
                        <input
                          type="text"
                          value={formData.customAbsenceReason || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, customAbsenceReason: e.target.value }))}
                          className="form-input text-sm w-full"
                          placeholder="請輸入原因..."
                          required
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {formData.記錄類型 === '生命表徵' && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">血壓 (mmHg)</label>
                    <div className="flex space-x-2">
                      <input type="text" value={formData.血壓收縮壓} onChange={(e) => updateFormData('血壓收縮壓', e.target.value.replace(/[^0-9]/g, ''))} className="form-input" placeholder="120" disabled={formData.isAbsent} inputMode="numeric" />
                      <span className="flex items-center text-gray-500">/</span>
                      <input type="text" value={formData.血壓舒張壓} onChange={(e) => updateFormData('血壓舒張壓', e.target.value.replace(/[^0-9]/g, ''))} className="form-input" placeholder="80" disabled={formData.isAbsent} inputMode="numeric" />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">脈搏 (每分鐘)</label>
                    <input type="text" value={formData.脈搏} onChange={(e) => updateFormData('脈搏', e.target.value.replace(/[^0-9]/g, ''))} className="form-input" placeholder="72" disabled={formData.isAbsent} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="form-label">體溫 (°C)</label>
                    <input type="text" value={formData.體溫} onChange={(e) => updateFormData('體溫', e.target.value)} className="form-input" placeholder="36.5" disabled={formData.isAbsent} inputMode="decimal" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">血含氧量 (%)</label>
                    <input type="text" value={formData.血含氧量} onChange={(e) => updateFormData('血含氧量', e.target.value.replace(/[^0-9]/g, ''))} className="form-input" placeholder="98" disabled={formData.isAbsent} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="form-label">呼吸頻率 (每分鐘)</label>
                    <input type="text" value={formData.呼吸頻率} onChange={(e) => updateFormData('呼吸頻率', e.target.value.replace(/[^0-9]/g, ''))} className="form-input" placeholder="18" disabled={formData.isAbsent} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="form-label">備註</label>
                    <textarea value={formData.備註} onChange={(e) => updateFormData('備註', e.target.value)} className="form-input" rows={1} placeholder="其他備註資訊..." disabled={formData.isAbsent} />
                  </div>
                </div>
              </div>
            )}

            {formData.記錄類型 === '血糖控制' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="form-label">血糖值 (mmol/L) *</label>
                  <input type="text" value={formData.血糖值} onChange={(e) => updateFormData('血糖值', e.target.value)} className="form-input" placeholder="5.5" required disabled={formData.isAbsent} inputMode="decimal" />
                </div>
                <div>
                  <label className="form-label">備註</label>
                  <textarea value={formData.備註} onChange={(e) => updateFormData('備註', e.target.value)} className="form-input" rows={1} placeholder="血糖測試相關備註..." disabled={formData.isAbsent} />
                </div>
              </div>
            )}

            {formData.記錄類型 === '體重控制' && (
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="form-label">體重 (kg) *</label>
                  <input type="text" value={formData.體重} onChange={(e) => updateFormData('體重', e.target.value)} className="form-input" placeholder="65.0" required disabled={formData.isAbsent} inputMode="decimal" />
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button type="submit" className="btn-primary flex-1">
                {record ? '更新記錄' : '儲存記錄'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                取消
              </button>
            </div>

            {/* 智能數據生成器 - 只在新增模式下顯示 */}
            {!record && (
              <div className="mt-6 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsGeneratorCollapsed(!isGeneratorCollapsed)}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">智能數據生成器</span>
                    {generatorStatus === 'generated' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        已生成
                      </span>
                    )}
                  </div>
                  {isGeneratorCollapsed ? (
                    <ChevronDown className="h-5 w-5 text-blue-600" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-blue-600" />
                  )}
                </button>

                {!isGeneratorCollapsed && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    {/* 顯示當前選中院友 */}
                    <div className="mb-4">
                      {formData.院友id ? (
                        <div className="flex items-center space-x-2 text-sm text-gray-700">
                          <User className="h-4 w-4 text-blue-600" />
                          <span>
                            院友：
                            {(() => {
                              const patient = patients.find(p => p.院友id.toString() === formData.院友id);
                              return patient ? `${patient.中文姓名} (${patient.床號})` : '未選擇';
                            })()}
                          </span>
                          <span className="text-blue-600">|</span>
                          <span>記錄類型：{formData.記錄類型}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-orange-600 flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>請先選擇院友</span>
                        </div>
                      )}
                    </div>

                    {/* 生成器內容 */}
                    {generatorStatus === 'idle' && (
                      <div className="text-center py-4">
                        <button
                          type="button"
                          onClick={handleGenerateData}
                          disabled={!formData.院友id || formData.isAbsent}
                          className="btn-primary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>啟動生成器</span>
                        </button>
                        {formData.isAbsent && (
                          <p className="text-xs text-gray-500 mt-2">生成器在「無法量度」模式下不可用</p>
                        )}
                      </div>
                    )}

                    {generatorStatus === 'loading' && (
                      <div className="text-center py-6">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">正在分析歷史記錄...</p>
                      </div>
                    )}

                    {generatorStatus === 'no-data' && (
                      <div className="text-center py-4">
                        <div className="inline-flex items-center space-x-2 text-orange-600 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">該院友暫無歷史記錄</span>
                        </div>
                        <p className="text-sm text-gray-600">無法根據歷史數據生成建議值</p>
                      </div>
                    )}

                    {generatorStatus === 'error' && (
                      <div className="text-center py-4">
                        <div className="inline-flex items-center space-x-2 text-red-600 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">生成失敗</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">請稍後再試</p>
                        <button
                          type="button"
                          onClick={handleGenerateData}
                          className="btn-secondary text-sm"
                        >
                          重試
                        </button>
                      </div>
                    )}

                    {generatorStatus === 'generated' && generatedData && (
                      <div className="text-center py-4">
                        <div className="flex items-center justify-center space-x-2 text-green-600 mb-4">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">
                            已根據最近 {generatedRecordCount} 次記錄生成並填入表單
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRegenerateData}
                          className="btn-secondary inline-flex items-center space-x-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>重新生成</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>

      {showDateWarningModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
          onClick={handleDateWarningCancel}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">日期確認</h3>
              </div>
              <button onClick={handleDateWarningCancel} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-900 mb-2">記錄日期早於當前日期</h4>
                    <div className="text-sm text-orange-800 space-y-1">
                      <p><strong>記錄日期：</strong>{new Date(formData.記錄日期).toLocaleDateString('zh-TW')}</p>
                      <p><strong>當前日期：</strong>{new Date(getCurrentHongKongDate()).toLocaleDateString('zh-TW')}</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-700 text-sm">
                您輸入的記錄日期早於當前系統日期。這可能是補錄過往的記錄，請確認是否要繼續儲存？
              </p>
            </div>
            <div className="flex space-x-3">
              <button onClick={handleDateWarningConfirm} className="btn-primary flex-1">確認儲存</button>
              <button onClick={handleDateWarningCancel} className="btn-secondary flex-1">取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthRecordModal;