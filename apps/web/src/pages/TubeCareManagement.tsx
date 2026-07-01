import React, { useState } from 'react';
import {
  Stethoscope,
  Plus,
  Edit3,
  Trash2,
  Search,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  Copy,
  Droplet,
  Wind,
  Package,
  Ban,
  Filter,
  X,
} from 'lucide-react';
import { usePatients, type PatientTubeCareRecord } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import TubeCareModal from '../components/TubeCareModal';
import PatientTooltip from '../components/PatientTooltip';
import { fuzzyMatch, matchChineseName, matchEnglishName , matchBedNumber } from '../utils/searchUtils';
import { getTubeCareStatus } from '../utils/taskScheduler';

interface AdvancedFilters {
  床號: string;
  中文姓名: string;
  care_type: string;
  is_overdue: string;
  is_terminated: string;
  startDate: string;
  endDate: string;
  在住狀態: string;
}

const CARE_TYPE_OPTIONS: PatientTubeCareRecord['care_type'][] = [
  '尿導管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換', '造口袋更換',
];

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const statusBadge = (record: PatientTubeCareRecord) => {
  if (record.is_terminated) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">已終止</span>;
  }
  const status = getTubeCareStatus(record);
  if (status === 'overdue') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">已逾期</span>;
  }
  if (status === 'due_soon') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">即將到期</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">有效</span>;
};

const careTypeIcon = (careType: string) => {
  if (careType === '氧氣喉管清洗/更換') return <Wind className="h-4 w-4 text-teal-600" />;
  if (careType === '造口袋更換') return <Package className="h-4 w-4 text-purple-600" />;
  return <Droplet className="h-4 w-4 text-blue-600" />;
};

const detailText = (record: PatientTubeCareRecord) => {
  if (record.care_type === '氧氣喉管清洗/更換') {
    return record.oxygen_action ?? '—';
  }
  if (record.care_type === '造口袋更換') {
    return record.cycle_days ? `每 ${record.cycle_days} 天更換` : '—';
  }
  return [record.tube_material, record.tube_size].filter(Boolean).join(' ') || '—';
};

