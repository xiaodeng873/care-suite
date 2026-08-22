import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- constants from medicationRecordHtmlExporter ---
const PUNCH_ZONE_MM = 10;
const PAGE_HEIGHT_MM = 206 - PUNCH_ZONE_MM;
const HEADER_HEIGHT_MM = 30;
const TABLE_HEADER_MM = 9;
const ROW_SIGN_MM = 6;
const ROW_SUMMARY_MM = 6;
const FOOTER_FIXED_MM = 4;
const SAFETY_MARGIN_MM = 0;
const MIN_SLOT_ROWS = 4;
const AM_SECTION_MIN = 2;
const MAX_PRESCRIPTIONS_PER_PAGE = 5;
const SUMMARY_PM_MIN_START_ROW = 3;
const SUMMARY_MIN_ROWS = 4;
const FILLER_BLOCK_MM = MIN_SLOT_ROWS * ROW_SIGN_MM;

function estimateFooterLegendMm(staffCount: number): number {
  let mm = 20;
  if (staffCount > 0) {
    const staffLines = Math.ceil(staffCount / 5);
    mm += 4.4 + staffLines * 3.7;
  }
  return mm;
}

function bodyUsableMm(summaryRows: number, footerLegendMm: number): number {
  const footerMm = Math.max(summaryRows * ROW_SUMMARY_MM, footerLegendMm) + FOOTER_FIXED_MM;
  return PAGE_HEIGHT_MM - HEADER_HEIGHT_MM - TABLE_HEADER_MM - footerMm - SAFETY_MARGIN_MM;
}

