import React, { useState } from 'react';
import { Guitar as Hospital, Plus, CreditCard as Edit3, Trash2, Search, Filter, Download, User, Calendar, MapPin, Bed, FileText, ChevronUp, ChevronDown, X, Activity } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import HospitalEpisodeModal from '../components/HospitalEpisodeModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '開始日期' | '院友姓名' | '主要醫院' | '狀態' | '創建時間';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  主要醫院: string;
  主要病房: string;
  狀態: string;
  出院安排: string;
  備註: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const AdmissionRecords: React.FC = () => {
  const { hospitalEpisodes, patients, deleteHospitalEpisode, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('開始日期');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    主要醫院: '',
    主要病房: '',
    狀態: '',
    出院安排: '',
    備註: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住'
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

  const filteredEpisodes = hospitalEpisodes.filter(episode => {
    const patient = patients.find(p => p.院友id === episode.patient_id);
    
    // 確保院友存在
    if (!patient) {
      return false;
    }
    
    // 先應用進階篩選
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
      return false;
    }
    if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
      return false;
    }
    if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
      return false;
    }
    if (advancedFilters.主要醫院 && !episode.primary_hospital?.toLowerCase().includes(advancedFilters.主要醫院.toLowerCase())) {
      return false;
    }
    if (advancedFilters.主要病房 && !episode.primary_ward?.toLowerCase().includes(advancedFilters.主要病房.toLowerCase())) {
      return false;
    }
    // 使用動態計算的狀態進行篩選
    if (advancedFilters.狀態) {
      // 使用統一的狀態計算函數
      const dynamicStatus = calculateDynamicStatus(episode).status;

      if (dynamicStatus !== advancedFilters.狀態) {
        return false;
      }
    }
    if (advancedFilters.出院安排 && episode.discharge_type !== advancedFilters.出院安排) {
      return false;
    }
    if (advancedFilters.備註 && !episode.remarks?.toLowerCase().includes(advancedFilters.備註.toLowerCase())) {
      return false;
    }
    
    // 日期區間篩選
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const startDate = new Date(episode.episode_start_date);
      if (advancedFilters.startDate && startDate < new Date(advancedFilters.startDate)) {
        return false;
      }
      if (advancedFilters.endDate && startDate > new Date(advancedFilters.endDate)) {
        return false;
      }
    }
    
    // 然後應用搜索條件
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.primary_hospital?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.primary_ward?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.primary_bed_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.remarks?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         new Date(episode.episode_start_date).toLocaleDateString('zh-TW').includes(searchTerm.toLowerCase()) ||
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
      床號: '',
      中文姓名: '',
      主要醫院: '',
      主要病房: '',
      狀態: '',
      出院安排: '',
      備註: '',
      startDate: '',
      endDate: '',
      在住狀態: '在住'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    hospitalEpisodes.forEach(episode => {
      let value = '';
      
      switch (field) {
        case '主要醫院':
          value = episode.primary_hospital || '';
          break;
        case '主要病房':
          value = episode.primary_ward || '';
          break;
        default:
          return;
      }
      
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  const sortedEpisodes = [...filteredEpisodes].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    
    // 預設排序：狀態為'active'(入院中)的優先，其餘按住院日期排序
    if (sortField === '開始日期' && sortDirection === 'desc') {
      // 狀態為'active'的記錄優先
      if (a.status === 'active' && b.status !== 'active') {
        return -1;
      }
      if (a.status !== 'active' && b.status === 'active') {
        return 1;
      }
      
      // 如果狀態相同，按住院開始日期排序（最新的在前）
      const dateA = new Date(a.episode_start_date).getTime();
      const dateB = new Date(b.episode_start_date).getTime();
      return dateB - dateA;
    }
    
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '開始日期':
        valueA = new Date(a.episode_start_date).getTime();
        valueB = new Date(b.episode_start_date).getTime();
        break;
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case '主要醫院':
        valueA = a.primary_hospital || '';
        valueB = b.primary_hospital || '';
        break;
      case '狀態':
        valueA = a.status || '';
        valueB = b.status || '';
        break;
      case '創建時間':
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
  const totalItems = sortedEpisodes.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEpisodes = sortedEpisodes.slice(startIndex, endIndex);

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

  const handleEdit = (episode: any) => {
    setSelectedEpisode(episode);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const episode = hospitalEpisodes.find(e => e.id === id);
    const patient = patients.find(p => p.院友id === episode?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 從 ${episode?.episode_start_date} 開始的缺席事件嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteHospitalEpisode(id);
        setSelectedRows(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (error) {
        alert('刪除缺席事件失敗，請重試');
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 個缺席事件嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const episodeId of deletingArray) {
        await deleteHospitalEpisode(episodeId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 個缺席事件`);
    } catch (error) {
      console.error('批量刪除缺席事件失敗:', error);
      alert('批量刪除缺席事件失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleSelectRow = (episodeId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(episodeId)) {
      newSelected.delete(episodeId);
    } else {
      newSelected.add(episodeId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedEpisodes.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedEpisodes.map(e => e.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedEpisodes.forEach(episode => {
      if (!selectedRows.has(episode.id)) {
        newSelected.add(episode.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = () => {
    const selectedEpisodes = paginatedEpisodes.filter(e => selectedRows.has(e.id));
    
    if (selectedEpisodes.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    const exportData = selectedEpisodes.map(episode => {
      const patient = patients.find(p => p.院友id === episode.patient_id);
      const dynamicStatus = calculateDynamicStatus(episode);
      return {
        床號: patient?.床號 || '',
        中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
        住院開始日期: new Date(episode.episode_start_date).toLocaleDateString('zh-TW'),
        住院結束日期: episode.episode_end_date ? new Date(episode.episode_end_date).toLocaleDateString('zh-TW') : '進行中',
        住院天數: episode.total_days || '',
        狀態: dynamicStatus.label,
        主要醫院: episode.primary_hospital || '',
        主要病房: episode.primary_ward || '',
        主要床號: episode.primary_bed_number || '',
        出院類型: episode.discharge_type ? getDischargeTypeLabel(episode.discharge_type) : '',
        出院目的地: episode.discharge_destination || '',
        備註: episode.remarks || '',
        創建時間: new Date(episode.created_at).toLocaleString('zh-TW')
      };
    });

    const headers = ['床號', '中文姓名', '住院開始日期', '住院結束日期', '住院天數', '狀態', '主要醫院', '主要病房', '主要床號', '出院類型', '出院目的地', '備註', '創建時間'];
    const csvContent = [
      `"缺席事件記錄"`,
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
    a.download = `缺席事件記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 計算動態狀態（根據事件時間軸）
  const calculateDynamicStatus = (episode: any): { status: string; label: string; color: string; vacationEndType?: string } => {
    if (!episode.episode_events || !Array.isArray(episode.episode_events) || episode.episode_events.length === 0) {
      // 沒有事件時，使用原始狀態
      return {
        status: episode.status,
        label: getStatusLabel(episode.status),
        color: getStatusColor(episode.status)
      };
    }

    // 按事件日期和時間排序，獲取最新事件
    const sortedEvents = [...episode.episode_events].sort((a, b) => {
      const dateA = new Date(`${a.event_date} ${a.event_time || '00:00'}`).getTime();
      const dateB = new Date(`${b.event_date} ${b.event_time || '00:00'}`).getTime();
      return dateB - dateA;
    });

    // 檢查是否有未結束的渡假
    const hasVacationStart = episode.episode_events.some((e: any) => e.event_type === 'vacation_start');
    const vacationEndEvent = episode.episode_events.find((e: any) => e.event_type === 'vacation_end');

    if (hasVacationStart && !vacationEndEvent) {
      return {
        status: 'vacation',
        label: '渡假中',
        color: 'bg-purple-100 text-purple-800 border-purple-200'
      };
    }

    // 檢查是否有未結束的住院（入院或轉院，但沒有出院）
    const hasAdmissionOrTransfer = episode.episode_events.some((e: any) =>
      e.event_type === 'admission' || e.event_type === 'transfer'
    );
    const hasDischarge = episode.episode_events.some((e: any) => e.event_type === 'discharge');

    if (hasAdmissionOrTransfer && !hasDischarge) {
      return {
        status: 'hospitalized',
        label: '住院中',
        color: 'bg-red-100 text-red-800 border-red-200'
      };
    }

    // 如果有出院事件，狀態為已完成
    if (hasDischarge) {
      return {
        status: 'completed',
        label: '已出院',
        color: 'bg-green-100 text-green-800 border-green-200'
      };
    }

    // 如果渡假已結束，根據 vacation_end_type 顯示狀態
    if (hasVacationStart && vacationEndEvent) {
      // 優先使用 episode.vacation_end_type，否則使用事件中的
      const vacationEndType = episode.vacation_end_type || vacationEndEvent.vacation_end_type;

      return {
        status: 'vacation_ended',
        label: '渡假結束',
        color: 'bg-green-100 text-green-800 border-green-200',
        vacationEndType
      };
    }

    // 預設返回原始狀態
    return {
      status: episode.status,
      label: getStatusLabel(episode.status),
      color: getStatusColor(episode.status)
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'transferred': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '入院中';
      case 'completed': return '已出院';
      case 'transferred': return '已轉院';
      default: return status;
    }
  };

  const getDischargeTypeLabel = (type: string) => {
    switch (type) {
      case 'return_to_facility': return '返回院舍';
      case 'home': return '回家';
      case 'transfer_out': return '轉至其他機構';
      case 'deceased': return '院內離世';
      default: return type;
    }
  };

  const getVacationEndTypeLabel = (type: string) => {
    switch (type) {
      case 'return_to_facility': return '返回院舍';
      case 'home': return '回到原居住地';
      case 'transfer_out': return '轉至其他機構';
      case 'deceased': return '渡假期間離世';
      default: return type;
    }
  };

  // 獲取實際缺席開始日期（從事件中查找）
  const getAbsenceStartDate = (episode: any): string => {
    if (!episode.episode_events || !Array.isArray(episode.episode_events) || episode.episode_events.length === 0) {
      // 沒有事件時，使用記錄創建日期作為後備
      return episode.episode_start_date;
    }

    // 按事件日期排序，找到最早的事件
    const sortedEvents = [...episode.episode_events].sort((a, b) => {
      const dateA = new Date(a.event_date).getTime();
      const dateB = new Date(b.event_date).getTime();
      return dateA - dateB;
    });

    // 優先順序：vacation_start > admission > transfer
    const vacationStart = sortedEvents.find((e: any) => e.event_type === 'vacation_start');
    if (vacationStart) {
      return vacationStart.event_date;
    }

    const admission = sortedEvents.find((e: any) => e.event_type === 'admission');
    if (admission) {
      return admission.event_date;
    }

    const transfer = sortedEvents.find((e: any) => e.event_type === 'transfer');
    if (transfer) {
      return transfer.event_date;
    }

    // 如果都沒有，使用記錄創建日期
    return episode.episode_start_date;
  };

  // 獲取實際缺席結束日期（從事件中查找）
  const getAbsenceEndDate = (episode: any): string | null => {
    // 如果有記錄的結束日期，先使用它
    if (episode.episode_end_date) {
      return episode.episode_end_date;
    }

    if (!episode.episode_events || !Array.isArray(episode.episode_events) || episode.episode_events.length === 0) {
      return null;
    }

    // 按事件日期排序，找到最新的結束事件
    const sortedEvents = [...episode.episode_events].sort((a, b) => {
      const dateA = new Date(a.event_date).getTime();
      const dateB = new Date(b.event_date).getTime();
      return dateB - dateA;
    });

    // 優先順序：discharge > vacation_end
    const discharge = sortedEvents.find((e: any) => e.event_type === 'discharge');
    if (discharge) {
      return discharge.event_date;
    }

    const vacationEnd = sortedEvents.find((e: any) => e.event_type === 'vacation_end');
    if (vacationEnd) {
      return vacationEnd.event_date;
    }

    return null;
  };

  // 智能顯示安排欄位
  const getArrangementDisplay = (episode: any): { primary: string; secondary?: string } => {
    if (!episode.episode_events || !Array.isArray(episode.episode_events) || episode.episode_events.length === 0) {
      // 沒有事件時，檢查是否有出院安排
      if (episode.discharge_type && episode.discharge_type.trim()) {
        return { primary: getDischargeTypeLabel(episode.discharge_type) };
      }
      return { primary: '未安排' };
    }

    // 檢查事件類型
    const hasVacation = episode.episode_events.some((e: any) =>
      e.event_type === 'vacation_start' || e.event_type === 'vacation_end'
    );
    const hasHospital = episode.episode_events.some((e: any) =>
      e.event_type === 'admission' || e.event_type === 'transfer' || e.event_type === 'discharge'
    );

    // 情況 A: 只有渡假事件
    if (hasVacation && !hasHospital) {
      const dynamicStatus = calculateDynamicStatus(episode);
      if (dynamicStatus.vacationEndType) {
        return { primary: getVacationEndTypeLabel(dynamicStatus.vacationEndType) };
      }
      return { primary: '未安排' };
    }

    // 情況 B: 只有住院事件
    if (hasHospital && !hasVacation) {
      if (episode.discharge_type && episode.discharge_type.trim()) {
        return { primary: getDischargeTypeLabel(episode.discharge_type) };
      }
      return { primary: '未安排' };
    }

    // 情況 C: 同時有渡假和住院事件
    if (hasVacation && hasHospital) {
      const dynamicStatus = calculateDynamicStatus(episode);
      const hasDischargeType = episode.discharge_type && episode.discharge_type.trim();
      const hasVacationEndType = dynamicStatus.vacationEndType;

      if (hasDischargeType && hasVacationEndType) {
        return {
          primary: getDischargeTypeLabel(episode.discharge_type),
          secondary: getVacationEndTypeLabel(dynamicStatus.vacationEndType)
        };
      } else if (hasDischargeType) {
        return { primary: getDischargeTypeLabel(episode.discharge_type) };
      } else if (hasVacationEndType) {
        return { primary: getVacationEndTypeLabel(dynamicStatus.vacationEndType) };
      }
      return { primary: '未安排' };
    }

    // 情況 D: 沒有任何事件（理論上不會到這裡，但作為後備）
    return { primary: '未安排' };
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
          <h1 className="text-2xl font-bold text-gray-900">缺席管理</h1>
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
                setSelectedEpisode(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增缺席事件</span>
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
                  placeholder="搜索院友姓名、床號、缺席日期、醫院名稱、病房或備註..."
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
                  <label className="form-label">缺席開始日期區間</label>
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
                    <label className="form-label">主要醫院</label>
                    <input
                      list="primary-hospital-options"
                      value={advancedFilters.主要醫院}
                      onChange={(e) => updateAdvancedFilter('主要醫院', e.target.value)}
                      className="form-input"
                      placeholder="選擇或輸入主要醫院..."
                    />
                    <datalist id="primary-hospital-options">
                      {getUniqueOptions('主要醫院').map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div>
                    <label className="form-label">狀態</label>
                    <select
                      value={advancedFilters.狀態}
                      onChange={(e) => updateAdvancedFilter('狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有狀態</option>
                      <option value="hospitalized">住院中</option>
                      <option value="vacation">渡假中</option>
                      <option value="vacation_ended">渡假結束</option>
                      <option value="completed">已出院</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">出院安排</label>
                    <select
                      value={advancedFilters.出院安排}
                      onChange={(e) => updateAdvancedFilter('出院安排', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有類型</option>
                      <option value="return_to_facility">返回院舍</option>
                      <option value="home">回家</option>
                      <option value="transfer_out">轉至其他機構</option>
                      <option value="deceased">離世</option>
                    </select>
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
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 個缺席事件 (共 {hospitalEpisodes.length} 個)</span>
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
                  {selectedRows.size === paginatedEpisodes.length ? '取消全選' : '全選'}
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
                已選擇 {selectedRows.size} / {paginatedEpisodes.length} 筆記錄
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 住院事件列表 */}
      <div className="card overflow-hidden">
        {paginatedEpisodes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedEpisodes.length && paginatedEpisodes.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <SortableHeader field="狀態">狀態</SortableHeader>
                  <SortableHeader field="開始日期">缺席日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    缺席天數
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    入住醫院
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    入住病房/床號
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    安排
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
                {paginatedEpisodes.map(episode => {
                  const patient = patients.find(p => p.院友id === episode.patient_id);
                  
                  return (
                    <tr 
                      key={episode.id} 
                      className={`hover:bg-gray-50 ${selectedRows.has(episode.id) ? 'bg-blue-50' : ''}`}
                      onDoubleClick={() => handleEdit(episode)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(episode.id)}
                          onChange={() => handleSelectRow(episode.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                            {patient?.院友相片 ? (
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
                            <div className="text-sm font-medium text-gray-900">
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
                            <div className="text-sm text-gray-500">{patient?.床號}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const dynamicStatus = calculateDynamicStatus(episode);
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${dynamicStatus.color}`}>
                              {dynamicStatus.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                            <span>{new Date(getAbsenceStartDate(episode)).toLocaleDateString('zh-TW')}</span>
                          </div>
                          {(() => {
                            const endDate = getAbsenceEndDate(episode);
                            if (endDate) {
                              return (
                                <div className="text-xs text-gray-500 mt-1">
                                  至 {new Date(endDate).toLocaleDateString('zh-TW')}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            const absenceStartDate = getAbsenceStartDate(episode);
                            const absenceEndDate = getAbsenceEndDate(episode);

                            if (absenceEndDate) {
                              // 已完成：使用實際缺席開始和結束日期計算
                              const startDate = new Date(absenceStartDate);
                              const endDate = new Date(absenceEndDate);
                              const diffTime = endDate.getTime() - startDate.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                              return `${diffDays} 天`;
                            } else if (episode.status === 'active') {
                              // 進行中：計算從實際缺席開始日期到今天的天數
                              const startDate = new Date(absenceStartDate);
                              const today = new Date();
                              const diffTime = today.getTime() - startDate.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return `${diffDays} 天`;
                            } else {
                              return '計算中';
                            }
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {(() => {
                            const hospitals = new Set<string>();
                            
                            // 添加主要醫院
                            if (episode.primary_hospital) {
                              hospitals.add(episode.primary_hospital);
                            }
                            
                            // 添加所有事件中的醫院
                            if (episode.episode_events && Array.isArray(episode.episode_events)) {
                              episode.episode_events.forEach((event: any) => {
                                if (event.hospital_name) {
                                  hospitals.add(event.hospital_name);
                                }
                              });
                            }
                            
                            const hospitalList = Array.from(hospitals);
                            
                            return hospitalList.length > 0 ? (
                              hospitalList.map((hospital, index) => (
                                <div key={index} className="text-xs">
                                  {hospital}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-500">-</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {(() => {
                            const wardBeds = new Set<string>();
                            
                            // 添加主要病房/床號
                            if (episode.primary_ward || episode.primary_bed_number) {
                              const wardBed = [episode.primary_ward, episode.primary_bed_number].filter(Boolean).join(' / ');
                              if (wardBed) {
                                wardBeds.add(wardBed);
                              }
                            }
                            
                            // 添加所有事件中的病房/床號
                            if (episode.episode_events && Array.isArray(episode.episode_events)) {
                              episode.episode_events.forEach((event: any) => {
                                if (event.hospital_ward || event.hospital_bed_number) {
                                  const wardBed = [event.hospital_ward, event.hospital_bed_number].filter(Boolean).join(' / ');
                                  if (wardBed) {
                                    wardBeds.add(wardBed);
                                  }
                                }
                              });
                            }
                            
                            const wardBedList = Array.from(wardBeds);
                            
                            return wardBedList.length > 0 ? (
                              wardBedList.map((wardBed, index) => (
                                <div key={index} className="text-xs">
                                  {wardBed}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-500">-</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {(() => {
                            const arrangement = getArrangementDisplay(episode);
                            return (
                              <>
                                <div>{arrangement.primary}</div>
                                {arrangement.secondary && (
                                  <div className="text-xs text-gray-600">
                                    {arrangement.secondary}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-md">
                        <div className="truncate" title={episode.remarks || ''}>
                          {episode.remarks || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(episode)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(episode.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(episode.id)}
                            className="text-red-600 hover:text-red-900"
                            title="刪除"
                            disabled={deletingIds.has(episode.id)}
                          >
                            {deletingIds.has(episode.id) ? (
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
            <Hospital className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的缺席事件' : '暫無缺席事件'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始記錄院友的缺席事件'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增缺席事件
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
        <HospitalEpisodeModal
          episode={selectedEpisode}
          onClose={() => {
            setShowModal(false);
            setSelectedEpisode(null);
          }}
        />
      )}
    </div>
  );
};

export default AdmissionRecords;