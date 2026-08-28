/**
 * CGAT 診症摘要列印產生器
 * 為已選 CGAT 記錄的每位院友產生 2 頁 A4 直向 HTML 摘要。
 */

import { supabase } from '../lib/supabase';
import type {
  CgatRecord,
  Patient,
  HealthRecord,
  MedicationPrescription,
  FollowUpAppointment,
  PatientAdmissionRecord,
} from '../lib/database';
import { printGroupedHtml } from './printUtils';
import { formatDisplayDate, calculateAge } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';
import { getFacilitySettings } from './facilitySettings';

// medication_workflow_records 在 DB 介面未帶 inspection_check_result，本地擴充
type WorkflowRecordWithInspection = {
  id: string;
  prescription_id: string;
  patient_id: number;
  scheduled_date: string;
  scheduled_time: string;
  dispensing_status: 'pending' | 'completed' | 'failed';
  dispensing_failure_reason?: string;
  custom_failure_reason?: string;
  inspection_check_result?: {
    canDispense?: boolean;
    blockedRules?: Array<{
      vital_sign_type: string;
      condition_operator: string;
      condition_value: number;
      actual_value: number;
      action_if_met?: string;
    }>;
    usedVitalSignData?: Record<string, number>;
    missingVitalSigns?: string[];
  } | string;
  notes?: string;
};

type EpisodeEvent = {
  id: string;
  episode_id: string;
  event_type: string;
  event_date?: string;
  event_time?: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  remarks?: string;
};

type HospitalEpisode = {
  id: string;
  patient_id: number;
  episode_start_date?: string;
  episode_end_date?: string;
  status?: string;
  primary_hospital?: string;
  primary_ward?: string;
  primary_bed_number?: string;
  discharge_type?: string;
  discharge_destination?: string;
  remarks?: string;
  episode_events?: EpisodeEvent[];
};

export interface CgatSummaryInput {
  records: CgatRecord[];
  patients: Patient[];
  facilityName?: string;
}

const VITAL_TYPES: Array<'血壓' | '脈搏' | '血含氧量' | '呼吸' | '血糖值' | '體重'> = [
  '血壓',
  '脈搏',
  '血含氧量',
  '呼吸',
  '血糖值',
  '體重',
];

const MAX_VITAL_ROWS = 26;
const CGAT_SUMMARY_IFRAME_ID = 'cgat-summary-print-iframe';

function escapeHtml(text: string | number | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function halfYearRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  start.setDate(1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function withinRange(dateStr: string, range: { start: string; end: string }): boolean {
  return dateStr >= range.start && dateStr <= range.end;
}

function isPrescriptionActive(p: MedicationPrescription): boolean {
  if (p.status !== 'active') return false;
  const today = new Date().toISOString().split('T')[0];
  if (p.end_date && p.end_date < today) return false;
  if (!p.end_date && p.estimated_end_date && p.estimated_end_date < today) return false;
  return true;
}

function getPatientPhotoHtml(patient: Patient): string {
  if (patient.院友相片) {
    return `<img src="${escapeHtml(patient.院友相片)}" alt="院友相片" style="max-width:100%;max-height:100%;object-fit:cover;" />`;
  }
  return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:9px;">無相片</div>';
}

function getPatientName(patient: Patient): string {
  return `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`.trim() || patient.英文姓名 || '';
}

function parseInspectionResult(
  record: WorkflowRecordWithInspection,
): NonNullable<WorkflowRecordWithInspection['inspection_check_result']> | null {
  if (!record.inspection_check_result) return null;
  if (typeof record.inspection_check_result === 'string') {
    try {
      return JSON.parse(record.inspection_check_result);
    } catch {
      return null;
    }
  }
  return record.inspection_check_result;
}

async function fetchSummaryData(patientIds: number[], range: { start: string; end: string }) {
  const [
    { data: healthData },
    { data: prescriptionData },
    { data: followUpData },
    { data: admissionData },
    { data: episodeData },
    { data: workflowData },
  ] = await Promise.all([
    supabase
      .from('健康監測記錄')
      .select('*')
      .in('院友id', patientIds)
      .gte('記錄日期', range.start)
      .lte('記錄日期', range.end)
      .in('監測類型', VITAL_TYPES)
      .order('記錄日期', { ascending: false })
      .order('記錄時間', { ascending: false }),
    supabase.from('new_medication_prescriptions').select('*').in('patient_id', patientIds).order('prescription_date', { ascending: false }),
    supabase.from('覆診安排主表').select('*').in('院友id', patientIds).order('覆診日期', { ascending: true }),
    supabase.from('patient_admission_records').select('*').in('patient_id', patientIds).order('event_date', { ascending: false }),
    supabase.from('hospital_episodes').select('*, episode_events(*)').in('patient_id', patientIds).order('episode_start_date', { ascending: false }),
    supabase
      .from('medication_workflow_records')
      .select('*')
      .in('patient_id', patientIds)
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end)
      .eq('dispensing_status', 'failed')
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false }),
  ]);

  return {
    healthRecords: (healthData || []) as HealthRecord[],
    prescriptions: (prescriptionData || []) as MedicationPrescription[],
    followUps: (followUpData || []) as FollowUpAppointment[],
    admissions: (admissionData || []) as PatientAdmissionRecord[],
    episodes: (episodeData || []) as HospitalEpisode[],
    workflowRecords: (workflowData || []) as WorkflowRecordWithInspection[],
  };
}

