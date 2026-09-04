import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, compareBedNumbers, matchPatientBedNumber} from '../utils/searchUtils';
import { LoadingScreen } from '../components/PageLoadingScreen';
import {
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  User,
  Calendar,
  MapPin,
  ChevronUp,
  ChevronDown,
  X,
  FileText,
  Printer
} from 'lucide-react';
import { usePatientData, useFilteredPatients, type IncidentReport } from '../context/PatientContext';
import BedNumberImprint from '../components/BedNumberImprint';
import IncidentReportModal from '../components/IncidentReportModal';
import PatientTooltip from '../components/PatientTooltip';
import RecordRecycleBinModal from '../components/RecordRecycleBinModal';

import { generatePatientPrintBundle } from '../utils/patientPrintBundleGenerator';
import PatientPrintModal from '../components/PatientPrintModal';
import { formatDisplayDate } from '../utils/dateFormat';
import DateInput from '../components/DateInput';


type SortField = '院友姓名' | 'incident_date' | 'incident_type' | 'location' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  incident_type: string;
  location: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const IncidentReports: React.FC = () => {
  const { incidentReports, deleteIncidentReport, refreshData, loading } = usePatientData();
  const patients = useFilteredPatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('incident_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    incident_type: '',
    location: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="意外事故報告" />;
  }

  const hasAdvancedFilters = () => {
    return advancedFilters.床號 || advancedFilters.中文姓名 || advancedFilters.incident_type ||
           advancedFilters.location || advancedFilters.startDate || advancedFilters.endDate ||
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
      incident_type: '',
      location: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const filteredReports = useMemo(() => {
    const searchTerm = deferredSearch;
    return incidentReports.filter(report => {
    const patient = patients.find(p => p.院友id === report.patient_id);

    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !matchPatientBedNumber(patient, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.incident_type && report.incident_type !== advancedFilters.incident_type) {
      return false;
    }
    if (advancedFilters.location && report.location !== advancedFilters.location) {
      return false;
    }

    if (advancedFilters.startDate || advancedFilters.endDate) {
      const incidentDate = report.incident_date ? new Date(report.incident_date) : null;
      if (incidentDate) {
        if (advancedFilters.startDate && incidentDate < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && incidentDate > new Date(advancedFilters.endDate)) {
          return false;
        }
      }
    }

    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
                         fuzzyMatch(patient?.身份證號碼, searchTerm) ||
                         matchPatientBedNumber(patient, searchTerm) ||
                         fuzzyMatch(report.location, searchTerm) ||
                         false;
    }

    return matchesSearch;
    });
  }, [incidentReports, patients, advancedFilters, deferredSearch]);

  const sortedReports = [...filteredReports].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);

    let valueA: string | number = '';
    let valueB: string | number = '';

    switch (sortField) {
      case '院友姓名': {
        const bedCmp = compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
        return sortDirection === 'asc' ? bedCmp : -bedCmp;
      }
      case 'incident_date':
        valueA = a.incident_date ? new Date(a.incident_date).getTime() : 0;
        valueB = b.incident_date ? new Date(b.incident_date).getTime() : 0;
        break;
      case 'incident_type':
        valueA = a.incident_type || '';
        valueB = b.incident_type || '';
        break;
      case 'location':
        valueA = a.location || '';
        valueB = b.location || '';
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

  const selectedPatientIdsForPrint = useMemo(() => {
    const ids = new Set<number>();
    selectedRows.forEach(reportId => {
      const report = incidentReports.find(r => r.id === reportId);
      if (report) ids.add(report.patient_id);
    });
    return Array.from(ids);
  }, [selectedRows, incidentReports]);

  const totalItems = sortedReports.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedReports = sortedReports.slice(startIndex, endIndex);

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
    setSelectedReport(null);
    setShowModal(true);
  };

  const handleEdit = (report: IncidentReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除此意外事件報告嗎？')) {
      setDeletingIds(prev => new Set(prev).add(id));
      try {
        await deleteIncidentReport(id);
      } catch (error) {
        console.error('刪除意外事件報告失敗:', error);
        alert('刪除失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedReports.length && paginatedReports.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedReports.map(r => r.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedReports.forEach(report => {
      if (!selectedRows.has(report.id)) {
        newSelected.add(report.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleBatchPrint = () => {
    if (selectedRows.size === 0) {
      alert('請先選擇要列印的記錄');
      return;
    }
    setShowPrintModal(true);
  };

  const handleBatchDelete = async () => {
    if (selectedRows.size === 0) {
      alert('請先選擇要刪除的記錄');
      return;
    }

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆意外事件報告嗎？\n\n此操作無法復原。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));

    try {
      for (const reportId of deletingArray) {
        await deleteIncidentReport(reportId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆意外事件報告`);
    } catch (error) {
      console.error('批量刪除意外事件報告失敗:', error);
      alert('批量刪除意外事件報告失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleRowSelect = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4 inline ml-1" /> :
      <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="card">
        <div className="p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">意外事件報告</h1>
                <p className="text-sm text-gray-500 mt-1">
                  共 {totalItems} 個報告
                  {selectedRows.size > 0 && ` • 已選擇 ${selectedRows.size} 個`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBatchPrint}
                className="btn-secondary flex flex-wrap items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>列印</span>
                {selectedRows.size > 0 && (
                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {selectedRows.size}
                  </span>
                )}
              </button>
              <button
                onClick={handleAdd}
                className="btn-primary flex flex-wrap items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增意外事件報告</span>
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
                  placeholder="搜索院友姓名、床號、地點..."
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
                  <label className="form-label">意外日期區間</label>
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
                    <label className="form-label">事故性質</label>
                    <select
                      value={advancedFilters.incident_type}
                      onChange={(e) => updateAdvancedFilter('incident_type', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="跌倒">跌倒</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">地點</label>
                    <select
                      value={advancedFilters.location}
                      onChange={(e) => updateAdvancedFilter('location', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有地點</option>
                      <option value="客廳/飯廳">客廳/飯廳</option>
                      <option value="走廊">走廊</option>
                      <option value="廁所">廁所</option>
                      <option value="浴室">浴室</option>
                      <option value="床邊">床邊</option>
                      <option value="其他地方">其他地方</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">在住狀態</label>
                    <select
                      value={advancedFilters.在住狀態}
                      onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="全部">所有狀態</option>
                      <option value="在住">在住</option>
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
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
                  {selectedRows.size === paginatedReports.length ? '取消全選' : '全選'}
                </button>
                <button
                  onClick={handleInvertSelection}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <>
                    

                    <button
                      onClick={handleBatchDelete}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                      disabled={deletingIds.size > 0}
                    >
                      刪除選定記錄 ({selectedRows.size})
                    </button>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[768px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedReports.length && paginatedReports.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('院友姓名')}
                >
                  <div className="flex items-center">
                    院友
                    {renderSortIcon('院友姓名')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('incident_date')}
                >
                  <div className="flex items-center">
                    意外日期
                    {renderSortIcon('incident_date')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  意外時間
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('incident_type')}
                >
                  <div className="flex items-center">
                    事故性質
                    {renderSortIcon('incident_type')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('location')}
                >
                  <div className="flex items-center">
                    地點
                    {renderSortIcon('location')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  填報人
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">建立日期</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-base">暫無意外事件報告</p>
                    <p className="text-sm mt-1">請點擊上方按鈕新增報告</p>
                  </td>
                </tr>
              ) : (
                paginatedReports.map(report => {
                  const patient = patients.find(p => p.院友id === report.patient_id);
                  const isDeleting = deletingIds.has(report.id);

                  return (
                    <tr
                      key={report.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isDeleting ? 'opacity-50' : ''}`}
                      onDoubleClick={() => {
                        setSelectedReport(report);
                        setShowModal(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(report.id)}
                          onChange={() => handleRowSelect(report.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {patient ? (
                          <PatientTooltip patient={patient}>
                            <div className="flex flex-wrap items-center gap-3 cursor-pointer">
                              {patient.院友相片 ? (
                                <img
                                  src={patient.院友相片}
                                  alt={patient.中文姓名}
                                  className="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <User className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{patient.中文姓名}</div>
                                <div className="text-sm text-gray-500"><BedNumberImprint patient={patient} size="sm" /></div>
                              </div>
                            </div>
                          </PatientTooltip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{report.incident_date || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{report.incident_time || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {report.incident_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{report.location || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{report.reporter_signature || '-'}</div>
                        <div className="text-xs text-gray-500">{report.reporter_position || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500">{report.created_at ? formatDisplayDate(report.created_at) : '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          

                          <button
                            onClick={() => handleEdit(report)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編輯"
                            disabled={isDeleting}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(report.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="刪除"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分頁控制 */}
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

      {/* 隱藏的列印 iframe */}
      {/* NOTE: printIncidentReport 會自己建立 iframe，所以這裡不需要再掛 ref */}

      {showModal && (
        <IncidentReportModal
          report={selectedReport || undefined}
          onClose={() => {
            setShowModal(false);
            setSelectedReport(null);
          }}
        />
      )}

      {showPrintModal && (
        <PatientPrintModal
          patients={patients}
          initialSelectedPatientIds={selectedPatientIdsForPrint}
          initialSelectedDocumentIds={['accident_report']}
          initialStartDate={advancedFilters.startDate}
          initialEndDate={advancedFilters.endDate}
          initialTab="常用表格"
          onClose={() => setShowPrintModal(false)}
          onPrint={(selectedPatients, selectedDocuments, startDate, endDate, contentMode, printOptions) => {
            generatePatientPrintBundle({
              patients: selectedPatients,
              documentIds: selectedDocuments,
              startDate,
              endDate,
              contentMode,
              printOptions: {
                ...printOptions,
                selectedIncidentReportIds: Array.from(selectedRows),
              },
            });
            setShowPrintModal(false);
          }}
        />
      )}

      {showRecycleBin && (
        <RecordRecycleBinModal
          tables={['incident_reports']}
          title="意外事件回收筒"
          patientIdFields={['patient_id']}
          summaryFields={[
            { key: 'incident_date', label: '意外日期' },
            { key: 'incident_type', label: '事故性質' },
            { key: 'location', label: '地點' },
            { key: 'reporter_signature', label: '填報人' },
          ]}
          dateField="incident_date"
          onRestored={refreshData}
          onClose={() => setShowRecycleBin(false)}
        />
      )}
    </div>
  );
};

export default IncidentReports;
