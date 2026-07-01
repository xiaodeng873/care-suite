import React, { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';
import { LoadingScreen } from '../components/PageLoadingScreen';
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
  Thermometer,
  Printer
} from 'lucide-react';
import { usePatients, DuplicateRecordGroup } from '../context/PatientContext';
import HealthRecordModal from '../components/HealthRecordModal';
import DeduplicateRecordsModal from '../components/DeduplicateRecordsModal';
import RecycleBinModal from '../components/RecycleBinModal';
import TemperatureWorksheetModal from '../components/TemperatureWorksheetModal';
import BodyweightWorksheetModal from '../components/BodyweightWorksheetModal';
import GlucoseWorksheetModal from '../components/GlucoseWorksheetModal';
import BloodPressureWorksheetModal from '../components/BloodPressureWorksheetModal';
import GenerateTemperatureModal from '../components/GenerateTemperatureModal';
import { exportVitalSignsToExcel, type VitalSignExportData } from '../utils/vitalsignExcelGenerator';
import { exportBloodSugarToExcel, type BloodSugarExportData } from '../utils/bloodSugarExcelGenerator';
import PatientTooltip from '../components/PatientTooltip';
import { syncTaskStatus } from '../lib/database';
import type { HealthRecord } from '../lib/database';
type SortField = '記錄日期' | '記錄時間' | '院友姓名' | '監測類型' | '數值';
type SortDirection = 'asc' | 'desc';
interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  監測類型: string;
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
    findDuplicateHealthRecords,
    batchDeleteDuplicateRecords,
    refreshData,
    loadFullHealthRecords
  } = usePatients();
  // [新增] 進入頁面時，觸發載入完整歷史記錄
  useEffect(() => {
    loadFullHealthRecords();
  }, [loadFullHealthRecords]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRecordGroup, setSelectedRecordGroup] = useState<HealthRecord[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [sortField, setSortField] = useState<SortField>('記錄日期');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateRecordGroup[]>([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [isAnalyzingDuplicates, setIsAnalyzingDuplicates] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showTemperatureModal, setShowTemperatureModal] = useState(false);
  const [showBodyweightModal, setShowBodyweightModal] = useState(false);
  const [showGlucoseModal, setShowGlucoseModal] = useState(false);
  const [showBloodPressureModal, setShowBloodPressureModal] = useState(false);
  const [showGenerateTemperatureModal, setShowGenerateTemperatureModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    監測類型: '',
    記錄人員: '',
    備註: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
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
      監測類型: '',
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

  if (loading) {
    return <LoadingScreen pageName="監測記錄" />;
  }
  const filteredRecords = useMemo(() => healthRecords.filter(record => {
    const patient = patients.find(p => p.院友id === record.院友id);
    // 確保院友存在
    if (!patient) return false;
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) {
      return false;
    }
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
      return false;
    }
    if (advancedFilters.監測類型 && advancedFilters.監測類型 !== '' && record.監測類型 !== advancedFilters.監測類型) {
      return false;
    }
    if (advancedFilters.記錄人員 && !fuzzyMatch(record.記錄人員, advancedFilters.記錄人員)) {
      return false;
    }
    if (advancedFilters.備註 && !fuzzyMatch(record.備註, advancedFilters.備註)) {
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
    if (deferredSearch) {
      matchesSearch = matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, deferredSearch) ||
                         matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, deferredSearch) ||
                         fuzzyMatch(patient?.身份證號碼, deferredSearch) ||
                         matchBedNumber(patient?.床號, deferredSearch) ||
                         fuzzyMatch(record.備註, deferredSearch) ||
                         fuzzyMatch(new Date(record.記錄日期).toLocaleDateString('zh-TW'), deferredSearch) ||
                         false;
    }
    return matchesSearch;
  }), [healthRecords, patients, advancedFilters, deferredSearch]);
  const sortedRecords = useMemo(() => [...filteredRecords].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.院友id);
    const patientB = patients.find(p => p.院友id === b.院友id);
    if (deferredSearch) {
      const bedCmp = comparePatientsForSearch({ 床號: patientA?.床號 }, { 床號: patientB?.床號 }, deferredSearch);
      if (bedCmp !== 0) return bedCmp;
    }
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
      case '監測類型':
        valueA = a.監測類型;
        valueB = b.監測類型;
        break;
      case '數值':
        valueA = a.數值 || 0;
        valueB = b.數值 || 0;
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
  }), [filteredRecords, patients, deferredSearch, sortField, sortDirection]);
  const totalItems = sortedRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = sortedRecords.slice(startIndex, endIndex);
  // 將同一院友、同一日期時間的多項監測合併為一列（各類型作為欄目）
  interface GroupedRow {
    key: string;
    院友id: number;
    記錄日期: string;
    記錄時間: string;
    byType: Record<string, any>;
    ids: string[];
    備註: string;
  }
  const groupedRows: GroupedRow[] = (() => {
    const map = new Map<string, GroupedRow>();
    paginatedRecords.forEach(r => {
      const key = `${r.院友id}|${r.記錄日期}|${r.記錄時間}`;
      if (!map.has(key)) {
        map.set(key, { key, 院友id: r.院友id, 記錄日期: r.記錄日期, 記錄時間: r.記錄時間, byType: {}, ids: [], 備註: '' });
      }
      const g = map.get(key)!;
      g.byType[r.監測類型] = r;
      g.ids.push(r.記錄id);
      if (r.備註) g.備註 = g.備註 ? `${g.備註}；${r.備註}` : r.備註;
    });
    return Array.from(map.values());
  })();
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
  const handleEdit = (group: GroupedRow) => {
    setSelectedRecordGroup(Object.values(group.byType) as HealthRecord[]);
    setShowModal(true);
  };
  const handleDelete = async (id: string) => {
    const record = healthRecords.find(r => r.記錄id === id);
    const patient = patients.find(p => p.院友id === record?.院友id);
    if (confirm(`確定要刪除 ${patient?.中文姓名} 在 ${record?.記錄日期} ${record?.記錄時間} 的${record?.監測類型}記錄嗎？\n\n此操作不可復原。`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteHealthRecord(id);
        if (record?.任務id) {
          await syncTaskStatus(record.任務id);
          if (refreshData) await refreshData();
        }
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        console.error('刪除記錄失敗:', error);
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
    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆監測記錄嗎？\n\n刪除後可在回收筒中恢復。`;
    if (!confirm(confirmMessage)) {
      return;
    }
    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    let successCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];
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
      const newSelectedRows = new Set<string>();
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
    const allIds = groupedRows.flatMap(g => g.ids);
    if (selectedRows.size === allIds.length && allIds.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(allIds));
    }
  };
  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    groupedRows.forEach(g => {
      g.ids.forEach(id => {
        if (!selectedRows.has(id)) newSelected.add(id);
      });
    });
    setSelectedRows(newSelected);
  };
  const toggleGroupSelection = (ids: string[]) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      ids.forEach(id => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  };
  const handleDeleteGroupRecords = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`確定要刪除此列共 ${ids.length} 項監測記錄嗎？\n\n刪除後可在回收筒中恢復。`)) return;
    setDeletingIds(new Set(ids));
    try {
      for (const id of ids) {
        await deleteHealthRecord(id);
      }
      setSelectedRows(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      if (refreshData) await refreshData();
    } catch (error) {
      console.error('刪除記錄失敗:', error);
      alert('刪除記錄失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };
  const handleExportSelected = async (exportCategory: '生命表徵' | '血糖控制' | '體重控制') => {
    let filterFn: (r: (typeof healthRecords)[0]) => boolean;
    if (exportCategory === '血糖控制') filterFn = r => r.監測類型 === '血糖值';
    else if (exportCategory === '體重控制') filterFn = r => r.監測類型 === '體重';
    else filterFn = r => ['血壓', '脈搏', '體溫', '血含氧量', '呼吸'].includes(r.監測類型);

    const filteredByType = healthRecords.filter(filterFn);
    const selectedRecords = selectedRows.size > 0
      ? filteredByType.filter(r => selectedRows.has(r.記錄id))
      : filteredByType;
    if (selectedRecords.length === 0) {
      alert(`沒有${exportCategory}記錄可匯出`);
      return;
    }
    const uniquePatients = [...new Set(selectedRecords.map(r => r.院友id))].length;
    if (selectedRecords.length > 1000 || uniquePatients > 50) {
      if (!confirm(`您即將匯出大量資料 (${selectedRecords.length} 筆)，是否繼續？`)) return;
    }
    try {
      setIsExporting(true);
      if (exportCategory === '生命表徵') {
        // 將同一時段（院友+日期+時間）的記錄合併為一行
        const sessionMap = new Map<string, typeof selectedRecords>();
        selectedRecords.forEach(r => {
          const key = `${r.院友id}-${r.記錄日期}-${r.記錄時間}`;
          if (!sessionMap.has(key)) sessionMap.set(key, []);
          sessionMap.get(key)!.push(r);
        });
        const vitalSignData: VitalSignExportData[] = Array.from(sessionMap.values()).map(group => {
          const first = group[0];
          const patient = patients.find(p => p.院友id === first.院友id);
          const bp = group.find(r => r.監測類型 === '血壓');
          return {
            記錄id: first.記錄id,
            床號: patient?.床號 || '',
            中文姓氏: patient?.中文姓氏 || '',
            中文名字: patient?.中文名字 || '',
            中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
            性別: patient?.性別 || '',
            出生日期: patient?.出生日期 || '',
            記錄日期: first.記錄日期,
            記錄時間: first.記錄時間,
            血壓收縮壓: bp?.數值,
            血壓舒張壓: bp?.數值_副,
            脈搏: group.find(r => r.監測類型 === '脈搏')?.數值,
            體溫: group.find(r => r.監測類型 === '體溫')?.數值,
            血含氧量: group.find(r => r.監測類型 === '血含氧量')?.數值,
            呼吸: group.find(r => r.監測類型 === '呼吸')?.數值,
            備註: first.備註,
            記錄人員: first.記錄人員,
          };
        });
        await exportVitalSignsToExcel(vitalSignData, patients);
      } else if (exportCategory === '血糖控制') {
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
            血糖值: record.數值,
            備註: record.備註,
            記錄人員: record.記錄人員,
          };
        });
        await exportBloodSugarToExcel(bloodSugarData, patients);
      } else {
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
            體重: record.數值,
            備註: record.備註,
            記錄人員: record.記錄人員,
          };
        });
        await exportBodyweightToExcel(bodyweightData, patients);
      }
    } catch (error) {
      alert(`匯出${exportCategory}失敗`);
    } finally {
      setIsExporting(false);
    }
  };
  const handleDeduplicateRecords = async () => {
    setIsAnalyzingDuplicates(true);
    try {
      const groups = await findDuplicateHealthRecords();
      if (groups.length === 0) {
        alert('未發現重複記錄');
        return;
      }
      setDuplicateGroups(groups);
      setShowDeduplicateModal(true);
    } catch (error) {
      alert('分析重複記錄失敗，請重試');
    } finally {
      setIsAnalyzingDuplicates(false);
    }
  };
  const handleConfirmDeduplicate = async (recordIds: number[]) => {
    try {
      await batchDeleteDuplicateRecords(recordIds);
      alert(`成功刪除 ${recordIds.length} 筆重複記錄！`);
      if (refreshData) await refreshData();
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      throw error;
    }
  };
  const calculateWeightChange = (currentWeight: number, patientId: number, currentDate: string): string => {
    const allWeightRecords = healthRecords
      .filter(r => r.院友id === patientId && r.監測類型 === '體重')
      .map(r => ({ 體重: r.數值, 記錄日期: r.記錄日期, 記錄時間: r.記錄時間 }))
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
                  className="btn-primary flex flex-wrap items-center gap-2 whitespace-nowrap"
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
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                  >
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span>生命表徵記錄表</span>
                  </button>
                  <button
                    onClick={() => handleExportSelected('血糖控制')}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                  >
                    <Droplets className="h-4 w-4 text-red-600" />
                    <span>血糖測試記錄表</span>
                  </button>
                  <button
                    onClick={() => handleExportSelected('體重控制')}
                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                  >
                    <Scale className="h-4 w-4 text-green-600" />
                    <span>體重記錄表</span>
                  </button>
                </div>
              </div>
            )}
            {/* 列印下拉選單 */}
            <div className="relative">
              <button
                onClick={() => setShowPrintMenu(!showPrintMenu)}
                className="btn-secondary flex flex-wrap items-center gap-2 whitespace-nowrap"
                title="列印"
              >
                <Printer className="h-4 w-4" />
                <span>列印</span>
              </button>
              {showPrintMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPrintMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowTemperatureModal(true);
                          setShowPrintMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2"
                      >
                        <Thermometer className="h-4 w-4 text-orange-600" />
                        <span>體溫記錄</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowBodyweightModal(true);
                          setShowPrintMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2"
                      >
                        <Scale className="h-4 w-4 text-green-600" />
                        <span>體重記錄</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowGlucoseModal(true);
                          setShowPrintMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2"
                      >
                        <Droplets className="h-4 w-4 text-red-600" />
                        <span>血糖記錄</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowBloodPressureModal(true);
                          setShowPrintMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2"
                      >
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span>血壓記錄</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* 其他功能下拉選單 */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="btn-secondary flex flex-wrap items-center gap-2 whitespace-nowrap"
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
                    {/* 其他功能 */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleDeduplicateRecords();
                          setShowMoreMenu(false);
                        }}
                        disabled={isAnalyzingDuplicates}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2 disabled:opacity-50"
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
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex flex-wrap items-center gap-2"
                      >
                        <Recycle className="h-4 w-4" />
                        <span>回收筒</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowGenerateTemperatureModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-lg flex flex-wrap items-center gap-2"
                      >
                        <Thermometer className="h-4 w-4" />
                        <span>一鍵生成體溫</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedRecordGroup(null);
                setShowModal(true);
              }}
              className="btn-primary flex flex-wrap items-center gap-2 whitespace-nowrap"
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
                <label className="form-label">記錄日期區間</label>
                <div className="flex flex-wrap items-center gap-2">
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
                  <label className="form-label">監測類型</label>
                  <select
                    value={advancedFilters.監測類型}
                    onChange={(e) => updateAdvancedFilter('監測類型', e.target.value)}
                    className="form-input"
                  >
                    <option value="">所有類型</option>
                    <option value="血壓">血壓</option>
                    <option value="脈搏">脈搏</option>
                    <option value="體溫">體溫</option>
                    <option value="血含氧量">血含氧量</option>
                    <option value="呼吸">呼吸</option>
                    <option value="血糖值">血糖值</option>
                    <option value="體重">體重</option>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedRows.size === groupedRows.flatMap(g => g.ids).length && groupedRows.length > 0 ? '取消全選' : '全選'}
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
        {groupedRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1024px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === groupedRows.flatMap(g => g.ids).length && groupedRows.length > 0} 
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">床號</SortableHeader>
                  <SortableHeader field="院友姓名">院友姓名</SortableHeader>
                  <SortableHeader field="記錄日期">日期時間</SortableHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">體溫</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">血壓</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">脈搏</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">血含氧量</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">呼吸</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">血糖值</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">體重</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedRows.map(group => {
                  const patient = patients.find(p => p.院友id === group.院友id);
                  const fmt = (type: string) => {
                    const r = group.byType[type];
                    if (!r) return '-';
                    if (r.數值 === 0 && r.備註?.includes('無法量度')) return '-';
                    if (type === '血壓') return `${r.數值}/${r.數值_副}`;
                    return r.數值 ?? '-';
                  };
                  const groupSelected = group.ids.every(id => selectedRows.has(id));
                  const firstRecord = group.byType['體重'] ? group.byType['體重'] : group.byType[Object.keys(group.byType)[0]];
                  const isDeleting = group.ids.some(id => deletingIds.has(id));
                  return (
                    <tr
                      key={group.key}
                      className={`hover:bg-gray-50 ${groupSelected ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(group)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={groupSelected}
                          onChange={() => toggleGroupSelection(group.ids)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{patient?.床號 || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                            {patient?.院友相片 ? (
                              <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          {patient ? (
                            <PatientTooltip patient={patient}>
                              <span className="cursor-help hover:text-blue-600 transition-colors">{patient.中文姓氏}{patient.中文名字}</span>
                            </PatientTooltip>
                          ) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{new Date(group.記錄日期).toLocaleDateString('zh-TW')}</div>
                        {group.記錄時間 && group.記錄時間 !== '00:00' && (
                          <div className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(`2000-01-01T${group.記錄時間}`).toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('體溫')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('血壓')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('脈搏')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('血含氧量')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('呼吸')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('血糖值')}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{fmt('體重')}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">{group.備註 || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEdit(group)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={isDeleting}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroupRecords(group.ids)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
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
      {showModal && (
        <HealthRecordModal
          recordGroup={selectedRecordGroup ?? undefined}
          onClose={() => {
            setShowModal(false);
            setSelectedRecordGroup(null);
          }}
          onTaskCompleted={async (taskId, recordDateTime) => {
            try {
              await syncTaskStatus(taskId);
              if (refreshData) await refreshData();
            } catch (error) {
              console.error('[HealthAssessment] syncTaskStatus 失敗:', error);
            }
          }}
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
      {showTemperatureModal && (
        <TemperatureWorksheetModal
          onClose={() => setShowTemperatureModal(false)}
        />
      )}
      {showBodyweightModal && (
        <BodyweightWorksheetModal
          onClose={() => setShowBodyweightModal(false)}
        />
      )}
      {showGlucoseModal && (
        <GlucoseWorksheetModal
          onClose={() => setShowGlucoseModal(false)}
        />
      )}
      {showBloodPressureModal && (
        <BloodPressureWorksheetModal
          onClose={() => setShowBloodPressureModal(false)}
        />
      )}
      {showGenerateTemperatureModal && (
        <GenerateTemperatureModal
          onClose={() => setShowGenerateTemperatureModal(false)}
        />
      )}

    </div>
  );
};
export default HealthAssessment;