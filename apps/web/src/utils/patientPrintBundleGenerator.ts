import type {
  Patient,
  HealthAssessment,
  FollowUpAppointment,
  IncidentReport,
  PatientRestraintAssessment,
  PatientLog,
  Wound,
  MedicationPrescription,
} from '../lib/database';
import { getFacilitySettings } from './facilitySettings';
import { PRINT_DOCUMENTS } from '../components/PatientPrintModal';

// ─── Types ────────────────────────────────────────────────────────────────────

/** 列印內容模式：basic=含院友基本資料, data=含既有輸入內容, blank=空白文件 */
export type PrintContentMode = 'basic' | 'data' | 'blank';

export interface PrintBundleOptions {
  patients: Patient[];
  documentIds: string[];
  startDate: string;
  endDate: string;
  contentMode: PrintContentMode;
}

export interface DocumentGeneratorContext {
  patient: Patient;
  startDate: string;
  endDate: string;
  facilityName: string;
  logoDataUri: string | null;
  contentMode: PrintContentMode;
}

type DocumentGenerator = (ctx: DocumentGeneratorContext) => Promise<string>;

// ─── 工具 ────────────────────────────────────────────────────────────────────

/** 空白文件模式：只保留院友id（供內部分組），其餘識別欄位全部留空 */
const stripPatient = (patient: Patient): Patient =>
  ({ 院友id: patient.院友id } as unknown as Patient);

/** 按模式取得要填入表格的院友物件（blank 模式為去識別版本） */
const ctxPatient = (ctx: DocumentGeneratorContext): Patient =>
  ctx.contentMode === 'blank' ? stripPatient(ctx.patient) : ctx.patient;

/** 空白/基本資料模式的 worksheet 選項 */
const worksheetOptions = (ctx: DocumentGeneratorContext) => ({
  includeData: ctx.contentMode === 'data',
  blankHeader: ctx.contentMode === 'blank',
});

// ─── Generator 註冊表 ───────────────────────────────────────────────────────

const generatorRegistry: Record<string, DocumentGenerator> = {};

export function registerDocumentGenerator(id: string, generator: DocumentGenerator): void {
  generatorRegistry[id] = generator;
}

async function getGenerator(id: string): Promise<DocumentGenerator | null> {
  if (generatorRegistry[id]) return generatorRegistry[id];

  try {
    switch (id) {
      case 'personal_health_record': {
        const mod = await import('./docHtmlGenerators/personalHealthRecordGenerator');
        return mod.generatePersonalHealthRecordHtml;
      }
      case 'nursing_assessment': {
        const mod = await import('./docHtmlGenerators/nursingAssessmentGenerator');
        return mod.generateNursingAssessmentHtml;
      }
      case 'vital_signs_record': {
        const mod = await import('./bloodPressureRecordWorksheetGenerator');
        return async (ctx) => {
          return mod.generateBloodPressureRecordHtml(ctx.startDate, ctx.endDate, [ctx.patient.院友id], worksheetOptions(ctx));
        };
      }
      case 'health_assessment': {
        const mod = await import('./healthAssessmentPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateHealthAssessmentHtml({} as HealthAssessment, patient, ctx.facilityName, ctx.logoDataUri);
          }
          const db = await import('../lib/database');
          const all = await db.getHealthAssessments('all');
          const mine = (all || []).filter(a => a.patient_id === ctx.patient.院友id);
          if (mine.length === 0) return '';
          mine.sort((a, b) => (b.assessment_date || '').localeCompare(a.assessment_date || ''));
          return mod.generateHealthAssessmentHtml(mine[0], patient, ctx.facilityName, ctx.logoDataUri);
        };
      }
      case 'er_record': {
        const mod = await import('./erRecordPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankEpisode = { patient_id: ctx.patient.院友id } as any;
            return mod.generateERRecordFormsHtml([blankEpisode], [patient], ctx.facilityName);
          }
          const db = await import('../lib/database');
          const episodes = await db.getHospitalEpisodes();
          const filtered = (episodes || []).filter(e => {
            if (e.patient_id !== ctx.patient.院友id) return false;
            const d = e.episode_start_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateERRecordFormsHtml(filtered, [patient], ctx.facilityName);
        };
      }
      case 'follow_up_record': {
        const mod = await import('./followUpRecordPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankAppointment = { 院友id: ctx.patient.院友id } as FollowUpAppointment;
            return mod.generateFollowUpRecordFormsHtml([blankAppointment], [patient], ctx.logoDataUri || '', ctx.facilityName);
          }
          const db = await import('../lib/database');
          const appointments = await db.getFollowUps();
          const filtered = (appointments || []).filter(a => {
            if (a.院友id !== ctx.patient.院友id) return false;
            const d = a.覆診日期 || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateFollowUpRecordFormsHtml(filtered, [patient], ctx.logoDataUri || '', ctx.facilityName);
        };
      }
      case 'restraint_usage':
      case 'restraint_usage_common': {
        const mod = await import('./restraintUsageRecordPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateRestraintUsageRecordHtml([], patient, ctx.facilityName);
          }
          const db = await import('../lib/database');
          const assessments = await db.getRestraintAssessments();
          const filtered = (assessments || []).filter(a => {
            if (a.patient_id !== ctx.patient.院友id) return false;
            const d = a.usage_record?.start_date || a.doctor_signature_date || (a.created_at || '').slice(0, 10);
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateRestraintUsageRecordHtml(filtered, patient, ctx.facilityName);
        };
      }
      case 'incident_report': {
        const mod = await import('./printIncidentReport');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateIncidentReportPrintHTML([{ patient, report: {} as IncidentReport }], ctx.facilityName, ctx.logoDataUri);
          }
          const db = await import('../lib/database');
          const reports = await db.getIncidentReports();
          const filtered = (reports || []).filter(r => {
            if (r.patient_id !== ctx.patient.院友id) return false;
            const d = r.incident_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateIncidentReportPrintHTML(filtered.map(r => ({ patient, report: r })), ctx.facilityName, ctx.logoDataUri);
        };
      }
      case 'activity_record': {
        const mod = await import('./activityRecordPrintFormHtml');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateActivityRecordPrintFormHtml([patient], new Map([[ctx.patient.院友id, []]]), ctx.logoDataUri || '', ctx.facilityName);
          }
          const db = await import('../lib/database');
          const records = await db.getPatientActivityRecords();
          const filtered = (records || []).filter(r => {
            if (r.patient_id !== ctx.patient.院友id) return false;
            const d = r.record_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateActivityRecordPrintFormHtml([patient], new Map([[ctx.patient.院友id, filtered]]), ctx.logoDataUri || '', ctx.facilityName);
        };
      }
      case 'doctor_visit': {
        const mod = await import('./docHtmlGenerators/doctorVisitGenerator');
        return mod.generateDoctorVisitHtml;
      }
      case 'orientation_plan': {
        const mod = await import('./docHtmlGenerators/orientationPlanGenerator');
        return mod.generateOrientationPlanHtml;
      }
      case 'publicity_consent': {
        const mod = await import('./docHtmlGenerators/publicityConsentGenerator');
        return mod.generatePublicityConsentHtml;
      }
      case 'outing_consent': {
        const mod = await import('./docHtmlGenerators/outingConsentGenerator');
        return mod.generateOutingConsentHtml;
      }
      case 'personal_belongings': {
        const mod = await import('./docHtmlGenerators/personalBelongingsGenerator');
        return mod.generatePersonalBelongingsHtml;
      }
      case 'financial_proxy_p1': {
        const mod = await import('./docHtmlGenerators/financialProxyGenerator');
        return mod.generateFinancialProxyP1Html;
      }
      case 'financial_proxy_p2': {
        const mod = await import('./docHtmlGenerators/financialProxyGenerator');
        return mod.generateFinancialProxyP2Html;
      }
      case 'financial_return': {
        const mod = await import('./docHtmlGenerators/financialReturnGenerator');
        return mod.generateFinancialReturnHtml;
      }
      case 'medication_list_short': {
        const mod = await import('./medicationListHtmlGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankPrescription = { is_long_term: false } as MedicationPrescription;
            return mod.generateMedicationListHtml([{ ...patient, prescriptions: [blankPrescription] }], {});
          }
          const db = await import('../lib/database');
          const prescriptions = await db.getPrescriptions(ctx.patient.院友id);
          const shortTerm = (prescriptions || []).filter(p => mod.classifyMedicationTerm(p) === 'short');
          if (shortTerm.length === 0) return '';
          return mod.generateMedicationListHtml([{ ...patient, prescriptions: shortTerm }], { startDate: ctx.startDate || undefined, endDate: ctx.endDate || undefined });
        };
      }
      case 'medication_list_long': {
        const mod = await import('./medicationListHtmlGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankPrescription = { is_long_term: true } as MedicationPrescription;
            return mod.generateMedicationListHtml([{ ...patient, prescriptions: [blankPrescription] }], {});
          }
          const db = await import('../lib/database');
          const prescriptions = await db.getPrescriptions(ctx.patient.院友id);
          const longTerm = (prescriptions || []).filter(p => mod.classifyMedicationTerm(p) === 'long');
          if (longTerm.length === 0) return '';
          return mod.generateMedicationListHtml([{ ...patient, prescriptions: longTerm }], { startDate: ctx.startDate || undefined, endDate: ctx.endDate || undefined });
        };
      }
      case 'temperature_record': {
        const mod = await import('./temperatureRecordWorksheetGenerator');
        return async (ctx) => {
          return mod.generateTemperatureRecordHtml(ctx.startDate, ctx.endDate, [ctx.patient.院友id], worksheetOptions(ctx));
        };
      }
      case 'bodyweight_record': {
        const mod = await import('./bodyweightRecordWorksheetGenerator');
        return async (ctx) => {
          return mod.generateBodyweightRecordHtml(ctx.startDate, ctx.endDate, [ctx.patient.院友id], worksheetOptions(ctx));
        };
      }
      case 'blood_sugar_record': {
        const mod = await import('./glucoseRecordWorksheetGenerator');
        return async (ctx) => {
          return mod.generateGlucoseRecordHtml(ctx.startDate, ctx.endDate, [ctx.patient.院友id], worksheetOptions(ctx));
        };
      }
      case 'nursing_treatment': {
        const mod = await import('./patientLogNursingTreatmentGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankLog = {
              id: 'blank',
              patient_id: ctx.patient.院友id,
              log_date: '',
              log_type: '其他',
              content: '',
              recorder: '',
            } as PatientLog;
            return mod.generatePatientLogNursingTreatmentHtml([blankLog], [patient], ['blank']);
          }
          const db = await import('../lib/database');
          const logs = await db.getPatientLogs();
          const filtered = (logs || []).filter(l => {
            if (l.patient_id !== ctx.patient.院友id) return false;
            const d = l.log_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generatePatientLogNursingTreatmentHtml(filtered, [patient], filtered.map(l => l.id));
        };
      }
      case 'wound_assessment': {
        const mod = await import('./woundAssessmentPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            const blankWound = {
              id: 'blank',
              patient_id: ctx.patient.院友id,
              wound_code: '',
              wound_location: { x: 0, y: 0, side: 'front' },
              status: 'active',
            } as unknown as Wound;
            return mod.generateWoundAssessmentHtml(blankWound, [], patient);
          }
          const db = await import('../lib/database');
          const wounds = await db.getPatientWounds(ctx.patient.院友id, 'all');
          const filtered = (wounds || []).filter(w => {
            const d = (w.created_at || '').slice(0, 10);
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          const docs: string[] = [];
          for (const wound of filtered) {
            const assessments = await db.getWoundAssessmentsByWound(wound.id);
            docs.push(await mod.generateWoundAssessmentHtml(wound, assessments || [], patient));
          }
          return docs.join('\n');
        };
      }
      case 'restraint_consent': {
        const mod = await import('./restraintConsentPrintGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateRestraintConsentPrintHtml({} as PatientRestraintAssessment, patient, ctx.facilityName);
          }
          const db = await import('../lib/database');
          const assessments = await db.getRestraintAssessments();
          const filtered = (assessments || []).filter(a => {
            if (a.patient_id !== ctx.patient.院友id) return false;
            const d = a.doctor_signature_date || (a.created_at || '').slice(0, 10);
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          filtered.sort((a, b) => (b.doctor_signature_date || '').localeCompare(a.doctor_signature_date || ''));
          return mod.generateRestraintConsentPrintHtml(filtered[0], patient, ctx.facilityName);
        };
      }
      case 'medication_proxy': {
        const mod = await import('./docHtmlGenerators/medicationProxyGenerator');
        return mod.generateMedicationProxyHtml;
      }
      case 'self_medication': {
        const mod = await import('./docHtmlGenerators/selfMedicationGenerator');
        return mod.generateSelfMedicationHtml;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`載入 generator ${id} 失敗:`, error);
    return async () => `<div class="print-page"><h1>${PRINT_DOCUMENTS.find(d => d.id === id)?.name || id}</h1><p>載入失敗</p></div>`;
  }
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

export async function generatePatientPrintBundle(options: PrintBundleOptions): Promise<void> {
  const { patients, documentIds, startDate, endDate, contentMode } = options;
  if (patients.length === 0 || documentIds.length === 0) return;

  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh;
  const logoDataUri = settings.logoDataUri;

  const pages: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const patient of patients) {
    const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    for (const docId of documentIds) {
      const generator = await getGenerator(docId);
      if (!generator) continue;
      const docName = PRINT_DOCUMENTS.find(d => d.id === docId)?.name || docId;

      try {
        const html = await generator({
          patient,
          startDate: startDate || patient.入住日期 || '',
          endDate,
          facilityName,
          logoDataUri,
          contentMode,
        });
        if (html) {
          pages.push(html);
        } else if (contentMode === 'data') {
          skipped.push(`${docName}（${patientName}）`);
        }
      } catch (error) {
        console.error(`產生 ${docId} 失敗:`, error);
        failed.push(`${docName}（${patientName}）`);
      }
    }
  }

  if (pages.length === 0) {
    alert('沒有可列印的內容');
    return;
  }

  // 使用 printUtils 合併並列印
  const { printCombinedHtml } = await import('./printUtils');
  printCombinedHtml(pages, 'patient-bundle-print-iframe');

  // 回報未能列印的文件
  const notices: string[] = [];
  if (skipped.length > 0) notices.push(`以下文件在日期範圍內沒有記錄，未有列印：\n${skipped.join('\n')}`);
  if (failed.length > 0) notices.push(`以下文件產生失敗：\n${failed.join('\n')}`);
  if (notices.length > 0) {
    setTimeout(() => alert(notices.join('\n\n')), 600);
  }
}
