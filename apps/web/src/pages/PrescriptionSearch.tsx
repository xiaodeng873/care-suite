import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  Pill,
  ChevronUp,
  ChevronDown,
  User,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Beaker,
  Stethoscope,
  FlaskConical,
  AlertTriangle as AlertIcon
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { usePatientData, useFilteredPatients } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import PrescriptionDetailModal from '../components/PrescriptionDetailModal';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import {
  fuzzyMatch,
  matchChineseName,
  matchEnglishName,
  matchBedNumber,
  compareBedNumbers
} from '../utils/searchUtils';
import { formatDisplayDate } from '../utils/dateFormat';
import type { MedicationPrescription } from '../lib/database';
import DateInput from '../components/DateInput';

type SortField =
  | 'patient'
  | 'status'
  | 'prescription_date'
  | 'duration_type'
  | 'start_date'
  | 'end_date'
  | 'medication_name'
  | 'dosage_form'
  | 'administration_route'
  | 'unit'
  | 'inspection';

type SortDirection = 'asc' | 'desc';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  在住狀態: string;
  status: string;
  duration_type: string;
  prescription_date_start: string;
  prescription_date_end: string;
  start_date_start: string;
  start_date_end: string;
  end_date_type: string;
  end_date_start: string;
  end_date_end: string;
  medication_name: string;
  dosage_form: string;
  administration_route: string;
  dosage_unit: string;
  has_inspection: string;
}

interface PrescriptionWithPatient {
  prescription: MedicationPrescription;
  patient: ReturnType<typeof useFilteredPatients>[number] | undefined;
}

const statusOrder = { active: 0, pending_change: 1, inactive: 2 };
const durationOrder = { long: 0, short: 1 };

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'pending_change': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return '在服';
    case 'pending_change': return '待變更';
    case 'inactive': return '停服';
    default: return status;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <CheckCircle className="h-3.5 w-3.5 mr-1" />;
    case 'pending_change': return <AlertTriangle className="h-3.5 w-3.5 mr-1" />;
    case 'inactive': return <Ban className="h-3.5 w-3.5 mr-1" />;
    default: return null;
  }
};

