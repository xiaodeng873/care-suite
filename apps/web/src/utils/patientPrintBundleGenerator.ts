import type {
  Patient,
  HealthAssessment,
  FollowUpAppointment,
  IncidentReport,
  PatientRestraintAssessment,
  PatientLog,
  Wound,
  MedicationPrescription,
  PatientCareTab,
  MealGuidance,
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { getFacilitySettings } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';
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
  contentMode: PrintContentMode;
}

type DocumentGenerator = (ctx: DocumentGeneratorContext) => Promise<string | string[]>;

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

// ─── 床頭記錄 tab 輔助 ────────────────────────────────────────────────────────

const ALWAYS_VISIBLE_BEDHEAD_TABS: PatientCareTab['tab_type'][] = ['patrol', 'hygiene'];

let cachedCareTabs: PatientCareTab[] | null = null;
let cachedCareTabPatientIds: number[] | null = null;

async function loadPatientCareTabsForPatients(patientIds: number[]): Promise<PatientCareTab[]> {
  if (
    cachedCareTabs &&
    cachedCareTabPatientIds &&
    cachedCareTabPatientIds.length === patientIds.length &&
    cachedCareTabPatientIds.every((id, i) => id === patientIds[i])
  ) {
    return cachedCareTabs;
  }
  const { data, error } = await supabase
    .from('patient_care_tabs')
    .select('*')
    .in('patient_id', patientIds)
    .eq('is_hidden', false);
  if (error) {
    console.error('載入院友床頭記錄選項卡失敗:', error);
    return [];
  }
  cachedCareTabs = data || [];
  cachedCareTabPatientIds = [...patientIds];
  return cachedCareTabs;
}