function parseTimeToMinutes(timeStr: string): number {
  const match = String(timeStr ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function normalizeTimeSlotValue(raw: string): string {
  const s = String(raw ?? '').trim().toUpperCase().replace(/\s/g, '');
  const hourMapping: Record<string, string> = {
    '12MN': '00:00', '12NN': '12:00',
    '8A': '08:00', '8P': '20:00',
    '9A': '09:00', '9P': '21:00',
    '10A': '10:00', '10P': '22:00',
    '11A': '11:00', '11P': '23:00',
    '12A': '00:00', '12P': '12:00',
  };
  if (hourMapping[s]) return hourMapping[s];
  if (/^(\d{1,2})A$/.test(s)) {
    const h = parseInt(RegExp.$1, 10);
    return `${String(h).padStart(2, '0')}:00`;
  }
  if (/^(\d{1,2})P$/.test(s)) {
    const h = parseInt(RegExp.$1, 10);
    return `${String(h + 12).padStart(2, '0')}:00`;
  }
  if (/^(\d{1,2}):(\d{2})$/.test(s)) {
    const [h, m] = s.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
  }
  return s;
}

function sortDistinctTimeSlots(slots: string[]): string[] {
  const distinct = [...new Set(slots.filter(Boolean))];
  return distinct.sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
}

function splitAmPm(slots: string[]): { am: string[]; pm: string[] } {
  const am: string[] = [];
  const pm: string[] = [];
  for (const slot of slots) {
    const minutes = parseTimeToMinutes(slot);
    if (minutes >= 0 && minutes <= 12 * 60) am.push(slot);
    else pm.push(slot);
  }
  return { am, pm };
}

function getAutoTimeSlotsForExport(dailyFrequency: number, mealTiming: string): string[] {
  const f = dailyFrequency;
  if (mealTiming === '晚上') return ['20:00'];
  if (mealTiming === '睡前') return ['22:00'];
  if (mealTiming === '早餐前' || mealTiming === '餐前') return ['07:00'];
  if (mealTiming === '餐後' || mealTiming === '隨餐' || mealTiming === '進餐時') {
    if (f === 1) return ['12:00'];
    if (f === 2) return ['08:00', '18:00'];
    return ['08:00', '12:00', '18:00'];
  }
  if (f === 1) return ['08:00'];
  if (f === 2) {
    const first = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
    return [first, '16:00'];
  }
  if (f === 3) {
    const first = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
    return [first, '12:00', '16:00'];
  }
  if (f === 4) {
    const first = mealTiming === '早餐前' || mealTiming === '餐前' ? '07:00' : '08:00';
    return [first, '12:00', '16:00', '20:00'];
  }
  return ['08:00'];
}

function resolvePrescriptionTimeSlots(p: any): string[] {
  const rawSlots = Array.isArray(p.medication_time_slots) ? p.medication_time_slots : [];
  const normalized = sortDistinctTimeSlots(rawSlots.map(normalizeTimeSlotValue).filter(Boolean));
  if (normalized.length > 0) return normalized;
  const mealTiming = String(p.meal_timing ?? '').trim();
  if (!mealTiming) return [];
  return sortDistinctTimeSlots(getAutoTimeSlotsForExport(Number(p.daily_frequency) || 1, mealTiming));
}

function classifyRoute(p: any): 'oral' | 'topical' | 'subcutaneous' | 'intramuscular' {
  const route = String(p.administration_route ?? '').trim();
  if (route.includes('皮下注射')) return 'subcutaneous';
  if (route.includes('注射')) return 'intramuscular';
  if (route === '口服' || route === '舌下' || route === '漱口') return 'oral';
  return 'topical';
}

function prescriptionIsInjection(p: any): boolean {
  return /注射/.test(String(p.administration_route ?? ''));
}

function prescriptionHasInspection(p: any): boolean {
  return Array.isArray(p.inspection_rules) && p.inspection_rules.length > 0;
}

function getBlockHeightMm(block: any): number {
  const p = block.prescription;
  const inspCount = prescriptionHasInspection(p)
    ? [...new Set((p.inspection_rules as any[]).map((r: any) => String(r?.vital_sign_type ?? '').trim()).filter(Boolean))].length
    : 0;
  const injectRows = prescriptionIsInjection(p) ? 1 : 0;
  const rowsPerSlot = 1 + inspCount + injectRows;
  const { am, pm } = splitAmPm(block.timeSlots);
  const amActualRows = am.length * rowsPerSlot;
  const amPadRows = Math.max(0, AM_SECTION_MIN - amActualRows);
  const pmActualRows = pm.length * rowsPerSlot;
  const pmPadRows = Math.max(0, MIN_SLOT_ROWS - (amActualRows + amPadRows + pmActualRows));
  return (amActualRows + amPadRows + pmActualRows + pmPadRows) * ROW_SIGN_MM;
}

function computeSummaryLayout(am: string[], pm: string[]) {
  const amRows = am.length;
  const pmRows = pm.length;
  const pmStartRow = Math.max(SUMMARY_PM_MIN_START_ROW, amRows + 1);
  const totalRows = Math.max(pmStartRow + pmRows - 1, amRows, SUMMARY_MIN_ROWS);
  return { totalRows, amRows, pmRows, pmStartRow };
}

function summaryRowCount(blocks: any[]): number {
  const allSlots = [...new Set(blocks.flatMap((b: any) => b.timeSlots).filter(Boolean))];
  const { am, pm } = splitAmPm(allSlots);
  return computeSummaryLayout(am, pm).totalRows;
}

function paginateBlocks(blocks: any[], footerLegendMm: number): any[][] {
  const result: any[][] = [];
  let current: any[] = [];
  let currentMm = 0;
  for (const block of blocks) {
    const blockMm = getBlockHeightMm(block);
    if (current.length > 0) {
      const projected = [...current, block];
      const usableMm = bodyUsableMm(summaryRowCount(projected), footerLegendMm);
      if (currentMm + blockMm > usableMm || current.length >= MAX_PRESCRIPTIONS_PER_PAGE) {
        result.push(current);
        current = [];
        currentMm = 0;
      }
    }
    current.push(block);
    currentMm += blockMm;
  }
  if (current.length > 0) result.push(current);
  return result.length > 0 ? result : [[]];
}

// same sort as MedicationRecordExportModal
function sortPrescriptionsByOrder(prescriptions: any[], order: 'efficiency' | 'name' | 'time' | 'source'): any[] {
  const sorted = [...prescriptions];
  const slotSig = (p: any) => [...(p.medication_time_slots ?? [])].sort().join('|');
  const firstSlot = (p: any) => [...(p.medication_time_slots ?? [])].sort()[0] ?? '';
  const byName = (a: any, b: any) =>
    (a.medication_name ?? '').localeCompare(b.medication_name ?? '', 'zh-TW');
  const isLatePrn = (p: any) => p.is_prn && (p.medication_time_slots ?? []).length === 0;
  switch (order) {
    case 'name':
      return sorted.sort(byName);
    case 'time':
      return sorted.sort((a, b) => firstSlot(a).localeCompare(firstSlot(b)) || byName(a, b));
    case 'source':
      return sorted.sort((a, b) =>
        (a.medication_source ?? '').localeCompare(b.medication_source ?? '', 'zh-TW') || byName(a, b));
    case 'efficiency':
    default:
      return sorted.sort((a, b) => {
        const lateA = isLatePrn(a) ? 1 : 0;
        const lateB = isLatePrn(b) ? 1 : 0;
        if (lateA !== lateB) return lateA - lateB;
        const sigCmp = slotSig(a).localeCompare(slotSig(b));
        if (sigCmp !== 0) return sigCmp;
        const fsCmp = firstSlot(a).localeCompare(firstSlot(b));
        if (fsCmp !== 0) return fsCmp;
        return byName(a, b);
      });
  }
}

async function main() {
  const { data: patientRows, error: pe } = await supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號')
    .ilike('中文姓名', '%麥錦蓮%')
    .limit(1);
  if (pe || !patientRows || patientRows.length === 0) throw pe || new Error('patient not found');
  const patient = patientRows[0];

  const { data: prescriptions, error: re } = await supabase
    .from('new_medication_prescriptions')
    .select('*')
    .eq('patient_id', patient.院友id);
  if (re) throw re;

  const sorted = sortPrescriptionsByOrder(prescriptions!, 'efficiency');
  const blocks = sorted.map((p: any) => ({ prescription: p, timeSlots: resolvePrescriptionTimeSlots(p) }));

  // categorize like preparePages
  const oralBlocks = blocks.filter((b: any) => classifyRoute(b.prescription) === 'oral');
  const footerLegendMm = estimateFooterLegendMm(0);

  function describePages(groups: any[][]) {
    return groups.map((page, i) => {
      const slots = [...new Set(page.flatMap((b: any) => b.timeSlots).filter(Boolean))];
      const height = page.reduce((s: number, b: any) => s + getBlockHeightMm(b), 0);
      const sumRows = summaryRowCount(page);
      const usable = bodyUsableMm(sumRows, footerLegendMm);
      return {
        page: i + 1,
        names: page.map((b: any) => b.prescription.medication_name),
        heightMm: height,
        usableMm: usable,
        summaryRows: sumRows,
        slots,
      };
    });
  }

  // includeBlankRows does NOT go into paginateBlocks, so same result for both booleans
  const grouped = paginateBlocks(oralBlocks, footerLegendMm);
  const info = describePages(grouped);

  console.log(`Patient: ${patient.中文姓名} (${patient.床號})`);
  console.log('Oral sorted order:', oralBlocks.map((b: any) => b.prescription.medication_name));
  console.log('Pagination (includeBlankRows should not affect this):');
  console.log(JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
