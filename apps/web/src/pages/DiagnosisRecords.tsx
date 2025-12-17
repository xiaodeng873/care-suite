import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Filter,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { usePatients, type DiagnosisRecord } from '../context/PatientContext';
import DiagnosisRecordModal from '../components/DiagnosisRecordModal';
import PatientTooltip from '../components/PatientTooltip';

type SortField = '院友姓名' | 'diagnosis_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  diagnosis_item: string;
  diagnosis_unit: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const DiagnosisRecords: React.FC = () => {
  const { diagnosisRecords, patients, deleteDiagnosisRecord, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>();
  const [selectedPatientRecords, setSelectedPatientRecords] = useState<DiagnosisRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('diagnosis_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    diagnosis_item: '',
    diagnosis_unit: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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

  const hasAdvancedFilters = () => {
    return advancedFilters.床號 || advancedFilters.中文姓名 || advancedFilters.diagnosis_item ||
           advancedFilters.diagnosis_unit || advancedFilters.startDate || advancedFilters.endDate ||
           (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '在住');
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
      diagnosis_item: '',
      diagnosis_unit: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const groupedByPatient = diagnosisRecords.reduce((acc, record) => {
    const patientId = record.patient_id;
    if (!acc[patientId]) {
      acc[patientId] = [];
    }
    acc[patientId].push(record);
    return acc;
  }, {} as Record<number, DiagnosisRecord[]>);

  const patientGroups = Object.entries(groupedByPatient).map(([patientId, records]) => ({
    patientId: parseInt(patientId),
    records: records.sort((a, b) =>
      new Date(b.diagnosis_date).getTime() - new Date(a.diagnosis_date).getTime()
    )
  }));

  const filteredPatientGroups = patientGroups.filter(group => {
    const patient = patients.find(p => p.院友id === group.patientId);
    if (!patient) return false;

    const matchesSearch = !searchTerm ||
      patient.中文姓名?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.床號?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.records.some(r =>
        r.diagnosis_item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.diagnosis_unit?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesBedNumber = !advancedFilters.床號 ||
      patient.床號?.includes(advancedFilters.床號);

    const matchesName = !advancedFilters.中文姓名 ||
      patient.中文姓名?.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase());

    const matchesDiagnosisItem = !advancedFilters.diagnosis_item ||
      group.records.some(r => r.diagnosis_item?.toLowerCase().includes(advancedFilters.diagnosis_item.toLowerCase()));

    const matchesDiagnosisUnit = !advancedFilters.diagnosis_unit ||
      group.records.some(r => r.diagnosis_unit?.toLowerCase().includes(advancedFilters.diagnosis_unit.toLowerCase()));

    const matchesResidencyStatus = !advancedFilters.在住狀態 ||
      patient.在住狀態 === advancedFilters.在住狀態;

    let matchesDateRange = true;
    if (advancedFilters.startDate && advancedFilters.endDate) {
      const startDate = new Date(advancedFilters.startDate);
      const endDate = new Date(advancedFilters.endDate);
      matchesDateRange = group.records.some(r => {
        const recordDate = new Date(r.diagnosis_date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    return matchesSearch && matchesBedNumber && matchesName && matchesDiagnosisItem &&
           matchesDiagnosisUnit && matchesResidencyStatus && matchesDateRange;
  });

  const sortedPatientGroups = [...filteredPatientGroups].sort((a, b) => {
    let valueA: any;
    let valueB: any;

    if (sortField === '院友姓名') {
      const patientA = patients.find(p => p.院友id === a.patientId);
      const patientB = patients.find(p => p.院友id === b.patientId);
      valueA = patientA?.中文姓名 || '';
      valueB = patientB?.中文姓名 || '';
    } else if (sortField === 'diagnosis_date') {
      valueA = a.records[0]?.diagnosis_date || '';
      valueB = b.records[0]?.diagnosis_date || '';
    } else if (sortField === 'created_at') {
      valueA = a.records[0]?.created_at || '';
      valueB = b.records[0]?.created_at || '';
    }

    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });

  const totalItems = sortedPatientGroups.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPatientGroups = sortedPatientGroups.slice(startIndex, endIndex);

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

  const handleAddForPatient = (patientId: number) => {
    const patientRecords = diagnosisRecords.filter(r => r.patient_id === patientId);
    setSelectedPatientId(patientId);
    setSelectedPatientRecords(patientRecords);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const record = diagnosisRecords.find(r => r.id === id);
    const patient = patients.find(p => p.院友id === record?.patient_id);

    if (confirm(`確定要刪除 ${patient?.中文姓名} 的診斷記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteDiagnosisRecord(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除診斷記錄失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆診斷記錄嗎？\n\n此操作無法復原。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));

    try {
      for (const recordId of deletingArray) {
        await deleteDiagnosisRecord(recordId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆診斷記錄`);
    } catch (error) {
      console.error('批量刪除診斷記錄失敗:', error);
      alert('批量刪除診斷記錄失敗，請重試');
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
    const allRecordIds = paginatedPatientGroups.flatMap(g => g.records.map(r => r.id));
    if (selectedRows.size === allRecordIds.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allRecordIds));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedPatientGroups.forEach(group => {
      group.records.forEach(record => {
        if (!selectedRows.has(record.id)) {
          newSelected.add(record.id);
        }
      });
    });
    setSelectedRows(newSelected);
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">診斷記錄</h1>
          <button
            onClick={() => {
              setSelectedPatientId(undefined);
              setSelectedPatientRecords([]);
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增診斷記錄</span>
          </button>
        </div>
      </div>

      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、診斷項目或醫院..."
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
                  <label className="form-label">診斷日期區間</label>
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">床號</label>
                    <input
                      type="text"
                      value={advancedFilters.床號}
                      onChange={(e) => updateAdvancedFilter('床號', e.target.value)}
                      className="form-input"
                      placeholder="輸入床號"
                    />
                  </div>

                  <div>
                    <label className="form-label">院友姓名</label>
                    <input
                      type="text"
                      value={advancedFilters.中文姓名}
                      onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)}
                      className="form-input"
                      placeholder="輸入姓名"
                    />
                  </div>

                  <div>
                    <label className="form-label">診斷項目</label>
                    <input
                      type="text"
                      value={advancedFilters.diagnosis_item}
                      onChange={(e) => updateAdvancedFilter('diagnosis_item', e.target.value)}
                      className="form-input"
                      placeholder="輸入診斷項目"
                    />
                  </div>

                  <div>
                    <label className="form-label">診斷單位</label>
                    <input
                      type="text"
                      value={advancedFilters.diagnosis_unit}
                      onChange={(e) => updateAdvancedFilter('diagnosis_unit', e.target.value)}
                      className="form-input"
                      placeholder="輸入醫院名稱"
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

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆診斷記錄 (共 {diagnosisRecords.length} 筆)</span>
              {(searchTerm || hasAdvancedFilters()) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="sticky top-40 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedPatientGroups.flatMap(g => g.records).length ? '取消全選' : '全選'}
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

      <div className="card overflow-hidden">
        {paginatedPatientGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size > 0 && selectedRows.size === paginatedPatientGroups.flatMap(g => g.records).length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    診斷記錄 (日期 | 項目 | 單位)
                  </th>
                  <SortableHeader field="created_at">最新建立</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatientGroups.map(group => {
                  const patient = patients.find(p => p.院友id === group.patientId);
                  const hasAnyDeleting = group.records.some(r => deletingIds.has(r.id));
                  const allSelected = group.records.every(r => selectedRows.has(r.id));
                  const someSelected = group.records.some(r => selectedRows.has(r.id));

                  return (
                    <tr
                      key={group.patientId}
                      className={`hover:bg-gray-50 ${hasAnyDeleting ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={input => {
                            if (input) {
                              input.indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onChange={() => {
                            const newSelected = new Set(selectedRows);
                            if (allSelected) {
                              group.records.forEach(r => newSelected.delete(r.id));
                            } else {
                              group.records.forEach(r => newSelected.add(r.id));
                            }
                            setSelectedRows(newSelected);
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {patient ? (
                          <PatientTooltip patient={patient}>
                            <div className="flex items-center space-x-3">
                              {patient.院友相片 ? (
                                <img
                                  src={patient.院友相片}
                                  alt={patient.中文姓名}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <User className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{patient.中文姓名}</p>
                                <p className="text-sm text-gray-500">床號: {patient.床號}</p>
                                <p className="text-xs text-blue-600">共 {group.records.length} 筆記錄</p>
                              </div>
                            </div>
                          </PatientTooltip>
                        ) : (
                          <span className="text-gray-400">院友已刪除</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          {group.records.map((record, index) => {
                            const isDeleting = deletingIds.has(record.id);
                            return (
                              <div
                                key={record.id}
                                className={`flex items-center space-x-2 p-2 rounded ${
                                  selectedRows.has(record.id) ? 'bg-blue-50' : 'bg-gray-50'
                                } ${isDeleting ? 'opacity-50' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(record.id)}
                                  onChange={() => handleSelectRow(record.id)}
                                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-xs text-gray-600 min-w-[80px]">
                                  {new Date(record.diagnosis_date).toLocaleDateString('zh-TW')}
                                </span>
                                <span className="text-sm text-gray-900 font-medium flex-1">
                                  {record.diagnosis_item}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {record.diagnosis_unit}
                                </span>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="刪除此記錄"
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-gray-600 text-sm">
                          {new Date(group.records[0].created_at).toLocaleDateString('zh-TW')}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          onClick={() => handleAddForPatient(group.patientId)}
                          className="btn-secondary text-sm flex items-center space-x-1"
                          title="新增記錄"
                        >
                          <Plus className="h-4 w-4" />
                          <span>新增</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">沒有診斷記錄</h3>
            <p className="mt-1 text-sm text-gray-500">開始新增第一筆診斷記錄</p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setSelectedPatientId(undefined);
                  setSelectedPatientRecords([]);
                  setShowModal(true);
                }}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增診斷記錄</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">每頁顯示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="form-input w-20"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">筆</span>
            </div>

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

            <div className="text-sm text-gray-700">
              第 {currentPage} 頁，共 {totalPages} 頁
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <DiagnosisRecordModal
          patientId={selectedPatientId}
          existingRecords={selectedPatientRecords}
          onClose={() => {
            setShowModal(false);
            setSelectedPatientId(undefined);
            setSelectedPatientRecords([]);
          }}
        />
      )}
    </div>
  );
};

export default DiagnosisRecords;
