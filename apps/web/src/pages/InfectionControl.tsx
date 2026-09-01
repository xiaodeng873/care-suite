import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  User,
  Calendar,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle
} from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import InfectionControlModal from '../components/InfectionControlModal';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, matchPatientBedNumber} from '../utils/searchUtils';
import { getInfectionTypeColors } from '../utils/infectionTypeColors';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import { type InfectionControlRecord } from '../lib/database';
import { formatDisplayDate } from '../utils/dateFormat';


type SortField = '院友姓名' | 'diagnosis_date' | 'recovery_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  infection_type: string;
  在住狀態: string;
  recovered: string;
}

const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  床號: '',
  中文姓名: '',
  infection_type: '',
  在住狀態: '在住',
  recovered: '',
};

const InfectionControl: React.FC = () => {
  const { infectionControlRecords, allPatients, deleteInfectionControlRecord, loading } = usePatientData();
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InfectionControlRecord | null>(null);
  const [prefilledPatientId, setPrefilledPatientId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('diagnosis_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="感染控制" />;
  }

  const filteredRecords = useMemo(() => {
    const search = deferredSearch;
    return infectionControlRecords.filter(record => {
      const patient = allPatients.find(p => p.院友id === record.patient_id);

      if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
        return false;
      }
      if (advancedFilters.床號 && !matchPatientBedNumber(patient, advancedFilters.床號)) {
        return false;
      }
      if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
        return false;
      }
      if (advancedFilters.infection_type && !fuzzyMatch(record.infection_type, advancedFilters.infection_type)) {
        return false;
      }
      if (advancedFilters.recovered) {
        const hasRecovery = !!record.recovery_date;
        if (advancedFilters.recovered === '是' && !hasRecovery) return false;
        if (advancedFilters.recovered === '否' && hasRecovery) return false;
      }

      let matchesSearch = true;
      if (search) {
        matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, search) ||
                       matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, search) ||
                       fuzzyMatch(patient?.身份證號碼, search) ||
                       matchPatientBedNumber(patient, search) ||
                       fuzzyMatch(record.infection_type, search);
      }
      return matchesSearch;
    });
  }, [infectionControlRecords, allPatients, advancedFilters, deferredSearch]);

  const hasAdvancedFilters = () => {
    return Object.entries(advancedFilters).some(
      ([key, value]) => value !== DEFAULT_ADVANCED_FILTERS[key as keyof AdvancedFilters]
    );
  };

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
  };

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const patientA = allPatients.find(p => p.院友id === a.patient_id);
    const patientB = allPatients.find(p => p.院友id === b.patient_id);
    let valueA: string | number = '';
    let valueB: string | number = '';

    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case 'diagnosis_date':
        valueA = a.diagnosis_date ? new Date(a.diagnosis_date).getTime() : 0;
        valueB = b.diagnosis_date ? new Date(b.diagnosis_date).getTime() : 0;
        break;
      case 'recovery_date':
        valueA = a.recovery_date ? new Date(a.recovery_date).getTime() : 0;
        valueB = b.recovery_date ? new Date(b.recovery_date).getTime() : 0;
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

  const groupedRecords = (() => {
    const seen = new Set<number>();
    const groups: { patientId: number; records: InfectionControlRecord[] }[] = [];
    sortedRecords.forEach(r => {
      if (!seen.has(r.patient_id)) {
        seen.add(r.patient_id);
        groups.push({ patientId: r.patient_id, records: [r] });
      } else {
        groups.find(g => g.patientId === r.patient_id)!.records.push(r);
      }
    });
    groups.forEach(g => g.records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      for (let i = start; i <= end; i++) pages.push(i);
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

  const handleEdit = (record: InfectionControlRecord) => {
    setSelectedRecord(record);
    setPrefilledPatientId(null);
    setShowModal(true);
  };

  const handleAdd = (patientId?: number) => {
    setSelectedRecord(null);
    setPrefilledPatientId(patientId || null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const record = infectionControlRecords.find(r => r.id === id);
    const patient = allPatients.find(p => p.院友id === record?.patient_id);
    if (confirm(`確定要刪除 ${patient?.中文姓名 || '此院友'} 的感染控制記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteInfectionControlRecord(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除感染控制記錄失敗，請重試');
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
    if (!confirm(`確定要刪除 ${selectedRows.size} 筆感染控制記錄嗎？\n\n此操作無法復原。`)) {
      return;
    }
    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    try {
      for (const recordId of deletingArray) {
        await deleteInfectionControlRecord(recordId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆感染控制記錄`);
    } catch (error) {
      console.error('批量刪除感染控制記錄失敗:', error);
      alert('批量刪除失敗，請重試');
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

  const activeRecordCount = filteredRecords.filter(r => !r.recovery_date).length;
  const recoveredRecordCount = filteredRecords.filter(r => !!r.recovery_date).length;

  // 按感染性質動態統計（只顯示實際存在的性質），計算活躍院友人數
  const infectionTypeStats = useMemo(() => {
    const activeRecords = filteredRecords.filter(r => !r.recovery_date);
    const types = Array.from(new Set(activeRecords.map(r => (r.infection_type || '未分類').trim()))).sort();
    return types.map(type => {
      const patientIds = new Set<number>();
      const names: React.ReactNode[] = [];
      activeRecords
        .filter(r => (r.infection_type || '未分類').trim() === type)
        .forEach(r => {
          if (!patientIds.has(r.patient_id)) {
            patientIds.add(r.patient_id);
            const p = allPatients.find(patient => patient.院友id === r.patient_id);
            names.push(p ? <><BedNumberImprint patient={p} size="sm" /> {p.中文姓氏}{p.中文名字}</> : `院友 #${r.patient_id}`);
          }
        });
      return { type, count: patientIds.size, names };
    });
  }, [filteredRecords, allPatients]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">感染控制</h1>
          <button
            onClick={() => handleAdd()}
            className="btn-primary flex flex-wrap items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增感染控制記錄</span>
          </button>
        </div>
      </div>

      {/* 感染統計卡片（動態，只顯示現存性質） */}
      {infectionTypeStats.length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">感染控制統計</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {infectionTypeStats.map(({ type, count, names }) => {
              const colors = getInfectionTypeColors(type);
              return (
                <div
                  key={type}
                  className={`${colors.bgColor} p-4 rounded-lg relative cursor-pointer group`}
                >
                  <p className="text-sm text-gray-600">{type}</p>
                  <p className={`text-2xl font-bold ${colors.textColor}`}>{count}</p>
                  <p className="text-xs text-gray-500">活躍院友</p>
                  {names.length > 0 && (
                    <div className="absolute z-50 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl -top-2 left-full ml-2 w-48 max-h-64 overflow-y-auto">
                      <div className="font-semibold mb-2">院友名單:</div>
                      <ul className="space-y-1">
                        {names.map((name, idx) => (
                          <li key={idx} className="text-gray-200">{name}</li>
                        ))}
                      </ul>
                      <div className="absolute w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-900 -left-2 top-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 搜索和篩選 */}
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、感染性質..."
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <label className="form-label">感染性質</label>
                    <input
                      type="text"
                      value={advancedFilters.infection_type}
                      onChange={(e) => updateAdvancedFilter('infection_type', e.target.value)}
                      className="form-input"
                      placeholder="例如 MRSA"
                    />
                  </div>
                  <div>
                    <label className="form-label">康復狀態</label>
                    <select
                      value={advancedFilters.recovered}
                      onChange={(e) => updateAdvancedFilter('recovered', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="否">未康復</option>
                      <option value="是">已康復</option>
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
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {infectionControlRecords.length} 筆記錄)</span>
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

      {/* 感染控制列表 */}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    感染記錄
                  </th>
                  <SortableHeader field="diagnosis_date">確診日期</SortableHeader>
                  <SortableHeader field="recovery_date">康復日期</SortableHeader>
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
                  const patient = allPatients.find(p => p.院友id === group.patientId);
                  const isExpanded = expandedPatients.has(group.patientId);
                  const displayRecords = isExpanded ? group.records : [group.records[0]];
                  const hasMultiple = group.records.length > 1;

                  return displayRecords.map((record, recordIndex) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 ${selectedRows.has(record.id) ? 'bg-blue-50' : ''}`}
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
                              <div className="w-10 h-10 bg-purple-100 rounded-full overflow-hidden flex items-center justify-center">
                                {patient?.院友相片 ? (
                                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-purple-600" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {patient ? (
                                    <PatientTooltip patient={patient}>
                                      <span className="cursor-help hover:text-purple-600 transition-colors">
                                        {patient.中文姓氏}{patient.中文名字}
                                      </span>
                                    </PatientTooltip>
                                  ) : '-'}
                                </div>
                                <div className="text-sm text-gray-500">{patient ? <BedNumberImprint patient={patient} size="sm" /> : null}</div>
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          {(() => {
                            const colors = getInfectionTypeColors(record.infection_type);
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bgColor} ${colors.textColor}`}>
                                {record.infection_type}
                              </span>
                            );
                          })()}
                          {record.recovery_date && (
                            <span className="text-xs text-green-600">已康復</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>
                            {record.diagnosis_date === '1900-01-01'
                              ? '未知'
                              : formatDisplayDate(record.diagnosis_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className={record.recovery_date ? '' : 'text-gray-400'}>
                            {record.recovery_date
                              ? formatDisplayDate(record.recovery_date)
                              : '未康復'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={record.notes ? '' : 'text-gray-400'}>
                          {record.notes || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDisplayDate(record.created_at)}
                      </td>
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
            <Shield className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的感染控制記錄' : '暫無感染控制記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始為院友建立感染控制記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => handleAdd()}
                className="btn-primary"
              >
                新增感染控制記錄
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

      {/* Pagination */}
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
        <InfectionControlModal
          record={selectedRecord}
          prefilledPatientId={prefilledPatientId}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setPrefilledPatientId(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setPrefilledPatientId(null);
          }}
        />
      )}
    </div>
  );
};

export default InfectionControl;
