import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Stethoscope,
  Plus,
  Edit3,
  Trash2,
  Search,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  Copy,
  Droplet,
  Wind,
  Package,
  Ban,
  Filter,
  X,
} from 'lucide-react';
import { usePatientData, useFilteredPatients, type PatientTubeCareRecord } from '../context/PatientContext';
import { useAssessment } from '../context/merged/RecordsContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import TubeCareModal from '../components/TubeCareModal';
import RecordRecycleBinModal from '../components/RecordRecycleBinModal';
import BedNumberImprint from '../components/BedNumberImprint';
import PatientTooltip from '../components/PatientTooltip';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, compareBedNumbers, matchPatientBedNumber} from '../utils/searchUtils';
import { formatDisplayDate } from '../utils/dateFormat';
import { getTubeCareStatus } from '../utils/taskScheduler';
import DateInput from '../components/DateInput';

type SortField = '院友姓名' | 'execution_date' | 'next_due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  care_type: string;
  is_overdue: string;
  is_terminated: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const CARE_TYPE_OPTIONS: PatientTubeCareRecord['care_type'][] = [
  '導尿管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換', '造口袋更換',
];

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  return formatDisplayDate(d, '—');
};

const statusBadge = (record: PatientTubeCareRecord) => {
  if (record.is_terminated) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">已終止</span>;
  }
  const status = getTubeCareStatus(record);
  if (status === 'overdue') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">已逾期</span>;
  }
  if (status === 'due_soon') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">即將到期</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">有效</span>;
};

const careTypeIcon = (careType: string) => {
  if (careType === '氧氣喉管清洗/更換') return <Wind className="h-4 w-4 text-teal-600" />;
  if (careType === '造口袋更換') return <Package className="h-4 w-4 text-purple-600" />;
  return <Droplet className="h-4 w-4 text-blue-600" />;
};

const detailText = (record: PatientTubeCareRecord) => {
  if (record.care_type === '氧氣喉管清洗/更換') {
    return record.oxygen_action ?? '—';
  }
  if (record.care_type === '造口袋更換') {
    return record.cycle_days ? `每 ${record.cycle_days} 天更換` : '—';
  }
  return [record.tube_material, record.tube_size].filter(Boolean).join(' ') || '—';
};

