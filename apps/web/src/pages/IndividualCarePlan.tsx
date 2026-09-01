import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Download,
  User,
  Users,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  Clock,
  CheckCircle,
  Copy,
  History,
  AlertCircle,
  BookOpen,
  Printer,
} from 'lucide-react';
import { usePatientData, useFilteredPatients, type CarePlan, type PlanType } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import CarePlanModal from '../components/CarePlanModal';
import ProblemLibraryModal from '../components/ProblemLibraryModal';
import CaseConferenceListModal from '../components/CaseConferenceListModal';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import { useAuth } from '../context/AuthContext';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, compareBedNumbers, matchPatientBedNumber} from '../utils/searchUtils';
import { getCarePlanStatus, getCarePlanStatusColor, getCarePlanStatusLabel } from '../utils/carePlanStatus';
import { formatDisplayDate } from '../utils/dateFormat';
import { printCarePlanById } from '../utils/carePlanPrintGenerator';
import DateInput from '../components/DateInput';


type SortField = '院友姓名' | 'plan_date' | 'plan_type' | 'review_due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  計劃類型: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
  記錄狀態: string;
}

const IndividualCarePlan: React.FC = () => {
  const { carePlans, deleteCarePlan, duplicateCarePlan, loading, getCarePlanWithDetails } = usePatientData();
  const patients = useFilteredPatients();
  const { displayName } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showProblemLibraryModal, setShowProblemLibraryModal] = useState(false);
  const [showConferenceModal, setShowConferenceModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('plan_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    計劃類型: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住',
    記錄狀態: '生效中'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [planReviewStatus, setPlanReviewStatus] = useState<Map<string, { 
    reviewed: number; 
    total: number;
    problemsByCategory: Record<string, number>;
  }>>(new Map());

  // 載入計劃的檢討狀態和問題分類
  React.useEffect(() => {
    const loadReviewStatus = async () => {
      const statusMap = new Map<string, { 
        reviewed: number; 
        total: number; 
        problemsByCategory: Record<string, number>;
      }>();
      
      for (const plan of carePlans) {
        try {
          const details = await getCarePlanWithDetails(plan.id);
          if (details && details.problems) {
            const total = details.problems.length;
            const reviewed = details.problems.filter(p => p.outcome_review).length;
            
            // 計算各專業問題數目
            const problemsByCategory: Record<string, number> = {};
            details.problems.forEach(p => {
              if (!problemsByCategory[p.problem_category]) {
                problemsByCategory[p.problem_category] = 0;
              }
              problemsByCategory[p.problem_category]++;
            });
            
            statusMap.set(plan.id, { reviewed, total, problemsByCategory });
          }
        } catch (error) {
          console.error(`載入計劃 ${plan.id} 的檢討狀態失敗:`, error);
        }
      }
      
      setPlanReviewStatus(statusMap);
    };
    
    if (carePlans.length > 0) {
      loadReviewStatus();
    }
  }, [carePlans, getCarePlanWithDetails]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="個人照顧計劃" />;
  }

  const filteredPlans = useMemo(() => {
    const searchTerm = deferredSearch;
    return (carePlans || []).filter(plan => {
    const patient = patients.find(p => p.院友id === plan.patient_id);

    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }

    // 記錄狀態篩選（使用計算後狀態）
    if (advancedFilters.記錄狀態 && advancedFilters.記錄狀態 !== '全部') {
      const computedStatus = getCarePlanStatus(plan);
      if (computedStatus !== advancedFilters.記錄狀態) {
        return false;
      }
    }

    // 計劃類型篩選
    if (advancedFilters.計劃類型 && advancedFilters.計劃類型 !== '全部' && plan.plan_type !== advancedFilters.計劃類型) {
      return false;
    }

    if (advancedFilters.床號 && !matchPatientBedNumber(patient, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    
    // 日期區間篩選
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const planDate = new Date(plan.plan_date);
      if (advancedFilters.startDate && planDate < new Date(advancedFilters.startDate)) {
        return false;
      }
      if (advancedFilters.endDate && planDate > new Date(advancedFilters.endDate)) {
        return false;
      }
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
                         fuzzyMatch(patient?.身份證號碼, searchTerm) ||
                         matchPatientBedNumber(patient, searchTerm) ||
                         fuzzyMatch(plan.created_by, searchTerm) ||
                         fuzzyMatch(plan.remarks, searchTerm) ||
                         false;
    }
    
    return matchesSearch;
    });
  }, [carePlans, patients, advancedFilters, deferredSearch]);

  const hasAdvancedFilters = () => {
    return advancedFilters.床號 !== '' || 
           advancedFilters.中文姓名 !== '' || 
           advancedFilters.計劃類型 !== '' ||
           advancedFilters.startDate !== '' || 
           advancedFilters.endDate !== '' ||
           (advancedFilters.在住狀態 !== '' && advancedFilters.在住狀態 !== '在住') ||
           (advancedFilters.記錄狀態 !== '' && advancedFilters.記錄狀態 !== '生效中');
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
      計劃類型: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住',
      記錄狀態: '生效中'
    });
  };

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);

    let valueA: string | number = '';
    let valueB: string | number = '';

    switch (sortField) {
      case '院友姓名': {
        const bedCmp = compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
        return sortDirection === 'asc' ? bedCmp : -bedCmp;
      }
      case 'plan_date':
        valueA = new Date(a.plan_date).getTime();
        valueB = new Date(b.plan_date).getTime();
        break;
      case 'plan_type':
        valueA = a.plan_type;
        valueB = b.plan_type;
        break;
      case 'review_due_date':
        valueA = a.review_due_date ? new Date(a.review_due_date).getTime() : 0;
        valueB = b.review_due_date ? new Date(b.review_due_date).getTime() : 0;
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
    plans: CarePlan[];
  }

  const groupedPlans: PatientGroup[] = [];
  const patientMap = new Map<number, PatientGroup>();

  sortedPlans.forEach(plan => {
    const patient = patients.find(p => p.院友id === plan.patient_id);
    if (!patient) return;

    if (!patientMap.has(plan.patient_id)) {
      const group: PatientGroup = {
        patientId: plan.patient_id,
        patient: patient,
        plans: []
      };
      patientMap.set(plan.patient_id, group);
      groupedPlans.push(group);
    }
    patientMap.get(plan.patient_id)!.plans.push(plan);
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
    const allPatientIds = groupedPlans.map(g => g.patientId);
    setExpandedPatients(new Set(allPatientIds));
  };

  // 全部收合
  const collapseAll = () => {
    setExpandedPatients(new Set());
  };

  // Pagination logic
  const totalItems = sortedPlans.length;
  const totalPages = Math.ceil(groupedPlans.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedPlans.slice(startIndex, endIndex);
  const paginatedPlans = paginatedGroups.flatMap(g => g.plans);

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

  const handleEdit = (plan: CarePlan) => {
    setSelectedPlan(plan);
    setIsDuplicateMode(false);
    setShowModal(true);
  };

  const handleDuplicate = async (plan: CarePlan) => {
    // 直接打開modal，讓使用者在modal中選擇計劃類型
    setSelectedPlan(plan);
    setIsDuplicateMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const plan = carePlans.find(p => p.id === id);
    const patient = patients.find(p => p.院友id === plan?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 在 ${plan?.plan_date} 的個人照顧計劃嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteCarePlan(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除計劃失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const handlePrint = async (plan: CarePlan) => {
    const patient = patients.find(p => p.院友id === plan.patient_id);
    if (!patient) {
      alert('找不到院友資料，無法列印');
      return;
    }
    try {
      await printCarePlanById(patient, plan.id, getCarePlanWithDetails);
    } catch (error) {
      console.error('列印個人照顧計劃失敗:', error);
      alert('列印失敗，請重試');
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
    if (selectedRows.size === paginatedPlans.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedPlans.map(p => p.id)));
    }
  };

  const getPlanTypeColor = (planType: PlanType) => {
    switch (planType) {
      case '首月計劃':
        return 'bg-green-100 text-green-800';
      case '半年計劃':
        return 'bg-blue-100 text-blue-800';
      case '年度計劃':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (plan: CarePlan, patientId: number) => {
    if (!plan.review_due_date) return false;
    
    // 檢查是否有後續計劃銜接此計劃的復檢到期日
    const patientPlans = carePlans
      .filter(p => p.patient_id === patientId)
      .sort((a, b) => new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime());
    
    const currentIndex = patientPlans.findIndex(p => p.id === plan.id);
    if (currentIndex !== -1 && currentIndex < patientPlans.length - 1) {
      // 有後續計劃，檢查後續計劃的計劃日期是否已銜接或超過此計劃的復檢到期日
      const nextPlan = patientPlans[currentIndex + 1];
      if (nextPlan && new Date(nextPlan.plan_date) >= new Date(plan.review_due_date)) {
        // 已被後續計劃銜接，不算逾期
        return false;
      }
    }
    
    // 檢查是否真的逾期（只有最新計劃或未被銜接的計劃才檢查）
    return new Date(plan.review_due_date) < new Date();
  };

  const isDueSoon = (plan: CarePlan, patientId: number) => {
    if (!plan.review_due_date) return false;
    
    // 檢查是否有後續計劃銜接此計劃的復檢到期日
    const patientPlans = carePlans
      .filter(p => p.patient_id === patientId)
      .sort((a, b) => new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime());
    
    const currentIndex = patientPlans.findIndex(p => p.id === plan.id);
    if (currentIndex !== -1 && currentIndex < patientPlans.length - 1) {
      // 有後續計劃，檢查後續計劃的計劃日期是否已銜接或超過此計劃的復檢到期日
      const nextPlan = patientPlans[currentIndex + 1];
      if (nextPlan && new Date(nextPlan.plan_date) >= new Date(plan.review_due_date)) {
        // 已被後續計劃銜接，不算即將到期
        return false;
      }
    }
    
    const dueDate = new Date(plan.review_due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue > 0 && daysUntilDue <= 30;
  };

  const renderReviewMeetingSummary = (plan: CarePlan, status: ReturnType<typeof getCarePlanStatus>) => {
    const reviewStatus = planReviewStatus.get(plan.id);
    const pending = reviewStatus ? reviewStatus.total - reviewStatus.reviewed : 0;

    // 檢討狀態標籤
    const reviewBadge = !reviewStatus || reviewStatus.total === 0 ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">無問題</span>
    ) : pending > 0 ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">{pending}個待檢討</span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">已檢討</span>
    );

    // 會議狀態標籤
    const meetingBadge = plan.case_conference_date ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">會議已填</span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">會議未填</span>
    );

    if (status === '已完成') {
      return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCarePlanStatusColor(status)}`}>已完成</span>;
    }
    if (status === '待生效') {
      return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCarePlanStatusColor(status)}`}>待生效</span>;
    }
    if (status === '待檢討') {
      // 「待處理」由檢討 + 會議兩個標籤並排表示
      return (
        <div className="flex flex-wrap gap-1">
          {reviewBadge}
          {meetingBadge}
        </div>
      );
    }
    // 生效中：保留狀態標籤，下方可輔以簡短提示
    return (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCarePlanStatusColor(status)}`}>生效中</span>
        {!plan.case_conference_date && (
          <span className="text-xs text-gray-500">會議未填</span>
        )}
      </div>
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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">個人照顧計劃</h1>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRows.size > 0 && (
              <button
                onClick={() => {}}
                className="btn-secondary flex flex-wrap items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出選定記錄</span>
              </button>
            )}
            <button
              onClick={() => setShowConferenceModal(true)}
              className="btn-secondary flex flex-wrap items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>個案會議名單</span>
            </button>
            <button
              onClick={() => setShowProblemLibraryModal(true)}
              className="btn-secondary flex flex-wrap items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              <span>問題庫</span>
            </button>
            <button
              onClick={() => {
                setSelectedPlan(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增計劃</span>
            </button>
          </div>
        </div>

        {/* 搜尋和篩選 */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索院友姓名、床號或備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`btn-secondary flex flex-wrap items-center gap-2 ${
              showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''
            } ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
          >
            <Filter className="h-4 w-4" />
            <span>進階篩選</span>
            {hasAdvancedFilters() && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
            )}
          </button>

          {hasAdvancedFilters() && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-red-600 hover:text-red-700"
            >
              清除篩選
            </button>
          )}
        </div>

        {/* 進階篩選面板 */}
        {showAdvancedFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">床號</label>
                <input
                  type="text"
                  value={advancedFilters.床號}
                  onChange={(e) => updateAdvancedFilter('床號', e.target.value)}
                  className="form-input"
                  placeholder="輸入床號"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">中文姓名</label>
                <input
                  type="text"
                  value={advancedFilters.中文姓名}
                  onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)}
                  className="form-input"
                  placeholder="輸入姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">計劃類型</label>
                <select
                  value={advancedFilters.計劃類型}
                  onChange={(e) => updateAdvancedFilter('計劃類型', e.target.value)}
                  className="form-input"
                >
                  <option value="">全部</option>
                  <option value="首月計劃">首月計劃</option>
                  <option value="半年計劃">半年計劃</option>
                  <option value="年度計劃">年度計劃</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">在住狀態</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">記錄狀態</label>
                <select
                  value={advancedFilters.記錄狀態}
                  onChange={(e) => updateAdvancedFilter('記錄狀態', e.target.value)}
                  className="form-input"
                >
                  <option value="生效中">生效中</option>
                  <option value="待檢討">待處理</option>
                  <option value="已完成">已完成</option>
                  <option value="待生效">待生效</option>
                  <option value="全部">全部</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                <DateInput value={advancedFilters.startDate}
                  onChange={(value) => updateAdvancedFilter('startDate', value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                <DateInput value={advancedFilters.endDate}
                  onChange={(value) => updateAdvancedFilter('endDate', value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 統計摘要 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
        <div className="flex flex-wrap items-center gap-4">
          <span>共 {groupedPlans.length} 位院友，{totalItems} 份計劃</span>
          {selectedRows.size > 0 && (
            <span className="text-blue-600">已選擇 {selectedRows.size} 筆</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={expandAll} className="text-blue-600 hover:text-blue-800">全部展開</button>
          <span>|</span>
          <button onClick={collapseAll} className="text-blue-600 hover:text-blue-800">全部收合</button>
        </div>
      </div>

      {/* 主表格 */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[768px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedPlans.length && paginatedPlans.length > 0}
                    onChange={handleSelectAll}
                    className="form-checkbox"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  展開
                </th>
                <SortableHeader field="院友姓名">院友資訊</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入住日期</th>
                <SortableHeader field="plan_type">計劃類型</SortableHeader>
                <SortableHeader field="plan_date">計劃日期</SortableHeader>
                <SortableHeader field="review_due_date">復檢到期日</SortableHeader>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">護理</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">社工</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">物理治療</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">職業治療</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">言語治療</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">營養師</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">醫生</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">建立日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">檢討/會議</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">暫無個人照顧計劃</p>
                    <p className="text-sm mt-1">點擊「新增計劃」開始建立</p>
                  </td>
                </tr>
              ) : (
                paginatedGroups.map(group => {
                  const isExpanded = expandedPatients.has(group.patientId);
                  const displayPlans = isExpanded ? group.plans : group.plans.slice(0, 1);
                  
                  return displayPlans.map((plan, planIndex) => {
                    const status = getCarePlanStatus(plan);
                    return (
                    <tr 
                      key={plan.id}
                      className={`hover:bg-blue-50 ${deletingIds.has(plan.id) ? 'opacity-50' : ''} ${duplicatingId === plan.id ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(plan)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(plan.id)}
                          onChange={() => handleSelectRow(plan.id)}
                          className="form-checkbox"
                        />
                      </td>
                      {planIndex === 0 && (
                        <>
                          <td 
                            className="px-4 py-3 cursor-pointer"
                            rowSpan={displayPlans.length}
                            onClick={() => togglePatientExpand(group.patientId)}
                          >
                            {group.plans.length > 1 && (
                              <div className="flex items-center text-gray-500 hover:text-blue-600">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="text-xs ml-1">{group.plans.length}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3" rowSpan={displayPlans.length}>
                            <PatientTooltip patient={group.patient}>
                              <div className="flex flex-wrap items-center gap-2 cursor-help hover:opacity-80 transition-opacity">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center">
                                  {group.patient.院友相片 ? (
                                    <img
                                      src={group.patient.院友相片}
                                      alt={group.patient.中文姓名}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{group.patient.中文姓名}</div>
                                  <div className="text-xs text-gray-500"><BedNumberImprint patient={group.patient as any} size="sm" /></div>
                                </div>
                              </div>
                            </PatientTooltip>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500" rowSpan={displayPlans.length}>
                            {group.patient.入住日期 ? formatDisplayDate(group.patient.入住日期) : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanTypeColor(plan.plan_type)}`}>
                          {plan.plan_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDisplayDate(plan.plan_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {plan.review_due_date ? (
                          <div className={`flex items-center space-x-1 ${
                            isOverdue(plan, group.patient.院友id) ? 'text-red-600' : 
                            isDueSoon(plan, group.patient.院友id) ? 'text-amber-600' : 'text-gray-900'
                          }`}>
                            {isOverdue(plan, group.patient.院友id) && <AlertCircle className="h-4 w-4" />}
                            {isDueSoon(plan, group.patient.院友id) && !isOverdue(plan, group.patient.院友id) && <Clock className="h-4 w-4" />}
                            <span>{formatDisplayDate(plan.review_due_date)}</span>
                            {plan.reviewed_at && <CheckCircle className="h-4 w-4 text-green-500" />}
                          </div>
                        ) : '-'}
                      </td>
                      {/* 各專業問題數目欄位 */}
                      {['護理', '社工', '物理治療', '職業治療', '言語治療', '營養師', '醫生'].map(category => {
                        const reviewStatus = planReviewStatus.get(plan.id);
                        const count = reviewStatus?.problemsByCategory?.[category] || 0;
                        return (
                          <td key={category} className="px-4 py-3 text-sm text-center">
                            {count > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                {count}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">無</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-sm text-gray-500">{plan.created_at ? formatDisplayDate(plan.created_at) : '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {renderReviewMeetingSummary(plan, status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleEdit(plan)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(plan)}
                            className="text-purple-600 hover:text-purple-900"
                            title="列印"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(plan)}
                            className="text-green-600 hover:text-green-900"
                            title="複製為復檢計劃"
                            disabled={duplicatingId === plan.id}
                          >
                            {duplicatingId === plan.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(plan.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">每頁顯示</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="form-input py-1 px-2 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">筆</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              首頁
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              上一頁
            </button>
            
            {generatePageNumbers().map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 text-sm rounded ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              下一頁
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              末頁
            </button>
          </div>
          
          <div className="text-sm text-gray-700">
            第 {currentPage} / {totalPages} 頁
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CarePlanModal
          plan={selectedPlan}
          isDuplicate={isDuplicateMode}
          onClose={() => {
            setShowModal(false);
            setSelectedPlan(null);
            setIsDuplicateMode(false);
          }}
        />
      )}

      {/* 個案會議名單 Modal */}
      {showConferenceModal && (
        <CaseConferenceListModal
          isOpen={showConferenceModal}
          onClose={() => setShowConferenceModal(false)}
          carePlans={carePlans}
          patients={patients}
        />
      )}

      {/* 問題庫 Modal */}
      <ProblemLibraryModal
        isOpen={showProblemLibraryModal}
        onClose={() => setShowProblemLibraryModal(false)}
      />
    </div>
  );
};

export default IndividualCarePlan;
