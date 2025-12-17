import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Activity,
  Droplets,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  User,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  X,
  Recycle,
  Copy,
  MoreVertical,
  Thermometer
} from 'lucide-react';
import { usePatients, DuplicateRecordGroup } from '../context/PatientContext';
import HealthRecordModal from '../components/HealthRecordModal';
import BatchHealthRecordModal from '../components/BatchHealthRecordModal';
import DeduplicateRecordsModal from '../components/DeduplicateRecordsModal';
import RecycleBinModal from '../components/RecycleBinModal';
import { exportVitalSignsToExcel, type VitalSignExportData } from '../utils/vitalsignExcelGenerator';
import { exportBloodSugarToExcel, type BloodSugarExportData } from '../utils/bloodSugarExcelGenerator';
import PatientTooltip from '../components/PatientTooltip';
import { syncTaskStatus } from '../lib/database';

type RecordType = '生命表徵' | '血糖控制' | '體重控制' | 'all';
type SortField = '記錄日期' | '記錄時間' | '院友姓名' | '記錄類型' | '體重' | '血糖值' | '血壓';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  記錄類型: string;
  記錄人員: string;
  備註: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const HealthAssessment: React.FC = () => {
  const {
    healthRecords,
    patients,
    loading,
    deleteHealthRecord,
    generateRandomTemperaturesForActivePatients,
    recordDailyTemperatureGenerationCompletion,
    checkEligiblePatientsForTemperature,
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    refreshData,
    loadFullHealthRecords // [新增]
  } = usePatients();
  
  // [新增] 進入頁面時，觸發載入完整歷史記錄
  useEffect(() => {
    loadFullHealthRecords();
  }, [loadFullHealthRecords]);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('記錄日期');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRecordType, setBatchRecordType] = useState<'生命表徵' | '血糖控制' | '體重控制'>('生命表徵');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateRecordGroup[]>([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [isAnalyzingDuplicates, setIsAnalyzingDuplicates] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    記錄類型: '',
    記錄人員: '',
    備註: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingTemperature, setIsGeneratingTemperature] = useState(false);

  // Helper functions
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
      記錄類型: '',
      記錄人員: '',
      備註: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    healthRecords.forEach(record => {
      let value = '';
      switch (field) {
        case '記錄人員':
          value = record.記錄人員 || '';
          break;
        default:
          return;
      }
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  // 強制重新載入數據的函數
  const debugDataLoading = async () => {
    try {
      console.log('開始調試數據載入...');
      // 這裡可以加入更多調試邏輯
    } catch (error) {
      console.error('調試數據載入失敗:', error);
    }
  };

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

  const filteredRecords = healthRecords.filter(record => {
    const patient = patients.find(p => p.院友id === record.院友id);
    
    // 確保院友存在
    if (!patient) return false;
    
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.記錄類型 && advancedFilters.記錄類型 !== '' && record.記錄類型.trim() !== advancedFilters.記錄類型.trim()) {
      return false;
    }
    if (advancedFilters.記錄人員 && !record.記錄人員?.toLowerCase().includes(advancedFilters.記錄人員.toLowerCase())) {
      return false;
    }
    if (advancedFilters.備註 && !record.備註?.toLowerCase().includes(advancedFilters.備註.toLowerCase())) {
      return false;
    }
    
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const recordDate = new Date(record.記錄日期);
      if (advancedFilters.startDate && recordDate < new Date(advancedFilters.startDate)) {
        return false;
      }
      if (advancedFilters.endDate && recordDate > new Date(advancedFilters.endDate)) {
        return false;
      }
    }
    
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.備註?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         new Date(record.記錄日期).toLocaleDateString('zh-TW').includes(searchTerm.toLowerCase()) ||
                         false;
    }
    
    return matchesSearch;
  });

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.院友id);
    const patientB = patients.find(p => p.院友id === b.院友id);
    
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '記錄日期':
        valueA = new Date(`${a.記錄日期} ${a.記錄時間}`).getTime();
        valueB = new Date(`${b.記錄日期} ${b.記錄時間}`).getTime();
        break;
      case '記錄時間':
        valueA = a.記錄時間;
        valueB = b.記錄時間;
        break;
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case '記錄類型':
        valueA = a.記錄類型;
        valueB = b.記錄類型;
        break;
      case '體重':
        valueA = a.體重 || 0;
        valueB = b.體重 || 0;
        break;
      case '血糖值':
        valueA = a.血糖值 || 0;
        valueB = b.血糖值 || 0;
        break;
      case '血壓':
        valueA = (a.血壓收縮壓 || 0) + (a.血壓舒張壓 || 0);
        valueB = (b.血壓收縮壓 || 0) + (b.血壓舒張壓 || 0);
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

  const totalItems = sortedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = sortedRecords.slice(startIndex, endIndex);

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

  const handleEdit = (record: any) => {
    console.log('編輯監測記錄:', record);
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const record = healthRecords.find(r => r.記錄id === id);
    const patient = patients.find(p => p.院友id === record?.院友id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 在 ${record?.記錄日期} ${record?.記錄時間} 的${record?.記錄類型}記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteHealthRecord(id);

        // [新增] 同步任務狀態
        if (record?.task_id) {
          console.log('刪除記錄觸發任務同步:', record.task_id);
          await syncTaskStatus(record.task_id);
          if (refreshData) await refreshData();
        }

        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除記錄失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆監測記錄嗎？\n\n此操作無法復原。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));

    let successCount = 0;
    let failCount = 0;
    const failedIds: number[] = [];

    try {
      for (const recordId of deletingArray) {
        try {
          // 注意：批量刪除目前未實作逐一同步 task_id，若有需要可在此加入，
          // 但考慮效能，建議若量大時謹慎處理。
          await deleteHealthRecord(recordId);
          successCount++;
        } catch (deleteError) {
          failCount++;
          failedIds.push(recordId);
        }
      }

      const newSelectedRows = new Set<number>();
      failedIds.forEach(id => newSelectedRows.add(id));
      setSelectedRows(newSelectedRows);

      if (failCount === 0) {
        alert(`成功刪除 ${successCount} 筆監測記錄`);
      } else {
        alert(`刪除完成：\n成功 ${successCount} 筆\n失敗 ${failCount} 筆\n\n失敗的記錄已保持選中狀態，您可以稍後重試。`);
      }
      
      // 批量刪除後刷新一次數據
      if (refreshData) await refreshData();

    } catch (error) {
      console.error('[批量刪除] 發生未預期的錯誤:', error);
      alert(`批量刪除過程中發生錯誤`);
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (recordId: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRecords.map(r => r.記錄id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<number>();
    paginatedRecords.forEach(record => {
      if (!selectedRows.has(record.記錄id)) {
        newSelected.add(record.記錄id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = async (recordType: '生命表徵' | '血糖控制' | '體重控制') => {
    const filteredByType = healthRecords.filter(record => record.記錄類型 === recordType);
    const selectedRecords = selectedRows.size > 0 
      ? filteredByType.filter(r => selectedRows.has(r.記錄id))
      : filteredByType;
    
    if (selectedRecords.length === 0) {
      alert(`沒有${recordType}記錄可匯出`);
      return;
    }

    const uniquePatients = [...new Set(selectedRecords.map(r => r.院友id))].length;
    const isLargeExport = selectedRecords.length > 1000 || uniquePatients > 50;
    
    if (isLargeExport) {
      if (!confirm(`您即將匯出大量資料 (${selectedRecords.length} 筆)，是否繼續？`)) {
        return;
      }
    }

    try {
      setIsExporting(true);
      
      if (recordType === '生命表徵') {
        const vitalSignData: VitalSignExportData[] = selectedRecords.map(record => {
          const patient = patients.find(p => p.院友id === record.院友id);
          return {
            記錄id: record.記錄id,
            床號: patient?.床號 || '',
            中文姓氏: patient?.中文姓氏 || '',
            中文名字: patient?.中文名字 || '',
            中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
            性別: patient?.性別 || '',
            出生日期: patient?.出生日期 || '',
            記錄日期: record.記錄日期,
            記錄時間: record.記錄時間,
            血壓收縮壓: record.血壓收縮壓,
            血壓舒張壓: record.血壓舒張壓,
            脈搏: record.脈搏,
            體溫: record.體溫,
            血含氧量: record.血含氧量,
            呼吸頻率: record.呼吸頻率,
            備註: record.備註,
            記錄人員: record.記錄人員
          };
        });
        await exportVitalSignsToExcel(vitalSignData, patients);
      } else if (recordType === '血糖控制') {
        const bloodSugarData: BloodSugarExportData[] = selectedRecords.map(record => {
          const patient = patients.find(p => p.院友id === record.院友id);
          return {
            記錄id: record.記錄id,
            床號: patient?.床號 || '',
            中文姓氏: patient?.中文姓氏 || '',
            中文名字: patient?.中文名字 || '',
            中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
            性別: patient?.性別 || '',
            出生日期: patient?.出生日期 || '',
            記錄日期: record.記錄日期,
            記錄時間: record.記錄時間,
            血糖值: record.血糖值,
            備註: record.備註,
            記錄人員: record.記錄人員
          };
        });
        await exportBloodSugarToExcel(bloodSugarData, patients);
      } else if (recordType === '體重控制') {
        const { exportBodyweightToExcel } = await import('../utils/bodyweightExcelGenerator');
        const bodyweightData = selectedRecords.map(record => {
          const patient = patients.find(p => p.院友id === record.院友id);
          return {
            記錄id: record.記錄id,
            床號: patient?.床號 || '',
            中文姓氏: patient?.中文姓氏 || '',
            中文名字: patient?.中文名字 || '',
            中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
            性別: patient?.性別 || '',
            出生日期: patient?.出生日期 || '',
            記錄日期: record.記錄日期,
            記錄時間: record.記錄時間,
            體重: record.體重,
            備註: record.備註,
            記錄人員: record.記錄人員
          };
        });
        await exportBodyweightToExcel(bodyweightData, patients);
      }
    } catch (error) {
      alert(`匯出${recordType}失敗`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBatchUpload = (recordType: '生命表徵' | '血糖控制' | '體重控制') => {
    setBatchRecordType(recordType);
    setShowBatchModal(true);
  };

  const handleDeduplicateRecords = async () => {
    setIsAnalyzingDuplicates(true);
    try {
      const groups = await findDuplicateHealthRecords();
      if (groups.length === 0) {
        alert('未发现重复记录');
        return;
      }
      setDuplicateGroups(groups);
      setShowDeduplicateModal(true);
    } catch (error) {
      alert('分析重复记录失败，请重试');
    } finally {
      setIsAnalyzingDuplicates(false);
    }
  };

  const handleConfirmDeduplicate = async (recordIds: number[]) => {
    try {
      await batchDeleteDuplicateRecords(recordIds);
      alert(`成功删除 ${recordIds.length} 条重复记录！`);
      if (refreshData) await refreshData();
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      throw error;
    }
  };

  const handleGenerateRandomTemperatures = async () => {
    try {
      setIsGeneratingTemperature(true);
      const { eligiblePatients, excludedPatients } = checkEligiblePatientsForTemperature();
      
      let confirmMessage = `一鍵生成體溫記錄\n\n`;
      confirmMessage += `將為 ${eligiblePatients.length} 位符合條件的院友生成體溫記錄\n`;
      
      if (eligiblePatients.length === 0) {
        alert(confirmMessage + '\n\n沒有符合條件的院友需要生成體溫記錄。');
        return;
      }
      
      if (!confirm(confirmMessage + '\n\n確定要生成體溫記錄嗎？')) return;
      
      const count = await generateRandomTemperaturesForActivePatients();
      await recordDailyTemperatureGenerationCompletion();
      alert(`成功為 ${count} 位院友生成體溫記錄！`);
      if (refreshData) await refreshData();

    } catch (error) {
      alert('生成體溫記錄失敗');
    } finally {
      setIsGeneratingTemperature(false);
    }
  };

  const calculateWeightChange = (currentWeight: number, patientId: number, currentDate: string): string => {
    const allWeightRecords = healthRecords
      .filter(r => r.院友id === patientId && typeof r.體重 === 'number')
      .map(r => ({ 體重: r.體重, 記錄日期: r.記錄日期, 記錄時間: r.記錄時間 }))
      .sort((a, b) => new Date(`${a.記錄日期} ${a.記錄時間}`).getTime() - new Date(`${b.記錄日期} ${b.記錄時間}`).getTime());

    if (allWeightRecords.length === 0) return '最遠記錄';

    const currentDateTime = new Date(`${currentDate} 00:00`).getTime();
    const previousRecords = allWeightRecords.filter(r => 
      new Date(`${r.記錄日期} ${r.記錄時間}`).getTime() < currentDateTime
    );
    
    if (previousRecords.length === 0) return '最遠記錄';
    
    const previousRecord = previousRecords[previousRecords.length - 1];
    const difference = currentWeight - previousRecord.體重!;

    if (difference === 0) return '無變化';

    const percentage = (difference / previousRecord.體重!) * 100;
    const sign = difference > 0 ? '+' : '';
    return `${sign}${difference.toFixed(1)}kg (${sign}${percentage.toFixed(1)}%)`;
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">監測記錄</h1>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* 匯出Excel按鈕 - 只在有選定時顯示 */}
            {selectedRows.size > 0 && (
              <div className="relative group">
                <button
                  className="btn-primary flex items-center space-x-2 whitespace-nowrap"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>匯出中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>匯出 Excel</span>
                    </>
                  )}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <button
                    onClick={() => handleExportSelected('生命表徵')}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span>生命表徵記錄表</span>
                  </button>
                  <button
                    onClick={() => handleExportSelected('血糖控制')}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Droplets className="h-4 w-4 text-red-600" />
                    <span>血糖測試記錄表</span>
                  </button>
                  <button
                    onClick={() => handleExportSelected('體重控制')}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Scale className="h-4 w-4 text-green-600" />
                    <span>體重記錄表</span>
                  </button>
                </div>
              </div>
            )}

            {/* 其他功能下拉選單 */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="btn-secondary flex items-center space-x-2 whitespace-nowrap"
                title="其他功能"
              >
                <MoreVertical className="h-4 w-4" />
                <span>其他功能</span>
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[70vh] overflow-y-auto">
                    {/* 批量上傳子選單 */}
                    <div className="border-b border-gray-200">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        批量上傳
                      </div>
                      <button
                        onClick={() => {
                          handleBatchUpload('生命表徵');
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span>批量新增生命表徵</span>
                      </button>
                      <button
                        onClick={() => {
                          handleBatchUpload('血糖控制');
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Droplets className="h-4 w-4 text-red-600" />
                        <span>批量新增血糖記錄</span>
                      </button>
                      <button
                        onClick={() => {
                          handleBatchUpload('體重控制');
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Scale className="h-4 w-4 text-green-600" />
                        <span>批量新增體重記錄</span>
                      </button>
                    </div>

                    {/* 其他功能 */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleDeduplicateRecords();
                          setShowMoreMenu(false);
                        }}
                        disabled={isAnalyzingDuplicates}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isAnalyzingDuplicates ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span>分析中...</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>記錄去重</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRecycleBin(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Recycle className="h-4 w-4" />
                        <span>回收筒</span>
                      </button>
                      <button
                        onClick={() => {
                          handleGenerateRandomTemperatures();
                          setShowMoreMenu(false);
                        }}
                        disabled={isGeneratingTemperature}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-lg flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isGeneratingTemperature ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                            <span>生成中...</span>
                          </>
                        ) : (
                          <>
                            <Thermometer className="h-4 w-4" />
                            <span>一鍵生成體溫</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedRecord(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>新增記錄</span>
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
                  placeholder="搜索院友姓名、床號、記錄日期或備註..."
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
                <label className="form-label">記錄日期區間</label>
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
                  <label className="form-label">記錄類型</label>
                  <select
                    value={advancedFilters.記錄類型}
                    onChange={(e) => updateAdvancedFilter('記錄類型', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有類型</option>
                    <option value="生命表徵">生命表徵</option>
                    <option value="血糖控制">血糖控制</option>
                    <option value="體重控制">體重控制</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">記錄人員</label>
                  <input
                    list="recorder-options"
                    value={advancedFilters.記錄人員}
                    onChange={(e) => updateAdvancedFilter('記錄人員', e.target.value)}
                    className="form-input"
                    placeholder="選擇或輸入記錄人員..."
                  />
                  <datalist id="recorder-options">
                    {getUniqueOptions('記錄人員').map(option => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="form-label">備註</label>
                  <input
                    type="text"
                    value={advancedFilters.備註}
                    onChange={(e) => updateAdvancedFilter('備註', e.target.value)}
                    className="form-input"
                    placeholder="搜索備註內容..."
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
                    <option value="全部">全部</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆監測記錄 (共 {healthRecords.length} 筆)</span>
            {(searchTerm || hasAdvancedFilters()) && (
              <span className="text-blue-600">已套用篩選條件</span>
            )}
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
                  {selectedRows.size === paginatedRecords.length ? '取消全選' : '全選'}
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
        {paginatedRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedRecords.length && paginatedRecords.length > 0} 
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">院友姓名</SortableHeader>
                  <SortableHeader field="記錄日期">日期時間</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    生命表徵
                  </th>
                  <SortableHeader field="血糖值">血糖值</SortableHeader>
                  <SortableHeader field="體重">體重</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    備註
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRecords.map(record => {
                  const patient = patients.find(p => p.院友id === record.院友id);
                  const weightChange = record.體重 ? calculateWeightChange(record.體重, record.院友id, record.記錄日期) : null;
                  
                  return (
                    <tr 
                      key={record.記錄id} 
                      className={`hover:bg-gray-50 ${selectedRows.has(record.記錄id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(record)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(record.記錄id)}
                          onChange={() => handleSelectRow(record.記錄id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                            {patient?.院友相片 ? (
                              <img 
                                src={patient.院友相片} 
                                alt={patient.中文姓名} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {patient ? (
                                <PatientTooltip patient={patient}>
                                  <span className="cursor-help hover:text-blue-600 transition-colors">
                                    {patient.中文姓氏}{patient.中文名字}
                                  </span>
                                </PatientTooltip>
                              ) : (
                                '-'
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{patient?.床號}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div>{new Date(record.記錄日期).toLocaleDateString('zh-TW')}</div>
                            {record.記錄類型 !== '體重控制' && record.記錄時間 !== '00:00' && (
                              <div className="text-xs text-gray-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(`2000-01-01T${record.記錄時間}`).toLocaleTimeString('zh-TW', { 
                                  hour: 'numeric', 
                                  minute: '2-digit', 
                                  hour12: true 
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {record.血壓收縮壓 && record.血壓舒張壓 && (
                            <div className="text-xs">血壓: {record.血壓收縮壓}/{record.血壓舒張壓} mmHg</div>
                          )}
                          {record.脈搏 && (
                            <div className="text-xs">脈搏: {record.脈搏} /min</div>
                          )}
                          {record.體溫 && (
                            <div className="text-xs">體溫: {record.體溫}°C</div>
                          )}
                          {record.血含氧量 && (
                            <div className="text-xs">血氧: {record.血含氧量}%</div>
                          )}
                          {record.呼吸頻率 && (
                            <div className="text-xs">呼吸: {record.呼吸頻率} /min</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.血糖值 ? (
                          <div>
                            <div className="font-medium">{record.血糖值} mmol/L</div>
                            {record.記錄類型 === '血糖控制' && record.備註 && (
                              <div className="text-xs text-gray-500 truncate" title={record.備註}>
                                {record.備註}
                              </div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.體重 ? (
                          <div>
                            <div className="font-medium">{record.體重} kg</div>
                            {weightChange && weightChange !== '首次記錄' && weightChange !== '無變化' && (
                              <div className={`text-xs flex items-center ${
                                weightChange.startsWith('+')
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}>
                                {weightChange.startsWith('+') ? 
                                  <TrendingUp className="h-3 w-3 mr-1" /> : 
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                }
                                {weightChange}
                              </div>
                            )}
                            {weightChange === '無變化' && (
                              <div className="text-xs text-gray-500 flex items-center">
                                <Minus className="h-3 w-3 mr-1" />
                                {weightChange}
                              </div>
                            )}
                            {weightChange === '首次記錄' && (
                              <div className="text-xs text-blue-600">{weightChange}</div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {record.備註 || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(record.記錄id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.記錄id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(record.記錄id)}
                          >
                            {deletingIds.has(record.記錄id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Heart className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的記錄' : '暫無監測記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始記錄院友的健康狀況'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增監測記錄
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
        <HealthRecordModal
          record={selectedRecord}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
          }}
        />
      )}

      {showBatchModal && (
        <BatchHealthRecordModal
          recordType={batchRecordType}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {showDeduplicateModal && (
        <DeduplicateRecordsModal
          duplicateGroups={duplicateGroups}
          onClose={() => {
            setShowDeduplicateModal(false);
            setDuplicateGroups([]);
          }}
          onConfirm={handleConfirmDeduplicate}
          patients={patients}
        />
      )}

      {showRecycleBin && (
        <RecycleBinModal
          onClose={() => setShowRecycleBin(false)}
        />
      )}

      <button
        onClick={debugDataLoading}
        className="btn-secondary flex items-center space-x-2"
      >
        <Activity className="h-4 w-4" />
        <span>調試數據載入</span>
      </button>

      {debugInfo && (
        <div className="card p-4 bg-yellow-50 border border-yellow-200">
          <h3 className="text-lg font-medium text-yellow-900 mb-3">調試信息</h3>
          <div className="space-y-2 text-sm">
            <div>體重控制記錄數量: <strong>{debugInfo.weightRecords}</strong></div>
            <div>資料庫中的記錄類型: <strong>{debugInfo.allTypes.join(', ')}</strong></div>
            <div>有體重數值的記錄數量: <strong>{debugInfo.weightData}</strong></div>
            {debugInfo.weightDataSample.length > 0 && (
              <div>
                <div>體重數據範例:</div>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo.weightDataSample, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <button
            onClick={() => setDebugInfo(null)}
            className="mt-3 text-yellow-600 hover:text-yellow-700 text-sm"
          >
            關閉調試信息
          </button>
        </div>
      )}
    </div>
  );

};

export default HealthAssessment;