const TubeCareManagement: React.FC = () => {
  const { patientTubeCareRecords, deletePatientTubeCareRecord, updatePatientTubeCareRecord, loading } = usePatientData();
  const patients = useFilteredPatients();
  const { refreshAssessmentData } = useAssessment();
  const [showModal, setShowModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PatientTubeCareRecord | null>(null);
  const [renewFromRecord, setRenewFromRecord] = useState<PatientTubeCareRecord | null>(null);
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
    care_type: '',
    is_overdue: '',
    is_terminated: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住',
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="喉管護理" />;
  }

  const filteredRecords = useMemo(() => {
    const searchTerm = deferredSearch;
    return patientTubeCareRecords.filter(record => {
      const patient = patients.find(p => p.院友id === record.patient_id);
      if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
        return false;
      }
      // 終止：預設隱藏已終止；篩選器選「是」只顯示已終止
      if (advancedFilters.is_terminated === '是') {
        if (!record.is_terminated) return false;
      } else {
        if (record.is_terminated) return false;
      }
      if (advancedFilters.care_type && record.care_type !== advancedFilters.care_type) {
        return false;
      }
      if (advancedFilters.床號 && !matchPatientBedNumber(patient, advancedFilters.床號)) {
        return false;
      }
      if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
        return false;
      }
      if (advancedFilters.is_overdue) {
        const overdue = getTubeCareStatus(record) === 'overdue';
        if (advancedFilters.is_overdue === '是' && !overdue) return false;
        if (advancedFilters.is_overdue === '否' && overdue) return false;
      }
      if (advancedFilters.startDate || advancedFilters.endDate) {
        const exec = new Date(record.execution_date);
        if (advancedFilters.startDate && exec < new Date(advancedFilters.startDate)) return false;
        if (advancedFilters.endDate && exec > new Date(advancedFilters.endDate)) return false;
      }
      let matchesSearch = true;
      if (searchTerm) {
        matchesSearch =
          matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
          matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
          matchPatientBedNumber(patient, searchTerm) ||
          fuzzyMatch(record.notes, searchTerm);
      }
      return matchesSearch;
    });
  }, [patientTubeCareRecords, patients, advancedFilters, deferredSearch]);

  const hasAdvancedFilters = () => {
    return Object.values(advancedFilters).some(value => value !== '');
  };

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '', 中文姓名: '', care_type: '', is_overdue: '', is_terminated: '', startDate: '', endDate: '', 在住狀態: '在住',
    });
  };

  // 依 patient_id 分組，組內依執行日期 desc 排列（最新執行在前，即「當前記錄」；created_at 僅作後備）
  // 組排序以當前記錄為準，不可混用舊記錄日期：next_due_date 升序即自然得出 已逾期 > 即將到期 > 有效
  const groupedRecords = (() => {
    const map = new Map<number, PatientTubeCareRecord[]>();
    filteredRecords.forEach(r => {
      if (!map.has(r.patient_id)) map.set(r.patient_id, []);
      map.get(r.patient_id)!.push(r);
    });
    const groups = [...map.entries()].map(([patientId, records]) => ({
      patientId,
      records: records.sort((a, b) => {
        const ea = a.execution_date ? new Date(a.execution_date).getTime() : 0;
        const eb = b.execution_date ? new Date(b.execution_date).getTime() : 0;
        if (eb !== ea) return eb - ea;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    }));
    groups.sort((a, b) => {
      const ca = a.records[0];
      const cb = b.records[0];
      const patientA = patients.find(p => p.院友id === a.patientId);
      const patientB = patients.find(p => p.院友id === b.patientId);
      let valueA: string | number = '';
      let valueB: string | number = '';
      switch (sortField) {
        case '院友姓名': {
          const bedCmp = compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
          return sortDirection === 'asc' ? bedCmp : -bedCmp;
        }
        case 'execution_date':
          valueA = new Date(ca.execution_date).getTime();
          valueB = new Date(cb.execution_date).getTime();
          break;
        case 'next_due_date':
          valueA = ca.next_due_date ? new Date(ca.next_due_date).getTime() : 0;
          valueB = cb.next_due_date ? new Date(cb.next_due_date).getTime() : 0;
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
      // 打和後備：執行日期較新者在前
      const sigA = ca.execution_date ? new Date(ca.execution_date).getTime() : 0;
      const sigB = cb.execution_date ? new Date(cb.execution_date).getTime() : 0;
      return sigB - sigA;
    });
    return groups;
  })();

  const totalItems = groupedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedRecords.slice(startIndex, endIndex);
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

  const handleAdd = () => {
    setSelectedRecord(null);
    setRenewFromRecord(null);
    setShowModal(true);
  };

  const handleEdit = (record: PatientTubeCareRecord) => {
    setSelectedRecord(record);
    setRenewFromRecord(null);
    setShowModal(true);
  };

  const handleRenew = (record: PatientTubeCareRecord) => {
    setSelectedRecord(null);
    setRenewFromRecord(record);
    setShowModal(true);
  };

  const handleTerminate = async (record: PatientTubeCareRecord) => {
    const patient = patients.find(p => p.院友id === record.patient_id);
    if (!confirm(`確定要終止 ${patient?.中文姓名 ?? ''} 的「${record.care_type}」嗎？終止後不再續期，並列為已終止記錄。`)) return;
    try {
      await updatePatientTubeCareRecord({ ...record, is_terminated: true });
    } catch (error) {
      console.error('終止喉管護理記錄失敗:', error);
      alert('終止失敗，請重試');
    }
  };

  const handleDelete = async (id: string) => {
    const record = patientTubeCareRecords.find(r => r.id === id);
    const patient = patients.find(p => p.院友id === record?.patient_id);
    if (confirm(`確定要刪除 ${patient?.中文姓名 ?? ''} 的「${record?.care_type ?? ''}」記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePatientTubeCareRecord(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        console.error('刪除喉管護理記錄失敗:', error);
        alert('刪除喉管護理記錄失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆喉管護理記錄嗎？\n\n此操作無法復原。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    try {
      for (const recordId of deletingArray) {
        await deletePatientTubeCareRecord(recordId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆喉管護理記錄`);
    } catch (error) {
      console.error('批量刪除喉管護理記錄失敗:', error);
      alert('批量刪除喉管護理記錄失敗，請重試');
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
      setSelectedRows(new Set(allDisplayedRecords.map(r => r.id)));
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
          <h1 className="text-2xl font-bold text-gray-900">喉管護理管理</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleAdd} className="btn-primary flex flex-wrap items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>新增記錄</span>
            </button>
            <button
              onClick={() => setShowRecycleBin(true)}
              className="btn-secondary flex items-center gap-2"
              title="回收筒"
            >
              <Trash2 className="h-4 w-4" />
              <span>回收筒</span>
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
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
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
                  <label className="form-label">執行日期區間</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <DateInput value={advancedFilters.startDate} onChange={(value) => updateAdvancedFilter('startDate', value)} className="form-input" placeholder="開始日期" />
                    <span className="text-gray-500">至</span>
                    <DateInput value={advancedFilters.endDate} onChange={(value) => updateAdvancedFilter('endDate', value)} className="form-input" placeholder="結束日期" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">護理類型</label>
                    <select value={advancedFilters.care_type} onChange={(e) => updateAdvancedFilter('care_type', e.target.value)} className="form-input">
                      <option value="">全部類型</option>
                      {CARE_TYPE_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">床號</label>
                    <input type="text" value={advancedFilters.床號} onChange={(e) => updateAdvancedFilter('床號', e.target.value)} className="form-input" placeholder="搜索床號..." />
                  </div>
                  <div>
                    <label className="form-label">中文姓名</label>
                    <input type="text" value={advancedFilters.中文姓名} onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)} className="form-input" placeholder="搜索姓名..." />
                  </div>
                  <div>
                    <label className="form-label">逾期狀態</label>
                    <select value={advancedFilters.is_overdue} onChange={(e) => updateAdvancedFilter('is_overdue', e.target.value)} className="form-input">
                      <option value="">所有狀態</option>
                      <option value="是">已逾期</option>
                      <option value="否">未逾期</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">在住狀態</label>
                    <select value={advancedFilters.在住狀態} onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)} className="form-input">
                      <option value="在住">在住</option>
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                      <option value="">全部</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">終止狀態</label>
                    <select value={advancedFilters.is_terminated} onChange={(e) => updateAdvancedFilter('is_terminated', e.target.value)} className="form-input">
                      <option value="">進行中</option>
                      <option value="是">已終止</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {patientTubeCareRecords.length} 筆記錄)</span>
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
                <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {selectedRows.size === allDisplayedRecords.length && allDisplayedRecords.length > 0 ? '取消全選' : '全選'}
                </button>
                <button onClick={handleInvertSelection} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <button onClick={handleBatchDelete} className="text-sm text-red-600 hover:text-red-700 font-medium" disabled={deletingIds.size > 0}>
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

      {/* 喉管護理列表 */}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">詳情</th>
                  <SortableHeader field="execution_date">執行日期</SortableHeader>
                  <SortableHeader field="next_due_date">下次到期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                  <SortableHeader field="created_at">建立日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
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
                                {patient && (
                                  <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" />
                                )}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-1.5">
                          {careTypeIcon(record.care_type)}
                          {record.care_type}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{detailText(record)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(record.execution_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.next_due_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className={getTubeCareStatus(record) === 'overdue' ? 'text-red-600 font-medium' : getTubeCareStatus(record) === 'due_soon' ? 'text-orange-600 font-medium' : ''}>
                              {formatDate(record.next_due_date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {recordIndex === 0
                          ? statusBadge(record)
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">舊記錄</span>
                        }
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(record.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          {recordIndex === 0 && !record.is_terminated && (
                            <button onClick={() => handleRenew(record)} className="text-teal-600 hover:text-teal-900" title="續期" disabled={deletingIds.has(record.id)}>
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {recordIndex === 0 && !record.is_terminated && (
                            <button onClick={() => handleTerminate(record)} className="text-orange-500 hover:text-orange-700" title="終止（不再續期）" disabled={deletingIds.has(record.id)}>
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => handleEdit(record)} className="text-blue-600 hover:text-blue-900" title="編輯" disabled={deletingIds.has(record.id)}>
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-900" title="刪除" disabled={deletingIds.has(record.id)}>
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
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的喉管護理記錄' : '暫無喉管護理記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立喉管護理記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button onClick={handleAdd} className="btn-primary">新增記錄</button>
            ) : (
              <button onClick={clearFilters} className="btn-secondary">清除所有篩選</button>
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
              <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="form-input text-sm w-20">
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
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">上一頁</button>
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
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">下一頁</button>
              </div>
            )}
            <div className="text-sm text-gray-700">第 {currentPage} 頁，共 {totalPages} 頁</div>
          </div>
        </div>
      )}

      {showModal && (
        <TubeCareModal
          record={selectedRecord ?? undefined}
          renewFrom={renewFromRecord}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setRenewFromRecord(null);
          }}
        />
      )}

      {showRecycleBin && (
        <RecordRecycleBinModal
          tables={['patient_tube_care_records']}
          title="喉管護理回收筒"
          patientIdFields={['patient_id']}
          summaryFields={[
            { key: 'care_type', label: '護理類型' },
            { key: 'tube_material', label: '喉管物料' },
            { key: 'tube_size', label: '喉管尺寸' },
            { key: 'execution_date', label: '執行日期' },
            { key: 'next_due_date', label: '下次到期日期' },
            { key: 'notes', label: '備註' },
          ]}
          dateField="execution_date"
          onRestored={() => { refreshAssessmentData(); }}
          onClose={() => setShowRecycleBin(false)}
        />
      )}
    </div>
  );
};

export default TubeCareManagement;
