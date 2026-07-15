import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Trash2,
  Eye,
  User,
  X,
  Copy,
  Printer,
  FileText,
} from 'lucide-react';
import { usePatients, type Wound, type WoundWithAssessments, type WoundAssessment } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import PatientTooltip from '../components/PatientTooltip';
import WoundModal from '../components/WoundModal';
import SingleWoundAssessmentModal from '../components/SingleWoundAssessmentModal';
import { fuzzyMatch, matchBedNumber, matchChineseName } from '../utils/searchUtils';
import { printWoundAssessment, saveWoundAssessmentHtml } from '../utils/woundAssessmentPrintGenerator';

// ── helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('zh-TW');

const daysSince = (dateStr: string): number =>
  Math.ceil((Date.now() - new Date(dateStr).getTime()) / 86_400_000);

// 計算評估頻率是否正常（每週至少一次）
const isAssessmentFrequencyNormal = (wound: WoundWithAssessments): boolean => {
  if (wound.assessments.length === 0) {
    return daysSince(wound.discovery_date) <= 7;
  }
  return daysSince(wound.assessments[0].assessment_date) <= 7;
};

// 從評估紀錄推導傷口有效狀態：以「最新」一筆評估為準
const getEffectiveWoundStatus = (wound: WoundWithAssessments): 'healed' | 'treating' | 'untreated' => {
  const latest = wound.assessments[0]; // 已按日期降序排列，第 0 筆最新
  if (!latest) return 'untreated';
  if (latest.wound_status === 'healed') return 'healed';
  if (latest.wound_status === 'untreated') return 'untreated';
  return 'treating'; // treating + improving 均顯示為治療中
};

// ── labels ───────────────────────────────────────────────────────────────────

const WOUND_TYPE_LABELS: Record<string, string> = {
  pressure_ulcer: '壓瘡',
  trauma: '創傷',
  surgical: '手術傷口',
  diabetic: '糖尿病傷口',
  venous: '靜脈性潰瘍',
  arterial: '動脈性潰瘍',
  other: '其他',
};

const WOUND_ORIGIN_LABELS: Record<string, string> = {
  facility: '本院發生',
  admission: '入住前發生',
  hospital_referral: '醫院發生',
};

const EFFECTIVE_STATUS_LABELS: Record<string, string> = {
  untreated: '未處理',
  treating:  '治療中',
  healed:    '已痊癒',
};

const EFFECTIVE_STATUS_COLORS: Record<string, string> = {
  untreated: 'bg-gray-100 text-gray-700',
  treating:  'bg-yellow-100 text-yellow-800',
  healed:    'bg-green-100 text-green-800',
};

const RESPONSIBLE_UNIT_LABELS: Record<string, string> = {
  community_health: '社康',
  cgat: 'CGAT',
  facility_staff: '本院職員',
  other: '其他',
};

const ASSESSMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  untreated: { label: '未處理', color: 'bg-gray-100 text-gray-800' },
  treating:  { label: '治療中', color: 'bg-yellow-100 text-yellow-800' },
  improving: { label: '改善中', color: 'bg-blue-100 text-blue-800' },
  healed:    { label: '已痊癒', color: 'bg-green-100 text-green-800' },
};

// ── types ─────────────────────────────────────────────────────────────────────

type SortField = 'patient_name' | 'discovery_date';
type SortDirection = 'asc' | 'desc';

interface WoundFilters {
  searchTerm: string;
  在住狀態: string;
  傷口狀態: string;
  傷口來源: string;
  換症單位: string;
  評估狀態: string;
  床號: string;
  中文姓名: string;
}

const DEFAULT_FILTERS: WoundFilters = {
  searchTerm: '',
  在住狀態: '在住',
  傷口狀態: '',
  傷口來源: '',
  換症單位: '',
  評估狀態: '',
  床號: '',
  中文姓名: '',
};

// ── component ─────────────────────────────────────────────────────────────────

