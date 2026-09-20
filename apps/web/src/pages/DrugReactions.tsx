import React, { useMemo, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  ShieldAlert,
  AlertTriangle,
  Heart,
  Plus,
  Printer,
  Search,
  Filter,
  User,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useFilteredPatients, usePatientData } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import BedNumberImprint from '../components/BedNumberImprint';
import PatientTooltip from '../components/PatientTooltip';
import PatientDrugSafetyModal from '../components/PatientDrugSafetyModal';
import PatientPrintModal from '../components/PatientPrintModal';
import { fuzzyMatch, matchChineseName, matchEnglishName, compareBedNumbers, matchPatientBedNumber } from '../utils/searchUtils';

type SafetyType = 'allergy' | 'adr';
type SortDirection = 'asc' | 'desc';

const FIELD_MAP: Record<SafetyType, '藥物敏感' | '不良藥物反應'> = {
  allergy: '藥物敏感',
  adr: '不良藥物反應',
};

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  has_records: string;
  在住狀態: string;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  床號: '',
  中文姓名: '',
  has_records: '',
  在住狀態: '在住'
};

// 藥物反應管理頁：集中管理每位院友嘅「藥物敏感」同「不良藥物反應」（版面跟晚晴計劃管理）
const DrugReactions: React.FC = () => {
  const patients = useFilteredPatients();
  const { updatePatient, loading } = usePatientData();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [modal, setModal] = useState<{ patient: any; type: SafetyType } | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPatientIds, setPrintPatientIds] = useState<number[] | undefined>(undefined);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortDirection]);

  const getItems = (patient: any, type: SafetyType): string[] => {
    const value = patient[FIELD_MAP[type]];
    return Array.isArray(value) ? value : [];
  };

  const hasRecords = (patient: any): boolean =>
    getItems(patient, 'allergy').length > 0 || getItems(patient, 'adr').length > 0;

  const filteredPatients = useMemo(() => {
    const term = deferredSearch;
    return (patients || [])
      .filter((p: any) => {
        if (advancedFilters.在住狀態 && p.在住狀態 !== advancedFilters.在住狀態) return false;
        if (advancedFilters.床號 && !matchPatientBedNumber(p, advancedFilters.床號)) return false;
        if (advancedFilters.中文姓名 && !matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, advancedFilters.中文姓名)) return false;
        if (advancedFilters.has_records) {
          const has = hasRecords(p);
          if (advancedFilters.has_records === '是' && !has) return false;
          if (advancedFilters.has_records === '否' && has) return false;
        }
        if (term) {
          return matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, term) ||
                 matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, term) ||
                 matchPatientBedNumber(p, term) ||
                 fuzzyMatch(p.身份證號碼, term);
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const cmp = compareBedNumbers(a.床號 || '', b.床號 || '');
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [patients, advancedFilters, deferredSearch, sortDirection]);

  const totalItems = filteredPatients.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

  const hasAdvancedFilters = () =>
    Object.values(advancedFilters).some(value => value !== '');

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters(DEFAULT_FILTERS);
  };

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

  const handleSelectRow = (patientId: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(patientId)) newSelected.delete(patientId);
    else newSelected.add(patientId);
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedPatients.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedPatients.map((p: any) => p.院友id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<number>();
    paginatedPatients.forEach((p: any) => {
      if (!selectedRows.has(p.院友id)) newSelected.add(p.院友id);
    });
    setSelectedRows(newSelected);
  };

  const openPrintModal = (patientIds?: number[]) => {
    setPrintPatientIds(patientIds);
    setShowPrintModal(true);
  };

  const handleAdd = async (text: string) => {
    if (!modal) return;
    const field = FIELD_MAP[modal.type];
    await updatePatient({ ...modal.patient, [field]: [...getItems(modal.patient, modal.type), text] });
    setModal(null);
  };

  const handleRemove = async (patient: any, type: SafetyType, index: number) => {
    const field = FIELD_MAP[type];
    const key = `${patient.院友id}|${type}|${index}`;
    if (removingKey) return;
    setRemovingKey(key);
    try {
      await updatePatient({ ...patient, [field]: getItems(patient, type).filter((_, i) => i !== index) });
    } catch (err) {
      console.error('移除失敗:', err);
      alert('移除失敗，請重試');
    } finally {
      setRemovingKey(null);
    }
  };

  const renderTags = (patient: any, type: SafetyType) => {
    const items = getItems(patient, type);
    const isAllergy = type === 'allergy';
    if (items.length === 0) {
      return <span className="text-xs text-gray-500">無記錄</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((text, index) => (
          <span
            key={`${index}-${text}`}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
              isAllergy
                ? 'bg-orange-100 text-orange-800 border-orange-200'
                : 'bg-red-100 text-red-800 border-red-200'
            }`}
          >
            {text}
            <button
              onClick={() => void handleRemove(patient, type, index)}
              disabled={removingKey !== null}
              className="ml-1 rounded-full hover:bg-black/10 disabled:opacity-40"
              title="移除"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <LoadingScreen pageName="藥物反應" />;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">藥物反應</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openPrintModal(undefined)}
              className="btn-secondary flex flex-wrap items-center gap-2"
              title="列印綜合文件"
            >
              <Printer className="h-4 w-4" />
              <span>列印</span>
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
                  placeholder="搜索院友姓名、床號或身份證號碼..."
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
                    <label className="form-label">記錄狀態</label>
                    <select
                      value={advancedFilters.has_records}
                      onChange={(e) => updateAdvancedFilter('has_records', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有院友</option>
                      <option value="是">有記錄</option>
                      <option value="否">無記錄</option>
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
              <span>顯示 {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友</span>
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
                  {selectedRows.size === paginatedPatients.length && paginatedPatients.length > 0 ? '取消全選' : '全選'}
                </button>
                <button
                  onClick={handleInvertSelection}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <button
                    onClick={() => openPrintModal(Array.from(selectedRows))}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    列印選定院友 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {paginatedPatients.length} 位院友
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 院友藥物反應列表 */}
      <div className="card overflow-hidden">
        {paginatedPatients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedPatients.length && paginatedPatients.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>院友</span>
                      {sortDirection === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    藥物敏感
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    不良藥物反應
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatients.map((patient: any) => (
                  <tr
                    key={patient.院友id}
                    className={`hover:bg-gray-50 align-top ${selectedRows.has(patient.院友id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(patient.院友id)}
                        onChange={() => handleSelectRow(patient.院友id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
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
                              <span className="cursor-help hover:text-blue-600 transition-colors">
                                {patient.中文姓氏}{patient.中文名字}
                              </span>
                            </PatientTooltip>
                          </div>
                          <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                        {renderTags(patient, 'allergy')}
                        <button
                          onClick={() => setModal({ patient, type: 'allergy' })}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Plus className="h-3 w-3" />新增
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Heart className="h-4 w-4 text-red-600 flex-shrink-0" />
                        {renderTags(patient, 'adr')}
                        <button
                          onClick={() => setModal({ patient, type: 'adr' })}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Plus className="h-3 w-3" />新增
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <ShieldAlert className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的院友' : '暫無院友記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : ''}
            </p>
            {(searchTerm || hasAdvancedFilters()) && (
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

      {modal && (
        <PatientDrugSafetyModal
          type={modal.type}
          patientName={`${modal.patient.中文姓氏 ?? ''}${modal.patient.中文名字 ?? ''}` || modal.patient.中文姓名 || ''}
          onClose={() => setModal(null)}
          onSave={handleAdd}
        />
      )}

      {showPrintModal && (
        <PatientPrintModal
          patients={filteredPatients}
          initialTab="統計報表"
          initialSelectedPatientIds={printPatientIds}
          initialSelectedDocumentIds={['drug_sensitivity_statistics_report']}
          onClose={() => setShowPrintModal(false)}
          onPrint={async (selected, docs, start, end, mode, printOptions) => {
            setShowPrintModal(false);
            const { generatePatientPrintBundle } = await import('../utils/patientPrintBundleGenerator');
            await generatePatientPrintBundle({
              patients: selected,
              documentIds: docs,
              startDate: start,
              endDate: end,
              contentMode: mode,
              printOptions,
            });
          }}
        />
      )}
    </div>
  );
};

export default DrugReactions;
