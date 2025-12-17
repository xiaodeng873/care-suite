import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit3, Trash2, Search, Filter, Download, User, Calendar, CreditCard, Heart, AlertTriangle, CheckCircle, ChevronUp, ChevronDown, X, LogOut } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientModal from '../components/PatientModal';
import DischargeModal from '../components/DischargeModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '床號' | '中文姓名' | '性別' | '年齡' | '入住日期' | '護理等級' | '入住類型' | '在住狀態';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  英文姓名: string;
  性別: string;
  護理等級: string;
  入住類型: string;
  在住狀態: string;
  社會福利: string;
  藥物敏感: string;
  不良藥物反應: string;
  startDate: string;
  endDate: string;
}

const PatientRecords: React.FC = () => {
  const { patients, loading, deletePatient, updatePatient } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>('床號');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    英文姓名: '',
    性別: '',
    護理等級: '',
    入住類型: '',
    在住狀態: '在住', // 預設初始為「在住」
    社會福利: '',
    藥物敏感: '',
    不良藥物反應: '',
    startDate: '',
    endDate: ''
  });
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
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

  const filteredPatients = patients.filter(patient => {
    if (advancedFilters.床號 && !patient.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.英文姓名 && !(
      patient.英文姓氏?.toLowerCase().includes(advancedFilters.英文姓名.toLowerCase()) ||
      patient.英文名字?.toLowerCase().includes(advancedFilters.英文姓名.toLowerCase()) ||
      patient.英文姓名?.toLowerCase().includes(advancedFilters.英文姓名.toLowerCase())
    )) {
      return false;
    }
    if (advancedFilters.性別 && patient.性別 !== advancedFilters.性別) {
      return false;
    }
    if (advancedFilters.護理等級 && patient.護理等級 !== advancedFilters.護理等級) {
      return false;
    }
    if (advancedFilters.入住類型 && patient.入住類型 !== advancedFilters.入住類型) {
      return false;
    }
    if (advancedFilters.在住狀態 && patient.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.社會福利 && patient.社會福利?.type !== advancedFilters.社會福利) {
      return false;
    }
    if (advancedFilters.藥物敏感 && !patient.藥物敏感?.some(allergy => 
      allergy.toLowerCase().includes(advancedFilters.藥物敏感.toLowerCase())
    )) {
      return false;
    }
    if (advancedFilters.不良藥物反應 && !patient.不良藥物反應?.some(reaction => 
      reaction.toLowerCase().includes(advancedFilters.不良藥物反應.toLowerCase())
    )) {
      return false;
    }
    
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const admissionDate = patient.入住日期 ? new Date(patient.入住日期) : null;
      if (admissionDate) {
        if (advancedFilters.startDate && admissionDate < new Date(advancedFilters.startDate)) {
          return false;
        }
        if (advancedFilters.endDate && admissionDate > new Date(advancedFilters.endDate)) {
          return false;
        }
      }
    }
    
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = patient.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (patient.英文姓氏?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         (patient.英文名字?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         (patient.英文姓名?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         patient.身份證號碼.toLowerCase().includes(searchTerm.toLowerCase());
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
      床號: '',
      中文姓名: '',
      英文姓名: '',
      性別: '',
      護理等級: '',
      入住類型: '',
      在住狀態: '在住', // 清除後恢復預設為「在住」
      社會福利: '',
      藥物敏感: '',
      不良藥物反應: '',
      startDate: '',
      endDate: ''
    });
  };

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '床號':
        valueA = a.床號;
        valueB = b.床號;
        break;
      case '中文姓名':
        valueA = `${a.中文姓氏 || ''}${a.中文名字 || ''}`;
        valueB = `${b.中文姓氏 || ''}${b.中文名字 || ''}`;
        break;
      case '性別':
        valueA = a.性別;
        valueB = b.性別;
        break;
      case '年齡':
        valueA = a.出生日期 ? Math.floor((Date.now() - new Date(a.出生日期).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
        valueB = b.出生日期 ? Math.floor((Date.now() - new Date(b.出生日期).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
        break;
      case '入住日期':
        valueA = a.入住日期 ? new Date(a.入住日期).getTime() : 0;
        valueB = b.入住日期 ? new Date(b.入住日期).getTime() : 0;
        break;
      case '護理等級':
        valueA = a.護理等級 || '';
        valueB = b.護理等級 || '';
        break;
      case '入住類型':
        valueA = a.入住類型 || '';
        valueB = b.入住類型 || '';
        break;
      case '在住狀態':
        valueA = a.在住狀態 || '';
        valueB = b.在住狀態 || '';
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

  const totalItems = sortedPatients.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPatients = sortedPatients.slice(startIndex, endIndex);

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

  const handleEdit = (patient: any) => {
    setSelectedPatient(patient);
    setShowModal(true);
  };

  const handleDischarge = (patient: any) => {
    setSelectedPatient(patient);
    setShowDischargeModal(true);
  };

  const handleConfirmDischarge = async (updatedPatient: any, dischargeDate: string) => {
    try {
      // DischargeModal 已經包含了完整的退住資料(退住原因、死亡日期、轉往機構等)
      await updatePatient(updatedPatient);
      setShowDischargeModal(false);
      setSelectedPatient(null);
    } catch (error) {
      console.error('退住失敗:', error);
      alert('退住失敗，請重試');
    }
  };

  const handleDelete = async (id: number) => {
    const patient = patients.find(p => p.院友id === id);
    if (confirm(`確定要刪除院友「${patient?.中文姓名}」(床號: ${patient?.床號})嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deletePatient(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除院友失敗，請重試');
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

    const selectedPatients = sortedPatients.filter(p => selectedRows.has(p.院友id));
    const confirmMessage = `確定要刪除 ${selectedRows.size} 位院友嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const patientId of deletingArray) {
        await deletePatient(patientId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 位院友`);
    } catch (error) {
      console.error('批量刪除院友失敗:', error);
      alert('批量刪除院友失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (patientId: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
    } else {
      newSelected.add(patientId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedPatients.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedPatients.map(p => p.院友id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<number>();
    paginatedPatients.forEach(patient => {
      if (!selectedRows.has(patient.院友id)) {
        newSelected.add(patient.院友id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = () => {
    const selectedPatients = paginatedPatients.filter(p => selectedRows.has(p.院友id));
    
    if (selectedPatients.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    const exportData = selectedPatients.map(patient => ({
      床號: patient.床號,
      中文姓名: `${patient.中文姓氏}${patient.中文名字}`,
      英文姓名: getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名 || '',
      性別: patient.性別,
      身份證號碼: patient.身份證號碼,
      出生日期: patient.出生日期 ? new Date(patient.出生日期).toLocaleDateString('zh-TW') : '',
      年齡: patient.出生日期 ? Math.floor((Date.now() - new Date(patient.出生日期).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '',
      入住日期: patient.入住日期 ? new Date(patient.入住日期).toLocaleDateString('zh-TW') : '',
      退住日期: patient.退住日期 ? new Date(patient.退住日期).toLocaleDateString('zh-TW') : '',
      護理等級: patient.護理等級 || '',
      入住類型: patient.入住類型 || '',
      在住狀態: patient.在住狀態 || '',
      社會福利: patient.社會福利?.type || '',
      藥物敏感: Array.isArray(patient.藥物敏感) ? patient.藥物敏感.join(', ') : (patient.藥物敏感 || ''),
      不良藥物反應: Array.isArray(patient.不良藥物反應) ? patient.不良藥物反應.join(', ') : (patient.不良藥物反應 || '')
    }));

    const headers = ['床號', '中文姓名', '英文姓名', '性別', '身份證號碼', '出生日期', '年齡', '入住日期', '退住日期', '護理等級', '入住類型', '在住狀態', '社會福利', '藥物敏感', '不良藥物反應'];
    const csvContent = [
      `"院友記錄"`,
      `"生成日期: ${new Date().toLocaleDateString('zh-TW')}"`,
      `"總記錄數: ${exportData.length}"`,
      '',
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `院友記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case '在住': return 'bg-green-100 text-green-800';
      case '已退住': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNursingLevelBadgeClass = (level: string) => {
    switch (level) {
      case '全護理': return 'bg-red-100 text-red-800';
      case '半護理': return 'bg-yellow-100 text-yellow-800';
      case '自理': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAdmissionTypeBadgeClass = (type: string) => {
    switch (type) {
      case '私位': return 'bg-purple-100 text-purple-800';
      case '買位': return 'bg-blue-100 text-blue-800';
      case '院舍卷': return 'bg-green-100 text-green-800';
      case '暫住': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const stats = {
    total: patients.length,
    active: patients.filter(p => p.在住狀態 === '在住').length,
    pending: patients.filter(p => p.在住狀態 === '待入住').length,
    discharged: patients.filter(p => p.在住狀態 === '已退住').length,
    nursingLevels: {
      全護理: patients.filter(p => p.護理等級 === '全護理').length,
      半護理: patients.filter(p => p.護理等級 === '半護理').length,
      自理: patients.filter(p => p.護理等級 === '自理').length
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">院友記錄</h1>
          <div className="flex items-center space-x-2">
            {selectedRows.size > 0 && (
              <button
                onClick={handleExportSelected}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>匯出選定記錄</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedPatient(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增院友</span>
            </button>
          </div>
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
                  placeholder="搜索院友姓名、床號、英文姓名或身份證號碼..."
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
                  <label className="form-label">入住日期區間</label>
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
                    <label className="form-label">英文姓名</label>
                    <input
                      type="text"
                      value={advancedFilters.英文姓名}
                      onChange={(e) => updateAdvancedFilter('英文姓名', e.target.value)}
                      className="form-input"
                      placeholder="搜索英文姓名..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">性別</label>
                    <select
                      value={advancedFilters.性別}
                      onChange={(e) => updateAdvancedFilter('性別', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有性別</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">護理等級</label>
                    <select
                      value={advancedFilters.護理等級}
                      onChange={(e) => updateAdvancedFilter('護理等級', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有等級</option>
                      <option value="全護理">全護理</option>
                      <option value="半護理">半護理</option>
                      <option value="自理">自理</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">入住類型</label>
                    <select
                      value={advancedFilters.入住類型}
                      onChange={(e) => updateAdvancedFilter('入住類型', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="私位">私位</option>
                      <option value="買位">買位</option>
                      <option value="院舍卷">院舍卷</option>
                      <option value="暫住">暫住</option>
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
                     <option value="">所有狀態</option>
                   </select>
                 </div>
                  
                  <div>
                    <label className="form-label">社會福利</label>
                    <select
                      value={advancedFilters.社會福利}
                      onChange={(e) => updateAdvancedFilter('社會福利', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="綜合社會保障援助">綜合社會保障援助</option>
                      <option value="公共福利金計劃">公共福利金計劃</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">藥物敏感</label>
                    <input
                      type="text"
                      value={advancedFilters.藥物敏感}
                      onChange={(e) => updateAdvancedFilter('藥物敏感', e.target.value)}
                      className="form-input"
                      placeholder="搜索藥物敏感..."
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 位院友 (共 {patients.length} 位)</span>
              {(searchTerm || hasAdvancedFilters()) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="sticky top-44 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === paginatedPatients.length ? '取消全選' : '全選'}
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
                    刪除選定院友 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 位院友
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {paginatedPatients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
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
                  <SortableHeader field="床號">床號</SortableHeader>
                  <SortableHeader field="中文姓名">院友姓名</SortableHeader>
                  <SortableHeader field="性別">性別</SortableHeader>
                  <SortableHeader field="年齡">年齡</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    身份證號碼
                  </th>
                  <SortableHeader field="入住日期">入住日期</SortableHeader>
                  <SortableHeader field="護理等級">護理等級</SortableHeader>
                  <SortableHeader field="入住類型">入住類型</SortableHeader>
                  <SortableHeader field="在住狀態">在住狀態</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatients.map(patient => (
                  <tr 
                    key={patient.院友id} 
                    className={`hover:bg-gray-50 ${selectedRows.has(patient.院友id) ? 'bg-blue-50' : ''}`}
                    onDoubleClick={() => handleEdit(patient)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(patient.院友id)}
                        onChange={() => handleSelectRow(patient.院友id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {patient.床號}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient.院友相片 ? (
                            <img 
                              src={patient.院友相片} 
                              alt={patient.中文姓名} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <PatientTooltip patient={patient}>
                            <span className="text-sm font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">
                              {patient.中文姓名}
                            </span>
                          </PatientTooltip>
                          <div className="text-sm text-gray-500">
                            {getFormattedEnglishName(patient?.英文姓氏, patient?.英文名字) || patient?.英文姓名 || '-'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.性別}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.出生日期 ? calculateAge(patient.出生日期) : '-'}歲
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-1 text-gray-400" />
                        {patient.身份證號碼}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.入住日期 ? (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                          {new Date(patient.入住日期).toLocaleDateString('zh-TW')}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {patient.護理等級 ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNursingLevelBadgeClass(patient.護理等級)}`}>
                          {patient.護理等級}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {patient.入住類型 ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdmissionTypeBadgeClass(patient.入住類型)}`}>
                          {patient.入住類型}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(patient.在住狀態 || '在住')}`}>
                        {patient.在住狀態 || '在住'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(patient)}
                          className="text-blue-600 hover:text-blue-900"
                          title="編輯"
                          disabled={deletingIds.has(patient.院友id)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {(patient.在住狀態 === '在住' || patient.在住狀態 === '待入住') && (
                          <button
                            onClick={() => handleDischarge(patient)}
                            className="text-orange-600 hover:text-orange-900"
                            title="退住"
                            disabled={deletingIds.has(patient.院友id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(patient.院友id)}
                          className="text-red-600 hover:text-red-900"
                          title="刪除"
                          disabled={deletingIds.has(patient.院友id)}
                        >
                          {deletingIds.has(patient.院友id) ? (
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
            <Users className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的院友' : '暫無院友記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始新增院友記錄'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增院友
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
        <PatientModal
          patient={selectedPatient}
          onClose={() => {
            setShowModal(false);
            setSelectedPatient(null);
          }}
        />
      )}

      {showDischargeModal && selectedPatient && (
        <DischargeModal
          patient={selectedPatient}
          onClose={() => {
            setShowDischargeModal(false);
            setSelectedPatient(null);
          }}
          onConfirm={handleConfirmDischarge}
        />
      )}
    </div>
  );
};

export default PatientRecords;