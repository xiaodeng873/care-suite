import type {
  Patient,
  VaccinationRecord,
  HealthAssessment,
  FollowUpAppointment,
  IncidentReport,
  PatientRestraintAssessment,
  PatientLog,
  Wound,
  MedicationPrescription,
  PatientCareTab,
  MealGuidance,
  PatientHealthTask,
  PatientTubeCareRecord,
  InfectionControlRecord,
  Station,
  DiaperChangeRecord,
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { getFacilitySettings } from './facilitySettings';
import { getPrintBedNumber } from './bedTransferUtils';
import { PRINT_DOCUMENTS, type PrintDocumentOptions } from '../components/PatientPrintModal';
import { exportVaccinationRecordsToExcel } from './vaccinationRecordExcelGenerator';
import { exportStatisticsReportToExcel, type StatisticsReportDocumentId } from './statisticsReportsExcelGenerator';
import type { PatientFeeRecord, FeeItem } from '../lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

/** 列印內容模式：basic=含院友基本資料, data=含既有輸入內容, blank=空白文件 */
export type PrintContentMode = 'basic' | 'data' | 'blank';

export interface PrintBundleOptions {
  patients: Patient[];
  documentIds: string[];
  startDate: string;
  endDate: string;
  contentMode: PrintContentMode;
  printOptions?: PrintDocumentOptions;
  stations?: Station[];
  mealGuidances?: MealGuidance[];
  patientHealthTasks?: PatientHealthTask[];
  patientTubeCareRecords?: PatientTubeCareRecord[];
  infectionControlRecords?: InfectionControlRecord[];
  diaperChangeRecords?: DiaperChangeRecord[];
}

export interface DocumentGeneratorContext {
  patient: Patient;
  startDate: string;
  endDate: string;
  facilityName: string;
  contentMode: PrintContentMode;
  printOptions?: PrintDocumentOptions;
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
            return (mod.generateFollowUpRecordFormsHtml as any)([blankAppointment], [patient], '', ctx.facilityName);
          }
          const db = await import('../lib/database');
          const appointments = await db.getFollowUps();
          const filtered = (appointments || []).filter(a => {
            if (a.院友id !== ctx.patient.院友id) return false;
            const d = a.覆診日期 || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });
          if (filtered.length === 0) return '';
          return (mod.generateFollowUpRecordFormsHtml as any)(filtered, [patient], '', ctx.facilityName);
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
      case 'accident_report': {
        const mod = await import('./incidentReportHtmlGenerator');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode !== 'data') {
            return mod.generateIncidentReportHtml({} as IncidentReport, patient, ctx.facilityName);
          }
          const db = await import('../lib/database');
          const reports = await db.getIncidentReports();
          let patientReports = (reports || []).filter(r => {
            if (r.patient_id !== ctx.patient.院友id) return false;
            const d = r.incident_date || '';
            return (!ctx.startDate || d >= ctx.startDate) && (!ctx.endDate || d <= ctx.endDate);
          });

          const selectedIds = ctx.printOptions?.selectedIncidentReportIds;
          if (selectedIds && selectedIds.length > 0) {
            patientReports = patientReports.filter(r => selectedIds.includes(r.id));
          } else {
            patientReports.sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || ''));
            patientReports = patientReports.slice(0, 1);
          }

          if (patientReports.length === 0) return '';
          return patientReports
            .map(r => mod.generateIncidentReportHtml(r, patient, ctx.facilityName))
            .join('\n');
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
      case 'bedhead_position_change': {
        const mod = await import('./positionChangeHtmlExporter');
        return async (ctx) => {
          const patient = ctxPatient(ctx);
          if (ctx.contentMode === 'data') {
            const tabs = await loadPatientCareTabsForPatients([ctx.patient.院友id]);
            if (!patientHasCareTab(tabs, ctx.patient.院友id, 'position')) return '';
            const db = await import('../lib/database');
            const records = await db.getPositionChangeRecordsInDateRange(ctx.startDate, ctx.endDate);
            const patientRecords = records.filter(r => r.patient_id === ctx.patient.院友id);
            if (patientRecords.length === 0) return '';
            return mod.generatePositionChangeRangeHtml(patient, patientRecords, ctx.startDate, ctx.endDate, ctx.facilityName);
          }
          // basic：含院友基本資料但無記錄；blank：全空白
          return mod.generatePositionChangeRangeHtml(
            ctx.contentMode === 'basic' ? patient : null,
            [], ctx.startDate, ctx.endDate, ctx.facilityName
          );
        };
      }
      default:
        return null;
    }
  } catch (error: any) {
    console.error(`載入 generator ${id} 失敗:`, error);
    return async () => `<div class="print-page"><h1>${PRINT_DOCUMENTS.find(d => d.id === id)?.name || id}</h1><p>載入失敗</p></div>`;
  }
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

