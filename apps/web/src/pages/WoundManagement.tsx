import React, { useState } from 'react';
import { ChevronFirst as FirstAid, Plus, Edit3, Trash2, Search, Filter, Download, User, Calendar, AlertTriangle, CheckCircle, Clock, ChevronUp, ChevronDown, X, Activity, Copy } from 'lucide-react';
import { usePatients, type WoundAssessment } from '../context/PatientContext';
import WoundAssessmentModal from '../components/WoundAssessmentModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '院友姓名' | 'assessment_date' | 'next_assessment_date' | 'stage' | 'infection' | 'assessor';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  評估者: string;
  階段: string;
  感染狀態: string;
  氣味: string;
  體溫: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
  記錄狀態: string;
}

const WoundManagement: React.FC = () => {
  const { woundAssessments, patients, deleteWoundAssessment, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<WoundAssessment | null>(null);
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
    評估者: '',
    階段: '',
    感染狀態: '',
    氣味: '',
    體溫: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住',
    記錄狀態: '生效中'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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

  const isOverdue = (assessment: WoundAssessment): boolean => {
    if (!assessment.next_assessment_date) return false;
    const today = new Date();
    const dueDate = new Date(assessment.next_assessment_date);
    return dueDate < today;
  };

  const isDueSoon = (assessment: WoundAssessment): boolean => {
    if (!assessment.next_assessment_date) return false;
    const today = new Date();
    const dueDate = new Date(assessment.next_assessment_date);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 3 && daysDiff > 0;
  };

  const filteredAssessments = woundAssessments.filter(assessment => {
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
    if (advancedFilters.評估者 && !assessment.assessor?.toLowerCase().includes(advancedFilters.評估者.toLowerCase())) {
      return false;
    }
    if (advancedFilters.階段 && assessment.stage !== advancedFilters.階段) {
      return false;
    }
    if (advancedFilters.感染狀態 && assessment.infection !== advancedFilters.感染狀態) {
      return false;
    }
    if (advancedFilters.氣味 && assessment.odor !== advancedFilters.氣味) {
      return false;
    }
    if (advancedFilters.體溫 && assessment.temperature !== advancedFilters.體溫) {
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
                         assessment.stage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      評估者: '',
      階段: '',
      感染狀態: '',
      氣味: '',
      體溫: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住',
      記錄狀態: '生效中'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    woundAssessments.forEach(assessment => {
      let value = '';
      
      switch (field) {
        case '評估者':
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
      case 'next_assessment_date':
        valueA = a.next_assessment_date ? new Date(a.next_assessment_date).getTime() : 0;
        valueB = b.next_assessment_date ? new Date(b.next_assessment_date).getTime() : 0;
        break;
      case 'stage':
        valueA = a.stage || '';
        valueB = b.stage || '';
        break;
      case 'infection':
        valueA = a.infection;
        valueB = b.infection;
        break;
      case 'assessor':
        valueA = a.assessor || '';
        valueB = b.assessor || '';
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

  // Pagination logic
  const totalItems = sortedAssessments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAssessments = sortedAssessments.slice(startIndex, endIndex);

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

  const handleEdit = (assessment: WoundAssessment) => {
    setSelectedAssessment(assessment);
    setShowModal(true);
  };

  const handleSaveAs = (assessment: WoundAssessment) => {
    // 創建一個新的評估，複製現有評估的所有資料但清除ID和評估日期
    const newAssessment = {
      ...assessment,
      id: undefined, // 清除ID以創建新記錄
      assessment_date: new Date().toISOString().split('T')[0], // 設為今天
      next_assessment_date: null, // 清除下次評估日期
      archived_at: null, // 清除封存時間
      created_at: undefined,
      updated_at: undefined
    };
    setSelectedAssessment(newAssessment);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const assessment = woundAssessments.find(a => a.id === id);
    const patient = patients.find(p => p.院友id === assessment?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 在 ${assessment?.assessment_date} 的傷口評估嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteWoundAssessment(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除傷口評估失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆傷口評估嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const assessmentId of deletingArray) {
        await deleteWoundAssessment(assessmentId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆傷口評估`);
    } catch (error) {
      console.error('批量刪除傷口評估失敗:', error);
      alert('批量刪除傷口評估失敗，請重試');
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
    const selectedAssessments = paginatedAssessments.filter(a => selectedRows.has(a.id));
    
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
        下次評估日期: assessment.next_assessment_date ? new Date(assessment.next_assessment_date).toLocaleDateString('zh-TW') : '',
        評估者: assessment.assessor || '',
        傷口位置: `${assessment.wound_location.side === 'front' ? '前側' : '後側'} (${assessment.wound_location.x}, ${assessment.wound_location.y})`,
        面積: assessment.area_length && assessment.area_width ? `${assessment.area_length} x ${assessment.area_width}${assessment.area_depth ? ` x ${assessment.area_depth}` : ''} cm` : '',
        階段: assessment.stage || '',
        相片數量: assessment.wound_photos ? assessment.wound_photos.length : 0,
        滲出物: assessment.exudate_present ? `有 (${assessment.exudate_amount || ''}, ${assessment.exudate_color || ''}, ${assessment.exudate_type || ''})` : '無',
        氣味: assessment.odor,
        肉芽: assessment.granulation,
        壞死: assessment.necrosis,
        感染: assessment.infection,
        體溫: assessment.temperature,
        周邊皮膚狀況: assessment.surrounding_skin_condition || '',
        周邊皮膚顏色: assessment.surrounding_skin_color || '',
        洗劑: assessment.cleanser === '其他' ? assessment.cleanser_other : assessment.cleanser,
        敷料: assessment.dressings.length > 0 ? assessment.dressings.join(', ') + (assessment.dressing_other ? `, ${assessment.dressing_other}` : '') : '',
        備註: assessment.remarks || '',
        建立日期: new Date(assessment.created_at).toLocaleDateString('zh-TW')
      };
    });

    const headers = ['床號', '中文姓名', '評估日期', '下次評估日期', '評估者', '傷口位置', '面積', '階段', '相片數量', '滲出物', '氣味', '肉芽', '壞死', '感染', '體溫', '周邊皮膚狀況', '周邊皮膚顏色', '洗劑', '敷料', '備註', '建立日期'];
    const csvContent = [
      `"傷口評估記錄"`,
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
    a.download = `傷口評估記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (assessment: WoundAssessment) => {
    if (isOverdue(assessment)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          逾期
        </span>
      );
    }

    if (isDueSoon(assessment)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Clock className="h-3 w-3 mr-1" />
          即將到期
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        正常
      </span>
    );
  };

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case '階段1': return 'bg-green-100 text-green-800';
      case '階段2': return 'bg-yellow-100 text-yellow-800';
      case '階段3': return 'bg-orange-100 text-orange-800';
      case '階段4': return 'bg-red-100 text-red-800';
      case '無法評估': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInfectionBadgeClass = (infection: string) => {
    switch (infection) {
      case '無': return 'bg-green-100 text-green-800';
      case '懷疑': return 'bg-yellow-100 text-yellow-800';
      case '有': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  const stats = {
    total: woundAssessments.length,
    overdue: woundAssessments.filter(a => isOverdue(a)).length,
    dueSoon: woundAssessments.filter(a => isDueSoon(a)).length,
    infected: woundAssessments.filter(a => a.infection === '有').length,
    suspected: woundAssessments.filter(a => a.infection === '懷疑').length
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">傷口管理</h1>
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
              <span>新增傷口評估</span>
            </button>
          </div>
        </div>
      </div>

    

      {/* 搜索和篩選 */}
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、評估者、階段或備註..."
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
                    <label className="form-label">評估者</label>
                    <input
                      list="assessor-options"
                      value={advancedFilters.評估者}
                      onChange={(e) => updateAdvancedFilter('評估者', e.target.value)}
                      className="form-input"
                      placeholder="選擇或輸入評估者..."
                    />
                    <datalist id="assessor-options">
                      {getUniqueOptions('評估者').map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div>
                    <label className="form-label">階段</label>
                    <select
                      value={advancedFilters.階段}
                      onChange={(e) => updateAdvancedFilter('階段', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有階段</option>
                      <option value="階段1">階段1</option>
                      <option value="階段2">階段2</option>
                      <option value="階段3">階段3</option>
                      <option value="階段4">階段4</option>
                      <option value="無法評估">無法評估</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">感染狀態</label>
                    <select
                      value={advancedFilters.感染狀態}
                      onChange={(e) => updateAdvancedFilter('感染狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="無">無感染</option>
                      <option value="懷疑">懷疑感染</option>
                      <option value="有">有感染</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">氣味</label>
                    <select
                      value={advancedFilters.氣味}
                      onChange={(e) => updateAdvancedFilter('氣味', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="無">無</option>
                      <option value="有">有</option>
                      <option value="惡臭">惡臭</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">體溫</label>
                    <select
                      value={advancedFilters.體溫}
                      onChange={(e) => updateAdvancedFilter('體溫', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="正常">正常</option>
                      <option value="上升">上升</option>
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
                      <option value="全部">全部</option>
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
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆傷口評估 (共 {woundAssessments.length} 筆)</span>
              {(searchTerm || hasAdvancedFilters()) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 選取控制 */}
      {totalItems > 0 && (
        <div className="sticky top-40 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedAssessments.length ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {totalItems} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 傷口評估列表 */}
      <div className="card overflow-hidden">
        {paginatedAssessments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedAssessments.length && paginatedAssessments.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="assessment_date">評估日期</SortableHeader>
                  <SortableHeader field="next_assessment_date">下次評估</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    傷口數目
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    相片
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    傷口狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    記錄狀態
                  </th>
                  <SortableHeader field="stage">傷口階段</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedAssessments.map(assessment => {
                  const patient = patients.find(p => p.院友id === assessment.patient_id);
                  
                  return (
                    <tr 
                      key={assessment.id} 
                      className={`hover:bg-gray-50 ${selectedRows.has(assessment.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(assessment)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(assessment.id)}
                          onChange={() => handleSelectRow(assessment.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
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
                            <div className="text-sm font-medium text-gray-900">
                              {patient ? (
                                <PatientTooltip patient={patient}>
                                  <span className="cursor-help hover:text-blue-600 transition-colors">
                                    {patient.中文姓氏}{patient.中文名字}
                                  </span>
                                </PatientTooltip>
                              ) : (
                                '-'
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{patient?.床號}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{new Date(assessment.assessment_date).toLocaleDateString('zh-TW')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assessment.next_assessment_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className={
                              isOverdue(assessment) ? 'text-red-600 font-medium' :
                              isDueSoon(assessment) ? 'text-orange-600 font-medium' : ''
                            }>
                              {new Date(assessment.next_assessment_date).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {assessment.wound_details?.length || 0} 個
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {assessment.wound_details?.reduce((total, detail) => total + (detail.wound_photos?.length || 0), 0) || 0} 張
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {assessment.wound_details && assessment.wound_details.length > 0 ? (
                            assessment.wound_details.map((detail, detailIndex) => (
                              <span key={detailIndex} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                detail.wound_status === '未處理' ? 'bg-gray-100 text-gray-800' :
                                detail.wound_status === '治療中' ? 'bg-yellow-100 text-yellow-800' :
                                detail.wound_status === '已痊癒' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {detail.wound_status || '未處理'}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          assessment.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {assessment.status === 'active' ? '生效中' : '已歸檔'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {assessment.wound_details && assessment.wound_details.length > 0 ? (
                            assessment.wound_details.map((detail, detailIndex) => (
                              <span key={detailIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageBadgeClass(detail.stage || '')}`}>
                                {detail.stage || '未評估'}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FirstAid className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的傷口評估' : '暫無傷口評估'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立傷口評估'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增傷口評估
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
        <WoundAssessmentModal
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

export default WoundManagement;