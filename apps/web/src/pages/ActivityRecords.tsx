import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  PartyPopper,
  Plus,
  Edit3,
  Trash2,
  Search,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { usePatients, type PatientActivityRecord } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import ActivityRecordModal from '../components/ActivityRecordModal';
import ActivityRecordPrintModal from '../components/ActivityRecordPrintModal';
import PatientTooltip from '../components/PatientTooltip';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, compareBedNumbers } from '../utils/searchUtils';
import {
  ACTIVITY_CATEGORY_GROUPS,
  getCurrentMonthCount,
  getActivityRecordOverdueInfo,
} from '../utils/activityRecordStatus';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  狀態: string; // '' | '逾期' | '正常'
  在住狀態: string;
}

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const CATEGORY_LABEL_MAP: Record<string, string> = ACTIVITY_CATEGORY_GROUPS.reduce((acc, group) => {
  group.items.forEach(item => { acc[item.field] = item.label; });
  return acc;
}, {} as Record<string, string>);

const activityChips = (record: PatientActivityRecord) => {
  if (record.is_absent) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">缺席{record.absence_reason ? `：${record.absence_reason}` : ''}</span>;
  }
  const active = Object.entries(CATEGORY_LABEL_MAP).filter(([field]) => (record as any)[field]);
  if (active.length === 0 && !record.other_activity) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([field, label]) => (
        <span key={field} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{label}</span>
      ))}
      {record.other_activity && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">其他：{record.other_activity}</span>
      )}
    </div>
  );
};

