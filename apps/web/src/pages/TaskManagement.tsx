import React, { useState, useMemo, useDeferredValue } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Clock,
  Calendar,
  User,
  Activity,
  Droplets,
  Scale,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  Stethoscope
} from 'lucide-react';
import { usePatientData, useFilteredPatients, type PatientHealthTask, type HealthTaskType, type FrequencyUnit } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import TaskModal from '../components/TaskModal';
import { formatFrequencyDescription, getTaskStatus, isDocumentTask, isNursingTask } from '../utils/taskScheduler';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import { SYNC_CUTOFF_DATE_STR } from '../lib/database';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';
import { formatDisplayDate } from '../utils/dateFormat';
import BedNumberImprint from '../components/BedNumberImprint';
import DateInput from '../components/DateInput';


type SortField = 'patient_name' | 'health_record_type' | 'frequency' | 'next_due_at' | 'last_completed_at' | 'notes';
type SortDirection = 'asc' | 'desc';

interface TaskFilters {
  searchTerm: string;
  filterType: 'all' | HealthTaskType;
  filterStatus: 'all' | 'overdue' | 'due_soon' | 'pending' | 'scheduled';
  床號: string;
  中文姓名: string;
  health_record_type: string;
  frequency_unit: string;
  notes: string;
  startDate: string;
  endDate: string;
  status: string;
  在住狀態: string;
}