export async function generatePatientPrintBundle(options: PrintBundleOptions): Promise<void> {
  const { patients, documentIds, startDate, endDate, contentMode, printOptions } = options;
  if (patients.length === 0 || documentIds.length === 0) return;

  // 清除床頭記錄選項卡快取，避免跨次列印使用舊資料
  cachedCareTabs = null;
  cachedCareTabPatientIds = null;

  const settings = await getFacilitySettings();
  const facilityName = settings.facilityNameZh;

  const orderMap = new Map(PRINT_DOCUMENTS.map((d, i) => [d.id, i]));
  const categoryWeight: Record<string, number> = { '入住文件': 0, '常用表格': 1, '床頭記錄': 2, '統計報表': 3 };
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

  const STATISTICS_REPORT_IDS = new Set([
    'meal_statistics_report',
    'tube_care_statistics_report',
    'infection_control_statistics_report',
    'special_care_statistics_report',
    'drug_sensitivity_statistics_report',
    'diaper_statistics_report',
  ]);

  // Excel 匯出文件（疫苗接種記錄 + 統計報表）與 HTML 文件分開處理
  const hasVaccinationRecord = sortedDocumentIds.includes('vaccination_record');
  const hasFeeStatisticsReport = sortedDocumentIds.includes('fee_statistics_report');
  const statisticsDocumentIds = sortedDocumentIds.filter(id => STATISTICS_REPORT_IDS.has(id)) as StatisticsReportDocumentId[];
  const htmlDocumentIds = sortedDocumentIds.filter(id => id !== 'vaccination_record' && id !== 'fee_statistics_report' && !STATISTICS_REPORT_IDS.has(id));

  const pages: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const patient of patients) {
    const patientName = patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
    for (const docId of htmlDocumentIds) {
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
          printOptions,
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
            printOptions,
          });
        }
        if (Array.isArray(html)) {
          pages.push(...html.filter(Boolean));
        } else if (html) {
          pages.push(html);
        } else if (contentMode === 'data' && !isBedhead) {
          skipped.push(`${docName}（${patientName}）`);
        }
      } catch (error: any) {
        console.error(`產生 ${docId} 失敗:`, error);
        failed.push(`${docName}（${patientName}）`);
      }
    }
  }

  if (hasFeeStatisticsReport) {
    try {
      const patientIds = patients.map(p => p.院友id);
      const [{ data: recordsData, error: recordsError }, { data: feeItemsData, error: feeItemsError }] = await Promise.all([
        supabase.from('patient_fee_records').select('*').in('patient_id', patientIds).order('record_date', { ascending: true }),
        supabase.from('fee_items').select('*').eq('is_active', true),
      ]);
      if (recordsError) throw recordsError;
      if (feeItemsError) throw feeItemsError;
      const records = (recordsData || []) as PatientFeeRecord[];
      const feeItems = (feeItemsData || []) as FeeItem[];

      const feeMod = await import('./feeStatementPrintFormHtml');
      const feeMonth = printOptions?.feeMonth || (endDate ? endDate.slice(0, 7) : new Date().toISOString().slice(0, 7));
      const feeHtml = feeMod.generateFeeStatisticsReportHtml(patients, records, feeItems, {
        month: feeMonth,
        skipEmptyPatients: printOptions?.feeSkipEmptyPatients ?? false,
        facilityName,
      });
      pages.push(feeHtml);
    } catch (error: any) {
      console.error('產生雜費記錄報表失敗:', error);
      failed.push('雜費記錄報表');
    }
  }

  let excelGenerated = false;
  if (hasVaccinationRecord) {
    try {
      const patientIds = patients.map(p => p.院友id);
      const { data, error } = await supabase
        .from('vaccination_records')
        .select('*')
        .in('patient_id', patientIds)
        .order('vaccination_date', { ascending: false });
      if (error) throw error;
      const records = (data || []) as VaccinationRecord[];
      const effectiveStartDate = startDate || '';
      const effectiveEndDate = endDate || '';
      if (records.length > 0) {
        await exportVaccinationRecordsToExcel({
          patients,
          records,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          separateSheetsPerPatient: printOptions?.separateSheetsPerPatient ?? false,
        });
        excelGenerated = true;
      } else {
        skipped.push('疫苗接種記錄（日期範圍內沒有記錄）');
      }
    } catch (error: any) {
      console.error('產生疫苗接種記錄 Excel 失敗:', error);
      failed.push('疫苗接種記錄');
    }
  }

  if (statisticsDocumentIds.length > 0) {
    try {
      const patientIds = patients.map(p => p.院友id);
      let stations = options.stations || [];
      if (stations.length === 0) {
        const { data, error } = await supabase.from('stations').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        stations = (data || []) as Station[];
      }

      let mealGuidances = options.mealGuidances || [];
      let patientHealthTasks = options.patientHealthTasks || [];
      let patientTubeCareRecords = options.patientTubeCareRecords || [];
      let infectionControlRecords = options.infectionControlRecords || [];
      let diaperChangeRecords = options.diaperChangeRecords || [];

      const needsMeal = statisticsDocumentIds.includes('meal_statistics_report');
      const needsTube = statisticsDocumentIds.includes('tube_care_statistics_report');
      const needsSpecial = statisticsDocumentIds.includes('special_care_statistics_report');
      const needsInfection = statisticsDocumentIds.includes('infection_control_statistics_report');
      const needsDiaper = statisticsDocumentIds.includes('diaper_statistics_report');

      if (needsMeal && mealGuidances.length === 0) {
        const { data, error } = await supabase.from('meal_guidance').select('*').in('patient_id', patientIds);
        if (error) throw error;
        mealGuidances = (data || []) as MealGuidance[];
      }
      if (needsSpecial && patientHealthTasks.length === 0) {
        const { data, error } = await supabase.from('patient_health_tasks').select('*').in('patient_id', patientIds);
        if (error) throw error;
        patientHealthTasks = (data || []) as PatientHealthTask[];
      }
      if (needsTube && patientTubeCareRecords.length === 0) {
        const { data, error } = await supabase.from('patient_tube_care_records').select('*').in('patient_id', patientIds);
        if (error) throw error;
        patientTubeCareRecords = (data || []) as PatientTubeCareRecord[];
      }
      if (needsInfection && infectionControlRecords.length === 0) {
        const { data, error } = await supabase.from('infection_control_records').select('*').in('patient_id', patientIds);
        if (error) throw error;
        infectionControlRecords = (data || []) as InfectionControlRecord[];
      }
      if (needsDiaper && diaperChangeRecords.length === 0) {
        const { data, error } = await supabase.from('diaper_change_records').select('*').in('patient_id', patientIds);
        if (error) throw error;
        diaperChangeRecords = (data || []) as DiaperChangeRecord[];
      }

      // 尿片統計需要開啟「換片記錄」tab 的院友名單
      let patientCareTabs: PatientCareTab[] = [];
      if (needsDiaper) {
        patientCareTabs = await loadPatientCareTabsForPatients(patientIds);
      }

      for (const documentId of statisticsDocumentIds) {
        try {
          await exportStatisticsReportToExcel({
            documentId,
            patients,
            stations,
            mealGuidances,
            patientHealthTasks,
            patientTubeCareRecords,
            infectionControlRecords,
            diaperChangeRecords,
            patientCareTabs,
            diaperMonthRange: printOptions?.diaperMonthRange,
            separateSheetsPerStation: printOptions?.separateSheetsPerStation ?? false,
          });
          excelGenerated = true;
        } catch (error: any) {
          console.error(`產生統計報表 ${documentId} 失敗:`, error);
          const docName = PRINT_DOCUMENTS.find(d => d.id === documentId)?.name || documentId;
          failed.push(docName);
        }
      }
    } catch (error: any) {
      console.error('產生統計報表 Excel 失敗:', error);
      failed.push('統計報表');
    }
  }

  // 若只有 HTML 且無內容，則提示；若只有 Excel 也會在上方匯出
  if (pages.length === 0 && !excelGenerated) {
    alert('沒有可列印或匯出的內容');
    return;
  }

  if (pages.length > 0) {
    // 使用 printGroupedHtml：依 @page 設定分組，同組合併到單一 iframe 列印
    const { printGroupedHtml } = await import('./printUtils');
    printGroupedHtml(pages, 'patient-bundle-print-iframe');
  }

  // 回報未能列印/匯出的文件
  const notices: string[] = [];
  if (skipped.length > 0) notices.push(`以下文件在日期範圍內沒有記錄，未有列印/匯出：\n${skipped.join('\n')}`);
  if (failed.length > 0) notices.push(`以下文件產生失敗：\n${failed.join('\n')}`);
  if (notices.length > 0) {
    setTimeout(() => alert(notices.join('\n\n')), 600);
  }
}
