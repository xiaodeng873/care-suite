import React, { useState, useMemo } from 'react';
import { X, User, Pill, Calendar, Stethoscope, DollarSign, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { useCgat } from '../context/CgatContext';
import PatientAutocomplete from './PatientAutocomplete';
import CgatDoctorVisitPicker from './CgatDoctorVisitPicker';
import { getFeeExemptEligibility, calcCgatFee } from '../utils/cgatFeeHelper';
import CgatMedicationEndDateTable from './CgatMedicationEndDateTable';
import type { CgatRecord } from '../lib/database';

interface CgatModalProps {
  record?: CgatRecord | null;
  renewFrom?: CgatRecord | null;
  onClose: () => void;
}

const CgatModal: React.FC<CgatModalProps> = ({ record, renewFrom, onClose }) => {
  const { allPatients } = usePatientData();
  const { cgatRecords, addCgatRecord, updateCgatRecord, visitDates, visitDatesLoaded, refreshVisitDates } = useCgat();

  // 另存續期：以 renewFrom 內容預填，但視為新增（不帶 id）
  const source = record ?? renewFrom ?? null;

  const [form, setForm] = useState({
    patient_id: source?.patient_id ? String(source.patient_id) : '',
    // 個案類型
    case_type: source?.case_type ?? '',
    is_cgas: source?.is_cgas ?? false,
    is_eol: source?.is_eol ?? false,
    // 藥物配發
    medication_end_date: source?.medication_end_date ?? '',
    pharmacy_arrangement: source?.pharmacy_arrangement ?? '',
    is_urgent_medication: source?.is_urgent_medication ?? false,
    // 侯診原因
    reason_renew: source?.reason_renew ?? false,
    reason_discharge: source?.reason_discharge ?? false,
    reason_sign_letter: source?.reason_sign_letter ?? false,
    reason_referral_letter: source?.reason_referral_letter ?? false,
    reason_view_report: source?.reason_view_report ?? false,
    report_bld: source?.report_bld ?? false,
    report_xray: source?.report_xray ?? false,
    report_ct: source?.report_ct ?? false,
    report_usg: source?.report_usg ?? false,
    report_other: source?.report_other ?? '',
    // CGAT 到診安排
    cgat_visit_date: source?.cgat_visit_date ?? '',
    cgat_visit_unknown: source?.cgat_visit_unknown ?? false,
    medication_pickup_arrangement: source?.medication_pickup_arrangement ?? '每次詢問',
    // 費用結算
    fee_exempted: source?.fee_exempted ?? false,
    consultation_fee: source?.consultation_fee ?? 100,
    medication_fee_per_item: source?.medication_fee_per_item ?? 20,
    prescription_count: source?.prescription_count ?? undefined as number | undefined,
    treatment_weeks: source?.treatment_weeks ?? undefined as number | undefined,
    remarks: source?.remarks ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [showVisitPicker, setShowVisitPicker] = useState(false);

  const patient = useMemo(
    () => allPatients.find(p => String(p.院友id) === String(form.patient_id)),
    [allPatients, form.patient_id]
  );

  // 合資格轄免收費人士判斷
  const eligibility = useMemo(() => getFeeExemptEligibility(patient), [patient]);

  // 每日已用名額（依已選 cgat_visit_date 的 CGAT 記錄，排除當前編輯記錄）
  const usedCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of cgatRecords) {
      if (record && r.id === record.id) continue;
      if (r.cgat_visit_date) map[r.cgat_visit_date] = (map[r.cgat_visit_date] || 0) + 1;
    }
    return map;
  }, [cgatRecords, record]);

  // 費用即時計算
  const feeResult = useMemo(() => calcCgatFee({
    patient,
    feeExempted: form.fee_exempted,
    medicationPickupArrangement: form.medication_pickup_arrangement,
    consultationFee: Number(form.consultation_fee) || 0,
    medicationFeePerItem: Number(form.medication_fee_per_item) || 0,
    prescriptionCount: form.prescription_count,
    treatmentWeeks: form.treatment_weeks,
  }), [patient, form.fee_exempted, form.medication_pickup_arrangement, form.consultation_fee, form.medication_fee_per_item, form.prescription_count, form.treatment_weeks]);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  // 所選診症日期已不在最新到診清單（被刪/被改）
  const isStaleVisitDate = !form.cgat_visit_unknown && !!form.cgat_visit_date &&
    visitDatesLoaded && !visitDates.includes(form.cgat_visit_date);

  const validate = (): string | null => {
    if (!form.patient_id) return '請選擇院友';
    if (form.case_type !== '新症' && form.case_type !== '舊症') return '請選擇個案類型（新症/舊症）';
    if (!form.is_cgas && !form.is_eol) return '請至少選擇一個 CGAS / EOL';
    if (form.pharmacy_arrangement !== '個別取藥' && form.pharmacy_arrangement !== '集體取藥') return '請選擇藥房安排（個別/集體取藥）';
    // 診症日期必須對上 CGAT 到診日期清單（唔可以自行輸入），或者填未知
    if (isStaleVisitDate) return '所選診症日期已不在最新 CGAT 到診日期清單，請重新選擇日期，或勾選「未知」';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const payload = {
        patient_id: parseInt(form.patient_id),
        case_type: form.case_type as '新症' | '舊症',
        is_cgas: form.is_cgas,
        is_eol: form.is_eol,
        medication_end_date: form.medication_end_date || undefined,
        pharmacy_arrangement: form.pharmacy_arrangement as '個別取藥' | '集體取藥',
        is_urgent_medication: form.is_urgent_medication,
        reason_renew: form.reason_renew,
        reason_discharge: form.reason_discharge,
        reason_sign_letter: form.reason_sign_letter,
        reason_referral_letter: form.reason_referral_letter,
        reason_view_report: form.reason_view_report,
        report_bld: form.report_bld,
        report_xray: form.report_xray,
        report_ct: form.report_ct,
        report_usg: form.report_usg,
        report_other: form.report_other || undefined,
        cgat_visit_date: form.cgat_visit_unknown ? undefined : (form.cgat_visit_date || undefined),
        cgat_visit_unknown: form.cgat_visit_unknown,
        medication_pickup_arrangement: form.medication_pickup_arrangement as '家人前往' | '院舍代勞' | '每次詢問',
        fee_exempted: form.fee_exempted,
        consultation_fee: Number(form.consultation_fee) || 0,
        medication_fee_per_item: Number(form.medication_fee_per_item) || 0,
        prescription_count: form.prescription_count ?? undefined,
        treatment_weeks: form.treatment_weeks ?? undefined,
        total_fee: feeResult.skipped ? 0 : feeResult.total,
        remarks: form.remarks || undefined,
      };
      if (record) {
        await updateCgatRecord({ id: record.id, ...payload });
      } else {
        await addCgatRecord(payload);
      }
      onClose();
    } catch (e: any) {
      alert(`儲存失敗：${e?.message ?? '請重試'}`);
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (icon: React.ReactNode, text: string) => (
    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3 pb-2 border-b">{icon}{text}</h3>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{record ? '編輯 CGAT 記錄' : '新增 CGAT 記錄'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* ① 選擇院友 + 合資格檢查 */}
          <section>
            {sectionTitle(<User className="h-4 w-4 text-blue-600" />, '選擇院友')}
            <PatientAutocomplete value={form.patient_id} onChange={(id) => set({ patient_id: id })}
              showResidencyFilter defaultResidencyStatus="在住" ignoreStationFilter />
            {patient && (
              <div className="mt-3 bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
                {patient.入住類型 && (
                  <div><span className="text-gray-500">入住類型：</span>{patient.入住類型}</div>
                )}
                {patient.社會福利?.type && (
                  <div><span className="text-gray-500">社會福利：</span>{patient.社會福利.type}{patient.社會福利.subtype ? ` - ${patient.社會福利.subtype}` : ''}</div>
                )}
                {patient.公務員 && (
                  <div><span className="text-gray-500">公務員：</span>{patient.公務員}</div>
                )}
                <div className="pt-1">
                  {eligibility.eligible ? (
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded">
                      ✓ 合資格轄免收費人士（{eligibility.reasons.join('、')}）— 可跳過費用結算
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded">非合資格轄免收費人士</span>
                  )}
                </div>
                <label className="flex items-center gap-2 pt-2 cursor-pointer">
                  <input type="checkbox" checked={form.fee_exempted} onChange={(e) => set({ fee_exempted: e.target.checked })} />
                  <span>一次性豁免（勾選可跳過費用結算）</span>
                </label>
              </div>
            )}
          </section>

          {/* ② 個案類型 */}
          <section>
            {sectionTitle(<FileText className="h-4 w-4 text-blue-600" />, '個案類型')}
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-3">
                {(['新症', '舊症'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="case_type" checked={form.case_type === t} onChange={() => set({ case_type: t })} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 border-l pl-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.is_cgas} onChange={(e) => set({ is_cgas: e.target.checked })} />
                  <span>CGAS</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.is_eol} onChange={(e) => set({ is_eol: e.target.checked })} />
                  <span>EOL</span>
                </label>
              </div>
            </div>
          </section>

          {/* ③ 藥物配發 */}
          <section>
            {sectionTitle(<Pill className="h-4 w-4 text-blue-600" />, '藥物配發')}
            <div className="space-y-3">
              <div>
                <label className="form-label">藥完日期</label>
                <div className="flex gap-2">
                  <input type="date" className="form-input flex-1" value={form.medication_end_date}
                    onChange={(e) => set({ medication_end_date: e.target.value })} />
                </div>
                <div className="mt-2">
                  <CgatMedicationEndDateTable
                    patientId={form.patient_id}
                    selectedDate={form.medication_end_date}
                    onSelect={(d) => set({ medication_end_date: d })}
                  />
                </div>
                {form.medication_end_date && (
                  <p className="text-xs text-gray-600 mt-1">已選藥完日期：<span className="font-medium text-blue-600">{form.medication_end_date}</span></p>
                )}
              </div>
              <div>
                <label className="form-label">藥房安排 *</label>
                <div className="flex gap-4">
                  {(['個別取藥', '集體取藥'] as const).map(t => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="pharmacy_arrangement" checked={form.pharmacy_arrangement === t}
                        onChange={() => set({ pharmacy_arrangement: t })} />
                      <span>{t}</span>
                    </label>
                  ))}
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
                <input type="checkbox" checked={form.reason_discharge} onChange={(e) => set({ reason_discharge: e.target.checked })} /><span>出院</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_sign_letter} onChange={(e) => set({ reason_sign_letter: e.target.checked })} /><span>簽信</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_referral_letter} onChange={(e) => set({ reason_referral_letter: e.target.checked })} /><span>轉介信</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.reason_view_report} onChange={(e) => set({ reason_view_report: e.target.checked })} /><span>看報告</span>
              </label>
            </div>
            {form.reason_view_report && (
              <div className="mt-3 ml-2 pl-4 border-l space-y-2">
                <div className="flex flex-wrap gap-4">
                  {([['report_bld', 'Bld'], ['report_xray', 'X-Ray'], ['report_ct', 'CT'], ['report_usg', 'USG']] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form[key] as boolean} onChange={(e) => set({ [key]: e.target.checked } as any)} /><span>{label}</span>
                    </label>
                  ))}
                </div>
                <textarea className="form-input" rows={1} placeholder="其他（報告說明）" value={form.report_other}
                  onChange={(e) => set({ report_other: e.target.value })} />
              </div>
            )}
          </section>

          {/* ⑤ CGAT 到診安排 */}
          <section>
            {sectionTitle(<Calendar className="h-4 w-4 text-blue-600" />, 'CGAT 到診安排')}
            <div className="space-y-3">
              <div>
                <label className="form-label">CGAT 到診日期</label>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    {/* 診症日期只可以由到診日期清單揀，唔可以自行輸入；可填未知 */}
                    <div className={`form-input bg-gray-50 flex items-center ${isStaleVisitDate ? 'border-red-400 text-red-600' : 'text-gray-900'}`}>
                      {form.cgat_visit_unknown
                        ? <span className="text-red-600">未知</span>
                        : form.cgat_visit_date
                          ? <span>{form.cgat_visit_date}{isStaleVisitDate && '（已不在到診清單）'}</span>
                          : <span className="text-gray-400">未選擇</span>}
                    </div>
                  </div>
                  {!form.cgat_visit_unknown && (
                    <button type="button" onClick={() => setShowVisitPicker(true)} className="btn-secondary whitespace-nowrap">
                      選 CGAT 到診日期
                    </button>
                  )}
                  <label className="flex items-center gap-2 pb-2 cursor-pointer">
                    <input type="checkbox" checked={form.cgat_visit_unknown}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        set({ cgat_visit_unknown: checked, cgat_visit_date: checked ? '' : form.cgat_visit_date });
                      }} />
                    <span>未知</span>
                  </label>
                </div>
                {isStaleVisitDate && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    此日期已被刪除或更改，對不上最新到診日期清單，請重新選擇日期，或勾選「未知」。
                  </p>
                )}
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

          {/* ⑥ 費用結算 */}
          <section>
            {sectionTitle(<DollarSign className="h-4 w-4 text-blue-600" />, '費用結算')}
            {feeResult.skipped ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                跳過費用結算：{feeResult.skipReason}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="form-label text-xs">診金</label>
                    <input type="number" className="form-input" value={form.consultation_fee}
                      onChange={(e) => set({ consultation_fee: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="form-label text-xs">藥費（每處方）</label>
                    <input type="number" className="form-input" value={form.medication_fee_per_item}
                      onChange={(e) => set({ medication_fee_per_item: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="form-label text-xs">處方數量</label>
                    <input type="number" min={0} className="form-input" value={form.prescription_count ?? ''}
                      onChange={(e) => set({ prescription_count: e.target.value === '' ? undefined : (parseInt(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <label className="form-label text-xs">療程（周）</label>
                    <input type="number" min={0} className="form-input" value={form.treatment_weeks ?? ''}
                      onChange={(e) => set({ treatment_weeks: e.target.value === '' ? undefined : (parseInt(e.target.value) || 0) })} />
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>請留意自費藥物不應列作計算，請自行扣除。</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="text-gray-600">
                    診金 ${form.consultation_fee} + 處方數量 {form.prescription_count ?? 0} × 藥費 ${form.medication_fee_per_item} × 療程單位 {feeResult.units}（{form.treatment_weeks ?? 0} 周）
                  </div>
                  <div className="text-lg font-bold text-blue-700 mt-1">本次 CGAT 費用：HKD ${feeResult.total}</div>
                </div>
              </div>
            )}
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
            {record ? '更新記錄' : '建立記錄'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
        </div>
      </div>

      {showVisitPicker && (
        <CgatDoctorVisitPicker
          usedCountByDate={usedCountByDate}
          onSelect={(d) => { set({ cgat_visit_date: d }); setShowVisitPicker(false); }}
          onScheduleChanged={() => { refreshVisitDates(); }}
          onClose={() => setShowVisitPicker(false)}
        />
      )}
    </div>
  );
};

export default CgatModal;
