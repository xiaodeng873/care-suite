import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DateInput from './DateInput';

interface DoctorVisit {
  id: string;
  visit_date: string;
  doctor_name: string;
  available_slots: number;
  notes?: string;
}

interface CgatDoctorVisitPickerProps {
  /** 已被選用的 CGAT 到診日期 → 用於計算每日已用名額 */
  usedCountByDate: Record<string, number>;
  onSelect: (visitDate: string) => void;
  /** 到診日期清單被新增/修改/刪除後觸發，等外層可以刷新清單快取 */
  onScheduleChanged?: () => void;
  onClose: () => void;
}

const getHongKongDate = () => {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
};

const CgatDoctorVisitPicker: React.FC<CgatDoctorVisitPickerProps> = ({ usedCountByDate, onSelect, onScheduleChanged, onClose }) => {
  const [visits, setVisits] = useState<DoctorVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ visit_date: getHongKongDate(), doctor_name: '', available_slots: 20 });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('doctor_visit_schedule')
      .select('id, visit_date, doctor_name, available_slots, notes')
      .order('visit_date', { ascending: true });
    if (!error) setVisits(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ visit_date: getHongKongDate(), doctor_name: '', available_slots: 20 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.visit_date) { alert('請選擇到診日期'); return; }
    if (!form.doctor_name.trim()) { alert('請輸入醫生姓名'); return; }
    if (!form.available_slots || form.available_slots < 1) { alert('名額必須大於 0'); return; }
    // 同一到診日期不能重複（排除正在編輯的紀錄本身）
    const duplicate = visits.find(v => v.visit_date === form.visit_date && v.id !== editingId);
    if (duplicate) { alert('此到診日期已存在，請選擇其他日期或編輯現有紀錄'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('doctor_visit_schedule')
          .update({ visit_date: form.visit_date, doctor_name: form.doctor_name.trim(), available_slots: form.available_slots })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctor_visit_schedule')
          .insert([{ visit_date: form.visit_date, doctor_name: form.doctor_name.trim(), available_slots: form.available_slots }]);
        if (error) throw error;
      }
      resetForm();
      await load();
      onScheduleChanged?.();
    } catch (e: any) {
      alert(`儲存失敗：${e?.message ?? '請重試'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (v: DoctorVisit) => {
    setEditingId(v.id);
    setForm({ visit_date: v.visit_date, doctor_name: v.doctor_name, available_slots: v.available_slots });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此到診日期？')) return;
    const { error } = await supabase.from('doctor_visit_schedule').delete().eq('id', id);
    if (error) { alert(`刪除失敗：${error.message}`); return; }
    await load();
    onScheduleChanged?.();
  };

  const weekday = (d: string) => ['日', '一', '二', '三', '四', '五', '六'][new Date(d + 'T00:00:00').getDay()];

  // 顯示時以日期去重，避免同一日期出現多筆
  const uniqueVisits = useMemo(() => {
    const seen = new Set<string>();
    return visits.filter(v => {
      if (seen.has(v.visit_date)) return false;
      seen.add(v.visit_date);
      return true;
    });
  }, [visits]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" /> CGAT到診日期
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="flex justify-end mb-3">
            {!showForm && (
              <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> 新增到診日期
              </button>
            )}
          </div>

          {showForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">到診日期</label>
                  <DateInput className="form-input" value={form.visit_date}
                    onChange={(value) => setForm(f => ({ ...f, visit_date: value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">醫生姓名</label>
                  <input type="text" className="form-input" value={form.doctor_name}
                    onChange={(e) => setForm(f => ({ ...f, doctor_name: e.target.value }))} placeholder="醫生姓名" />
                </div>
                <div>
                  <label className="form-label text-xs">名額（同日最大覆診人數）</label>
                  <input type="number" min={1} className="form-input" value={form.available_slots}
                    onChange={(e) => setForm(f => ({ ...f, available_slots: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingId ? '更新' : '新增'}
                </button>
                <button onClick={resetForm} className="btn-secondary text-sm">取消</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : uniqueVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-400">尚無 CGAT到診日期</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 px-2">到診日期</th>
                  <th className="py-2 px-2">醫生</th>
                  <th className="py-2 px-2 text-center">已用 / 名額</th>
                  <th className="py-2 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {uniqueVisits.map(v => {
                  const used = usedCountByDate[v.visit_date] || 0;
                  const remaining = v.available_slots - used;
                  const full = remaining <= 0;
                  return (
                    <tr key={v.id} className="border-b hover:bg-blue-50">
                      <td className="py-2 px-2">
                        <button onClick={() => onSelect(v.visit_date)} className="text-blue-600 hover:underline font-medium">
                          {v.visit_date}（{weekday(v.visit_date)}）
                        </button>
                      </td>
                      <td className="py-2 px-2">{v.doctor_name}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={full ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                          {used} / {v.available_slots}
                        </span>
                        {full && <span className="ml-1 text-xs text-red-500">(已滿)</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleEdit(v)} className="text-gray-500 hover:text-blue-600 text-xs mr-2">編輯</button>
                        <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-400 mt-3">點擊到診日期即回填 CGAT 到診日期。</p>
        </div>
      </div>
    </div>
  );
};

export default CgatDoctorVisitPicker;
