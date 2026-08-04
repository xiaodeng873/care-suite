import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Stethoscope,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  Printer
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { useCgat } from '../context/CgatContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import CgatModal from '../components/CgatModal';
import CgatMedicationProxyModal from '../components/CgatMedicationProxyModal';
import CgatPrintWarningModal, { type CgatPrintWarningType } from '../components/CgatPrintWarningModal';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber } from '../utils/searchUtils';
import PatientTooltip from '../components/PatientTooltip';
import { getFeeExemptEligibility } from '../utils/cgatFeeHelper';
import { printCgatWorksheet } from '../utils/cgatWorksheetGenerator';
import { printCgatMedicationProxy } from '../utils/cgatMedicationProxyGenerator';
import type { CgatRecord, Patient } from '../lib/database';
import { formatDisplayDate } from '../utils/dateFormat';
import BedNumberImprint from '../components/BedNumberImprint';


type SortField = '院友姓名' | 'medication_end_date' | 'cgat_visit_date' | 'created_at';
type SortDirection = 'asc' | 'desc';
interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}
const Cgat: React.FC = () => {
  // CGAT 特例：解除站別過濾，列出所有院友
  const { allPatients: patients, loading } = usePatients();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const { cgatRecords, deleteCgatRecord } = useCgat();
  const [showModal, setShowModal] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningType, setWarningType] = useState<CgatPrintWarningType>('duplicate');
  const [warningPatients, setWarningPatients] = useState<Patient[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CgatRecord | null>(null);
  const [renewFromRecord, setRenewFromRecord] = useState<CgatRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
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
    return <LoadingScreen pageName="CGAT" />;
  }
  const filteredRecords = useMemo(() => {
    const searchTerm = deferredSearch;
    return cgatRecords.filter(record => {
    const patient = patients.find(p => p.院友id === record.patient_id);
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.startDate || advancedFilters.endDate) {
      if (!record.medication_end_date) {
        return false;
      }
      const medicationEndDate = new Date(record.medication_end_date);
      if (advancedFilters.startDate && medicationEndDate < new Date(advancedFilters.startDate)) {
        return false;
      }
      if (advancedFilters.endDate && medicationEndDate > new Date(advancedFilters.endDate)) {
        return false;
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
  }, [cgatRecords, patients, advancedFilters, deferredSearch]);
  const hasAdvancedFilters = () => {
    return Object.entries(advancedFilters).some(([key, value]) => key === '在住狀態' ? value !== '在住' : value !== '');
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
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    let valueA: string | number = '';
    let valueB: string | number = '';
    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case 'medication_end_date':
        valueA = a.medication_end_date ? new Date(a.medication_end_date).getTime() : 0;
        valueB = b.medication_end_date ? new Date(b.medication_end_date).getTime() : 0;
        break;
      case 'cgat_visit_date':
        valueA = a.cgat_visit_unknown ? Number.MAX_SAFE_INTEGER : (a.cgat_visit_date ? new Date(a.cgat_visit_date).getTime() : 0);
        valueB = b.cgat_visit_unknown ? Number.MAX_SAFE_INTEGER : (b.cgat_visit_date ? new Date(b.cgat_visit_date).getTime() : 0);
        break;
      case 'created_at':
        valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
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
  const groupedRecords = (() => {
    const seen = new Set<number>();
    const groups: { patientId: number; records: CgatRecord[] }[] = [];
    sortedRecords.forEach(c => {
      if (!seen.has(c.patient_id)) {
        seen.add(c.patient_id);
        groups.push({ patientId: c.patient_id, records: [c] });
      } else {
        groups.find(g => g.patientId === c.patient_id)!.records.push(c);
      }
    });
    groups.forEach(g => g.records.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()));
    return groups;
  })();
  const totalItems = groupedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedRecords.slice(startIndex, endIndex);
  // 目前頁面實際顯示的所有記錄（已展開的顯示全部，未展開的只顯示第一筆）
  const allDisplayedRecords = paginatedGroups.flatMap(g =>
    expandedPatients.has(g.patientId) ? g.records : [g.records[0]]
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
  const handleEdit = (record: CgatRecord) => {
    setSelectedRecord(record);
    setRenewFromRecord(null);
    setShowModal(true);
  };
  const handleDelete = async (id: string) => {
    const record = cgatRecords.find(c => c.id === id);
    const patient = patients.find(p => p.院友id === record?.patient_id);
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的 CGAT 記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteCgatRecord(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除 CGAT 記錄失敗，請重試');
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
    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆 CGAT 記錄嗎？\n\n此操作無法復原。`;
    if (!confirm(confirmMessage)) {
      return;
    }
    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    try {
      for (const recordId of deletingArray) {
        await deleteCgatRecord(recordId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆 CGAT 記錄`);
    } catch (error) {
      console.error('批量刪除 CGAT 記錄失敗:', error);
      alert('批量刪除 CGAT 記錄失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };
  const handleSelectRow = (recordId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRows(newSelected);
  };
  const handleSelectAll = () => {
    if (selectedRows.size === allDisplayedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allDisplayedRecords.map(c => c.id)));
    }
  };
  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    allDisplayedRecords.forEach(record => {
      if (!selectedRows.has(record.id)) {
        newSelected.add(record.id);
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

  // 檢查選取的記錄中是否有重複院友
  const findDuplicatePatients = (recordIds: string[]): Patient[] => {
    const patientIdCounts = new Map<number, number>();
    for (const id of recordIds) {
      const record = cgatRecords.find(r => r.id === id);
      if (record) {
        patientIdCounts.set(record.patient_id, (patientIdCounts.get(record.patient_id) || 0) + 1);
      }
    }
    const duplicatePatientIds = Array.from(patientIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([patientId]) => patientId);
    return duplicatePatientIds
      .map(id => patients.find(p => p.院友id === id))
      .filter((p): p is Patient => !!p);
  };

  // 檢查選取的記錄中是否有個別取藥的院友（不得列入委託書）
  const findIndividualPickupPatients = (recordIds: string[]): Patient[] => {
    const seen = new Set<number>();
    const result: Patient[] = [];
    for (const id of recordIds) {
      const record = cgatRecords.find(r => r.id === id);
      if (record && record.pharmacy_arrangement === '個別取藥') {
        const patient = patients.find(p => p.院友id === record.patient_id);
        if (patient && !seen.has(patient.院友id)) {
          seen.add(patient.院友id);
          result.push(patient);
        }
      }
    }
    return result;
  };

  const openWarningModal = (type: CgatPrintWarningType, patients: Patient[]) => {
    setWarningType(type);
    setWarningPatients(patients);
    setShowWarningModal(true);
  };

  // ── CGAT 欄位顯示 ──
  const caseTypeText = (r: CgatRecord) => {
    const parts: string[] = [];
    if (r.case_type) parts.push(r.case_type);
    if (r.is_cgas) parts.push('CGAS');
    if (r.is_eol) parts.push('EOL');
    return parts.join(' / ') || '—';
  };
  const reasonText = (r: CgatRecord) => {
    const parts: string[] = [];
    if (r.reason_renew) parts.push('續藥');
    if (r.reason_discharge) parts.push('出院');
    if (r.reason_sign_letter) parts.push('簽信');
    if (r.reason_referral_letter) parts.push('轉介信');
    if (r.reason_view_report) {
      const sub: string[] = [];
      if (r.report_bld) sub.push('Bld');
      if (r.report_xray) sub.push('X-Ray');
      if (r.report_ct) sub.push('CT');
      if (r.report_usg) sub.push('USG');
      if (r.report_other) sub.push(r.report_other);
      parts.push(`看報告${sub.length ? `(${sub.join(',')})` : ''}`);
    }
    return parts.join('、') || '—';
  };
  const pharmacyText = (r: CgatRecord) => {
    const parts: string[] = [];
    if (r.pharmacy_arrangement) parts.push(r.pharmacy_arrangement);
    if (r.is_urgent_medication) parts.push('急藥');
    return parts.join(' / ') || '—';
  };
  const feeText = (r: CgatRecord) => {
    const p = patients.find(pt => pt.院友id === r.patient_id);
    const eligible = getFeeExemptEligibility(p).eligible;
    if (eligible || r.fee_exempted || r.medication_pickup_arrangement === '家人前往') {
      return <span className="text-green-600">豁免</span>;
    }
    return <span className="font-medium">HKD ${r.total_fee ?? 0}</span>;
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
          <h1 className="text-2xl font-bold text-gray-900">CGAT</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (selectedRows.size === 0) {
                  alert('請先選擇要列印的 CGAT 記錄');
                  return;
                }
                const duplicates = findDuplicatePatients(Array.from(selectedRows));
                if (duplicates.length > 0) {
                  openWarningModal('duplicate', duplicates);
                  return;
                }
                await printCgatWorksheet(sortedRecords, patients, Array.from(selectedRows));
              }}
              className="btn-secondary flex flex-wrap items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>列印診症名單</span>
            </button>
            <button
              onClick={() => {
                if (selectedRows.size === 0) {
                  alert('請先選擇要列印的 CGAT 記錄');
                  return;
                }
                const individualPickups = findIndividualPickupPatients(Array.from(selectedRows));
                if (individualPickups.length > 0) {
                  openWarningModal('individual_pickup', individualPickups);
                  return;
                }
                const duplicates = findDuplicatePatients(Array.from(selectedRows));
                if (duplicates.length > 0) {
                  openWarningModal('duplicate', duplicates);
                  return;
                }
                setShowProxyModal(true);
              }}
              className="btn-secondary flex flex-wrap items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>列印取藥委託書</span>
            </button>
            <button
              onClick={() => {
                setSelectedRecord(null);
                setRenewFromRecord(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增 CGAT 記錄</span>
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
                  <label className="form-label">藥完日期區間</label>
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
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {cgatRecords.length} 筆記錄)</span>
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
                  {selectedRows.size === allDisplayedRecords.length && allDisplayedRecords.length > 0 ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {allDisplayedRecords.length} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CGAT 列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === allDisplayedRecords.length && allDisplayedRecords.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">個案類型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">侯診原因</th>
                  <SortableHeader field="medication_end_date">藥完日期</SortableHeader>
                  <SortableHeader field="cgat_visit_date">CGAT 到診日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">藥房安排</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">取藥安排</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">費用結算</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroups.map(group => {
                  const patient = patients.find(p => p.院友id === group.patientId);
                  const isExpanded = expandedPatients.has(group.patientId);
                  const displayRecords = isExpanded ? group.records : [group.records[0]];
                  const hasMultiple = group.records.length > 1;
                  return displayRecords.map((record, recordIndex) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 ${selectedRows.has(record.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(record)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(record.id)}
                          onChange={() => handleSelectRow(record.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      {recordIndex === 0 && (
                        <>
                          <td
                            rowSpan={displayRecords.length}
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
                                <span className="text-xs text-blue-600 font-medium">{group.records.length}</span>
                              </div>
                            )}
                          </td>
                          <td rowSpan={displayRecords.length} className="px-4 py-4 whitespace-nowrap align-middle">
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
                                {patient ? <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" /> : <span className="text-sm text-gray-500">-</span>}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{caseTypeText(record)}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{reasonText(record)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.medication_end_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{formatDisplayDate(record.medication_end_date)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.cgat_visit_unknown ? (
                          <span className="text-red-600">未知</span>
                        ) : record.cgat_visit_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{formatDisplayDate(record.cgat_visit_date)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{pharmacyText(record)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.medication_pickup_arrangement === '每次詢問' ? (
                          <span className="text-red-600">每次詢問</span>
                        ) : (
                          record.medication_pickup_arrangement || '—'
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{feeText(record)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(record.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {recordIndex === 0 && (
                            <button
                              onClick={() => {
                                setRenewFromRecord(record);
                                setSelectedRecord(null);
                                setShowModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="另存新檔（下次到診）"
                              disabled={deletingIds.has(record.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(record.id)}
                          >
                            {deletingIds.has(record.id) ? (
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
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的 CGAT 記錄' : '暫無 CGAT 記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立 CGAT 記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增 CGAT 記錄
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
        <CgatModal
          record={selectedRecord}
          renewFrom={renewFromRecord}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setRenewFromRecord(null);
          }}
        />
      )}
      {showProxyModal && (
        <CgatMedicationProxyModal
          onClose={() => setShowProxyModal(false)}
          onConfirm={async (proxyDate, proxyPerson, prescriptionPaperCount) => {
            setShowProxyModal(false);
            await printCgatMedicationProxy(
              sortedRecords,
              patients,
              Array.from(selectedRows),
              proxyDate,
              proxyPerson,
              prescriptionPaperCount,
              displayName
            );
          }}
        />
      )}
      {showWarningModal && (
        <CgatPrintWarningModal
          type={warningType}
          patients={warningPatients}
          onClose={() => setShowWarningModal(false)}
        />
      )}
    </div>
  );
};

export default Cgat;
