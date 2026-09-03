import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  HeartHandshake,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  Ban
} from 'lucide-react';
import { usePatientData, useFilteredPatients, type PatientEveningCarePlan } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import EveningCarePlanModal from '../components/EveningCarePlanModal';
import { fuzzyMatch, matchChineseName, matchEnglishName , compareBedNumbers, matchPatientBedNumber} from '../utils/searchUtils';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import { formatDisplayDate } from '../utils/dateFormat';
import DateInput from '../components/DateInput';


type SortField = '院友姓名' | 'earliest_due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  has_documents: string;
  is_overdue: string;
  is_terminated: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const EveningCarePlanManagement: React.FC = () => {
  const { patientEveningCarePlans, deletePatientEveningCarePlan, updatePatientEveningCarePlan, loading } = usePatientData();
  const patients = useFilteredPatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PatientEveningCarePlan | null>(null);
  const [renewFromPlan, setRenewFromPlan] = useState<PatientEveningCarePlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('earliest_due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    has_documents: '',
    is_overdue: '',
    is_terminated: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="晚晴計劃" />;
  }

  const planDates = (plan: PatientEveningCarePlan): (string | undefined)[] =>
    [plan.acp_date, plan.amd_date, plan.dnacpr_date];

  const hasDocuments = (plan: PatientEveningCarePlan): boolean =>
    planDates(plan).some(d => !!d);

  // 最早到期日 = 三個日期中最早者
  const earliestDate = (plan: PatientEveningCarePlan): number => {
    const times = planDates(plan)
      .filter((d): d is string => !!d)
      .map(d => new Date(d).getTime());
    return times.length ? Math.min(...times) : 0;
  };

  const isDateOverdue = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const today = new Date();
    const dueDate = new Date(dateStr);
    return dueDate < today;
  };

  const isDateDueSoon = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const today = new Date();
    const dueDate = new Date(dateStr);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30 && daysDiff > 0;
  };

  // 記錄層級逾期（任一日逾期）
  const isOverdue = (plan: PatientEveningCarePlan): boolean =>
    planDates(plan).some(d => isDateOverdue(d));

  const isDueSoon = (plan: PatientEveningCarePlan): boolean =>
    planDates(plan).some(d => isDateDueSoon(d));

  const filteredPlans = useMemo(() => {
    const searchTerm = deferredSearch;
    return patientEveningCarePlans.filter(plan => {
    const patient = patients.find(p => p.院友id === plan.patient_id);

    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    // 終止：預設隱藏已終止；篩選器選「是」只顯示已終止
    if (advancedFilters.is_terminated === '是') {
      if (!plan.is_terminated) return false;
    } else {
      if (plan.is_terminated) return false;
    }
    if (advancedFilters.床號 && !matchPatientBedNumber(patient, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.has_documents) {
      const hasDocs = hasDocuments(plan);
      if (advancedFilters.has_documents === '是' && !hasDocs) return false;
      if (advancedFilters.has_documents === '否' && hasDocs) return false;
    }
    if (advancedFilters.is_overdue) {
      const overdue = isOverdue(plan);
      if (advancedFilters.is_overdue === '是' && !overdue) return false;
      if (advancedFilters.is_overdue === '否' && overdue) return false;
    }

    // 日期區間篩選（任一文件日期落入區間即算）
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const inRange = planDates(plan).some(d => {
        if (!d) return false;
        const date = new Date(d);
        if (advancedFilters.startDate && date < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && date > new Date(advancedFilters.endDate)) {
          return false;
        }
        return true;
      });
      if (!inRange) return false;
    }

    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
                         fuzzyMatch(patient?.身份證號碼, searchTerm) ||
                         matchPatientBedNumber(patient, searchTerm) ||
                         fuzzyMatch(plan.notes, searchTerm);
    }

    return matchesSearch;
    });
  }, [patientEveningCarePlans, patients, advancedFilters, deferredSearch]);

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
      has_documents: '',
      is_overdue: '',
      is_terminated: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  // 依 patient_id 分組，組內依最早到期日 desc 排列（最新記錄在前，即「當前記錄」；created_at 僅作後備）
  // 組排序以當前記錄為準，earliest_due_date 升序即自然得出最差狀態優先
  const groupedPlans = (() => {
    const map = new Map<number, PatientEveningCarePlan[]>();
    filteredPlans.forEach(p => {
      if (!map.has(p.patient_id)) map.set(p.patient_id, []);
      map.get(p.patient_id)!.push(p);
    });
    const groups = [...map.entries()].map(([patientId, plans]) => ({
      patientId,
      plans: plans.sort((a, b) => {
        const ea = earliestDate(a);
        const eb = earliestDate(b);
        if (eb !== ea) return eb - ea;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    }));
    groups.sort((a, b) => {
      const ca = a.plans[0];
      const cb = b.plans[0];
      const patientA = patients.find(p => p.院友id === a.patientId);
      const patientB = patients.find(p => p.院友id === b.patientId);
      let valueA: string | number = '';
      let valueB: string | number = '';
      switch (sortField) {
        case '院友姓名': {
          const bedCmp = compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
          return sortDirection === 'asc' ? bedCmp : -bedCmp;
        }
        case 'earliest_due_date':
          valueA = earliestDate(ca);
          valueB = earliestDate(cb);
          break;
        case 'created_at':
          valueA = new Date(ca.created_at).getTime();
          valueB = new Date(cb.created_at).getTime();
          break;
      }
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = (valueA as string).toLowerCase();
        valueB = (valueB as string).toLowerCase();
      }
      let result: number;
      if (sortDirection === 'asc') {
        result = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        result = valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
      if (result !== 0) return result;
      // 打和後備：最早到期日較新者在前
      return earliestDate(cb) - earliestDate(ca);
    });
    return groups;
  })();
  const totalItems = groupedPlans.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedPlans.slice(startIndex, endIndex);
  const allDisplayedPlans = paginatedGroups.flatMap(g =>
    expandedPatients.has(g.patientId) ? g.plans : [g.plans[0]]
  );

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

  const handleEdit = (plan: PatientEveningCarePlan) => {
    setSelectedPlan(plan);
    setShowModal(true);
  };

  const handleTerminate = async (plan: PatientEveningCarePlan) => {
    const patient = patients.find(p => p.院友id === plan.patient_id);
    if (!confirm(`確定要終止 ${patient?.中文姓名 ?? ''} 的晚晴計劃記錄嗎？終止後不再續期，並列為已終止記錄。`)) return;
    try {
      await updatePatientEveningCarePlan({ ...plan, is_terminated: true });
    } catch (error) {
      console.error('終止晚晴計劃記錄失敗:', error);
      alert('終止失敗，請重試');
    }
  };

  const handleDelete = async (id: string) => {
    const plan = patientEveningCarePlans.find(p => p.id === id);
    const patient = patients.find(p => p.院友id === plan?.patient_id);

    if (confirm(`確定要刪除 ${patient?.中文姓名} 的晚晴計劃記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePatientEveningCarePlan(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除晚晴計劃記錄失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆晚晴計劃記錄嗎？\n\n此操作無法復原。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));

    try {
      for (const planId of deletingArray) {
        await deletePatientEveningCarePlan(planId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆晚晴計劃記錄`);
    } catch (error) {
      console.error('批量刪除晚晴計劃記錄失敗:', error);
      alert('批量刪除晚晴計劃記錄失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (planId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(planId)) {
      newSelected.delete(planId);
    } else {
      newSelected.add(planId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === allDisplayedPlans.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allDisplayedPlans.map(p => p.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    allDisplayedPlans.forEach(plan => {
      if (!selectedRows.has(plan.id)) {
        newSelected.add(plan.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const togglePatientExpand = (patientId: number) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const getStatusBadge = (plan: PatientEveningCarePlan) => {
    if (plan.is_terminated) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          <Ban className="h-3 w-3 mr-1" />
          已終止
        </span>
      );
    }
    if (!hasDocuments(plan)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FileText className="h-3 w-3 mr-1" />
          未設定
        </span>
      );
    }

    if (isOverdue(plan)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          已逾期
        </span>
      );
    }

    if (isDueSoon(plan)) {
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
        生效中
      </span>
    );
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

  const renderDateCell = (dateStr?: string) => (
    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      {dateStr ? (
        <div className="flex items-center space-x-1">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className={isDateOverdue(dateStr) ? 'text-red-600 font-medium' : isDateDueSoon(dateStr) ? 'text-orange-600 font-medium' : ''}>
            {formatDisplayDate(dateStr)}
          </span>
        </div>
      ) : (
        <span className="text-gray-500">-</span>
      )}
    </td>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">晚晴計劃管理</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedPlan(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增晚晴計劃記錄</span>
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
                  placeholder="搜索院友姓名、床號或備註..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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

                {(searchTerm || hasAdvancedFilters()) && (
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
                  <label className="form-label">日期區間（任一文件日期）</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <DateInput value={advancedFilters.startDate}
                      onChange={(value) => updateAdvancedFilter('startDate', value)}
                      className="form-input"
                      placeholder="開始日期"
                    />
                    <span className="text-gray-500">至</span>
                    <DateInput value={advancedFilters.endDate}
                      onChange={(value) => updateAdvancedFilter('endDate', value)}
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
                    <label className="form-label">文件狀態</label>
                    <select
                      value={advancedFilters.has_documents}
                      onChange={(e) => updateAdvancedFilter('has_documents', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="是">有文件</option>
                      <option value="否">無文件</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">逾期狀態</label>
                    <select
                      value={advancedFilters.is_overdue}
                      onChange={(e) => updateAdvancedFilter('is_overdue', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="是">已逾期</option>
                      <option value="否">未逾期</option>
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
                    <label className="form-label">終止狀態</label>
                    <select
                      value={advancedFilters.is_terminated}
                      onChange={(e) => updateAdvancedFilter('is_terminated', e.target.value)}
                      className="form-input"
                    >
                      <option value="">進行中</option>
                      <option value="是">已終止</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {patientEveningCarePlans.length} 筆記錄)</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === allDisplayedPlans.length && allDisplayedPlans.length > 0 ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {allDisplayedPlans.length} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 晚晴計劃記錄列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === allDisplayedPlans.length && allDisplayedPlans.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ACP 到期日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AMD 到期日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DNACPR 到期日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    備註
                  </th>
                  <SortableHeader field="created_at">建立日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroups.map(group => {
                  const patient = patients.find(p => p.院友id === group.patientId);
                  const isExpanded = expandedPatients.has(group.patientId);
                  const displayPlans = isExpanded ? group.plans : [group.plans[0]];
                  const hasMultiple = group.plans.length > 1;
                  return displayPlans.map((plan, planIndex) => (
                    <tr
                      key={plan.id}
                      className={`hover:bg-gray-50 ${selectedRows.has(plan.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(plan)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(plan.id)}
                          onChange={() => handleSelectRow(plan.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      {planIndex === 0 && (
                        <>
                          <td
                            rowSpan={displayPlans.length}
                            className="px-4 py-4 whitespace-nowrap w-10 text-center align-middle"
                            onClick={() => hasMultiple && togglePatientExpand(group.patientId)}
                            style={{ cursor: hasMultiple ? 'pointer' : 'default' }}
                          >
                            {hasMultiple && (
                              <div className="flex flex-col items-center gap-1">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                )}
                                <span className="text-xs text-blue-600 font-medium">{group.plans.length}</span>
                              </div>
                            )}
                          </td>
                          <td rowSpan={displayPlans.length} className="px-4 py-4 whitespace-nowrap align-middle">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                                {patient?.院友相片 ? (
                                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
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
                                  ) : '-'}
                                </div>
                                {patient && <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" />}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      {renderDateCell(plan.acp_date)}
                      {renderDateCell(plan.amd_date)}
                      {renderDateCell(plan.dnacpr_date)}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {planIndex === 0
                          ? getStatusBadge(plan)
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">舊記錄</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate">
                          {plan.notes || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDisplayDate(plan.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => handleEdit(plan)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(plan.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {planIndex === 0 && !plan.is_terminated && (
                            <button
                              onClick={() => {
                                setRenewFromPlan(plan);
                                setSelectedPlan(null);
                                setShowModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="另存新檔（續期）"
                              disabled={deletingIds.has(plan.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {planIndex === 0 && !plan.is_terminated && (
                            <button
                              onClick={() => handleTerminate(plan)}
                              className="text-orange-500 hover:text-orange-700"
                              title="終止（不再續期）"
                              disabled={deletingIds.has(plan.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(plan.id)}
                          >
                            {deletingIds.has(plan.id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <HeartHandshake className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的晚晴計劃記錄' : '暫無晚晴計劃記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立晚晴計劃記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增晚晴計劃記錄
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
        <EveningCarePlanModal
          plan={selectedPlan ?? undefined}
          renewFrom={renewFromPlan}
          onClose={() => {
            setShowModal(false);
            setSelectedPlan(null);
            setRenewFromPlan(null);
          }}
          onUpdate={() => {
            setShowModal(false);
            setSelectedPlan(null);
            setRenewFromPlan(null);
          }}
        />
      )}
    </div>
  );
};

export default EveningCarePlanManagement;
