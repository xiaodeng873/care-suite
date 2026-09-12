import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Search,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  CalendarDays,
} from 'lucide-react';
import DateInput from './DateInput';
import {
  getHomeActivities,
  addHomeActivity,
  updateHomeActivity,
  deleteHomeActivity,
  type HomeActivity,
  type HomeActivityInput,
} from '../lib/homeActivities';
import { exportHomeActivitiesExcel } from '../utils/homeActivitiesExcelGenerator';
import { fuzzyMatch } from '../utils/searchUtils';
import { formatDisplayDate } from '../utils/dateFormat';

type SortKey =
  | 'activity_date'
  | 'start_time'
  | 'organizer'
  | 'activity_name'
  | 'location'
  | 'volunteer_count'
  | 'participant_count';
type SortDir = 'asc' | 'desc';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthRange = (offset: number): [string, string] => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
};
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');
const fmtTimeRange = (r: HomeActivity) => {
  if (r.start_time && r.end_time) return `${fmtTime(r.start_time)}-${fmtTime(r.end_time)}`;
  return fmtTime(r.start_time) || fmtTime(r.end_time) || '—';
};

const emptyForm = (): HomeActivityInput => ({
  activity_date: todayStr(),
  start_time: '',
  end_time: '',
  organizer: '',
  activity_name: '',
  location: '',
  volunteer_count: 0,
  participant_count: 0,
});

interface ColumnDef {
  key: SortKey | null;
  label: string;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: null, label: '項目', className: 'w-12' },
  { key: 'activity_date', label: '日期', className: 'w-28' },
  { key: 'start_time', label: '時間', className: 'w-28' },
  { key: 'organizer', label: '主辦機構/團體' },
  { key: 'activity_name', label: '活動名稱' },
  { key: 'location', label: '地點（如外出，請列明）' },
  { key: 'volunteer_count', label: '義工人數', className: 'w-20' },
  { key: 'participant_count', label: '參加人數', className: 'w-20' },
  { key: null, label: '操作', className: 'w-24' },
];

const HomeActivitiesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [records, setRecords] = useState<HomeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editing, setEditing] = useState<HomeActivity | 'new' | null>(null);
  const [form, setForm] = useState<HomeActivityInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHomeActivities()
      .then(setRecords)
      .catch(err => console.error('載入院舍活動資料失敗:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = keyword.trim();
    return records.filter(r => {
      if (dateFrom && r.activity_date < dateFrom) return false;
      if (dateTo && r.activity_date > dateTo) return false;
      if (term) {
        return (
          fuzzyMatch(r.activity_name, term) ||
          fuzzyMatch(r.organizer || '', term) ||
          fuzzyMatch(r.location || '', term)
        );
      }
      return true;
    });
  }, [records, dateFrom, dateTo, keyword]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: HomeActivity): string | number => {
      switch (sortKey) {
        case 'volunteer_count': return r.volunteer_count || 0;
        case 'participant_count': return r.participant_count || 0;
        case 'start_time': return r.start_time || '';
        default: return (r[sortKey] as string | null) || '';
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      sessions: sorted.length,
      volunteers: sorted.reduce((s, r) => s + (r.volunteer_count || 0), 0),
      participants: sorted.reduce((s, r) => s + (r.participant_count || 0), 0),
    }),
    [sorted]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const startEdit = (r: HomeActivity) => {
    setEditing(r);
    setForm({
      activity_date: r.activity_date,
      start_time: fmtTime(r.start_time),
      end_time: fmtTime(r.end_time),
      organizer: r.organizer || '',
      activity_name: r.activity_name,
      location: r.location || '',
      volunteer_count: r.volunteer_count || 0,
      participant_count: r.participant_count || 0,
    });
  };

  const startAdd = () => {
    setEditing('new');
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.activity_date.trim() || !form.activity_name.trim()) {
      alert('請填寫日期及活動名稱');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await addHomeActivity(form);
        setRecords(prev => [created, ...prev]);
      } else if (editing) {
        await updateHomeActivity(editing.id, form);
        setRecords(prev =>
          prev.map(r => (r.id === editing.id ? { ...r, ...form, start_time: form.start_time || null, end_time: form.end_time || null } : r))
        );
      }
      setEditing(null);
    } catch (err: any) {
      alert(err?.message || '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: HomeActivity) => {
    if (!window.confirm(`確定刪除「${r.activity_name}」（${formatDisplayDate(r.activity_date, '')}）？`)) return;
    try {
      await deleteHomeActivity(r.id);
      setRecords(prev => prev.filter(x => x.id !== r.id));
    } catch (err: any) {
      alert(err?.message || '刪除失敗，請稍後再試');
    }
  };

  const setPreset = (preset: 'this' | 'last' | 'all') => {
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else {
      const [from, to] = monthRange(preset === 'this' ? 0 : -1);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const updateForm = (patch: Partial<HomeActivityInput>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              院舍活動報表
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">附件3.2 每月院舍活動資料</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 篩選工具列 */}
        <div className="px-6 py-3 border-b border-gray-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">日期範圍：</span>
            <DateInput value={dateFrom} onChange={setDateFrom} className="form-input w-36" placeholder="開始日期" />
            <span className="text-sm text-gray-500">至</span>
            <DateInput value={dateTo} onChange={setDateTo} className="form-input w-36" placeholder="結束日期" />
            <div className="flex gap-1 ml-1">
              <button onClick={() => setPreset('this')} className="btn-secondary text-xs px-2 py-1">本月</button>
              <button onClick={() => setPreset('last')} className="btn-secondary text-xs px-2 py-1">上月</button>
              <button onClick={() => setPreset('all')} className="btn-secondary text-xs px-2 py-1">全部</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="關鍵字搜尋：活動名稱／主辦機構／地點..."
                className="form-input pl-10"
              />
            </div>
            <button onClick={startAdd} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>新增活動</span>
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {editing && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 mb-3 space-y-2">
              <h3 className="text-sm font-medium text-blue-900">{editing === 'new' ? '新增活動' : '編輯活動'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="form-label"><span className="text-red-500">*</span> 日期</label>
                  <DateInput value={form.activity_date} onChange={v => updateForm({ activity_date: v })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">開始時間</label>
                  <input type="time" value={form.start_time || ''} onChange={e => updateForm({ start_time: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">結束時間</label>
                  <input type="time" value={form.end_time || ''} onChange={e => updateForm({ end_time: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">主辦機構/團體</label>
                  <input type="text" value={form.organizer || ''} onChange={e => updateForm({ organizer: e.target.value })} className="form-input" placeholder="例如：香港中國婦女會" />
                </div>
                <div className="col-span-2">
                  <label className="form-label"><span className="text-red-500">*</span> 活動名稱</label>
                  <input type="text" value={form.activity_name} onChange={e => updateForm({ activity_name: e.target.value })} className="form-input" placeholder="例如：音樂表演" />
                </div>
                <div>
                  <label className="form-label">地點（如外出，請列明）</label>
                  <input type="text" value={form.location || ''} onChange={e => updateForm({ location: e.target.value })} className="form-input" placeholder="例如：1/F 大廳" />
                </div>
                <div>
                  <label className="form-label">義工人數</label>
                  <input
                    type="number"
                    min={0}
                    value={form.volunteer_count}
                    onChange={e => updateForm({ volunteer_count: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">參加人數</label>
                  <input
                    type="number"
                    min={0}
                    value={form.participant_count}
                    onChange={e => updateForm({ participant_count: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button onClick={() => setEditing(null)} className="btn-secondary text-sm">取消</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.label}
                      className={`border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 ${col.className || ''}`}
                    >
                      {col.key ? (
                        <button
                          onClick={() => toggleSort(col.key as SortKey)}
                          className="inline-flex items-center gap-1 hover:text-blue-600"
                        >
                          <span>{col.label}</span>
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-gray-300">↕</span>
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="border border-gray-300 px-2 py-8 text-center text-gray-400">
                      暫無活動記錄
                    </td>
                  </tr>
                )}
                {sorted.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{formatDisplayDate(r.activity_date, '—')}</td>
                    <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{fmtTimeRange(r)}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{r.organizer || '—'}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{r.activity_name}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{r.location || '—'}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-center">{r.volunteer_count}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-center">{r.participant_count}</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1 text-blue-600 hover:text-blue-800" title="編輯">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(r)} className="p-1 text-red-600 hover:text-red-800" title="刪除">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100">
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-2 py-2 font-semibold text-gray-800">
                    合計（跟篩選結果計）
                  </td>
                  <td className="border border-gray-300 px-2 py-2 font-semibold text-gray-800">
                    活動 {totals.sessions} 場
                  </td>
                  <td className="border border-gray-300 px-2 py-2"></td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-800">
                    義工 {totals.volunteers} 人
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-800">
                    參加 {totals.participants} 人
                  </td>
                  <td className="border border-gray-300 px-2 py-2"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
          <button
            onClick={() => exportHomeActivitiesExcel(sorted)}
            disabled={sorted.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>匯出 Excel</span>
          </button>
          <button onClick={onClose} className="btn-primary">關閉</button>
        </div>
      </div>
    </div>
  );
};

export default HomeActivitiesModal;
