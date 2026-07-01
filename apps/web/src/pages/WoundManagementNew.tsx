import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Trash2,
  Eye,
  Activity,
  User,
  X,
  Download,
  TrendingUp,
  History,
  Target,
  FileText
} from 'lucide-react';
import { usePatients, type Wound, type WoundWithAssessments, type PatientWithWounds, type WoundAssessment } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import PatientTooltip from '../components/PatientTooltip';
import WoundModal from '../components/WoundModal';
import SingleWoundAssessmentModal from '../components/SingleWoundAssessmentModal';
import { fuzzyMatch } from '../utils/searchUtils';

// 計算傷口存在天數
const calculateDaysSinceDiscovery = (discoveryDate: string, healedDate?: string): number => {
  const start = new Date(discoveryDate);
  const end = healedDate ? new Date(healedDate) : new Date();
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

// 計算評估頻率是否正常（每週至少一次）
const isAssessmentFrequencyNormal = (wound: WoundWithAssessments): boolean => {
  if (wound.status !== 'active') return true;
  if (wound.assessments.length === 0) {
    // 沒有評估記錄，檢查發現日期是否超過7天
    const daysSinceDiscovery = calculateDaysSinceDiscovery(wound.discovery_date);
    return daysSinceDiscovery <= 7;
  }
  // 檢查最近一次評估是否在7天內
  const lastAssessment = wound.assessments[0];
  const daysSinceLastAssessment = calculateDaysSinceDiscovery(lastAssessment.assessment_date);
  return daysSinceLastAssessment <= 7;
};

// 格式化天數顯示
const formatDaysDisplay = (days: number): string => {
  if (days === 0) return '今天';
  if (days === 1) return '1天';
  if (days < 7) return `${days}天`;
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  if (remainingDays === 0) return `${weeks}週`;
  return `${weeks}週${remainingDays}天`;
};

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  傷口狀態: string;
  傷口類型: string;
  評估狀態: string;
}

const WOUND_TYPE_LABELS: Record<string, string> = {
  pressure_ulcer: '壓瘡',
  trauma: '創傷',
  surgical: '手術傷口',
  diabetic: '糖尿病傷口',
  venous: '靜脈性潰瘍',
  arterial: '動脈性潰瘍',
  other: '其他'
};

const WOUND_ORIGIN_LABELS: Record<string, string> = {
  facility: '本院發現',
  admission: '入院時已有',
  hospital_referral: '醫院轉介'
};

const WOUND_STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  healed: '已痊癒',
  transferred: '已轉移'
};

const RESPONSIBLE_UNIT_LABELS: Record<string, string> = {
  community_health: '社康',
  cgat: 'CGAT',
  facility_staff: '本院職員',
  other: '其他'
};