const PrescriptionSearch: React.FC = () => {
  const { prescriptions, loading } = usePatientData();
  const patients = useFilteredPatients();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDebounce(searchTerm, 200);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('medication_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedPrescription, setSelectedPrescription] = useState<MedicationPrescription | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    在住狀態: '在住',
    status: '',
    duration_type: '',
    prescription_date_start: '',
    prescription_date_end: '',
    start_date_start: '',
    start_date_end: '',
    end_date_type: '',
    end_date_start: '',
    end_date_end: '',
    medication_name: '',
    dosage_form: '',
    administration_route: '',
    dosage_unit: '',
    has_inspection: ''
  });

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advancedFilters, sortField, sortDirection]);

  if (loading) {
    return <LoadingScreen pageName="處方搜尋" />;
  }

  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '',
      中文姓名: '',
      在住狀態: '在住',
      status: '',
      duration_type: '',
      prescription_date_start: '',
      prescription_date_end: '',
      start_date_start: '',
      start_date_end: '',
      end_date_type: '',
      end_date_start: '',
      end_date_end: '',
      medication_name: '',
      dosage_form: '',
      administration_route: '',
      dosage_unit: '',
      has_inspection: ''
    });
  };

  const hasAdvancedFilters = () => {
    return Object.values(advancedFilters).some(value => value !== '');
  };

  const allRows: PrescriptionWithPatient[] = useMemo(() => {
    return (prescriptions || []).map(prescription => ({
      prescription,
      patient: patients.find(p => p.院友id === prescription.patient_id)
    }));
  }, [prescriptions, patients]);

  const isDateInRange = (dateStr: string | undefined, start: string, end: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    if (start && date < new Date(start)) return false;
    if (end && date > new Date(end)) return false;
    return true;
  };

  const filteredRows = useMemo(() => {
    return allRows.filter(({ prescription, patient }) => {
      // 進階篩選：院友
      if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) {
        return false;
      }
      if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) {
        return false;
      }
      if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) {
        return false;
      }

      // 進階篩選：處方狀態
      if (advancedFilters.status && prescription.status !== advancedFilters.status) {
        return false;
      }

      // 進階篩選：長期/短期
      if (advancedFilters.duration_type) {
        const isShort = !!prescription.end_date;
        if (advancedFilters.duration_type === 'long' && isShort) return false;
        if (advancedFilters.duration_type === 'short' && !isShort) return false;
      }

      // 進階篩選：日期區間
      if (advancedFilters.prescription_date_start || advancedFilters.prescription_date_end) {
        if (!isDateInRange(prescription.prescription_date, advancedFilters.prescription_date_start, advancedFilters.prescription_date_end)) {
          return false;
        }
      }
      if (advancedFilters.start_date_start || advancedFilters.start_date_end) {
        if (!isDateInRange(prescription.start_date, advancedFilters.start_date_start, advancedFilters.start_date_end)) {
          return false;
        }
      }
      if (advancedFilters.end_date_type) {
        const hasEndDate = !!prescription.end_date;
        if (advancedFilters.end_date_type === 'has' && !hasEndDate) return false;
        if (advancedFilters.end_date_type === 'none' && hasEndDate) return false;
      }
      if (advancedFilters.end_date_start || advancedFilters.end_date_end) {
        if (!isDateInRange(prescription.end_date, advancedFilters.end_date_start, advancedFilters.end_date_end)) {
          return false;
        }
      }

      // 進階篩選：處方欄位
      if (advancedFilters.medication_name && !fuzzyMatch(prescription.medication_name, advancedFilters.medication_name)) {
        return false;
      }
      if (advancedFilters.dosage_form && !fuzzyMatch(prescription.dosage_form, advancedFilters.dosage_form)) {
        return false;
      }
      if (advancedFilters.administration_route && !fuzzyMatch(prescription.administration_route, advancedFilters.administration_route)) {
        return false;
      }
      if (advancedFilters.dosage_unit && !fuzzyMatch(prescription.dosage_unit, advancedFilters.dosage_unit)) {
        return false;
      }
      if (advancedFilters.has_inspection) {
        const hasInspection = Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.length > 0;
        if (advancedFilters.has_inspection === 'yes' && !hasInspection) return false;
        if (advancedFilters.has_inspection === 'no' && hasInspection) return false;
      }

      // 搜索框：跨院友與處方欄位
      if (deferredSearch) {
        const search = deferredSearch;
        const matchesPatient =
          matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, search) ||
          matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, search) ||
          fuzzyMatch(patient?.身份證號碼, search) ||
          matchBedNumber(patient?.床號, search);

        const matchesPrescription =
          fuzzyMatch(prescription.medication_name, search) ||
          fuzzyMatch(prescription.dosage_form, search) ||
          fuzzyMatch(prescription.administration_route, search) ||
          fuzzyMatch(prescription.dosage_unit, search) ||
          fuzzyMatch(prescription.medication_source, search) ||
          fuzzyMatch(prescription.notes, search) ||
          fuzzyMatch(prescription.status, search) ||
          (Array.isArray(prescription.medication_time_slots) && prescription.medication_time_slots.some(t => fuzzyMatch(t, search))) ||
          (Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.some(r =>
            fuzzyMatch(r.vital_sign_type, search)
          ));

        if (!matchesPatient && !matchesPrescription) return false;
      }

      return true;
    });
  }, [allRows, advancedFilters, deferredSearch]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const { prescription: pa, patient: pta } = a;
      const { prescription: pb, patient: ptb } = b;
      let valueA: string | number = '';
      let valueB: string | number = '';

      switch (sortField) {
        case 'patient': {
          const cmp = compareBedNumbers(pta?.床號 || '', ptb?.床號 || '');
          return sortDirection === 'asc' ? cmp : -cmp;
        }
        case 'status': {
          valueA = statusOrder[pa.status as keyof typeof statusOrder] ?? 99;
          valueB = statusOrder[pb.status as keyof typeof statusOrder] ?? 99;
          break;
        }
        case 'prescription_date': {
          valueA = pa.prescription_date ? new Date(pa.prescription_date).getTime() : 0;
          valueB = pb.prescription_date ? new Date(pb.prescription_date).getTime() : 0;
          break;
        }
        case 'duration_type': {
          valueA = pa.end_date ? durationOrder.short : durationOrder.long;
          valueB = pb.end_date ? durationOrder.short : durationOrder.long;
          break;
        }
        case 'start_date': {
          valueA = pa.start_date ? new Date(pa.start_date).getTime() : 0;
          valueB = pb.start_date ? new Date(pb.start_date).getTime() : 0;
          break;
        }
        case 'end_date': {
          valueA = pa.end_date ? new Date(pa.end_date).getTime() : Number.MAX_SAFE_INTEGER;
          valueB = pb.end_date ? new Date(pb.end_date).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        }
        case 'medication_name': {
          valueA = pa.medication_name || '';
          valueB = pb.medication_name || '';
          break;
        }
        case 'dosage_form': {
          valueA = pa.dosage_form || '';
          valueB = pb.dosage_form || '';
          break;
        }
        case 'administration_route': {
          valueA = pa.administration_route || '';
          valueB = pb.administration_route || '';
          break;
        }
        case 'unit': {
          valueA = pa.dosage_unit || '';
          valueB = pb.dosage_unit || '';
          break;
        }
        case 'inspection': {
          valueA = (Array.isArray(pa.inspection_rules) ? pa.inspection_rules.length : 0).toString();
          valueB = (Array.isArray(pb.inspection_rules) ? pb.inspection_rules.length : 0).toString();
          break;
        }
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortDirection]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
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

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({ field, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
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
      {/* 頁面標題 */}
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Pill className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">處方搜尋</h1>
              <p className="text-sm text-gray-600">以處方為單位搜尋，雙擊列開啟詳情</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            共 <span className="font-medium text-gray-900">{totalItems}</span> 筆處方
          </div>
        </div>
      </div>

      {/* 搜索與篩選 */}
      <div className="sticky top-20 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、身份證、藥物名稱、劑型、途徑、單位..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary flex items-center gap-2 ${showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''} ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                  {hasAdvancedFilters() && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
                  )}
                </button>
                {(searchTerm || hasAdvancedFilters()) && (
                  <button
                    onClick={clearFilters}
                    className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      placeholder="搜索院友姓名..."
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
                  <div>
                    <label className="form-label">處方狀態</label>
                    <select
                      value={advancedFilters.status}
                      onChange={(e) => updateAdvancedFilter('status', e.target.value)}
                      className="form-input"
                    >
                      <option value="">全部狀態</option>
                      <option value="active">在服</option>
                      <option value="pending_change">待變更</option>
                      <option value="inactive">停服</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">長期 / 短期</label>
                    <select
                      value={advancedFilters.duration_type}
                      onChange={(e) => updateAdvancedFilter('duration_type', e.target.value)}
                      className="form-input"
                    >
                      <option value="">全部</option>
                      <option value="long">長期</option>
                      <option value="short">短期</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">藥物名稱</label>
                    <input
                      type="text"
                      value={advancedFilters.medication_name}
                      onChange={(e) => updateAdvancedFilter('medication_name', e.target.value)}
                      className="form-input"
                      placeholder="搜索藥物名稱..."
                    />
                  </div>
                  <div>
                    <label className="form-label">劑型</label>
                    <input
                      type="text"
                      value={advancedFilters.dosage_form}
                      onChange={(e) => updateAdvancedFilter('dosage_form', e.target.value)}
                      className="form-input"
                      placeholder="搜索劑型..."
                    />
                  </div>
                  <div>
                    <label className="form-label">服用途徑</label>
                    <input
                      type="text"
                      value={advancedFilters.administration_route}
                      onChange={(e) => updateAdvancedFilter('administration_route', e.target.value)}
                      className="form-input"
                      placeholder="搜索途徑..."
                    />
                  </div>
                  <div>
                    <label className="form-label">單位</label>
                    <input
                      type="text"
                      value={advancedFilters.dosage_unit}
                      onChange={(e) => updateAdvancedFilter('dosage_unit', e.target.value)}
                      className="form-input"
                      placeholder="搜索單位..."
                    />
                  </div>
                  <div>
                    <label className="form-label">檢測項</label>
                    <select
                      value={advancedFilters.has_inspection}
                      onChange={(e) => updateAdvancedFilter('has_inspection', e.target.value)}
                      className="form-input"
                    >
                      <option value="">全部</option>
                      <option value="yes">有設定</option>
                      <option value="no">無設定</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="form-label">處方日期區間</label>
                    <div className="flex items-center gap-2">
                      <DateInput value={advancedFilters.prescription_date_start}
                        onChange={(value) => updateAdvancedFilter('prescription_date_start', value)}
                        className="form-input flex-1"
                      />
                      <span className="text-gray-500">至</span>
                      <DateInput value={advancedFilters.prescription_date_end}
                        onChange={(value) => updateAdvancedFilter('prescription_date_end', value)}
                        className="form-input flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">開始日期區間</label>
                    <div className="flex items-center gap-2">
                      <DateInput value={advancedFilters.start_date_start}
                        onChange={(value) => updateAdvancedFilter('start_date_start', value)}
                        className="form-input flex-1"
                      />
                      <span className="text-gray-500">至</span>
                      <DateInput value={advancedFilters.start_date_end}
                        onChange={(value) => updateAdvancedFilter('start_date_end', value)}
                        className="form-input flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">結束日期</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={advancedFilters.end_date_type}
                        onChange={(e) => updateAdvancedFilter('end_date_type', e.target.value)}
                        className="form-input"
                      >
                        <option value="">全部</option>
                        <option value="has">有結束日期</option>
                        <option value="none">無結束日期</option>
                      </select>
                      <DateInput value={advancedFilters.end_date_start}
                        onChange={(value) => updateAdvancedFilter('end_date_start', value)}
                        className="form-input flex-1"
                        disabled={advancedFilters.end_date_type === 'none'}
                        title={advancedFilters.end_date_type === 'none' ? '選擇「無結束日期」時不適用' : ''}
                      />
                      <span className="text-gray-500">至</span>
                      <DateInput value={advancedFilters.end_date_end}
                        onChange={(value) => updateAdvancedFilter('end_date_end', value)}
                        className="form-input flex-1"
                        disabled={advancedFilters.end_date_type === 'none'}
                        title={advancedFilters.end_date_type === 'none' ? '選擇「無結束日期」時不適用' : ''}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>
                顯示 {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalItems)} / {totalItems} 筆
              </span>
              {(searchTerm || hasAdvancedFilters()) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 處方列表 */}
      <div className="card overflow-hidden">
        {paginatedRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="patient" className="w-44">院友</SortableHeader>
                  <SortableHeader field="status" className="w-28">處方狀態</SortableHeader>
                  <SortableHeader field="prescription_date" className="w-32">處方日期</SortableHeader>
                  <SortableHeader field="duration_type" className="w-24">長期/短期</SortableHeader>
                  <SortableHeader field="start_date" className="w-32">開始日期</SortableHeader>
                  <SortableHeader field="end_date" className="w-32">結束日期</SortableHeader>
                  <SortableHeader field="medication_name" className="w-48">藥物名稱</SortableHeader>
                  <SortableHeader field="dosage_form" className="w-28">劑型</SortableHeader>
                  <SortableHeader field="administration_route" className="w-28">服用途徑</SortableHeader>
                  <SortableHeader field="unit" className="w-24">單位</SortableHeader>
                  <SortableHeader field="inspection" className="w-24">檢測項</SortableHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRows.map(({ prescription, patient }) => (
                  <tr
                    key={prescription.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onDoubleClick={() => setSelectedPrescription(prescription)}
                    title="雙擊開啟處方詳情"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
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
                            ) : (
                              <span className="text-gray-500">未知院友</span>
                            )}
                          </div>
                          {patient && <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-500" />}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(prescription.status || 'active')}`}>
                        {getStatusIcon(prescription.status || 'active')}
                        {getStatusLabel(prescription.status || 'active')}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDisplayDate(prescription.prescription_date)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prescription.end_date ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">短期</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">長期</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDisplayDate(prescription.start_date)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prescription.end_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDisplayDate(prescription.end_date)}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="flex items-start gap-2">
                        <Pill className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium break-words">{prescription.medication_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Beaker className="h-4 w-4 text-gray-400" />
                        {prescription.dosage_form || <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Stethoscope className="h-4 w-4 text-gray-400" />
                        {prescription.administration_route || <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prescription.dosage_unit || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.length > 0 ? (
                        <div className="flex items-center gap-1 text-orange-700">
                          <AlertIcon className="h-4 w-4" />
                          <span className="font-medium">{prescription.inspection_rules.length} 項</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <Pill className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">找不到符合條件的處方</h3>
            <p className="text-gray-600 mb-4">試試調整搜尋詞或清除篩選條件</p>
            <button onClick={clearFilters} className="btn-secondary">
              清除篩選
            </button>
          </div>
        )}
      </div>

      {/* 分頁 */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>每頁</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="form-input py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>筆</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary px-2 py-1 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {generatePageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {typeof page === 'string' ? (
                    <span className="px-2 text-gray-500">{page}</span>
                  ) : (
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary px-2 py-1 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {selectedPrescription && (
        <PrescriptionDetailModal
          prescription={selectedPrescription}
          patient={patients.find(p => p.院友id === selectedPrescription.patient_id)}
          onClose={() => setSelectedPrescription(null)}
        />
      )}
    </div>
  );
};

export default PrescriptionSearch;
