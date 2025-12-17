import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pill, Plus, CreditCard as Edit3, Trash2, Search, Filter, Download, User, Calendar, Clock, AlertTriangle, CheckCircle, ArrowRight, X, ChevronUp, ChevronDown, Settings, FileText, Activity, ChevronRight, ChevronLeft, Heart, Shield } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PrescriptionModal from '../components/PrescriptionModal';
import PrescriptionTransferModal from '../components/PrescriptionTransferModal';
import BatchPrescriptionDateUpdateModal from '../components/BatchPrescriptionDateUpdateModal';
import PrescriptionEndDateModal from '../components/PrescriptionEndDateModal';
import PatientTooltip from '../components/PatientTooltip';
import MedicationRecordExportModal from '../components/MedicationRecordExportModal';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type PrescriptionStatus = 'active' | 'pending_change' | 'inactive';

const getStatusColor = (status: PrescriptionStatus) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'pending_change': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusLabel = (status: PrescriptionStatus) => {
  switch (status) {
    case 'active': return '在服處方';
    case 'pending_change': return '待變更處方';
    case 'inactive': return '停用處方';
    default: return status;
  }
};

const getFrequencyDescription = (prescription: any) => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots, meal_timing } = prescription;
  
  // 根據服用時間點數量顯示標準縮寫
  const getFrequencyAbbreviation = (count: number): string => {
    switch (count) {
      case 1: return 'QD';
      case 2: return 'BD';
      case 3: return 'TDS';
      case 4: return 'QID';
      default: return `${count}次/日`;
    }
  };
  
  const timeSlotsCount = medication_time_slots?.length || 0;
  
  switch (frequency_type) {
    case 'daily':
      return getFrequencyAbbreviation(timeSlotsCount);
    case 'every_x_days':
      return `隔${frequency_value}日服`;
    case 'every_x_months':
      return `隔${frequency_value}月服`;
    case 'weekly_days':
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}服`;
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? '單日服' : is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
    case 'hourly':
      return `每${frequency_value}小時服用`;
    default:
      return getFrequencyAbbreviation(timeSlotsCount);
  }
};

interface PatientPrescriptionSummary {
  patient: any;
  prescriptions: {
    active: any[];
    pending_change: any[];
    inactive: any[];
  };
  totalCount: number;
}

interface PatientDropdownFilters {
  selectedPatientId: string;
  searchTerm: string;
  residencyStatus: string;
}

const PrescriptionManagement: React.FC = () => {
  const { prescriptions, patients, deletePrescription, updatePrescription, loading } = usePatients();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    prescription: any;
    targetStatus: 'active' | 'pending_change' | 'inactive';
  } | null>(null);
  const [currentPatientIndex, setCurrentPatientIndex] = useState(0);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [patientFilters, setPatientFilters] = useState<PatientDropdownFilters>({
    selectedPatientId: '',
    searchTerm: '',
    residencyStatus: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'pending_change' | 'inactive'>('active');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
  const [showMedicationRecordExportModal, setShowMedicationRecordExportModal] = useState(false);

  // 添加途徑過濾狀態
  const [selectedRoute, setSelectedRoute] = useState<string>('全部');

  // Group prescriptions by patient and filter out patients without prescriptions
  const patientPrescriptionSummaries = useMemo(() => {
    const summaries: PatientPrescriptionSummary[] = [];
    
    patients.forEach(patient => {
      // 獲取該院友的所有處方，不論途徑
      const patientPrescriptions = (prescriptions || []).filter(p => p.patient_id === patient.院友id);
      
      // 為每個院友創建 summary，無論他們是否有處方
      const summary: PatientPrescriptionSummary = {
        patient,
        prescriptions: {
          active: patientPrescriptions.filter(p => p.status === 'active'),
          pending_change: patientPrescriptions.filter(p => p.status === 'pending_change'),
          inactive: patientPrescriptions.filter(p => p.status === 'inactive')
        },
        totalCount: patientPrescriptions.length
      };
      summaries.push(summary);
    });
    
    return summaries.sort((a, b) => a.patient.床號.localeCompare(b.patient.床號, 'zh-Hant', { numeric: true }));
  }, [patients, prescriptions]);

  // Get current patient
  const currentPatient = useMemo(() => {
    if (patientFilters.selectedPatientId) {
      return patientPrescriptionSummaries.find(s => s.patient.院友id.toString() === patientFilters.selectedPatientId);
    }
    // 先篩選出在住院友，再按床號排序後取第一個院友
    const activeSummaries = patientPrescriptionSummaries.filter(s => s.patient.在住狀態 === '在住');
    const sortedSummaries = [...activeSummaries].sort((a, b) => 
      a.patient.床號.localeCompare(b.patient.床號, 'zh-Hant', { numeric: true })
    );
    return sortedSummaries[currentPatientIndex] || null;
  }, [patientPrescriptionSummaries, currentPatientIndex, patientFilters.selectedPatientId]);

  // 計算處方途徑統計
  const routeStatistics = useMemo(() => {
    const currentPrescriptions = currentPatient ? 
      currentPatient.prescriptions[activeTab] : [];
    
    // 應用途徑過濾
    let filteredPrescriptions = currentPrescriptions;
    if (selectedRoute !== '全部') {
      if (selectedRoute === '其他') {
        filteredPrescriptions = currentPrescriptions.filter(p => 
          p.administration_route && !['口服', '外用', '注射'].includes(p.administration_route)
        );
      } else {
        filteredPrescriptions = currentPrescriptions.filter(p => p.administration_route === selectedRoute);
      }
    }
    
    return {
      全部: currentPrescriptions.length,
      口服: currentPrescriptions.filter(p => p.administration_route === '口服').length,
      外用: currentPrescriptions.filter(p => p.administration_route === '外用').length,
      注射: currentPrescriptions.filter(p => p.administration_route === '注射').length,
      其他: currentPrescriptions.filter(p => p.administration_route && !['口服', '外用', '注射'].includes(p.administration_route)).length,
      filtered: filteredPrescriptions.length
    };
  }, [currentPatient, activeTab, selectedRoute]);

  // 處理 URL 參數，自動選中院友和小分頁
  React.useEffect(() => {
    const patientIdFromUrl = searchParams.get('patient');
    const tabFromUrl = searchParams.get('tab');

    if (patientIdFromUrl && patientPrescriptionSummaries.length > 0) {
      const patientIndex = patientPrescriptionSummaries.findIndex(
        summary => summary.patient.院友id.toString() === patientIdFromUrl
      );
      if (patientIndex !== -1) {
        setPatientFilters(prev => ({
          ...prev,
          selectedPatientId: patientIdFromUrl
        }));

        // 如果有 tab 參數，切換到指定的小分頁
        if (tabFromUrl && ['active', 'pending_change', 'inactive'].includes(tabFromUrl)) {
          setActiveTab(tabFromUrl as 'active' | 'pending_change' | 'inactive');
        }

        // 延遲清除 URL 參數，確保狀態已更新
        setTimeout(() => {
          setSearchParams({});
        }, 100);
      }
    }
  }, [searchParams, patientPrescriptionSummaries, setSearchParams]);

  // 切換院友時清空選擇
  React.useEffect(() => {
    setSelectedRows(new Set());
  }, [currentPatient?.patient.院友id]);

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

  // Filter patients for dropdown
  const filteredPatientsForDropdown = useMemo(() => {
    return patientPrescriptionSummaries.filter(summary => {
      // 先根據在住狀態篩選
      if (patientFilters.residencyStatus !== '全部' && summary.patient.在住狀態 !== patientFilters.residencyStatus) {
        return false;
      }
      
      // 再根據搜索條件篩選
      if (!patientFilters.searchTerm) return true;

      const searchLower = patientFilters.searchTerm.toLowerCase();
      const chineseName = `${summary.patient.中文姓氏}${summary.patient.中文名字}`.toLowerCase();
      const englishName = getFormattedEnglishName(summary.patient.英文姓氏, summary.patient.英文名字).toLowerCase();

      return (
        summary.patient.床號.toLowerCase().includes(searchLower) ||
        chineseName.includes(searchLower) ||
        summary.patient.中文姓氏.toLowerCase().includes(searchLower) ||
        summary.patient.中文名字.toLowerCase().includes(searchLower) ||
        englishName.includes(searchLower) ||
        (summary.patient.英文姓氏?.toLowerCase().includes(searchLower) || false) ||
        (summary.patient.英文名字?.toLowerCase().includes(searchLower) || false) ||
        summary.patient.身份證號碼.toLowerCase().includes(searchLower)
      );
    });
  }, [patientPrescriptionSummaries, patientFilters.searchTerm, patientFilters.residencyStatus]);

  // Navigation functions
  const goToPreviousPatient = () => {
    if (patientFilters.selectedPatientId) {
      // If using dropdown selection, find current index and go to previous
      const currentIndex = patientPrescriptionSummaries.findIndex(s => s.patient.院友id.toString() === patientFilters.selectedPatientId);
      const newIndex = currentIndex > 0 ? currentIndex - 1 : patientPrescriptionSummaries.length - 1;
      setPatientFilters(prev => ({ ...prev, selectedPatientId: patientPrescriptionSummaries[newIndex].patient.院友id.toString() }));
    } else {
      setCurrentPatientIndex(prev => prev > 0 ? prev - 1 : patientPrescriptionSummaries.length - 1);
    }
  };

  const goToNextPatient = () => {
    if (patientFilters.selectedPatientId) {
      // If using dropdown selection, find current index and go to next
      const currentIndex = patientPrescriptionSummaries.findIndex(s => s.patient.院友id.toString() === patientFilters.selectedPatientId);
      const newIndex = currentIndex < patientPrescriptionSummaries.length - 1 ? currentIndex + 1 : 0;
      setPatientFilters(prev => ({ ...prev, selectedPatientId: patientPrescriptionSummaries[newIndex].patient.院友id.toString() }));
    } else {
      setCurrentPatientIndex(prev => prev < patientPrescriptionSummaries.length - 1 ? prev + 1 : 0);
    }
  };

  const handlePatientSelect = (patientId: string) => {
    setPatientFilters(prev => ({ ...prev, selectedPatientId: patientId }));
    setShowPatientDropdown(false);
  };

  const clearPatientSelection = () => {
    setPatientFilters({ selectedPatientId: '', searchTerm: '', residencyStatus: '在住' });
    setCurrentPatientIndex(0);
  };

  const handleSelectRow = (prescriptionId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(prescriptionId)) {
      newSelected.delete(prescriptionId);
    } else {
      newSelected.add(prescriptionId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    const currentPrescriptions = currentPatient ? 
      currentPatient.prescriptions[activeTab] : [];
    
    // 應用途徑過濾
    let filteredPrescriptions = currentPrescriptions;
    if (selectedRoute !== '全部') {
      if (selectedRoute === '其他') {
        filteredPrescriptions = currentPrescriptions.filter(p => 
          p.administration_route && !['口服', '外用', '注射'].includes(p.administration_route)
        );
      } else {
        filteredPrescriptions = currentPrescriptions.filter(p => p.administration_route === selectedRoute);
      }
    }

    const allIds = filteredPrescriptions.map(p => p.id);
    
    if (selectedRows.size === allIds.length && allIds.every(id => selectedRows.has(id))) {
      // 如果全部選中，則取消全選
      const newSelected = new Set(selectedRows);
      allIds.forEach(id => newSelected.delete(id));
      setSelectedRows(newSelected);
    } else {
      // 否則全選
      const newSelected = new Set(selectedRows);
      allIds.forEach(id => newSelected.add(id));
      setSelectedRows(newSelected);
    }
  };

  const handleInvertSelection = () => {
    const currentPrescriptions = currentPatient ? 
      currentPatient.prescriptions[activeTab] : [];
    
    // 應用途徑過濾
    let filteredPrescriptions = currentPrescriptions;
    if (selectedRoute !== '全部') {
      if (selectedRoute === '其他') {
        filteredPrescriptions = currentPrescriptions.filter(p => 
          p.administration_route && !['口服', '外用', '注射'].includes(p.administration_route)
        );
      } else {
        filteredPrescriptions = currentPrescriptions.filter(p => p.administration_route === selectedRoute);
      }
    }

    const newSelected = new Set<string>();
    filteredPrescriptions.forEach(prescription => {
      if (!selectedRows.has(prescription.id)) {
        newSelected.add(prescription.id);
      }
    });
    
    // 保留其他標籤頁的選擇
    selectedRows.forEach(id => {
      const isInCurrentView = filteredPrescriptions.some(p => p.id === id);
      if (!isInCurrentView) {
        newSelected.add(id);
      }
    });
    
    setSelectedRows(newSelected);
  };

  const handleEdit = (prescription: any) => {
    setSelectedPrescription(prescription);
    setShowModal(true);
  };

  const handleTransfer = (prescription: any) => {
    setSelectedPrescription(prescription);
    setShowTransferModal(true);
  };

  const handleStatusChange = (prescription: any, targetStatus: 'active' | 'pending_change' | 'inactive') => {
    // 檢查是否需要處理結束日期
    const needsEndDate = targetStatus === 'inactive' && !prescription.end_date;
    const needsEndDateRemoval = (targetStatus === 'active' || targetStatus === 'pending_change') && prescription.end_date;

    if (needsEndDate || needsEndDateRemoval) {
      // 需要處理結束日期
      setPendingStatusChange({ prescription, targetStatus });
      setShowEndDateModal(true);
    } else {
      // 直接更新狀態
      updatePrescriptionStatus(prescription, targetStatus);
    }
  };

  const updatePrescriptionStatus = async (prescription: any, targetStatus: 'active' | 'pending_change' | 'inactive', endDate?: string | null) => {
    try {
      const updateData: any = {
        ...prescription,
        status: targetStatus
      };

      // 根據目標狀態設定結束日期
      if (targetStatus === 'inactive') {
        updateData.end_date = endDate || prescription.end_date;

        // 驗證停用處方必須有結束日期
        if (!updateData.end_date) {
          alert('錯誤：停用處方必須設定結束日期');
          return;
        }
      } else {
        updateData.end_date = null;
      }

      await updatePrescription(updateData);
    } catch (error) {
      console.error('更新處方狀態失敗:', error);
      alert('更新處方狀態失敗，請重試');
    }
  };

  const handleEndDateConfirm = (endDate: string | null) => {
    if (pendingStatusChange) {
      updatePrescriptionStatus(pendingStatusChange.prescription, pendingStatusChange.targetStatus, endDate);
    }
    setShowEndDateModal(false);
    setPendingStatusChange(null);
  };

  const handleDelete = async (id: string) => {
    const prescription = prescriptions.find(p => p.id === id);
    const patient = patients.find(p => p.院友id === prescription?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的「${prescription?.medication_name}」處方嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePrescription(id);
      } catch (error) {
        alert('刪除處方失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const totalStats = {
    totalPatients: patientPrescriptionSummaries.length,
    totalPrescriptions: (prescriptions || []).length,
    activePrescriptions: (prescriptions || []).filter(p => p.status === 'active').length,
    pendingPrescriptions: (prescriptions || []).filter(p => p.status === 'pending_change').length,
    inactivePrescriptions: (prescriptions || []).filter(p => p.status === 'inactive').length
  };

  if (patientPrescriptionSummaries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">處方管理</h1>
              <p className="text-sm text-gray-600 mt-1">以院友為單位管理處方，每名院友獨立顯示三種處方狀態</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowMedicationRecordExportModal(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <FileText className="h-4 w-4" />
                <span>匯出個人備藥及給藥記錄</span>
              </button>
              <button
                onClick={() => {
                  setSelectedPrescription(null);
                  setShowModal(true);
                }}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增處方</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center py-12">
          <Pill className="h-24 w-24 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暫無院友處方記錄</h3>
          <p className="text-gray-600 mb-4">開始為院友建立處方</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            新增處方
          </button>
        </div>

        {showModal && (
          <PrescriptionModal
            prescription={selectedPrescription}
            onClose={() => {
              setShowModal(false);
              setSelectedPrescription(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">處方管理</h1>
            <p className="text-sm text-gray-600 mt-1">以院友為單位管理處方，每名院友獨立顯示三種處方狀態</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMedicationRecordExportModal(true)}
              className="btn-secondary flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>匯出個人備藥及給藥記錄</span>
            </button>
            <button
              onClick={() => {
                setSelectedPrescription(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增處方</span>
            </button>
          </div>
        </div>
      </div>

      {/* 院友選擇和導航 */}
      <div className="bg-white shadow-sm">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* 院友下拉選擇器 */}
              <div className="relative">
                <button
                  onClick={() => setShowPatientDropdown(!showPatientDropdown)}
                  className="flex items-center space-x-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 min-w-64"
                >
                  {currentPatient ? (
                    <>
                      <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                        {currentPatient.patient.院友相片 ? (
                          <img 
                            src={currentPatient.patient.院友相片} 
                            alt={currentPatient.patient.中文姓名} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">
                          {currentPatient.patient.床號} - {currentPatient.patient.中文姓氏}{currentPatient.patient.中文名字}
                        </div>
                        <div className="text-sm text-gray-500">
                          {currentPatient.totalCount} 個處方
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-500">選擇院友...</span>
                  )}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {showPatientDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
                    {/* 搜索欄 */}
                    <div className="p-3 border-b border-gray-200">
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="搜索院友姓名或床號..."
                            value={patientFilters.searchTerm}
                            onChange={(e) => setPatientFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            className="form-input pl-10 w-full"
                            autoFocus
                          />
                        </div>
                        <div>
                          <select
                            value={patientFilters.residencyStatus}
                            onChange={(e) => setPatientFilters(prev => ({ ...prev, residencyStatus: e.target.value }))}
                            className="form-input w-full text-sm"
                          >
                            <option value="在住">在住院友</option>
                            <option value="待入住">待入住院友</option>
                            <option value="已退住">已退住院友</option>
                            <option value="全部">全部院友</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 院友列表 */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredPatientsForDropdown.length > 0 ? (
                        filteredPatientsForDropdown.map(summary => (
                          <button
                            key={summary.patient.院友id}
                            onClick={() => handlePatientSelect(summary.patient.院友id.toString())}
                            className={`w-full flex items-center space-x-3 p-3 hover:bg-gray-50 text-left transition-colors ${
                              currentPatient?.patient.院友id === summary.patient.院友id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                          >
                            <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                              {summary.patient.院友相片 ? (
                                <img 
                                  src={summary.patient.院友相片} 
                                  alt={summary.patient.中文姓名} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {summary.patient.床號} - {summary.patient.中文姓氏}{summary.patient.中文名字}
                              </div>
                              <div className="text-sm text-gray-500">
                                在服: {summary.prescriptions.active.length} | 
                                待變更: {summary.prescriptions.pending_change.length} | 
                                停用: {summary.prescriptions.inactive.length}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">找不到符合條件的院友</p>
                        </div>
                      )}
                    </div>

                    {/* 清除選擇 */}
                    {patientFilters.selectedPatientId && (
                      <div className="p-3 border-t border-gray-200">
                        <button
                          onClick={clearPatientSelection}
                          className="w-full text-center text-sm text-red-600 hover:text-red-700"
                        >
                          清除選擇，回到順序瀏覽
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 導航按鈕 */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPatient}
                  className="btn-secondary flex items-center space-x-2"
                  disabled={patientPrescriptionSummaries.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>上一位</span>
                </button>
                <button
                  onClick={goToNextPatient}
                  className="btn-secondary flex items-center space-x-2"
                  disabled={patientPrescriptionSummaries.length <= 1}
                >
                  <span>下一位</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 頁面指示器 */}
            <div className="text-sm text-gray-600">
              第 {(patientFilters.selectedPatientId ? 
                patientPrescriptionSummaries.findIndex(s => s.patient.院友id.toString() === patientFilters.selectedPatientId) + 1 :
                currentPatientIndex + 1)} / {patientPrescriptionSummaries.length} 位院友
              {patientFilters.residencyStatus !== '全部' && (
                <span className="ml-2 text-xs text-blue-600">
                  (僅顯示{patientFilters.residencyStatus}院友)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 當前院友的處方詳細內容 */}
      {currentPatient && (
        <div className="space-y-6">
          {/* 院友詳細資訊與藥物安全資訊整合卡片 */}
          <div className="card p-6">
            <div className="flex items-start space-x-6">
              <div className="w-24 h-24 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {currentPatient.patient.院友相片 ? (
                  <img 
                    src={currentPatient.patient.院友相片} 
                    alt={currentPatient.patient.中文姓名} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-blue-600" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {/* 基本資訊 */}
                  <div>
                    <PatientTooltip patient={currentPatient.patient}>
                      <h2 className="text-2xl font-bold text-gray-900 cursor-help hover:text-blue-600 transition-colors mb-2">
                        {currentPatient.patient.中文姓氏}{currentPatient.patient.中文名字}
                      </h2>
                    </PatientTooltip>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-4">
                        <span>床號: <span className="font-medium text-gray-900">{currentPatient.patient.床號}</span></span>
                        <span>性別: <span className="font-medium text-gray-900">{currentPatient.patient.性別}</span></span>
                        {currentPatient.patient.出生日期 && (
                          <span>年齡: <span className="font-medium text-gray-900">{calculateAge(currentPatient.patient.出生日期)}歲</span></span>
                        )}
                      </div>

                      {currentPatient.patient.身份證號碼 && (
                        <div>身份證號碼: <span className="font-medium text-gray-900">{currentPatient.patient.身份證號碼}</span></div>
                      )}
                      
                      {currentPatient.patient.出生日期 && (
                        <div>出生日期: <span className="font-medium text-gray-900">{new Date(currentPatient.patient.出生日期).toLocaleDateString('zh-TW')}</span></div>
                      )}
                      
                      {(currentPatient.patient.英文姓氏 || currentPatient.patient.英文名字) && (
                        <div>英文姓名: <span className="font-medium text-gray-900">{getFormattedEnglishName(currentPatient.patient.英文姓氏, currentPatient.patient.英文名字)}</span></div>
                      )}
                    </div>
                  </div>
                  
                  {/* 藥物安全資訊 */}
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">藥物安全資訊</h3>
                    </div>
                    
                    <div className="space-y-2">
                      {/* 藥物敏感 */}
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <h4 className="text-sm font-medium text-orange-900">藥物敏感</h4>
                          {(!currentPatient.patient.藥物敏感 || currentPatient.patient.藥物敏感.length === 0) ? (
                            <span className="text-xs text-gray-500 ml-2">無記錄</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 ml-2">
                              {currentPatient.patient.藥物敏感.map((allergy: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {allergy}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 不良藥物反應 */}
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Heart className="h-4 w-4 text-red-600" />
                          <h4 className="text-sm font-medium text-red-900">不良藥物反應</h4>
                          {(!currentPatient.patient.不良藥物反應 || currentPatient.patient.不良藥物反應.length === 0) ? (
                            <span className="text-xs text-gray-500 ml-2">無記錄</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 ml-2">
                              {currentPatient.patient.不良藥物反應.map((reaction: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 border border-red-200"
                                >
                                  <Heart className="h-3 w-3 mr-1" />
                                  {reaction}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 整合處方卡片 */}
          <IntegratedPrescriptionCard
            currentPatient={currentPatient}
            selectedPrescriptions={selectedRows}
            routeStatistics={routeStatistics}
            selectedRoute={selectedRoute}
            setSelectedRoute={setSelectedRoute}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onInvertSelection={handleInvertSelection}
            onBatchUpdate={() => setShowBatchUpdateModal(true)}
            onEdit={handleEdit}
            onTransfer={handleTransfer}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onAddPrescription={(status) => {
              setSelectedPrescription({ patient_id: currentPatient.patient.院友id, status });
              setShowModal(true);
            }}
            deletingIds={deletingIds}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
      )}

      {showBatchUpdateModal && (
        <BatchPrescriptionDateUpdateModal
          selectedPrescriptionIds={Array.from(selectedRows)}
          onClose={() => setShowBatchUpdateModal(false)}
          onSuccess={() => {
            setSelectedRows(new Set());
            setShowBatchUpdateModal(false);
          }}
        />
      )}

      {showModal && (
        <PrescriptionModal
          prescription={selectedPrescription}
          onClose={() => {
            setShowModal(false);
            setSelectedPrescription(null);
          }}
        />
      )}

      {showTransferModal && selectedPrescription && (
        <PrescriptionTransferModal
          prescription={selectedPrescription}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedPrescription(null);
          }}
        />
      )}

      {showMedicationRecordExportModal && (
        <MedicationRecordExportModal
          onClose={() => setShowMedicationRecordExportModal(false)}
          currentPatient={currentPatient}
          selectedPrescriptionIds={selectedRows}
          allPrescriptions={prescriptions}
        />
      )}

      {showEndDateModal && pendingStatusChange && (
        <PrescriptionEndDateModal
          isOpen={showEndDateModal}
          onClose={() => {
            setShowEndDateModal(false);
            setPendingStatusChange(null);
          }}
          prescription={pendingStatusChange.prescription}
          targetStatus={pendingStatusChange.targetStatus}
          onConfirm={handleEndDateConfirm}
        />
      )}
    </div>
  );
};

// 整合處方卡片組件
interface IntegratedPrescriptionCardProps {
  currentPatient: PatientPrescriptionSummary;
  selectedPrescriptions: Set<string>;
  routeStatistics: { 全部: number; 口服: number; 外用: number; 注射: number; 其他: number; filtered: number };
  selectedRoute: string;
  setSelectedRoute: (route: string) => void;
  onSelectRow: (prescriptionId: string) => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  onBatchUpdate: () => void;
  onEdit: (prescription: any) => void;
  onTransfer: (prescription: any) => void;
  onStatusChange: (prescription: any, targetStatus: 'active' | 'pending_change' | 'inactive') => void;
  onDelete: (id: string) => void;
  onAddPrescription: (status: 'active' | 'pending_change' | 'inactive') => void;
  deletingIds: Set<string>;
  activeTab: 'active' | 'pending_change' | 'inactive';
  setActiveTab: (tab: 'active' | 'pending_change' | 'inactive') => void;
}

const IntegratedPrescriptionCard: React.FC<IntegratedPrescriptionCardProps> = ({
  currentPatient,
  selectedPrescriptions,
  routeStatistics,
  selectedRoute,
  setSelectedRoute,
  onSelectRow,
  onSelectAll,
  onInvertSelection,
  onBatchUpdate,
  onEdit,
  onTransfer,
  onStatusChange,
  onDelete,
  onAddPrescription,
  deletingIds,
  activeTab,
  setActiveTab
}) => {

  // 計算當前視圖中的處方
  let currentPrescriptions = currentPatient.prescriptions[activeTab];
  if (selectedRoute !== '全部') {
    if (selectedRoute === '其他') {
      currentPrescriptions = currentPrescriptions.filter(p => 
        p.administration_route && !['口服', '外用', '注射'].includes(p.administration_route)
      );
    } else {
      currentPrescriptions = currentPrescriptions.filter(p => p.administration_route === selectedRoute);
    }
  }

  // 計算選中狀態
  const currentViewPrescriptionIds = currentPrescriptions.map(p => p.id);
  const selectedInCurrentView = currentViewPrescriptionIds.filter(id => selectedPrescriptions.has(id));
  const isAllSelected = currentViewPrescriptionIds.length > 0 && selectedInCurrentView.length === currentViewPrescriptionIds.length;
  const isPartiallySelected = selectedInCurrentView.length > 0 && selectedInCurrentView.length < currentViewPrescriptionIds.length;

  const tabs = [
    {
      key: 'active' as const,
      label: '在服處方',
      count: currentPatient.prescriptions.active.length,
      icon: CheckCircle,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      hoverColor: 'hover:bg-green-100',
      buttonColor: 'text-green-600 hover:text-green-800'
    },
    {
      key: 'pending_change' as const,
      label: '待變更處方',
      count: currentPatient.prescriptions.pending_change.length,
      icon: AlertTriangle,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      hoverColor: 'hover:bg-yellow-100',
      buttonColor: 'text-yellow-600 hover:text-yellow-800'
    },
    {
      key: 'inactive' as const,
      label: '停用處方',
      count: currentPatient.prescriptions.inactive.length,
      icon: X,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      hoverColor: 'hover:bg-gray-100',
      buttonColor: 'text-gray-600 hover:text-gray-800'
    }
  ];

  const currentTab = tabs.find(tab => tab.key === activeTab)!;

  const PrescriptionCard: React.FC<{ 
    prescription: any; 
    status: PrescriptionStatus;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onTransfer: () => void;
    onStatusChange: (targetStatus: 'active' | 'pending_change' | 'inactive') => void;
    onDelete: () => void;
  }> = ({ prescription, status, isSelected, onSelect, onEdit, onTransfer, onStatusChange, onDelete }) => (
    <div 
      className={`border rounded-lg p-4 ${getStatusColor(status)} hover:shadow-sm transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''
      }`}
      onDoubleClick={onEdit}
    >
      <div className="flex items-start space-x-3 mb-2">
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h5 className="font-medium text-gray-900 text-lg truncate">{prescription.medication_name}</h5>
          </div>
          
          {/* 將藥物來源和詳細資訊合併到同一行 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 mb-1">
            {prescription.medication_source && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">藥物來源:</span>
                <span className="font-medium">{prescription.medication_source}</span>
              </div>
            )}
            {prescription.dosage_amount && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">份量:</span>
                <span className="font-medium">
                  {prescription.dosage_amount}{prescription.dosage_unit || ''}
                </span>
              </div>
            )}
            {prescription.dosage_form && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">劑型:</span>
                <span className="font-medium">{prescription.dosage_form}</span>
              </div>
            )}
            {prescription.administration_route && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">途徑:</span>
                <span className="font-medium">{prescription.administration_route}</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">頻率:</span>
              <span className="font-medium">{getFrequencyDescription(prescription)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">開始:</span>
              <span className="font-medium">{new Date(prescription.start_date).toLocaleDateString('zh-TW')}</span>
            </div>
            {prescription.end_date && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">結束:</span>
                <span className="font-medium">{new Date(prescription.end_date).toLocaleDateString('zh-TW')}</span>
              </div>
            )}
            {prescription.prescription_date && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">處方日期:</span>
                <span className="font-medium">{new Date(prescription.prescription_date).toLocaleDateString('zh-TW')}</span>
              </div>
            )}
            {prescription.meal_timing && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">時段:</span>
                <span className="font-medium">{prescription.meal_timing}</span>
              </div>
            )}
            {prescription.preparation_method && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">備藥:</span>
                <span className="font-medium">
                  {prescription.preparation_method === 'immediate' ? '即時備藥' :
                   prescription.preparation_method === 'advanced' ? '提前備藥' :
                   prescription.preparation_method === 'custom' ? '自理' : prescription.preparation_method}
                </span>
              </div>
            )}
            {prescription.is_prn && (
              <div className="text-orange-600 font-medium">需要時 (PRN)</div>
            )}
            {prescription.medication_time_slots && prescription.medication_time_slots.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">時間:</span>
                <span className="font-medium">{prescription.medication_time_slots.join(', ')}</span>
              </div>
            )}
            {prescription.notes && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">備註:</span>
                <span className="font-medium text-gray-600">{prescription.notes}</span>
              </div>
            )}
            {prescription.inspection_rules && prescription.inspection_rules.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">檢測項:</span>
                <div className="flex flex-wrap gap-1">
                  {prescription.inspection_rules.map((rule: any, index: number) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200">
                      {rule.vital_sign_type} {
                        rule.condition_operator === 'gt' ? '>' :
                        rule.condition_operator === 'lt' ? '<' :
                        rule.condition_operator === 'gte' ? '≥' :
                        rule.condition_operator === 'lte' ? '≤' : ''
                      } {rule.condition_value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {/* 操作按鈕 */}
          <button
            onClick={onTransfer}
            className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50"
            title="轉移處方"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
            title="編輯"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
            title="刪除"
            disabled={deletingIds.has(prescription.id)}
          >
            {deletingIds.has(prescription.id) ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card">
      {/* 標籤頁導航 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${
                  activeTab === tab.key
                    ? `border-${tab.color}-500 ${tab.textColor}`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.key ? `bg-${tab.color}-100 ${tab.textColor}` : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 標籤頁內容 */}
      <div className={`${currentTab.bgColor} border-b ${currentTab.borderColor} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${currentTab.textColor} flex items-center`}>
            <currentTab.icon className="h-6 w-6 mr-2" />
            {currentTab.label} ({currentTab.count})
            
            {/* 途徑統計過濾器 */}
            <div className="ml-6 flex flex-wrap gap-2">
              {[
                { key: '全部', label: '全部', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
                { key: '口服', label: '口服', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
                { key: '外用', label: '外用', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
                { key: '注射', label: '注射', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
                { key: '其他', label: '其他', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' }
              ].map(route => (
                <button
                  key={route.key}
                  onClick={() => setSelectedRoute(route.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    selectedRoute === route.key
                      ? route.color.replace('hover:', '').replace('100', '200')
                      : route.color
                  } ${selectedRoute === route.key ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                >
                  {route.label} ({routeStatistics[route.key as keyof typeof routeStatistics]})
                </button>
              ))}
            </div>
          </h3>
          <button
            onClick={() => onAddPrescription(activeTab)}
            className={`${currentTab.buttonColor} p-2 rounded-lg ${currentTab.hoverColor}`}
            title={`新增${currentTab.label}`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* 選取控制 */}
        {currentPrescriptions.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={onSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {isAllSelected ? '取消全選' : '全選'}
                </button>
                <button
                  onClick={onInvertSelection}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  反選
                </button>
                {selectedInCurrentView.length > 0 && (
                  <button
                    onClick={onBatchUpdate}
                    className="btn-primary flex items-center space-x-2 text-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>批量更新處方日期</span>
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedInCurrentView.length} / {currentPrescriptions.length} 個處方
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 min-h-[400px]">
          {currentPrescriptions.length > 0 ? (
            currentPrescriptions.map(prescription => (
              <PrescriptionCard
                key={prescription.id}
                prescription={prescription}
                status={activeTab}
                isSelected={selectedPrescriptions.has(prescription.id)}
                onSelect={() => onSelectRow(prescription.id)}
                onEdit={() => onEdit(prescription)}
                onTransfer={() => onTransfer(prescription)}
                onStatusChange={(targetStatus) => onStatusChange(prescription, targetStatus)}
                onDelete={() => onDelete(prescription.id)}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <currentTab.icon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">
                暫無{selectedRoute === '全部' ? '' : selectedRoute + '途徑的'}{currentTab.label}
              </p>
              <p className="text-sm mb-4">
                此院友目前沒有{selectedRoute === '全部' ? '' : selectedRoute + '途徑的'}{currentTab.label.replace('處方', '')}處方
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionManagement;