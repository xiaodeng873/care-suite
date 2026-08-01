import template from '../../../../doc_html/意外事件報告.html?raw';
import type { Patient, IncidentReport } from '../lib/database';
import { getPrintBedNumber } from './bedTransferUtils';
import { formatDisplayDate, calculateAge } from './dateFormat';

function formatTime(value: string | undefined | null): string {
  if (!value) return '';
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function escapeHtml(text: string | number | boolean | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFieldValue(report: IncidentReport, patient: Patient, field: string): string {
  switch (field) {
    case 'patient_name':
      return patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`.trim();
    case 'gender':
      return patient.性別 || '';
    case 'age':
      return calculateAge(patient.出生日期)?.toString() || '';
    case 'id_number':
      return patient.身份證號碼 || '';
    case 'bed_number':
      return getPrintBedNumber(patient);

    case 'incident_date':
      return formatDisplayDate(report.incident_date);
    case 'incident_time':
      return formatTime(report.incident_time);
    case 'other_incident_type':
      return report.other_incident_type || '';
    case 'other_location':
      return report.other_location || '';
    case 'other_patient_activity':
      return report.other_patient_activity || '';
    case 'incident_details':
      return report.incident_details || '';

    case 'treatment_date':
      return formatDisplayDate(report.treatment_date);
    case 'treatment_time':
      return formatTime(report.treatment_time);
    case 'bp_systolic':
      return report.vital_signs?.blood_pressure_systolic?.toString() || '';
    case 'bp_diastolic':
      return report.vital_signs?.blood_pressure_diastolic?.toString() || '';
    case 'pulse':
      return report.vital_signs?.pulse?.toString() || '';
    case 'respiration':
      return report.vital_signs?.respiration?.toString() || '';
    case 'temperature':
      return report.vital_signs?.temperature?.toString() || '';
    case 'oxygen_saturation':
      return report.vital_signs?.oxygen_saturation?.toString() || '';
    case 'blood_sugar':
      return report.vital_signs?.blood_sugar?.toString() || '';

    case 'patient_complaint':
      return report.patient_complaint || '';
    case 'ambulance_call_time':
      return formatTime(report.ambulance_call_time);
    case 'ambulance_arrival_time':
      return formatTime(report.ambulance_arrival_time);
    case 'ambulance_departure_time':
      return formatTime(report.ambulance_departure_time);
    case 'hospital_destination':
      return report.hospital_destination || '';

    case 'family_notification_date':
      return formatDisplayDate(report.family_notification_date);
    case 'family_notification_time':
      return formatTime(report.family_notification_time);
    case 'family_name':
      return report.family_name || '';
    case 'other_family_relationship':
      return report.other_family_relationship || '';
    case 'contact_phone':
      return report.contact_phone || '';
    case 'notifying_staff_name':
      return report.notifying_staff_name || '';
    case 'notifying_staff_position':
      return report.notifying_staff_position || '';
    case 'return_time':
      return formatTime(report.return_time);

    case 'hospital_treatment_other':
      return report.hospital_treatment?.['其他治療說明'] || '';
    case 'hospital_floor':
      return report.hospital_admission?.floor || '';
    case 'hospital_ward':
      return report.hospital_admission?.ward || '';
    case 'hospital_bed_number':
      return report.hospital_admission?.bed_number || '';
    case 'hospital_name':
      return report.hospital_admission?.hospital || '';

    case 'immediate_improvement_actions':
      return report.immediate_improvement_actions || '';
    case 'prevention_methods':
      return report.prevention_methods || '';

    case 'reporter_signature':
      return report.reporter_signature || '';
    case 'reporter_signature_name':
      return report.reporter_signature || '';
    case 'reporter_position':
      return report.reporter_position || '';
    case 'report_date':
      return formatDisplayDate(report.report_date);
    case 'director_review_date':
      return formatDisplayDate(report.director_review_date);
    case 'director_review_signature':
      return '';

    case 'physical_discomfort_other':
      return report.physical_discomfort?.['其他說明'] || '';
    case 'unsafe_behavior_action':
      return report.unsafe_behavior?.['不安全的動作說明'] || '';
    case 'unsafe_behavior_other':
      return report.unsafe_behavior?.['其他說明'] || '';
    case 'environmental_factors_other':
      return report.environmental_factors?.['其他說明'] || '';
    case 'immediate_treatment_other':
      return report.immediate_treatment?.['其他說明'] || '';
    case 'bruise_location':
      return report.injury_situation?.['瘀腫位置'] || '';
    case 'fracture_location':
      return report.injury_situation?.['骨折位置'] || '';
    case 'injury_other':
      return report.injury_situation?.['其他位置'] || report.injury_situation?.['其他說明'] || '';
    case 'limb_details':
      return report.limb_movement?.details || '';

    default:
      return '';
  }
}

function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function evaluateCheckbox(report: IncidentReport, path: string, value: string): boolean {
  const rawValue = getValueByPath(report, path);

  if (rawValue === undefined || rawValue === null) return false;

  if (typeof rawValue === 'boolean') {
    return rawValue === (value === 'true');
  }

  if (Array.isArray(rawValue)) {
    return rawValue.includes(value);
  }

  if (typeof rawValue === 'object') {
    return rawValue[value] === true;
  }

  return String(rawValue) === value;
}

function splitTextIntoLines(text: string, maxLineLength: number): string[] {
  if (text.length <= maxLineLength) return [text];
  // 按中文標點切分後再合併，避免在詞語中間斷行
  const segments = text.split(/(?<=[。，、；：])/g).filter(s => s);
  const lines: string[] = [];
  let current = '';
  for (const segment of segments) {
    if ((current + segment).length > maxLineLength && current) {
      lines.push(current);
      current = segment;
    } else {
      current += segment;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderLines(text: string, _minLines = 6, _maxLineLength = 48): string {
  return escapeHtml(text || '');
}

export function generateIncidentReportHtml(
  report: IncidentReport,
  patient: Patient,
  facilityName: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, 'text/html');

  const h1 = doc.querySelector('.header-center h1');
  if (h1) h1.textContent = facilityName;

  doc.querySelectorAll('[data-field]').forEach(el => {
    const field = el.getAttribute('data-field');
    if (!field) return;
    el.textContent = escapeHtml(getFieldValue(report, patient, field));
  });

  doc.querySelectorAll('[data-cb]').forEach(el => {
    const raw = el.getAttribute('data-cb');
    if (!raw) return;
    const separatorIndex = raw.indexOf(':');
    if (separatorIndex === -1) return;
    const path = raw.slice(0, separatorIndex);
    const value = raw.slice(separatorIndex + 1);
    const checked = evaluateCheckbox(report, path, value);
    el.textContent = checked ? '☑' : '☐';
  });

  doc.querySelectorAll('[data-lines]').forEach(el => {
    const field = el.getAttribute('data-lines');
    if (!field) return;
    const text = getFieldValue(report, patient, field);
    const textEl = el.querySelector('.lines-text');
    if (textEl) {
      textEl.innerHTML = renderLines(text);
    }
  });

  const serializer = new XMLSerializer();
  return `<!DOCTYPE html>\n${serializer.serializeToString(doc.documentElement)}`;
}