const WoundManagementNew: React.FC = () => {
  const { patientsWithWounds, patients, deleteWound, refreshWoundData, loading } = usePatients();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  const [expandedWounds, setExpandedWounds] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    傷口狀態: 'active',
    傷口類型: '',
    評估狀態: ''
  });

  // Modal states
  const [showWoundModal, setShowWoundModal] = useState(false);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>();
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentWound, setAssessmentWound] = useState<Wound | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<WoundAssessment | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // 篩選病人
  const filteredPatientsWithWounds = useMemo(() => {
    return patientsWithWounds.filter(p => {
      // 搜索條件
      if (searchTerm) {
        const matchesSearch = 
          fuzzyMatch(p.patient_name, searchTerm) ||
          fuzzyMatch(p.bed_number, searchTerm);
        if (!matchesSearch) return false;
      }

      // 進階篩選
      if (advancedFilters.床號 && !fuzzyMatch(p.bed_number, advancedFilters.床號)) {
        return false;
      }
      if (advancedFilters.中文姓名 && !fuzzyMatch(p.patient_name, advancedFilters.中文姓名)) {
        return false;
      }

      // 傷口狀態篩選
      if (advancedFilters.傷口狀態 && advancedFilters.傷口狀態 !== '全部') {
        const hasMatchingWound = p.wounds.some(w => w.status === advancedFilters.傷口狀態);
        if (!hasMatchingWound) return false;
      }

      // 傷口類型篩選
      if (advancedFilters.傷口類型) {
        const hasMatchingType = p.wounds.some(w => w.wound_type === advancedFilters.傷口類型);
        if (!hasMatchingType) return false;
      }

      // 評估狀態篩選
      if (advancedFilters.評估狀態 === 'overdue') {
        if (p.overdue_assessment_count === 0) return false;
      }

      return true;
    });
  }, [patientsWithWounds, searchTerm, advancedFilters]);

  // 統計資料
  const stats = useMemo(() => {
    let totalWounds = 0;
    let activeWounds = 0;
    let healedWounds = 0;
    let overdueAssessments = 0;
    let dueTodayOrTomorrow = 0;
    let totalAssessments = 0;
    let patientsWithActiveWounds = 0;

    patientsWithWounds.forEach(p => {
      totalWounds += p.wounds.length;
      activeWounds += p.active_wound_count;
      healedWounds += p.healed_wound_count;
      overdueAssessments += p.overdue_assessment_count;
      if (p.active_wound_count > 0) {
        patientsWithActiveWounds++;
      }
      p.wounds.forEach(w => {
        totalAssessments += w.assessment_count;
        if (w.status === 'active' && w.days_until_due !== undefined) {
          if (w.days_until_due >= 0 && w.days_until_due <= 1) {
            dueTodayOrTomorrow++;
          }
        }
      });
    });

    return { totalWounds, activeWounds, healedWounds, overdueAssessments, dueTodayOrTomorrow, totalAssessments, patientsWithActiveWounds };
  }, [patientsWithWounds]);

  const togglePatient = (patientId: number) => {
    setExpandedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const toggleWound = (woundId: string) => {
    setExpandedWounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(woundId)) {
        newSet.delete(woundId);
      } else {
        newSet.add(woundId);
      }
      return newSet;
    });
  };

  const handleAddWound = (patientId?: number) => {
    setSelectedWound(null);
    setSelectedPatientId(patientId);
    setShowWoundModal(true);
  };

  const handleEditWound = (wound: Wound) => {
    setSelectedWound(wound);
    setShowWoundModal(true);
  };

  const handleDeleteWound = async (wound: Wound) => {
    const patient = patients.find(p => p.院友id === wound.patient_id);
    if (!confirm(`確定要刪除 ${patient?.中文姓名} 的傷口 ${wound.wound_code} 嗎？\n這將同時刪除所有相關的評估記錄。`)) {
      return;
    }

    try {
      setDeletingIds(prev => new Set(prev).add(wound.id));
      await deleteWound(wound.id);
    } catch (error) {
      console.error('Error deleting wound:', error);
      alert('刪除傷口失敗');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(wound.id);
        return newSet;
      });
    }
  };

  const handleAddAssessment = (wound: Wound) => {
    setAssessmentWound(wound);
    setSelectedAssessment(null);
    setShowAssessmentModal(true);
  };

  const handleViewAssessment = (wound: Wound, assessment: WoundAssessment) => {
    setAssessmentWound(wound);
    setSelectedAssessment(assessment);
    setShowAssessmentModal(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '',
      中文姓名: '',
      傷口狀態: 'active',
      傷口類型: '',
      評估狀態: ''
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">進行中</span>;
      case 'healed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">已痊癒</span>;
      case 'transferred':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">已轉移</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW');
  };

  if (loading) {
    return <LoadingScreen pageName="傷口管理" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">傷口管理</h1>
          <p className="text-gray-600 mt-1">管理院友傷口記錄和評估</p>
        </div>
        <button
          onClick={() => handleAddWound()}
          className="flex flex-wrap items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>新增傷口</span>
        </button>
      </div>

      {/* 搜尋和篩選 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋院友..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={advancedFilters.傷口狀態}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, 傷口狀態: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="全部">全部狀態</option>
              <option value="active">進行中</option>
              <option value="healed">已痊癒</option>
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex flex-wrap items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
                showAdvancedFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>進階篩選</span>
            </button>

            {(searchTerm || Object.values(advancedFilters).some(v => v && v !== 'active')) && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
                <span>清除</span>
              </button>
            )}
          </div>
        </div>

        {/* 進階篩選面板 */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">床號</label>
              <input
                type="text"
                value={advancedFilters.床號}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, 床號: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="篩選床號..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={advancedFilters.中文姓名}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, 中文姓名: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="篩選姓名..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">傷口類型</label>
              <select
                value={advancedFilters.傷口類型}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, 傷口類型: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">全部類型</option>
                {Object.entries(WOUND_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">評估狀態</label>
              <select
                value={advancedFilters.評估狀態}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, 評估狀態: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">全部</option>
                <option value="overdue">逾期評估</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 主表格：一院友對多傷口 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-medium text-gray-900">傷口清單</h2>
            <span className="text-sm text-gray-500">（點擊展開查看傷口詳情）</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[768px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">院友</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口數量</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">負責換症單位</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">評估狀態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatientsWithWounds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <Activity className="h-8 w-8 text-gray-400" />
                      <p>沒有找到符合條件的傷口記錄</p>
                      <button
                        onClick={() => handleAddWound()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        + 新增第一個傷口
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatientsWithWounds.map(patientData => {
                  const patient = patients.find(p => p.院友id === patientData.patient_id);
                  const isExpanded = expandedPatients.has(patientData.patient_id);
                  
                  // 篩選傷口
                  let displayWounds = patientData.wounds;
                  if (advancedFilters.傷口狀態 && advancedFilters.傷口狀態 !== '全部') {
                    displayWounds = displayWounds.filter(w => w.status === advancedFilters.傷口狀態);
                  }
                  if (advancedFilters.傷口類型) {
                    displayWounds = displayWounds.filter(w => w.wound_type === advancedFilters.傷口類型);
                  }

                  // 計算評估狀態
                  const activeWounds = displayWounds.filter(w => w.status === 'active');
                  const overdueCount = displayWounds.filter(w => w.is_overdue).length;
                  const normalCount = activeWounds.filter(w => !w.is_overdue && isAssessmentFrequencyNormal(w)).length;

                  return (
                    <React.Fragment key={patientData.patient_id}>
                      {/* 病人行 */}
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => togglePatient(patientData.patient_id)}
                      >
                        <td className="px-4 py-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                              {patient?.院友相片 ? (
                                <img
                                  src={patient.院友相片}
                                  alt={patient.中文姓名}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              {patient ? (
                                <PatientTooltip patient={patient}>
                                  <span className="text-sm font-medium text-gray-900 cursor-help hover:text-blue-600">
                                    {patientData.patient_name}
                                  </span>
                                </PatientTooltip>
                              ) : (
                                <span className="text-sm font-medium text-gray-900">
                                  {patientData.patient_name}
                                </span>
                              )}
                              <div className="text-sm text-gray-500">{patientData.bed_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                              {displayWounds.length} 個傷口
                            </span>
                            {patientData.active_wound_count > 0 && (
                              <span className="text-xs text-yellow-600">
                                ({patientData.active_wound_count} 進行中)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {displayWounds.map(wound => {
                              const unitLabel = wound.responsible_unit 
                                ? (wound.responsible_unit === 'other' 
                                    ? wound.responsible_unit_other || '其他' 
                                    : RESPONSIBLE_UNIT_LABELS[wound.responsible_unit])
                                : '未設定';
                              return (
                                <span
                                  key={wound.id}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  title={`${wound.wound_code}: ${unitLabel}`}
                                >
                                  {wound.wound_code}: {unitLabel}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {overdueCount > 0 && (
                              <span className="inline-flex items-center text-xs text-red-600 font-medium">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {overdueCount} 個逾期
                              </span>
                            )}
                            {normalCount > 0 && (
                              <span className="inline-flex items-center text-xs text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {normalCount} 個正常
                              </span>
                            )}
                            {activeWounds.length === 0 && displayWounds.length > 0 && (
                              <span className="text-xs text-gray-500">全部已痊癒</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddWound(patientData.patient_id);
                            }}
                            className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            新增傷口
                          </button>
                        </td>
                      </tr>

                      {/* 展開的傷口列表 */}
                      {isExpanded && displayWounds.map(wound => {
                        const isWoundExpanded = expandedWounds.has(wound.id);
                        const daysSinceDiscovery = calculateDaysSinceDiscovery(wound.discovery_date, wound.healed_date);
                        
                        return (
                          <React.Fragment key={wound.id}>
                            {/* 傷口行 */}
                            <tr className={`border-l-4 ${
                              wound.status === 'healed' 
                                ? 'bg-green-50 border-green-400' 
                                : wound.is_overdue 
                                ? 'bg-red-50 border-red-400'
                                : 'bg-yellow-50 border-yellow-400'
                            }`}>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleWound(wound.id)}
                                  className="ml-4"
                                >
                                  {isWoundExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-2">
                                  <div className="flex items-center flex-wrap gap-3">
                                    {/* 傷口編號和名稱 */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-gray-900 text-base">{wound.wound_code}</span>
                                      {wound.wound_name && (
                                        <span className="text-gray-600">({wound.wound_name})</span>
                                      )}
                                    </div>
                                    
                                    {/* 狀態徽章 */}
                                    {getStatusBadge(wound.status)}
                                    
                                    {/* 傷口類型和來源 */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                        {WOUND_TYPE_LABELS[wound.wound_type]}
                                      </span>
                                      <span className="text-gray-400">|</span>
                                      <span className="text-gray-500">
                                        {WOUND_ORIGIN_LABELS[wound.wound_origin]}
                                      </span>
                                    </div>
                                    
                                    {/* 日期資訊 */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                      <span className="text-gray-500 flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        發現: {formatDate(wound.discovery_date)}
                                      </span>
                                      <span className="text-blue-600 font-medium">
                                        存在 {formatDaysDisplay(daysSinceDiscovery)}
                                      </span>
                                    </div>
                                    
                                    {/* 評估資訊 */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                        <FileText className="h-3 w-3 mr-1" />
                                        {wound.assessment_count} 次評估
                                      </span>
                                    </div>
                                    
                                    {/* 下次評估或痊癒日期 */}
                                    {wound.status === 'active' && wound.next_assessment_due && (
                                      <span className={`text-xs flex items-center px-2 py-0.5 rounded ${
                                        wound.is_overdue 
                                          ? 'bg-red-100 text-red-700 font-medium animate-pulse' 
                                          : wound.days_until_due !== undefined && wound.days_until_due <= 2
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        <Clock className="h-3 w-3 mr-1" />
                                        下次評估: {formatDate(wound.next_assessment_due)}
                                        {wound.is_overdue && ' ⚠️ 逾期'}
                                        {!wound.is_overdue && wound.days_until_due !== undefined && wound.days_until_due <= 2 && ` (${wound.days_until_due === 0 ? '今天' : wound.days_until_due === 1 ? '明天' : '後天'})`}
                                      </span>
                                    )}
                                    {wound.healed_date && (
                                      <span className="text-xs text-green-600 flex items-center font-medium">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        痊癒日期: {formatDate(wound.healed_date)}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* 操作按鈕 */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {wound.status === 'active' && (
                                      <button
                                        onClick={() => handleAddAssessment(wound)}
                                        className={`inline-flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                          wound.is_overdue
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        <span>新增評估</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleEditWound(wound)}
                                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                      title="編輯傷口"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWound(wound)}
                                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                      title="刪除傷口"
                                      disabled={deletingIds.has(wound.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* 評估記錄列表 - 時間軸視圖 */}
                            {isWoundExpanded && (
                              <tr className="bg-white border-l-4 border-gray-200">
                                <td></td>
                                <td colSpan={5} className="px-8 py-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                    <div className="text-sm font-medium text-gray-700 flex items-center">
                                      <History className="h-4 w-4 mr-2 text-gray-500" />
                                      評估歷程 ({wound.assessment_count} 次評估)
                                    </div>
                                    {wound.status === 'active' && wound.assessments.length > 0 && (
                                      <div className="text-xs text-gray-500">
                                        平均評估間隔: {Math.round(calculateDaysSinceDiscovery(wound.discovery_date) / Math.max(wound.assessment_count, 1))} 天
                                      </div>
                                    )}
                                  </div>
                                  {wound.assessments.length === 0 ? (
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                      <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                      <p className="text-gray-500 text-sm">尚無評估記錄</p>
                                      {wound.status === 'active' && (
                                        <button
                                          onClick={() => handleAddAssessment(wound)}
                                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                          + 進行首次評估
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      {/* 時間軸線 */}
                                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                                      <div className="space-y-3">
                                        {wound.assessments.map((assessment, idx) => {
                                          const isLatest = idx === 0;
                                          const assessmentStatusLabels: Record<string, { label: string; color: string }> = {
                                            untreated: { label: '未處理', color: 'bg-gray-100 text-gray-800' },
                                            treating: { label: '治療中', color: 'bg-yellow-100 text-yellow-800' },
                                            improving: { label: '改善中', color: 'bg-blue-100 text-blue-800' },
                                            healed: { label: '已痊癒', color: 'bg-green-100 text-green-800' }
                                          };
                                          const statusInfo = assessment.wound_status ? assessmentStatusLabels[assessment.wound_status] : null;
                                          
                                          return (
                                            <div
                                              key={assessment.id}
                                              className={`relative pl-8 ${isLatest ? '' : ''}`}
                                            >
                                              {/* 時間軸圓點 */}
                                              <div className={`absolute left-2 top-3 w-4 h-4 rounded-full border-2 ${
                                                isLatest 
                                                  ? 'bg-blue-600 border-blue-600' 
                                                  : 'bg-white border-gray-300'
                                              }`}>
                                                {isLatest && (
                                                  <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                                                )}
                                              </div>
                                              
                                              <div 
                                                className={`p-3 rounded-lg border cursor-pointer ${
                                                  isLatest 
                                                    ? 'bg-blue-50 border-blue-200' 
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                }`}
                                                onDoubleClick={() => handleViewAssessment(wound, assessment)}
                                              >
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-2">
                                                  <div className="flex items-center flex-wrap gap-3">
                                                    {/* 日期和最新標記 */}
                                                    <span className="text-sm font-medium text-gray-900 flex items-center">
                                                      <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" />
                                                      {formatDate(assessment.assessment_date)}
                                                    </span>
                                                    {isLatest && (
                                                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">
                                                        最新
                                                      </span>
                                                    )}
                                                    
                                                    {/* 狀態 */}
                                                    {statusInfo && (
                                                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                                                        {statusInfo.label}
                                                      </span>
                                                    )}
                                                    
                                                    {/* 階段 */}
                                                    {assessment.stage && (
                                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                                                        {assessment.stage}
                                                      </span>
                                                    )}
                                                    
                                                    {/* 尺寸 */}
                                                    {assessment.area_length && assessment.area_width && (
                                                      <span className="text-xs text-gray-600 flex items-center">
                                                        📐 {assessment.area_length}×{assessment.area_width}
                                                        {assessment.area_depth && `×${assessment.area_depth}`} cm
                                                      </span>
                                                    )}
                                                    
                                                    {/* 感染標記 */}
                                                    {assessment.infection === '有' && (
                                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                                                        🔴 感染
                                                      </span>
                                                    )}
                                                    {assessment.infection === '懷疑' && (
                                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                                                        🟡 疑似感染
                                                      </span>
                                                    )}
                                                    
                                                    {/* 評估者 */}
                                                    {assessment.assessor && (
                                                      <span className="text-xs text-gray-500 flex items-center">
                                                        <User className="h-3 w-3 mr-1" />
                                                        {assessment.assessor}
                                                      </span>
                                                    )}
                                                  </div>
                                                  
                                                  <button
                                                    onClick={() => handleViewAssessment(wound, assessment)}
                                                    className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                                  >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    查看/編輯
                                                  </button>
                                                </div>
                                                
                                                {/* 備註預覽 */}
                                                {assessment.remarks && (
                                                  <div className="mt-2 text-xs text-gray-600 italic truncate">
                                                    📝 {assessment.remarks}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showWoundModal && (
        <WoundModal
          wound={selectedWound}
          patientId={selectedPatientId}
          onClose={() => {
            setShowWoundModal(false);
            setSelectedWound(null);
            setSelectedPatientId(undefined);
          }}
          onSave={() => refreshWoundData()}
        />
      )}

      {showAssessmentModal && assessmentWound && (
        <SingleWoundAssessmentModal
          wound={assessmentWound}
          assessment={selectedAssessment}
          onClose={() => {
            setShowAssessmentModal(false);
            setAssessmentWound(null);
            setSelectedAssessment(null);
          }}
          onSave={() => refreshWoundData()}
        />
      )}
    </div>
  );
};

export default WoundManagementNew;
