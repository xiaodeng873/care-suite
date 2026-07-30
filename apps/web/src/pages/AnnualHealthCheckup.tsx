import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Stethoscope,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Download,
  User,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileWarning,
  ChevronUp,
  ChevronDown,
  X,
  FileText,
  Copy
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import AnnualHealthCheckupModal from '../components/AnnualHealthCheckupModal';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber } from '../utils/searchUtils';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import {
  getCheckupStatus,
  isOverdue,
  isDueSoon,
  type AnnualHealthCheckup,
  type CheckupStatus
} from '../utils/annualHealthCheckupHelper';
import { exportAnnualHealthCheckupsToExcel } from '../utils/annualHealthCheckupExcelGenerator';
import { printMedicalExaminationForm } from '../utils/annualHealthCheckupFormGenerator';
import { getTemplatesMetadata } from '../lib/database';
import { formatDisplayDate } from '../utils/dateFormat';

type SortField = '院友姓名' | 'last_doctor_signature_date' | 'next_due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';
interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  has_signature: string;
  is_overdue: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}
const AnnualHealthCheckup: React.FC = () => {
  const { annualHealthCheckups, patients, prescriptions, deleteAnnualHealthCheckup, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedCheckup, setSelectedCheckup] = useState<AnnualHealthCheckup | null>(null);
  const [renewFromCheckup, setRenewFromCheckup] = useState<AnnualHealthCheckup | null>(null);
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
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);
  if (loading) {
    return <LoadingScreen pageName="年度體檢" />;
  }
  const checkIsOverdue = (checkup: AnnualHealthCheckup): boolean => {
    if (!checkup.next_due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(checkup.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };
  const checkIsDueSoon = (checkup: AnnualHealthCheckup): boolean => {
    if (!checkup.next_due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(checkup.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 14 && daysDiff > 0;
  };
  const filteredCheckups = useMemo(() => {
    const searchTerm = deferredSearch;
    return annualHealthCheckups.filter(checkup => {
    const patient = patients.find(p => p.院友id === checkup.patient_id);
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.has_signature) {
      const hasSignature = !!checkup.last_doctor_signature_date;
      if (advancedFilters.has_signature === '是' && !hasSignature) return false;
      if (advancedFilters.has_signature === '否' && hasSignature) return false;
    }
    if (advancedFilters.is_overdue) {
      const overdue = checkIsOverdue(checkup);
      if (advancedFilters.is_overdue === '是' && !overdue) return false;
      if (advancedFilters.is_overdue === '否' && overdue) return false;
    }
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const signatureDate = checkup.last_doctor_signature_date ? new Date(checkup.last_doctor_signature_date) : null;
      if (signatureDate) {
        if (advancedFilters.startDate && signatureDate < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && signatureDate > new Date(advancedFilters.endDate)) {
          return false;
        }
      }
    }
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
                         fuzzyMatch(patient?.身份證號碼, searchTerm) ||
                         matchBedNumber(patient?.床號, searchTerm);
    }
    return matchesSearch;
    });
  }, [annualHealthCheckups, patients, advancedFilters, deferredSearch]);
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
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };
  const sortedCheckups = [...filteredCheckups].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    let valueA: string | number = '';
    let valueB: string | number = '';
    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case 'last_doctor_signature_date':
        valueA = a.last_doctor_signature_date ? new Date(a.last_doctor_signature_date).getTime() : 0;
        valueB = b.last_doctor_signature_date ? new Date(b.last_doctor_signature_date).getTime() : 0;
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
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });
  // 依 patient_id 分組，組內依 created_at desc 排列（最新在前）
  const groupedCheckups = (() => {
    const seen = new Set<number>();
    const groups: { patientId: number; checkups: AnnualHealthCheckup[] }[] = [];
    sortedCheckups.forEach(c => {
      if (!seen.has(c.patient_id)) {
        seen.add(c.patient_id);
        groups.push({ patientId: c.patient_id, checkups: [c] });
      } else {
        groups.find(g => g.patientId === c.patient_id)!.checkups.push(c);
      }
    });
    // 組內依 created_at desc 排列
    groups.forEach(g => g.checkups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    return groups;
  })();
  const totalItems = groupedCheckups.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedCheckups.slice(startIndex, endIndex);
  // 目前頁面實際顯示的所有記錄（已展開的顯示全部，未展開的只顯示第一筆）
  const allDisplayedCheckups = paginatedGroups.flatMap(g =>
    expandedPatients.has(g.patientId) ? g.checkups : [g.checkups[0]]
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
  const handleEdit = (checkup: AnnualHealthCheckup) => {
    setSelectedCheckup(checkup);
    setShowModal(true);
  };
  const handleDelete = async (id: string) => {
    const checkup = annualHealthCheckups.find(c => c.id === id);
    const patient = patients.find(p => p.院友id === checkup?.patient_id);
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的年度體檢記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteAnnualHealthCheckup(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除年度體檢記錄失敗，請重試');
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
    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆年度體檢記錄嗎？\n\n此操作無法復原。`;
    if (!confirm(confirmMessage)) {
      return;
    }
    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    try {
      for (const checkupId of deletingArray) {
        await deleteAnnualHealthCheckup(checkupId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆年度體檢記錄`);
    } catch (error) {
      console.error('批量刪除年度體檢記錄失敗:', error);
      alert('批量刪除年度體檢記錄失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };
  const handleSelectRow = (checkupId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(checkupId)) {
      newSelected.delete(checkupId);
    } else {
      newSelected.add(checkupId);
    }
    setSelectedRows(newSelected);
  };
  const handleSelectAll = () => {
    if (selectedRows.size === allDisplayedCheckups.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allDisplayedCheckups.map(c => c.id)));
    }
  };
  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    allDisplayedCheckups.forEach(checkup => {
      if (!selectedRows.has(checkup.id)) {
        newSelected.add(checkup.id);
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
  const handleExportSelected = async () => {
    const selectedCheckups = allDisplayedCheckups.filter(c => selectedRows.has(c.id));
    if (selectedCheckups.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }
    try {
      const templates = await getTemplatesMetadata();
      const annualHealthCheckupTemplate = templates.find((t: any) => t.type === 'annual-health-checkup');
      if (!annualHealthCheckupTemplate) {
        alert('請先在範本管理中上傳「安老院住客體格檢驗報告書」範本');
        return;
      }
      const personalMedicationListTemplate = templates.find((t: any) => t.type === 'personal-medication-list');
      const includePersonalMedicationList = !!personalMedicationListTemplate;
      if (!personalMedicationListTemplate) {
        console.warn('未找到個人藥物記錄範本，將不包含個人藥物記錄工作表');
      } else {
      }
      const exportData = selectedCheckups.map(checkup => {
        const patient = patients.find(p => p.院友id === checkup.patient_id);
        const patientPrescriptions = patient
          ? prescriptions.filter(p =>
              p.patient_id === patient.院友id &&
              (p.status === 'active' || p.status === 'inactive')
            )
          : [];
        return {
          checkup,
          patient: {
            院友id: patient?.院友id,
            床號: patient?.床號 || '',
            中文姓氏: patient?.中文姓氏 || '',
            中文名字: patient?.中文名字 || '',
            英文姓氏: patient?.英文姓氏,
            英文名字: patient?.英文名字,
            英文姓名: patient?.英文姓名,
            性別: patient?.性別 || '',
            出生日期: patient?.出生日期 || '',
            身份證號碼: patient?.身份證號碼 || ''
          },
          prescriptions: patientPrescriptions
        };
      });
      exportData.forEach((data, index) => {
      });
      await exportAnnualHealthCheckupsToExcel(
        exportData,
        annualHealthCheckupTemplate,
        personalMedicationListTemplate,
        includePersonalMedicationList
      );
      alert(`成功匯出 ${selectedCheckups.length} 筆年度體檢報告書`);
    } catch (error: any) {
      console.error('匯出年度體檢記錄失敗:', error);
      alert('匯出失敗：' + (error.message || '請重試'));
    }
  };
  const getStatusBadge = (checkup: AnnualHealthCheckup) => {
    if (!checkup.last_doctor_signature_date) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FileWarning className="h-3 w-3 mr-1" />
          未簽署
        </span>
      );
    }
    if (checkIsOverdue(checkup)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          已逾期
        </span>
      );
    }
    if (checkIsDueSoon(checkup)) {
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
  const latestCheckups = groupedCheckups.map(g => g.checkups[0]);
  const stats = {
    total: groupedCheckups.length,
    signed: latestCheckups.filter(c => c.last_doctor_signature_date).length,
    overdue: latestCheckups.filter(c => checkIsOverdue(c)).length,
    dueSoon: latestCheckups.filter(c => checkIsDueSoon(c)).length
  };
  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">年度體檢管理</h1>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRows.size > 0 && (
              <button
                onClick={handleExportSelected}
                className="btn-secondary flex flex-wrap items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出Excel</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedCheckup(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增年度體檢</span>
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
                  placeholder="搜索院友姓名、床號..."
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
                      <option value="已退住">已退住</option>
                      <option value="">全部</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {annualHealthCheckups.length} 筆記錄)</span>
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
                  {selectedRows.size === allDisplayedCheckups.length && allDisplayedCheckups.length > 0 ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {allDisplayedCheckups.length} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 年度體檢列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === allDisplayedCheckups.length && allDisplayedCheckups.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="last_doctor_signature_date">醫生簽署日期</SortableHeader>
                  <SortableHeader field="next_due_date">下次到期日</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
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
                  const displayCheckups = isExpanded ? group.checkups : [group.checkups[0]];
                  const hasMultiple = group.checkups.length > 1;
                  return displayCheckups.map((checkup, checkupIndex) => (
                    <tr
                      key={checkup.id}
                      className={`hover:bg-gray-50 ${selectedRows.has(checkup.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(checkup)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(checkup.id)}
                          onChange={() => handleSelectRow(checkup.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      {checkupIndex === 0 && (
                        <>
                          <td
                            rowSpan={displayCheckups.length}
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
                                <span className="text-xs text-blue-600 font-medium">{group.checkups.length}</span>
                              </div>
                            )}
                          </td>
                          <td rowSpan={displayCheckups.length} className="px-4 py-4 whitespace-nowrap align-middle">
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
                                {patient ? <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" /> : null}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {checkup.last_doctor_signature_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-green-500" />
                            <span>{formatDisplayDate(checkup.last_doctor_signature_date)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">未簽署</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {checkup.next_due_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className={checkIsOverdue(checkup) ? 'text-red-600 font-medium' : checkIsDueSoon(checkup) ? 'text-orange-600 font-medium' : ''}>
                              {formatDisplayDate(checkup.next_due_date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {checkupIndex === 0
                          ? getStatusBadge(checkup)
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">舊記錄</span>
                        }
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDisplayDate(checkup.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => { if (patient) printMedicalExaminationForm(checkup, patient); }}
                            className="text-green-600 hover:text-green-900"
                            title="列印體檢報告書"
                            disabled={!patient}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(checkup)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(checkup.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {checkupIndex === 0 && (
                            <button
                              onClick={() => {
                                setRenewFromCheckup(checkup);
                                setSelectedCheckup(null);
                                setShowModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="另存新檔（續期）"
                              disabled={deletingIds.has(checkup.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(checkup.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(checkup.id)}
                          >
                            {deletingIds.has(checkup.id) ? (
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
            <Stethoscope className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的年度體檢記錄' : '暫無年度體檢記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立年度體檢記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增年度體檢
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
        <AnnualHealthCheckupModal
          checkup={selectedCheckup}
          renewFrom={renewFromCheckup}
          onClose={() => {
            setShowModal(false);
            setSelectedCheckup(null);
            setRenewFromCheckup(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedCheckup(null);
            setRenewFromCheckup(null);
          }}
        />
      )}
    </div>
  );
};
export default AnnualHealthCheckup;
