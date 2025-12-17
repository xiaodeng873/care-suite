import React, { useState, useMemo } from 'react';
import { Building2, Plus, CreditCard as Edit3, Trash2, Search, Filter, Download, User, Calendar, Clock, Pill, ChevronUp, ChevronDown, X, AlertTriangle, CheckCircle, Copy, MessageCircle, Stethoscope, Settings } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import HospitalOutreachModal from '../components/HospitalOutreachModal';
import DoctorVisitScheduleModal from '../components/DoctorVisitScheduleModal';
import PatientTooltip from '../components/PatientTooltip';
import { getFormattedEnglishName } from '../utils/nameFormatter';

type SortField = '藥袋日期' | '院友姓名' | '藥完日期' | '覆診日期' | '取藥安排' | '創建時間';
type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  取藥安排: string;
  外展藥物來源: string;
  備註: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const HospitalOutreach: React.FC = () => {
  const { 
    hospitalOutreachRecords, 
    patients, 
    deleteHospitalOutreachRecord, 
    doctorVisitSchedule,
    deleteDoctorVisitSchedule,
    fetchHospitalOutreachRecords,
    fetchDoctorVisitSchedule,
    loading 
  } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [showDoctorVisitModal, setShowDoctorVisitModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedDoctorVisit, setSelectedDoctorVisit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('藥袋日期');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    取藥安排: '',
    外展藥物來源: '',
    備註: '',
    startDate: '',
    endDate: '',
    在住狀態: '全部'
  });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deletingDoctorVisitIds, setDeletingDoctorVisitIds] = useState<Set<string>>(new Set());

  // 獲取記錄的最近藥完日期（用於排序）
  const getLatestMedicationEndDate = (record: any): number => {
    const dates = [];
    
    // 添加主要藥完日期
    if (record.medication_end_date) {
      dates.push(new Date(record.medication_end_date).getTime());
    }
    
    // 添加所有藥物來源的藥完日期
    if (record.medication_sources && Array.isArray(record.medication_sources)) {
      record.medication_sources.forEach((source: any) => {
        if (source.medication_end_date) {
          dates.push(new Date(source.medication_end_date).getTime());
        } else if (source.medication_bag_date && source.prescription_weeks) {
          // 計算藥完日期
          const bagDate = new Date(source.medication_bag_date);
          const endDate = new Date(bagDate);
          endDate.setDate(bagDate.getDate() + (source.prescription_weeks * 7) - 1);
          dates.push(endDate.getTime());
        }
      });
    }
    
    // 返回最近的日期（最大值）
    return dates.length > 0 ? Math.max(...dates) : 0;
  };

  // 獲取記錄的所有藥物來源（按藥完日期排序）
  const getAllMedicationSources = (record: any) => {
    const sources = [];

    // 如果有新的 medication_sources 陣列，使用它
    if (record.medication_sources && Array.isArray(record.medication_sources)) {
      record.medication_sources.forEach((source: any) => {
        sources.push({
          medication_bag_date: source.medication_bag_date,
          prescription_weeks: source.prescription_weeks,
          medication_end_date: source.medication_end_date || (() => {
            if (source.medication_bag_date && source.prescription_weeks) {
              const bagDate = new Date(source.medication_bag_date);
              const endDate = new Date(bagDate);
              endDate.setDate(bagDate.getDate() + (source.prescription_weeks * 7) - 1);
              return endDate.toISOString().split('T')[0];
            }
            return null;
          })(),
          outreach_medication_source: source.outreach_medication_source
        });
      });
    } else {
      // 如果沒有新的 medication_sources 陣列，使用主要藥物來源
      sources.push({
        medication_bag_date: record.medication_bag_date,
        prescription_weeks: record.prescription_weeks,
        medication_end_date: record.medication_end_date,
        outreach_medication_source: record.outreach_medication_source
      });
    }

    // 按藥完日期排序（由近到遠，即最新的日期在前）
    return sources
      .filter(source => source.medication_end_date)
      .sort((a, b) => new Date(a.medication_end_date).getTime() - new Date(b.medication_end_date).getTime());
  };

  // 計算院友狀態（根據外展記錄的事件）
  const calculatePatientStatus = (record: any): string => {
    if (!record.events || !Array.isArray(record.events) || record.events.length === 0) {
      return '在住';
    }

    // 按事件日期和時間排序，獲取最新事件
    const sortedEvents = [...record.events].sort((a, b) => {
      const dateA = new Date(`${a.event_date} ${a.event_time || '00:00'}`).getTime();
      const dateB = new Date(`${b.event_date} ${b.event_time || '00:00'}`).getTime();
      return dateB - dateA;
    });

    const latestEvent = sortedEvents[0];

    // 檢查是否有未結束的渡假
    const hasVacationStart = record.events.some((e: any) => e.event_type === 'vacation_start');
    const hasVacationEnd = record.events.some((e: any) => e.event_type === 'vacation_end');
    if (hasVacationStart && !hasVacationEnd) {
      return '渡假中';
    }

    // 檢查是否有未結束的住院（入院或轉院，但沒有出院）
    const hasAdmissionOrTransfer = record.events.some((e: any) =>
      e.event_type === 'admission' || e.event_type === 'transfer'
    );
    const hasDischarge = record.events.some((e: any) => e.event_type === 'discharge');
    if (hasAdmissionOrTransfer && !hasDischarge) {
      return '住院中';
    }

    // 如果有出院事件，檢查出院類型
    if (latestEvent.event_type === 'discharge') {
      return '在住';
    }

    return '在住';
  };

  // 獲取狀態顯示樣式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case '住院中':
        return 'bg-red-100 text-red-800 border-red-200';
      case '渡假中':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case '在住':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Reset to first page when filters change (except date filters to avoid disrupting date input)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    advancedFilters.床號,
    advancedFilters.中文姓名,
    advancedFilters.取藥安排,
    advancedFilters.外展藥物來源,
    advancedFilters.備註,
    advancedFilters.在住狀態,
    sortField,
    sortDirection
  ]);

  // 確保在組件掛載時載入醫生到診排程和醫院外展記錄
  React.useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchHospitalOutreachRecords(),
          fetchDoctorVisitSchedule()
        ]);
      } catch (error) {
        console.error('載入初始資料失敗:', { error, component: 'HospitalOutreach' });
      }
    };

    loadInitialData();
  }, [fetchHospitalOutreachRecords, fetchDoctorVisitSchedule]);

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

  const filteredRecords = useMemo(() => {
    return (hospitalOutreachRecords || []).filter(record => {
      const patient = patients.find(p => p.院友id === record.patient_id);

      // 確保院友存在
      if (!patient) {
        return false;
      }

      // 先應用進階篩選 - 使用動態計算的狀態
      const recordStatus = calculatePatientStatus(record);
      if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && recordStatus !== advancedFilters.在住狀態) {
        return false;
      }
      if (advancedFilters.床號 && !patient?.床號.toLowerCase().includes(advancedFilters.床號.toLowerCase())) {
        return false;
      }
      if (advancedFilters.中文姓名 && !patient?.中文姓名.toLowerCase().includes(advancedFilters.中文姓名.toLowerCase())) {
        return false;
      }
      if (advancedFilters.取藥安排 && record.medication_pickup_arrangement !== advancedFilters.取藥安排) {
        return false;
      }
      if (advancedFilters.外展藥物來源 && record.outreach_medication_source !== advancedFilters.外展藥物來源) {
        return false;
      }
      if (advancedFilters.備註 && !record.remarks?.toLowerCase().includes(advancedFilters.備註.toLowerCase())) {
        return false;
      }

      // 日期區間篩選 - 只在日期格式有效時才進行比較
      if (advancedFilters.startDate || advancedFilters.endDate) {
        const bagDate = new Date(record.medication_bag_date);

        // 驗證開始日期並比較
        if (advancedFilters.startDate) {
          const startDate = new Date(advancedFilters.startDate);
          if (!isNaN(startDate.getTime()) && bagDate < startDate) {
            return false;
          }
        }

        // 驗證結束日期並比較
        if (advancedFilters.endDate) {
          const endDate = new Date(advancedFilters.endDate);
          if (!isNaN(endDate.getTime()) && bagDate > endDate) {
            return false;
          }
        }
      }

      // 然後應用搜索條件
      let matchesSearch = true;
      if (searchTerm) {
        matchesSearch = patient?.中文姓氏.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       patient?.中文名字.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       patient?.床號.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       record.remarks?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       new Date(record.medication_bag_date).toLocaleDateString('zh-TW').includes(searchTerm.toLowerCase()) ||
                       false;
      }

      return matchesSearch;
    });
  }, [hospitalOutreachRecords, patients, advancedFilters, searchTerm]);

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
      取藥安排: '',
      外展藥物來源: '',
      備註: '',
      startDate: '',
      endDate: '',
      在住狀態: '全部'
    });
  };

  const getUniqueOptions = (field: string) => {
    const values = new Set<string>();
    (hospitalOutreachRecords || []).forEach(record => {
      let value = '';
      
      switch (field) {
        case '取藥安排':
          value = record.medication_pickup_arrangement || '';
          break;
        case '外展藥物來源':
          value = record.outreach_medication_source || '';
          break;
        default:
          return;
      }
      
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const patientA = patients.find(p => p.院友id === a.patient_id);
    const patientB = patients.find(p => p.院友id === b.patient_id);
    
    let valueA: string | number = '';
    let valueB: string | number = '';
    
    switch (sortField) {
      case '藥袋日期':
        // 使用最早的藥完日期進行排序（最近到期的排在前面）
        const sourcesA = getAllMedicationSources(a);
        const sourcesB = getAllMedicationSources(b);
        valueA = sourcesA.length > 0 ? new Date(sourcesA[0].medication_end_date).getTime() : 0;
        valueB = sourcesB.length > 0 ? new Date(sourcesB[0].medication_end_date).getTime() : 0;
        break;
      case '院友姓名':
        valueA = `${patientA?.中文姓氏 || ''}${patientA?.中文名字 || ''}`;
        valueB = `${patientB?.中文姓氏 || ''}${patientB?.中文名字 || ''}`;
        break;
      case '藥完日期':
        // 使用最早的藥完日期進行排序（最近到期的排在前面）
        const endSourcesA = getAllMedicationSources(a);
        const endSourcesB = getAllMedicationSources(b);
        valueA = endSourcesA.length > 0 ? new Date(endSourcesA[0].medication_end_date).getTime() : 0;
        valueB = endSourcesB.length > 0 ? new Date(endSourcesB[0].medication_end_date).getTime() : 0;
        break;
      case '覆診日期':
        valueA = a.outreach_appointment_date ? new Date(a.outreach_appointment_date).getTime() : 0;
        valueB = b.outreach_appointment_date ? new Date(b.outreach_appointment_date).getTime() : 0;
        break;
      case '取藥安排':
        valueA = a.medication_pickup_arrangement || '';
        valueB = b.medication_pickup_arrangement || '';
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
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const record = hospitalOutreachRecords.find(r => r.id === id);
    const patient = patients.find(p => p.院友id === record?.patient_id);
    
    if (confirm(`確定要刪除 ${patient?.中文姓名} 的醫院外展記錄嗎？`)) {
      try {
        setDeletingIds(prev => new Set(prev).add(id));
        await deleteHospitalOutreachRecord(id);
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

    const confirmMessage = `確定要刪除 ${selectedRows.size} 筆醫院外展記錄嗎？\n\n此操作無法復原。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    const deletingArray = Array.from(selectedRows);
    setDeletingIds(new Set(deletingArray));
    
    try {
      for (const recordId of deletingArray) {
        await deleteHospitalOutreachRecord(recordId);
      }
      setSelectedRows(new Set());
      alert(`成功刪除 ${deletingArray.length} 筆醫院外展記錄`);
    } catch (error) {
      console.error('批量刪除醫院外展記錄失敗:', error);
      alert('批量刪除醫院外展記錄失敗，請重試');
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
    if (selectedRows.size === paginatedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRecords.map(r => r.id)));
    }
  };

  const handleInvertSelection = () => {
    const newSelected = new Set<string>();
    paginatedRecords.forEach(record => {
      if (!selectedRows.has(record.id)) {
        newSelected.add(record.id);
      }
    });
    setSelectedRows(newSelected);
  };

  const handleExportSelected = () => {
    const selectedRecords = paginatedRecords.filter(r => selectedRows.has(r.id));
    
    if (selectedRecords.length === 0) {
      alert('請先選擇要匯出的記錄');
      return;
    }

    const exportData = selectedRecords.map(record => {
      const patient = patients.find(p => p.院友id === record.patient_id);
      return {
        床號: patient?.床號 || '',
        中文姓名: patient ? `${patient.中文姓氏}${patient.中文名字}` : '',
        藥袋日期: new Date(record.medication_bag_date).toLocaleDateString('zh-TW'),
        處方週數: record.prescription_weeks,
        藥完日期: new Date(record.medication_end_date).toLocaleDateString('zh-TW'),
        覆診日期: record.outreach_appointment_date ? new Date(record.outreach_appointment_date).toLocaleDateString('zh-TW') : '未安排',
        取藥安排: getPickupArrangementLabel(record.medication_pickup_arrangement),
        外展藥物來源: getMedicationSourceLabel(record.outreach_medication_source),
        備註: record.remarks || '',
        創建時間: new Date(record.created_at).toLocaleString('zh-TW')
      };
    });

    const headers = ['床號', '中文姓名', '藥袋日期', '處方週數', '藥完日期', '覆診日期', '取藥安排', '外展藥物來源', '備註', '創建時間'];
    const csvContent = [
      `"醫院外展記錄"`,
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
    a.download = `醫院外展記錄_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteDoctorVisit = async (id: string) => {
    const schedule = doctorVisitSchedule.find(s => s.id === id);
    
    if (confirm(`確定要刪除 ${new Date(schedule?.visit_date).toLocaleDateString('zh-TW')} 的醫生到診排程嗎？`)) {
      try {
        setDeletingDoctorVisitIds(prev => new Set(prev).add(id));
        await deleteDoctorVisitSchedule(id);
      } catch (error) {
        alert('刪除醫生到診排程失敗，請重試');
      } finally {
        setDeletingDoctorVisitIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  };

  const getPickupArrangementLabel = (arrangement: string) => {
    switch (arrangement) {
      case '家人自取': return '家人自取';
      case '院舍代勞': return '院舍代勞';
      case '每次詢問': return '每次詢問';
      default: return arrangement;
    }
  };

  const getMedicationSourceLabel = (source: string) => {
    switch (source) {
      case 'KWH/CGAS': return 'KWH/CGAS';
      case 'KCH/PGT': return 'KCH/PGT';
      case '出院病房配發': return '出院病房配發';
      default: return source || '-';
    }
  };

  const getPickupArrangementColor = (arrangement: string) => {
    switch (arrangement) {
      case '家人自取': return 'bg-blue-100 text-blue-800';
      case '院舍代勞': return 'bg-green-100 text-green-800';
      case '每次詢問': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateWhatsAppMessage = (record: any) => {
    const patient = patients.find(p => p.院友id === record.patient_id);
    if (!patient) return '';

    const medicationEndDate = new Date(record.medication_end_date).toLocaleDateString('zh-TW');
    const appointmentDate = record.outreach_appointment_date 
      ? new Date(record.outreach_appointment_date).toLocaleDateString('zh-TW')
      : '待安排';

    return `【醫院外展取藥安排通知】

院友：${patient.中文姓氏}${patient.中文名字} (${patient.床號})
藥完日期：${medicationEndDate}
覆診日期：${appointmentDate}

請確認取藥安排：
1. 家人前往醫院取藥
2. 院舍代為取藥

請回覆選擇的安排方式，謝謝！`;
  };

  const copyWhatsAppMessage = (record: any) => {
    const message = generateWhatsAppMessage(record);
    navigator.clipboard.writeText(message).then(() => {
      alert('WhatsApp 訊息已複製到剪貼板');
    }).catch(() => {
      alert('複製失敗，請手動複製');
    });
  };

  const isAppointmentOverdue = (record: any) => {
    if (!record.outreach_appointment_date) return false;
    const today = new Date();
    const appointmentDate = new Date(record.outreach_appointment_date);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const appointmentDateOnly = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    return appointmentDateOnly < todayDate;
  };

  const isMedicationEndingSoon = (record: any) => {
    const today = new Date();
    const endDate = new Date(record.medication_end_date);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0; // 7天內藥完
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
          <h1 className="text-2xl font-bold text-gray-900">醫院外展</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedDoctorVisit(null);
                setShowDoctorVisitModal(true);
              }}
              className="btn-secondary flex items-center space-x-2"
            >
              <Stethoscope className="h-4 w-4" />
              <span>管理醫生到診日期</span>
            </button>
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
                setSelectedRecord(null);
                setShowModal(true);
              }}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>新增外展記錄</span>
            </button>
          </div>
        </div>
      </div>

      {/* 醫生到診排程概覽 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Stethoscope className="h-5 w-5 mr-2 text-blue-600" />
            醫生到診排程
          </h2>
          <button
            onClick={() => {
              setSelectedDoctorVisit(null);
              setShowDoctorVisitModal(true);
            }}
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增到診日期</span>
          </button>
        </div>

        {doctorVisitSchedule && doctorVisitSchedule.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-10 gap-3">
            {doctorVisitSchedule
              .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
              .map(schedule => (
                <div key={schedule.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 min-h-[90px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-900">
                        {new Date(schedule.visit_date).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setSelectedDoctorVisit(schedule);
                          setShowDoctorVisitModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100"
                        title="編輯"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoctorVisit(schedule.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
                        title="刪除"
                        disabled={deletingDoctorVisitIds.has(schedule.id)}
                      >
                        {deletingDoctorVisitIds.has(schedule.id) ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="space-y-1">
                      {schedule.doctor_name && (
                        <div className="text-xs">醫生：{schedule.doctor_name}</div>
                      )}
                      {schedule.specialty && (
                        <div className="text-xs">專科：{schedule.specialty}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Stethoscope className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暫無醫生到診排程</p>
            <p className="text-xs">請新增醫生未來到診的日期</p>
          </div>
        )}
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
                  placeholder="搜索院友姓名、床號、藥袋日期或備註..."
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
                  <label className="form-label">藥袋日期區間</label>
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
                    <label className="form-label">取藥安排</label>
                    <select
                      value={advancedFilters.取藥安排}
                      onChange={(e) => updateAdvancedFilter('取藥安排', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有安排</option>
                      <option value="家人自取">家人自取</option>
                      <option value="院舍代勞">院舍代勞</option>
                      <option value="每次詢問">每次詢問</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">外展藥物來源</label>
                    <select
                      value={advancedFilters.外展藥物來源}
                      onChange={(e) => updateAdvancedFilter('外展藥物來源', e.target.value)}
                      className="form-input"
                    >
                      <option value="">所有來源</option>
                      <option value="KWH/CGAS">KWH/CGAS</option>
                      <option value="KCH/PGT">KCH/PGT</option>
                      <option value="出院病房配發">出院病房配發</option>
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
                    <label className="form-label">狀態</label>
                    <select
                      value={advancedFilters.在住狀態}
                      onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)}
                      className="form-input"
                    >
                      <option value="全部">全部</option>
                      <option value="在住">在住</option>
                      <option value="住院中">住院中</option>
                      <option value="渡假中">渡假中</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems} 筆外展記錄 (共 {(hospitalOutreachRecords || []).length} 筆)</span>
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

      {/* 外展記錄列表 */}
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
                  <SortableHeader field="院友姓名">院友</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <SortableHeader field="藥袋日期">藥袋日期</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    處方週數
                  </th>
                  <SortableHeader field="藥完日期">藥完日期</SortableHeader>
                  <SortableHeader field="覆診日期">覆診日期</SortableHeader>
                  <SortableHeader field="取藥安排">取藥安排</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    外展藥物來源
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
                {paginatedRecords.map(record => {
                  const patient = patients.find(p => p.院友id === record.patient_id);
                  const isOverdue = isAppointmentOverdue(record);
                  const isEndingSoon = isMedicationEndingSoon(record);
                  
                  return (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-gray-50 ${selectedRows.has(record.id) ? 'bg-blue-50' : ''} ${
                        isOverdue ? 'bg-red-50' : isEndingSoon ? 'bg-yellow-50' : ''
                      }`}
                      onDoubleClick={() => handleEdit(record)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(record.id)}
                          onChange={() => handleSelectRow(record.id)}
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const status = calculatePatientStatus(record);
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(status)}`}>
                              {status}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {getAllMedicationSources(record).map((source, index) => (
                            <div key={index} className="flex items-center text-xs">
                              <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{new Date(source.medication_bag_date).toLocaleDateString('zh-TW')}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {getAllMedicationSources(record).map((source, index) => (
                            <div key={index} className="flex items-center text-xs">
                              <Clock className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{source.prescription_weeks} 週</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {getAllMedicationSources(record).map((source, index) => {
                            const sourceEndingSoon = (() => {
                              const today = new Date();
                              const endDate = new Date(source.medication_end_date);
                              const diffTime = endDate.getTime() - today.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return diffDays <= 7 && diffDays >= 0;
                            })();
                            
                            return (
                              <div key={index} className={`flex items-center text-xs ${sourceEndingSoon ? 'text-orange-600 font-medium' : ''}`}>
                                <Pill className="h-3 w-3 mr-1 text-gray-400" />
                                <span>{new Date(source.medication_end_date).toLocaleDateString('zh-TW')}</span>
                                {sourceEndingSoon && (
                                  <AlertTriangle className="h-3 w-3 ml-1 text-orange-600" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.outreach_appointment_date ? (
                          <div className={`flex items-center ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                            <span>{new Date(record.outreach_appointment_date).toLocaleDateString('zh-TW')}</span>
                            {isOverdue && (
                              <AlertTriangle className="h-4 w-4 ml-1 text-red-600" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">未安排</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPickupArrangementColor(record.medication_pickup_arrangement)}`}>
                            {getPickupArrangementLabel(record.medication_pickup_arrangement)}
                          </span>
                          {record.medication_pickup_arrangement === '每次詢問' && (
                            <button
                              onClick={() => copyWhatsAppMessage(record)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                              title="複製 WhatsApp 訊息"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          {getAllMedicationSources(record).map((source, index) => (
                            <div key={index} className="text-xs">
                              {getMedicationSourceLabel(source.outreach_medication_source)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={record.remarks || ''}>
                          {record.remarks || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="text-blue-600 hover:text-blue-900"
                            title="編輯"
                            disabled={deletingIds.has(record.id)}
                          >
                            <Edit3 className="h-4 w-4" />
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
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || hasAdvancedFilters() ? '找不到符合條件的外展記錄' : '暫無醫院外展記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || hasAdvancedFilters() ? '請嘗試調整搜索條件' : '開始管理院友的醫院外展服務'}
            </p>
            {!searchTerm && !hasAdvancedFilters() ? (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                新增外展記錄
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
        <HospitalOutreachModal
          record={selectedRecord}
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
          }}
        />
      )}

      {showDoctorVisitModal && (
        <DoctorVisitScheduleModal
          schedule={selectedDoctorVisit}
          onClose={() => {
            setShowDoctorVisitModal(false);
            setSelectedDoctorVisit(null);
          }}
        />
      )}
    </div>
  );
};

export default HospitalOutreach;