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
  Download
} from 'lucide-react';
import { usePatients, type Wound, type WoundWithAssessments, type PatientWithWounds, type WoundAssessment } from '../context/PatientContext';
import PatientTooltip from '../components/PatientTooltip';
import WoundModal from '../components/WoundModal';
import SingleWoundAssessmentModal from '../components/SingleWoundAssessmentModal';

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

const WOUND_STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  healed: '已痊癒',
  transferred: '已轉移'
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
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          p.patient_name.toLowerCase().includes(searchLower) ||
          p.bed_number.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // 進階篩選
      if (advancedFilters.床號 && !p.bed_number.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
        return false;
      }
      if (advancedFilters.中文姓名 && !p.patient_name.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
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

    patientsWithWounds.forEach(p => {
      totalWounds += p.wounds.length;
      activeWounds += p.active_wound_count;
      healedWounds += p.healed_wound_count;
      overdueAssessments += p.overdue_assessment_count;
    });

    return { totalWounds, activeWounds, healedWounds, overdueAssessments };
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">傷口管理</h1>
          <p className="text-gray-600 mt-1">管理院友傷口記錄和評估</p>
        </div>
        <button
          onClick={() => handleAddWound()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>新增傷口</span>
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">總傷口數</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalWounds}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">進行中</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.activeWounds}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">已痊癒</p>
              <p className="text-2xl font-bold text-green-600">{stats.healedWounds}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">逾期評估</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdueAssessments}</p>
            </div>
          </div>
        </div>
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
              className={`flex items-center space-x-2 px-3 py-2 border rounded-lg transition-colors ${
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">床號</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">院友姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口數量</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口概覽</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatientsWithWounds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    沒有找到符合條件的傷口記錄
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

                  return (
                    <React.Fragment key={patientData.patient_id}>
                      {/* 病人行 */}
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => togglePatient(patientData.patient_id)}
                      >
                        <td className="px-4 py-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {patientData.bed_number}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
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
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-gray-900">{displayWounds.length}</span>
                            {patientData.overdue_assessment_count > 0 && (
                              <span className="flex items-center text-xs text-red-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {patientData.overdue_assessment_count} 逾期
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {displayWounds.slice(0, 3).map(wound => (
                              <span
                                key={wound.id}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  wound.status === 'healed'
                                    ? 'bg-green-100 text-green-800'
                                    : wound.is_overdue
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {wound.wound_code}
                                {wound.is_overdue && ' ⚠️'}
                              </span>
                            ))}
                            {displayWounds.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{displayWounds.length - 3} 個
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddWound(patientData.patient_id);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            + 新增傷口
                          </button>
                        </td>
                      </tr>

                      {/* 展開的傷口列表 */}
                      {isExpanded && displayWounds.map(wound => {
                        const isWoundExpanded = expandedWounds.has(wound.id);
                        
                        return (
                          <React.Fragment key={wound.id}>
                            {/* 傷口行 */}
                            <tr className="bg-gray-50 border-l-4 border-blue-400">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleWound(wound.id)}
                                  className="ml-4"
                                >
                                  {isWoundExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <span className="font-medium text-gray-900">{wound.wound_code}</span>
                                    {wound.wound_name && (
                                      <span className="text-gray-600">{wound.wound_name}</span>
                                    )}
                                    {getStatusBadge(wound.status)}
                                    <span className="text-xs text-gray-500">
                                      {WOUND_TYPE_LABELS[wound.wound_type]}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      發現: {formatDate(wound.discovery_date)}
                                    </span>
                                    {wound.status === 'active' && wound.next_assessment_due && (
                                      <span className={`text-xs flex items-center ${
                                        wound.is_overdue ? 'text-red-600 font-medium' : 'text-gray-500'
                                      }`}>
                                        <Clock className="h-3 w-3 mr-1" />
                                        下次評估: {formatDate(wound.next_assessment_due)}
                                        {wound.is_overdue && ' (逾期)'}
                                      </span>
                                    )}
                                    {wound.healed_date && (
                                      <span className="text-xs text-green-600 flex items-center">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        痊癒: {formatDate(wound.healed_date)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {wound.status === 'active' && (
                                      <button
                                        onClick={() => handleAddAssessment(wound)}
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                                      >
                                        <Plus className="h-4 w-4" />
                                        <span>新增評估</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleEditWound(wound)}
                                      className="p-1 text-gray-400 hover:text-blue-600"
                                      title="編輯傷口"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWound(wound)}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="刪除傷口"
                                      disabled={deletingIds.has(wound.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* 評估記錄列表 */}
                            {isWoundExpanded && (
                              <tr className="bg-white border-l-4 border-blue-200">
                                <td></td>
                                <td colSpan={5} className="px-8 py-4">
                                  <div className="text-sm font-medium text-gray-700 mb-2">
                                    評估記錄 ({wound.assessment_count} 次)
                                  </div>
                                  {wound.assessments.length === 0 ? (
                                    <p className="text-gray-500 text-sm">尚無評估記錄</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {wound.assessments.map((assessment, idx) => (
                                        <div
                                          key={assessment.id}
                                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                                        >
                                          <div className="flex items-center space-x-4">
                                            <span className="text-sm text-gray-600">
                                              {formatDate(assessment.assessment_date)}
                                            </span>
                                            {assessment.stage && (
                                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                                                {assessment.stage}
                                              </span>
                                            )}
                                            {assessment.area_length && assessment.area_width && (
                                              <span className="text-xs text-gray-500">
                                                {assessment.area_length}×{assessment.area_width}
                                                {assessment.area_depth && `×${assessment.area_depth}`} cm
                                              </span>
                                            )}
                                            {assessment.infection === '有' && (
                                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                                                感染
                                              </span>
                                            )}
                                            {assessment.assessor && (
                                              <span className="text-xs text-gray-500">
                                                評估者: {assessment.assessor}
                                              </span>
                                            )}
                                            {idx === 0 && (
                                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                最新
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => handleViewAssessment(wound, assessment)}
                                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                                          >
                                            <Eye className="h-4 w-4" />
                                            <span>查看</span>
                                          </button>
                                        </div>
                                      ))}
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