const WoundManagementNew: React.FC = () => {
  const { patientsWithWounds, patients, stations, deleteWound, deleteWoundAssessment, updateWound, refreshWoundData, loading } = usePatients();

  // ── table state ──
  const [sortField, setSortField]           = useState<SortField>('discovery_date');
  const [sortDirection, setSortDirection]   = useState<SortDirection>('desc');
  const [selectedRows, setSelectedRows]     = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage]       = useState(1);
  const [pageSize, setPageSize]             = useState(50);
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  const [expandedWounds, setExpandedWounds]     = useState<Set<string>>(new Set());

  // ── filter state ──
  const [filters, setFilters]                   = useState<WoundFilters>(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const deferredFilters                         = useDeferredValue(filters);

  // ── modal state ──
  const [showWoundModal, setShowWoundModal]         = useState(false);
  const [selectedWound, setSelectedWound]           = useState<Wound | null>(null);
  const [selectedPatientId, setSelectedPatientId]   = useState<number | undefined>();
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentWound, setAssessmentWound]       = useState<Wound | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<WoundAssessment | null>(null);
  const [deletingIds, setDeletingIds]               = useState<Set<string>>(new Set());

  // reset page on filter/sort change
  React.useEffect(() => { setCurrentPage(1); }, [filters, sortField, sortDirection]);

  // ── data pipeline ─────────────────────────────────────────────────────────

  /** flat list of wounds after all filters */
  const filteredWounds = useMemo(() => {
    const result: WoundWithAssessments[] = [];
    for (const pd of patientsWithWounds) {
      const patient = patients.find(p => p.院友id === pd.patient_id);

      if (deferredFilters.在住狀態 && deferredFilters.在住狀態 !== '全部') {
        if (patient?.在住狀態 !== deferredFilters.在住狀態) continue;
      }
      if (deferredFilters.床號 && !matchBedNumber(pd.bed_number, deferredFilters.床號)) continue;
      if (deferredFilters.中文姓名 && !matchChineseName(
        patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, deferredFilters.中文姓名
      )) continue;

      for (const wound of pd.wounds) {
        if (deferredFilters.傷口狀態 && getEffectiveWoundStatus(wound) !== deferredFilters.傷口狀態) continue;
        if (deferredFilters.傷口來源 && wound.wound_origin !== deferredFilters.傷口來源) continue;
        if (deferredFilters.換症單位 && wound.responsible_unit !== deferredFilters.換症單位) continue;
        if (deferredFilters.評估狀態 === 'overdue' && !wound.is_overdue) continue;

        if (deferredFilters.searchTerm) {
          const s = deferredFilters.searchTerm;
          if (
            !fuzzyMatch(pd.patient_name, s) &&
            !matchBedNumber(pd.bed_number, s) &&
            !fuzzyMatch(wound.wound_code, s) &&
            !fuzzyMatch(wound.wound_name, s)
          ) continue;
        }
        result.push(wound);
      }
    }
    return result;
  }, [patientsWithWounds, patients, deferredFilters]);

  const sortedWounds = useMemo(() => {
    const pdMap = new Map(patientsWithWounds.map(pd => [pd.patient_id, pd]));
    return [...filteredWounds].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      if (sortField === 'patient_name') {
        valA = pdMap.get(a.patient_id)?.patient_name ?? '';
        valB = pdMap.get(b.patient_id)?.patient_name ?? '';
      } else {
        valA = new Date(a.discovery_date).getTime();
        valB = new Date(b.discovery_date).getTime();
      }
      if (typeof valA === 'string') valA = (valA as string).toLowerCase();
      if (typeof valB === 'string') valB = (valB as string).toLowerCase();
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredWounds, patientsWithWounds, sortField, sortDirection]);

  /** grouped by patient, preserving sortedWounds order */
  const groupedByPatient = useMemo(() => {
    const seen = new Set<number>();
    const groups: { patientId: number; wounds: WoundWithAssessments[] }[] = [];
    for (const w of sortedWounds) {
      if (!seen.has(w.patient_id)) {
        seen.add(w.patient_id);
        groups.push({ patientId: w.patient_id, wounds: [w] });
      } else {
        groups.find(g => g.patientId === w.patient_id)!.wounds.push(w);
      }
    }
    return groups;
  }, [sortedWounds]);

  const totalItems  = groupedByPatient.length;
  const totalPages  = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex  = (currentPage - 1) * pageSize;
  const endIndex    = startIndex + pageSize;

  const paginatedGroups = useMemo(
    () => groupedByPatient.slice(startIndex, endIndex),
    [groupedByPatient, startIndex, endIndex]
  );
  const paginatedWounds = useMemo(
    () => paginatedGroups.flatMap(g => g.wounds),
    [paginatedGroups]
  );

  // ── filter helpers ──

  const hasNonDefaultFilters = useMemo(() =>
    filters.在住狀態  !== DEFAULT_FILTERS.在住狀態  ||
    filters.傷口狀態  !== DEFAULT_FILTERS.傷口狀態  ||
    filters.傷口來源  !== DEFAULT_FILTERS.傷口來源  ||
    filters.換症單位  !== DEFAULT_FILTERS.換症單位  ||
    filters.評估狀態  !== DEFAULT_FILTERS.評估狀態  ||
    filters.床號      !== DEFAULT_FILTERS.床號      ||
    filters.中文姓名  !== DEFAULT_FILTERS.中文姓名,
    [filters]
  );

  const updateFilter = <K extends keyof WoundFilters>(key: K, value: WoundFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  // ── sort ──

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ── selection ──

  const handleSelectRow = (id: string) =>
    setSelectedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSelectAll = () =>
    setSelectedRows(selectedRows.size === paginatedWounds.length
      ? new Set()
      : new Set(paginatedWounds.map(w => w.id))
    );

  const handleInvertSelection = () =>
    setSelectedRows(new Set(paginatedWounds.filter(w => !selectedRows.has(w.id)).map(w => w.id)));

  // ── expand ──

  const togglePatient = (id: number) =>
    setExpandedPatients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleWound = (id: string) =>
    setExpandedWounds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── crud ──

  const handleAddWound = (patientId?: number) => {
    setSelectedWound(null);
    setSelectedPatientId(patientId);
    setShowWoundModal(true);
  };

  const handleEditWound = (wound: Wound) => {
    setSelectedWound(wound);
    setShowWoundModal(true);
  };

  const handleDeleteWound = async (wound: Wound) => {
    const patient = patients.find(p => p.院友id === wound.patient_id);
    if (!confirm(`確定要刪除 ${patient?.中文姓名} 的傷口 ${wound.wound_code} 嗎？\n這將同時刪除所有相關的評估記錄。`)) return;
    try {
      setDeletingIds(prev => new Set(prev).add(wound.id));
      await deleteWound(wound.id);
    } catch {
      alert('刪除傷口失敗');
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(wound.id); return n; });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`確定要刪除 ${selectedRows.size} 個傷口嗎？此操作無法復原。`)) return;
    const ids = Array.from(selectedRows);
    setDeletingIds(new Set(ids));
    try {
      for (const id of ids) await deleteWound(id);
      setSelectedRows(new Set());
    } catch {
      alert('批量刪除失敗，請重試');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const handleAddAssessment = (wound: Wound) => {
    setAssessmentWound(wound);
    setSelectedAssessment(null);
    setShowAssessmentModal(true);
  };

  const handlePrintWound = async (wound: WoundWithAssessments) => {
    const patient = patients.find(p => p.院友id === wound.patient_id);
    if (!patient) { alert('找不到院友資料'); return; }
    const stationCode = stations.find(s => s.id === patient.station_id)?.code ?? '';
    try {
      await printWoundAssessment(wound, wound.assessments, patient, stationCode);
    } catch (e) {
      console.error('Print failed:', e);
      alert('列印失敗，請重試');
    }
  };

  const handleCloneAssessment = (wound: WoundWithAssessments) => {
    const latest = wound.assessments[0]; // 已按日期降序，第 0 筆最新
    if (!latest) {
      // 沒有評估記錄時直接開新增番
      handleAddAssessment(wound);
      return;
    }
    // 將最新評估複輸，id 置 '' 讓 modal 判斷為新增，不帶入相片，日期置空由 modal 自動填今日
    const cloned = {
      ...latest,
      id: '' as any,                    // 空字串 = falsy => modal 進入新增流程
      assessment_date: '',             // modal 自動填今日
      wound_photos: [] as any,         // 不帶入上次相片
      created_at: undefined as any,
      updated_at: undefined as any,
    };
    setAssessmentWound(wound);
    setSelectedAssessment(cloned);
    setShowAssessmentModal(true);
  };

  const handleSaveWound = async (wound: WoundWithAssessments) => {
    const patient = patients.find(p => p.院友id === wound.patient_id);
    if (!patient) { alert('找不到院友資料'); return; }
    try {
      await saveWoundAssessmentHtml(wound, wound.assessments, patient);
    } catch (e) {
      console.error('Save failed:', e);
      alert('下載失敗，請重試');
    }
  };

  const handleViewAssessment = (wound: Wound, assessment: WoundAssessment) => {
    setAssessmentWound(wound);
    setSelectedAssessment(assessment);
    setShowAssessmentModal(true);
  };

  const handleDeleteAssessment = async (wound: WoundWithAssessments, assessmentId: string) => {
    if (!confirm('確定要刪除此評估記錄？此操作無法復原。')) return;
    // 先計算删除後的剩餘評估，由最新一筆决定傷口狀態
    const remainingAssessments = wound.assessments.filter(a => a.id !== assessmentId);
    const sortedRemaining = [...remainingAssessments].sort((a, b) =>
      new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
    );
    const latestStatus = sortedRemaining[0]?.wound_status;
    const newIsHealed = latestStatus === 'healed';
    try {
      setDeletingIds(prev => new Set(prev).add(assessmentId));
      await deleteWoundAssessment(assessmentId);
      await updateWound({
        id: wound.id,
        status: newIsHealed ? 'healed' : 'active',
        healed_date: newIsHealed ? wound.healed_date ?? null as any : null as any,
      });
    } catch {
      alert('刪除評估失敗，請重試');
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(assessmentId); return n; });
    }
  };

  // ── pagination ──

  const handlePageChange     = (p: number) => setCurrentPage(p);
  const handlePageSizeChange = (s: number) => { setPageSize(s); setCurrentPage(1); };

  const generatePageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, currentPage - 2);
      const end   = Math.min(totalPages, start + maxVisible - 1);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  // ── sub-components ────────────────────────────────────────────────────────

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

  const WoundStatusBadge: React.FC<{ wound: WoundWithAssessments }> = ({ wound }) => {
    const eff = getEffectiveWoundStatus(wound);
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${EFFECTIVE_STATUS_COLORS[eff] ?? 'bg-gray-100 text-gray-700'}`}>
        {EFFECTIVE_STATUS_LABELS[eff] ?? eff}
      </span>
    );
  };

  const AssessmentStatusCell: React.FC<{ wound: WoundWithAssessments }> = ({ wound }) => {
    if (getEffectiveWoundStatus(wound) === 'healed') return <span className="text-xs text-gray-400">—</span>;
    if (wound.is_overdue) {
      const overdueDays = wound.next_assessment_due ? daysSince(wound.next_assessment_due) : null;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 font-medium">
          <AlertTriangle className="h-3 w-3" />
          逾期{overdueDays ? ` ${overdueDays}天` : ''}
        </span>
      );
    }
    if (wound.days_until_due !== undefined && wound.days_until_due <= 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
          <Clock className="h-3 w-3" />
          {wound.days_until_due === 0 ? '今天到期' : `${wound.days_until_due}天後`}
        </span>
      );
    }
    if (!isAssessmentFrequencyNormal(wound)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
          <AlertTriangle className="h-3 w-3" />
          待評估
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3" />
        正常{wound.days_until_due !== undefined ? `（${wound.days_until_due}天後）` : ''}
      </span>
    );
  };

  // ── loading guard ──────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen pageName="傷口管理" />;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── z-30: 標題列 ── */}
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">傷口管理</h1>
          <button
            onClick={() => handleAddWound()}
            className="btn-primary flex flex-wrap items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>新增傷口</span>
          </button>
        </div>
      </div>

      {/* ── z-20: 搜尋 + 進階篩選 ── */}
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">

            {/* 搜尋列 */}
            <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索床號、姓名、傷口代號或名稱..."
                  value={filters.searchTerm}
                  onChange={e => updateFilter('searchTerm', e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(v => !v)}
                  className={`btn-secondary flex flex-wrap items-center gap-2 ${showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''} ${hasNonDefaultFilters ? 'border-blue-300' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                  {hasNonDefaultFilters && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">已套用</span>
                  )}
                </button>
                {(filters.searchTerm || hasNonDefaultFilters) && (
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

            {/* 進階篩選展開 */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">進階篩選</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">床號</label>
                    <input type="text" value={filters.床號} onChange={e => updateFilter('床號', e.target.value)} className="form-input" placeholder="搜索床號..." />
                  </div>
                  <div>
                    <label className="form-label">中文姓名</label>
                    <input type="text" value={filters.中文姓名} onChange={e => updateFilter('中文姓名', e.target.value)} className="form-input" placeholder="搜索姓名..." />
                  </div>
                  <div>
                    <label className="form-label">在住狀態</label>
                    <select value={filters.在住狀態} onChange={e => updateFilter('在住狀態', e.target.value)} className="form-input">
                      <option value="在住">在住</option>
                      <option value="待入住">待入住</option>
                      <option value="已退住">已退住</option>
                      <option value="全部">全部</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">傷口狀態</label>
                    <select value={filters.傷口狀態} onChange={e => updateFilter('傷口狀態', e.target.value)} className="form-input">
                      <option value="">全部</option>
                      <option value="untreated">未處理</option>
                      <option value="treating">治療中</option>
                      <option value="healed">已痊癒</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">傷口來源</label>
                    <select value={filters.傷口來源} onChange={e => updateFilter('傷口來源', e.target.value)} className="form-input">
                      <option value="">全部</option>
                      <option value="facility">本院發生</option>
                      <option value="admission">入住前發生</option>
                      <option value="hospital_referral">醫院發生</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">換症單位</label>
                    <select value={filters.換症單位} onChange={e => updateFilter('換症單位', e.target.value)} className="form-input">
                      <option value="">全部</option>
                      <option value="community_health">社康</option>
                      <option value="cgat">CGAT</option>
                      <option value="facility_staff">本院職員</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">評估狀態</label>
                    <select value={filters.評估狀態} onChange={e => updateFilter('評估狀態', e.target.value)} className="form-input">
                      <option value="">全部</option>
                      <option value="overdue">逾期評估</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 結果計數 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>
                顯示 {startIndex + 1}–{Math.min(endIndex, totalItems)} / {totalItems} 位院友（共 {filteredWounds.length} 個傷口）
              </span>
              {(filters.searchTerm || hasNonDefaultFilters) && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── z-10: 選取控制列 ── */}
      {totalItems > 0 && (
        <div className="sticky top-44 bg-white z-10 shadow-sm">
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {selectedRows.size === paginatedWounds.length ? '取消全選' : '全選'}
                </button>
                <button onClick={handleInvertSelection} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  反選
                </button>
                {selectedRows.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                    disabled={deletingIds.size > 0}
                  >
                    刪除選定傷口 ({selectedRows.size})
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600">
                已選擇 {selectedRows.size} / {filteredWounds.length} 個傷口
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 主表格 ── */}
      <div className="card overflow-hidden">
        {paginatedWounds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* col 1: checkbox */}
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedWounds.length && paginatedWounds.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  {/* col 2 */}
                  <SortableHeader field="patient_name">院友</SortableHeader>
                  {/* col 3 */}
                  <SortableHeader field="discovery_date">發現日期</SortableHeader>
                  {/* col 4-9 */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口來源</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">傷口狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">換症單位</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">評估狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroups.map(group => {
                  const pd      = patientsWithWounds.find(p => p.patient_id === group.patientId);
                  const patient = patients.find(p => p.院友id === group.patientId);
                  const isExpanded  = expandedPatients.has(group.patientId);
                  const overdueCount   = group.wounds.filter(w => w.is_overdue && getEffectiveWoundStatus(w) !== 'healed').length;
                  const treatingCount  = group.wounds.filter(w => getEffectiveWoundStatus(w) === 'treating').length;
                  const untreatedCount = group.wounds.filter(w => getEffectiveWoundStatus(w) === 'untreated').length;
                  const healedCount    = group.wounds.filter(w => getEffectiveWoundStatus(w) === 'healed').length;

                  return (
                    <React.Fragment key={group.patientId}>

                      {/* ── L1: 院友標題列 ── */}
                      <tr
                        className="bg-blue-50 hover:bg-blue-100 cursor-pointer select-none"
                        onClick={() => togglePatient(group.patientId)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={group.wounds.every(w => selectedRows.has(w.id))}
                            onChange={e => {
                              e.stopPropagation();
                              setSelectedRows(prev => {
                                const next = new Set(prev);
                                if (group.wounds.every(w => prev.has(w.id))) {
                                  group.wounds.forEach(w => next.delete(w.id));
                                } else {
                                  group.wounds.forEach(w => next.add(w.id));
                                }
                                return next;
                              });
                            }}
                            onClick={e => e.stopPropagation()}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" colSpan={8}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                              {patient?.院友相片 ? (
                                <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-blue-700" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {patient ? (
                                  <PatientTooltip patient={patient}>
                                    <span className="font-semibold text-gray-900 text-sm cursor-help hover:text-blue-700">
                                      {pd?.patient_name ?? patient.中文姓名}
                                    </span>
                                  </PatientTooltip>
                                ) : (
                                  <span className="font-semibold text-gray-900 text-sm">{pd?.patient_name}</span>
                                )}
                                <span className="text-xs text-gray-500">{pd?.bed_number}</span>
                                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{group.wounds.length} 個傷口</span>
                                {overdueCount   > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{overdueCount} 逾期</span>}
                                {treatingCount  > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{treatingCount} 治療中</span>}
                                {untreatedCount > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{untreatedCount} 未處理</span>}
                                {healedCount    > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{healedCount} 已痊癒</span>}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-blue-600">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ── L2: 傷口列 ── */}
                      {isExpanded && group.wounds.map(wound => {
                        const isWoundExpanded = expandedWounds.has(wound.id);
                        const unitLabel = wound.responsible_unit === 'other'
                          ? (wound.responsible_unit_other || '其他')
                          : (RESPONSIBLE_UNIT_LABELS[wound.responsible_unit] ?? '—');

                        return (
                          <React.Fragment key={wound.id}>
                            <tr
                              className={`hover:bg-gray-50 ${selectedRows.has(wound.id) ? 'bg-blue-50' : ''}`}
                              onDoubleClick={() => handleEditWound(wound)}
                            >
                              {/* col 1: checkbox */}
                              <td className="px-4 py-4 pl-8">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(wound.id)}
                                  onChange={() => handleSelectRow(wound.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                              </td>

                              {/* col 2: ↳ + expand */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => toggleWound(wound.id)}
                                  className="flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  title={isWoundExpanded ? '收合評估' : '展開評估'}
                                >
                                  <span className="text-xs font-mono">↳</span>
                                  {isWoundExpanded
                                    ? <ChevronUp className="h-3.5 w-3.5" />
                                    : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                              </td>

                              {/* col 3: 發現日期 */}
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                  {formatDate(wound.discovery_date)}
                                </div>
                              </td>

                              {/* col 4: 傷口名稱 */}
                              <td className="px-4 py-4">
                                <div className="text-sm font-semibold text-gray-900">{wound.wound_code}</div>
                                {wound.wound_name && (
                                  <div className="text-xs text-gray-500 mt-0.5 max-w-[160px] truncate" title={wound.wound_name}>
                                    {wound.wound_name}
                                  </div>
                                )}
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {WOUND_TYPE_LABELS[wound.wound_type] ?? wound.wound_type}
                                </div>
                              </td>

                              {/* col 5: 傷口來源 */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                                  {WOUND_ORIGIN_LABELS[wound.wound_origin] ?? wound.wound_origin}
                                </span>
                              </td>

                              {/* col 6: 傷口狀態 */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <WoundStatusBadge wound={wound} />
                              </td>

                              {/* col 7: 換症單位 */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                  {unitLabel}
                                </span>
                              </td>

                              {/* col 8: 評估狀態 */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <AssessmentStatusCell wound={wound} />
                                {wound.assessment_count > 0 && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    共 {wound.assessment_count} 次
                                  </div>
                                )}
                              </td>

                              {/* col 9: 操作 */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleAddAssessment(wound)}
                                    className="inline-flex items-center px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                                    title="新增評估"
                                    disabled={deletingIds.has(wound.id)}
                                  >
                                    <Plus className="h-3 w-3 mr-0.5" />評估
                                  </button>
                                  <button
                                    onClick={() => handleCloneAssessment(wound)}
                                    className="text-gray-400 hover:text-purple-600 transition-colors"
                                    title="另存（從上次評估從入新評估）"
                                    disabled={deletingIds.has(wound.id)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handlePrintWound(wound)}
                                    className="text-gray-400 hover:text-green-600 transition-colors"
                                    title="列印評估記錄表"
                                    disabled={deletingIds.has(wound.id)}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditWound(wound)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                    title="編輯"
                                    disabled={deletingIds.has(wound.id)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWound(wound)}
                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                    title="刪除"
                                    disabled={deletingIds.has(wound.id)}
                                  >
                                    {deletingIds.has(wound.id)
                                      ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                                      : <Trash2 className="h-4 w-4" />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* ── L3: 評估紀錄列 ── */}
                            {isWoundExpanded && (
                              <>
                                {wound.assessments.length === 0 ? (
                                  <tr className="bg-gray-50">
                                    <td />
                                    <td colSpan={8} className="px-6 py-3 pl-12 text-sm text-gray-500">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-gray-400" />
                                        尚無評估記錄
                                        <button
                                            onClick={() => handleAddAssessment(wound)}
                                            className="text-blue-600 hover:underline ml-2"
                                          >
                                            + 進行首次評估
                                          </button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  wound.assessments.map((assessment, idx) => {
                                    const isLatest   = idx === 0;
                                    const statusInfo = assessment.wound_status
                                      ? ASSESSMENT_STATUS_CONFIG[assessment.wound_status]
                                      : null;
                                    return (
                                      <tr
                                        key={assessment.id}
                                        className={`${isLatest ? 'bg-blue-50/50' : 'bg-gray-50'} hover:bg-gray-100 cursor-pointer`}
                                        onDoubleClick={() => handleViewAssessment(wound, assessment)}
                                      >
                                        <td />
                                        <td colSpan={8} className="px-6 py-2 pl-16">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                              <span className="text-xs text-gray-400 font-mono">↳↳</span>
                                              <span className="flex items-center gap-1 text-gray-700 font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                {formatDate(assessment.assessment_date)}
                                              </span>
                                              {isLatest && (
                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">最新</span>
                                              )}
                                              {statusInfo && (
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                                                  {statusInfo.label}
                                                </span>
                                              )}
                                              {assessment.stage && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                                                  {assessment.stage}
                                                </span>
                                              )}
                                              {assessment.area_length && assessment.area_width && (
                                                <span className="text-xs text-gray-600">
                                                  {assessment.area_length}×{assessment.area_width}
                                                  {assessment.area_depth ? `×${assessment.area_depth}` : ''} cm
                                                </span>
                                              )}
                                              {assessment.infection === '有' && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">感染</span>
                                              )}
                                              {assessment.assessor && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                  <User className="h-3 w-3" />{assessment.assessor}
                                                </span>
                                              )}
                                              {assessment.remarks && (
                                                <span className="text-xs text-gray-500 italic truncate max-w-[200px]" title={assessment.remarks}>
                                                  {assessment.remarks}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex-shrink-0 flex items-center gap-1">
                                              <button
                                                onClick={() => handleViewAssessment(wound, assessment)}
                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                              >
                                                <Eye className="h-3.5 w-3.5" />查看/編輯
                                              </button>
                                              <button
                                                onClick={() => handleDeleteAssessment(wound, assessment.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="刪除評估"
                                                disabled={deletingIds.has(assessment.id)}
                                              >
                                                {deletingIds.has(assessment.id)
                                                  ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-500" />
                                                  : <Trash2 className="h-3.5 w-3.5" />}
                                              </button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                                {/* 新增評估快捷列 */}
                                {wound.assessments.length > 0 && (
                                  <tr className="bg-gray-50">
                                    <td />
                                    <td colSpan={8} className="px-6 py-2 pl-16">
                                      <button
                                        onClick={() => handleAddAssessment(wound)}
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        <Plus className="h-3 w-3" />新增評估記錄
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filters.searchTerm || hasNonDefaultFilters ? '找不到符合條件的傷口' : '暫無傷口記錄'}
            </h3>
            <p className="text-gray-600 mb-4">
              {filters.searchTerm || hasNonDefaultFilters ? '請嘗試調整搜索條件' : '開始為院友建立傷口記錄'}
            </p>
            {!filters.searchTerm && !hasNonDefaultFilters ? (
              <button onClick={() => handleAddWound()} className="btn-primary">新增傷口</button>
            ) : (
              <button onClick={clearFilters} className="btn-secondary">清除所有篩選</button>
            )}
          </div>
        )}
      </div>

      {/* ── 分頁 (sticky bottom) ── */}
      {totalItems > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-700">每頁顯示:</span>
              <select
                value={pageSize}
                onChange={e => handlePageSizeChange(Number(e.target.value))}
                className="form-input text-sm w-20"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
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

      {/* ── Modals ── */}
      {showWoundModal && (
        <WoundModal
          wound={selectedWound}
          patientId={selectedPatientId}
          onClose={() => { setShowWoundModal(false); setSelectedWound(null); setSelectedPatientId(undefined); }}
          onSave={() => refreshWoundData()}
        />
      )}
      {showAssessmentModal && assessmentWound && (
        <SingleWoundAssessmentModal
          wound={assessmentWound}
          assessment={selectedAssessment}
          onClose={() => { setShowAssessmentModal(false); setAssessmentWound(null); setSelectedAssessment(null); }}
          onSave={() => refreshWoundData()}
        />
      )}
    </div>
  );
};

export default WoundManagementNew;