const ActivityRecords: React.FC = () => {
  const { patients, activityRecords, deleteActivityRecord, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PatientActivityRecord | null>(null);
  const [addForPatientId, setAddForPatientId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    狀態: '',
    在住狀態: '在住',
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters]);

  if (loading) {
    return <LoadingScreen pageName="活動記錄" />;
  }

  const hasAdvancedFilters = () => {
    return advancedFilters.床號 !== '' || advancedFilters.中文姓名 !== '' || advancedFilters.狀態 !== '' || advancedFilters.在住狀態 !== '在住';
  };

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({ 床號: '', 中文姓名: '', 狀態: '', 在住狀態: '在住' });
  };

  const filteredPatients = useMemo(() => {
    const term = deferredSearch;
    return patients.filter(patient => {
      if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient.在住狀態 !== advancedFilters.在住狀態) {
        return false;
      }
      if (advancedFilters.床號 && !matchBedNumber(patient.床號, advancedFilters.床號)) return false;
      if (advancedFilters.中文姓名 && !matchChineseName(patient.中文姓氏, patient.中文名字, patient.中文姓名, advancedFilters.中文姓名)) return false;
      if (advancedFilters.狀態) {
        const overdueInfo = getActivityRecordOverdueInfo(patient.院友id, activityRecords);
        const isOverdue = overdueInfo.isOverdue;
        if (advancedFilters.狀態 === '逾期' && !isOverdue) return false;
        if (advancedFilters.狀態 === '正常' && isOverdue) return false;
      }
      if (term) {
        return (
          matchChineseName(patient.中文姓氏, patient.中文名字, patient.中文姓名, term) ||
          matchEnglishName(patient.英文姓氏, patient.英文名字, patient.英文姓名, term) ||
          matchBedNumber(patient.床號, term)
        );
      }
      return true;
    }).sort((a, b) => compareBedNumbers(a.床號 || '', b.床號 || ''));
  }, [patients, advancedFilters, deferredSearch, activityRecords]);

  const groupedByPatient = useMemo(() => {
    return filteredPatients.map(patient => {
      const records = activityRecords
        .filter(r => r.patient_id === patient.院友id)
        .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
      return { patient, records };
    });
  }, [filteredPatients, activityRecords]);

  const totalItems = groupedByPatient.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedByPatient.slice(startIndex, endIndex);
  const allDisplayedRecords = paginatedGroups.flatMap(g => {
    const isExpanded = expandedPatients.has(g.patient.院友id);
    return isExpanded ? g.records : g.records.slice(0, 1);
  });

  const togglePatientExpand = (patientId: number) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    setAddForPatientId(undefined);
    setShowModal(true);
  };

  const handleAddForPatient = (patientId: number) => {
    setEditingRecord(null);
    setAddForPatientId(patientId);
    setShowModal(true);
  };

  const handleEdit = (record: PatientActivityRecord) => {
    setEditingRecord(record);
    setAddForPatientId(undefined);
    setShowModal(true);
  };

  const handleDelete = async (record: PatientActivityRecord) => {
    const patient = patients.find(p => p.院友id === record.patient_id);
    if (!confirm(`確定要刪除 ${patient?.中文姓名 ?? ''} 於 ${formatDate(record.record_date)} 的活動記錄嗎？`)) return;
    try {
      setDeletingIds(prev => new Set(prev).add(record.id));
      await deleteActivityRecord(record.id);
      setSelectedRows(prev => { const next = new Set(prev); next.delete(record.id); return next; });
    } catch (error) {
      console.error('刪除活動記錄失敗:', error);
      alert('刪除失敗，請重試');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(record.id); return next; });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.size === 0) {
      alert('請先選擇要刪除的記錄');
      return;
    }
    if (!confirm(`確定要刪除 ${selectedRows.size} 筆活動記錄嗎？\n\n此操作無法復原。`)) return;
    const ids = Array.from(selectedRows);
    setDeletingIds(new Set(ids));
    try {
      for (const id of ids) {
        await deleteActivityRecord(id);
      }
      setSelectedRows(new Set());
    } catch (error) {
      console.error('批量刪除活動記錄失敗:', error);
      alert('批量刪除失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === allDisplayedRecords.length && allDisplayedRecords.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allDisplayedRecords.map(r => r.id)));
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const generatePageNumbers = () => {
    const pages: number[] = [];
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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">活動記錄</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowPrintModal(true)} className="btn-secondary flex flex-wrap items-center gap-2">
              <Printer className="h-4 w-4" />
              <span>列印活動記錄表</span>
            </button>
            <button onClick={handleAdd} className="btn-primary flex flex-wrap items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>新增/批量新增活動記錄</span>
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
                  placeholder="搜索院友姓名或床號..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary flex flex-wrap items-center gap-2 ${showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''} ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                  {hasAdvancedFilters() && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
                  )}
                </button>
                {(searchTerm || hasAdvancedFilters()) && (
                  <button onClick={clearFilters} className="btn-secondary flex flex-wrap items-center gap-2 text-red-600 hover:text-red-700">
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
                    <input type="text" value={advancedFilters.床號} onChange={(e) => updateAdvancedFilter('床號', e.target.value)} className="form-input" placeholder="搜索床號..." />
                  </div>
                  <div>
                    <label className="form-label">中文姓名</label>
                    <input type="text" value={advancedFilters.中文姓名} onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)} className="form-input" placeholder="搜索姓名..." />
                  </div>
                  <div>
                    <label className="form-label">狀態（上月）</label>
                    <select value={advancedFilters.狀態} onChange={(e) => updateAdvancedFilter('狀態', e.target.value)} className="form-input">
                      <option value="">所有狀態</option>
                      <option value="逾期">逾期</option>
                      <option value="正常">正常</option>
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
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友</span>
              {(searchTerm || hasAdvancedFilters()) && <span className="text-blue-600">已套用篩選條件</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 選取控制 */}
      {allDisplayedRecords.length > 0 && (
        <div className="sticky top-40 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {selectedRows.size === allDisplayedRecords.length && allDisplayedRecords.length > 0 ? '取消全選' : '全選'}
                </button>
                {selectedRows.size > 0 && (
                  <button onClick={handleBatchDelete} className="text-sm text-red-600 hover:text-red-700 font-medium" disabled={deletingIds.size > 0}>
                    刪除選定記錄 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">已選擇 {selectedRows.size} / {allDisplayedRecords.length} 筆記錄</div>
            </div>
          </div>
        </div>
      )}

      {/* 活動記錄列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">院友</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">活動類別</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">記錄人員</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroups.map(group => {
                  const patient = group.patient;
                  const isExpanded = expandedPatients.has(patient.院友id);
                  const displayRecords = isExpanded ? group.records : group.records.slice(0, 1);
                  const hasMultiple = group.records.length > 1;
                  const rowCount = Math.max(displayRecords.length, 1);
                  const currentMonthCount = getCurrentMonthCount(patient.院友id, activityRecords);
                  const overdueInfo = getActivityRecordOverdueInfo(patient.院友id, activityRecords);

                  if (displayRecords.length === 0) {
                    return (
                      <tr key={patient.院友id} className="hover:bg-gray-50">
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                              {patient.院友相片 ? (
                                <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                <PatientTooltip patient={patient}>
                                  <span className="cursor-help hover:text-blue-600 transition-colors">{patient.中文姓氏}{patient.中文名字}</span>
                                </PatientTooltip>
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>{patient.床號}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">本月已記 {currentMonthCount} 次</span>
                                {overdueInfo.isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    <AlertTriangle className="h-3 w-3" />逾期
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">正常</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-400" colSpan={3}>尚無活動記錄</td>
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4">
                          <button onClick={() => handleAddForPatient(patient.院友id)} className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                            新增記錄
                          </button>
                        </td>
                      </tr>
                    );
                  }

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
                            rowSpan={rowCount}
                            className="px-4 py-4 whitespace-nowrap w-10 text-center align-middle"
                            onClick={() => hasMultiple && togglePatientExpand(patient.院友id)}
                            style={{ cursor: hasMultiple ? 'pointer' : 'default' }}
                          >
                            {hasMultiple && (
                              <div className="flex flex-col items-center gap-1">
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
                                <span className="text-xs text-blue-600 font-medium">{group.records.length}</span>
                              </div>
                            )}
                          </td>
                          <td rowSpan={rowCount} className="px-4 py-4 whitespace-nowrap align-middle">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                                {patient.院友相片 ? (
                                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  <PatientTooltip patient={patient}>
                                    <span className="cursor-help hover:text-blue-600 transition-colors">{patient.中文姓氏}{patient.中文名字}</span>
                                  </PatientTooltip>
                                </div>
                                <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                                  <span>{patient.床號}</span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">本月已記 {currentMonthCount} 次</span>
                                  {overdueInfo.isOverdue ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                      <AlertTriangle className="h-3 w-3" />逾期
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">正常</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{formatDate(record.record_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{activityChips(record)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{record.notes || '—'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{record.recorder || '—'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-shrink-0 gap-2">
                          <button onClick={() => handleEdit(record)} className="text-blue-600 hover:text-blue-900" title="編輯" disabled={deletingIds.has(record.id)}>
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(record)} className="text-red-600 hover:text-red-900" title="刪除" disabled={deletingIds.has(record.id)}>
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
            <PartyPopper className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的院友' : '暫無院友資料'}
            </h3>
            {(searchTerm || hasAdvancedFilters()) && (
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
                <option value={999999}>全部</option>
              </select>
              <span className="text-sm text-gray-700">位院友</span>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">上一頁</button>
                {generatePageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm border rounded-md ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">下一頁</button>
              </div>
            )}
            <div className="text-sm text-gray-700">第 {currentPage} 頁，共 {totalPages} 頁</div>
          </div>
        </div>
      )}

      {showModal && (
        <ActivityRecordModal
          record={editingRecord ?? undefined}
          defaultPatientId={addForPatientId}
          onClose={() => {
            setShowModal(false);
            setEditingRecord(null);
            setAddForPatientId(undefined);
          }}
        />
      )}

      {showPrintModal && (
        <ActivityRecordPrintModal onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
};

export default ActivityRecords;