function patientHasCareTab(
  tabs: PatientCareTab[],
  patientId: number,
  tabType: PatientCareTab['tab_type']
): boolean {
  if (ALWAYS_VISIBLE_BEDHEAD_TABS.includes(tabType)) return true;
  return tabs.some(t => t.patient_id === patientId && t.tab_type === tabType);
}

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
            return mod.generateHealthAssessmentHtml({} as HealthAssessment, patient, ctx.facilityName);
          }
          const db = await import('../lib/database');
          const all = await db.getHealthAssessments('all');
          const mine = (all || []).filter(a => a.patient_id === ctx.patient.院友id);
          if (mine.length === 0) return '';
          mine.sort((a, b) => (b.assessment_date || '').localeCompare(a.assessment_date || ''));
          return mod.generateHealthAssessmentHtml(mine[0], patient, ctx.facilityName);
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
            return mod.generateFollowUpRecordFormsHtml([blankAppointment], [patient], '', ctx.facilityName);
          }
          const db = await import('../lib/database');
          const appointments = await db.getFollowUps();
          const filtered = (appointments || []).filter(a => {
            if (a.院友id !== ctx.patient.院友id) return false;
            const d = a.覆診日期 || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateFollowUpRecordFormsHtml(filtered, [patient], '', ctx.facilityName);
        };
      }
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
            return mod.generateIncidentReportPrintHTML([{ patient, report: {} as IncidentReport }], ctx.facilityName);
          }
          const db = await import('../lib/database');
          const reports = await db.getIncidentReports();
          const filtered = (reports || []).filter(r => {
            if (r.patient_id !== ctx.patient.院友id) return false;
            const d = r.incident_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateIncidentReportPrintHTML(filtered.map(r => ({ patient, report: r })), ctx.facilityName);
        };
      }
      case 'activity_record': {
        const mod = await import('./activityRecordPrintFormHtml');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateActivityRecordPrintFormHtml([patient], new Map([[ctx.patient.院友id, []]]), ctx.facilityName);
          }
          const db = await import('../lib/database');
          const records = await db.getPatientActivityRecords();
          const filtered = (records || []).filter(r => {
            if (r.patient_id !== ctx.patient.院友id) return false;
            const d = r.record_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return mod.generateActivityRecordPrintFormHtml([patient], new Map([[ctx.patient.院友id, filtered]]), ctx.facilityName);
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
            return mod.generateMedicationListHtml([{ ...patient, prescriptions: [] }], { allowBlankPage: true, termType: 'short' });
          }
          const db = await import('../lib/database');
          const prescriptions = await db.getPrescriptions(ctx.patient.院友id);
          const shortTerm = (prescriptions || []).filter(p => mod.classifyMedicationTerm(p) === 'short');
          if (shortTerm.length === 0) return '';
          return mod.generateMedicationListHtml([{ ...patient, prescriptions: shortTerm }], { startDate: ctx.startDate || undefined, endDate: ctx.endDate || undefined, termType: 'short' });
        };
      }
      case 'medication_list_long': {
        const mod = await import('./medicationListHtmlGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateMedicationListHtml([{ ...patient, prescriptions: [] }], { allowBlankPage: true, termType: 'long' });
          }
          const db = await import('../lib/database');
          const prescriptions = await db.getPrescriptions(ctx.patient.院友id);
          const longTerm = (prescriptions || []).filter(p => mod.classifyMedicationTerm(p) === 'long');
          if (longTerm.length === 0) return '';
          return mod.generateMedicationListHtml([{ ...patient, prescriptions: longTerm }], { startDate: ctx.startDate || undefined, endDate: ctx.endDate || undefined, termType: 'long' });
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
      // ─── 床頭記錄 ─────────────────────────────────────────────────────────────
      case 'bedhead_patrol_rounds': {
        const mod = await import('./patrolRoundsHtmlExporter');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'patrol')) return '';
            const db = await import('../lib/database');
            const rounds = await db.getPatrolRoundsInDateRange(ctx.startDate, ctx.endDate);
            const patientRounds = rounds.filter(r => r.patient_id === ctx.patient.院友id);
            if (patientRounds.length === 0) return '';
            return mod.generatePatrolRoundsRangeHtml({
              facilityName: ctx.facilityName,
              bedNumber: getPrintBedNumber(patient),
              startDate: ctx.startDate,
              endDate: ctx.endDate,
              rounds: patientRounds,
            });
          }
          // basic：含院友床號；blank：全空白
          return mod.generatePatrolRoundsRangeHtml({
            facilityName: ctx.facilityName,
            bedNumber: ctx.contentMode === 'basic' ? getPrintBedNumber(patient) : '',
            startDate: ctx.startDate,
            endDate: ctx.endDate,
            rounds: [],
          });
        };
      }
      case 'bedhead_diaper': {
        const mod = await import('./diaperRecordPrintFormHtml');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'diaper')) return '';
            const db = await import('../lib/database');
            const records = await db.getDiaperChangeRecordsInDateRange(ctx.startDate, ctx.endDate);
            const patientRecords = records.filter(r => r.patient_id === ctx.patient.院友id);
            if (patientRecords.length === 0) return '';
            return mod.generateDiaperRecordFormForDateRange(patient, patientRecords, ctx.startDate, ctx.endDate, ctx.facilityName, true);
          }
          // basic：含院友基本資料（showData=true 但無記錄）；blank：全空白
          return mod.generateDiaperRecordFormForDateRange(patient, [], ctx.startDate, ctx.endDate, ctx.facilityName, ctx.contentMode === 'basic');
        };
      }
      case 'bedhead_intake_output': {
        const mod = await import('./intakeOutputHtmlGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          const buildBaseInput = async (withPatientInfo: boolean) => {
            if (!withPatientInfo) {
              return {
                facilityName: ctx.facilityName,
                patientName: '',
                bedNumber: '',
                genderAge: '',
                targetIntakeMl: undefined,
                mealCombination: undefined,
                specialDiets: [] as string[],
              };
            }
            const db = await import('../lib/database');
            const guidances = await db.getMealGuidances();
            const guidance = guidances.find(g => g.patient_id === ctx.patient.院友id);
            const name = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`.trim() || patient.中文姓名 || '';
            const genderAge = `${patient.性別 ?? ''}/${patient.出生日期 ? new Date().getFullYear() - new Date(patient.出生日期).getFullYear() : ''}`;
            return {
              facilityName: ctx.facilityName,
              patientName: name,
              bedNumber: getPrintBedNumber(patient),
              genderAge,
              targetIntakeMl: undefined,
              mealCombination: guidance?.meal_combination,
              specialDiets: guidance?.special_diets ?? [] as string[],
            };
          };
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'intake_output')) return '';
            const db = await import('../lib/database');
            const records = await db.getIntakeOutputRecordsByPatient(ctx.patient.院友id, ctx.startDate, ctx.endDate);
            if (records.length === 0) return '';
            return mod.generateIntakeOutputRangeHtml(
              await buildBaseInput(true),
              records as any,
              ctx.startDate,
              ctx.endDate,
              ctx.facilityName
            );
          }
          // basic：含院友基本資料（含飲食指引）但無記錄；blank：全空白
          return mod.generateIntakeOutputRangeHtml(
            await buildBaseInput(ctx.contentMode === 'basic'),
            [],
            ctx.startDate,
            ctx.endDate,
            ctx.facilityName
          );
        };
      }
      case 'bedhead_hygiene': {
        const mod = await import('./hygieneRecordPrintFormHtml');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'hygiene')) return '';
            const db = await import('../lib/database');
            const records = await db.getHygieneRecordsInDateRange(ctx.startDate, ctx.endDate);
            const patientRecords = records.filter(r => r.patient_id === ctx.patient.院友id);
            if (patientRecords.length === 0) return '';
            return mod.generateHygieneRecordFormForDateRange(patient, patientRecords, ctx.startDate, ctx.endDate, ctx.facilityName);
          }
          return mod.generateHygieneRecordFormForDateRange(patient, [], ctx.startDate, ctx.endDate, ctx.facilityName);
        };
      }
      case 'bedhead_restraint_observation': {
        const mod = await import('./restraintObservationHtmlExporter');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'restraint')) return '';
            const db = await import('../lib/database');
            const records = await db.getRestraintObservationRecordsInDateRange(ctx.startDate, ctx.endDate);
            const patientRecords = records.filter(r => r.patient_id === ctx.patient.院友id);
            if (patientRecords.length === 0) return '';
            const assessments = await db.getRestraintAssessments();
            const assessment = assessments.find(a => a.patient_id === ctx.patient.院友id) ?? null;
            return mod.generateRestraintObservationRangeHtml(patient, patientRecords, assessment, ctx.startDate, ctx.endDate, true, ctx.facilityName);
          }
          return mod.generateRestraintObservationRangeHtml(patient, [], null, ctx.startDate, ctx.endDate, true, ctx.facilityName);
        };
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

  // 清除床頭記錄選項卡快取，避免跨次列印使用舊資料
  cachedCareTabs = null;
  cachedCareTabPatientIds = null;

  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh;

  const orderMap = new Map(PRINT_DOCUMENTS.map((d, i) => [d.id, i]));
  const categoryWeight: Record<string, number> = { '入住文件': 0, '常用表格': 1, '床頭記錄': 2 };
  const sortedDocumentIds = [...documentIds].sort((a, b) => {
    const ad = PRINT_DOCUMENTS.find(d => d.id === a);
    const bd = PRINT_DOCUMENTS.find(d => d.id === b);
    const aw = (ad && categoryWeight[ad.category]) ?? 0;
    const bw = (bd && categoryWeight[bd.category]) ?? 0;
    if (aw !== bw) return aw - bw;
    const ai = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const pages: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const patient of patients) {
    const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    for (const docId of sortedDocumentIds) {
      const generator = await getGenerator(docId);
      if (!generator) continue;
      const doc = PRINT_DOCUMENTS.find(d => d.id === docId);
      const docName = doc?.name || docId;
      const isBedhead = doc?.category === '床頭記錄';

      try {
        let html = await generator({
          patient,
          startDate: startDate || patient.入住日期 || '',
          endDate,
          facilityName,
          contentMode,
        });
        // 「含既有輸入內容」模式：有內容則印內容，無內容則回退印基本資料
        // 床頭記錄除外：data 模式下院友沒有該 tab 或沒有記錄時必須整份跳過，不回退
        if (!html && contentMode === 'data' && !isBedhead) {
          html = await generator({
            patient,
            startDate: startDate || patient.入住日期 || '',
            endDate,
            facilityName,
            contentMode: 'basic',
          });
        }
        if (Array.isArray(html)) {
          pages.push(...html.filter(Boolean));
        } else if (html) {
          pages.push(html);
        } else if (contentMode === 'data' && !isBedhead) {
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

  // 使用 printGroupedHtml：依 @page 設定分組，同組合併到單一 iframe 列印
  const { printGroupedHtml } = await import('./printUtils');
  printGroupedHtml(pages, 'patient-bundle-print-iframe');

  // 回報未能列印的文件
  const notices: string[] = [];
  if (skipped.length > 0) notices.push(`以下文件在日期範圍內沒有記錄，未有列印：\n${skipped.join('\n')}`);
  if (failed.length > 0) notices.push(`以下文件產生失敗：\n${failed.join('\n')}`);
  if (notices.length > 0) {
    setTimeout(() => alert(notices.join('\n\n')), 600);
  }
}