const TaskManagement: React.FC = () => {
  const { patientHealthTasks, deletePatientHealthTask, loading, healthRecords, refreshHealthTaskData } = usePatientData();
  const patients = useFilteredPatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PatientHealthTask | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('next_due_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState<TaskFilters>({
    searchTerm: '',
    filterType: 'all',
    filterStatus: 'all',
    床號: '',
    中文姓名: '',
    health_record_type: '',
    frequency_unit: '',
    notes: '',
    startDate: '',
    endDate: '',
    status: '',
    在住狀態: '在住'
  });
  const deferredFilters = useDeferredValue(filters);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  const togglePatientExpand = (patientId: number) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  // [核心數據源] 構建 recordLookup：基於實際健康記錄的快速查找表（與主畫面 Dashboard 一致）
  const recordLookup = useMemo(() => {
    const normalizeTime = (time?: string) => time ? time.substring(0, 5) : '';
    const lookup = new Set<string>();
    healthRecords.forEach(record => {
      const normalizedTime = normalizeTime(record.記錄時間);
      if (record.任務id && record.記錄日期) {
        lookup.add(`${record.任務id}_${record.記錄日期}`);
        lookup.add(`${record.任務id}_${record.記錄日期}_${normalizedTime}`);
      }
      const patientIdStr = record.院友id?.toString() || '';
      if (patientIdStr && record.監測類型 && record.記錄日期) {
        lookup.add(`${patientIdStr}_${record.監測類型}_${record.記錄日期}`);
        lookup.add(`${patientIdStr}_${record.監測類型}_${record.記錄日期}_${normalizedTime}`);
      }
    });
    return lookup;
  }, [healthRecords]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortField, sortDirection]);

  // Memoize filtered tasks to improve performance
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return patientHealthTasks.filter(task => {
      // 過濾掉年度體檢任務
      if (task.health_record_type === '年度體檢') {
        return false;
      }
      const patient = patients.find(p => p.院友id === task.patient_id);
      const taskStatus = getTaskStatus(task, recordLookup, todayStr);
      
      // 先應用進階篩選
      if (deferredFilters.在住狀態 && deferredFilters.在住狀態 !== '全部' && patient?.在住狀態 !== deferredFilters.在住狀態) {
        return false;
      }
      if (deferredFilters.床號 && !matchBedNumber(patient?.床號, deferredFilters.床號)) {
        return false;
      }
      if (deferredFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, deferredFilters.中文姓名)) {
        return false;
      }
      if (deferredFilters.health_record_type && task.health_record_type !== deferredFilters.health_record_type) {
        return false;
      }
      if (deferredFilters.frequency_unit && task.frequency_unit !== deferredFilters.frequency_unit) {
        return false;
      }
      if (deferredFilters.notes && !fuzzyMatch(task.notes, deferredFilters.notes)) {
        return false;
      }
      if (deferredFilters.status && taskStatus !== deferredFilters.status) {
        return false;
      }
      
      // 日期區間篩選
      if (deferredFilters.startDate || deferredFilters.endDate) {
        const taskDate = new Date(task.next_due_at);
        if (deferredFilters.startDate && taskDate < new Date(deferredFilters.startDate)) {
          return false;
        }
        if (deferredFilters.endDate && taskDate > new Date(deferredFilters.endDate)) {
          return false;
        }
      }
      
      // 然後應用搜索條件
      let matchesSearch = true;
      if (deferredFilters.searchTerm) {
        matchesSearch = 
        matchBedNumber(patient?.床號, deferredFilters.searchTerm) ||
        matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, deferredFilters.searchTerm) ||
        matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, deferredFilters.searchTerm) ||
        fuzzyMatch(patient?.身份證號碼, deferredFilters.searchTerm) ||
        fuzzyMatch(task.health_record_type, deferredFilters.searchTerm) ||
        fuzzyMatch(task.notes, deferredFilters.searchTerm) ||
        fuzzyMatch(formatFrequencyDescription(task), deferredFilters.searchTerm);
      }
      
      // 類型篩選
      const matchesType = deferredFilters.filterType === 'all' || task.health_record_type === deferredFilters.filterType;
      
      // 狀態篩選
      const matchesStatus = deferredFilters.filterStatus === 'all' || taskStatus === deferredFilters.filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [patientHealthTasks, patients, deferredFilters, recordLookup]);

  // 檢查是否有進階篩選條件
  const hasAdvancedFilters = () => {
    const { searchTerm, filterType, filterStatus, ...advancedFilters } = filters;
    return Object.values(advancedFilters).some(value => value !== '');
  };

  const updateFilter = (field: keyof TaskFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      filterType: 'all',
      filterStatus: 'all',
      床號: '',
      中文姓名: '',
      health_record_type: '',
      frequency_unit: '',
      notes: '',
      startDate: '',
      endDate: '',
      status: '',
      在住狀態: '在住'
    });
  };

  // 獲取所有唯一值的選項
  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    patientHealthTasks.forEach(task => {
      let value = '';
      
      switch (field) {
        case 'frequency_unit':
          value = task.frequency_unit;
          break;
        default:
          return;
      }
      
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  // Memoize sorted tasks to improve performance
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const patientA = patients.find(p => p.院友id === a.patient_id);
      const patientB = patients.find(p => p.院友id === b.patient_id);
      
      if (deferredFilters.searchTerm) {
        const bedCmp = comparePatientsForSearch({ 床號: patientA?.床號 }, { 床號: patientB?.床號 }, deferredFilters.searchTerm);
        if (bedCmp !== 0) return bedCmp;
      }
      
      let valueA: string | number = '';
      let valueB: string | number = '';
      
      switch (sortField) {
        case 'patient_name':
          valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
          valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
          break;
        case 'health_record_type':
          valueA = a.health_record_type;
          valueB = b.health_record_type;
          break;
        case 'frequency':
          valueA = formatFrequencyDescription(a);
          valueB = formatFrequencyDescription(b);
          break;
        case 'next_due_at':
          valueA = new Date(a.next_due_at).getTime();
          valueB = new Date(b.next_due_at).getTime();
          break;
        case 'last_completed_at':
          valueA = a.last_completed_at ? new Date(a.last_completed_at).getTime() : 0;
          valueB = b.last_completed_at ? new Date(b.last_completed_at).getTime() : 0;
          break;
        case 'notes':
          valueA = a.notes || '';
          valueB = b.notes || '';
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
  }, [filteredTasks, patients, sortField, sortDirection]);

  // 按院友分組（每個 patientId 為一組，維持 sortedTasks 的排序）
  const groupedTasks = useMemo(() => {
    const seen = new Set<number>();
    const groups: { patientId: number; tasks: PatientHealthTask[] }[] = [];
    sortedTasks.forEach(t => {
      if (!seen.has(t.patient_id)) {
        seen.add(t.patient_id);
        groups.push({ patientId: t.patient_id, tasks: [t] });
      } else {
        groups.find(g => g.patientId === t.patient_id)!.tasks.push(t);
      }
    });
    return groups;
  }, [sortedTasks]);

  // Pagination logic — 按院友組計算
  const totalItems = groupedTasks.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedGroups = useMemo(() => groupedTasks.slice(startIndex, endIndex), [groupedTasks, startIndex, endIndex]);
  // 保留 paginatedTasks 供選取控制使用
  const paginatedTasks = useMemo(() => paginatedGroups.flatMap(g => g.tasks), [paginatedGroups]);

  const scheduledTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return patientHealthTasks.filter(task => getTaskStatus(task, recordLookup, todayStr) === 'scheduled');
  }, [patientHealthTasks, recordLookup]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: patientHealthTasks.length,
      overdue: patientHealthTasks.filter(task => getTaskStatus(task, recordLookup, todayStr) === 'overdue').length,
      pending: patientHealthTasks.filter(task => getTaskStatus(task, recordLookup, todayStr) === 'pending').length,
      dueSoon: patientHealthTasks.filter(task => getTaskStatus(task, recordLookup, todayStr) === 'due_soon').length,
      vitalSigns: patientHealthTasks.filter(task => task.health_record_type === '生命表徵').length,
      bloodSugar: patientHealthTasks.filter(task => task.health_record_type === '血糖控制').length,
      weight: patientHealthTasks.filter(task => task.health_record_type === '體重控制').length,
      scheduled: scheduledTasks.length
    };
  }, [patientHealthTasks, recordLookup, scheduledTasks]);

  if (loading) {
    return <LoadingScreen pageName="任務管理" />;
  }

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

  const handleEdit = (task: PatientHealthTask) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const task = patientHealthTasks.find(t => t.id === id);
    const patient = patients.find(p => p.院友id === task?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的${task?.health_record_type}任務嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePatientHealthTask(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除任務失敗，請重試');
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

    const selectedTasks = sortedTasks.filter(t => selectedRows.has(t.id));
    const confirmMessage = `確定要刪除 ${selectedRows.size} 個健康任務嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const taskId of deletingArray) {
        await deletePatientHealthTask(taskId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 個健康任務`);
    } catch (error) {
      console.error('批量刪除健康任務失敗:', error);
      alert('批量刪除健康任務失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (taskId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedTasks.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedTasks.map(t => t.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedTasks.forEach(task => {
      if (!selectedRows.has(task.id)) {
        newSelected.add(task.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const getTypeIcon = (type: HealthTaskType) => {
    switch (type) {
      case '生命表徵': return <Activity className="h-4 w-4" />;
      case '血糖控制': return <Droplets className="h-4 w-4" />;
      case '體重控制': return <Scale className="h-4 w-4" />;
      case '藥物自存同意書': return <FileText className="h-4 w-4" />;
      case '預設醫療指示': return <FileText className="h-4 w-4" />;
      default: return <CheckSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: HealthTaskType) => {
    switch (type) {
      case '生命表徵': return 'bg-blue-100 text-blue-800';
      case '血糖控制': return 'bg-red-100 text-red-800';
      case '體重控制': return 'bg-green-100 text-green-800';
      case '藥物自存同意書': return 'bg-gray-100 text-gray-800';
      case '預設醫療指示': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (task: PatientHealthTask) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const status = getTaskStatus(task, recordLookup, todayStr);
    
    switch (status) {
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            逾期
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            未完成
          </span>
        );
      case 'due_soon':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Clock className="h-3 w-3 mr-1" />
            即將到期
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <CheckSquare className="h-3 w-3 mr-1" />
            排程中
          </span>
        );
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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">任務管理</h1>
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowModal(true);
            }}
            className="btn-primary flex flex-wrap items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增任務</span>
          </button>
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
                  placeholder="搜索床號、英文姓名、身分證號碼、中文姓名、任務類型或備註..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`btn-secondary flex flex-wrap items-center gap-2 ${
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
              
              {(filters.searchTerm || filters.filterType !== 'all' || filters.filterStatus !== 'all' || hasAdvancedFilters()) && (
                <button
                  onClick={clearFilters}
                  className="btn-secondary flex flex-wrap items-center gap-2 text-red-600 hover:text-red-700"
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
                <label className="form-label">到期日期區間</label>
                <div className="flex flex-wrap items-center gap-2">
                  <DateInput value={filters.startDate}
                    onChange={(value) => updateFilter('startDate', value)}
                    className="form-input"
                    placeholder="開始日期"
                  />
                  <span className="text-gray-500">至</span>
                  <DateInput value={filters.endDate}
                    onChange={(value) => updateFilter('endDate', value)}
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
                    value={filters.床號}
                    onChange={(e) => updateFilter('床號', e.target.value)}
                    className="form-input"
                    placeholder="搜索床號..."
                  />
                </div>
                
                <div>
                  <label className="form-label">中文姓名</label>
                  <input
                    type="text"
                    value={filters.中文姓名}
                    onChange={(e) => updateFilter('中文姓名', e.target.value)} 
                    className="form-input"
                    placeholder="搜索姓名..."
                  />
                </div>
                
                <div>
                  <label className="form-label">任務類型</label>
                  <select
                    value={filters.health_record_type}
                    onChange={(e) => updateFilter('health_record_type', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有類型</option>
                    <optgroup label="監測任務">
                      <option value="生命表徵">生命表徵</option>
                      <option value="血糖控制">血糖控制</option>
                      <option value="體重控制">體重控制</option>
                    </optgroup>
                    <optgroup label="文件任務">
                      <option value="藥物自存同意書">藥物自存同意書</option>
                      <option value="預設醫療指示">預設醫療指示</option>
                    </optgroup>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">頻率單位</label>
                  <select
                    value={filters.frequency_unit}
                    onChange={(e) => updateFilter('frequency_unit', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有頻率</option>
                    <option value="daily">每日</option>
                    <option value="weekly">每週</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">狀態</label>
                  <select
                    value={filters.status}
                    onChange={(e) => updateFilter('status', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有狀態</option>
                    <option value="overdue">逾期</option>
                    <option value="pending">未完成</option>
                    <option value="due_soon">即將到期</option>
                    <option value="scheduled">排程中</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">備註</label>
                  <input
                    type="text"
                    value={filters.notes}
                    onChange={(e) => updateFilter('notes', e.target.value)}
                    className="form-input"
                    placeholder="搜索備註內容..."
                  />
                </div>
                
                <div>
                  <label className="form-label">在住狀態</label>
                  <select
                    value={filters.在住狀態}
                    onChange={(e) => updateFilter('在住狀態', e.target.value)}
                    className="form-input"
                  >
                    <option value="在住">在住</option>
                   <option value="待入住">待入住</option>
                    <option value="已退住">已退住</option>
                    <option value="全部">全部</option>
                  </select>
                </div>
                
              
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
            <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {filteredTasks.length} 個任務)</span>
            {(filters.searchTerm || filters.filterType !== 'all' || filters.filterStatus !== 'all' || hasAdvancedFilters()) && (
              <span className="text-blue-600">已套用篩選條件</span>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* 選取控制 */}
      {totalItems > 0 && (
        <div className="sticky top-44 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedTasks.length ? '取消全選' : '全選'}
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
                    刪除選定任務 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 個任務
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 任務列表 */}
      <div className="card overflow-hidden">
        {paginatedTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedTasks.length && paginatedTasks.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="patient_name">院友</SortableHeader>
                  <SortableHeader field="health_record_type">任務類型</SortableHeader>
                  <SortableHeader field="created_at">開始日期</SortableHeader>
                  <SortableHeader field="frequency">頻率</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    特定時間
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <SortableHeader field="notes">備註</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroups.map(group => {
                  const patient = patients.find(p => p.院友id === group.patientId);
                  const isExpanded = expandedPatients.has(group.patientId);
                  // 全部任務摺疊於院友列之下，未展開時不露出任何任務
                  const displayTasks = isExpanded ? group.tasks : [];
                  const todayStr = new Date().toISOString().split('T')[0];
                  const overdueCount = group.tasks.filter(t => getTaskStatus(t, recordLookup, todayStr) === 'overdue').length;
                  const pendingCount = group.tasks.filter(t => getTaskStatus(t, recordLookup, todayStr) === 'pending').length;
                  return (
                    <React.Fragment key={group.patientId}>
                      {/* 院友標題列 */}
                      <tr
                        className="bg-blue-50 hover:bg-blue-100 cursor-pointer select-none"
                        onClick={() => togglePatientExpand(group.patientId)}
                      >
                        <td className="px-4 py-3" colSpan={1}>
                          <input
                            type="checkbox"
                            checked={group.tasks.every(t => selectedRows.has(t.id))}
                            onChange={e => {
                              e.stopPropagation();
                              setSelectedRows(prev => {
                                const next = new Set(prev);
                                if (group.tasks.every(t => prev.has(t.id))) {
                                  group.tasks.forEach(t => next.delete(t.id));
                                } else {
                                  group.tasks.forEach(t => next.add(t.id));
                                }
                                return next;
                              });
                            }}
                            onClick={e => e.stopPropagation()}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" colSpan={8}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                              {patient?.院友相片 ? (
                                <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-blue-700" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {patient ? `${patient.中文姓氏}${patient.中文名字}` : '-'}
                                </span>
                                <span className="text-xs text-gray-500">{patient && <BedNumberImprint patient={patient} size="sm" className="text-xs text-gray-500" />}</span>
                                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{group.tasks.length} 個任務</span>
                                {overdueCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overdueCount} 逾期</span>}
                                {pendingCount > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{pendingCount} 待完成</span>}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-blue-600">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* 任務列 */}
                      {displayTasks.map(task => (
                        <tr
                          key={task.id}
                          className={`hover:bg-gray-50 ${selectedRows.has(task.id) ? 'bg-blue-50' : ''}`}
                          onDoubleClick={() => handleEdit(task)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap pl-8">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(task.id)}
                              onChange={() => handleSelectRow(task.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap pl-8">
                            <div className="text-xs text-gray-400 pl-2">↳</div>
                          </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(task.health_record_type)}`}>
                            {getTypeIcon(task.health_record_type)}
                            <span className="ml-1">{task.health_record_type}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.start_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{formatDisplayDate(task.start_date)}</span>
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatFrequencyDescription(task)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.specific_times && task.specific_times.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {task.specific_times.map((time, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{time}</span>
                            ))}
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(task)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {task.notes || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleEdit(task)} className="text-blue-600 hover:text-blue-900" title="編輯" disabled={deletingIds.has(task.id)}>
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="text-red-600 hover:text-red-900" title="刪除" disabled={deletingIds.has(task.id)}>
                            {deletingIds.has(task.id) ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div> : <Trash2 className="h-4 w-4" />}
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
            <CheckSquare className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filters.searchTerm || filters.filterType !== 'all' || filters.filterStatus !== 'all' || hasAdvancedFilters() ? '找不到符合條件的任務' : '暫無健康任務'}
            </h3>
            <p className="text-gray-600 mb-4">
              {filters.searchTerm || filters.filterType !== 'all' || filters.filterStatus !== 'all' || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立定期健康檢查任務'}
            </p>
            {!filters.searchTerm && filters.filterType === 'all' && filters.filterStatus === 'all' && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增任務
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
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2">
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
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
          }}
          onUpdate={refreshHealthTaskData}
        />
      )}
    </div>
  );
};

export default TaskManagement;