const TubeCareManagement: React.FC = () => {
  const { patientTubeCareRecords, patients, deletePatientTubeCareRecord, updatePatientTubeCareRecord, loading } = usePatients();
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PatientTubeCareRecord | null>(null);
  const [renewFromRecord, setRenewFromRecord] = useState<PatientTubeCareRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    床號: '',
    中文姓名: '',
    care_type: '',
    is_overdue: '',
    is_terminated: '',
    startDate: '',
    endDate: '',
    在住狀態: '在住',
  });
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  if (loading) {
    return <LoadingScreen pageName="喉管護理" />;
  }

  const patientsMap = new Map(patients.map(p => [p.院友id, p]));

  const hasAdvancedFilters = () => Object.values(advancedFilters).some(v => v !== '' && v !== '在住');
  const updateAdvancedFilter = (field: keyof AdvancedFilters, value: string) =>
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  const clearFilters = () => {
    setSearchTerm('');
    setAdvancedFilters({
      床號: '', 中文姓名: '', care_type: '', is_overdue: '', is_terminated: '', startDate: '', endDate: '', 在住狀態: '在住',
    });
  };

  const filtered = patientTubeCareRecords.filter(record => {
    const patient = patientsMap.get(record.patient_id);
    if (advancedFilters.在住狀態 && advancedFilters.在住狀態 !== '全部' && patient?.在住狀態 !== advancedFilters.在住狀態) return false;
    // 終止：預設隱藏已終止；篩選器選「是」只顯示已終止
    if (advancedFilters.is_terminated === '是') {
      if (!record.is_terminated) return false;
    } else {
      if (record.is_terminated) return false;
    }
    if (advancedFilters.care_type && record.care_type !== advancedFilters.care_type) return false;
    if (advancedFilters.床號 && !matchBedNumber(patient?.床號, advancedFilters.床號)) return false;
    if (advancedFilters.中文姓名 && !matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, advancedFilters.中文姓名)) return false;
    if (advancedFilters.is_overdue) {
      const overdue = getTubeCareStatus(record) === 'overdue';
      if (advancedFilters.is_overdue === '是' && !overdue) return false;
      if (advancedFilters.is_overdue === '否' && overdue) return false;
    }
    if (advancedFilters.startDate || advancedFilters.endDate) {
      const exec = new Date(record.execution_date);
      if (advancedFilters.startDate && exec < new Date(advancedFilters.startDate)) return false;
      if (advancedFilters.endDate && exec > new Date(advancedFilters.endDate)) return false;
    }
    if (searchTerm) {
      const matched =
        matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
        matchEnglishName(patient?.英文姓氏, patient?.英文名字, patient?.英文姓名, searchTerm) ||
        matchBedNumber(patient?.床號, searchTerm) ||
        fuzzyMatch(record.notes, searchTerm);
      if (!matched) return false;
    }
    return true;
  });

  // 依 patient_id 分組，組內依 execution_date desc
  const groups: { patientId: number; records: PatientTubeCareRecord[] }[] = (() => {
    const map = new Map<number, PatientTubeCareRecord[]>();
    filtered.forEach(r => {
      if (!map.has(r.patient_id)) map.set(r.patient_id, []);
      map.get(r.patient_id)!.push(r);
    });
    const result = Array.from(map.entries()).map(([patientId, records]) => ({
      patientId,
      records: records.sort((a, b) => new Date(b.execution_date).getTime() - new Date(a.execution_date).getTime()),
    }));
    // 逾期者排前
    result.sort((a, b) => {
      const aDue = a.records[0]?.next_due_date ? new Date(a.records[0].next_due_date).getTime() : Infinity;
      const bDue = b.records[0]?.next_due_date ? new Date(b.records[0].next_due_date).getTime() : Infinity;
      return aDue - bDue;
    });
    return result;
  })();

  const toggleExpand = (patientId: number) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId); else next.add(patientId);
      return next;
    });
  };

  const handleAdd = () => {
    setSelectedRecord(null);
    setRenewFromRecord(null);
    setShowModal(true);
  };

  const handleEdit = (record: PatientTubeCareRecord) => {
    setSelectedRecord(record);
    setRenewFromRecord(null);
    setShowModal(true);
  };

  const handleRenew = (record: PatientTubeCareRecord) => {
    setSelectedRecord(null);
    setRenewFromRecord(record);
    setShowModal(true);
  };

  const handleTerminate = async (record: PatientTubeCareRecord) => {
    const patient = patientsMap.get(record.patient_id);
    if (!confirm(`確定要終止 ${patient?.中文姓名 ?? ''} 的「${record.care_type}」嗎？終止後不再續期，並列為已終止記錄。`)) return;
    try {
      await updatePatientTubeCareRecord({ ...record, is_terminated: true });
    } catch (error) {
      console.error('終止喉管護理記錄失敗:', error);
      alert('終止失敗，請重試');
    }
  };

  const handleDelete = async (record: PatientTubeCareRecord) => {
    const patient = patientsMap.get(record.patient_id);
    if (!confirm(`確定要刪除 ${patient?.中文姓名 ?? ''} 的「${record.care_type}」記錄（${formatDate(record.execution_date)}）嗎？`)) return;
    try {
      setDeletingIds(prev => new Set(prev).add(record.id));
      await deletePatientTubeCareRecord(record.id);
    } catch (error) {
      console.error('刪除喉管護理記錄失敗:', error);
      alert('刪除失敗，請重試');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100">
            <Stethoscope className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">喉管護理</h1>
            <p className="text-sm text-gray-500">尿導管 / 鼻胃飼管 / 氧氣喉管 清洗及更換記錄</p>
          </div>
        </div>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> 新增記錄
        </button>
      </div>

      {/* 篩選列 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋院友姓名、床號、備註..."
              className="form-input pl-9 w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`btn-secondary flex flex-wrap items-center gap-2 ${showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''} ${hasAdvancedFilters() ? 'border-blue-300' : ''}`}
            >
              <Filter className="h-4 w-4" />
              <span>進階篩選</span>
              {hasAdvancedFilters() && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">已套用</span>
              )}
            </button>
            {(searchTerm || hasAdvancedFilters()) && (
              <button onClick={clearFilters} className="btn-secondary flex flex-wrap items-center gap-2 text-red-600 hover:text-red-700">
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
              <label className="form-label">執行日期區間</label>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={advancedFilters.startDate} onChange={(e) => updateAdvancedFilter('startDate', e.target.value)} className="form-input" />
                <span className="text-gray-500">至</span>
                <input type="date" value={advancedFilters.endDate} onChange={(e) => updateAdvancedFilter('endDate', e.target.value)} className="form-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">護理類型</label>
                <select value={advancedFilters.care_type} onChange={(e) => updateAdvancedFilter('care_type', e.target.value)} className="form-input">
                  <option value="">全部類型</option>
                  {CARE_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">床號</label>
                <input type="text" value={advancedFilters.床號} onChange={(e) => updateAdvancedFilter('床號', e.target.value)} className="form-input" placeholder="搜尋床號..." />
              </div>
              <div>
                <label className="form-label">中文姓名</label>
                <input type="text" value={advancedFilters.中文姓名} onChange={(e) => updateAdvancedFilter('中文姓名', e.target.value)} className="form-input" placeholder="搜尋姓名..." />
              </div>
              <div>
                <label className="form-label">到期狀態</label>
                <select value={advancedFilters.is_overdue} onChange={(e) => updateAdvancedFilter('is_overdue', e.target.value)} className="form-input">
                  <option value="">所有狀態</option>
                  <option value="是">已逾期</option>
                  <option value="否">未逾期</option>
                </select>
              </div>
              <div>
                <label className="form-label">在住狀態</label>
                <select value={advancedFilters.在住狀態} onChange={(e) => updateAdvancedFilter('在住狀態', e.target.value)} className="form-input">
                  <option value="在住">在住</option>
                  <option value="待入住">待入住</option>
                  <option value="已退住">已退住</option>
                  <option value="">全部</option>
                </select>
              </div>
              <div>
                <label className="form-label">終止狀態</label>
                <select value={advancedFilters.is_terminated} onChange={(e) => updateAdvancedFilter('is_terminated', e.target.value)} className="form-input">
                  <option value="">進行中</option>
                  <option value="是">已終止</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">院友</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳情</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">執行日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">下次到期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groups.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">尚無記錄</td>
                </tr>
              )}
              {groups.map(group => {
                const patient = patientsMap.get(group.patientId);
                const expanded = expandedPatients.has(group.patientId);
                const visible = expanded ? group.records : [group.records[0]];
                const hasOld = group.records.length > 1;
                return visible.map((record, index) => {
                  const isLatest = index === 0;
                  return (
                    <tr key={record.id} className={isLatest ? '' : 'bg-gray-50'}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLatest ? (
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                              {patient?.院友相片 ? (
                                <img src={patient.院友相片} alt={patient?.中文姓名} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {patient ? (
                                  <PatientTooltip patient={patient}>
                                    <span className="cursor-help hover:text-blue-600 transition-colors">{patient.中文姓氏}{patient.中文名字}</span>
                                  </PatientTooltip>
                                ) : '未知院友'}
                              </div>
                              <div className="text-xs text-gray-500">{patient?.床號 ?? ''}</div>
                            </div>
                            {hasOld && (
                              <button
                                onClick={() => toggleExpand(group.patientId)}
                                className="ml-1 text-xs text-teal-600 hover:underline inline-flex items-center"
                              >
                                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {expanded ? '收起' : `舊記錄 (${group.records.length - 1})`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 pl-6">舊記錄</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          {careTypeIcon(record.care_type)}
                          {record.care_type}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{detailText(record)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(record.execution_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(record.next_due_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{isLatest ? statusBadge(record) : <span className="text-xs text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isLatest && !record.is_terminated && (
                            <button onClick={() => handleRenew(record)} className="text-teal-600 hover:text-teal-800" title="續期">
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {isLatest && !record.is_terminated && (
                            <button onClick={() => handleTerminate(record)} className="text-orange-500 hover:text-orange-700" title="終止（不再續期）">
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => handleEdit(record)} className="text-gray-500 hover:text-gray-700" title="編輯">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record)}
                            disabled={deletingIds.has(record.id)}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <TubeCareModal
          record={selectedRecord ?? undefined}
          renewFrom={renewFromRecord}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default TubeCareManagement;
