import React, { useState } from 'react';
import { 
  Heart, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Download,
  User,
  Calendar,
  FileText,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  Copy
} from 'lucide-react';
import { usePatients, type HealthAssessment } from '../context/PatientContext';
import HealthAssessmentModal from '../components/HealthAssessmentModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import { isHealthAssessmentOverdue, isHealthAssessmentDueSoon } from '../utils/taskScheduler';

type SortField = '院友姓名' | 'assessment_date' | 'assessor' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  評估人員: string;
  吸煙習慣: string;
  飲酒習慣: string;
  最高活動能力: string;
  情緒表現: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
  記錄狀態: string;
}

const HealthAssessments: React.FC = () => {
  const { healthAssessments, patients, deleteHealthAssessment, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<HealthAssessment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('assessment_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    評估人員: '',
    吸煙習慣: '',
    飲酒習慣: '',
    最高活動能力: '',
    情緒表現: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住',
    記錄狀態: '生效中'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

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

  const filteredAssessments = (healthAssessments || []).filter(assessment => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);

    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }

    // 記錄狀態篩選
    if (advancedFilters.記錄狀態) {
      if (advancedFilters.記錄狀態 === '生效中' && assessment.status !== 'active') {
        return false;
      }
      if (advancedFilters.記錄狀態 === '歷史記錄' && assessment.status !== 'archived') {
        return false;
      }
      // '全部' 不做篩選
    }

    if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.評估人員 && !assessment.assessor?.toLowerCase().includes(advancedFilters.評估人員.toLowerCase())) {
      return false;
    }
    if (advancedFilters.吸煙習慣 && assessment.smoking_habit !== advancedFilters.吸煙習慣) {
      return false;
    }
    if (advancedFilters.飲酒習慣 && assessment.drinking_habit !== advancedFilters.飲酒習慣) {
      return false;
    }
    if (advancedFilters.最高活動能力 && assessment.daily_activities?.max_activity !== advancedFilters.最高活動能力) {
      return false;
    }
    if (advancedFilters.情緒表現 && assessment.emotional_expression !== advancedFilters.情緒表現) {
      return false;
    }
    
    // 日期區間篩選
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const assessmentDate = new Date(assessment.assessment_date);
      if (advancedFilters.startDate && assessmentDate < new Date(advancedFilters.startDate)) {
        return false;
      }
      if (advancedFilters.endDate && assessmentDate > new Date(advancedFilters.endDate)) {
        return false;
      }
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.assessor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.remarks?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         false;
    }
    
    return matchesSearch;
  });

  const hasAdvancedFilters = () => {
    return Object.values(advancedFilters).some(value => value !== '');
  };

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '',
      中文姓名: '',
      評估人員: '',
      吸煙習慣: '',
      飲酒習慣: '',
      最高活動能力: '',
      情緒表現: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住',
      記錄狀態: '生效中'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    (healthAssessments || []).forEach(assessment => {
      let value = '';
      
      switch (field) {
        case '評估人員':
          value = assessment.assessor || '';
          break;
        default:
          return;
      }
      
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);

    let valueA: string | number = '';
    let valueB: string | number = '';

    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case 'assessment_date':
        valueA = new Date(a.assessment_date).getTime();
        valueB = new Date(b.assessment_date).getTime();
        break;
      case 'assessor':
        valueA = a.assessor || '';
        valueB = b.assessor || '';
        break;
      case 'created_at':
        valueA = new Date(a.created_at).getTime();
        valueB = new Date(b.created_at).getTime();
        break;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });

  // 按院友分組
  interface PatientGroup {
    patientId: number;
    patient: typeof patients[0];
    assessments: HealthAssessment[];
  }

  const groupedAssessments: PatientGroup[] = [];
  const patientMap = new Map<number, PatientGroup>();

  sortedAssessments.forEach(assessment => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);
    if (!patient) return;

    if (!patientMap.has(assessment.patient_id)) {
      const group: PatientGroup = {
        patientId: assessment.patient_id,
        patient: patient,
        assessments: []
      };
      patientMap.set(assessment.patient_id, group);
      groupedAssessments.push(group);
    }
    patientMap.get(assessment.patient_id)!.assessments.push(assessment);
  });

  // 切換院友的展開/收合狀態
  const togglePatientExpand = (patientId: number) => {
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

  // 全部展開
  const expandAll = () => {
    const allPatientIds = groupedAssessments.map(g => g.patientId);
    setExpandedPatients(new Set(allPatientIds));
  };

  // 全部收合
  const collapseAll = () => {
    setExpandedPatients(new Set());
  };

  // 檢查某院友的評估是否全部選中
  const isPatientFullySelected = (group: PatientGroup): boolean => {
    return group.assessments.every(a => selectedRows.has(a.id));
  };

  // 檢查某院友的評估是否部分選中
  const isPatientPartiallySelected = (group: PatientGroup): boolean => {
    const selectedCount = group.assessments.filter(a => selectedRows.has(a.id)).length;
    return selectedCount > 0 && selectedCount < group.assessments.length;
  };

  // 切換某院友下所有評估的選中狀態
  const togglePatientSelection = (group: PatientGroup) => {
    const newSelected = new Set(selectedRows);
    const isFullySelected = isPatientFullySelected(group);

    group.assessments.forEach(assessment => {
      if (isFullySelected) {
        newSelected.delete(assessment.id);
      } else {
        newSelected.add(assessment.id);
      }
    });

    setSelectedRows(newSelected);
  };

  // Pagination logic - 按照分組後的結果進行分頁
  const totalItems = sortedAssessments.length;
  const totalPages = Math.ceil(groupedAssessments.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedAssessments.slice(startIndex, endIndex);

  // 獲取當前頁所有評估記錄（用於全選等操作）
  const paginatedAssessments = paginatedGroups.flatMap(g => g.assessments);

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEdit = (assessment: HealthAssessment) => {
    setSelectedAssessment(assessment);
    setShowModal(true);
  };

  const handleSaveAs = (assessment: HealthAssessment) => {
    // 計算該院友的建議評估日期（上次評估 + 6個月）
    const patientAssessments = healthAssessments
      .filter(a => a.patient_id === assessment.patient_id)
      .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());

    let suggestedDate = new Date().toISOString().split('T')[0]; // 預設為今天
    if (patientAssessments.length > 0) {
      // 如果有上次評估，計算6個月後作為建議日期
      const lastAssessmentDate = new Date(patientAssessments[0].assessment_date);
      lastAssessmentDate.setMonth(lastAssessmentDate.getMonth() + 6);
      suggestedDate = lastAssessmentDate.toISOString().split('T')[0];
    }

    // 創建一個新的評估，複製現有評估的所有資料但清除ID和日期
    const newAssessment = {
      ...assessment,
      id: undefined, // 清除ID以創建新記錄
      assessment_date: suggestedDate, // 設為建議日期（上次評估 + 6個月）
      next_due_date: null, // 清除下次評估日期，讓系統重新計算
      archived_at: null, // 清除封存時間
      created_at: undefined,
      updated_at: undefined
    };
    setSelectedAssessment(newAssessment);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const assessment = healthAssessments.find(a => a.id === id);
    const patient = patients.find(p => p.院友id === assessment?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 在 ${assessment?.assessment_date} 的健康評估嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteHealthAssessment(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除健康評估失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.size === 0) {
      alert('請先選擇要刪除的記錄');
      return;
    }

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆健康評估嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const assessmentId of deletingArray) {
        await deleteHealthAssessment(assessmentId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆健康評估`);
    } catch (error) {
      console.error('批量刪除健康評估失敗:', error);
      alert('批量刪除健康評估失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (assessmentId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(assessmentId)) {
      newSelected.delete(assessmentId);
    } else {
      newSelected.add(assessmentId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedAssessments.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedAssessments.map(a => a.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedAssessments.forEach(assessment => {
      if (!selectedRows.has(assessment.id)) {
        newSelected.add(assessment.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = () => {
    const selectedAssessments = paginatedAssessments.filter(assessment => 
      selectedRows.has(assessment.id)
    );
    
    if (selectedAssessments.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    const exportData = selectedAssessments.map(assessment => {
      const patient = patients.find(p => p.院友id === assessment.patient_id);
      return {
        床號: patient?.床號 || '',
        中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
        評估日期: new Date(assessment.assessment_date).toLocaleDateString('zh-TW'),
        下次評估日期: assessment.next_due_date ? new Date(assessment.next_due_date).toLocaleDateString('zh-TW') : '',
        評估人員: assessment.assessor || '',
        吸煙習慣: assessment.smoking_habit || '',
        飲酒習慣: assessment.drinking_habit || '',
        最高活動能力: assessment.daily_activities?.max_activity || '',
        情緒表現: assessment.emotional_expression || '',
        備註: assessment.remarks || '',
        建立日期: new Date(assessment.created_at).toLocaleDateString('zh-TW')
      };
    });

    const headers = ['床號', '中文姓名', '評估日期', '下次評估日期', '評估人員', '吸煙習慣', '飲酒習慣', '最高活動能力', '情緒表現', '備註', '建立日期'];
    const csvContent = [
      `"健康評估記錄"`,
      `"生成日期: ${new Date().toLocaleDateString('zh-TW')}"`,
      `"總記錄數: ${exportData.length}"`,
      '',
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `健康評估記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">健康評估</h1>
          <div className="flex items-center space-x-2">
            {selectedRows.size > 0 && (
              <button
                onClick={handleExportSelected}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出選定記錄</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedAssessment(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增健康評估</span>
            </button>
          </div>
        </div>
      </div>

      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、評估人員或備註..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary flex items-center space-x-2 ${
                    showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''
                  } ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                  {hasAdvancedFilters() && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                      已套用
                    </span>
                  )}
                </button>
                
                {(searchTerm || hasAdvancedFilters()) && (
                  <button
                    onClick={clearFilters}
                    className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                    <span>清除</span>
                  </button>
                )}
              </div>
            </div>
          
            {showAdvancedFilters && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">進階篩選</h3>
                
                <div className="mb-4">
                  <label className="form-label">評估日期區間</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={advancedFilters.startDate}
                      onChange={(e) => updateAdvancedFilter('startDate', e.target.value)}
                      className="form-input"
                      placeholder="開始日期"
                    />
                    <span className="text-gray-500">至</span>
                    <input
                      type="date"
                      value={advancedFilters.endDate}
                      onChange={(e) => updateAdvancedFilter('endDate', e.target.value)}
                      className="form-input"
                      placeholder="結束日期"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">床號</label>
                    <input
                      type="text"
                      value={advancedFilters.床號}
                      onChange={(e) => updateAdvancedFilter('床號', e.target.value)}
                      className="form-input"
                      placeholder="搜索床號..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">中文姓名</label>
                    <input
                      type="text"
                      value={advancedFilters.中文姓名}
                      onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)}
                      className="form-input"
                      placeholder="搜索姓名..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">評估人員</label>
                    <input
                      list="assessor-options"
                      value={advancedFilters.評估人員}
                      onChange={(e) => updateAdvancedFilter('評估人員', e.target.value)}
                      className="form-input"
                      placeholder="選擇或輸入評估人員..."
                    />
                    <datalist id="assessor-options">
                      {getUniqueOptions('評估人員').map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div>
                    <label className="form-label">吸煙習慣</label>
                    <select
                      value={advancedFilters.吸煙習慣}
                      onChange={(e) => updateAdvancedFilter('吸煙習慣', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有習慣</option>
                      <option value="從不">從不</option>
                      <option value="已戒年">已戒年</option>
                      <option value="每天吸">每天吸</option>
                      <option value="間中吸">間中吸</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">飲酒習慣</label>
                    <select
                      value={advancedFilters.飲酒習慣}
                      onChange={(e) => updateAdvancedFilter('飲酒習慣', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有習慣</option>
                      <option value="從不">從不</option>
                      <option value="已戒年">已戒年</option>
                      <option value="每天飲">每天飲</option>
                      <option value="間中飲">間中飲</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">最高活動能力</label>
                    <select
                      value={advancedFilters.最高活動能力}
                      onChange={(e) => updateAdvancedFilter('最高活動能力', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有能力</option>
                      <option value="完全獨立">完全獨立</option>
                      <option value="協助步行">協助步行</option>
                      <option value="輪椅">輪椅</option>
                      <option value="坐椅">坐椅</option>
                      <option value="臥床">臥床</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">情緒表現</label>
                    <select
                      value={advancedFilters.情緒表現}
                      onChange={(e) => updateAdvancedFilter('情緒表現', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有表現</option>
                      <option value="喜樂">喜樂</option>
                      <option value="平靜">平靜</option>
                      <option value="冷漠">冷漠</option>
                      <option value="抑鬱">抑鬱</option>
                      <option value="激動">激動</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">在住狀態</label>
                    <select
                      value={advancedFilters.在住狀態}
                      onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="在住">在住</option>
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                      <option value="">全部</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">記錄狀態</label>
                    <select
                      value={advancedFilters.記錄狀態}
                      onChange={(e) => updateAdvancedFilter('記錄狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="生效中">生效中</option>
                      <option value="歷史記錄">歷史記錄</option>
                      <option value="">全部</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆健康評估 (共 {healthAssessments.length} 筆)</span>
              {(searchTerm || hasAdvancedFilters()) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="sticky top-40 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={expandAll}
                  className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-1"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>全部展開</span>
                </button>
                <button
                  onClick={collapseAll}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium flex items-center space-x-1"
                >
                  <ChevronUp className="h-4 w-4" />
                  <span>全部收合</span>
                </button>
                <div className="border-l border-gray-300 h-6"></div>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedAssessments.length && paginatedAssessments.length > 0 ? '取消全選' : '全選'}
                </button>
                <button
                  onClick={handleInvertSelection}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                    disabled={deletingIds.size > 0}
                  >
                    刪除選定記錄 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 筆記錄 | 共 {groupedAssessments.length} 位院友
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {paginatedAssessments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedAssessments.length && paginatedAssessments.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    展開
                  </th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="assessment_date">評估日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    下次評估日期
                  </th>
                  <SortableHeader field="assessor">評估人員</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    到期狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    記錄狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    吸煙習慣
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    飲酒習慣
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最高活動能力
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    情緒表現
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    備註
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedGroups.map(group => {
                  const isExpanded = expandedPatients.has(group.patientId);
                  const isFullySelected = isPatientFullySelected(group);
                  const isPartiallySelected = isPatientPartiallySelected(group);

                  return (
                    <React.Fragment key={`group-${group.patientId}`}>
                      {/* 院友分組標題行 */}
                      <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-y-2 border-blue-200 hover:from-blue-100 hover:to-blue-150 transition-all">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isFullySelected}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = isPartiallySelected;
                              }
                            }}
                            onChange={() => togglePatientSelection(group)}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePatientExpand(group.patientId)}
                            className="p-1 hover:bg-blue-200 rounded-lg transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-blue-700" />
                            ) : (
                              <ChevronUp className="h-5 w-5 text-blue-700" />
                            )}
                          </button>
                        </td>
                        <td colSpan={12} className="px-4 py-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-blue-200 rounded-full overflow-hidden flex items-center justify-center ring-2 ring-blue-300">
                                {group.patient.院友相片 ? (
                                  <img
                                    src={group.patient.院友相片}
                                    alt={group.patient.中文姓名}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6 text-blue-700" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-base font-bold text-blue-900">
                                    {group.patient.中文姓名}
                                  </span>
                                  <span className="text-sm text-blue-700 bg-blue-200 px-2 py-0.5 rounded-full">
                                    {group.patient.床號}
                                  </span>
                                </div>
                                <div className="text-xs text-blue-700">
                                  {getFormattedEnglishName(group.patient.英文姓氏, group.patient.英文名字)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="text-blue-800 font-medium">
                                共 {group.assessments.length} 筆評估記錄
                              </span>
                              {isPartiallySelected || isFullySelected ? (
                                <span className="text-blue-700 bg-blue-200 px-3 py-1 rounded-full">
                                  已選 {group.assessments.filter(a => selectedRows.has(a.id)).length} 筆
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* 展開時顯示該院友的所有評估記錄 */}
                      {isExpanded && group.assessments.map((assessment, index) => (
                        <tr
                          key={assessment.id}
                          className={`hover:bg-gray-50 ${selectedRows.has(assessment.id) ? 'bg-blue-50' : ''} ${index === group.assessments.length - 1 ? 'border-b-2 border-blue-100' : ''}`}
                          onDoubleClick={() => handleEdit(assessment)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(assessment.id)}
                              onChange={() => handleSelectRow(assessment.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-gray-500 pl-4">
                              記錄 #{index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>{new Date(assessment.assessment_date).toLocaleDateString('zh-TW')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {assessment.next_due_date ? (
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className={
                                  isHealthAssessmentOverdue(assessment) ? 'text-red-600 font-medium' :
                                  isHealthAssessmentDueSoon(assessment) ? 'text-orange-600 font-medium' : ''
                                }>
                                  {new Date(assessment.next_due_date).toLocaleDateString('zh-TW')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {assessment.assessor || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(() => {
                              if (isHealthAssessmentOverdue(assessment)) {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    逾期
                                  </span>
                                );
                              } else if (isHealthAssessmentDueSoon(assessment)) {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    <Clock className="h-3 w-3 mr-1" />
                                    即將到期
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    有效
                                  </span>
                                );
                              }
                            })()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              assessment.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {assessment.status === 'active' ? '生效中' : '已歸檔'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {assessment.smoking_habit || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {assessment.drinking_habit || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {assessment.daily_activities?.max_activity || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {Array.isArray(assessment.emotional_expression)
                              ? assessment.emotional_expression.join('、')
                              : (assessment.emotional_expression || '-')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                            <div className="truncate" title={assessment.remarks || ''}>
                              {assessment.remarks || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveAs(assessment)}
                                className="text-green-600 hover:text-green-900"
                                title="另存新檔"
                                disabled={deletingIds.has(assessment.id)}
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(assessment)}
                                className="text-blue-600 hover:text-blue-900"
                                title="編輯"
                                disabled={deletingIds.has(assessment.id)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(assessment.id)}
                                className="text-red-600 hover:text-red-900"
                                title="刪除"
                                disabled={deletingIds.has(assessment.id)}
                              >
                                {deletingIds.has(assessment.id) ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Heart className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的健康評估' : '暫無健康評估'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立健康評估'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增健康評估
              </button>
            ) : (
              <button
                onClick={clearFilters}
                className="btn-secondary"
              >
                清除所有篩選
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">每頁顯示:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="form-input text-sm w-20"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={150}>150</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={999999}>全部</option>
              </select>
              <span className="text-sm text-gray-700">筆記錄</span>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>
                
                {generatePageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                </button>
              </div>
            )}
            
            <div className="text-sm text-gray-700">
              第 {currentPage} 頁，共 {totalPages} 頁
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <HealthAssessmentModal
          assessment={selectedAssessment}
          onClose={() => {
            setShowModal(false);
            setSelectedAssessment(null);
          }}
        />
      )}
    </div>
  );
};

export default HealthAssessments;