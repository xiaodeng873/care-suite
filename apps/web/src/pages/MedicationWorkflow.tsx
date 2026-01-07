import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Pill,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Filter,
  Search,
  RefreshCw,
  Play,
  Zap,
  FastForward,
  CheckSquare,
  Users,
  Syringe,
  Trash2,
  Shield,
  Heart,
  MoreVertical,
  Camera
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import PatientAutocomplete from '../components/PatientAutocomplete';
import PatientInfoCard from '../components/PatientInfoCard';
import QRScannerModal from '../components/QRScannerModal';
import PrescriptionModal from '../components/PrescriptionModal';
import DispenseConfirmModal from '../components/DispenseConfirmModal';
import BatchDispenseConfirmModal from '../components/BatchDispenseConfirmModal';
import InspectionCheckModal from '../components/InspectionCheckModal';
import InjectionSiteModal from '../components/InjectionSiteModal';
import RevertConfirmModal from '../components/RevertConfirmModal';
import WorkflowDeduplicateModal from '../components/WorkflowDeduplicateModal';
import { Portal } from '../components/Portal';
import { generateDailyWorkflowRecords, generateBatchWorkflowRecords } from '../utils/workflowGenerator';
import { diagnoseWorkflowDisplayIssue } from '../utils/diagnoseTool';
import { supabase } from '../lib/supabase';
import { getPatientByQrCodeId } from '../lib/database';
import {
  hasOverdueWorkflowOnDate,
  calculateOverdueCountByDate,
  calculateOverdueCountByPreparationMethod
} from '../utils/workflowStatusHelper';
interface WorkflowCellProps {
  record: any;
  step: 'preparation' | 'verification' | 'dispensing';
  onStepClick: (recordId: string, step: string) => void;
  disabled?: boolean;
  selectedDate: string;
}
const WorkflowCell: React.FC<WorkflowCellProps> = ({ record, step, onStepClick, disabled, selectedDate }) => {
  const { prescriptions } = usePatients();
  
  // 檢測 iPad 橫向模式（寬度 <= 1366px 且為橫向，涵蓋所有 iPad 型號）
  // iPad 標準橫向: 1024px, iPad Pro 11": 1194px, iPad Pro 12.9": 1366px
  const [isIpadLandscape, setIsIpadLandscape] = useState(false);
  
  useEffect(() => {
    const checkIpadLandscape = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const isTabletWidth = window.innerWidth >= 768 && window.innerWidth <= 1366;
      setIsIpadLandscape(isLandscape && isTabletWidth);
    };
    
    checkIpadLandscape();
    window.addEventListener('resize', checkIpadLandscape);
    window.addEventListener('orientationchange', checkIpadLandscape);
    
    return () => {
      window.removeEventListener('resize', checkIpadLandscape);
      window.removeEventListener('orientationchange', checkIpadLandscape);
    };
  }, []);
  
  // 檢查是否為即時備藥處方
  const prescription = prescriptions.find(p => p.id === record.prescription_id);
  const isImmediatePreparation = prescription?.preparation_method === 'immediate';
  // 判斷是否為自理處方
  const isSelfCare = prescription?.preparation_method === 'custom';
  const getStepStatus = () => {
    switch (step) {
      case 'preparation':
        return record.preparation_status;
      case 'verification':
        return record.verification_status;
      case 'dispensing':
        return record.dispensing_status;
      default:
        return 'pending';
    }
  };
  const getStepStaff = () => {
    switch (step) {
      case 'preparation':
        return record.preparation_staff;
      case 'verification':
        return record.verification_staff;
      case 'dispensing':
        return record.dispensing_staff;
      default:
        return null;
    }
  };
  const getStepTime = () => {
    switch (step) {
      case 'preparation':
        return record.preparation_time;
      case 'verification':
        return record.verification_time;
      case 'dispensing':
        return record.dispensing_time;
      default:
        return null;
    }
  };
  const status = getStepStatus();
  const staff = getStepStaff();
  const time = getStepTime();
  // 解析檢測項數值（僅在派藥格子顯示）
  const getInspectionValues = () => {
    if (step !== 'dispensing' || !record.inspection_check_result) {
      return null;
    }
    try {
      const result = typeof record.inspection_check_result === 'string'
        ? JSON.parse(record.inspection_check_result)
        : record.inspection_check_result;
      // 如果是入院狀態，返回特殊標記
      if (result && result.isHospitalized) {
        return { isHospitalized: true };
      }
      // 如果有檢測數據，返回（直接使用 usedVitalSignData）
      if (result && result.usedVitalSignData && Object.keys(result.usedVitalSignData).length > 0) {
        return result.usedVitalSignData;
      }
    } catch (error) {
      console.error('[WorkflowCell] 解析檢測項結果失敗:', error, record.inspection_check_result);
    }
    return null;
  };
  // 獲取檢測不合格的項目（僅在派藥失敗且有檢測結果時顯示）
  const getBlockedRules = () => {
    if (step !== 'dispensing' || status !== 'failed' || !record.inspection_check_result) {
      return null;
    }
    try {
      const result = typeof record.inspection_check_result === 'string'
        ? JSON.parse(record.inspection_check_result)
        : record.inspection_check_result;
      if (result && result.blockedRules && result.blockedRules.length > 0) {
        return result.blockedRules;
      }
    } catch (error) {
      console.error('[WorkflowCell] 解析檢測項結果失敗:', error, record.inspection_check_result);
    }
    return null;
  };
  // 提取注射位置（僅在派藥格子顯示）
  const getInjectionSite = () => {
    if (step !== 'dispensing' || !record.notes) {
      return null;
    }
    const match = record.notes.match(/注射位置[：:]\s*([^|]+)/);
    return match ? match[1].trim() : null;
  };
  // 檢查檢測項是否合格
  const isInspectionPassed = () => {
    if (step !== 'dispensing' || !record.inspection_check_result) {
      return null;
    }
    try {
      const result = typeof record.inspection_check_result === 'string'
        ? JSON.parse(record.inspection_check_result)
        : record.inspection_check_result;
      return result?.canDispense;
    } catch (error) {
      return null;
    }
  };
  const inspectionValues = getInspectionValues();
  const blockedRules = getBlockedRules();
  const injectionSite = getInjectionSite();
  const inspectionPassed = isInspectionPassed();
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      case 'pending':
      default:
        return <Clock className="h-3 w-3" />;
    }
  };
  const getStepLabel = () => {
    switch (step) {
      case 'preparation':
        return '執藥';
      case 'verification':
        return '核藥';
      case 'dispensing':
        return '派藥';
      default:
        return step;
    }
  };
  
  // 簡化標籤（用於 iPad 橫向模式）
  const getShortStepLabel = () => {
    switch (step) {
      case 'preparation':
        return '執';
      case 'verification':
        return '核';
      case 'dispensing':
        return '派';
      default:
        return step;
    }
  };
  const isClickable = () => {
    if (disabled) return false;
    if (isSelfCare) return false;
    // 移除日期限制，允許所有日期操作
    if (step === 'preparation') {
      return true;
    }
    // 核藥：需要執藥完成才能執行，但總是可以撤銷
    if (step === 'verification') {
      return status === 'pending' ? record.preparation_status === 'completed' : true;
    }
    // 派藥：需要核藥完成才能執行，但總是可以撤銷
    if (step === 'dispensing') {
      return status === 'pending' ? record.verification_status === 'completed' : true;
    }
    return false;
  };
  const handleClick = () => {
    if (!isClickable() || isSelfCare) return;
    onStepClick(record.id, step);
  };
  const getClickTooltip = () => {
    if (status === 'completed') {
      return `點擊撤銷${getStepLabel()}（需確認）`;
    } else if (status === 'failed') {
      return `點擊撤銷${getStepLabel()}失敗狀態（需確認）`;
    } else if (status === 'pending') {
      if (step === 'preparation') {
        return `點擊執行${getStepLabel()}`;
      } else if (step === 'verification' && record.preparation_status !== 'completed') {
        return '需要先完成執藥';
      } else if (step === 'dispensing' && record.verification_status !== 'completed') {
        return '需要先完成核藥';
      } else if (step === 'dispensing') {
        return '點擊確認派藥（需選擇執行結果）';
      } else {
        return `點擊執行${getStepLabel()}`;
      }
    }
    return '';
  };
  // 自理處方：淡藍色背景，不可點擊（優先級最高）
  let cellClass = '';
  if (isSelfCare) {
    cellClass = 'bg-blue-100 text-blue-800 border-blue-200 cursor-not-allowed';
  }
  // 檢測項背景色覆蓋
  else {
    cellClass = `${getStatusColor()} ${isClickable() ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'} ${isImmediatePreparation && (step === 'preparation' || step === 'verification') ? 'bg-gray-200 text-gray-500' : ''}`;
    // 如果是派藥格子且有檢測項結果，根據是否合格覆蓋背景色
    if (step === 'dispensing' && status === 'completed' && inspectionPassed !== null) {
      if (inspectionPassed) {
        cellClass = `bg-green-50 text-green-800 border-green-200 ${isClickable() ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'}`;
      } else {
        cellClass = `bg-red-50 text-red-800 border-red-200 ${isClickable() ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'}`;
      }
    }
  }
  // 自理處方：只顯示「自理」文字
  if (isSelfCare) {
    return (
      <div
        className={`px-2 py-2 border rounded text-center text-xs transition-all duration-200 ${cellClass}`}
        title="自理處方，無需執核派操作"
      >
        <div className="font-medium text-sm">自理</div>
      </div>
    );
  }
  return (
    <div
      className={`px-2 py-2 border rounded text-center text-xs transition-all duration-200 ${cellClass}`}
      onClick={handleClick}
      title={getClickTooltip()}
    >
      <div className="flex items-center justify-center space-x-1">
        {getStatusIcon()}
        {/* 在 iPad 橫向模式顯示簡化標籤 */}
        <span className="font-medium text-center">{isIpadLandscape ? getShortStepLabel() : getStepLabel()}</span>
      </div>
      {status === 'completed' && staff && (
        <div className="text-xs text-gray-500 mt-1 truncate landscape:md:hidden">
          {staff}
        </div>
      )}
      {isImmediatePreparation && (step === 'preparation' || step === 'verification') && (
        <div className="text-xs text-gray-500 mt-1 landscape:md:hidden">
          即時備藥
        </div>
      )}
      {/* 顯示入院狀態 */}
      {step === 'dispensing' && status === 'failed' && inspectionValues?.isHospitalized && (
        <div className="mt-1 text-xs text-red-700 font-medium">
          入院中
        </div>
      )}
      {/* 顯示渡假狀態 */}
      {step === 'dispensing' && status === 'failed' && inspectionValues?.isOnVacation && (
        <div className="mt-1 text-xs text-purple-700 font-medium">
          渡假中
        </div>
      )}
      {/* 顯示檢測不合格的項目及數值（iPad橫向模式隱藏，Web桌面顯示） */}
      {step === 'dispensing' && status === 'failed' && blockedRules && blockedRules.length > 0 && (
        <div className="mt-1 space-y-0.5 max-[1024px]:landscape:hidden">
          {blockedRules.map((rule: any, index: number) => (
            <div key={index} className="text-xs text-red-700">
              <span className="font-medium">{rule.vital_sign_type}:</span> {rule.actual_value || rule.actualValue}
            </div>
          ))}
        </div>
      )}
      {/* 顯示檢測合格的項目數值（iPad橫向模式隱藏，Web桌面顯示） */}
      {step === 'dispensing' && status === 'completed' && inspectionValues && !inspectionValues.isHospitalized && (
        <div className="mt-1 space-y-0.5 max-[1024px]:landscape:hidden">
          {Object.entries(inspectionValues).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="font-medium">{key}:</span> {value}
            </div>
          ))}
        </div>
      )}
      {/* 顯示注射位置 */}
      {step === 'dispensing' && status === 'completed' && injectionSite && (
        <div className="mt-1 flex items-center justify-center space-x-1 text-xs text-orange-700">
          <Syringe className="h-3 w-3" />
          <span>{injectionSite}</span>
        </div>
      )}
    </div>
  );
};
const MedicationWorkflow: React.FC = () => {
  const {
    patients,
    prescriptions,
    prescriptionWorkflowRecords,
    fetchPrescriptionWorkflowRecords,
    prepareMedication,
    revertPrescriptionWorkflowStep,
    verifyMedication,
    dispenseMedication,
    checkPrescriptionInspectionRules,
    hospitalEpisodes,
    refreshData,
    loading
  } = usePatients();
  const { displayName } = useAuth();
  const [searchParams] = useSearchParams();
  // 獲取本地今天日期（避免 UTC 時區問題）
  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // 從 URL 查詢參數獲取初始值
  const urlPatientId = searchParams.get('patientId');
  const urlDate = searchParams.get('date');
  // 狀態管理
  const [selectedDate, setSelectedDate] = useState(urlDate || getTodayLocalDate());
  const [selectedPatientId, setSelectedPatientId] = useState<string>(urlPatientId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDispenseConfirmModal, setShowDispenseConfirmModal] = useState(false);
  const [showBatchDispenseModal, setShowBatchDispenseModal] = useState(false);
  const [showInspectionCheckModal, setShowInspectionCheckModal] = useState(false);
  const [showInjectionSiteModal, setShowInjectionSiteModal] = useState(false);
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [selectedWorkflowRecord, setSelectedWorkflowRecord] = useState<any>(null);
  const [selectedStep, setSelectedStep] = useState<string>('');
  const [showRevertConfirmModal, setShowRevertConfirmModal] = useState(false);
  const [revertActionRecord, setRevertActionRecord] = useState<any>(null);
  const [revertActionStep, setRevertActionStep] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [oneClickProcessing, setOneClickProcessing] = useState({
    preparation: false,
    verification: false,
    dispensing: false
  });
  const [currentInjectionRecord, setCurrentInjectionRecord] = useState<any>(null);
  const [allWorkflowRecords, setAllWorkflowRecords] = useState<any[]>([]);
  const [preparationFilter, setPreparationFilter] = useState<'all' | 'advanced' | 'immediate'>('all');
  const [autoGenerationChecked, setAutoGenerationChecked] = useState(false);
  const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
  const [selectedDateForMenu, setSelectedDateForMenu] = useState<string | null>(null);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const [hoveredPrescriptionId, setHoveredPrescriptionId] = useState<number | null>(null);
  const [medicationInfoPosition, setMedicationInfoPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [optimisticCrushState, setOptimisticCrushState] = useState<Map<number, boolean>>(new Map());
  const [optimisticWorkflowUpdates, setOptimisticWorkflowUpdates] = useState<Map<string, {
    preparation_status?: string;
    verification_status?: string;
    dispensing_status?: string;
  }>>(new Map());
  // 防抖控制：使用 ref 追蹤生成狀態，防止併發
  const isGeneratingRef = React.useRef(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const generationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // 拖曳滑動相關狀態
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [dragDistance, setDragDistance] = useState(0);
  // QR 掃描處理函數 - 只接受院友二維碼，直接打開一鍵派藥確認框
  const handleQRScanSuccess = async (qrCodeId: string) => {
    try {
      // 直接用院友二維碼查找院友
      const patient = await getPatientByQrCodeId(qrCodeId);
      if (!patient) {
        alert('找不到對應的院友，請確認二維碼是否正確');
        return;
      }
      if (patient.在住狀態 !== '在住') {
        alert('此院友非在住狀態');
        return;
      }
      
      // 設定選中的院友
      const patientIdStr = patient.院友id.toString();
      setSelectedPatientId(patientIdStr);
      
      // 設定日期為今天
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
      
      // 延遲打開一鍵派藥確認框，等待狀態更新和數據載入
      setTimeout(() => {
        setShowBatchDispenseModal(true);
      }, 500);
    } catch (error) {
      console.error('❌ 處理二維碼掃描失敗:', error);
      alert('處理二維碼失敗，請重試');
    }
  };
  const handleQRScanError = (error: string) => {
    console.error('掃描錯誤:', error);
    // 錯誤已在 QRScanner 元件中顯示，這裡不需要額外處理
  };
  // 計算一週日期（周日開始）
  const computeWeekDates = (dateStr: string): string[] => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0=週日, 1=週一, ..., 6=週六
    const diff = date.getDate() - day;
    const sunday = new Date(date);
    sunday.setDate(diff);
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(d.getDate() + i);
      week.push(d.toISOString().split('T')[0]);
    }
    return week;
  };
  const weekDates = useMemo(() => computeWeekDates(selectedDate), [selectedDate]);
  // 檢查處方是否應在指定日期服藥（與 Edge Function 邏輯一致）
  const shouldTakeMedicationOnDate = (prescription: any, targetDate: Date): boolean => {
    const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day } = prescription;
    const startDate = new Date(prescription.start_date);
    switch (frequency_type) {
      case 'daily':
        return true; // 每日服
      case 'every_x_days':
        // 隔X日服
        const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const daysDiff = Math.floor((targetDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        const interval = frequency_value || 1;
        return daysDiff % interval === 0;
      case 'weekly_days':
        // 逢星期X服
        const dayOfWeek = targetDate.getDay(); // 0=週日, 1=週一, ..., 6=週六
        const targetDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 轉換為 1-7 格式
        return specific_weekdays?.includes(targetDay) || false;
      case 'odd_even_days':
        // 單日/雙日服
        const dateNumber = targetDate.getDate();
        if (is_odd_even_day === 'odd') {
          return dateNumber % 2 === 1; // 單日
        } else if (is_odd_even_day === 'even') {
          return dateNumber % 2 === 0; // 雙日
        }
        return false;
      case 'every_x_months':
        // 隔X月服
        const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (targetDate.getMonth() - startDate.getMonth());
        const monthInterval = frequency_value || 1;
        return monthsDiff % monthInterval === 0 &&
               targetDate.getDate() === startDate.getDate();
      default:
        return true; // 預設為需要服藥
    }
  };
  // 檢查當周工作流程記錄是否完整
  const checkWeekWorkflowCompleteness = async (patientIdNum: number, weekDates: string[]) => {
    try {
      // 查詢該院友的所有在服處方
      const activePrescriptionsForPatient = prescriptions.filter(p => {
        if (p.patient_id.toString() !== patientIdNum.toString() || p.status !== 'active') {
          return false;
        }
        return true;
      });
      if (activePrescriptionsForPatient.length === 0) {
        return { complete: true, shouldGenerate: false };
      }
      // 計算當周應該生成的記錄總數（考慮頻率規則）
      let expectedRecordsCount = 0;
      const expectedDetails: string[] = [];
      weekDates.forEach(date => {
        activePrescriptionsForPatient.forEach(prescription => {
          const dateObj = new Date(date);
          const startDate = new Date(prescription.start_date);
          const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
          // 檢查日期是否在處方有效期內
          if (dateObj >= startDate && (!endDate || dateObj <= endDate)) {
            // 檢查是否根據頻率規則需要服藥
            if (shouldTakeMedicationOnDate(prescription, dateObj)) {
              const timeSlots = prescription.medication_time_slots || [];
              expectedRecordsCount += timeSlots.length;
              expectedDetails.push(`${date}: ${prescription.medication_name} x${timeSlots.length}`);
            }
          }
        });
      });
      // 查詢當周實際存在的記錄數量
      const { data: existingRecords, error } = await supabase
        .from('medication_workflow_records')
        .select('id, scheduled_date, prescription_id', { count: 'exact' })
        .eq('patient_id', patientIdNum)
        .gte('scheduled_date', weekDates[0])
        .lte('scheduled_date', weekDates[6]);
      if (error) {
        console.error('查詢現有記錄失敗:', error);
        return { complete: false, shouldGenerate: false };
      }
      const actualRecordsCount = existingRecords?.length || 0;
      // 如果記錄數量差距過大，輸出詳細信息
      if (actualRecordsCount < expectedRecordsCount) {
        const existingByDate: { [date: string]: number } = {};
        existingRecords?.forEach(record => {
          existingByDate[record.scheduled_date] = (existingByDate[record.scheduled_date] || 0) + 1;
        });
      }
      const isComplete = actualRecordsCount >= expectedRecordsCount;
      return { complete: isComplete, shouldGenerate: !isComplete && expectedRecordsCount > 0 };
    } catch (error) {
      console.error('檢查工作流程完整性失敗:', error);
      return { complete: false, shouldGenerate: false };
    }
  };
  // 自動生成當周工作流程記錄（添加防抖鎖定）
  const autoGenerateWeekWorkflow = async (patientIdNum: number, weekDates: string[]) => {
    // 檢查是否正在生成，防止併發
    if (isGeneratingRef.current) {
      return { success: false, message: '生成任務進行中', totalRecords: 0, failedDates: [] };
    }
    try {
      // 設置生成鎖定
      isGeneratingRef.current = true;
      const startDate = weekDates[0];
      const endDate = weekDates[6];
      const result = await generateBatchWorkflowRecords(startDate, endDate, patientIdNum);
      if (result.success) {
        // 等待 500ms 確保 Supabase 數據一致性
        await new Promise(resolve => setTimeout(resolve, 500));
        // 直接查詢 Supabase 重新載入數據
        const { data, error } = await supabase
          .from('medication_workflow_records')
          .select('*')
          .eq('patient_id', patientIdNum)
          .gte('scheduled_date', weekDates[0])
          .lte('scheduled_date', weekDates[6])
          .order('scheduled_date')
          .order('scheduled_time');
        if (!error && data) {
          setAllWorkflowRecords(data);
        } else {
          console.error('❌ 自動載入失敗:', error);
        }
      } else {
        console.warn('⚠️ 自動生成部分失敗:', result.message);
        if (result.failedDates && result.failedDates.length > 0) {
          console.warn('失敗的日期:', result.failedDates);
        }
        // 即使部分失敗，也嘗試重新載入已成功生成的數據
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data } = await supabase
          .from('medication_workflow_records')
          .select('*')
          .eq('patient_id', patientIdNum)
          .gte('scheduled_date', weekDates[0])
          .lte('scheduled_date', weekDates[6])
          .order('scheduled_date')
          .order('scheduled_time');
        if (data) {
          setAllWorkflowRecords(data);
        }
      }
      return result;
    } catch (error) {
      console.error('自動生成工作流程失敗:', error);
      return { success: false, message: '自動生成失敗', totalRecords: 0, failedDates: [] };
    } finally {
      // 釋放生成鎖定
      isGeneratingRef.current = false;
    }
  };
  // 按床號排序的在住院友列表
  const sortedActivePatients = useMemo(() => {
    return patients
      .filter(p => p.在住狀態 === '在住')
      .sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);
  
  // 去重後的工作流程記錄（確保每個 prescription_id + date + time 組合只有一筆）
  const deduplicatedWorkflowRecords = useMemo(() => {
    const seen = new Map<string, any>();
    const duplicates: any[] = [];
    // 遍歷所有記錄，保留最新的（後面的會覆蓋前面的）
    allWorkflowRecords.forEach(record => {
      const key = `${record.prescription_id}_${record.scheduled_date}_${record.scheduled_time?.trim().substring(0, 5)}`;
      // 如果已經有相同 key 的記錄，比較哪個更"完整"（有更多已完成的步驟）
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, record);
      } else {
        // 計算完成度分數
        const getCompletionScore = (r: any) => {
          let score = 0;
          if (r.preparation_status === 'completed') score += 1;
          if (r.verification_status === 'completed') score += 1;
          if (r.dispensing_status === 'completed' || r.dispensing_status === 'failed') score += 1;
          return score;
        };
        // 記錄重複信息
        duplicates.push({
          key,
          existing: { id: existing.id, prep: existing.preparation_status, ver: existing.verification_status },
          new: { id: record.id, prep: record.preparation_status, ver: record.verification_status }
        });
        // 保留完成度更高的記錄，或者如果完成度相同則保留 ID 較新的
        if (getCompletionScore(record) > getCompletionScore(existing) ||
            (getCompletionScore(record) === getCompletionScore(existing) && record.id > existing.id)) {
          seen.set(key, record);
        }
      }
    });
    const deduplicated = Array.from(seen.values());
    if (duplicates.length > 0) {
      console.warn(`⚠️ 發現 ${duplicates.length} 組重複記錄！`, duplicates);
      console.warn(`原始: ${allWorkflowRecords.length}, 去重後: ${deduplicated.length}`);
    }
    return deduplicated;
  }, [allWorkflowRecords]);
  
  // 應用樂觀更新到工作流程記錄 - 創建帶有樂觀更新的記錄副本
  const recordsWithOptimisticUpdates = useMemo(() => {
    if (optimisticWorkflowUpdates.size === 0) {
      return deduplicatedWorkflowRecords;
    }
    return deduplicatedWorkflowRecords.map(record => {
      const optimisticUpdate = optimisticWorkflowUpdates.get(record.id);
      if (optimisticUpdate) {
        return { ...record, ...optimisticUpdate };
      }
      return record;
    });
  }, [deduplicatedWorkflowRecords, optimisticWorkflowUpdates]);
  
  // 預設選擇第一個在住院友
  useEffect(() => {
    if (!selectedPatientId && sortedActivePatients.length > 0) {
      setSelectedPatientId(sortedActivePatients[0].院友id.toString());
    }
  }, [selectedPatientId, sortedActivePatients]);
  // 自動檢測並生成當周工作流程（添加防抖延遲）
  useEffect(() => {
    // 清除之前的定時器
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
    }
    const checkAndGenerateWorkflow = async () => {
      if (!selectedPatientId || autoGenerationChecked || weekDates.length === 0) {
        return;
      }
      const patientIdNum = parseInt(selectedPatientId);
      if (isNaN(patientIdNum)) {
        return;
      }
      // 等待處方數據載入完成
      if (prescriptions.length === 0) {
        return;
      }
      // 檢查是否正在生成
      if (isGeneratingRef.current) {
        return;
      }
      const { complete, shouldGenerate } = await checkWeekWorkflowCompleteness(patientIdNum, weekDates);
      if (shouldGenerate) {
        await autoGenerateWeekWorkflow(patientIdNum, weekDates);
      } else if (complete) {
      }
      setAutoGenerationChecked(true);
    };
    // 添加 300ms 防抖延遲，避免快速切換時重複觸發
    generationTimeoutRef.current = setTimeout(() => {
      checkAndGenerateWorkflow();
    }, 300);
    // 清理函數
    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    };
  }, [selectedPatientId, weekDates, prescriptions, autoGenerationChecked]);
  // 當院友或日期改變時，重置自動生成標記
  useEffect(() => {
    setAutoGenerationChecked(false);
  }, [selectedPatientId, selectedDate]);
  // 當 weekDates 或 patient 改變時，清空並重新載入一週記錄
  useEffect(() => {
    if (selectedPatientId && weekDates.length > 0) {
      setAllWorkflowRecords([]);
      const patientIdNum = parseInt(selectedPatientId);
      if (!isNaN(patientIdNum)) {
        (async () => {
          // 一次性載入整週的記錄（更高效）
          const { data, error } = await supabase
            .from('medication_workflow_records')
            .select('*')
            .eq('patient_id', patientIdNum)
            .gte('scheduled_date', weekDates[0])
            .lte('scheduled_date', weekDates[6])
            .order('scheduled_date')
            .order('scheduled_time');
          if (error) {
            console.error('❌ 載入當周記錄失敗:', error);
          } else {
            // 按日期統計記錄
            const byDate: Record<string, number> = {};
            const byPrescription: Record<string, number> = {};
            data?.forEach(record => {
              byDate[record.scheduled_date] = (byDate[record.scheduled_date] || 0) + 1;
              byPrescription[record.prescription_id] = (byPrescription[record.prescription_id] || 0) + 1;
            });
            // 直接設置到 allWorkflowRecords，跳過 context
            setAllWorkflowRecords(data || []);
          }
        })();
      }
    }
  }, [selectedPatientId, JSON.stringify(weekDates)]);
  // 監聯 context 的 prescriptionWorkflowRecords 改變，只更新已存在的記錄，不引入週外記錄
  useEffect(() => {
    if (selectedPatientId) {
      setAllWorkflowRecords(prev => {
        const newRecords = prescriptionWorkflowRecords.filter(r => r.patient_id.toString() === selectedPatientId);
        if (newRecords.length === 0) {
          return prev;
        }
        // 只更新已存在的記錄（通過 ID 匹配），不引入新記錄
        const prevIds = new Set(prev.map(r => r.id));
        const recordsToUpdate = newRecords.filter(r => prevIds.has(r.id));
        if (recordsToUpdate.length === 0) {
          return prev;
        }
        // 創建更新映射
        const updateMap = new Map(recordsToUpdate.map(r => [r.id, r]));
        // 更新現有記錄
        return prev.map(r => updateMap.has(r.id) ? updateMap.get(r.id)! : r);
      });
    }
  }, [prescriptionWorkflowRecords, selectedPatientId]);
  // 處理點擊外部關閉日期選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setIsDateMenuOpen(false);
        setSelectedDateForMenu(null);
      }
    };
    if (isDateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateMenuOpen]);
  // 計算日期選單位置（向上展開）
  useEffect(() => {
    if (isDateMenuOpen && selectedDateForMenu) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-date="${selectedDateForMenu}"]`) as HTMLElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          // 向上展開：使用 bottom 定位，菜單顯示在日期上方
          setMenuPosition({
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left
          });
        }
      });
    }
  }, [isDateMenuOpen, selectedDateForMenu]);
  // 獲取當前日期的工作流程記錄（用於一鍵操作等）
  // 重要：包含在服處方(status='active')和有效期內的停用處方(status='inactive')的記錄
  const currentDayWorkflowRecords = useMemo(() => {
    // 使用已經應用了樂觀更新的記錄
    return recordsWithOptimisticUpdates.filter(r => {
      // 1. 必須是當天的記錄
      if (r.scheduled_date !== selectedDate) return false;
      // 2. 必須是選中院友的記錄
      if (r.patient_id.toString() !== selectedPatientId) return false;
      // 3. 檢查處方狀態
      const prescription = prescriptions.find(p => p.id === r.prescription_id);
      if (!prescription) return false;
      // 在服處方：正常包含
      if (prescription.status === 'active') return true;
      // 停用處方：檢查記錄日期是否在處方有效期內
      if (prescription.status === 'inactive') {
        const recordDate = new Date(r.scheduled_date);
        const startDate = new Date(prescription.start_date);
        const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
        return recordDate >= startDate && (!endDate || recordDate <= endDate);
      }
      // 其他狀態（如 pending_change）：排除
      return false;
    });
  }, [recordsWithOptimisticUpdates, selectedDate, selectedPatientId, prescriptions]);
  // 獲取選中院友的在服處方（基於選取日期）
  const selectedPatient = useMemo(() => {
    const patient = sortedActivePatients.find(p => p.院友id.toString() === selectedPatientId);
    if (!patient) return undefined;
    // 應用樂觀更新
    if (optimisticCrushState.has(patient.院友id)) {
      return {
        ...patient,
        needs_medication_crushing: optimisticCrushState.get(patient.院友id)
      };
    }
    return patient;
  }, [sortedActivePatients, selectedPatientId, optimisticCrushState]);
  // 院友導航函數
  const goToPreviousPatient = () => {
    if (sortedActivePatients.length === 0) return;
    const currentIndex = sortedActivePatients.findIndex(p => p.院友id.toString() === selectedPatientId);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : sortedActivePatients.length - 1;
    setSelectedPatientId(sortedActivePatients[previousIndex].院友id.toString());
  };
  const goToNextPatient = () => {
    if (sortedActivePatients.length === 0) return;
    const currentIndex = sortedActivePatients.findIndex(p => p.院友id.toString() === selectedPatientId);
    const nextIndex = currentIndex < sortedActivePatients.length - 1 ? currentIndex + 1 : 0;
    setSelectedPatientId(sortedActivePatients[nextIndex].院友id.toString());
  };
  // 獲取當周所有工作流程記錄涉及的處方ID
  const weekPrescriptionIds = useMemo(() => {
    const ids = new Set<string>();
    allWorkflowRecords.forEach(record => {
      ids.add(record.prescription_id);
    });
    return ids;
  }, [allWorkflowRecords]);
  // 過濾處方：顯示在服處方 + 停用但在當周有工作流程記錄的處方
  const activePrescriptions = useMemo(() => {
    return prescriptions.filter(p => {
      // 1. 必須是當前選中的院友
      if (p.patient_id.toString() !== selectedPatientId) {
        return false;
      }
      // 2. 如果是在服處方，檢查日期有效性
      if (p.status === 'active') {
        const weekStart = new Date(weekDates[0]);
        const weekEnd = new Date(weekDates[6]);
        const startDate = new Date(p.start_date);
        // 處方必須在週結束日期之前或當天開始
        if (startDate > weekEnd) return false;
        // 如果有結束日期，處方必須在週開始日期之後或當天結束
        if (p.end_date) {
          const endDate = new Date(p.end_date);
          if (endDate < weekStart) return false;
        }
        // 必須在當周有工作流程記錄
        return weekPrescriptionIds.has(p.id);
      }
      // 3. 如果是停用處方，檢查當周是否有相關工作流程記錄
      if (p.status === 'inactive') {
        return weekPrescriptionIds.has(p.id);
      }
      // 4. 其他狀態（pending_change等）暫不顯示
      return false;
    });
  }, [prescriptions, selectedPatientId, weekDates, weekPrescriptionIds]);
  // 根據備藥方式過濾處方
  const filteredPrescriptions = activePrescriptions.filter(p => {
    if (preparationFilter === 'all') {
      return true;
    } else if (preparationFilter === 'advanced') {
      return p.preparation_method === 'advanced';
    } else if (preparationFilter === 'immediate') {
      return p.preparation_method === 'immediate';
    }
    return true;
  });
  // 計算每個日期的逾期未完成流程狀態（用於紅點提示，使用樂觀更新記錄）
  const dateOverdueStatus = useMemo(() => {
    return calculateOverdueCountByDate(recordsWithOptimisticUpdates, weekDates);
  }, [recordsWithOptimisticUpdates, weekDates]);
  // 計算每個備藥方式的逾期未完成流程數量（用於分頁標籤紅點提示，使用樂觀更新記錄）
  const preparationMethodOverdueCounts = useMemo(() => {
    return calculateOverdueCountByPreparationMethod(recordsWithOptimisticUpdates, prescriptions);
  }, [recordsWithOptimisticUpdates, prescriptions]);
  // 計算藥物數量統計
  const medicationStats = useMemo(() => {
    const timeSlotStats: { [timeSlot: string]: { [dosageForm: string]: { count: number; totalAmount: number; unit: string } } } = {};
    activePrescriptions.forEach(prescription => {
      if (prescription.medication_time_slots && prescription.medication_time_slots.length > 0) {
        prescription.medication_time_slots.forEach((timeSlot: string) => {
          if (!timeSlotStats[timeSlot]) {
            timeSlotStats[timeSlot] = {};
          }
          const dosageForm = prescription.dosage_form || '未知劑型';
          const dosageAmount = prescription.dosage_amount || '1';
          const dosageUnit = prescription.dosage_unit || '';
          if (!timeSlotStats[timeSlot][dosageForm]) {
            timeSlotStats[timeSlot][dosageForm] = { count: 0, totalAmount: 0, unit: dosageUnit };
          }
          timeSlotStats[timeSlot][dosageForm].count++;
          // 如果是數值，累加總量
          if (!isNaN(parseFloat(dosageAmount))) {
            timeSlotStats[timeSlot][dosageForm].totalAmount += parseFloat(dosageAmount);
          }
        });
      }
    });
    return timeSlotStats;
  }, [activePrescriptions]);
  // 處理步驟點擊
  const handleStepClick = async (recordId: string, step: string) => {
    if (!recordId || recordId === 'undefined') {
      console.error('無效的記錄ID:', recordId);
      return;
    }
    if (!selectedPatientId) {
      console.error('缺少必要的院友ID:', { selectedPatientId });
      return;
    }
    // 驗證 selectedPatientId 是否為有效數字
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      console.error('無效的院友ID:', selectedPatientId);
      return;
    }
    // 使用帶樂觀更新的記錄來判斷當前狀態
    const recordWithOptimistic = recordsWithOptimisticUpdates.find(r => r.id === recordId);
    // 使用原始記錄來執行操作（確保 ID 正確）
    const record = allWorkflowRecords.find(r => r.id === recordId);
    if (!record || !recordWithOptimistic) {
      console.error('找不到對應的工作流程記錄:', recordId);
      return;
    }
    // 使用帶樂觀更新的記錄狀態來決定操作
    const stepStatus = getStepStatus(recordWithOptimistic, step);
    if (stepStatus === 'pending') {
      // 待處理狀態：直接執行操作
      if (step === 'preparation' || step === 'verification') {
        // 執藥和核藥：直接完成
        await handleCompleteWorkflowStep(recordId, step);
      } else if (step === 'dispensing') {
        // 派藥：保持原有邏輯，檢查特殊情況
        await handleCompleteWorkflowStep(recordId, step);
      }
    } else if (stepStatus === 'completed' || stepStatus === 'failed') {
      // 已完成或失敗狀態：打開撤銷確認對話框
      setRevertActionRecord(record);
      setRevertActionStep(step);
      setShowRevertConfirmModal(true);
    }
  };
  // 處理撤銷步驟
  const handleRevertStep = async (recordId: string, step: string) => {
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      console.error('無效的院友ID:', selectedPatientId);
      return;
    }
    const record = allWorkflowRecords.find(r => r.id === recordId);
    if (!record) return;
    try {
      await revertPrescriptionWorkflowStep(recordId, step as any, patientIdNum, record.scheduled_date);
      // 直接更新 allWorkflowRecords（因為 Context 可能不包含這個記錄）
      setAllWorkflowRecords(prev =>
        prev.map(r => {
          if (r.id !== recordId) return r;
          if (step === 'preparation') {
            return { ...r, preparation_status: 'pending', preparation_staff: null, preparation_time: null };
          } else if (step === 'verification') {
            return { ...r, verification_status: 'pending', verification_staff: null, verification_time: null };
          } else if (step === 'dispensing') {
            return { ...r, dispensing_status: 'pending', dispensing_staff: null, dispensing_time: null, failure_reason: null };
          }
          return r;
        })
      );
    } catch (error) {
      console.error(`撤銷${step}失敗:`, error);
    }
  };
  // 檢查服藥時間點是否在入院期間
  const isInHospitalizationPeriod = (patientId: number, scheduledDate: string, scheduledTime: string): boolean => {
    // 不限制狀態，檢查所有住院事件（active 和 completed 都要）
    const patientEpisodes = hospitalEpisodes.filter(ep => ep.patient_id === patientId);
    if (patientEpisodes.length === 0) {
      return false;
    }
    // 服藥時間點
    const medicationDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    console.log('⏰ 服藥時間:', medicationDateTime.toISOString());
    // 檢查所有住院事件，看服藥時間是否落在任何一個入院期間
    for (const episode of patientEpisodes) {
      // 如果有 episode_start_date 和 episode_end_date，直接檢查（簡單方式）
      if (episode.episode_start_date && episode.episode_end_date) {
        const startDate = new Date(`${episode.episode_start_date}T00:00:00`);
        const endDate = new Date(`${episode.episode_end_date}T23:59:59`);
        if (medicationDateTime >= startDate && medicationDateTime <= endDate) {
          console.log('  ✅ 服藥時間在住院期間內（簡單方式）:', {
            startDate: episode.episode_start_date,
            endDate: episode.episode_end_date
          });
          return true;
        }
        continue;
      }
      // 否則檢查 episode_events（詳細方式）
      if (!episode.episode_events || episode.episode_events.length === 0) {
        continue;
      }
      // 找出該住院事件的所有入院和出院事件
      const admissionEvents = episode.episode_events
        .filter((e: any) => e.event_type === 'admission')
        .sort((a: any, b: any) => {
          const dateA = new Date(`${a.event_date}T${a.event_time || '00:00:00'}`);
          const dateB = new Date(`${b.event_date}T${b.event_time || '00:00:00'}`);
          return dateA.getTime() - dateB.getTime(); // 按時間順序排序
        });
      const dischargeEvents = episode.episode_events
        .filter((e: any) => e.event_type === 'discharge')
        .sort((a: any, b: any) => {
          const dateA = new Date(`${a.event_date}T${a.event_time || '00:00:00'}`);
          const dateB = new Date(`${b.event_date}T${b.event_time || '00:00:00'}`);
          return dateA.getTime() - dateB.getTime(); // 按時間順序排序
        });
      // 檢查每個入院事件
      for (const admission of admissionEvents) {
        const admissionDateTime = new Date(`${admission.event_date}T${admission.event_time || '00:00:00'}`);
        console.log('  🏥 入院時間:', admissionDateTime.toISOString(), 'isValid:', !isNaN(admissionDateTime.getTime()));
        // 如果服藥時間早於入院時間，跳過此入院事件
        if (medicationDateTime < admissionDateTime) {
          continue;
        }
        // 找出此入院後的第一個出院事件
        const nextDischarge = dischargeEvents.find((discharge: any) => {
          const dischargeDateTime = new Date(`${discharge.event_date}T${discharge.event_time || '00:00:00'}`);
          return dischargeDateTime > admissionDateTime;
        });
        if (nextDischarge) {
          const dischargeDateTime = new Date(`${nextDischarge.event_date}T${nextDischarge.event_time || '00:00:00'}`);
          console.log('  🚪 對應出院時間:', dischargeDateTime.toISOString(), 'isValid:', !isNaN(dischargeDateTime.getTime()));
          // 檢查服藥時間是否在入院和出院之間
          if (medicationDateTime >= admissionDateTime && medicationDateTime < dischargeDateTime) {
            return true;
          } else {
          }
        } else {
          // 沒有對應的出院事件，表示仍在住院中
          if (medicationDateTime >= admissionDateTime) {
            return true;
          }
        }
      }
    }
    return false;
  };
  // 檢查服藥時間是否在渡假期間
  const isInVacationPeriod = (patientId: number, scheduledDate: string, scheduledTime: string): boolean => {
    // 不限制狀態，檢查所有住院事件（包含渡假事件）
    const patientEpisodes = hospitalEpisodes.filter(ep => ep.patient_id === patientId);
    if (patientEpisodes.length === 0) {
      return false;
    }
    // 服藥時間點
    const medicationDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    console.log('⏰ 服藥時間:', medicationDateTime.toISOString());
    // 檢查所有住院事件，看服藥時間是否落在任何一個渡假期間
    for (const episode of patientEpisodes) {
      if (!episode.episode_events || episode.episode_events.length === 0) {
        continue;
      }
      // 找出該住院事件的所有渡假開始和渡假結束事件
      const vacationStartEvents = episode.episode_events
        .filter((e: any) => e.event_type === 'vacation_start')
        .sort((a: any, b: any) => {
          const dateA = new Date(`${a.event_date}T${a.event_time || '00:00:00'}`);
          const dateB = new Date(`${b.event_date}T${b.event_time || '00:00:00'}`);
          return dateA.getTime() - dateB.getTime();
        });
      const vacationEndEvents = episode.episode_events
        .filter((e: any) => e.event_type === 'vacation_end')
        .sort((a: any, b: any) => {
          const dateA = new Date(`${a.event_date}T${a.event_time || '00:00:00'}`);
          const dateB = new Date(`${b.event_date}T${b.event_time || '00:00:00'}`);
          return dateA.getTime() - dateB.getTime();
        });
      // 檢查每個渡假開始事件
      for (const vacationStart of vacationStartEvents) {
        const vacationStartDateTime = new Date(`${vacationStart.event_date}T${vacationStart.event_time || '00:00:00'}`);
        console.log('  🏖️ 渡假開始時間:', vacationStartDateTime.toISOString());
        // 如果服藥時間早於渡假開始時間，跳過此渡假事件
        if (medicationDateTime < vacationStartDateTime) {
          continue;
        }
        // 找出此渡假開始後的第一個渡假結束事件
        const nextVacationEnd = vacationEndEvents.find((vacationEnd: any) => {
          const vacationEndDateTime = new Date(`${vacationEnd.event_date}T${vacationEnd.event_time || '00:00:00'}`);
          return vacationEndDateTime > vacationStartDateTime;
        });
        if (nextVacationEnd) {
          const vacationEndDateTime = new Date(`${nextVacationEnd.event_date}T${nextVacationEnd.event_time || '00:00:00'}`);
          console.log('  🏠 對應渡假結束時間:', vacationEndDateTime.toISOString());
          // 檢查服藥時間是否在渡假開始和渡假結束之間
          if (medicationDateTime >= vacationStartDateTime && medicationDateTime < vacationEndDateTime) {
            return true;
          } else {
          }
        } else {
          // 沒有對應的渡假結束事件，表示仍在渡假中
          if (medicationDateTime >= vacationStartDateTime) {
            return true;
          }
        }
      }
    }
    return false;
  };
  // 處理完成工作流程步驟
  const handleCompleteWorkflowStep = async (recordId: string, step: string) => {
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) return;
    const record = allWorkflowRecords.find(r => r.id === recordId);
    if (!record) return;
    const scheduledDate = record.scheduled_date;
    // 樂觀更新：立即更新 UI
    if (step === 'preparation') {
      setOptimisticWorkflowUpdates(prev => {
        const next = new Map(prev);
        next.set(recordId, { ...prev.get(recordId), preparation_status: 'completed' });
        return next;
      });
    } else if (step === 'verification') {
      setOptimisticWorkflowUpdates(prev => {
        const next = new Map(prev);
        next.set(recordId, { ...prev.get(recordId), verification_status: 'completed' });
        return next;
      });
    }
    try {
      if (step === 'preparation') {
        await prepareMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, scheduledDate);
        // 直接更新 allWorkflowRecords（因為 Context 可能不包含這個記錄）
        setAllWorkflowRecords(prev =>
          prev.map(r => r.id === recordId
            ? { ...r, preparation_status: 'completed', preparation_staff: displayName, preparation_time: new Date().toISOString() }
            : r
          )
        );
        // 立即清除樂觀更新（因為真實數據已經更新）
        setOptimisticWorkflowUpdates(prev => {
          const next = new Map(prev);
          next.delete(recordId);
          return next;
        });
      } else if (step === 'verification') {
        await verifyMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, scheduledDate);
        // 直接更新 allWorkflowRecords（因為 Context 可能不包含這個記錄）
        setAllWorkflowRecords(prev =>
          prev.map(r => r.id === recordId
            ? { ...r, verification_status: 'completed', verification_staff: displayName, verification_time: new Date().toISOString() }
            : r
          )
        );
        // 立即清除樂觀更新（因為真實數據已經更新）
        setOptimisticWorkflowUpdates(prev => {
          const next = new Map(prev);
          next.delete(recordId);
          return next;
        });
      } else if (step === 'dispensing') {
        const prescription = prescriptions.find(p => p.id === record.prescription_id);
        const patient = patients.find(p => p.院友id === record.patient_id);
        // 檢查服藥時間點是否在入院期間
        const inHospitalizationPeriod = isInHospitalizationPeriod(
          patientIdNum,
          record.scheduled_date,
          record.scheduled_time
        );
        // 檢查服藥時間點是否在渡假期間
        const inVacationPeriod = isInVacationPeriod(
          patientIdNum,
          record.scheduled_date,
          record.scheduled_time
        );
        // 如果在入院期間，直接寫入"入院"失敗，不彈出任何對話框
        if (inHospitalizationPeriod) {
          // 樂觀更新
          setOptimisticWorkflowUpdates(prev => {
            const next = new Map(prev);
            next.set(recordId, { ...prev.get(recordId), dispensing_status: 'failed' });
            return next;
          });
          const inspectionResult = {
            canDispense: false,
            isHospitalized: true,
            blockedRules: [],
            usedVitalSignData: {}
          };
          try {
            await dispenseMedication(
              record.id,
              displayName || '未知',
              '入院',
              undefined,
              patientIdNum,
              scheduledDate,
              undefined,
              inspectionResult
            );
            // 直接更新本地狀態
            updateLocalWorkflowRecords([recordId], 'dispensing', 'failed', '入院');
            // 清除樂觀更新狀態
            setOptimisticWorkflowUpdates(prev => {
              const next = new Map(prev);
              next.delete(recordId);
              return next;
            });
          } catch (error) {
            // 回滾樂觀更新
            setOptimisticWorkflowUpdates(prev => {
              const next = new Map(prev);
              next.delete(recordId);
              return next;
            });
            throw error;
          }
          return;
        }
        // 如果在渡假期間，直接寫入"回家"失敗，不彈出任何對話框
        if (inVacationPeriod) {
          // 樂觀更新
          setOptimisticWorkflowUpdates(prev => {
            const next = new Map(prev);
            next.set(recordId, { ...prev.get(recordId), dispensing_status: 'failed' });
            return next;
          });
          const inspectionResult = {
            canDispense: false,
            isOnVacation: true,
            blockedRules: [],
            usedVitalSignData: {}
          };
          try {
            await dispenseMedication(
              record.id,
              displayName || '未知',
              '回家',
              undefined,
              patientIdNum,
              scheduledDate,
              undefined,
              inspectionResult
            );
            // 直接更新本地狀態
            updateLocalWorkflowRecords([recordId], 'dispensing', 'failed', '回家');
            // 清除樂觀更新狀態
            setOptimisticWorkflowUpdates(prev => {
              const next = new Map(prev);
              next.delete(recordId);
              return next;
            });
          } catch (error) {
            // 回滾樂觀更新
            setOptimisticWorkflowUpdates(prev => {
              const next = new Map(prev);
              next.delete(recordId);
              return next;
            });
            throw error;
          }
          return;
        }
        // 正確流程：優先檢測項 → 注射位置 → 派藥確認
        if (prescription?.inspection_rules && prescription.inspection_rules.length > 0) {
          // 有檢測項要求的藥物需要檢測
          setSelectedWorkflowRecord(record);
          setSelectedStep(step);
          setShowInspectionCheckModal(true);
        } else if (prescription?.administration_route === '注射') {
          // 針劑需要選擇注射位置（無檢測項要求）
          setCurrentInjectionRecord(record);
          setShowInjectionSiteModal(true);
        } else {
          // 普通藥物：顯示派藥確認對話框
          setSelectedWorkflowRecord(record);
          setSelectedStep(step);
          setShowDispenseConfirmModal(true);
        }
      }
    } catch (error) {
      console.error(`執行${step}失敗:`, error);
      // 回滾樂觀更新
      if (step === 'preparation' || step === 'verification') {
        setOptimisticWorkflowUpdates(prev => {
          const next = new Map(prev);
          next.delete(recordId);
          return next;
        });
      }
    }
  };
  // 獲取步驟狀態
  const getStepStatus = (record: any, step: string) => {
    switch (step) {
      case 'preparation':
        return record.preparation_status;
      case 'verification':
        return record.verification_status;
      case 'dispensing':
        return record.dispensing_status;
      default:
        return 'pending';
    }
  };
  
  // 輔助函數：批量更新本地工作流程記錄狀態
  // 用於在批量操作成功後直接更新 allWorkflowRecords，而非依賴 Context 同步
  const updateLocalWorkflowRecords = (
    recordIds: string[],
    step: 'preparation' | 'verification' | 'dispensing',
    status: 'completed' | 'pending' | 'failed',
    failureReason?: string,
    customFailureReason?: string
  ) => {
    const now = new Date().toISOString();
    setAllWorkflowRecords(prev =>
      prev.map(r => {
        if (!recordIds.includes(r.id)) return r;
        if (step === 'preparation') {
          return {
            ...r,
            preparation_status: status,
            preparation_staff: status === 'completed' ? displayName : null,
            preparation_time: status === 'completed' ? now : null
          };
        } else if (step === 'verification') {
          return {
            ...r,
            verification_status: status,
            verification_staff: status === 'completed' ? displayName : null,
            verification_time: status === 'completed' ? now : null
          };
        } else if (step === 'dispensing') {
          return {
            ...r,
            dispensing_status: status,
            dispensing_staff: status !== 'pending' ? displayName : null,
            dispensing_time: status !== 'pending' ? now : null,
            dispensing_failure_reason: status === 'failed' ? (failureReason || null) : null,
            custom_failure_reason: status === 'failed' ? (customFailureReason || null) : null
          };
        }
        return r;
      })
    );
  };

  // 檢查院友是否入院中
  const checkPatientHospitalized = (patientId: number): boolean => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient?.is_hospitalized || false;
  };
  // 一鍵執藥（僅當日）- 優化並行處理
  const handleOneClickPrepare = async () => {
    if (!selectedPatientId || !selectedDate) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, preparation: true }));
    try {
      // 找到所有待執藥的記錄（排除即時備藥）
      const pendingPreparationRecords = currentDayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return r.preparation_status === 'pending' && prescription?.preparation_method !== 'immediate';
      });
      if (pendingPreparationRecords.length === 0) {
        return;
      }
      // 並行處理所有執藥操作
      const results = await Promise.allSettled(
        pendingPreparationRecords.map(record =>
          prepareMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate)
        )
      );
      // 收集成功的記錄 ID 並更新本地狀態
      const successIds = pendingPreparationRecords
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(r => r.id);
      if (successIds.length > 0) {
        updateLocalWorkflowRecords(successIds, 'preparation', 'completed');
      }
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`執藥失敗 (記錄ID: ${pendingPreparationRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵執藥失敗:', error);
    } finally {
      setOneClickProcessing(prev => ({ ...prev, preparation: false }));
    }
  };
  // 一鍵核藥（僅當日）- 優化並行處理
  const handleOneClickVerify = async () => {
    if (!selectedPatientId || !selectedDate) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, verification: true }));
    try {
      // 找到所有待核藥且執藥已完成的記錄（排除即時備藥）
      const pendingVerificationRecords = currentDayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return r.verification_status === 'pending' &&
               r.preparation_status === 'completed' &&
               prescription?.preparation_method !== 'immediate';
      });
      if (pendingVerificationRecords.length === 0) {
        return;
      }
      // 並行處理所有核藥操作
      const results = await Promise.allSettled(
        pendingVerificationRecords.map(record =>
          verifyMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate)
        )
      );
      // 收集成功的記錄 ID 並更新本地狀態
      const successIds = pendingVerificationRecords
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(r => r.id);
      if (successIds.length > 0) {
        updateLocalWorkflowRecords(successIds, 'verification', 'completed');
      }
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`核藥失敗 (記錄ID: ${pendingVerificationRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵核藥失敗:', error);
    } finally {
      setOneClickProcessing(prev => ({ ...prev, verification: false }));
    }
  };
  // 檢查是否可以一鍵派藥
  const canOneClickDispense = (prescription: any) => {
    // 必須是即時備藥
    if (prescription?.preparation_method !== 'immediate') {
      return false;
    }
    // 必須是口服途徑
    if (prescription?.administration_route !== '口服') {
      return false;
    }
    // 不能有檢測項要求
    if (prescription?.inspection_rules && prescription.inspection_rules.length > 0) {
      return false;
    }
    return true;
  };
  // 一鍵全程（即時備藥+口服+無檢測項）- 完成執藥、核藥、派藥全流程
  const handleOneClickDispenseSpecial = async () => {
    if (!selectedPatientId || !selectedDate) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, dispensing: true }));
    try {
      // 找到所有符合一鍵全程條件的當日即時備藥處方記錄（任何階段）
      const eligibleRecords = currentDayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        // 只要符合即時備藥條件，無論目前在哪個階段
        return canOneClickDispense(prescription);
      });
      if (eligibleRecords.length === 0) {
        return;
      }
      // 統計各階段數量
      let successCount = 0;
      let hospitalizedCount = 0;
      let vacationCount = 0;
      let failCount = 0;
      // 收集各階段成功的記錄 ID
      const preparedIds: string[] = [];
      const verifiedIds: string[] = [];
      const dispensedSuccessIds: string[] = [];
      const dispensedHospitalizedIds: string[] = [];
      const dispensedVacationIds: string[] = [];
      // 並行處理所有記錄
      const results = await Promise.allSettled(
        eligibleRecords.map(async (record) => {
          // 檢查此筆記錄的服藥時間是否在入院期間
          const inHospitalizationPeriod = isInHospitalizationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 檢查此筆記錄的服藥時間是否在渡假期間
          const inVacationPeriod = isInVacationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 執行完整流程：執藥 -> 核藥 -> 派藥
          try {
            // 1. 執藥（如果還未執藥）
            if (record.preparation_status === 'pending') {
              await prepareMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate);
              preparedIds.push(record.id);
            }
            // 2. 核藥（如果還未核藥）
            if (record.verification_status === 'pending') {
              await verifyMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate);
              verifiedIds.push(record.id);
            }
            // 3. 派藥（如果還未派藥）
            if (record.dispensing_status === 'pending') {
              if (inHospitalizationPeriod) {
                // 如果服藥時間在入院期間，自動標記為「入院」失敗原因
                await dispenseMedication(record.id, displayName || '未知', '入院', undefined, patientIdNum, selectedDate);
                dispensedHospitalizedIds.push(record.id);
                return { type: 'hospitalized', recordId: record.id };
              } else if (inVacationPeriod) {
                // 如果服藥時間在渡假期間，自動標記為「回家」失敗原因
                await dispenseMedication(record.id, displayName || '未知', '回家', undefined, patientIdNum, selectedDate);
                dispensedVacationIds.push(record.id);
                return { type: 'vacation', recordId: record.id };
              } else {
                // 正常派藥
                await dispenseMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate);
                dispensedSuccessIds.push(record.id);
                return { type: 'success', recordId: record.id };
              }
            }
            return { type: 'already_completed', recordId: record.id };
          } catch (error) {
            console.error(`處理記錄 ${record.id} 失敗:`, error);
            throw error;
          }
        })
      );
      // 批量更新本地狀態
      if (preparedIds.length > 0) {
        updateLocalWorkflowRecords(preparedIds, 'preparation', 'completed');
      }
      if (verifiedIds.length > 0) {
        updateLocalWorkflowRecords(verifiedIds, 'verification', 'completed');
      }
      if (dispensedSuccessIds.length > 0) {
        updateLocalWorkflowRecords(dispensedSuccessIds, 'dispensing', 'completed');
      }
      if (dispensedHospitalizedIds.length > 0) {
        updateLocalWorkflowRecords(dispensedHospitalizedIds, 'dispensing', 'failed', '入院');
      }
      if (dispensedVacationIds.length > 0) {
        updateLocalWorkflowRecords(dispensedVacationIds, 'dispensing', 'failed', '回家');
      }
      // 統計結果
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          switch (result.value.type) {
            case 'success':
              successCount++;
              break;
            case 'hospitalized':
              hospitalizedCount++;
              break;
            case 'vacation':
              vacationCount++;
              break;
          }
        } else {
          failCount++;
        }
      });
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`一鍵全程失敗 (記錄ID: ${eligibleRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵全程失敗:', error);
    } finally {
      setOneClickProcessing(prev => ({ ...prev, dispensing: false }));
    }
  };
  // 一鍵派藥（僅當日）- 打開確認對話框
  const handleOneClickDispense = (targetDate?: string) => {
    if (!selectedPatientId) {
      return;
    }
    const dateToUse = targetDate || selectedDate;
    if (!dateToUse) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    // 如果傳入了目標日期，先更新 selectedDate
    if (targetDate && targetDate !== selectedDate) {
      setSelectedDate(targetDate);
    }
    // 獲取指定日期的工作流程記錄（使用已應用樂觀更新的記錄）
    const dayRecords = targetDate
      ? recordsWithOptimisticUpdates.filter(r => r.scheduled_date === targetDate)
      : currentDayWorkflowRecords;
    // 找到所有可派藥的記錄（包含有檢測項要求的處方）
    const eligibleRecords = dayRecords.filter(r => {
      const prescription = prescriptions.find(p => p.id === r.prescription_id);
      if (!prescription) return false;
      // 檢查處方狀態：在服處方或有效期內的停用處方
      if (prescription.status === 'active') {
        // 在服處方：正常包含
      } else if (prescription.status === 'inactive') {
        // 停用處方：需要檢查記錄日期是否在處方有效期內
        const recordDate = new Date(r.scheduled_date);
        const startDate = new Date(prescription.start_date);
        const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
        // 如果記錄日期不在處方有效期內，跳過
        if (recordDate < startDate || (endDate && recordDate > endDate)) {
          return false;
        }
      } else {
        // 其他狀態（如 pending_change）：跳過
        return false;
      }
      // 排除注射類藥物
      if (prescription.administration_route === '注射') {
        return false;
      }
      // 包含所有待派藥的記錄（包括有檢測項要求的）
      return r.dispensing_status === 'pending' && r.verification_status === 'completed';
    });
    if (eligibleRecords.length === 0) {
      return;
    }
    // 打開確認對話框
    setShowBatchDispenseModal(true);
  };
  // 為指定日期執行一鍵執藥
  const handleDateOneClickPrepare = async (targetDate: string) => {
    if (!selectedPatientId) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, preparation: true }));
    try {
      console.log(`=== 一鍵執藥開始 (日期: ${targetDate}) ===`);
      // 找到指定日期所有待執藥的記錄（排除即時備藥，使用已應用樂觀更新的記錄）
      const dayWorkflowRecords = recordsWithOptimisticUpdates.filter(r => r.scheduled_date === targetDate);
      const pendingPreparationRecords = dayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return r.preparation_status === 'pending' && prescription?.preparation_method !== 'immediate';
      });
      if (pendingPreparationRecords.length === 0) {
        return;
      }
      // 並行處理所有執藥操作
      const results = await Promise.allSettled(
        pendingPreparationRecords.map(record =>
          prepareMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate)
        )
      );
      // 收集成功的記錄 ID 並更新本地狀態
      const successIds = pendingPreparationRecords
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(r => r.id);
      if (successIds.length > 0) {
        updateLocalWorkflowRecords(successIds, 'preparation', 'completed');
      }
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`執藥失敗 (記錄ID: ${pendingPreparationRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵執藥失敗:', error);
      alert('一鍵執藥失敗，請查看控制台');
    } finally {
      setOneClickProcessing(prev => ({ ...prev, preparation: false }));
    }
  };
  // 為指定日期執行一鍵核藥
  const handleDateOneClickVerify = async (targetDate: string) => {
    if (!selectedPatientId) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, verification: true }));
    try {
      console.log(`=== 一鍵核藥開始 (日期: ${targetDate}) ===`);
      // 找到指定日期所有待核藥的記錄（排除即時備藥，使用已應用樂觀更新的記錄）
      const dayWorkflowRecords = recordsWithOptimisticUpdates.filter(r => r.scheduled_date === targetDate);
      const pendingVerificationRecords = dayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return r.verification_status === 'pending' &&
               r.preparation_status === 'completed' &&
               prescription?.preparation_method !== 'immediate';
      });
      if (pendingVerificationRecords.length === 0) {
        return;
      }
      // 並行處理所有核藥操作
      const results = await Promise.allSettled(
        pendingVerificationRecords.map(record =>
          verifyMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate)
        )
      );
      // 收集成功的記錄 ID 並更新本地狀態
      const successIds = pendingVerificationRecords
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(r => r.id);
      if (successIds.length > 0) {
        updateLocalWorkflowRecords(successIds, 'verification', 'completed');
      }
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`核藥失敗 (記錄ID: ${pendingVerificationRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵核藥失敗:', error);
      alert('一鍵核藥失敗，請查看控制台');
    } finally {
      setOneClickProcessing(prev => ({ ...prev, verification: false }));
    }
  };
  // 為指定日期執行一鍵派藥
  const handleDateOneClickDispense = async (targetDate: string) => {
    if (!selectedPatientId) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, dispensing: true }));
    try {
      console.log(`=== 一鍵派藥開始 (日期: ${targetDate}) ===`);
      // 找到指定日期所有可派藥的記錄（使用已應用樂觀更新的記錄）
      const dayWorkflowRecords = recordsWithOptimisticUpdates.filter(r => r.scheduled_date === targetDate);
      const eligibleRecords = dayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return r.dispensing_status === 'pending' &&
               r.verification_status === 'completed' &&
               prescription?.administration_route !== '注射' &&
               !(prescription?.inspection_rules && prescription.inspection_rules.length > 0);
      });
      if (eligibleRecords.length === 0) {
        return;
      }
      // 收集各類派藥結果
      const dispensedSuccessIds: string[] = [];
      const dispensedHospitalizedIds: string[] = [];
      const dispensedVacationIds: string[] = [];
      // 並行處理所有派藥操作
      const results = await Promise.allSettled(
        eligibleRecords.map(async (record) => {
          // 檢查是否在入院期間
          const inHospitalizationPeriod = isInHospitalizationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 檢查是否在渡假期間
          const inVacationPeriod = isInVacationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          if (inHospitalizationPeriod) {
            await dispenseMedication(record.id, displayName || '未知', '入院', undefined, patientIdNum, targetDate);
            dispensedHospitalizedIds.push(record.id);
            return { type: 'hospitalized', recordId: record.id };
          } else if (inVacationPeriod) {
            await dispenseMedication(record.id, displayName || '未知', '回家', undefined, patientIdNum, targetDate);
            dispensedVacationIds.push(record.id);
            return { type: 'vacation', recordId: record.id };
          } else {
            await dispenseMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate);
            dispensedSuccessIds.push(record.id);
            return { type: 'success', recordId: record.id };
          }
        })
      );
      // 批量更新本地狀態
      if (dispensedSuccessIds.length > 0) {
        updateLocalWorkflowRecords(dispensedSuccessIds, 'dispensing', 'completed');
      }
      if (dispensedHospitalizedIds.length > 0) {
        updateLocalWorkflowRecords(dispensedHospitalizedIds, 'dispensing', 'failed', '入院');
      }
      if (dispensedVacationIds.length > 0) {
        updateLocalWorkflowRecords(dispensedVacationIds, 'dispensing', 'failed', '回家');
      }
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`派藥失敗 (記錄ID: ${eligibleRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵派藥失敗:', error);
      alert('一鍵派藥失敗，請查看控制台');
    } finally {
      setOneClickProcessing(prev => ({ ...prev, dispensing: false }));
    }
  };
  // 為指定日期執行一鍵全程
  const handleDateOneClickFullProcess = async (targetDate: string) => {
    if (!selectedPatientId) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    setOneClickProcessing(prev => ({ ...prev, dispensing: true }));
    try {
      console.log(`=== 一鍵全程開始 (日期: ${targetDate}) ===`);
      // 找到指定日期所有符合一鍵全程條件的記錄（使用已應用樂觀更新的記錄）
      const dayWorkflowRecords = recordsWithOptimisticUpdates.filter(r => r.scheduled_date === targetDate);
      const eligibleRecords = dayWorkflowRecords.filter(r => {
        const prescription = prescriptions.find(p => p.id === r.prescription_id);
        return canOneClickDispense(prescription);
      });
      if (eligibleRecords.length === 0) {
        return;
      }
      let successCount = 0;
      let hospitalizedCount = 0;
      let vacationCount = 0;
      let failCount = 0;
      // 收集各階段成功的記錄 ID
      const preparedIds: string[] = [];
      const verifiedIds: string[] = [];
      const dispensedSuccessIds: string[] = [];
      const dispensedHospitalizedIds: string[] = [];
      const dispensedVacationIds: string[] = [];
      // 並行處理所有記錄
      const results = await Promise.allSettled(
        eligibleRecords.map(async (record) => {
          // 檢查是否在入院期間
          const inHospitalizationPeriod = isInHospitalizationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 檢查是否在渡假期間
          const inVacationPeriod = isInVacationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 執行完整流程：執藥 -> 核藥 -> 派藥
          try {
            // 1. 執藥（如果還未執藥）
            if (record.preparation_status === 'pending') {
              await prepareMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate);
              preparedIds.push(record.id);
            }
            // 2. 核藥（如果還未核藥）
            if (record.verification_status === 'pending') {
              await verifyMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate);
              verifiedIds.push(record.id);
            }
            // 3. 派藥（如果還未派藥）
            if (record.dispensing_status === 'pending') {
              if (inHospitalizationPeriod) {
                await dispenseMedication(record.id, displayName || '未知', '入院', undefined, patientIdNum, targetDate);
                dispensedHospitalizedIds.push(record.id);
                return { type: 'hospitalized', recordId: record.id };
              } else if (inVacationPeriod) {
                await dispenseMedication(record.id, displayName || '未知', '回家', undefined, patientIdNum, targetDate);
                dispensedVacationIds.push(record.id);
                return { type: 'vacation', recordId: record.id };
              } else {
                await dispenseMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, targetDate);
                dispensedSuccessIds.push(record.id);
                return { type: 'success', recordId: record.id };
              }
            }
            return { type: 'already_completed', recordId: record.id };
          } catch (error) {
            console.error(`處理記錄 ${record.id} 失敗:`, error);
            throw error;
          }
        })
      );
      // 批量更新本地狀態
      if (preparedIds.length > 0) {
        updateLocalWorkflowRecords(preparedIds, 'preparation', 'completed');
      }
      if (verifiedIds.length > 0) {
        updateLocalWorkflowRecords(verifiedIds, 'verification', 'completed');
      }
      if (dispensedSuccessIds.length > 0) {
        updateLocalWorkflowRecords(dispensedSuccessIds, 'dispensing', 'completed');
      }
      if (dispensedHospitalizedIds.length > 0) {
        updateLocalWorkflowRecords(dispensedHospitalizedIds, 'dispensing', 'failed', '入院');
      }
      if (dispensedVacationIds.length > 0) {
        updateLocalWorkflowRecords(dispensedVacationIds, 'dispensing', 'failed', '回家');
      }
      // 統計結果
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          switch (result.value.type) {
            case 'success':
              successCount++;
              break;
            case 'hospitalized':
              hospitalizedCount++;
              break;
            case 'vacation':
              vacationCount++;
              break;
          }
        } else {
          failCount++;
        }
      });
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`一鍵全程失敗 (記錄ID: ${eligibleRecords[index].id}):`, result.reason);
        }
      });
    } catch (error) {
      console.error('一鍵全程失敗:', error);
      alert('一鍵全程失敗，請查看控制台');
    } finally {
      setOneClickProcessing(prev => ({ ...prev, dispensing: false }));
    }
  };
  // 處理批量派藥確認
  const handleBatchDispenseConfirm = async (selectedTimeSlots: string[], recordsToProcess: any[], inspectionResults?: Map<string, any>) => {
    if (!selectedPatientId || !selectedDate) {
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      return;
    }
    try {
      // 並行處理所有派藥操作
      const results = await Promise.allSettled(
        recordsToProcess.map(async (record) => {
          const prescription = prescriptions.find(p => p.id === record.prescription_id);
          const hasInspectionRules = prescription?.inspection_rules && prescription.inspection_rules.length > 0;
          // 檢查此筆記錄的服藥時間是否在入院期間
          const inHospitalizationPeriod = isInHospitalizationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          // 檢查此筆記錄的服藥時間是否在渡假期間
          const inVacationPeriod = isInVacationPeriod(
            patientIdNum,
            record.scheduled_date,
            record.scheduled_time
          );
          if (inHospitalizationPeriod) {
            // 如果服藥時間在入院期間，自動標記為「入院」失敗原因
            const inspectionResult = hasInspectionRules ? {
              canDispense: false,
              isHospitalized: true,
              blockedRules: [],
              usedVitalSignData: {}
            } : undefined;
            await dispenseMedication(
              record.id,
              displayName || '未知',
              '入院',
              undefined,
              patientIdNum,
              selectedDate,
              undefined,
              inspectionResult
            );
            return { type: 'hospitalized' };
          } else if (inVacationPeriod) {
            // 如果服藥時間在渡假期間，自動標記為「回家」失敗原因
            const inspectionResult = hasInspectionRules ? {
              canDispense: false,
              isOnVacation: true,
              blockedRules: [],
              usedVitalSignData: {}
            } : undefined;
            await dispenseMedication(
              record.id,
              displayName || '未知',
              '回家',
              undefined,
              patientIdNum,
              selectedDate,
              undefined,
              inspectionResult
            );
            return { type: 'vacation' };
          } else if (hasInspectionRules) {
            // 有檢測項要求：先檢查是否有用戶提供的檢測結果
            const userInspectionResult = inspectionResults?.get(record.id);
            if (userInspectionResult) {
              console.log(`✅ 使用用戶提供的檢測結果 (記錄 ${record.id}):`, userInspectionResult);
              if (userInspectionResult.canDispense) {
                // 檢測合格：正常派藥
                await dispenseMedication(
                  record.id,
                  displayName || '未知',
                  undefined,
                  undefined,
                  patientIdNum,
                  selectedDate,
                  undefined,
                  userInspectionResult.inspectionCheckResult
                );
                return { type: 'success' };
              } else {
                // 檢測不合格：標記為暫停
                await dispenseMedication(
                  record.id,
                  displayName || '未知',
                  userInspectionResult.failureReason || '暫停',
                  '檢測項條件不符',
                  patientIdNum,
                  selectedDate,
                  undefined,
                  userInspectionResult.inspectionCheckResult
                );
                return { type: 'paused' };
              }
            } else {
              // 沒有用戶提供的檢測結果，使用自動檢測
              const checkResult = await checkPrescriptionInspectionRules(
                prescription.id,
                patientIdNum
              );
              if (checkResult.canDispense) {
                // 檢測合格：正常派藥
                await dispenseMedication(
                  record.id,
                  displayName || '未知',
                  undefined,
                  undefined,
                  patientIdNum,
                  selectedDate,
                  undefined,
                  checkResult
                );
                return { type: 'success' };
              } else {
                // 檢測不合格：標記為暫停
                await dispenseMedication(
                  record.id,
                  displayName || '未知',
                  '暫停',
                  '檢測項條件不符',
                  patientIdNum,
                  selectedDate,
                  undefined,
                  checkResult
                );
                return { type: 'paused' };
              }
            }
          } else {
            // 正常派藥（無檢測項要求）
            await dispenseMedication(record.id, displayName || '未知', undefined, undefined, patientIdNum, selectedDate);
            return { type: 'success' };
          }
        })
      );
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.type === 'success').length;
      const hospitalizedCount = results.filter(r => r.status === 'fulfilled' && r.value.type === 'hospitalized').length;
      const vacationCount = results.filter(r => r.status === 'fulfilled' && r.value.type === 'vacation').length;
      const pausedCount = results.filter(r => r.status === 'fulfilled' && r.value.type === 'paused').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`派藥失敗 (記錄ID: ${recordsToProcess[index].id}):`, result.reason);
        }
      });
      // 更新本地狀態：根據結果類型分類
      const successIds: string[] = [];
      const hospitalizedIds: string[] = [];
      const vacationIds: string[] = [];
      const pausedIds: string[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const recordId = recordsToProcess[index].id;
          switch (result.value.type) {
            case 'success':
              successIds.push(recordId);
              break;
            case 'hospitalized':
              hospitalizedIds.push(recordId);
              break;
            case 'vacation':
              vacationIds.push(recordId);
              break;
            case 'paused':
              pausedIds.push(recordId);
              break;
          }
        }
      });
      
      // 批量更新本地狀態
      if (successIds.length > 0) {
        updateLocalWorkflowRecords(successIds, 'dispensing', 'completed');
      }
      if (hospitalizedIds.length > 0) {
        updateLocalWorkflowRecords(hospitalizedIds, 'dispensing', 'failed', '入院');
      }
      if (vacationIds.length > 0) {
        updateLocalWorkflowRecords(vacationIds, 'dispensing', 'failed', '回家');
      }
      if (pausedIds.length > 0) {
        updateLocalWorkflowRecords(pausedIds, 'dispensing', 'failed', '暫停');
      }
    } catch (error) {
      console.error('批量派藥失敗:', error);
      throw error;
    }
  };
  // 處理檢測通過後的派藥
  const handleDispenseAfterInspection = async (canDispense: boolean, failureReason?: string, inspectionCheckResult?: any) => {
    if (!selectedWorkflowRecord) return;
    if (!selectedPatientId) {
      console.error('缺少必要的院友ID:', { selectedPatientId });
      return;
    }
    // 驗證 selectedPatientId 是否為有效數字
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      console.error('無效的院友ID:', selectedPatientId);
      return;
    }
    try {
      // 檢測合格時
      // 檢測不合格時，InspectionCheckModal 已經直接處理完成
      if (canDispense) {
        // 將檢測結果保存到 selectedWorkflowRecord
        const updatedRecord = {
          ...selectedWorkflowRecord,
          inspectionCheckResult
        };
        setSelectedWorkflowRecord(updatedRecord);
        setShowInspectionCheckModal(false);
        // 檢查是否為注射類藥物
        const prescription = prescriptions.find(p => p.id === selectedWorkflowRecord.prescription_id);
        if (prescription?.administration_route === '注射') {
          // 是注射類，需要選擇注射位置
          setCurrentInjectionRecord(updatedRecord);
          setShowInjectionSiteModal(true);
        } else {
          // 不是注射類，直接打開派藥確認對話框
          setShowDispenseConfirmModal(true);
        }
      }
    } catch (error) {
      console.error('檢測後處理失敗:', error);
    }
  };
  // 處理注射位置確認後的派藥
  const handleInjectionSiteSelected = async (injectionSite: string, notes?: string) => {
    if (!currentInjectionRecord) return;
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      console.error('無效的院友ID:', selectedPatientId);
      return;
    }
    const scheduledDate = currentInjectionRecord.scheduled_date;
    try {
      const prescription = prescriptions.find(p => p.id === currentInjectionRecord.prescription_id);
      // 針劑派藥時記錄注射位置
      const injectionNotes = `注射位置: ${injectionSite}${notes ? ` | ${notes}` : ''}`;
      // 保存注射位置信息，同時保留之前的檢測結果（如果有）
      setSelectedWorkflowRecord({
        ...currentInjectionRecord,
        injectionSite,
        injectionNotes,
        // 保留檢測結果（如果有）
        inspectionCheckResult: currentInjectionRecord.inspectionCheckResult || selectedWorkflowRecord?.inspectionCheckResult
      });
      // 關閉注射位置對話框，打開派藥確認對話框
      setShowInjectionSiteModal(false);
      setShowDispenseConfirmModal(true);
    } catch (error) {
      console.error('處理注射位置失敗:', error);
    }
  };
  // 處理派藥確認對話框的結果
  const handleDispenseConfirm = async (action: 'success' | 'failure', reason?: string, customReason?: string) => {
    if (!selectedWorkflowRecord) return;
    if (!selectedPatientId) {
      console.error('缺少必要的院友ID:', { selectedPatientId });
      return;
    }
    const patientIdNum = parseInt(selectedPatientId);
    if (isNaN(patientIdNum)) {
      console.error('無效的院友ID:', selectedPatientId);
      return;
    }
    const scheduledDate = selectedWorkflowRecord.scheduled_date;
    try {
      const prescription = prescriptions.find(p => p.id === selectedWorkflowRecord.prescription_id);
      // 如果是即時備藥，需要自動回補執藥和核藥
      if (prescription?.preparation_method === 'immediate') {
        await prepareMedication(
          selectedWorkflowRecord.id,
          displayName || '未知',
          undefined,
          undefined,
          patientIdNum,
          scheduledDate
        );
        await verifyMedication(
          selectedWorkflowRecord.id,
          displayName || '未知',
          undefined,
          undefined,
          patientIdNum,
          scheduledDate
        );
        // 更新本地狀態：執藥和核藥
        updateLocalWorkflowRecords([selectedWorkflowRecord.id], 'preparation', 'completed');
        updateLocalWorkflowRecords([selectedWorkflowRecord.id], 'verification', 'completed');
      }
      // 執行派藥
      if (action === 'success') {
        // 如果有注射位置信息，添加到備註中
        const notes = selectedWorkflowRecord.injectionNotes || undefined;
        // 如果有檢測結果（從 InspectionCheckModal 傳來），存儲檢測數據
        const inspectionCheckResult = selectedWorkflowRecord.inspectionCheckResult || undefined;
        await dispenseMedication(
          selectedWorkflowRecord.id,
          displayName || '未知',
          undefined,
          undefined,
          patientIdNum,
          scheduledDate,
          notes,
          inspectionCheckResult
        );
        // 更新本地狀態：派藥成功
        updateLocalWorkflowRecords([selectedWorkflowRecord.id], 'dispensing', 'completed');
      } else {
        // 派藥失敗，記錄原因
        await dispenseMedication(
          selectedWorkflowRecord.id,
          displayName || '未知',
          reason,
          customReason,
          patientIdNum,
          scheduledDate
        );
        // 更新本地狀態：派藥失敗
        updateLocalWorkflowRecords([selectedWorkflowRecord.id], 'dispensing', 'failed', reason, customReason);
      }
      setShowDispenseConfirmModal(false);
      setSelectedWorkflowRecord(null);
      setSelectedStep('');
      setCurrentInjectionRecord(null);
    } catch (error) {
      console.error('派藥確認失敗:', error);
    }
  };
  // 刷新數據（整週）
  const handleRefresh = async () => {
    const patientIdNum = parseInt(selectedPatientId);
    if (!selectedPatientId || selectedPatientId === '' || isNaN(patientIdNum)) {
      console.warn('無效的院友ID，無法刷新數據:', selectedPatientId);
      return;
    }
    setRefreshing(true);
    try {
      // 直接查詢 Supabase，載入整週的記錄
      const { data, error } = await supabase
        .from('medication_workflow_records')
        .select('*')
        .eq('patient_id', patientIdNum)
        .gte('scheduled_date', weekDates[0])
        .lte('scheduled_date', weekDates[6])
        .order('scheduled_date')
        .order('scheduled_time');
      if (error) {
        console.error('❌ 刷新失敗:', error);
        throw error;
      }
      // 直接更新 allWorkflowRecords
      setAllWorkflowRecords(data || []);
    } catch (error) {
      console.error('刷新數據失敗:', error);
      alert('刷新數據失敗，請稍後再試');
    } finally {
      setRefreshing(false);
    }
  };
  // 生成本週工作流程記錄（手動觸發）
  const handleGenerateWorkflow = async () => {
    const patientIdNum = parseInt(selectedPatientId);
    if (!selectedPatientId || selectedPatientId === '' || isNaN(patientIdNum)) {
      console.warn('請先選擇院友');
      alert('請先選擇院友');
      return;
    }
    setGenerating(true);
    try {
      // 生成整週的工作流程（從週日到週六，共7天）
      const startDate = weekDates[0];
      const endDate = weekDates[6];
      const result = await generateBatchWorkflowRecords(startDate, endDate, patientIdNum);
      if (result.success) {
        // 等待 500ms 確保 Supabase 數據一致性
        await new Promise(resolve => setTimeout(resolve, 500));
        // 重新載入數據 - 使用重試機制
        let retryCount = 0;
        const maxRetries = 3;
        let loadedSuccessfully = false;
        while (retryCount < maxRetries && !loadedSuccessfully) {
          try {
            console.log(`🔄 嘗試重新載入數據 (第 ${retryCount + 1} 次)...`);
            const { data, error } = await supabase
              .from('medication_workflow_records')
              .select('*')
              .eq('patient_id', patientIdNum)
              .gte('scheduled_date', weekDates[0])
              .lte('scheduled_date', weekDates[6])
              .order('scheduled_date')
              .order('scheduled_time');
            if (error) {
              console.error('❌ 查詢失敗:', error);
              throw error;
            }
            // 驗證是否載入到新生成的記錄
            if (data && data.length > 0) {
              setAllWorkflowRecords(data);
              loadedSuccessfully = true;
              alert(`✅ 成功生成並載入 ${data.length} 筆工作流程記錄！`);
            } else if (result.totalRecords > 0) {
              // 生成了記錄但查詢不到，需要重試
              console.warn('⚠️ 生成了記錄但查詢不到，等待後重試...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              retryCount++;
            } else {
              // 沒有生成記錄（可能該院友無在服處方）
              setAllWorkflowRecords([]);
              loadedSuccessfully = true;
              alert('此院友目前無在服處方，無工作流程記錄需要生成');
            }
          } catch (error) {
            console.error(`❌ 第 ${retryCount + 1} 次載入失敗:`, error);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        if (!loadedSuccessfully) {
          console.error('❌ 多次重試後仍無法載入數據');
          alert('生成成功，但載入數據失敗。請點擊「刷新」按鈕手動重新載入。');
        }
      } else {
        console.error('⚠️ 生成部分失敗:', result.message);
        if (result.failedDates && result.failedDates.length > 0) {
          console.error('失敗的日期:', result.failedDates);
        }
        // 即使部分失敗，也嘗試重新載入已成功生成的數據
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data } = await supabase
          .from('medication_workflow_records')
          .select('*')
          .eq('patient_id', patientIdNum)
          .gte('scheduled_date', weekDates[0])
          .lte('scheduled_date', weekDates[6])
          .order('scheduled_date')
          .order('scheduled_time');
        if (data) {
          setAllWorkflowRecords(data);
        }
        alert(`⚠️ ${result.message}\n已載入 ${data?.length || 0} 筆記錄`);
      }
    } catch (error) {
      console.error('生成工作流程記錄失敗:', error);
      alert(`❌ 生成失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setGenerating(false);
    }
  };
  // 日期導航
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 7);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 7);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  const goToToday = () => {
    setSelectedDate(getTodayLocalDate());
  };
  // 週次導航
  const goToPreviousWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 7);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  const goToNextWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 7);
    setSelectedDate(date.toISOString().split('T')[0]);
  };
  // 觸控拖曳事件處理（保留觸控功能）
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setStartTime(Date.now());
    setDragDistance(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    setDragDistance(Math.abs(deltaX));
    const deltaTime = Date.now() - startTime;
    if (deltaTime > 0) {
      setDragVelocity(deltaX / deltaTime);
    }
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // 只有在拖動距離大於 50px 才觸發週次切換
    const dragThreshold = 50;
    const velocityThreshold = 0.5;
    if (dragDistance > dragThreshold && Math.abs(dragVelocity) > velocityThreshold) {
      if (dragVelocity > 0) {
        goToPreviousWeek();
      } else {
        goToNextWeek();
      }
    }
    setDragVelocity(0);
    setDragDistance(0);
  };
  // 診斷工作流程顯示問題
  const handleDiagnose = async () => {
    const patientIdNum = parseInt(selectedPatientId);
    if (!selectedPatientId || isNaN(patientIdNum)) {
      alert('請先選擇院友');
      return;
    }
    try {
      const result = await diagnoseWorkflowDisplayIssue(
        patientIdNum,
        weekDates[0],
        weekDates[6]
      );
      if (result) {
        if (allWorkflowRecords.length !== result.actualTotal) {
          console.warn('⚠️ 本地記錄與數據庫不同步！');
          console.warn(`本地: ${allWorkflowRecords.length} 筆, 數據庫: ${result.actualTotal} 筆`);
          setTimeout(() => {
            alert(`診斷完成！\n\n發現數據不同步:\n本地記錄: ${allWorkflowRecords.length} 筆\n數據庫記錄: ${result.actualTotal} 筆\n\n建議點擊「刷新」按鈕重新載入數據。\n\n詳細診斷結果請查看瀏覽器控制台（F12）。`);
          }, 0);
        } else if (result.actualTotal > result.expectedTotal && result.inactivePrescCount > 0) {
          setTimeout(() => {
            alert(`診斷完成！\n\n處方統計:\n- 在服處方: ${result.activePrescCount} 個\n- 停用處方: ${result.inactivePrescCount} 個\n\n記錄統計:\n- 預期記錄: ${result.expectedTotal} 筆\n- 實際記錄: ${result.actualTotal} 筆\n\n⚠️ 記錄數多於預期，可能包含停用處方在停用前生成的記錄。\n這是正常情況，停用處方的歷史記錄會繼續顯示。\n\n詳細診斷結果請查看瀏覽器控制台（F12）。`);
          }, 0);
        } else if (!result.isMatched) {
          setTimeout(() => {
            alert(`診斷完成！\n\n處方統計:\n- 在服處方: ${result.activePrescCount} 個\n- 停用處方: ${result.inactivePrescCount} 個\n\n記錄統計:\n- 預期記錄: ${result.expectedTotal} 筆\n- 實際記錄: ${result.actualTotal} 筆\n\n記錄數不匹配，可能需要重新生成工作流程。\n\n詳細診斷結果請查看瀏覽器控制台（F12）。`);
          }, 0);
        } else {
          setTimeout(() => {
            alert(`診斷完成！\n\n✅ 數據正常\n\n處方統計:\n- 在服處方: ${result.activePrescCount} 個\n- 停用處方: ${result.inactivePrescCount} 個\n\n記錄數: ${result.actualTotal} 筆\n\n詳細診斷結果請查看瀏覽器控制台（F12）。`);
          }, 0);
        }
      }
    } catch (error) {
      console.error('❌ 診斷失敗:', error);
      setTimeout(() => {
        alert('診斷失敗，請查看瀏覽器控制台獲取詳細錯誤信息。');
      }, 0);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {/* 頁面標題與控制區 */}
      <div className="sticky top-0 bg-white z-[25] py-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          {/* 左側：標題 */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">藥物工作流程</h1>
            <p className="text-sm text-gray-600 mt-1">管理院友的執藥、核藥、派藥流程</p>
          </div>
          {/* 右側：院友選擇、掃描按鈕、日期選擇 */}
          <div className="flex items-end gap-3 flex-1 max-w-4xl">
            {/* 院友選擇 */}
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="form-label text-xs mb-1 block">
                <User className="h-3 w-3 inline mr-1" />
                選擇院友
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousPatient}
                  disabled={sortedActivePatients.length <= 1}
                  className="btn-secondary flex items-center px-2 py-1.5 flex-shrink-0"
                  title="上一位院友"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <PatientAutocomplete
                    value={selectedPatientId}
                    onChange={setSelectedPatientId}
                    placeholder="搜索院友..."
                    showResidencyFilter={true}
                    defaultResidencyStatus="在住"
                  />
                </div>
                <button
                  onClick={goToNextPatient}
                  disabled={sortedActivePatients.length <= 1}
                  className="btn-secondary flex items-center px-2 py-1.5 flex-shrink-0"
                  title="下一位院友"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* 掃描二維碼按鈕 */}
            <div className="flex-shrink-0">
              <label className="form-label text-xs mb-1 block invisible">掃描</label>
              <button
                onClick={() => setShowQRScannerModal(true)}
                className="btn-secondary p-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
                title="掃描院友二維碼"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>

            {/* 日期選擇 */}
            <div className="flex-1 min-w-[250px] max-w-sm">
              <label className="form-label text-xs mb-1 block">
                <Calendar className="h-3 w-3 inline mr-1" />
                選擇日期
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousDay}
                  className="btn-secondary p-1.5"
                  title="前一日"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input flex-1 text-sm"
                />
                <button
                  onClick={goToNextDay}
                  className="btn-secondary p-1.5"
                  title="後一日"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap"
                >
                  今天
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 院友資訊卡 - 可摺疊 */}
      <div className="bg-white z-[5] border-b border-gray-200">
        <div className="p-2">
          <PatientInfoCard
            patient={selectedPatient}
            defaultExpanded={false}
            onOptimisticUpdate={(patientId, needsCrushing) => {
              // 立即更新 UI（樂觀更新）
              setOptimisticCrushState(prev => {
                const next = new Map(prev);
                next.set(patientId, needsCrushing);
                return next;
              });
            }}
            onToggleCrushMedication={async (patientId, needsCrushing) => {
              // 資料庫更新成功後刷新數據
              await refreshData();
              // 清除樂觀更新狀態
              setOptimisticCrushState(prev => {
                const next = new Map(prev);
                next.delete(patientId);
                return next;
              });
            }}
          />
        </div>
      </div>
      {/* 工作流程表格 */}
      {selectedPatientId ? (
        <div className="overflow-hidden border-t-0">
          {activePrescriptions.length > 0 ? (
            <>
              {filteredPrescriptions.length > 0 ? (
                <div className="relative">
                  {/* 備藥方式分類標籤 - 在表格上方 */}
                  <div className="border-b border-gray-200 bg-gray-50">
                    <div className="flex space-x-1 p-2">
                      <button
                        onClick={() => setPreparationFilter('all')}
                        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          preparationFilter === 'all'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        全部 ({activePrescriptions.length})
                        {preparationMethodOverdueCounts.all > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        )}
                      </button>
                      <button
                        onClick={() => setPreparationFilter('advanced')}
                        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          preparationFilter === 'advanced'
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        提前備藥 ({activePrescriptions.filter(p => p.preparation_method === 'advanced').length})
                        {preparationMethodOverdueCounts.advanced > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        )}
                      </button>
                      <button
                        onClick={() => setPreparationFilter('immediate')}
                        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          preparationFilter === 'immediate'
                            ? 'bg-orange-100 text-orange-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        即時備藥 ({activePrescriptions.filter(p => p.preparation_method === 'immediate').length})
                        {preparationMethodOverdueCounts.immediate > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div
                    ref={tableContainerRef}
                    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]"
                  >
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        行號
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        藥物詳情
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-auto landscape:w-20">
                        使用次數
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-auto landscape:w-20">
                        劑量
                    </th>
                    {weekDates.map((date) => {
                      const d = new Date(date);
                      const month = d.getMonth() + 1;
                      const dayOfMonth = d.getDate();
                      const weekdayIndex = d.getDay();
                      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                      const weekday = weekdays[weekdayIndex];
                      const isSelectedDate = date === selectedDate;
                      const hasOverdue = (dateOverdueStatus.get(date) || 0) > 0;
                      const isMenuOpen = isDateMenuOpen && selectedDateForMenu === date;
                      // 獲取當日工作流程記錄（使用已應用樂觀更新的記錄）
                      const dayWorkflowRecords = recordsWithOptimisticUpdates.filter(r => r.scheduled_date === date);
                      // 計算當日可操作的記錄數量
                      const canPrepare = dayWorkflowRecords.some(r => {
                        const prescription = prescriptions.find(p => p.id === r.prescription_id);
                        return r.preparation_status === 'pending' && prescription?.preparation_method !== 'immediate';
                      });
                      const canVerify = dayWorkflowRecords.some(r => {
                        const prescription = prescriptions.find(p => p.id === r.prescription_id);
                        return r.verification_status === 'pending' &&
                               r.preparation_status === 'completed' &&
                               prescription?.preparation_method !== 'immediate';
                      });
                      const canDispense = dayWorkflowRecords.some(r => {
                        const prescription = prescriptions.find(p => p.id === r.prescription_id);
                        return r.dispensing_status === 'pending' &&
                               r.verification_status === 'completed' &&
                               prescription?.administration_route !== '注射' &&
                               !(prescription?.inspection_rules && prescription.inspection_rules.length > 0);
                      });
                      const canFullProcess = dayWorkflowRecords.some(r => {
                        const prescription = prescriptions.find(p => p.id === r.prescription_id);
                        return canOneClickDispense(prescription);
                      });
                      return (
                        <th
                          key={date}
                          data-date={date}
                          className={`px-1 py-3 text-center text-xs font-medium uppercase tracking-wider transition-colors relative ${
                            isSelectedDate ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-blue-50'
                          }`}
                        >
                          <div
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMenuOpen) {
                                setIsDateMenuOpen(false);
                                setSelectedDateForMenu(null);
                              } else {
                                setIsDateMenuOpen(true);
                                setSelectedDateForMenu(date);
                              }
                            }}
                            title={`點擊展開選單 ${month}/${dayOfMonth}${hasOverdue ? ' (有逾期未完成流程)' : ''}`}
                          >
                            {month}/{dayOfMonth}<br/>({weekday})
                          </div>
                          {/* 下拉選單（使用 Portal 渲染到 body，確保在所有元素之上，向上展開） */}
                          {isMenuOpen && (
                            <Portal>
                              <div
                                className="fixed w-40 bg-white rounded-lg shadow-xl border-2 border-blue-300"
                                ref={dateMenuRef}
                                style={{
                                  bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : 'auto',
                                  left: `${menuPosition.left}px`,
                                  zIndex: 99999
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDateOneClickPrepare(date);
                                      setIsDateMenuOpen(false);
                                      setSelectedDateForMenu(null);
                                    }}
                                    disabled={!canPrepare || oneClickProcessing.preparation}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 ${
                                      canPrepare && !oneClickProcessing.preparation
                                        ? 'hover:bg-gray-100 text-gray-700'
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={canPrepare ? '完成當日所有待執藥記錄' : '當日無可執藥記錄'}
                                  >
                                    <FastForward className="h-4 w-4" />
                                    <span>一鍵執藥</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDateOneClickVerify(date);
                                      setIsDateMenuOpen(false);
                                      setSelectedDateForMenu(null);
                                    }}
                                    disabled={!canVerify || oneClickProcessing.verification}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 ${
                                      canVerify && !oneClickProcessing.verification
                                        ? 'hover:bg-gray-100 text-gray-700'
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={canVerify ? '完成當日所有待核藥記錄' : '當日無可核藥記錄'}
                                  >
                                    <CheckSquare className="h-4 w-4" />
                                    <span>一鍵核藥</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOneClickDispense(date);
                                      setIsDateMenuOpen(false);
                                      setSelectedDateForMenu(null);
                                    }}
                                    disabled={!canDispense || oneClickProcessing.dispensing}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 ${
                                      canDispense && !oneClickProcessing.dispensing
                                        ? 'hover:bg-gray-100 text-gray-700'
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={canDispense ? '完成當日所有待派藥記錄' : '當日無可派藥記錄'}
                                  >
                                    <Users className="h-4 w-4" />
                                    <span>一鍵派藥</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDateOneClickFullProcess(date);
                                      setIsDateMenuOpen(false);
                                      setSelectedDateForMenu(null);
                                    }}
                                    disabled={!canFullProcess || oneClickProcessing.dispensing}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 ${
                                      canFullProcess && !oneClickProcessing.dispensing
                                        ? 'hover:bg-gray-100 text-gray-700 bg-purple-50'
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={canFullProcess ? '完成當日所有即時備藥+口服+無檢測的全流程' : '當日無可全程記錄'}
                                  >
                                    <Zap className="h-4 w-4 text-purple-600" />
                                    <span className="text-purple-700 font-medium">一鍵全程</span>
                                  </button>
                                </div>
                              </div>
                            </Portal>
                          )}
                          {hasOverdue && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPrescriptions.map((prescription, index) => {
                    // 獲取處方當前的時間點
                    const currentTimeSlots = prescription.medication_time_slots || [];
                    // 獲取當前週次內該處方的所有工作流程記錄的時間點
                    const weekTimeSlotsFromRecords = allWorkflowRecords
                      .filter(r => r.prescription_id === prescription.id)
                      .map(r => r.scheduled_time?.trim().substring(0, 5))
                      .filter((time, index, self) => time && self.indexOf(time) === index);
                    // 合併時間點：當前時間點 + 當週有記錄的舊時間點
                    const allTimeSlots = new Set([
                      ...currentTimeSlots,
                      ...weekTimeSlotsFromRecords
                    ]);
                    const timeSlots = Array.from(allTimeSlots).sort((a, b) => {
                      const parseTime = (t: string) => {
                        const [h, m] = t.split(':').map(Number);
                        return h * 60 + m;
                      };
                      return parseTime(a) - parseTime(b);
                    });
                    return (
                      <tr 
                        key={prescription.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                        onDoubleClick={() => {
                          setSelectedPrescription(prescription);
                          setShowModal(true);
                        }}
                        title="雙擊編輯處方"
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td
                          className="px-4 py-4 relative"
                          data-prescription-id={prescription.id}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMedicationInfoPosition({
                              top: rect.top,
                              left: rect.right + 10
                            });
                            setHoveredPrescriptionId(prescription.id);
                          }}
                          onMouseLeave={() => {
                            setHoveredPrescriptionId(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMedicationInfoPosition({
                              top: rect.top,
                              left: rect.right + 10
                            });
                            setHoveredPrescriptionId(hoveredPrescriptionId === prescription.id ? null : prescription.id);
                          }}
                        >
                          <div className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">
                            {prescription.medication_name}
                            <span className="ml-2 text-xs text-gray-400">
                              {(prescription.inspection_rules && prescription.inspection_rules.length > 0) && '⚠️'}
                              {prescription.preparation_method === 'immediate' && '⚡'}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 w-auto landscape:w-10">
                          <div className="space-y-1">
                            {prescription.is_prn && (
                              <div className="text-red-600 font-bold">PRN</div>
                            )}
                            <div>
                              {(() => {
                                // 根據每日服用次數顯示標準縮寫
                                const getFrequencyAbbreviation = (count: number) => {
                                  switch (count) {
                                    case 1: return 'QD';
                                    case 2: return 'BD';
                                    case 3: return 'TDS';
                                    case 4: return 'QID';
                                    default: return `${count}次/日`;
                                  }
                                };
                                const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, daily_frequency } = prescription;
                                switch (frequency_type) {
                                  case 'daily':
                                    return getFrequencyAbbreviation(daily_frequency || 1);
                                  case 'every_x_days':
                                    return `每隔${frequency_value}日`;
                                  case 'every_x_months':
                                    return `每隔${frequency_value}月`;
                                  case 'weekly_days':
                                    const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
                                    const days = specific_weekdays?.map((day: number) => dayNames[day - 1]).join('、') || '';
                                    return `逢${days}`;
                                  case 'odd_even_days':
                                    return is_odd_even_day === 'odd' ? '單日服' : is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
                                  case 'hourly':
                                    return `每${frequency_value}小時`;
                                  default:
                                    return getFrequencyAbbreviation(daily_frequency || 1);
                                }
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-sm text-gray-900 w-auto landscape:w-20">
                          <div>每次 {prescription.dosage_amount || '1'}{prescription.dosage_unit || ''}</div>
                          {prescription.dosage_form && <div className="text-xs text-gray-600 mt-0.5">{prescription.dosage_form}</div>}
                        </td>
                        {weekDates.map((date) => {
                          const isSelectedDate = date === selectedDate;
                          return (
                          <td key={date} className={`px-1 py-2 ${
                            isSelectedDate ? 'bg-blue-50' : ''
                          }`}>
                            <div className="space-y-1">
                              {timeSlots.map((timeSlot: string) => {
                                // 標準化時間格式進行比對
                                const normalizeTime = (time: string) => {
                                  if (!time) return '';
                                  // 移除所有空格和秒數，只保留 HH:MM
                                  return time.trim().substring(0, 5);
                                };
                                // 查找對應的工作流程記錄（使用已應用樂觀更新的記錄）
                                const workflowRecord = recordsWithOptimisticUpdates.find(r =>
                                  r.prescription_id === prescription.id &&
                                  r.scheduled_date === date &&
                                  normalizeTime(r.scheduled_time) === normalizeTime(timeSlot)
                                );

                                return (
                                  <div key={timeSlot} className="border border-gray-200 rounded-lg p-1 bg-white">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-xs font-medium text-gray-900">{timeSlot}</div>
                                      {prescription.meal_timing && (
                                        <div className="text-xs text-gray-500">{prescription.meal_timing}</div>
                                      )}
                                    </div>
                                    {workflowRecord ? (
                                      <div className="grid grid-cols-3 gap-1">
                                        <WorkflowCell
                                          record={workflowRecord}
                                          step="preparation"
                                          onStepClick={handleStepClick}
                                          selectedDate={selectedDate}
                                        />
                                        <WorkflowCell
                                          record={workflowRecord}
                                          step="verification"
                                          onStepClick={handleStepClick}
                                          selectedDate={selectedDate}
                                        />
                                        <WorkflowCell
                                          record={workflowRecord}
                                          step="dispensing"
                                          onStepClick={handleStepClick}
                                          selectedDate={selectedDate}
                                        />
                                      </div>
                                    ) : (
                                      <div className="text-center text-xs text-gray-400">
                                        {(() => {
                                          const selectedDateObj = new Date(date);
                                          const startDate = new Date(prescription.start_date);
                                          // 檢查是否在開始日期之前
                                          if (selectedDateObj < startDate) {
                                            return '無處方';
                                          }
                                          // 檢查是否在結束日期之後
                                          if (prescription.end_date) {
                                            const endDate = new Date(prescription.end_date);
                                            if (selectedDateObj > endDate) {
                                              return '無處方';
                                            }
                                          }
                                          // 在處方有效期內但沒有工作流程記錄
                                          return '無記錄';
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* 藥物資訊懸浮清單 */}
              {hoveredPrescriptionId && (
                <Portal>
                  <div
                    className="fixed bg-white rounded-lg shadow-2xl border-2 border-blue-300 p-4 z-[99999] w-80"
                    style={{
                      top: `${medicationInfoPosition.top}px`,
                      left: `${medicationInfoPosition.left}px`,
                    }}
                    onMouseEnter={() => setHoveredPrescriptionId(hoveredPrescriptionId)}
                    onMouseLeave={() => setHoveredPrescriptionId(null)}
                  >
                    {(() => {
                      const prescription = prescriptions.find(p => p.id === hoveredPrescriptionId);
                      if (!prescription) return null;
                      return (
                        <div className="space-y-3">
                          <div className="font-bold text-lg text-gray-900 border-b pb-2">
                            {prescription.medication_name}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">開始日期:</span>
                              <span className="font-medium">{new Date(prescription.start_date).toLocaleDateString('zh-TW')}</span>
                            </div>
                            {prescription.end_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">結束日期:</span>
                                <span className="font-medium">{new Date(prescription.end_date).toLocaleDateString('zh-TW')}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">處方日期:</span>
                              <span className="font-medium">{new Date(prescription.prescription_date).toLocaleDateString('zh-TW')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">藥物來源:</span>
                              <span className="font-medium">{prescription.medication_source || '未指定'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">給藥途徑:</span>
                              <span className="font-medium">{prescription.administration_route}</span>
                            </div>
                            {prescription.preparation_method === 'immediate' && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 flex items-center">
                                <Zap className="h-4 w-4 text-blue-600 mr-2" />
                                <span className="text-blue-600 font-medium">即時備藥</span>
                              </div>
                            )}
                            {prescription.inspection_rules && prescription.inspection_rules.length > 0 && (
                              <div className="bg-orange-50 border border-orange-200 rounded p-2 flex items-center">
                                <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                                <span className="text-orange-600 font-medium">有檢測項要求</span>
                              </div>
                            )}
                            {prescription.notes && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                                <div className="text-yellow-800 font-medium mb-1">注意事項:</div>
                                <div className="text-yellow-700">{prescription.notes}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Portal>
              )}
              </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Filter className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">此分類暫無處方</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Pill className="h-24 w-24 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedPatient ? '此院友暫無在服處方' : '請選擇院友'}
              </h3>
              <p className="text-gray-600">
                {selectedPatient ? '請先在處方管理中為此院友新增處方' : '選擇院友後即可查看其藥物工作流程'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-8">
          <div className="text-center">
            <User className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">請選擇院友</h3>
            <p className="text-gray-600 mb-6">選擇院友後即可查看其藥物工作流程</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center space-x-2 mb-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">使用說明</h4>
              </div>
              <div className="text-sm text-blue-800 space-y-2 text-left">
                <p><strong>1. 選擇院友：</strong>在上方下拉選單中選擇要處理的院友</p>
                <p><strong>2. 生成工作流程：</strong>點擊「生成本週工作流程」按鈕為該院友創建整週（7天）的藥物任務</p>
                <p><strong>3. 執行任務：</strong>依序點擊「執藥」→「核藥」→「派藥」完成流程</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 處方編輯模態框 */}
      {showModal && selectedPrescription && (
        <PrescriptionModal
          prescription={selectedPrescription}
          onClose={() => {
            setShowModal(false);
            setSelectedPrescription(null);
          }}
        />
      )}
      {/* 檢測項檢查模態框 */}
      {showInspectionCheckModal && selectedWorkflowRecord && (
        <InspectionCheckModal
          workflowRecord={selectedWorkflowRecord}
          onClose={() => {
            setShowInspectionCheckModal(false);
            setSelectedWorkflowRecord(null);
            setSelectedStep('');
          }}
          onResult={handleDispenseAfterInspection}
        />
      )}
      {/* 派藥確認模態框 */}
      {showDispenseConfirmModal && selectedWorkflowRecord && (
        <DispenseConfirmModal
          workflowRecord={selectedWorkflowRecord}
          prescription={prescriptions.find(p => p.id === selectedWorkflowRecord.prescription_id)}
          onClose={() => {
            setShowDispenseConfirmModal(false);
            setSelectedWorkflowRecord(null);
            setSelectedStep('');
            setCurrentInjectionRecord(null);
          }}
          onConfirm={handleDispenseConfirm}
        />
      )}
      {/* 撤銷確認模態框 */}
      {showRevertConfirmModal && revertActionRecord && (
        <RevertConfirmModal
          isOpen={showRevertConfirmModal}
          onClose={() => {
            setShowRevertConfirmModal(false);
            setRevertActionRecord(null);
            setRevertActionStep('');
          }}
          workflowRecord={revertActionRecord}
          step={revertActionStep as any}
          onConfirm={() => handleRevertStep(revertActionRecord.id, revertActionStep)}
        />
      )}
      {/* 注射位置選擇模態框 */}
      {showInjectionSiteModal && currentInjectionRecord && (
        <InjectionSiteModal
          isOpen={showInjectionSiteModal}
          onClose={() => {
            setShowInjectionSiteModal(false);
            setCurrentInjectionRecord(null);
          }}
          workflowRecord={currentInjectionRecord}
          onSiteSelected={handleInjectionSiteSelected}
        />
      )}
      {/* 工作流程記錄去重模態框 */}
      {showDeduplicateModal && (
        <WorkflowDeduplicateModal
          onClose={() => setShowDeduplicateModal(false)}
          patients={patients}
          prescriptions={prescriptions}
          onSuccess={() => {
            setShowDeduplicateModal(false);
            handleRefresh();
          }}
        />
      )}
      {/* 批量派藥確認對話框 */}
      {showBatchDispenseModal && selectedPatientId && (
        <BatchDispenseConfirmModal
          workflowRecords={recordsWithOptimisticUpdates.filter(r => {
            // 只包含該院友的記錄
            if (r.patient_id.toString() !== selectedPatientId) {
              return false;
            }
            const prescription = prescriptions.find(p => p.id === r.prescription_id);
            if (!prescription) {
              return false;
            }
            // 檢查處方狀態：在服處方或有效期內的停用處方
            if (prescription.status === 'active') {
              // 在服處方：正常包含
            } else if (prescription.status === 'inactive') {
              // 停用處方：需要檢查記錄日期是否在處方有效期內
              const recordDate = new Date(r.scheduled_date);
              const startDate = new Date(prescription.start_date);
              const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
              // 如果記錄日期不在處方有效期內，跳過
              if (recordDate < startDate || (endDate && recordDate > endDate)) {
                return false;
              }
            } else {
              // 其他狀態（如 pending_change）：跳過
              return false;
            }
            // 排除注射類藥物
            if (prescription.administration_route === '注射') {
              return false;
            }
            // 包含所有待派藥的記錄（包括有檢測項要求的）
            // 重點: 只要服藥日期(actual_date)是選定日期,就包含進來(即使scheduled_date更早)
            const actualDate = r.actual_date || r.scheduled_date;
            return actualDate === selectedDate &&
                   r.dispensing_status === 'pending' &&
                   r.verification_status === 'completed';
          })}
          prescriptions={prescriptions}
          patients={patients}
          selectedPatientId={selectedPatientId}
          selectedDate={selectedDate}
          onConfirm={handleBatchDispenseConfirm}
          onClose={() => setShowBatchDispenseModal(false)}
        />
      )}

      {/* 二維碼掃描模態框 */}
      <QRScannerModal
        isOpen={showQRScannerModal}
        onClose={() => setShowQRScannerModal(false)}
        onScanSuccess={handleQRScanSuccess}
        onError={handleQRScanError}
        acceptType="patient"
      />
    </div>
  );
};
export default MedicationWorkflow;