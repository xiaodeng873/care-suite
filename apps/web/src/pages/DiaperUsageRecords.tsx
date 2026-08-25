import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Baby,
  Plus,
  Edit3,
  Trash2,
  Search,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  CheckCircle,
  FileText
} from 'lucide-react';
import { usePatientData, useFilteredPatients } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import DiaperUsageRecordModal from '../components/DiaperUsageRecordModal';
import { matchChineseName, matchEnglishName, matchBedNumber, compareBedNumbers } from '../utils/searchUtils';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import * as db from '../lib/database';
import type { DiaperUsageRecord } from '../lib/database';
import { daysInMonth } from '../utils/diaperUsageGenerator';

const DiaperUsageRecords: React.FC = () => {
  const { loading } = usePatientData();
  const patients = useFilteredPatients();
  const [records, setRecords] = useState<DiaperUsageRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DiaperUsageRecord | null>(null);
  const [copyFromRecord, setCopyFromRecord] = useState<DiaperUsageRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const data = await db.getDiaperUsageRecords();
      setRecords(data);
    } catch (error) {
      console.error('載入尿片記錄失敗:', error);
      alert('載入尿片記錄失敗，請重試');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    const term = deferredSearch.trim();
    if (!term) return records;
    return records.filter(record => {
      const patient = patients.find(p => p.院友id === record.patient_id);
      if (!patient) return false;
      return (
        matchChineseName(patient.中文姓氏, patient.中文名字, patient.中文姓名, term) ||
        matchEnglishName(patient.英文姓氏, patient.英文名字, patient.英文姓名, term) ||
        matchBedNumber(patient.床號, term)
      );
    });
  }, [records, patients, deferredSearch]);

  // 依床號排序
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const patientA = patients.find(p => p.院友id === a.patient_id);
      const patientB = patients.find(p => p.院友id === b.patient_id);
      return compareBedNumbers(patientA?.床號 || '', patientB?.床號 || '');
    });
  }, [filteredRecords, patients]);

  // 依 patient_id 分組，組內依 年月 desc（最新月份在前）
  const groupedRecords = (() => {
    const seen = new Set<number>();
    const groups: { patientId: number; records: DiaperUsageRecord[] }[] = [];
    sortedRecords.forEach(r => {
      if (!seen.has(r.patient_id)) {
        seen.add(r.patient_id);
        groups.push({ patientId: r.patient_id, records: [r] });
      } else {
        groups.find(g => g.patientId === r.patient_id)!.records.push(r);
      }
    });
    groups.forEach(g => g.records.sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month)));
    return groups;
  })();

  const totalItems = groupedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = groupedRecords.slice(startIndex, endIndex);

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
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

  const togglePatientExpand = (patientId: number) => {
    setExpandedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) newSet.delete(patientId);
      else newSet.add(patientId);
      return newSet;
    });
  };

  const handleEdit = (record: DiaperUsageRecord) => {
    setSelectedRecord(record);
    setCopyFromRecord(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const record = records.find(r => r.id === id);
    const patient = patients.find(p => p.院友id === record?.patient_id);
    if (!confirm(`確定要刪除 ${patient?.中文姓名 ?? ''} ${record?.year}年${record?.month}月 的尿片記錄嗎？`)) return;
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await db.deleteDiaperUsageRecord(id);
      await loadRecords();
    } catch (error) {
      console.error('刪除尿片記錄失敗:', error);
      alert('刪除尿片記錄失敗，請重試');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const hasGenerated = (record: DiaperUsageRecord): boolean =>
    !!record.generated_data && Object.keys(record.generated_data).length > 0;

  const dailyAverage = (monthly: number | null | undefined, year: number, month: number): string => {
    if (!monthly || monthly <= 0) return '-';
    return (monthly / daysInMonth(year, month)).toFixed(1);
  };

  if (loading || recordsLoading) {
    return <LoadingScreen pageName="尿片記錄" />;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">尿片記錄</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedRecord(null);
                setCopyFromRecord(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增尿片記錄</span>
            </button>
          </div>
        </div>
      </div>

      {/* 搜索 */}
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
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="btn-secondary flex flex-wrap items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                  <span>清除</span>
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>顯示 {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {records.length} 筆記錄)</span>
              {searchTerm && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 尿片記錄列表 */}
      <div className="card overflow-hidden">
        {paginatedGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">展開</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">院友</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">年月</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">每月估算（尿片/片芯）</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">每日範圍（尿片/片芯）</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">估計每天量</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">建立日期</th>
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
                      className="hover:bg-gray-50"
                      onDoubleClick={() => handleEdit(record)}
                    >
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
                                {patient && <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" />}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{record.year}年{record.month}月</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.monthly_diaper_estimate ?? '-'} / {record.monthly_core_estimate ?? '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.daily_min_diaper ?? 0}-{record.daily_max_diaper ?? '-'} / {record.daily_min_core ?? 0}-{record.daily_max_core ?? '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dailyAverage(record.monthly_diaper_estimate, record.year, record.month)} / {dailyAverage(record.monthly_core_estimate, record.year, record.month)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {hasGenerated(record) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            已生成
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <FileText className="h-3 w-3 mr-1" />
                            未生成
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{new Date(record.created_at).toLocaleDateString('zh-HK')}</span>
                        </div>
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
                            onClick={() => {
                              setCopyFromRecord(record);
                              setSelectedRecord(null);
                              setShowModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="另存新檔"
                            disabled={deletingIds.has(record.id)}
                          >
                            <Copy className="h-4 w-4" />
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
            <Baby className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? '找不到符合條件的尿片記錄' : '暫無尿片記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? '請嘗試調整搜索條件' : '開始為使用本院尿片/片芯的院友建立記錄'}
            </p>
            {!searchTerm ? (
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setCopyFromRecord(null);
                  setShowModal(true);
                }}
                className="btn-primary"
              >
                新增尿片記錄
              </button>
            ) : (
              <button
                onClick={() => setSearchTerm('')}
                className="btn-secondary"
              >
                清除搜尋
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
              <span className="text-sm text-gray-700">位院友</span>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>

                {generatePageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
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
                  onClick={() => setCurrentPage(currentPage + 1)}
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
        <DiaperUsageRecordModal
          record={selectedRecord ?? undefined}
          copyFrom={copyFromRecord ?? undefined}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setCopyFromRecord(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setSelectedRecord(null);
            setCopyFromRecord(null);
            loadRecords();
          }}
        />
      )}
    </div>
  );
};

export default DiaperUsageRecords;
