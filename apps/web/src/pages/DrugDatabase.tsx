import React, { useState } from 'react';
import { 
  Pill, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Download,
  Upload,
  Camera,
  X,
  ChevronUp,
  ChevronDown,
  FileText
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import DrugModal from '../components/DrugModal';

type SortField = 'drug_name' | 'drug_code' | 'drug_type' | 'administration_route' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  drug_name: string;
  drug_code: string;
  drug_type: string;
  administration_route: string;
  unit: string;
  notes: string;
}

const DrugDatabase: React.FC = () => {
  const { drugDatabase, deleteDrug, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('drug_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    drug_name: '',
    drug_code: '',
    drug_type: '',
    administration_route: '',
    unit: '',
    notes: ''
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Reset to first page when filters change
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

  const filteredDrugs = (drugDatabase || []).filter(drug => {
    // 先應用進階篩選
    if (advancedFilters.drug_name && !drug.drug_name.toLowerCase().includes(advancedFilters.drug_name.toLowerCase())) {
      return false;
    }
    if (advancedFilters.drug_code && !drug.drug_code?.toLowerCase().includes(advancedFilters.drug_code.toLowerCase())) {
      return false;
    }
    if (advancedFilters.drug_type && drug.drug_type !== advancedFilters.drug_type) {
      return false;
    }
    if (advancedFilters.administration_route && drug.administration_route !== advancedFilters.administration_route) {
      return false;
    }
    if (advancedFilters.unit && !drug.unit?.toLowerCase().includes(advancedFilters.unit.toLowerCase())) {
      return false;
    }
    if (advancedFilters.notes && !drug.notes?.toLowerCase().includes(advancedFilters.notes.toLowerCase())) {
      return false;
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = drug.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.drug_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.drug_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.administration_route?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.unit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         drug.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         false;
    }
    
    return matchesSearch;
  });

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
      drug_name: '',
      drug_code: '',
      drug_type: '',
      administration_route: '',
      unit: '',
      notes: ''
    });
  };

  const sortedDrugs = [...filteredDrugs].sort((a, b) => {
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case 'drug_name':
        valueA = a.drug_name;
        valueB = b.drug_name;
        break;
      case 'drug_code':
        valueA = a.drug_code || '';
        valueB = b.drug_code || '';
        break;
      case 'drug_type':
        valueA = a.drug_type || '';
        valueB = b.drug_type || '';
        break;
      case 'administration_route':
        valueA = a.administration_route || '';
        valueB = b.administration_route || '';
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

  // Pagination logic
  const totalItems = sortedDrugs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDrugs = sortedDrugs.slice(startIndex, endIndex);

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

  const handleEdit = (drug: any) => {
    setSelectedDrug(drug);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const drug = drugDatabase.find(d => d.id === id);
    
    if (confirm(`確定要刪除藥物「${drug?.drug_name}」嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteDrug(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除藥物失敗，請重試');
      } finally {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const handleSelectRow = (drugId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(drugId)) {
      newSelected.delete(drugId);
    } else {
      newSelected.add(drugId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedDrugs.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedDrugs.map(d => d.id)));
    }
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
          <h1 className="text-2xl font-bold text-gray-900">藥物資料庫</h1>
          <div className="flex items-center space-x-2">
            {selectedRows.size > 0 && (
              <button
                onClick={() => {/* Export functionality */}}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出選定藥物</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedDrug(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增藥物</span>
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
                  placeholder="搜索藥物名稱、藥物編號、藥物類型、使用途徑、單位或備註..."
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">藥物名稱</label>
                    <input
                      type="text"
                      value={advancedFilters.drug_name}
                      onChange={(e) => updateAdvancedFilter('drug_name', e.target.value)}
                      className="form-input"
                      placeholder="搜索藥物名稱..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">藥物編號</label>
                    <input
                      type="text"
                      value={advancedFilters.drug_code}
                      onChange={(e) => updateAdvancedFilter('drug_code', e.target.value)}
                      className="form-input"
                      placeholder="搜索藥物編號..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">藥物類型</label>
                    <select
                      value={advancedFilters.drug_type}
                      onChange={(e) => updateAdvancedFilter('drug_type', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="西藥">西藥</option>
                      <option value="中藥">中藥</option>
                      <option value="保健品">保健品</option>
                      <option value="外用藥">外用藥</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">使用途徑</label>
                    <select
                      value={advancedFilters.administration_route}
                      onChange={(e) => updateAdvancedFilter('administration_route', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有途徑</option>
                      <option value="口服">口服</option>
                      <option value="注射">注射</option>
                      <option value="外用">外用</option>
                      <option value="滴眼">滴眼</option>
                      <option value="滴耳">滴耳</option>
                      <option value="鼻胃管">鼻胃管</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">藥物單位</label>
                    <input
                      type="text"
                      value={advancedFilters.unit}
                      onChange={(e) => updateAdvancedFilter('unit', e.target.value)}
                      className="form-input"
                      placeholder="搜索單位..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">備註</label>
                    <input
                      type="text"
                      value={advancedFilters.notes}
                      onChange={(e) => updateAdvancedFilter('notes', e.target.value)}
                      className="form-input"
                      placeholder="搜索備註內容..."
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 種藥物 (共 {(drugDatabase || []).length} 種)</span>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedDrugs.length ? '取消全選' : '全選'}
                </button>
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 種藥物
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 藥物列表 */}
      <div className="card overflow-hidden">
        {paginatedDrugs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedDrugs.length && paginatedDrugs.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    藥物相片
                  </th>
                  <SortableHeader field="drug_name">藥物名稱</SortableHeader>
                  <SortableHeader field="drug_code">藥物編號</SortableHeader>
                  <SortableHeader field="drug_type">藥物類型</SortableHeader>
                  <SortableHeader field="administration_route">使用途徑</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    藥物單位
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    備註
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedDrugs.map(drug => (
                  <tr 
                    key={drug.id} 
                    className={`hover:bg-gray-50 ${selectedRows.has(drug.id) ? 'bg-blue-50' : ''}`}
                    onDoubleClick={() => handleEdit(drug)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(drug.id)}
                        onChange={() => handleSelectRow(drug.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {drug.photo_url ? (
                          <img 
                            src={drug.photo_url} 
                            alt={drug.drug_name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Pill className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{drug.drug_name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {drug.drug_code || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {drug.drug_type || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {drug.administration_route || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {drug.unit || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={drug.notes || ''}>
                        {drug.notes || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(drug)}
                          className="text-blue-600 hover:text-blue-900"
                          title="編輯"
                          disabled={deletingIds.has(drug.id)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(drug.id)}
                          className="text-red-600 hover:text-red-900"
                          title="刪除"
                          disabled={deletingIds.has(drug.id)}
                        >
                          {deletingIds.has(drug.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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
            <Pill className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的藥物' : '暫無藥物資料'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始建立藥物資料庫'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增藥物
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
        <DrugModal
          drug={selectedDrug}
          onClose={() => {
            setShowModal(false);
            setSelectedDrug(null);
          }}
        />
      )}
    </div>
  );
};

export default DrugDatabase;