function buildVitalSetSection(records: HealthRecord[], range: { start: string; end: string }): string {
  const bpRecords = records.filter((r) => r.監測類型 === '血壓' && withinRange(r.記錄日期, range));
  const pulseRecords = records.filter((r) => r.監測類型 === '脈搏' && withinRange(r.記錄日期, range));
  const spo2Records = records.filter((r) => r.監測類型 === '血含氧量' && withinRange(r.記錄日期, range));
  const respRecords = records.filter((r) => r.監測類型 === '呼吸' && withinRange(r.記錄日期, range));

  const allTimestamps = new Set<string>();
  for (const r of [bpRecords, pulseRecords, spo2Records, respRecords].flat()) {
    allTimestamps.add(`${r.記錄日期} ${r.記錄時間 || ''}`);
  }
  const sortedTimestamps = Array.from(allTimestamps)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_VITAL_ROWS);

  if (sortedTimestamps.length === 0) {
    return `<div class="card"><div class="section-title">生命表徵（血壓、脈搏、血氧、呼吸）</div><div class="muted">無記錄</div></div>`;
  }

  const findValue = (list: HealthRecord[], ts: string) => {
    const r = list.find((x) => `${x.記錄日期} ${x.記錄時間 || ''}` === ts);
    if (!r) return '';
    if (r.監測類型 === '血壓') return `${r.數值}/${r.數值_副 || '-'}`;
    return String(r.數值);
  };

  const rows = sortedTimestamps
    .map((ts) => {
      const [datePart, timePart] = ts.split(' ');
      return `<tr>
        <td class="dt-cell">${escapeHtml(formatShortDate(datePart))}</td>
        <td class="dt-cell">${escapeHtml(formatTimeHHMM(timePart))}</td>
        <td>${escapeHtml(findValue(bpRecords, ts))}</td>
        <td>${escapeHtml(findValue(pulseRecords, ts))}</td>
        <td>${escapeHtml(findValue(spo2Records, ts))}</td>
        <td>${escapeHtml(findValue(respRecords, ts))}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="card">
      <div class="section-title">生命表徵（血壓、脈搏、血氧、呼吸）</div>
      <table class="data-table compact vital-table">
        <thead><tr><th>日期</th><th>時間</th><th>血壓</th><th>脈搏</th><th>血氧</th><th>呼吸</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildBloodSugarSection(records: HealthRecord[], range: { start: string; end: string }): string {
  const list = records
    .filter((r) => r.監測類型 === '血糖值' && withinRange(r.記錄日期, range))
    .sort((a, b) => `${b.記錄日期} ${b.記錄時間 || ''}`.localeCompare(`${a.記錄日期} ${a.記錄時間 || ''}`))
    .slice(0, MAX_VITAL_ROWS);

  if (list.length === 0) {
    return '';
  }

  const rows = list
    .map((r) => `<tr><td class="dt-cell">${escapeHtml(formatShortDate(r.記錄日期))}</td><td class="dt-cell">${escapeHtml(formatTimeHHMM(r.記錄時間))}</td><td>${escapeHtml(r.數值)}</td></tr>`)
    .join('');

  return `
    <div class="card">
      <div class="section-title">血糖記錄</div>
      <table class="data-table compact vital-table">
        <thead><tr><th>日期</th><th>時間</th><th>血糖</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildWeightSection(records: HealthRecord[], range: { start: string; end: string }): string {
  const list = records
    .filter((r) => r.監測類型 === '體重' && withinRange(r.記錄日期, range))
    .sort((a, b) => `${b.記錄日期} ${b.記錄時間 || ''}`.localeCompare(`${a.記錄日期} ${a.記錄時間 || ''}`))
    .slice(0, MAX_VITAL_ROWS);

  if (list.length === 0) {
    return `<div class="card"><div class="section-title">體重記錄</div><div class="muted">無記錄</div></div>`;
  }

  const rows = list
    .map((r) => `<tr><td class="dt-cell">${escapeHtml(formatShortDate(r.記錄日期))}</td><td class="dt-cell">${escapeHtml(formatTimeHHMM(r.記錄時間))}</td><td>${escapeHtml(r.數值)}</td></tr>`)
    .join('');

  return `
    <div class="card">
      <div class="section-title">體重記錄</div>
      <table class="data-table compact vital-table">
        <thead><tr><th>日期</th><th>時間</th><th>體重</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildPrescriptionsSection(prescriptions: MedicationPrescription[]): string {
  const active = prescriptions.filter(isPrescriptionActive);
  if (active.length === 0) {
    return `<div class="section-title">現時在服處方</div><div class="muted">無記錄</div>`;
  }
  const rows = active
    .map((p) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(p.prescription_date))}</td>
        <td>${escapeHtml(p.medication_name)}</td>
        <td style="text-align:center;">${p.is_prn ? 'PRN' : ''}</td>
        <td>${escapeHtml(p.medication_source)}${p.medication_source_specialty ? ` / ${escapeHtml(p.medication_source_specialty)}` : ''}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="section-title">現時在服處方</div>
    <table class="data-table compact">
      <thead><tr><th>處方日期</th><th>藥物名稱</th><th>PRN</th><th>藥物來源</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildFollowUpsSection(followUps: FollowUpAppointment[]): string {
  const unfinished = followUps.filter((f) => f.狀態 !== '已完成' && f.狀態 !== '取消');
  if (unfinished.length === 0) {
    return `<div class="section-title">未完成覆診</div><div class="muted">無記錄</div>`;
  }
  const rows = unfinished
    .map((f) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(f.覆診日期))}</td>
        <td>${escapeHtml(f.覆診地點 || '')}</td>
        <td>${escapeHtml(f.覆診專科 || '')}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="section-title">未完成覆診</div>
    <table class="data-table compact">
      <thead><tr><th>覆診日期</th><th>覆診地點</th><th>專科</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildAdmissionsSection(
  admissions: PatientAdmissionRecord[],
  episodes: HospitalEpisode[],
  range: { start: string; end: string },
): string {
  const items: Array<{
    date: string;
    event: string;
    hospital: string;
    dischargeDate?: string;
    remarks?: string;
  }> = [];

  const eventLabels: Record<string, string> = {
    hospital_admission: '入院',
    hospital_discharge: '出院',
    transfer_out: '轉院',
  };

  for (const a of admissions) {
    if (withinRange(a.event_date, range)) {
      items.push({
        date: a.event_date,
        event: eventLabels[a.event_type] || a.event_type,
        hospital: [a.hospital_name, a.hospital_ward].filter(Boolean).join(' / '),
        dischargeDate: a.event_type === 'hospital_discharge' ? a.event_date : undefined,
        remarks: a.remarks,
      });
    }
  }

  for (const e of episodes) {
    const start = e.episode_start_date;
    const end = e.episode_end_date;
    if ((start && withinRange(start, range)) || (end && withinRange(end, range))) {
      items.push({
        date: start || end || '',
        event: '住院療程',
        hospital: [e.primary_hospital, e.primary_ward].filter(Boolean).join(' / '),
        dischargeDate: end,
        remarks: e.remarks,
      });
    }
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  if (items.length === 0) {
    return `<div class="section-title">入/轉/出院記錄（最近半年）</div><div class="muted">無記錄</div>`;
  }

  const rows = items
    .map((i) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(i.date))}</td>
        <td>${escapeHtml(i.event)}</td>
        <td>${escapeHtml(i.hospital)}</td>
        <td>${escapeHtml(i.dischargeDate ? formatDisplayDate(i.dischargeDate) : '')}</td>
        <td>${escapeHtml(i.remarks || '')}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="section-title">入/轉/出院記錄（最近半年）</div>
    <table class="data-table compact">
      <thead><tr><th>日期</th><th>事件</th><th>醫院/病房</th><th>出院日期</th><th>備註</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildInspectionHoldSection(
  workflowRecords: WorkflowRecordWithInspection[],
  prescriptions: MedicationPrescription[],
): string {
  const prescriptionMap = new Map(prescriptions.map((p) => [p.id, p]));
  const items: Array<{
    date: string;
    drugName: string;
    dose: string;
    reason: string;
    valueText: string;
  }> = [];

  for (const r of workflowRecords) {
    const result = parseInspectionResult(r) as any;
    if (!result || result.canDispense !== false || !result.blockedRules || result.blockedRules.length === 0) continue;
    const p = prescriptionMap.get(r.prescription_id);
    for (const rule of result.blockedRules) {
      items.push({
        date: r.scheduled_date,
        drugName: p?.medication_name || '未知藥物',
        dose: [p?.dosage_amount, p?.dosage_unit].filter(Boolean).join(' ') || '',
        reason: rule.action_if_met === 'block_dispensing' ? '檢測數值不合格' : '檢測規則觸發',
        valueText: `${rule.vital_sign_type}: ${rule.actual_value}（條件 ${rule.condition_operator} ${rule.condition_value}）`,
      });
    }
  }

  if (items.length === 0) {
    return `<div class="section-title">檢測項停服記錄</div><div class="muted">無記錄</div>`;
  }

  const rows = items
    .map((i) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(i.date))}</td>
        <td>${escapeHtml(i.drugName)}</td>
        <td>${escapeHtml(i.dose)}</td>
        <td>${escapeHtml(i.reason)}</td>
        <td>${escapeHtml(i.valueText)}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="section-title">檢測項停服記錄</div>
    <table class="data-table compact">
      <thead><tr><th>日期</th><th>藥物名稱</th><th>劑量</th><th>停服原因</th><th>當時數值</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function isCgatSource(source?: string, specialty?: string): boolean {
  if (!source && !specialty) return false;
  const normalizedSource = (source || '').toLowerCase();
  const normalizedSpecialty = (specialty || '').toLowerCase();
  return ['cgat', '社區', '老人', '評估', 'cga'].some(
    (s) => normalizedSource.includes(s) || normalizedSpecialty.includes(s),
  );
}

function isPrnPrescriptionActive(p: MedicationPrescription): boolean {
  return p.status === 'active';
}

function buildPrnSection(prescriptions: MedicationPrescription[]): string {
  const prns = prescriptions.filter(
    (p) =>
      p.is_prn &&
      isPrnPrescriptionActive(p),
  );

  if (prns.length === 0) {
    return `<div class="section-title">PRN 藥物</div><div class="muted">無記錄</div>`;
  }

  const rows = prns
    .map((p) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(p.prescription_date))}</td>
        <td>${escapeHtml(p.medication_name)}</td>
        <td style="text-align:center;">${p.is_prn ? 'PRN' : ''}</td>
        <td>${escapeHtml(p.medication_source)}${p.medication_source_specialty ? ` / ${escapeHtml(p.medication_source_specialty)}` : ''}</td>
        <td><input type="checkbox"></td>
        <td><input type="checkbox"></td>
      </tr>`;
    })
    .join('');

  return `
    <div class="section-title">PRN 藥物（需要補充 / 使用庫存）</div>
    <table class="data-table compact">
      <thead><tr><th>處方日期</th><th>藥物名稱</th><th>PRN</th><th>藥物來源</th><th>需要補充</th><th>使用庫存</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildPrnChangeSection(prescriptions: MedicationPrescription[]): string {
  const nonPrn = prescriptions.filter((p) => isPrescriptionActive(p) && !p.is_prn);
  if (nonPrn.length === 0) {
    return `<div class="section-title">申請改為 PRN 之藥物</div><div class="muted">無記錄</div>`;
  }
  const rows = nonPrn
    .map((p) => {
      return `<tr>
        <td>${escapeHtml(formatDisplayDate(p.prescription_date))}</td>
        <td>${escapeHtml(p.medication_name)}</td>
        <td style="text-align:center;">${p.is_prn ? 'PRN' : ''}</td>
        <td>${escapeHtml(p.medication_source)}${p.medication_source_specialty ? ` / ${escapeHtml(p.medication_source_specialty)}` : ''}</td>
        <td style="text-align:center;"><input type="checkbox"></td>
      </tr>`;
    })
    .join('');

  return `
    <div class="section-title">申請改為 PRN 之藥物</div>
    <table class="data-table compact">
      <thead><tr><th>處方日期</th><th>藥物名稱</th><th>PRN</th><th>藥物來源</th><th>申請改為 PRN</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildHandwrittenSection(title: string): string {
  return `
    <div class="section-title">${title}</div>
    <div class="handwritten-line"></div>
    <div class="handwritten-line"></div>
  `;
}

function formatSingleLine(items: string[]): string {
  if (!items || items.length === 0) return '無';
  return items.filter(Boolean).join('、');
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatTimeHHMM(timeStr?: string): string {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function buildPatientHeader(patient: Patient, facilityName: string): string {
  const age = patient.出生日期 ? calculateAge(patient.出生日期) : null;
  const allergies = formatSingleLine(patient.藥物敏感 || []);
  const adverseReactions = formatSingleLine(patient.不良藥物反應 || []);
  return `
    <div class="patient-header card">
      <div class="patient-photo">${getPatientPhotoHtml(patient)}</div>
      <div class="patient-main">
        <div class="patient-info-grid">
          <div class="info-row"><span class="label">院舍：</span>${escapeHtml(facilityName)}</div>
          <div class="info-row"><span class="label">姓名：</span>${escapeHtml(getPatientName(patient))}</div>
          <div class="info-row"><span class="label">床號：</span>${escapeHtml(getPrintBedNumber(patient))}</div>
          <div class="info-row"><span class="label">性別：</span>${escapeHtml(patient.性別 || '')}</div>
          <div class="info-row"><span class="label">身份證：</span>${escapeHtml(patient.身份證號碼 || '')}</div>
          <div class="info-row"><span class="label">出生日期：</span>${escapeHtml(patient.出生日期 ? `${formatShortDate(patient.出生日期)} (${age}歲)` : '')}</div>
        </div>
        <div class="allergy-row"><span class="label">藥物敏感：</span>${escapeHtml(allergies)}</div>
        <div class="allergy-row"><span class="label">不良藥物反應：</span>${escapeHtml(adverseReactions)}</div>
      </div>
    </div>
  `;
}

function buildPageStyles(): string {
  return `
    <style>
      @page { size: A4 portrait; margin: 3mm; }
      * { box-sizing: border-box; }
      body {
        font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", sans-serif;
        font-size: 8px;
        line-height: 1.25;
        color: #000;
        margin: 0;
        padding: 0;
      }
      .print-page {
        width: 100%;
        page-break-after: always;
      }
      .print-page:last-child { page-break-after: auto; }
      h1 { font-size: 12px; text-align: center; margin: 0 0 2px 0; }
      .card {
        border: 0.5px solid #999;
        border-radius: 2px;
        padding: 2px 3px;
        margin-bottom: 2px;
        break-inside: avoid;
      }
      .patient-header {
        display: flex;
        gap: 6px;
        break-inside: avoid;
      }
      .patient-photo {
        width: 42px;
        height: 50px;
        border: 0.5px solid #999;
        flex-shrink: 0;
        overflow: hidden;
      }
      .patient-main {
        flex: 1;
        min-width: 0;
      }
      .patient-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0 6px;
        margin-bottom: 1px;
      }
      .allergy-row {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 7.5px;
      }
      .info-row { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 7.5px; }
      .label { font-weight: bold; }
      .section-title {
        font-weight: bold;
        font-size: 8.5px;
        margin-bottom: 1px;
        border-bottom: 0.5px solid #666;
      }
      .two-col { display: flex; gap: 3px; }
      .two-col .col { width: 50%; min-width: 50%; }
      .three-col { display: flex; gap: 2px; }
      .three-col .col { flex: 1; min-width: 0; }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .data-table th, .data-table td {
        border: 0.5px solid #666;
        padding: 0.5px 2px;
        text-align: left;
        vertical-align: top;
      }
      .data-table th {
        background: #f2f2f2;
        font-weight: bold;
      }
      .data-table.compact th, .data-table.compact td { padding: 0.5px 2px; font-size: 7.5px; }
      .vital-table th:nth-child(1), .vital-table td:nth-child(1) { width: 14%; }
      .vital-table th:nth-child(2), .vital-table td:nth-child(2) { width: 12%; }
      .vital-table th:nth-child(3), .vital-table td:nth-child(3),
      .vital-table th:nth-child(4), .vital-table td:nth-child(4),
      .vital-table th:nth-child(5), .vital-table td:nth-child(5),
      .vital-table th:nth-child(6), .vital-table td:nth-child(6) { width: 16%; }
      .dt-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .muted { color: #9ca3af; font-size: 7.5px; }
      .handwritten-line {
        border-bottom: 0.5px solid #999;
        height: 22px;
        margin-bottom: 2px;
      }
      .section { break-inside: avoid; margin-bottom: 2px; }
      input[type="checkbox"] { width: 12px; height: 12px; margin: 0; }
    </style>
  `;
}

async function buildPatientPages(
  patient: Patient,
  records: CgatRecord[],
  data: Awaited<ReturnType<typeof fetchSummaryData>>,
  facilityName: string,
  range: { start: string; end: string },
): Promise<string> {
  const healthRecords = data.healthRecords.filter((r) => r.院友id === patient.院友id);
  const prescriptions = data.prescriptions.filter((p) => p.patient_id === patient.院友id);
  const followUps = data.followUps.filter((f) => f.院友id === patient.院友id);
  const admissions = data.admissions.filter((a) => a.patient_id === patient.院友id);
  const episodes = data.episodes.filter((e) => e.patient_id === patient.院友id);
  const workflowRecords = data.workflowRecords.filter((r) => r.patient_id === patient.院友id);

  const header = buildPatientHeader(patient, facilityName);
  const styles = buildPageStyles();

  const bloodSugarSection = buildBloodSugarSection(healthRecords, range);
  const inspectionSection = buildInspectionHoldSection(workflowRecords, prescriptions);
  const page = `
    ${styles}
    <div class="print-page">
      <h1>CGAT 診症摘要</h1>
      ${header}
      <div class="three-col section">
        <div class="col">${buildVitalSetSection(healthRecords, range)}</div>
        <div class="col">${bloodSugarSection || '<div class="card"><div class="section-title">血糖記錄</div><div class="muted">無記錄</div></div>'}</div>
        <div class="col">${buildWeightSection(healthRecords, range)}</div>
      </div>
      <div class="section">${buildPrescriptionsSection(prescriptions)}</div>
      <div class="section">${buildFollowUpsSection(followUps)}</div>
      <div class="section">${buildAdmissionsSection(admissions, episodes, range)}</div>
      <div class="section">${inspectionSection}</div>
      <div class="section">${buildPrnSection(prescriptions)}</div>
      <div class="section">${buildPrnChangeSection(prescriptions)}</div>
      <div class="section">${buildHandwrittenSection('備註')}</div>
    </div>
  `;

  return page;
}

export async function printCgatSummary(input: CgatSummaryInput): Promise<void> {
  const { records, patients } = input;
  if (records.length === 0) {
    alert('請先選擇要列印的 CGAT 記錄');
    return;
  }

  const patientMap = new Map(patients.map((p) => [p.院友id, p]));
  const grouped = new Map<number, CgatRecord[]>();
  for (const r of records) {
    const list = grouped.get(r.patient_id) || [];
    list.push(r);
    grouped.set(r.patient_id, list);
  }

  const patientIds = Array.from(grouped.keys());
  const missingPatients = patientIds.filter((id) => !patientMap.has(id));
  if (missingPatients.length > 0) {
    console.warn('[printCgatSummary] 找不到院友資料:', missingPatients);
  }

  const range = halfYearRange();
  const data = await fetchSummaryData(patientIds, range);

  const facilitySettings = await getFacilitySettings().catch(() => null);
  const facilityName = input.facilityName || facilitySettings?.facilityNameZh || '';

  const pages: string[] = [];
  for (const patientId of patientIds) {
    const patient = patientMap.get(patientId);
    if (!patient) continue;
    const patientRecords = grouped.get(patientId) || [];
    const page = await buildPatientPages(patient, patientRecords, data, facilityName, range);
    pages.push(page);
  }

  if (pages.length === 0) {
    alert('無法產生摘要：找不到對應院友資料');
    return;
  }

  printGroupedHtml(pages, CGAT_SUMMARY_IFRAME_ID);
}
