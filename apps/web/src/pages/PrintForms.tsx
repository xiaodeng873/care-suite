import React, { useState, useRef } from 'react';
import { 
  Printer, 
  FileText, 
  Trash2, 
  CheckCircle, 
  Plus,
  Search,
  Filter,
  User,
  ChevronUp,
  ChevronDown,
  Upload,
  Download,
  X,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePatients } from '../context/PatientContext';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import {
  getTemplatesMetadata
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { exportPrintFormsToExcel } from '../utils/printFormExcelGenerator';
import { exportDiaperChangeToExcel } from '../utils/diaperChangeExcelGenerator';

type SortField = '床號' | '中文姓名' | '護理等級' | '入住類型' | '在住狀態';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  護理等級: string;
  入住類型: string;
  在住狀態: string;
  性別: string;
  社會福利: string;
}

const PrintForms: React.FC = () => {
  const { patients, loading, patientRestraintAssessments, stations, beds } = usePatients();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [restraintUserIds, setRestraintUserIds] = useState<Set<number>>(new Set());
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
    護理等級: '',
    入住類型: '',
    在住狀態: '在住',
    性別: '',
    社會福利: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showYearMonthModal, setShowYearMonthModal] = useState(false);
  const [showPersonalHygieneMonthModal, setShowPersonalHygieneMonthModal] = useState(false);
  const [personalHygieneMonths, setPersonalHygieneMonths] = useState(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    
    return {
      firstMonth: `${currentYear}年${currentMonth.toString().padStart(2, '0')}月`,
      secondMonth: `${nextYear}年${nextMonth.toString().padStart(2, '0')}月`
    };
  });
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}年${month}月`;
  });

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  // 當約束評估資料變化時，更新使用約束物品的院友列表
  React.useEffect(() => {
    if (patientRestraintAssessments.length > 0) {
      loadRestraintUsers();
    }
  }, [patientRestraintAssessments]);

  const loadRestraintUsers = () => {
    try {
      // 從 Context 獲取所有約束評估記錄
      // 約束物品管理頁面中有記錄的院友，就是有約束評估記錄的院友
      const userIds = new Set<number>();

      // 為每個院友只保留最新的評估記錄
      const latestAssessments = new Map<number, any>();
      const sortedAssessments = [...patientRestraintAssessments].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      sortedAssessments.forEach(assessment => {
        if (!latestAssessments.has(assessment.patient_id)) {
          latestAssessments.set(assessment.patient_id, assessment);
        }
      });

      // 所有有約束評估記錄的院友都加入列表
      latestAssessments.forEach((assessment) => {
        userIds.add(assessment.patient_id);
      });

      setRestraintUserIds(userIds);
      console.log('約束物品管理中的院友數量:', userIds.size, '總評估記錄數:', patientRestraintAssessments.length);
    } catch (error) {
      console.error('載入約束物品使用者失敗:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await getTemplatesMetadata();
      // 只顯示列印表格相關範本
      const printFormTemplates = data.filter(t =>
        t.type === 'diaper-change-record' ||
        t.type === 'personal-hygiene-record' ||
        t.type === 'admission-layout' ||
        t.type === 'bed-layout' ||
        t.type === 'restraint-observation'
      );
      setTemplates(printFormTemplates);
    } catch (error) {
      console.error('載入範本失敗:', error);
      alert('載入範本失敗，請重試');
    }
  };

  const handleDeleteTemplate = async (template: any) => {
    // Implementation for deleting template
  };

  // Patient filtering logic
  const filteredPatients = patients.filter(patient => {
    // 如果選擇約束物品觀察表，只顯示使用約束物品的院友
    if (selectedTemplate?.type === 'restraint-observation') {
      if (!restraintUserIds.has(patient.院友id)) {
        return false;
      }
    }

    // Advanced filters
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !patient.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.護理等級 && patient.護理等級 !== advancedFilters.護理等級) {
      return false;
    }
    if (advancedFilters.入住類型 && patient.入住類型 !== advancedFilters.入住類型) {
      return false;
    }
    if (advancedFilters.性別 && patient.性別 !== advancedFilters.性別) {
      return false;
    }
    if (advancedFilters.社會福利 && patient.社會福利?.type !== advancedFilters.社會福利) {
      return false;
    }
    
    // Search term
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
      護理等級: '',
      入住類型: '',
      在住狀態: '在住',
      性別: '',
      社會福利: ''
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

  // Pagination logic
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

  const handleExportSelected = async () => {
    if (!selectedTemplate) {
      alert('請先選擇一個範本');
      return;
    }

    // 床位表不需要選擇院友
    if (selectedTemplate.type === 'bed-layout') {
      await handleBedLayoutExport();
      return;
    }

    // 約束觀察表需要檢查是否有選擇院友
    if (selectedRows.size === 0) {
      alert('請先選擇要匯出的院友');
      return;
    }

    // 如果是換片記錄，需要先詢問年月
    if (selectedTemplate.type === 'diaper-change-record') {
      setShowYearMonthModal(true);
    } else if (selectedTemplate.type === 'personal-hygiene-record') {
      setShowPersonalHygieneMonthModal(true);
    } else if (selectedTemplate.type === 'restraint-observation') {
      await handleRestraintObservationExport();
    } else {
      await handleDirectExport();
    }
  };

  const handleBedLayoutExport = async () => {
    try {
      setIsExporting(true);
      const { exportBedLayoutToExcel } = await import('../utils/bedLayoutExcelGenerator');
      // 導出所有站點的床位表
      await exportBedLayoutToExcel(stations, beds, patients);
    } catch (error) {
      console.error('匯出床位表失敗:', error);
      alert('匯出床位表失敗，請重試');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestraintObservationExport = async () => {
    const selectedPatients = sortedPatients.filter(p => selectedRows.has(p.院友id));

    try {
      setIsExporting(true);
      const { exportRestraintObservationToExcel } = await import('../utils/restraintObservationChartExcelGenerator');
      await exportRestraintObservationToExcel(selectedPatients, selectedTemplate);
    } catch (error) {
      console.error('匯出約束觀察表失敗:', error);
      alert('匯出約束觀察表失敗，請重試');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDirectExport = async () => {
    const selectedPatients = sortedPatients.filter(p => selectedRows.has(p.院友id));

    try {
      setIsExporting(true);
      await exportPrintFormsToExcel(selectedPatients, selectedTemplate);
    } catch (error) {
      console.error('匯出表格失敗:', error);
      alert('匯出表格失敗，請重試');
    } finally {
      setIsExporting(false);
    }
  };

  const handleYearMonthConfirm = async () => {
    const selectedPatients = sortedPatients.filter(p => selectedRows.has(p.院友id));
    
    try {
      setIsExporting(true);
      setShowYearMonthModal(false);
      await exportDiaperChangeToExcel(selectedPatients, selectedTemplate, yearMonth);
    } catch (error) {
      console.error('匯出換片記錄失敗:', error);
      alert('匯出換片記錄失敗，請重試');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePersonalHygieneMonthConfirm = async () => {
    const selectedPatients = sortedPatients.filter(p => selectedRows.has(p.院友id));
    
    try {
      setIsExporting(true);
      setShowPersonalHygieneMonthModal(false);
      const { exportPersonalHygieneToExcel } = await import('../utils/personalHygieneExcelGenerator');
      await exportPersonalHygieneToExcel(selectedPatients, selectedTemplate, personalHygieneMonths);
    } catch (error) {
      console.error('匯出個人衛生記錄失敗:', error);
      alert('匯出個人衛生記錄失敗，請重試');
    } finally {
      setIsExporting(false);
    }
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

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">列印表格</h1>
          <div className="flex items-center space-x-2">
            {((selectedRows.size > 0 && selectedTemplate && selectedTemplate.type !== 'station-bed-layout') ||
              (selectedTemplate?.type === 'bed-layout')) && (
              <button
                onClick={handleExportSelected}
                disabled={isExporting}
                className="btn-primary flex items-center space-x-2"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>
                      {selectedTemplate?.type === 'bed-layout' && '生成床位表'}
                      {selectedTemplate?.type === 'restraint-observation' && `生成觀察表 (${selectedRows.size})`}
                      {selectedTemplate?.type !== 'station-bed-layout' && selectedTemplate?.type !== 'restraint-observation' && `生成表格 (${selectedRows.size})`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">選擇列印表格</h2>
          <Link
            to="/templates"
            className="btn-secondary flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>管理範本</span>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">選擇列印表格類型</label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const templateId = e.target.value;
                const template = templates.find(t => t.id === parseInt(templateId));
                setSelectedTemplate(template || null);
              }}
              className="form-input"
            >
              <option value="">請選擇列印表格...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.type === 'diaper-change-record' && '換片記錄'}
                  {template.type === 'personal-hygiene-record' && '個人衛生記錄'}
                  {template.type === 'admission-layout' && '入住排版'}
                  {template.type === 'bed-layout' && '床位表'}
                  {template.type === 'restraint-observation' && '約束物品觀察表'}
                  {!['diaper-change-record', 'personal-hygiene-record', 'admission-layout', 'bed-layout', 'restraint-observation'].includes(template.type) && template.name}
                </option>
              ))}
            </select>
          </div>
          
          {selectedTemplate && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">已選擇範本</h3>
              </div>
              <div className="text-sm text-blue-800">
                <p><strong>範本名稱：</strong>{selectedTemplate.name}</p>
                <p><strong>原始檔名：</strong>{selectedTemplate.original_name}</p>
                <div className="flex items-center space-x-1 mt-2">
                  {selectedTemplate.extracted_format && Object.keys(selectedTemplate.extracted_format).length > 0 ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">範本格式已提取</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-orange-600">範本格式未提取</span>
                    </>
                  )}
                </div>
                {/* 特殊範本提示 */}
                {selectedTemplate.type === 'station-bed-layout' && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>提示：</strong>床位表無需選擇院友，將匯出所有站點的床位配置
                    </p>
                  </div>
                )}
                {selectedTemplate.type === 'restraint-observation' && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>提示：</strong>僅顯示目前使用約束物品的院友（共 {restraintUserIds.size} 位）
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {templates.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無列印表格範本</h3>
            <p className="text-gray-600 mb-4">請先在範本管理中上傳換片記錄、個人衛生記錄或入住排版範本</p>
            <Link
              to="/templates"
              className="btn-primary flex items-center space-x-2 inline-flex"
            >
              <Upload className="h-4 w-4" />
              <span>前往範本管理</span>
            </Link>
          </div>
        )}
      </div>

      {/* Patient Selection */}
      {selectedTemplate?.type !== 'station-bed-layout' && (
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">選擇院友</h2>
              {selectedTemplate && (
                <div className="flex items-center space-x-2 text-orange-600">
                  <FileText className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">已選擇範本：{selectedTemplate.name}</span>
                </div>
              )}
            </div>
            
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
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                      <option value="">全部</option>
                    </select>
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
      )}

      {/* Selection Controls */}
      {selectedTemplate?.type !== 'station-bed-layout' && totalItems > 0 && (
        <div className="sticky top-40 bg-white z-10 shadow-sm">
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
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {totalItems} 位院友
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient List */}
      {selectedTemplate?.type !== 'station-bed-layout' && (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    性別/年齡
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    身份證號碼
                  </th>
                  <SortableHeader field="護理等級">護理等級</SortableHeader>
                  <SortableHeader field="入住類型">入住類型</SortableHeader>
                  <SortableHeader field="在住狀態">在住狀態</SortableHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatients.map(patient => (
                  <tr 
                    key={patient.院友id} 
                    className={`hover:bg-gray-50 ${selectedRows.has(patient.院友id) ? 'bg-blue-50' : ''}`}
                    onClick={() => handleSelectRow(patient.院友id)}
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
                              {patient.中文姓氏}{patient.中文名字}
                            </span>
                          </PatientTooltip>
                          <div className="text-sm text-gray-500">
                            {getFormattedEnglishName(patient?.英文姓氏, patient?.英文名字) || patient?.英文姓名 || '-'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {patient.性別} / {patient.出生日期 ? calculateAge(patient.出生日期) : '-'}歲
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.身份證號碼}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <User className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的院友' : '暫無院友記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '請先新增院友記錄'}
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
      )}

      {/* Pagination Controls */}
      {selectedTemplate?.type !== 'station-bed-layout' && totalItems > 0 && (
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

      {/* 年月選擇模態框 */}
      {showYearMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">選擇年月</h3>
              <button
                onClick={() => setShowYearMonthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                請選擇要在換片記錄表中顯示的年月：
              </p>
              
              <div>
                <label className="form-label">年月 (格式: XXXX年XX月)</label>
                <input
                  type="text"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="form-input"
                  placeholder="例如: 2024年01月"
                  pattern="\d{4}年\d{2}月"
                />
                <p className="text-xs text-gray-500 mt-1">
                  請使用格式：XXXX年XX月（例如：2024年01月）
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  此年月將顯示在換片記錄表的 AB3 位置
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleYearMonthConfirm}
                disabled={!yearMonth.match(/^\d{4}年\d{2}月$/)}
                className="btn-primary flex-1"
              >
                確認生成
              </button>
              <button
                onClick={() => setShowYearMonthModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 個人衛生記錄月份選擇模態框 */}
      {showPersonalHygieneMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">選擇列印月份</h3>
              <button
                onClick={() => setShowPersonalHygieneMonthModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                請選擇要在個人衛生記錄表中顯示的兩個月份（通常為相連月份）：
              </p>
              
              <div>
                <label className="form-label">第一個月份 (格式: XXXX年XX月)</label>
                <input
                  type="text"
                  value={personalHygieneMonths.firstMonth}
                  onChange={(e) => setPersonalHygieneMonths(prev => ({ ...prev, firstMonth: e.target.value }))}
                  className="form-input"
                  placeholder="例如: 2024年01月"
                  pattern="\d{4}年\d{2}月"
                />
              </div>
              
              <div>
                <label className="form-label">第二個月份 (格式: XXXX年XX月)</label>
                <input
                  type="text"
                  value={personalHygieneMonths.secondMonth}
                  onChange={(e) => setPersonalHygieneMonths(prev => ({ ...prev, secondMonth: e.target.value }))}
                  className="form-input"
                  placeholder="例如: 2024年02月"
                  pattern="\d{4}年\d{2}月"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  第一個月份將顯示在 A2-A3 位置，第二個月份將顯示在 T2-T3 位置
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handlePersonalHygieneMonthConfirm}
                disabled={!personalHygieneMonths.firstMonth.match(/^\d{4}年\d{2}月$/) || !personalHygieneMonths.secondMonth.match(/^\d{4}年\d{2}月$/)}
                className="btn-primary flex-1"
              >
                確認生成
              </button>
              <button
                onClick={() => setShowPersonalHygieneMonthModal(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用說明</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <p>在「範本管理」中上傳您的列印表格範本，分別選擇「換片記錄」、「個人衛生記錄」或「入住排版」類型</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <p>系統會自動提取範本的完整格式（欄寬、列高、合併儲存格、字型、邊框、圖片等）</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <p>回到此頁面選擇一個已上傳的範本，然後篩選並選擇需要的院友</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">4</span>
            <p>點擊「生成表格」，系統會為每位選中的院友創建一個工作表，完全克隆範本格式並填入院友資料</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">5</span>
            <p>下載生成的 Excel 檔案，每個工作表都包含完整的範本格式和對應院友的資料</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintForms;