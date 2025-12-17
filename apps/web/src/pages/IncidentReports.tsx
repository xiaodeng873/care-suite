import React, { useState } from 'react';
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
  Download,
  FileText
} from 'lucide-react';
import { usePatients, type IncidentReport } from '../context/PatientContext';
import IncidentReportModal from '../components/IncidentReportModal';
import PatientTooltip from '../components/PatientTooltip';
import { generateIncidentReportWord } from '../utils/incidentReportWordGenerator';
import { getTemplatesMetadata, downloadTemplateFile } from '../lib/database';

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
  const { incidentReports, patients, deleteIncidentReport, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('incident_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set());

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

  const filteredReports = incidentReports.filter(report => {
    const patient = patients.find(p => p.院友id === report.patient_id);

    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
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
      matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         false;
    }

    return matchesSearch;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);

    let valueA: string | number = '';
    let valueB: string | number = '';

    switch (sortField) {
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
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

  const handleExportWord = async (report: IncidentReport) => {
    setExportingIds(prev => new Set(prev).add(report.id));

    try {
      // 查找院友資料
      const patient = patients.find(p => p.院友id === report.patient_id);
      if (!patient) {
        alert('找不到院友資料');
        return;
      }

      // 獲取意外事件報告範本
      const templates = await getTemplatesMetadata();
      const incidentTemplate = templates.find(t => t.type === 'incident-report');

      if (!incidentTemplate) {
        alert('找不到意外事件報告範本，請先在範本管理中上傳 Word 範本');
        return;
      }

      // 下載範本檔案
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/templates/${incidentTemplate.storage_path}`
      );

      if (!response.ok) {
        throw new Error('無法載入範本檔案');
      }

      const templateArrayBuffer = await response.arrayBuffer();

      // 生成 Word 文件
      await generateIncidentReportWord(report, patient, templateArrayBuffer);

    } catch (error) {
      console.error('匯出 Word 失敗:', error);
      alert(`匯出失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setExportingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(report.id);
        return newSet;
      });
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
            <div className="flex items-center space-x-3">
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
            <button
              onClick={handleAdd}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增意外事件報告</span>
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
                  placeholder="搜索院友姓名、床號、地點..."
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
                  <label className="form-label">意外日期區間</label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
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

      {/* 表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
                  const isExporting = exportingIds.has(report.id);

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
                            <div className="flex items-center space-x-3 cursor-pointer">
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
                                <div className="text-sm text-gray-500">{patient.床號}</div>
                              </div>
                            </div>
                          </PatientTooltip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
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
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{report.location || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{report.reporter_signature || '-'}</div>
                        <div className="text-xs text-gray-500">{report.reporter_position || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleExportWord(report)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="匯出Word"
                            disabled={isDeleting || isExporting}
                          >
                            {isExporting ? (
                              <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(report)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編輯"
                            disabled={isDeleting || isExporting}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(report.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="刪除"
                            disabled={isDeleting || isExporting}
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
            <div className="flex items-center space-x-2">
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
            )}

            <div className="text-sm text-gray-700">
              第 {currentPage} 頁，共 {totalPages} 頁
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <IncidentReportModal
          report={selectedReport || undefined}
          onClose={() => {
            setShowModal(false);
            setSelectedReport(null);
          }}
        />
      )}
    </div>
  );
};

export default IncidentReports;
