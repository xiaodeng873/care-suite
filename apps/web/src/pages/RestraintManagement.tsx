import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Shield, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Download,
  User,
  Calendar,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  Ban
} from 'lucide-react';
import { usePatients, type PatientRestraintAssessment } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import RestraintAssessmentModal from '../components/RestraintAssessmentModal';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, compareBedNumbers } from '../utils/searchUtils';
import PatientTooltip from '../components/PatientTooltip';
import { exportRestraintConsentsToExcel } from '../utils/restraintConsentExcelGenerator';
import { exportRestraintObservationsToExcel } from '../utils/restraintObservationChartExcelGenerator';
import { exportRestraintObservationsRangeHtml } from '../utils/restraintObservationHtmlExporter';
import { printRestraintConsentForms } from '../utils/restraintConsentPrintGenerator';
import { printRestraintUsageRecords } from '../utils/restraintUsageRecordPrintGenerator';
import * as db from '../lib/database';
import { formatDisplayDate } from '../utils/dateFormat';


type SortField = '院友姓名' | 'doctor_signature_date' | 'next_due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  has_signature: string;
  is_overdue: string;
  is_terminated: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const RestraintManagement: React.FC = () => {
  const { patientRestraintAssessments, patients, deletePatientRestraintAssessment, updatePatientRestraintAssessment, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<PatientRestraintAssessment | null>(null);
  const [renewFromAssessment, setRenewFromAssessment] = useState<PatientRestraintAssessment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('next_due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    has_signature: '',
    is_overdue: '',
    is_terminated: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  const [showObservationDateRangeModal, setShowObservationDateRangeModal] = useState(false);
  const [showObservationDayMappingModal, setShowObservationDayMappingModal] = useState(false);
  const [observationDateRange, setObservationDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 預設一週後
  });
  const [observationIncludeDayNumber, setObservationIncludeDayNumber] = useState(true);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="約束物品" />;
  }

  const isOverdue = (assessment: PatientRestraintAssessment): boolean => {
    if (!assessment.next_due_date) return false;
    const today = new Date();
    const dueDate = new Date(assessment.next_due_date);
    return dueDate < today;
  };

  const isDueSoon = (assessment: PatientRestraintAssessment): boolean => {
    if (!assessment.next_due_date) return false;
    const today = new Date();
    const dueDate = new Date(assessment.next_due_date);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30 && daysDiff > 0;
  };

  const filteredAssessments = useMemo(() => {
    const searchTerm = deferredSearch;
    return patientRestraintAssessments.filter(assessment => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);
    
    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    // 終止：預設隱藏已終止；篩選器選「是」只顯示已終止
    if (advancedFilters.is_terminated === '是') {
      if (!assessment.is_terminated) return false;
    } else {
      if (assessment.is_terminated) return false;
    }
    if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.has_signature) {
      const hasSignature = !!assessment.doctor_signature_date;
      if (advancedFilters.has_signature === '是' && !hasSignature) return false;
      if (advancedFilters.has_signature === '否' && hasSignature) return false;
    }
    if (advancedFilters.is_overdue) {
      const overdue = isOverdue(assessment);
      if (advancedFilters.is_overdue === '是' && !overdue) return false;
      if (advancedFilters.is_overdue === '否' && overdue) return false;
    }
    
    // 日期區間篩選
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const signatureDate = assessment.doctor_signature_date ? new Date(assessment.doctor_signature_date) : null;
      if (signatureDate) {
        if (advancedFilters.startDate && signatureDate < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && signatureDate > new Date(advancedFilters.endDate)) {
          return false;
        }
      }
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
                         fuzzyMatch(patient?.身份證號碼, searchTerm) ||
                         matchBedNumber(patient?.床號, searchTerm) ||
                         fuzzyMatch(assessment.other_restraint_notes, searchTerm);
    }
    
    return matchesSearch;
    });
  }, [patientRestraintAssessments, patients, advancedFilters, deferredSearch]);

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
      has_signature: '',
      is_overdue: '',
      is_terminated: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '院友姓名': {
        const bedCmp = compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
        return sortDirection === 'asc' ? bedCmp : -bedCmp;
      }
      case 'doctor_signature_date':
        valueA = a.doctor_signature_date ? new Date(a.doctor_signature_date).getTime() : 0;
        valueB = b.doctor_signature_date ? new Date(b.doctor_signature_date).getTime() : 0;
        break;
      case 'next_due_date':
        valueA = a.next_due_date ? new Date(a.next_due_date).getTime() : 0;
        valueB = b.next_due_date ? new Date(b.next_due_date).getTime() : 0;
        break;
      case 'created_at':
        valueA = new Date(a.created_at).getTime();
        valueB = new Date(b.created_at).getTime();
        break;
    }
    
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      valueA = (valueA as string).toLowerCase();
      valueB = (valueB as string).toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });

  // 依 patient_id 分組，組內依 created_at desc
  const groupedAssessments = (() => {
    const seen = new Set<number>();
    const groups: { patientId: number; assessments: PatientRestraintAssessment[] }[] = [];
    sortedAssessments.forEach(a => {
      if (!seen.has(a.patient_id)) {
        seen.add(a.patient_id);
        groups.push({ patientId: a.patient_id, assessments: [a] });
      } else {
        groups.find(g => g.patientId === a.patient_id)!.assessments.push(a);
      }
    });
    groups.forEach(g => g.assessments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    return groups;
  })();
  const totalItems = groupedAssessments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedAssessments.slice(startIndex, endIndex);
  const allDisplayedAssessments = paginatedGroups.flatMap(g =>
    expandedPatients.has(g.patientId) ? g.assessments : [g.assessments[0]]
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

  const handleEdit = (assessment: PatientRestraintAssessment) => {
    setSelectedAssessment(assessment);
    setShowModal(true);
  };

  const handleTerminate = async (assessment: PatientRestraintAssessment) => {
    const patient = patients.find(p => p.院友id === assessment.patient_id);
    if (!confirm(`確定要終止 ${patient?.中文姓名 ?? ''} 的約束物品評估嗎？終止後不再續期，並列為已終止記錄。`)) return;
    try {
      await updatePatientRestraintAssessment({ ...assessment, is_terminated: true });
    } catch (error) {
      console.error('終止約束物品評估失敗:', error);
      alert('終止失敗，請重試');
    }
  };

  const handleDelete = async (id: string) => {
    const assessment = patientRestraintAssessments.find(a => a.id === id);
    const patient = patients.find(p => p.院友id === assessment?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的約束物品評估嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePatientRestraintAssessment(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除約束物品評估失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆約束物品評估嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const assessmentId of deletingArray) {
        await deletePatientRestraintAssessment(assessmentId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆約束物品評估`);
    } catch (error) {
      console.error('批量刪除約束物品評估失敗:', error);
      alert('批量刪除約束物品評估失敗，請重試');
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
    if (selectedRows.size === allDisplayedAssessments.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allDisplayedAssessments.map(a => a.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    allDisplayedAssessments.forEach(assessment => {
      if (!selectedRows.has(assessment.id)) {
        newSelected.add(assessment.id);
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

  const handleExportSelected = async (exportType: 'consent-form') => {
    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));
    
    if (selectedAssessments.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    try {
      await exportRestraintConsentsToExcel(selectedAssessments, patients);
    } catch (error) {
      console.error('匯出約束物品同意書失敗:', error);
      alert('匯出失敗，請重試');
    }
  };

  const handleExportObservationChart = async () => {
    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));
    
    if (selectedAssessments.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    setShowObservationDateRangeModal(true);
  };

  const handleConfirmObservationExport = async () => {
    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));
    
    if (!observationDateRange.startDate || !observationDateRange.endDate) {
      alert('請選擇完整的日期範圍');
      return;
    }

    if (new Date(observationDateRange.startDate) > new Date(observationDateRange.endDate)) {
      alert('開始日期不能晚於結束日期');
      return;
    }

    try {
      // 按床號排序選中的評估記錄
      const sortedAssessments = selectedAssessments.sort((a, b) => {
        const patientA = patients.find(p => p.院友id === a.patient_id);
        const patientB = patients.find(p => p.院友id === b.patient_id);
        const bedNumberA = patientA?.床號 || '';
        const bedNumberB = patientB?.床號 || '';
        return bedNumberA.localeCompare(bedNumberB, 'zh-Hant', { numeric: true });
      });

      await exportRestraintObservationsToExcel(
        sortedAssessments, 
        patients, 
        observationDateRange.startDate,
        observationDateRange.endDate
      );
      setShowObservationDateRangeModal(false);
    } catch (error) {
      console.error('匯出約束物品觀察表失敗:', error);
      alert('匯出失敗，請重試');
    }
  };

  const handleConfirmObservationHtmlExport = async () => {
    if (!observationDateRange.startDate || !observationDateRange.endDate) {
      alert('請選擇完整的日期範圍');
      return;
    }

    if (new Date(observationDateRange.startDate) > new Date(observationDateRange.endDate)) {
      alert('開始日期不能晚於結束日期');
      return;
    }

    // 開啟 modal 詢問是否映射日期中的「日子」
    setObservationIncludeDayNumber(true);
    setShowObservationDayMappingModal(true);
  };

  const handleObservationDayMappingConfirm = async () => {
    setShowObservationDayMappingModal(false);

    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));

    try {
      // 按床號排序選中的評估記錄
      const sortedAssessments = selectedAssessments.sort((a, b) => {
        const patientA = patients.find(p => p.院友id === a.patient_id);
        const patientB = patients.find(p => p.院友id === b.patient_id);
        const bedNumberA = patientA?.床號 || '';
        const bedNumberB = patientB?.床號 || '';
        return bedNumberA.localeCompare(bedNumberB, 'zh-Hant', { numeric: true });
      });

      // 拉取日期範圍內的所有觀察記錄
      const records = await db.getRestraintObservationRecordsInDateRange(
        observationDateRange.startDate,
        observationDateRange.endDate
      );

      const items = sortedAssessments.map(assessment => {
        const patient = patients.find(p => p.院友id === assessment.patient_id);
        if (!patient) return null;
        return {
          patient,
          assessment,
          records: records.filter(r => r.patient_id === assessment.patient_id)
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      if (items.length === 0) {
        alert('找不到可列印的院友資料');
        return;
      }

      exportRestraintObservationsRangeHtml(
        items,
        observationDateRange.startDate,
        observationDateRange.endDate,
        observationIncludeDayNumber
      );
      setShowObservationDateRangeModal(false);
    } catch (error) {
      console.error('HTML 列印約束物品觀察表失敗:', error);
      alert('HTML 列印失敗，請重試');
    }
  };

  const handlePrintUsageRecord = async () => {
    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));
    if (selectedAssessments.length === 0) {
      alert('請先選擇要列印的記錄');
      return;
    }
    // 取所有涉及的側友id（去重）
    const patientIds = [...new Set(selectedAssessments.map(a => a.patient_id))];
    const items = patientIds.map(pid => {
      const patient = patients.find(p => p.院友id === pid);
      if (!patient) return null;
      // 取該院友所有歷史評估記錄（不限於選中的）
      const allForPatient = patientRestraintAssessments.filter(a => a.patient_id === pid);
      return { patient, assessments: allForPatient };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    if (items.length === 0) {
      alert('找不到對應院友資料');
      return;
    }
    await printRestraintUsageRecords(items);
  };

  const handlePrintSelectedConsent = async () => {
    const selectedAssessments = allDisplayedAssessments.filter(a => selectedRows.has(a.id));
    if (selectedAssessments.length === 0) {
      alert('請先選擇要列印的記錄');
      return;
    }
    const items = selectedAssessments
      .map(assessment => {
        const patient = patients.find(p => p.院友id === assessment.patient_id);
        return patient ? { assessment, patient } : null;
      })
      .filter((x): x is { assessment: PatientRestraintAssessment; patient: NonNullable<typeof x>['patient'] } => x !== null);
    if (items.length === 0) {
      alert('找不到對應院友資料');
      return;
    }
    await printRestraintConsentForms(items);
  };

  const getStatusBadge = (assessment: PatientRestraintAssessment) => {
    if (assessment.is_terminated) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          <Ban className="h-3 w-3 mr-1" />
          已終止
        </span>
      );
    }
    if (!assessment.doctor_signature_date) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FileText className="h-3 w-3 mr-1" />
          未簽署
        </span>
      );
    }

    if (isOverdue(assessment)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          已逾期
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
        有效
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

  const latestAssessments = groupedAssessments.map(g => g.assessments[0]);
  const stats = {
    total: groupedAssessments.length,
    signed: latestAssessments.filter(a => a.doctor_signature_date).length,
    overdue: latestAssessments.filter(a => isOverdue(a)).length,
    dueSoon: latestAssessments.filter(a => isDueSoon(a)).length
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">約束物品管理</h1>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRows.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative group">
                  <button className="btn-secondary flex flex-wrap items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>匯出約束物品文件</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <button
                      onClick={() => handleExportSelected('consent-form')}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                    >
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>約束物品同意書</span>
                    </button>
                    <button
                      onClick={handleExportObservationChart}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                    >
                      <FileText className="h-4 w-4 text-green-600" />
                      <span>約束物品觀察表</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={handlePrintSelectedConsent}
                  className="btn-secondary flex flex-wrap items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>列印同意書</span>
                </button>
                <button
                  onClick={handlePrintUsageRecord}
                  className="btn-secondary flex flex-wrap items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>列印使用紀錄</span>
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedAssessment(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增約束物品評估</span>
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
                  <label className="form-label">簽署日期區間</label>
                  <div className="flex flex-wrap items-center gap-2">
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
                    <label className="form-label">簽署狀態</label>
                    <select
                      value={advancedFilters.has_signature}
                      onChange={(e) => updateAdvancedFilter('has_signature', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="是">已簽署</option>
                      <option value="否">未簽署</option>
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
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {patientRestraintAssessments.length} 筆記錄)</span>
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
                  {selectedRows.size === allDisplayedAssessments.length && allDisplayedAssessments.length > 0 ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {allDisplayedAssessments.length} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 約束物品評估列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === allDisplayedAssessments.length && allDisplayedAssessments.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="doctor_signature_date">醫生簽署日期</SortableHeader>
                  <SortableHeader field="next_due_date">下次到期日</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    約束物品建議
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
                  const displayAssessments = isExpanded ? group.assessments : [group.assessments[0]];
                  const hasMultiple = group.assessments.length > 1;
                  return displayAssessments.map((assessment, assessmentIndex) => (
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
                      {assessmentIndex === 0 && (
                        <>
                          <td
                            rowSpan={displayAssessments.length}
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
                                <span className="text-xs text-blue-600 font-medium">{group.assessments.length}</span>
                              </div>
                            )}
                          </td>
                          <td rowSpan={displayAssessments.length} className="px-4 py-4 whitespace-nowrap align-middle">
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
                                <div className="text-sm text-gray-500">{patient?.床號}</div>
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assessment.doctor_signature_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-green-500" />
                            <span>{formatDisplayDate(assessment.doctor_signature_date)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">未簽署</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assessment.next_due_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className={isOverdue(assessment) ? 'text-red-600 font-medium' : isDueSoon(assessment) ? 'text-orange-600 font-medium' : ''}>
                              {formatDisplayDate(assessment.next_due_date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {assessmentIndex === 0
                          ? getStatusBadge(assessment)
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">舊記錄</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate">
                          {assessment.suggested_restraints && typeof assessment.suggested_restraints === 'object' ? (
                            Object.entries(assessment.suggested_restraints)
                              .filter(([key, value]) => value === true || (typeof value === 'object' && (value as any)?.checked))
                              .map(([key]) => key)
                              .join(', ') || '-'
                          ) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDisplayDate(assessment.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => handleEdit(assessment)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(assessment.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {assessmentIndex === 0 && !assessment.is_terminated && (
                            <button
                              onClick={() => {
                                setRenewFromAssessment(assessment);
                                setSelectedAssessment(null);
                                setShowModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="另存新檔（續期）"
                              disabled={deletingIds.has(assessment.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {assessmentIndex === 0 && !assessment.is_terminated && (
                            <button
                              onClick={() => handleTerminate(assessment)}
                              className="text-orange-500 hover:text-orange-700"
                              title="終止（不再續期）"
                              disabled={deletingIds.has(assessment.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
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
                  ));
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Shield className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的約束物品評估' : '暫無約束物品評估'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立約束物品評估'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增約束物品評估
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
        <RestraintAssessmentModal
          assessment={selectedAssessment ?? undefined}
          renewFrom={renewFromAssessment}
          onClose={() => {
            setShowModal(false);
            setSelectedAssessment(null);
            setRenewFromAssessment(null);
          }}
          onUpdate={() => {
            setShowModal(false);
            setSelectedAssessment(null);
            setRenewFromAssessment(null);
          }}
        />
      )}

      {/* 約束物品觀察表日期範圍選擇模態框 */}
      {showObservationDateRangeModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowObservationDateRangeModal(false);
          }}
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">選擇觀察期間</h3>
              </div>
              <button
                onClick={() => setShowObservationDateRangeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                請選擇約束物品觀察表的觀察期間。期間會顯示在 Excel 匯出標題及 HTML 列印標題中。
              </p>
              
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  開始日期 *
                </label>
                <input
                  type="date"
                  value={observationDateRange.startDate}
                  onChange={(e) => setObservationDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  結束日期 *
                </label>
                <input
                  type="date"
                  value={observationDateRange.endDate}
                  onChange={(e) => setObservationDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>預覽標題：</strong>
                  身體約束物品觀察記錄表 ( {observationDateRange.startDate ? formatDisplayDate(observationDateRange.startDate).replace(/\//g, '年').replace(/年(\d+)月/, '年 $1月 ').replace(/月(\d+)$/, '月$1日') : 'XXXX年 XX月 XX日'} 至 {observationDateRange.endDate ? formatDisplayDate(observationDateRange.endDate).replace(/\//g, '年').replace(/年(\d+)月/, '年 $1月 ').replace(/月(\d+)$/, '月$1日') : 'XXXX年 XX月XX日'} )
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <button
                onClick={handleConfirmObservationExport}
                className="btn-primary flex-1"
                disabled={!observationDateRange.startDate || !observationDateRange.endDate}
              >
                確認匯出 Excel
              </button>
              <button
                onClick={handleConfirmObservationHtmlExport}
                className="btn-secondary flex-1"
                disabled={!observationDateRange.startDate || !observationDateRange.endDate}
              >
                列印 HTML
              </button>
              <button
                onClick={() => setShowObservationDateRangeModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 約束物品觀察表日期日子映射選擇模態框 */}
      {showObservationDayMappingModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowObservationDayMappingModal(false);
          }}
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">日期顯示設定</h3>
              </div>
              <button
                onClick={() => setShowObservationDayMappingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                請選擇 HTML 列印時日期是否要顯示「日子」（數字）。
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="includeDayNumber"
                    checked={observationIncludeDayNumber}
                    onChange={() => setObservationIncludeDayNumber(true)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">顯示日子</div>
                    <div className="text-sm text-gray-500">例：2026年07月21日</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="includeDayNumber"
                    checked={!observationIncludeDayNumber}
                    onChange={() => setObservationIncludeDayNumber(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">不顯示日子</div>
                    <div className="text-sm text-gray-500">例：2026年07月 [    ] 日</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <button
                onClick={handleObservationDayMappingConfirm}
                className="btn-primary flex-1"
              >
                確認列印
              </button>
              <button
                onClick={() => setShowObservationDayMappingModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestraintManagement;