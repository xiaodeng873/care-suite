import { X, User, Pill, Calendar, Stethoscope, FileText, AlertTriangle, Loader2, Bell } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { usePgt } from '../context/PgtContext';
import PatientAutocomplete from './PatientAutocomplete';
import CgatDoctorVisitPicker from './CgatDoctorVisitPicker';
import { calcEstimatedMedicationEndDate } from '../utils/cgatDateHelper';
import type { PgtRecord } from '../lib/database';
import React, { useState, useMemo } from 'react';
import DateInput from './DateInput';

interface PgtModalProps {
  record?: PgtRecord | null;
  renewFrom?: PgtRecord | null;
  onClose: () => void;
}

const PgtModal: React.FC<PgtModalProps> = ({ record, renewFrom, onClose }) => {
  const { allPatients } = usePatientData();
  const { pgtRecords, addPgtRecord, updatePgtRecord, visitDates, visitDatesLoaded, refreshVisitDates } = usePgt();

  // 另存續期：以 renewFrom 內容預填，但視為新增（不帶 id）
  const source = record ?? renewFrom ?? null;
  // 編輯中嘅記錄；儲存後「另存新列」會清掉，令下次儲存走新增
  const [editingRecord, setEditingRecord] = useState<PgtRecord | null>(record ?? null);

  const buildForm = (src: PgtRecord | null) => ({
    patient_id: src?.patient_id ? String(src.patient_id) : '',
    // 個案類型
    case_type: src?.case_type ?? '',
    // 藥物配發
    medication_end_date: src?.medication_end_date ?? '',
    pharmacy_arrangement: src?.pharmacy_arrangement ?? '',
    is_urgent_medication: src?.is_urgent_medication ?? false,
    // 侯診原因
    reason_renew: src?.reason_renew ?? false,
    reason_sign_letter: src?.reason_sign_letter ?? false,
    reason_referral_letter: src?.reason_referral_letter ?? false,
    // PGT 到診安排
    pgt_visit_date: src?.pgt_visit_date ?? '',
    pgt_visit_unknown: src?.pgt_visit_unknown ?? false,
    medication_pickup_arrangement: src?.medication_pickup_arrangement ?? '每次詢問' as '家人前往' | '院舍代勞' | '每次詢問',
    treatment_weeks: src?.treatment_weeks ?? undefined as number | undefined,
    remarks: src?.remarks ?? ''
  });
  const [form, setForm] = useState(() => buildForm(source));
  const [saving, setSaving] = useState(false);
  const [showVisitPicker, setShowVisitPicker] = useState(false);
  // 藥完日期：預計模式（自動推算，預設）/ 手動模式（互斥）
  const [manualEndDate, setManualEndDate] = useState(false);
  // 儲存後提醒（有療程先彈）：顯示推算藥完日期，問用戶要唔要另存新列
  const [showRenewPrompt, setShowRenewPrompt] = useState(false);
  const [renewEndDate, setRenewEndDate] = useState<string | undefined>(undefined);
  const [renewIsDerived, setRenewIsDerived] = useState(false);

  // 藥完日期 = 到診日期 + 療程周數 × 7；療程留空或到診未知 → 唔郁
  const deriveAndSetEndDate = (visitDate: string, weeks: number | undefined, unknown: boolean) => {
    const derived = calcEstimatedMedicationEndDate(visitDate, weeks, unknown);
    if (derived) set({ medication_end_date: derived });
  };

  const patient = useMemo(
    () => allPatients.find((p) => String(p.院友id) === String(form.patient_id)),
    [allPatients, form.patient_id]
  );

  // 每日已用名額（依已選 pgt_visit_date 的 PGT 記錄，排除當前編輯記錄）
  const usedCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of pgtRecords) {
      if (editingRecord && r.id === editingRecord.id) continue;
      if (r.pgt_visit_date) map[r.pgt_visit_date] = (map[r.pgt_visit_date] || 0) + 1;
    }
    return map;
  }, [pgtRecords, editingRecord]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // 所選診症日期已不在最新到診清單（被刪/被改）
  const isStaleVisitDate = !form.pgt_visit_unknown && !!form.pgt_visit_date &&
  visitDatesLoaded && !visitDates.includes(form.pgt_visit_date);

  const validate = (): string | null => {
    if (!form.patient_id) return '請選擇院友';
    if (form.case_type !== '新症' && form.case_type !== '舊症') return '請選擇個案類型（新症/舊症）';
    if (form.pharmacy_arrangement !== '個別取藥' && form.pharmacy_arrangement !== '集體取藥') return '請選擇藥房安排（個別/集體取藥）';
    // 診症日期必須對上 PGT 到診日期清單（唔可以自行輸入），或者填未知
    if (isStaleVisitDate) return '所選診症日期已不在最新 PGT 到診日期清單，請重新選擇日期，或勾選「未知」';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {alert(err);return;}
    setSaving(true);
    try {
      const payload = {
        patient_id: parseInt(form.patient_id),
        case_type: form.case_type as '新症' | '舊症',
        medication_end_date: form.medication_end_date || undefined,
        pharmacy_arrangement: form.pharmacy_arrangement as '個別取藥' | '集體取藥',
        is_urgent_medication: form.is_urgent_medication,
        reason_renew: form.reason_renew,
        reason_sign_letter: form.reason_sign_letter,
        reason_referral_letter: form.reason_referral_letter,
        pgt_visit_date: form.pgt_visit_unknown ? undefined : form.pgt_visit_date || undefined,
        pgt_visit_unknown: form.pgt_visit_unknown,
        medication_pickup_arrangement: form.medication_pickup_arrangement as '家人前往' | '院舍代勞' | '每次詢問',
        treatment_weeks: form.treatment_weeks ?? undefined,
        remarks: form.remarks || undefined
      };
      if (editingRecord) {
        await updatePgtRecord({ id: editingRecord.id, ...payload });
      } else {
        await addPgtRecord(payload);
      }
      // 儲存時有療程 → 彈出提醒：顯示推算藥完日期，問用戶要唔要另存新列
      if (form.treatment_weeks) {
        const derived = calcEstimatedMedicationEndDate(form.pgt_visit_date, form.treatment_weeks, form.pgt_visit_unknown);
        setRenewEndDate(derived ?? (form.medication_end_date || undefined));
        setRenewIsDerived(!!derived);
        setShowRenewPrompt(true);
      } else {
        onClose();
      }
    } catch (e: any) {
      alert(`儲存失敗：${e?.message ?? '請重試'}`);
    } finally {
      setSaving(false);
    }
  };

  // 提醒 modal「另存新列」：重置為新增，預填同院友 + 侯診原因=續藥 + 藥完日期=上次推算值
  const handleRenewSaveAs = () => {
    setEditingRecord(null);
    setForm({
      ...buildForm(null),
      patient_id: form.patient_id,
      reason_renew: true,
      medication_end_date: renewEndDate ?? ''
    });
    setManualEndDate(false);
    setShowRenewPrompt(false);
  };

  const sectionTitle = (icon: React.ReactNode, text: string) =>
  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3 pb-2 border-b">{icon}{text}</h3>;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{editingRecord ? '編輯 PGT 記錄' : '新增 PGT 記錄'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* ① 選擇院友 */}
          <section>
            {sectionTitle(<User className="h-4 w-4 text-blue-600" />, '選擇院友')}
            <PatientAutocomplete value={form.patient_id} onChange={(id) => set({ patient_id: id })}
            showResidencyFilter defaultResidencyStatus="在住" ignoreStationFilter />
            {patient &&
            <div className="mt-3 bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
                {patient.入住類型 &&
              <div><span className="text-gray-500">入住類型：</span>{patient.入住類型}</div>
              }
                {patient.社會福利?.type &&
              <div><span className="text-gray-500">社會福利：</span>{patient.社會福利.type}{patient.社會福利.subtype ? ` - ${patient.社會福利.subtype}` : ''}</div>
              }
                {patient.公務員 &&
              <div><span className="text-gray-500">公務員：</span>{patient.公務員}</div>
              }
              </div>
            }
          </section>

          {/* ② 個案類型 */}
          <section>
            {sectionTitle(<FileText className="h-4 w-4 text-blue-600" />, '個案類型')}
            <div className="flex gap-3">
              {(['新症', '舊症'] as const).map((t) =>
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="case_type" checked={form.case_type === t} onChange={() => set({ case_type: t })} />
                  <span>{t}</span>
                </label>
              )}
            </div>
          </section>

          {/* ③ 藥物配發 */}
          <section>
            {sectionTitle(<Pill className="h-4 w-4 text-blue-600" />, '藥物配發')}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">療程（周）</label>
                  <input
                    type="number" min={0} className="form-input" value={form.treatment_weeks ?? ''}
                    onChange={(e) => {
                      const weeks = e.target.value === '' ? undefined : parseInt(e.target.value) || 0;
                      set({ treatment_weeks: weeks });
                      // 有到診日期就自動推算藥完日期（到診未知 / 療程留空 → 唔郁）
                      if (!manualEndDate) deriveAndSetEndDate(form.pgt_visit_date, weeks, form.pgt_visit_unknown);
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    留空則藥完日期不更新
                  </p>
                </div>
                <div>
                  <label className="form-label">藥完日期</label>
                  {manualEndDate ?
                    <DateInput className="form-input" value={form.medication_end_date} onChange={(value) => set({ medication_end_date: value })} /> :
                    <div className="form-input bg-gray-50 flex items-center">
                      {form.medication_end_date ?
                        <span className="text-gray-900">{form.medication_end_date}</span> :
                        <span className="text-gray-400">未有</span>}
                    </div>
                  }
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input
                      type="checkbox" checked={manualEndDate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setManualEndDate(checked);
                        // 返回預計模式時，有到診日期+療程就重算（推唔到就保留現值）
                        if (!checked) deriveAndSetEndDate(form.pgt_visit_date, form.treatment_weeks, form.pgt_visit_unknown);
                      }}
                    />
                    <span className="text-xs text-gray-500">手動輸入（預設由「到診日期 + 療程」自動推算）</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="form-label">藥房安排 *</label>
                <div className="flex gap-4">
                  {(['個別取藥', '集體取藥'] as const).map((t) =>
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="pharmacy_arrangement" checked={form.pharmacy_arrangement === t}
                    onChange={() => set({ pharmacy_arrangement: t })} />
                      <span>{t}</span>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer border-l pl-4">
                    <input type="checkbox" checked={form.is_urgent_medication} onChange={(e) => set({ is_urgent_medication: e.target.checked })} />
                    <span>急藥</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* ④ 侯診原因 */}
          <section>
            {sectionTitle(<Stethoscope className="h-4 w-4 text-blue-600" />, '侯診原因')}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_renew} onChange={(e) => set({ reason_renew: e.target.checked })} /><span>續藥</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_sign_letter} onChange={(e) => set({ reason_sign_letter: e.target.checked })} /><span>簽信</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_referral_letter} onChange={(e) => set({ reason_referral_letter: e.target.checked })} /><span>轉介信</span>
              </label>
            </div>
          </section>

          {/* ⑤ PGT 到診安排 */}
          <section>
            {sectionTitle(<Calendar className="h-4 w-4 text-blue-600" />, 'PGT 到診安排')}
            <div className="space-y-3">
              <div>
                <label className="form-label">PGT 到診日期</label>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    {/* 診症日期只可以由到診日期清單揀，唔可以自行輸入；可填未知 */}
                    <div className={`form-input bg-gray-50 flex items-center ${isStaleVisitDate ? 'border-red-400 text-red-600' : 'text-gray-900'}`}>
                      {form.pgt_visit_unknown ?
                      <span className="text-red-600">未知</span> :
                      form.pgt_visit_date ?
                      <span>{form.pgt_visit_date}{isStaleVisitDate && '（已不在到診清單）'}</span> :
                      <span className="text-gray-400">未選擇</span>}
                    </div>
                  </div>
                  {!form.pgt_visit_unknown &&
                  <button type="button" onClick={() => setShowVisitPicker(true)} className="btn-secondary whitespace-nowrap">
                      選 PGT 到診日期
                    </button>
                  }
                  <label className="flex items-center gap-2 pb-2 cursor-pointer">
                    <input type="checkbox" checked={form.pgt_visit_unknown}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      set({ pgt_visit_unknown: checked, pgt_visit_date: checked ? '' : form.pgt_visit_date });
                    }} />
                    <span>未知</span>
                  </label>
                </div>
                {isStaleVisitDate &&
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    此日期已被刪除或更改，對不上最新到診日期清單，請重新選擇日期，或勾選「未知」。
                  </p>
                }
              </div>
              <div>
                <label className="form-label">取藥安排</label>
                <select className="form-input" value={form.medication_pickup_arrangement}
                onChange={(e) => set({ medication_pickup_arrangement: e.target.value as '家人前往' | '院舍代勞' | '每次詢問' })}>
                  <option value="家人前往">家人自取</option>
                  <option value="院舍代勞">院舍代勞</option>
                  <option value="每次詢問">每次詢問</option>
                </select>
              </div>
            </div>
          </section>

          {/* 備註 */}
          <section>
            {sectionTitle(<FileText className="h-4 w-4 text-blue-600" />, '備註')}
            <textarea className="form-input" rows={1} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="備註（選填）" />
          </section>
        </form>

        <div className="flex gap-2 p-4 border-t">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingRecord ? '更新記錄' : '建立記錄'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
        </div>
      </div>

      {showVisitPicker &&
      <CgatDoctorVisitPicker
        usedCountByDate={usedCountByDate}
        serviceName="PGT"
        onSelect={(d) => {set({ pgt_visit_date: d });setShowVisitPicker(false);if (!manualEndDate) deriveAndSetEndDate(d, form.treatment_weeks, form.pgt_visit_unknown);}}
        onScheduleChanged={() => {refreshVisitDates();}}
        onClose={() => setShowVisitPicker(false)} />

      }

      {/* 儲存後提醒：有療程時顯示推算藥完日期，問用戶要唔要另存新列 */}
      {showRenewPrompt &&
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]" onClick={onClose}>
        <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">記錄已儲存</h3>
          </div>
          <div className="text-sm text-gray-700 space-y-2 mb-4">
            {renewEndDate ?
            <>
                <p>
                  {renewIsDerived ? `根據療程 ${form.treatment_weeks} 周推算，` : ''}藥完日期為
                  <span className="font-medium text-blue-600"> {renewEndDate}</span>。
                </p>
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  下次 PGT 到診應安排喺藥完日期或之前。
                </p>
              </> :

            <p>本次記錄有療程但未有藥完日期（到診日期未知），請留意人手安排下次到診。</p>
            }
            <p>要唔要根據呢個藥完日期另存新列（預填：同院友、侯診原因=續藥）？</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={handleRenewSaveAs} className="btn-primary flex-1">另存新列</button>
            <button onClick={onClose} className="btn-secondary flex-1">唔需要</button>
          </div>
        </div>
      </div>
      }
    </div>);

};

export default PgtModal;
