import {
  extractStaffNamesFromWorkflowRecords,
  fetchWorkflowRecordsForMonth,
  formatDispenseCellContent,
  formatWorkflowCellContent,
  generateStaffCodeMapping,
  getWorkflowRecordForPrescriptionDateTimeSlot,
  type StaffCodeMapping,
  type WorkflowRecord,
} from './medicationWorkflowHelper';
import {
  getFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from './facilitySettings';
import { isPrescriptionScheduledOnDate } from './prescriptionSchedule';
import { isPrescriptionExpired, isPrescriptionAboutToExpire } from './prescriptionExpiry';

import { formatDisplayDate } from './dateFormat';
import { getPrintBedNumber } from './bedTransferUtils';
import { supabase } from '../lib/supabase';
// 渲染為同步流程，故於各匯出入口（async）先取得院舍設定後存於模組層，供 renderHeaderRegion 讀取。
let activeFacility: FacilitySettings = DEFAULT_FACILITY_SETTINGS;

// 此匯出器完全以程式自寫的語意化 HTML/CSS 產生列印版面（不再依賴 Excel 範本檔）。
// 版面分三區：頂置院友資訊 / 中間動態處方區 / 底部指引＋給藥彙總；
// 日格依當月天數填滿寬度；內容超頁自動分頁，且單一處方區塊不會被切割到兩頁。

type RouteKind = 'oral' | 'topical' | 'subcutaneous' | 'intramuscular'; // 處方分類（保留細分）
type PageRouteKind = 'oral' | 'topical' | 'injection';                  // 藥紙頁面：皮下+肌肉合併為 injection
type MedicationPrescription = Record<string, any>;
type PatientWithPrescriptions = Record<string, any> & { prescriptions?: MedicationPrescription[] };

interface PrescriptionBlock {
  prescription: MedicationPrescription;
  timeSlots: string[];
}

interface PageData {
  patient: PatientWithPrescriptions;
  routeKind: PageRouteKind;
  blocks: PrescriptionBlock[];
  pageIndexInRoute: number;
  pageCountInRoute: number;
  fillerCount: number; // 勾「處方空白列」時，本頁依剩餘空間可補的空白處方區塊數
  oralQuantityStat?: string; // 口服藥紙每頁：全部口服藥物（單位「粒」）各時間點數量統計
}

const ROUTE_SUBTITLES: Record<PageRouteKind, string> = {
  oral: '口服藥物',
  topical: '外用藥物',
  injection: '注射藥物',
};

const ROUTE_SHEET_LABELS: Record<PageRouteKind, string> = {
  oral: '口服藥紙',
  topical: '外用藥紙',
  injection: '注射藥紙',
};

// 「給藥記錄簽署指引」逐項說明（顯示於彙總區左側標籤格，取代「給藥簽署」字眼）。
const DISPENSE_CODE_ITEMS: string[] = [
  '簽名＝已服藥',
  'HL＝因事回家',
  'A＝入院',
  'S＝自理',
  'LM＝缺藥中',
  'C＝已痊癒',
  'P＝暫停',
  'R＝拒絕一種或以上藥物',
  'O＝其他（請註明）',
];
const DISPENSE_NOTE_ITEMS: string[] = [
  'R 或 O 請通知護士／保健員作出跟進並作適當記錄',
  '處方日期＝該藥物第一次被處方的使用日期',
];

// 分頁及版面固定規格
const MAX_PRESCRIPTIONS_PER_PAGE = 5; // 每頁最多處方數
const MIN_SLOT_ROWS = 4;              // 每個處方最少顯示時段列數（不足補空行）

// 產生鋪滿日格的左下→右上斜線 SVG（避免部分印表機不列印背景圖形）。
// 線寬 0.8pt（與外框同粗，約 1.07px）；vector-effect=non-scaling-stroke 保證
// 線寬不隨 viewBox 縮放，印表機不會把亞像素線寬渲染成似有還無的虛線。
const renderDiagonalSvg = (color: string): string =>
  `<svg class="mr-diag-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1 1">`
  + `<line x1="0" y1="1" x2="1" y2="0" stroke="${color}" stroke-width="0.8pt" vector-effect="non-scaling-stroke"/>`
  + `</svg>`;
const SUMMARY_PM_MIN_START_ROW = 3;   // PM 時段最少從第 3 列開始（保留前 2 列給 AM）
const SUMMARY_MIN_ROWS = 4;           // 彙總區總列永不少於 4 列

export const exportMedicationRecordToHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords = false,
  includeBlankRows = false,
  prescriptionSortOrder?: string
): Promise<void> => {
  const html = await buildMedicationRecordHtml(patients, selectedMonth, includeWorkflowRecords, includeBlankRows, prescriptionSortOrder);
  printViaIframe(html);
};

export const exportSelectedMedicationRecordToHtml = async (
  patient: PatientWithPrescriptions,
  prescriptions: MedicationPrescription[],
  selectedMonth: string,
  includeWorkflowRecords = false,
  includeBlankRows = false,
  prescriptionSortOrder?: string
): Promise<void> => {
  await exportMedicationRecordToHtml([{ ...patient, prescriptions }], selectedMonth, includeWorkflowRecords, includeBlankRows, prescriptionSortOrder);
};

// 空白藥紙 HTML 版：每位院友、每個選定途徑各產生一頁，填入 MAX_PRESCRIPTIONS_PER_PAGE 個空白處方列。
export const exportBlankMedicationRecordToHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  routeTypes: PageRouteKind[]
): Promise<void> => {
  activeFacility = await getFacilitySettings();
  const renderedPages: string[] = [];
  for (const patient of patients) {
    for (const routeKind of routeTypes) {
      const page: PageData = {
        patient,
        routeKind,
        blocks: [],
        pageIndexInRoute: 1,
        pageCountInRoute: 1,
        fillerCount: MAX_PRESCRIPTIONS_PER_PAGE,
      };
      renderedPages.push(renderPage(page, selectedMonth, [], {}, true));
    }
  }
  const html = assembleDocument(renderedPages);
  printViaIframe(html);
};

/**
 * 查詢每個處方最近一次完成給藥的日期。
 */
const fetchLastTakenDatesForPrescriptions = async (
  prescriptionIds: string[]
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const uniqueIds = [...new Set(prescriptionIds)].filter(Boolean);
  if (uniqueIds.length === 0) return map;

  const PAGE = 1000;
  for (let i = 0; i < uniqueIds.length; i += PAGE) {
    const batch = uniqueIds.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from('medication_workflow_records')
      .select('prescription_id, scheduled_date')
      .in('prescription_id', batch)
      .eq('dispensing_status', 'completed');
    if (error) {
      console.warn('查詢最近服用日期失敗:', error);
      continue;
    }
    for (const r of data || []) {
      const existing = map.get(r.prescription_id);
      if (!existing || r.scheduled_date > existing) {
        map.set(r.prescription_id, r.scheduled_date);
      }
    }
  }
  return map;
};

/** 藥物名稱 → 藥物資料庫警示旗標（不可碎藥／不可與中和胃酸藥同服），供名稱欄顯示小標籤 */
const fetchDrugWarningFlags = async (): Promise<Map<string, { cannot_crush: boolean; no_antacid: boolean }>> => {
  const map = new Map<string, { cannot_crush: boolean; no_antacid: boolean }>();
  const { data, error } = await supabase
    .from('medication_drug_database')
    .select('drug_name, cannot_crush, no_antacid');
  if (error) {
    console.warn('查詢藥物警示旗標失敗:', error);
    return map;
  }
  for (const d of data || []) {
    const name = String(d.drug_name ?? '').trim();
    if (name) map.set(name, { cannot_crush: !!d.cannot_crush, no_antacid: !!d.no_antacid });
  }
  return map;
};

const buildMedicationRecordHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords: boolean,
  includeBlankRows: boolean,
  prescriptionSortOrder?: string
): Promise<string> => {
  activeFacility = await getFacilitySettings();
  const drugWarningFlags = await fetchDrugWarningFlags();
  const renderedPages: string[] = [];

  for (const patient of patients) {
    const prescriptions = (patient.prescriptions ?? []).map((p) => ({ ...p }));
    const allPrescriptionIds = prescriptions.map((p) => p.id);
    const lastTakenMap = await fetchLastTakenDatesForPrescriptions(allPrescriptionIds);
    for (const p of prescriptions) {
      p.last_taken_date = lastTakenMap.get(p.id) || p.last_taken_date || '';
      // 與藥物資料庫旗標合併（資料庫為準，處方上的旗標保留兼容）
      const flags = drugWarningFlags.get(String(p.medication_name ?? '').trim());
      if (flags) {
        p.cannot_crush = p.cannot_crush || flags.cannot_crush;
        p.no_antacid = p.no_antacid || flags.no_antacid;
      }
    }

    let workflowRecords: WorkflowRecord[] = [];
    if (includeWorkflowRecords && prescriptions.length > 0) {
      const prescriptionIds = prescriptions.map((prescription) => prescription.id);
      workflowRecords = await fetchWorkflowRecordsForMonth(patient.院友id, prescriptionIds, selectedMonth);
    }
    const staffMapping = generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords));
    const staffCount = Object.keys(staffMapping).length;

    for (const page of preparePages(patient, prescriptions, includeBlankRows, staffCount, prescriptionSortOrder)) {
      renderedPages.push(renderPage(page, selectedMonth, workflowRecords, staffMapping, includeBlankRows));
    }
  }

  return assembleDocument(renderedPages);
};

const preparePages = (
  patient: PatientWithPrescriptions,
  prescriptions: MedicationPrescription[],
  includeBlankRows: boolean,
  staffCount: number,
  prescriptionSortOrder?: string,
): PageData[] => {
  const categorized: Record<RouteKind, MedicationPrescription[]> = { oral: [], topical: [], subcutaneous: [], intramuscular: [] };
  for (const prescription of prescriptions) {
    categorized[classifyRoute(prescription)].push(prescription);
  }

  const footerLegendMm = estimateFooterLegendMm(staffCount);
  const pages: PageData[] = [];
  const oralQuantityStat = computeOralQuantityStat(categorized.oral);

  const addRoute = (routeKind: PageRouteKind, rxList: MedicationPrescription[]): void => {
    if (rxList.length === 0) return;
    const blocks = rxList.map((rx) => ({
      prescription: rx,
      timeSlots: resolvePrescriptionTimeSlots(rx),
    }));

    let grouped: PrescriptionBlock[][];
    if (prescriptionSortOrder === 'efficiency') {
      // 1) 有時段處方：按頁裝箱，直接最小化各頁彙總區不同時段數（＝簽署列數）
      const scheduled = blocks.filter((b) => b.timeSlots.length > 0);
      const noSlot = blocks.filter((b) => b.timeSlots.length === 0);
      grouped = packBlocksForSignatureEfficiency(scheduled, footerLegendMm);
      // 2) 無時段處方（零彙總列成本）按頁序 first-fit 貪心塞入各頁剩餘空間，置該頁末尾；
      //    只受 mm 限制，不受 MAX_PRESCRIPTIONS_PER_PAGE 限制；塞不下才開尾頁
      const remaining: PrescriptionBlock[] = [];
      for (const block of noSlot) {
        const blockMm = getBlockHeightMm(block);
        const target = grouped.find((page) => {
          const usedMm = page.reduce((sum, b) => sum + getBlockHeightMm(b), 0);
          return usedMm + blockMm <= bodyUsableMm(summaryRowCount(page), footerLegendMm);
        });
        if (target) target.push(block); else remaining.push(block);
      }
      if (remaining.length > 0) grouped.push(...paginateBlocks(remaining, footerLegendMm));
    } else {
      grouped = paginateBlocks(blocks, footerLegendMm);
    }

    grouped.forEach((pb, i) => {
      // 空白處方列是最後程序：在最終頁面組成後，依本頁實際剩餘高度計算可補列數
      let fillerCount = 0;
      if (includeBlankRows) {
        const realSumMm = pb.reduce((sum, b) => sum + getBlockHeightMm(b), 0);
        const usableMm = bodyUsableMm(summaryRowCount(pb), footerLegendMm);
        const roomForFillers = Math.floor((usableMm - realSumMm) / FILLER_BLOCK_MM);
        fillerCount = Math.max(0, roomForFillers);
      }
      pages.push({
        patient, routeKind, blocks: pb,
        pageIndexInRoute: i + 1, pageCountInRoute: grouped.length,
        fillerCount,
        oralQuantityStat: routeKind === 'oral' ? oralQuantityStat : undefined,
      });
    });
  };

  addRoute('oral', categorized.oral);
  addRoute('topical', categorized.topical);
  // 皮下注射 + 肌肉注射 合併至同一份注射藥紙
  addRoute('injection', [...categorized.subcutaneous, ...categorized.intramuscular]);

  return pages;
};

// ---- 版面高度常數（毫米）& 高度感知分頁（全程以 mm 精算）----
const PUNCH_ZONE_MM = 10;             // 頁頂打孔區高度（2cm，避免打孔機破壞表頭）
const PAGE_HEIGHT_MM = 206 - PUNCH_ZONE_MM; // A4橫向含2mm邊距後可用高度（206mm 扣除打孔區）
const HEADER_HEIGHT_MM = 30;          // 頂置院友資訊區實際高度（含26mm相片+邊距）
const TABLE_HEADER_MM = 9;            // colhead(5mm) + dayhead(4mm)
const ROW_SIGN_MM = 6;                // 簽署列（mr-sign-row）實際列高
const ROW_SUMMARY_MM = 6;             // 彙總列（mr-summary td）實際列高
const ROW_INSP_MM = 6;                // 檢測值列（mr-insp-body-row）實際列高
const ROW_INJECT_MM = 6;              // 注射位置列（mr-inject-body-row）實際列高
const MIN_BLOCK_MM = 16;              // 單時段處方左欄多行內容（途徑最多4行）保守高度下限
const FILLER_BLOCK_MM = MIN_SLOT_ROWS * ROW_SIGN_MM; // 一個空白處方區塊（4列）高度
const FOOTER_FIXED_MM = 4;            // 頁碼標籤高度（8pt字體≈2.82mm + 瀏覽器行高差異安全邊距）
const SAFETY_MARGIN_MM = 0;           // 移除安全邊距，讓 footer 能貼底填滿
const AM_SECTION_MIN = 2;             // 處方列上午時段區最少預留列數（≤12:00，PM 從第3行起）

// 將時間點分為上午（≤12:00）和下午（>12:00）兩組。
// 注意：故意不依賴 parseTimeToMinutes，以避免 const 初始化順序問題。
const splitAmPm = (slots: string[]): { am: string[]; pm: string[] } => {
  const am: string[] = [], pm: string[] = [];
  for (const s of slots) {
    if (!s) continue;
    const m = String(s).match(/^(\d{1,2}):(\d{2})/);
    if (m) (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) <= 720 ? am : pm).push(s);
  }
  return { am, pm };
};

// 估算 footer 左側「給藥簽署指引」文字區高度（mm）。
// 含：標題＋9個代號(約2行)＋2條註記；若有職員代號則再加標題與代號行。
const estimateFooterLegendMm = (staffCount: number): number => {
  let mm = 20; // 標題(約3.4) + 代號2行(約7.4) + 註記2行(約7) + 標籤內距(約2)
  if (staffCount > 0) {
    const staffLines = Math.ceil(staffCount / 5); // 每行約可容納 5 個代號
    mm += 4.4 + staffLines * 3.7;                 // 職員標題 + 代號各行
  }
  return mm;
};

// 給定彙總時段數，計算 body 可用高度（mm）。
// 需保留 footer（含頁碼）高度，避免頁尾被 body 擠出頁面造成裁切。
const bodyUsableMm = (summaryRows: number, footerLegendMm: number): number => {
  const footerMm = Math.max(summaryRows * ROW_SUMMARY_MM, footerLegendMm) + FOOTER_FIXED_MM;
  return PAGE_HEIGHT_MM - HEADER_HEIGHT_MM - TABLE_HEADER_MM - footerMm - SAFETY_MARGIN_MM;
};

// 計算一個處方區塊實際佔用高度（mm）。
// 採 AM/PM 分區排列：上午（≤12:00）時段占前 AM_SECTION_MIN 列起，
// 下午（>12:00）時段接續其後，整體合計不足 MIN_SLOT_ROWS（4）列時以空白列補齊。
const getBlockHeightMm = (block: PrescriptionBlock): number => {
  const inspCount = prescriptionHasInspection(block.prescription)
    ? new Set((block.prescription.inspection_rules as any[]).map((r: any) => String(r?.vital_sign_type ?? '').trim()).filter(Boolean)).size
    : 0;
  const injectRows = prescriptionIsInjection(block.prescription) ? 1 : 0;
  const rowsPerSlot = 1 + inspCount + injectRows;
  const { am, pm } = splitAmPm(block.timeSlots);
  // AM 區：實際列數（含檢測行）不足 2 列才補白；PM 區：只在合計 < MIN_SLOT_ROWS（4）時補白
  const amActualRows = am.length * rowsPerSlot;
  const amPadRows = Math.max(0, AM_SECTION_MIN - amActualRows);
  const pmActualRows = pm.length * rowsPerSlot;
  const pmPadRows = Math.max(0, MIN_SLOT_ROWS - (amActualRows + amPadRows + pmActualRows));
  return (amActualRows + amPadRows + pmActualRows + pmPadRows) * ROW_SIGN_MM;
};

// 高度感知分頁：以 mm 精算逐一偵測加入下一個處方是否超出可用高度；
// 每頁至少放 1 個處方（即使超高也不可整頁空）；同時受 MAX_PRESCRIPTIONS_PER_PAGE 上限約束。
const paginateBlocks = (
  blocks: PrescriptionBlock[],
  footerLegendMm: number,
): PrescriptionBlock[][] => {
  const result: PrescriptionBlock[][] = [];
  let current: PrescriptionBlock[] = [];
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
};

// 彙總區行數配置：按實際 AM/PM 時段數，PM 最少從第 3 列開始，
// 若上午時段數超過 2 個則順延；不再強制兩邊對稱填滿。
const computeSummaryLayout = (am: string[], pm: string[]): { totalRows: number; amRows: number; pmRows: number; pmStartRow: number } => {
  const amRows = am.length;
  const pmRows = pm.length;
  const pmStartRow = Math.max(SUMMARY_PM_MIN_START_ROW, amRows + 1);
  const totalRows = Math.max(pmStartRow + pmRows - 1, amRows, SUMMARY_MIN_ROWS);
  return { totalRows, amRows, pmRows, pmStartRow };
};

const summaryRowCount = (blocks: PrescriptionBlock[]): number => {
  const allSlots = [...new Set(blocks.flatMap((b) => b.timeSlots).filter(Boolean))];
  const { am, pm } = splitAmPm(allSlots);
  return computeSummaryLayout(am, pm).totalRows;
};

// ---- 服藥前檢測項 ----

const INSPECTION_OPERATOR_LABELS: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤' };
const INSPECTION_ACTION_LABELS: Record<string, string> = { block_dispensing: '停服' };

const prescriptionHasInspection = (prescription: MedicationPrescription): boolean =>
  Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.length > 0;

// 判斷處方是否為注射（皮下／肌肉／舊版「注射」）——注射藥紙需在每時段下方加「注射位置」列
const prescriptionIsInjection = (prescription: MedicationPrescription): boolean =>
  /注射/.test(String(prescription.administration_route ?? ''));

const formatInspectionRequirement = (prescription: MedicationPrescription): string => {
  if (!prescriptionHasInspection(prescription)) return '';
  const parts = prescription.inspection_rules.map((rule: any) => {
    const condition = `${rule.vital_sign_type ?? ''}${INSPECTION_OPERATOR_LABELS[rule.condition_operator] ?? ''}${rule.condition_value ?? ''}`;
    const action = INSPECTION_ACTION_LABELS[rule.action_if_met ?? ''] ?? '';
    return action ? `${condition} ${action}` : condition;
  });
  return `服藥前檢測：${parts.join('、')}`;
};

const parseInspectionResult = (record: WorkflowRecord | null): any => {
  if (!record || !record.inspection_check_result) return null;
  try {
    return typeof record.inspection_check_result === 'string'
      ? JSON.parse(record.inspection_check_result)
      : record.inspection_check_result;
  } catch {
    return null;
  }
};

const formatInspectionValue = (record: WorkflowRecord | null): string => {
  const result = parseInspectionResult(record);
  if (!result) return '';
  if (result.isHospitalized) return 'A';
  const data = result.usedVitalSignData;
  if (data && typeof data === 'object') {
    const values = Object.values(data).filter((value) => value != null && String(value).trim() !== '');
    if (values.length > 0) return values.map((value) => String(value)).join('/');
  }
  return '';
};

const TIME_SLOT_LABEL_TO_TIME: Record<string, string> = {
  '餐前': '07:00',
  '早餐前': '07:00',
  '午餐前': '11:00',
  '晚餐前': '17:00',
  '進餐時': '08:00',
  '早餐時': '08:00',
  '午餐時': '12:00',
  '晚餐時': '16:00',
  '餐後': '09:00',
  '早餐後': '09:00',
  '午餐後': '13:00',
  '晚餐後': '18:00',
  '早上': '08:00',
  '中午': '12:00',
  '晚上': '20:00',
  '睡前': '20:00',
};

const normalizeTimeSlotValue = (slot: unknown): string => {
  const raw = String(slot ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return TIME_SLOT_LABEL_TO_TIME[raw] ?? raw;
};

export const resolvePrescriptionTimeSlots = (prescription: MedicationPrescription): string[] => {
  const rawSlots = Array.isArray(prescription.medication_time_slots)
    ? prescription.medication_time_slots
    : [];
  // 直接以 medication_time_slots 為準；meal_timing（如「晚上」）不再回填自動時段，兩者無關
  return sortDistinctTimeSlots(rawSlots.map(normalizeTimeSlotValue).filter(Boolean));
};

/**
 * 簽署效益裝箱：以「哪幾個時段組放同一頁」為決策單位。
 * 貪心逐組放置是局部最優、會錯失全域最優（例如詹金花個案：三大單時段組先佔頁，
 * 令 {08:00,20:00} 無家可歸要多開一頁，合計 8 列；全域最優只需 7 列），
 * 故改用深度優先搜尋列舉所有「組→頁」整組分配（組數一般 ≤ 8，搜尋空間小）：
 * 先最小化各頁彙總區不同時段數總和（＝簽署列數），其次頁數最少。
 * 最後同頁處方按時序（首時段 → 時段組合 → 藥名）排列。
 */
export const packBlocksForSignatureEfficiency = (
  blocks: PrescriptionBlock[],
  footerLegendMm: number
): PrescriptionBlock[][] => {
  if (blocks.length === 0) return [];

  const blockMm = new Map<PrescriptionBlock, number>();
  for (const b of blocks) blockMm.set(b, getBlockHeightMm(b));

  const pageUsedMm = (page: PrescriptionBlock[]): number =>
    page.reduce((sum, b) => sum + (blockMm.get(b) ?? 0), 0);
  const pageCapacityMm = (union: Set<string>): number => {
    const { am, pm } = splitAmPm([...union]);
    return bodyUsableMm(computeSummaryLayout(am, pm).totalRows, footerLegendMm);
  };
  const unionOf = (page: PrescriptionBlock[]): Set<string> =>
    new Set(page.flatMap((b) => b.timeSlots));

  interface Group { slots: string[]; items: PrescriptionBlock[]; mm: number }

  // 依時段集合分組（組內保持原順序）
  const bySig = new Map<string, Group>();
  for (const b of blocks) {
    const sig = b.timeSlots.join('|');
    const g = bySig.get(sig) ?? { slots: b.timeSlots, items: [], mm: 0 };
    g.items.push(b);
    g.mm += blockMm.get(b) ?? 0;
    bySig.set(sig, g);
  }

  // 放不進單一新頁的超大組，先按新頁容量切成數段（每段視為一個組）
  const groups: Group[] = [];
  for (const g of bySig.values()) {
    let chunk: PrescriptionBlock[] = [];
    let chunkMm = 0;
    const capMm = pageCapacityMm(new Set(g.slots));
    for (const item of g.items) {
      const m = blockMm.get(item) ?? 0;
      if (chunk.length > 0 && (chunk.length >= MAX_PRESCRIPTIONS_PER_PAGE || chunkMm + m > capMm)) {
        groups.push({ slots: g.slots, items: chunk, mm: chunkMm });
        chunk = [];
        chunkMm = 0;
      }
      chunk.push(item);
      chunkMm += m;
    }
    if (chunk.length > 0) groups.push({ slots: g.slots, items: chunk, mm: chunkMm });
  }
  // 大組優先（搜尋更快收斂），平手按時段字串
  groups.sort((a, b) => b.items.length - a.items.length || a.slots.join('|').localeCompare(b.slots.join('|')));

  // 同頁按時序排列
  const sortPageChronologically = (page: PrescriptionBlock[]): PrescriptionBlock[] =>
    [...page].sort((a, b) => {
      const tCmp = parseTimeToMinutes(a.timeSlots[0]) - parseTimeToMinutes(b.timeSlots[0]);
      if (tCmp !== 0) return tCmp;
      const sigCmp = a.timeSlots.join('|').localeCompare(b.timeSlots.join('|'));
      if (sigCmp !== 0) return sigCmp;
      return String(a.prescription.medication_name ?? '').localeCompare(String(b.prescription.medication_name ?? ''));
    });

  // 頁面層級時序：同頁排完後，取每頁第一列處方的第一個時間點排序，最早的做第一頁；
  // 全無時段的頁（無時段 PRN 尾頁）排最後，同 key 保持原順序
  const sortPagesChronologically = (pages: PrescriptionBlock[][]): PrescriptionBlock[][] =>
    pages
      .map((page, idx) => ({
        page,
        idx,
        key: page.length > 0 && page[0].timeSlots.length > 0 ? parseTimeToMinutes(page[0].timeSlots[0]) : Infinity,
      }))
      .sort((a, b) => a.key - b.key || a.idx - b.idx)
      .map((x) => x.page);

  // 極端多時段組的罕見情況：退化为順序貪心，避免搜尋爆炸
  if (groups.length > 12) {
    const pages: PrescriptionBlock[][] = [];
    for (const g of groups) {
      let placed = false;
      for (const page of pages) {
        const newUnion = new Set([...unionOf(page), ...g.slots]);
        if (page.length + g.items.length <= MAX_PRESCRIPTIONS_PER_PAGE
          && pageUsedMm(page) + g.mm <= pageCapacityMm(newUnion)) {
          page.push(...g.items);
          placed = true;
          break;
        }
      }
      if (!placed) pages.push([...g.items]);
    }
    return sortPagesChronologically(pages.map(sortPageChronologically));
  }

  // DFS 列舉所有整組分配，取全域最優
  let bestPages: PrescriptionBlock[][] | null = null;
  let bestRows = Infinity;

  const dfs = (gi: number, pages: PrescriptionBlock[][], rowsSoFar: number): void => {
    // 下界剪枝：各頁聯集只會變大，rowsSoFar 只增不減
    if (rowsSoFar > bestRows) return;
    if (bestPages && rowsSoFar === bestRows && pages.length >= bestPages.length) return;
    if (gi === groups.length) {
      bestRows = rowsSoFar;
      bestPages = pages.map((p) => [...p]);
      return;
    }
    const g = groups[gi];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].length + g.items.length > MAX_PRESCRIPTIONS_PER_PAGE) continue;
      const oldSize = unionOf(pages[i]).size;
      const newUnion = new Set([...unionOf(pages[i]), ...g.slots]);
      if (pageUsedMm(pages[i]) + g.mm > pageCapacityMm(newUnion)) continue;
      pages[i].push(...g.items);
      dfs(gi + 1, pages, rowsSoFar - oldSize + newUnion.size);
      pages[i].splice(pages[i].length - g.items.length, g.items.length);
    }
    // 開新頁
    pages.push([...g.items]);
    dfs(gi + 1, pages, rowsSoFar + g.slots.length);
    pages.pop();
  };
  dfs(0, [], 0);

  return sortPagesChronologically((bestPages ?? []).map(sortPageChronologically));
};

/**
 * 按簽署效益排序：與匯出分頁共用 packBlocksForSignatureEfficiency 的裝箱結果（展平），
 * 使 modal 預覽順序＝列印順序。無時段處方（零彙總列成本）排最後，供匯出時貪心填入各頁空隙。
 */
export const orderPrescriptionsForSignatureEfficiency = <T>(prescriptions: T[]): T[] => {
  const withSlots = (prescriptions ?? []).map((p) => ({
    item: p,
    slots: resolvePrescriptionTimeSlots(p as MedicationPrescription),
  }));
  const noSlot = withSlots.filter((x) => x.slots.length === 0);
  const blocks = withSlots
    .filter((x) => x.slots.length > 0)
    .map((x) => ({ prescription: x.item as MedicationPrescription, timeSlots: x.slots }));
  // modal 無職員代號資料，以 0 人估算 footer 高度
  const packed = packBlocksForSignatureEfficiency(blocks, estimateFooterLegendMm(0));
  return [...packed.flat().map((b) => b.prescription as T), ...noSlot.map((x) => x.item)];
};

const getMealTimingLabel = (prescription: MedicationPrescription): string => {
  const raw = String(prescription.meal_timing ?? '').trim();
  if (raw) return raw;

  const rawSlots = Array.isArray(prescription.medication_time_slots)
    ? prescription.medication_time_slots
    : [];
  // 若資料只存文字時段（例如 晚上/餐前），可回填到「途徑/次數」欄
  const textualSlots = [...new Set(rawSlots
    .map((s) => String(s ?? '').trim())
    .filter((s) => s && !/^\d{1,2}:\d{2}/.test(s)))];
  return textualSlots.join('、');
};

const sortDistinctTimeSlots = (slots: string[]): string[] => {
  const distinct = [...new Set((slots ?? []).map((slot) => normalizeTimeSlotValue(slot)).filter(Boolean))];
  return distinct.sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
};

// 將 "HH:mm" 轉為短標籤：上午加 A、下午加 P，並以 12 小時制顯示（08:00→8A、10:00→10A、16:00→4P）
const formatSlotShortLabel = (slot: string): string => {
  const match = String(slot ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return slot;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const suffix = hour < 12 ? 'A' : 'P';
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return minute === '00' ? `${hour12}${suffix}` : `${hour12}:${minute}${suffix}`;
};

// 統計全部口服藥物中單位為「粒」的藥物，於各時間點的總數量（如：藥物數量統計 8A(10) 10A(5.5) 4P(6)）
const computeOralQuantityStat = (oralPrescriptions: MedicationPrescription[]): string => {
  const totals = new Map<string, number>();
  for (const rx of oralPrescriptions) {
    const unit = String(rx.dosage_unit ?? '').trim();
    if (unit !== '粒') continue;
    const amount = parseFloat(String(rx.dosage_amount ?? ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    for (const slot of resolvePrescriptionTimeSlots(rx)) {
      totals.set(slot, (totals.get(slot) ?? 0) + amount);
    }
  }
  if (totals.size === 0) return '';
  const sortedSlots = [...totals.keys()].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  const parts = sortedSlots.map((slot) => {
    const total = totals.get(slot) ?? 0;
    const totalStr = Number.isInteger(total) ? String(total) : String(parseFloat(total.toFixed(2)));
    return `${formatSlotShortLabel(slot)}(${totalStr})`;
  });
  return `藥物數量統計 ${parts.join(' ')}`;
};

const classifyRoute = (prescription: MedicationPrescription): RouteKind => {
  const route = String(prescription.administration_route ?? '').trim().toLowerCase();
  if (route.includes('皮下注射')) return 'subcutaneous';
  if (route.includes('注射')) return 'intramuscular'; // 肌肉注射及舊版「注射」
  if (
    route === '口服' ||
    route.includes('舌下') ||
    route.includes('漱口') ||
    route === 'sl' ||
    route.includes('sublingual')
  ) return 'oral';
  if (!route) return 'oral';
  return 'topical';
};

const renderPage = (
  page: PageData,
  selectedMonth: string,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  includeBlankRows: boolean
): string => {
  const dayCount = getDaysInMonth(selectedMonth);
  const pageLabel = `${ROUTE_SHEET_LABELS[page.routeKind]} 共${page.pageIndexInRoute}/${page.pageCountInRoute}頁`;

  return '<section class="mr-page">'
    + '<div class="mr-punch-zone" aria-hidden="true"><div class="mr-punch-hole"></div><div class="mr-punch-hole"></div></div>'
    + renderHeaderRegion(page.patient, page.routeKind, selectedMonth)
    + `<div class="mr-body">${renderBodyTable(page, selectedMonth, dayCount, workflowRecords, staffMapping, includeBlankRows)}</div>`
    + '<div class="mr-top-spacer"></div>'
    + renderFooterRegion(page, selectedMonth, dayCount, workflowRecords, staffMapping, pageLabel)
    + '</section>';
};

// ---- 頂置院友資訊區 ----

const formatYearMonth = (selectedMonth: string): string => {
  const [year, month] = selectedMonth.split('-').map(Number);
  return `${year}年${month}月`;
};

const renderHeaderRegion = (patient: PatientWithPrescriptions, routeKind: PageRouteKind, selectedMonth: string): string => {
  const name = patient.中文姓氏 != null || patient.中文名字 != null
    ? `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`
    : (patient.中文姓名 ?? '');
  const photo = patient.院友相片;
  const allergyText = joinList(patient.藥物敏感) || 'NKDA';
  const adverseDrugReactionText = joinList(patient.不良藥物反應) || 'NKADR';
  const photoHtml = photo
    ? `<img class="mr-photo" src="${escapeAttr(String(photo))}" alt="">`
    : '<div class="mr-photo mr-photo-empty">相片</div>';

  const facilityNameZh = activeFacility.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh;

  return '<header class="mr-header">'
    + '<table class="mr-header-table"><colgroup>'
      + '<col class="mr-hc-title"><col class="mr-hc-photo">'
      + '<col class="mr-hc-info"><col class="mr-hc-info"><col class="mr-hc-react">'
    + '</colgroup><tbody>'
      + '<tr>'
        + `<td class="mr-h-title"><div class="mr-org">${escapeHtml(facilityNameZh)}</div><div class="mr-doc">個人備藥及給藥記錄</div></td>`
        + `<td class="mr-h-photo" rowspan="2">${photoHtml}</td>`
        + infoCell('院友姓名', name)
        + infoCell('院號', getPrintBedNumber(patient))
        + reactCell('藥物過敏反應', allergyText)
      + '</tr>'
      + '<tr>'
        + `<td class="mr-h-subtitle"><div class="mr-subtitle">${escapeHtml(formatYearMonth(selectedMonth))} ${escapeHtml(ROUTE_SUBTITLES[routeKind])}</div></td>`
        + infoCell('性別 / 年齡', formatGenderAge(patient))
        + infoCell('出生日期', formatDate(patient.出生日期))
        + reactCell('藥物不良反應', adverseDrugReactionText)
      + '</tr>'
    + '</tbody></table>'
  + '</header>';
};

const infoCell = (label: string, value: string): string =>
  `<td class="mr-h-info"><span class="mr-info-label">${escapeHtml(label)}：</span><span class="mr-info-value">${escapeHtml(value)}</span></td>`;

const reactCell = (label: string, value: string): string =>
  `<td class="mr-h-info mr-h-react"><span class="mr-info-label">${escapeHtml(label)}：</span><span class="mr-info-value">${escapeHtml(value)}</span></td>`;

// ---- 中間動態處方區 ----

const colGroup = (dayCount: number): string => {
  let cols = '<col class="c-date"><col class="c-name"><col class="c-route"><col class="c-time">';
  for (let day = 0; day < dayCount; day += 1) cols += '<col class="c-day">';
  return `<colgroup>${cols}</colgroup>`;
};

const dayNumberCells = (dayCount: number): string => {
  let cells = '';
  for (let day = 1; day <= dayCount; day += 1) cells += `<th class="c-day">${day}</th>`;
  return cells;
};

const renderBodyTable = (
  page: PageData,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  includeBlankRows: boolean
): string => {
  const header = '<thead>'
    + '<tr class="mr-colhead">'
      + '<th class="c-date" rowspan="2">開始 / 處方日期</th>'
      + '<th class="c-name" rowspan="2">藥物名稱及劑型</th>'
      + '<th class="c-route" rowspan="2">途徑 / 次數</th>'
      + '<th class="c-time" rowspan="2">時間</th>'
      + `<th class="mr-sign-head" colspan="${dayCount}">執 / 核藥職員簽署</th>`
    + '</tr>'
    + `<tr class="mr-dayhead">${dayNumberCells(dayCount)}</tr>`
  + '</thead>';

  const body = page.blocks
    .map((block) => {
      const admissionDateIso = toIsoDate(page.patient.入住日期);
      const blockRows = renderPrescriptionBlock(block, selectedMonth, dayCount, workflowRecords, staffMapping, admissionDateIso);
      return `<tbody class="mr-prescription-body">${blockRows}</tbody>`;
    })
    .join('');

  // 填充空白處方列：依本頁實際剩餘高度計算（preparePages 已算好 fillerCount，避免擠爆 footer）
  const missingSlots = includeBlankRows ? page.fillerCount : 0;
  let fillerBodies = '';
  if (missingSlots > 0) {
    const dayCells = Array(dayCount).fill(`<td class="c-day mr-diag">${renderDiagonalSvg('#9aa7b4')}</td>`).join('');
    // c-date 保留 4 行獨立格，行間無橫線；第 1 行「開始日期」、第 3 行「處方日期」作提示文字
    // c-name / c-route 仍以 rowspan=MIN_SLOT_ROWS 合併
    const fillerRow1 = `<tr class="mr-sign-row mr-filler-row">`
      + `<td class="c-date mr-filler-date">開始日期</td>`
      + `<td class="c-name" rowspan="${MIN_SLOT_ROWS}">&nbsp;</td>`
      + `<td class="c-route" rowspan="${MIN_SLOT_ROWS}">&nbsp;</td>`
      + `<td class="c-time">&nbsp;</td>${dayCells}</tr>`;
    const fillerRow2 = `<tr class="mr-sign-row mr-filler-row"><td class="c-date mr-filler-date mr-filler-nobt">&nbsp;</td><td class="c-time">&nbsp;</td>${dayCells}</tr>`;
    const fillerRow3 = `<tr class="mr-sign-row mr-filler-row"><td class="c-date mr-filler-date mr-filler-nobt">處方日期</td><td class="c-time">&nbsp;</td>${dayCells}</tr>`;
    const fillerRow4 = `<tr class="mr-sign-row mr-filler-row"><td class="c-date mr-filler-date mr-filler-nobt">&nbsp;</td><td class="c-time">&nbsp;</td>${dayCells}</tr>`;
    const fillerBlock = fillerRow1 + fillerRow2 + fillerRow3 + fillerRow4;
    fillerBodies = Array(missingSlots).fill(`<tbody class="mr-filler-block">${fillerBlock}</tbody>`).join('');
  }

  // 每個處方區塊各自包裹在 <tbody> 中，以便 CSS 選取相鄰 tbody 加深分隔線
  return `<table class="mr-grid">${colGroup(dayCount)}${header}${body}${fillerBodies}</table>`;
};

const renderPrescriptionBlock = (
  block: PrescriptionBlock,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  admissionDateIso = ''
): string => {
  const { prescription, timeSlots } = block;

  // 開始日期：CSV 已提供者直接顯示；只有缺值才顯示「不詳」
  const startDateLabel = prescription.start_date
    ? formatDate(prescription.start_date)
    : '不詳';
  const dateInfo = `<div>開始日期：${escapeHtml(startDateLabel)}</div>`
    + `<div>處方日期：${escapeHtml(formatDate(prescription.prescription_date))}</div>`;
  const inspectionRequirement = formatInspectionRequirement(prescription);
  const mealTimingLabel = getMealTimingLabel(prescription);
  const termLabel = (() => {
    // 用戶定義：有結束日期的就是短期，沒有結束日期的就是長期。
    if (prescription.status === 'inactive') return '停用處方';
    if (prescription.status === 'active' && prescription.end_date) {
      return isPrescriptionExpired(prescription)
        ? '已逾期'
        : '短期藥物';
    }
    return '';
  })();
  const lastTakenLine = (prescription.show_last_taken_in_record && prescription.last_taken_date)
    ? `<div class="mr-med-last-taken" style="color: #2563eb; font-weight: bold;">上次服用：${formatDisplayDate(prescription.last_taken_date)}</div>`
    : '';
  // 名稱欄小標籤：不可碎藥／不可與中和胃酸藥同服
  const warningTags = [
    prescription.cannot_crush ? '不可碎藥' : '',
    prescription.no_antacid ? '不可與中和胃酸藥同服' : '',
  ].filter(Boolean).map((t) => `<span class="mr-med-warning-tag">${t}</span>`).join('');
  const nameInfo = `<div class="mr-med-name">${escapeHtml(prescription.medication_name ?? '')}${termLabel ? `<span class="mr-med-short">${termLabel}</span>` : ''}${warningTags}</div>`
    + (prescription.dosage_form ? `<div class="mr-med-form">${escapeHtml(String(prescription.dosage_form))}</div>` : '')
    + lastTakenLine
    + (inspectionRequirement ? `<div class="mr-med-test">${escapeHtml(inspectionRequirement)}</div>` : '')
    + (() => {
      const sourceParts = [prescription.medication_source, prescription.medication_source_specialty].filter(Boolean);
      return sourceParts.length > 0
        ? `<div class="mr-med-source">來源：${escapeHtml(sourceParts.join(' / '))}</div>`
        : '';
    })();
  // 「每次」頻率：份量直接併入同一行（如「每次1粒」），不另開一行
  const isEachTime = prescription.frequency_type === 'each_time';
  const frequencyLine = isEachTime
    ? (prescription.special_dosage_instruction
        ? `每次${prescription.special_dosage_instruction}`
        : (getDosageText(prescription) || '每次'))
    : getFrequencyDescription(prescription);
  const routeInfo = [
    prescription.administration_route ?? '',
    frequencyLine,
    mealTimingLabel,
    isEachTime ? '' : getDosageText(prescription),
    prescription.is_prn ? '需要時' : '',
  ]
    .filter((line) => line != null && String(line).trim() !== '')
    .map((line) => `<div>${escapeHtml(String(line))}</div>`)
    .join('');
  const isImmediate = prescription.preparation_method === 'immediate';
  const diagClass = isImmediate ? 'mr-diag-prn' : 'mr-diag';

  // 每個處方的檢測項類型（不重複），各自在時段下方加一行。
  const inspectionTypes: string[] = prescriptionHasInspection(prescription)
    ? [...new Set((prescription.inspection_rules as any[])
        .map((r: any) => String(r?.vital_sign_type ?? '').trim()).filter(Boolean))]
    : [];
  // 注射處方：於每時段下方加一行「注射位置」
  const isInjection = prescriptionIsInjection(prescription);
  const rowsPerSlot = 1 + inspectionTypes.length + (isInjection ? 1 : 0);

  // AM/PM 分區：上午（≤12:00）先、下午（>12:00）後。
  // 規則：AM 區含檢測行共計最少 2 列；整體合計最少 MIN_SLOT_ROWS（4）列。
  // 檢測行已計入列數，不另重複補白。
  const { am, pm } = splitAmPm(timeSlots);
  const amActualRows = am.length * rowsPerSlot;
  const amPadRows = Math.max(0, AM_SECTION_MIN - amActualRows);  // AM 不足 2 列才補
  const pmActualRows = pm.length * rowsPerSlot;
  const pmPadRows = Math.max(0, MIN_SLOT_ROWS - (amActualRows + amPadRows + pmActualRows));  // 合計不足 4 才補
  const totalRowCount = amActualRows + amPadRows + pmActualRows + pmPadRows;

  const boundary = getBoundaryCells(prescription, timeSlots, selectedMonth, dayCount);
  // 補白列的日格：白底＋斜線，與空白處方格相同（不用灰格）
  const padDayCells = Array(dayCount).fill(`<td class="c-day ${diagClass}">${renderDiagonalSvg('#9aa7b4')}</td>`).join('');

  let isFirstRow = true;
  const leftFor = (): string => {
    if (!isFirstRow) return '';
    isFirstRow = false;
    return `<td class="c-date" rowspan="${totalRowCount}">${dateInfo}</td>`
      + `<td class="c-name" rowspan="${totalRowCount}">${nameInfo}</td>`
      + `<td class="c-route" rowspan="${totalRowCount}">${routeInfo || '&nbsp;'}</td>`;
  };
  const rows: string[] = [];

  // --- AM 時段（依序渲染簽署列＋檢測列）---
  for (const slot of am) {
    rows.push(`<tr class="mr-sign-row">${leftFor()}<td class="c-time">${escapeHtml(formatTimeSlot(slot))}</td>${signatureDayCells(prescription, slot, selectedMonth, dayCount, workflowRecords, staffMapping, boundary)}</tr>`);
    for (const inspType of inspectionTypes) {
      rows.push(renderBodyInspectionRow(block, slot, inspType, selectedMonth, dayCount, workflowRecords));
    }
    if (isInjection) {
      rows.push(renderBodyInjectionRow(block, slot, selectedMonth, dayCount, workflowRecords));
    }
  }
  for (let i = 0; i < amPadRows; i++) {
    rows.push(`<tr class="mr-sign-row">${leftFor()}<td class="c-time">&nbsp;</td>${padDayCells}</tr>`);
  }

  // --- PM 時段 ---
  for (const slot of pm) {
    rows.push(`<tr class="mr-sign-row">${leftFor()}<td class="c-time">${escapeHtml(formatTimeSlot(slot))}</td>${signatureDayCells(prescription, slot, selectedMonth, dayCount, workflowRecords, staffMapping, boundary)}</tr>`);
    for (const inspType of inspectionTypes) {
      rows.push(renderBodyInspectionRow(block, slot, inspType, selectedMonth, dayCount, workflowRecords));
    }
    if (isInjection) {
      rows.push(renderBodyInjectionRow(block, slot, selectedMonth, dayCount, workflowRecords));
    }
  }
  for (let i = 0; i < pmPadRows; i++) {
    rows.push(`<tr class="mr-sign-row">${leftFor()}<td class="c-time">&nbsp;</td>${padDayCells}</tr>`);
  }

  return rows.join('');
};

// 處方區檢測值子列：顯示在對應時段正下方，不加斜線；數值不合格（canDispense===false）標紅。
const renderBodyInspectionRow = (
  block: PrescriptionBlock,
  slot: string,
  vitalSignType: string,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[]
): string => {
  const { prescription } = block;
  let dayCells = '';
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    let content = '';
    let isFailed = false;
    const inRange = slot && block.timeSlots.includes(slot) && isDateInPrescriptionRange(dateStr, slot, prescription);
    if (inRange) {
      const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
      if (record) {
        const result = parseInspectionResult(record);
        if (result) {
          if (result.isHospitalized) {
            content = 'A';
          } else {
            const data = result.usedVitalSignData;
            if (data && typeof data === 'object') {
              const direct = data[vitalSignType];
              if (direct != null && String(direct).trim()) {
                content = String(direct);
              } else {
                const vals = Object.values(data).filter((v) => v != null && String(v).trim() !== '');
                if (vals.length > 0) content = vals.map(String).join('/');
              }
            }
            isFailed = result.canDispense === false;
          }
        }
      }
    }
    const cellClass = `c-day${isFailed ? ' mr-insp-fail' : ''}${!inRange ? ' mr-inactive' : ''}`;
    dayCells += `<td class="${cellClass}">${content ? escapeHtml(content) : '&nbsp;'}</td>`;
  }
  return `<tr class="mr-insp-body-row"><td class="c-time mr-insp-type">${escapeHtml(vitalSignType)}</td>${dayCells}</tr>`;
};

// 處方區注射位置子列：顯示在對應時段正下方，各日格顯示該日注射站點（如 C3）。
// 結構與檢測值列（renderBodyInspectionRow）完全相同：在時間欄插入「注射位置」標籤列。
const renderBodyInjectionRow = (
  block: PrescriptionBlock,
  slot: string,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[]
): string => {
  const { prescription } = block;
  let dayCells = '';
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    let content = '';
    const inRange = slot && block.timeSlots.includes(slot) && isDateInPrescriptionRange(dateStr, slot, prescription);
    if (inRange) {
      const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
      if (record && record.notes) {
        const match = String(record.notes).match(/注射位置[：:]\s*([^|]+)/);
        if (match) content = match[1].trim();
      }
    }
    const cellClass = `c-day${!inRange ? ' mr-inactive' : ''}`;
    dayCells += `<td class="${cellClass}">${content ? escapeHtml(content) : '&nbsp;'}</td>`;
  }
  return `<tr class="mr-inject-body-row"><td class="c-time mr-insp-type">注射位置</td>${dayCells}</tr>`;
};

// 計算處方邊界標記格：▶ = 開始前 N 格，◀ = 結束後 N 格（N = 此處方所有日內時段數）。
const getBoundaryCells = (
  prescription: MedicationPrescription,
  slots: string[],
  selectedMonth: string,
  dayCount: number
): { before: Set<string>; after: Set<string> } => {
  const before = new Set<string>();
  const after = new Set<string>();
  const effectiveSlots = slots.filter((s) => s && s.trim());
  if (effectiveSlots.length === 0) return { before, after };
  const N = effectiveSlots.length;
  const allCells: Array<[string, string]> = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    for (const s of effectiveSlots) allCells.push([dateStr, s]);
  }
  let firstActiveIdx = -1;
  for (let i = 0; i < allCells.length; i += 1) {
    if (isDateInPrescriptionDateRange(allCells[i][0], allCells[i][1], prescription)) { firstActiveIdx = i; break; }
  }
  let lastActiveIdx = -1;
  for (let i = allCells.length - 1; i >= 0; i -= 1) {
    if (isDateInPrescriptionDateRange(allCells[i][0], allCells[i][1], prescription)) { lastActiveIdx = i; break; }
  }
  if (firstActiveIdx > 0) {
    for (let i = Math.max(0, firstActiveIdx - N); i < firstActiveIdx; i += 1) {
      before.add(`${allCells[i][0]}__${allCells[i][1]}`);
    }
  }
  // ◀（結束後）只在處方「確有結束日」時標記；無 end_date 的長期處方不標，避免月尾非服藥日誤畫箭頭
  if (prescription.end_date && lastActiveIdx >= 0 && lastActiveIdx < allCells.length - 1) {
    for (let i = lastActiveIdx + 1; i <= Math.min(allCells.length - 1, lastActiveIdx + N); i += 1) {
      after.add(`${allCells[i][0]}__${allCells[i][1]}`);
    }
  }
  return { before, after };
};

// 從工作流記錄提取執藥者、核藥者代號（供四象限格渲染）。
// 規則：四象限格僅映射執藥/核藥；派藥結果代號（A/S/R/O/HL）只在彙總區顯示。
const getWorkflowCellParts = (
  record: WorkflowRecord | null,
  staffMapping: StaffCodeMapping
): { prep: string; verify: string } => {
  if (!record) return { prep: '', verify: '' };
  const prep = record.preparation_status === 'completed' && record.preparation_staff
    ? (staffMapping[record.preparation_staff] ?? '') : '';
  const verify = record.verification_status === 'completed' && record.verification_staff
    ? (staffMapping[record.verification_staff] ?? '') : '';
  return { prep, verify };
};

const signatureDayCells = (
  prescription: MedicationPrescription,
  slot: string,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  boundary: { before: Set<string>; after: Set<string> }
): string => {
  const isImmediate = prescription.preparation_method === 'immediate';
  const diagClass = isImmediate ? 'mr-diag-prn' : 'mr-diag';
  let cells = '';
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    let cellInner = '';
    let isBoundary = false;
    const inRange = slot && isDateInPrescriptionRange(dateStr, slot, prescription);
    if (inRange) {
      const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
      const { prep, verify } = getWorkflowCellParts(record, staffMapping);
      cellInner = (prep ? `<span class="mr-cell-prep">${escapeHtml(prep)}</span>` : '')
        + (verify ? `<span class="mr-cell-verify">${escapeHtml(verify)}</span>` : '');
    } else {
      const key = `${dateStr}__${slot}`;
      if (boundary.before.has(key)) {
        cellInner = '<span class="mr-cell-special">▶</span>'; isBoundary = true;
      } else if (boundary.after.has(key)) {
        cellInner = '<span class="mr-cell-special">◀</span>'; isBoundary = true;
      }
    }
    const inactiveClass = !inRange ? (isImmediate ? ' mr-inactive-prn' : ' mr-inactive') : '';
    const boundaryClass = isBoundary ? ' mr-boundary' : '';
    const diagColor = '#9aa7b4';
    cells += `<td class="c-day ${diagClass}${inactiveClass}${boundaryClass}">${renderDiagonalSvg(diagColor)}${cellInner || '&nbsp;'}</td>`;
  }
  return cells;
};

// ---- 底部指引＋給藥彙總區 ----

const renderFooterRegion = (
  page: PageData,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  pageLabel: string
): string => {
  const pageSlots = sortDistinctTimeSlots(page.blocks.flatMap((block) => block.timeSlots));
  const { am: amPageSlots, pm: pmPageSlots } = splitAmPm(pageSlots);
  const { amRows, pmRows, totalRows, pmStartRow } = computeSummaryLayout(amPageSlots, pmPageSlots);
  // 按列號放置 AM/PM 時段：AM 從第 1 列起，PM 從第 pmStartRow 列起，中間留空
  const summarySlots: string[] = new Array(totalRows).fill('');
  for (let i = 0; i < amPageSlots.length; i++) summarySlots[i] = amPageSlots[i];
  for (let i = 0; i < pmPageSlots.length; i++) summarySlots[pmStartRow - 1 + i] = pmPageSlots[i];

  const legendCodes = '<div class="mr-legend-codes">'
    + DISPENSE_CODE_ITEMS.map((item) => `<span>${escapeHtml(item)}</span>`).join('')
    + '</div>';
  const legendNotes = DISPENSE_NOTE_ITEMS
    .map((item) => `<div class="mr-legend-note">${escapeHtml(item)}</div>`)
    .join('');
  const staffEntries = Object.entries(staffMapping);
  const staffCodesHtml = staffEntries.length > 0
    ? '<div class="mr-staff-title">職員簽署代號</div>'
      + '<div class="mr-staff-codes">'
      + staffEntries.map(([name, code]) => `<span>${escapeHtml(code)}＝${escapeHtml(name)}</span>`).join('')
      + '</div>'
    : '';
  const legendHtml = '<div class="mr-legend-title">給藥簽署指引</div>'
    + legendCodes
    + legendNotes
    + staffCodesHtml
    + (page.oralQuantityStat ? `<div class="mr-legend-qty">${escapeHtml(page.oralQuantityStat)}</div>` : '');

  const rows: string[] = [];
  let labelEmitted = false;
  for (const slot of summarySlots) {
    const labelCell = labelEmitted
      ? ''
      : `<td class="mr-sum-label" colspan="3" rowspan="${totalRows}"><div class="mr-legend-wrap">${legendHtml}</div></td>`;
    labelEmitted = true;

    const timeCell = `<td class="c-time">${escapeHtml(formatTimeSlot(slot))}</td>`;
    const dayCells = dispenseDayCells(page.blocks, slot, selectedMonth, dayCount, workflowRecords, staffMapping);
    rows.push(`<tr class="mr-sum-row">${labelCell}${timeCell}${dayCells}</tr>`);

  }

  const summaryTable = `<table class="mr-grid mr-summary">${colGroup(dayCount)}<tbody>${rows.join('')}</tbody></table>`;

  return '<footer class="mr-footer-region">'
    + summaryTable
    + `<div class="mr-pagelabel">${escapeHtml(pageLabel)}</div>`
  + '</footer>';
};

const dispenseDayCells = (
  blocks: PrescriptionBlock[],
  slot: string,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping
): string => {
  const blockBoundaries = blocks.map((block) => ({
    block,
    boundary: getBoundaryCells(block.prescription, block.timeSlots, selectedMonth, dayCount),
  }));
  const isBlankSummaryRow = !slot || String(slot).trim() === '';
  let cells = '';
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    let content = '';
    let anyInRange = false;
    if (slot) {
      // 優先檢查是否有派藥失敗（失敗代號優先於職員代號）
      let failureCode = '';
      let successStaffCode = '';
      let hasCustom = false;
      
      for (const block of blocks) {
        const prescription = block.prescription;
        if (!block.timeSlots.includes(slot)) continue;
        if (!isDateInPrescriptionRange(dateStr, slot, prescription)) continue;
        anyInRange = true;
        
        if (prescription.preparation_method === 'custom') {
          hasCustom = true;
          continue;
        }
        
        const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
        if (!record) continue;
        
        // 檢查派藥狀態
        if (record.dispensing_status === 'failed') {
          // 提取失敗代號
          const reason = record.dispensing_failure_reason;
          if (reason === '入院') failureCode = 'A';
          else if (reason === '自理') failureCode = 'S';
          else if (reason === '拒服') failureCode = 'R';
          else if (reason === '暫停') failureCode = 'P';
          else if (reason === '回家渡假') failureCode = 'HL';
          else if (reason === '其他') failureCode = 'O';
        } else if (record.dispensing_status === 'completed' && record.dispensing_staff) {
          // 記錄成功的職員代號（只有全部成功時才使用）
          successStaffCode = staffMapping[record.dispensing_staff] ?? '';
        }
      }
      
      // 優先級：失敗代號 > 自理 > 職員代號 > 邊界標記
      if (failureCode) {
        content = failureCode;
      } else if (hasCustom) {
        content = 'S';
      } else {
        content = successStaffCode;
      }
      
      if (!anyInRange && !content) {
        const key = `${dateStr}__${slot}`;
        const hasBefore = blockBoundaries.some(({ block, boundary }) =>
          block.timeSlots.includes(slot) && boundary.before.has(key)
        );
        if (hasBefore) {
          content = '▶';
        } else {
          const hasAfter = blockBoundaries.some(({ block, boundary }) =>
            block.timeSlots.includes(slot) && boundary.after.has(key)
          );
          if (hasAfter) content = '◀';
        }
      }
    }
    const boundaryClass = !anyInRange && content ? ' mr-boundary' : '';
    const inactiveClass = !anyInRange && !isBlankSummaryRow ? ' mr-inactive' : '';
    cells += `<td class="c-day${inactiveClass}${boundaryClass}">${content ? escapeHtml(content) : '&nbsp;'}</td>`;
  }
  return cells;
};

const formatTimeSlot = (slot: string): string => {
  const match = String(slot ?? '').match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(slot ?? '');
};

const escapeAttr = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const parseTimeToMinutes = (timeStr: string): number => {
  const match = String(timeStr ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return -1;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const getFrequencyDescription = (prescription: MedicationPrescription): string => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots, daily_frequency, is_prn } = prescription;
  const timeSlotsCount = medication_time_slots?.length ?? 0;
  // 頻率以處方登記的每日次數為準，沒有才按服用時間點數目推算；
  // PRN 常見 TDS 只設一個時間點，此時仍應顯示 TDS（每日3次）。
  const perDay = daily_frequency || timeSlotsCount || frequency_value || 1;

  // PRN 的「隔N日」只是護理安排（需要時決定哪天服），處方本身仍是每日，文字須跟處方；
  // 隔天安排已由日期格的灰化表達，不寫成「隔N日」
  if (is_prn && frequency_type === 'every_x_days') return `每日${perDay}次`;

  switch (frequency_type) {
    case 'every_x_days': {
      const gap = Number(frequency_value) || 1;
      const gapLabel = gap === 1 ? '隔日' : `隔${gap}日`;
      return `${gapLabel}${perDay}次`;
    }
    case 'every_x_months': return `隔${frequency_value}月${perDay}次`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') ?? '';
      return `逢${days}${perDay}次`;
    }
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? `單日${perDay}次` : is_odd_even_day === 'even' ? `雙日${perDay}次` : `單雙日${perDay}次`;
    case 'hourly': return `每${frequency_value}小時1次`;
    case 'each_time': return '每次';
    case 'daily':
    default: return `每日${perDay}次`;
  }
};

const getDosageText = (prescription: MedicationPrescription): string => {
  if (prescription.special_dosage_instruction) return prescription.special_dosage_instruction;
  if (prescription.dosage_amount) {
    const amt = String(prescription.dosage_amount);
    const unit = prescription.dosage_unit ?? '';
    const dosage = /^\d+(\.\d+)?$/.test(amt.trim()) ? amt + unit : amt;
    return `每次${dosage}`;
  }
  return '';
};

// 純「日期範圍」判斷：只看 start_date/end_date + start_time/end_time，不看服藥頻率。
// 供 ▶/◀ 邊界標記使用（邊界代表處方起訖，非個別服藥日）。
const isDateInPrescriptionDateRange = (dateStr: string, timeSlot: string | undefined, prescription: MedicationPrescription): boolean => {
  const checkDate = new Date(dateStr);
  const startDate = prescription.start_date ? new Date(prescription.start_date) : null;
  const endDate = prescription.end_date ? new Date(prescription.end_date) : null;
  const normalizeTime = (time: string | null | undefined): string => (time ? time.substring(0, 5) : '00:00');
  const startTime = normalizeTime(prescription.start_time) || '00:00';
  const endTime = normalizeTime(prescription.end_time) || '23:59';
  const normalizedTimeSlot = normalizeTime(timeSlot);

  if (startDate) {
    if (checkDate < startDate) return false;
    if (dateStr === prescription.start_date && normalizedTimeSlot < startTime) return false;
  }
  if (endDate) {
    if (checkDate > endDate) return false;
    if (dateStr === prescription.end_date && normalizedTimeSlot > endTime) return false;
  }
  return true;
};

const isDateInPrescriptionRange = (dateStr: string, timeSlot: string | undefined, prescription: MedicationPrescription): boolean => {
  // 先過日期範圍（起訖 + 起訖時間）
  if (!isDateInPrescriptionDateRange(dateStr, timeSlot, prescription)) return false;
  // 再過頻率規則：非服藥日（隔日/隔月/逢星期/單雙日）須灰掉
  if (!isPrescriptionScheduledOnDate(prescription, dateStr)) return false;
  return true;
};

// ---- 格式化輔助 ----

const formatGenderAge = (patient: PatientWithPrescriptions): string => {
  const gender = patient.性別 ?? '';
  const age = calculateAge(patient.出生日期);
  if (!gender && !age) return '';
  return age ? `${gender}/${age}` : `${gender}`;
};

const calculateAge = (birthDate: unknown): string => {
  if (!birthDate) return '';
  const date = new Date(String(birthDate));
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age > 0 ? String(age) : '';
};

const formatDate = (value: unknown): string => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDisplayDate(date);
};

// 將任意日期字串正規化為 YYYY-MM-DD（用於入住日比對）
const toIsoDate = (value: unknown): string => {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const toDateString = (selectedMonth: string, day: number): string => `${selectedMonth}-${String(day).padStart(2, '0')}`;

const getDaysInMonth = (selectedMonth: string): number => {
  const [year, month] = selectedMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

const joinList = (values: unknown): string => (Array.isArray(values) && values.length > 0 ? values.join('、') : '');

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const assembleDocument = (renderedPages: string[]): string => `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<style>
@page { size: A4 landscape; margin: 2mm; }
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: border-box; }
body {
  font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Noto Sans TC", "Heiti TC", sans-serif;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.mr-page {
  width: 293mm;
  height: 206mm;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.mr-page:last-child { page-break-after: auto; break-after: auto; }
/* 頂部彈性留白已廢用，footer 改用 margin-top: auto 絕對貼底 */
.mr-top-spacer { display: none; }
.mr-body { flex: 0 0 auto; overflow: hidden; }

/* 頂置院友資訊區 */
.mr-header { flex: 0 0 auto; margin-bottom: 1mm; }
.mr-header-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 0.8pt solid #2f3a45; }
.mr-header-table td { border: 0.4pt solid #9aa7b4; padding: 1mm 1.5mm; vertical-align: middle; }
.mr-hc-title { width: 94mm; }
.mr-hc-photo { width: 28mm; }
.mr-hc-info { width: 42mm; }
.mr-h-title { text-align: center; }
.mr-org { font-size: 15pt; font-weight: bold; color: #0f2740; line-height: 1.3; letter-spacing: 1pt; }
.mr-doc { font-size: 11.5pt; font-weight: bold; color: #1f3a52; line-height: 1.2; letter-spacing: 2pt; margin-top: 0.8mm; }
.mr-h-subtitle { text-align: center; }
.mr-subtitle { font-size: 11pt; font-weight: bold; color: #0f766e; letter-spacing: 1pt; }
.mr-h-photo { text-align: center; }
.mr-photo { width: 22mm; height: 26mm; object-fit: contain; border: 0.5pt solid #9aa7b4; border-radius: 1.2mm; display: block; margin: 0 auto; }
.mr-photo-empty { display: flex; align-items: center; justify-content: center; height: 26mm; font-size: 9pt; color: #888; }
.mr-h-info { font-size: 9pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mr-h-react { white-space: normal; word-break: break-word; }
.mr-info-label { font-weight: bold; }

/* 共用格線表 */
.mr-grid { width: 100%; border-collapse: collapse; table-layout: fixed; border: 0.8pt solid #2f3a45; }
.mr-grid th, .mr-grid td {
  border: 0.4pt solid #9aa7b4;
  text-align: center;
  vertical-align: middle;
  overflow: hidden;
  font-size: 8pt;
  padding: 0.3mm 0.4mm;
  line-height: 1.15;
  word-break: break-word;
}
.mr-grid col.c-date { width: 22mm; }
.mr-grid col.c-name { width: 40mm; }
.mr-grid col.c-route { width: 26mm; }
.mr-grid col.c-time { width: 12mm; }
.mr-colhead th { font-weight: bold; height: 5mm; background: #e8eef4; color: #1f2c38; }
.mr-dayhead th { font-size: 7pt; height: 4mm; background: #f1f5f9; color: #1f2c38; }
.mr-sign-head { font-weight: bold; letter-spacing: 0.5pt; }
.mr-sign-row td { height: ${ROW_SIGN_MM}mm; }
.mr-sign-row td.c-date, .mr-sign-row td.c-name, .mr-sign-row td.c-route {
  font-size: 8pt;
  text-align: left;
  padding: 0.4mm 1mm;
  vertical-align: top;
}
.mr-med-name { font-weight: bold; font-size: 10pt; }
.mr-med-short { display: inline-block; font-size: 7pt; font-weight: bold; color: #92400e; background: #fef3c7; border: 0.3mm solid #fbbf24; border-radius: 1.5px; padding: 0 2px; margin-top: 0.5mm; }
.mr-med-warning-tag { display: inline-block; font-size: 7pt; font-weight: bold; color: #dc2626; background: #fee2e2; border: 0.3mm solid #dc2626; border-radius: 1.5px; padding: 0 2px; margin-left: 1px; }
.mr-med-expiry { display: inline-block; font-size: 6.5pt; font-weight: normal; color: #92400e; margin-left: 1mm; opacity: 0.9; }
.mr-med-test { font-size: 7.2pt; color: #b45309; margin-top: 0.4mm; }
.mr-med-source { font-size: 7.2pt; color: #475569; margin-top: 0.4mm; }

/* 每個簽署日格的左下→右上斜線（以 inline SVG 繪製，避免印表機不列印背景圖形） */
td.mr-diag, td.mr-diag-prn { position: relative; overflow: hidden; }
.mr-diag-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
/* 不在處方有效期內的日格：灰底、隱藏斜線 */
td.mr-inactive { background: #e2e8f0 !important; }
td.mr-inactive .mr-diag-svg, td.mr-inactive-prn .mr-diag-svg { display: none; }
/* 即時備藥（preparation_method=immediate）簽署格：深色細斜線提示（由 inline SVG 實現） */
/* 即時備藥非有效期日格：灰底 */
td.mr-inactive-prn { background: #e2e8f0 !important; }
/* ▶/◀ 邊界標記格：紫色提示開始/結束 */
td.mr-boundary { color: #7c3aed; font-weight: bold; }
/* 處方列之間加深色分隔線（空白列同樣套用，確保版面統一） */
tbody.mr-prescription-body + tbody.mr-prescription-body > tr:first-child > td,
tbody.mr-prescription-body + tbody.mr-filler-block > tr:first-child > td,
tbody.mr-filler-block + tbody.mr-filler-block > tr:first-child > td {
  border-top: 1.5pt solid #929496 !important;
}
/* 簽署日格四象限：執藥者代號在左上，核藥者代號在右下 */
td.c-day { position: relative; }
.mr-cell-prep {
  position: absolute; top: 0.3mm; left: 0.4mm;
  font-size: 7.5pt; line-height: 1; pointer-events: none;
}
.mr-cell-verify {
  position: absolute; bottom: 0.3mm; right: 0.4mm;
  font-size: 7.5pt; line-height: 1; pointer-events: none;
}
.mr-cell-special {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 8.5pt; font-weight: bold; pointer-events: none;
}
/* 處方區空白填充列 */
.mr-filler-row td { background-color: white; }
/* c-date 提示文字（開始日期／處方日期）*/
td.mr-filler-date { color: #94a3b8; font-size: 7.5pt; text-align: left; padding: 0.4mm 1mm; vertical-align: middle; }
/* c-date 第 2-4 行：取消上框線 */
td.mr-filler-nobt { border-top: none !important; }

/* 底部給藥彙總（左側標籤格內含簽署指引） */
.mr-footer-region { flex: 0 0 auto; margin-top: auto; }
.mr-summary td { height: ${ROW_SUMMARY_MM}mm; }
.mr-grid td.mr-sum-label {
  background: #f1f5f9;
  vertical-align: top;
  text-align: left;
  padding: 0.4mm 1mm;
}
.mr-legend-title, .mr-staff-title { font-weight: bold; font-size: 8pt; color: #0f2740; }
.mr-staff-title { margin-top: 1mm; }
.mr-legend-codes, .mr-staff-codes { font-size: 7.2pt; line-height: 1.45; color: #1f2c38; margin-top: 0.3mm; }
.mr-legend-codes span { margin-right: 2.4mm; white-space: nowrap; }
.mr-staff-codes span { margin-right: 2.4mm; white-space: nowrap; }
.mr-legend-note { font-size: 7pt; line-height: 1.3; color: #64748b; margin-top: 0.3mm; }
.mr-grid td.mr-sum-label .mr-legend-wrap { display: flex; flex-direction: column; height: 100%; }
.mr-legend-qty { margin-top: auto; padding-top: 1mm; font-size: 7.6pt; font-weight: bold; color: #0f2740; }
.mr-sum-row td.c-time { font-size: 8pt; }
.mr-insp-body-row td { height: ${ROW_INSP_MM}mm; }
.mr-insp-type { font-size: 7.2pt; font-weight: bold; color: #1d4ed8; }
td.mr-insp-fail { color: #dc2626; font-weight: bold; }
.mr-inject-body-row td { height: ${ROW_INJECT_MM}mm; white-space: nowrap; }
.mr-inject-body-row td.mr-insp-type { color: #b45309; font-size: 6.5pt; }
.mr-pagelabel { text-align: right; font-size: 8pt; color: #475569; margin-top: 0; padding: 0 1mm; line-height: 1; }
/* 打孔區：頁頂預留 20mm，避免打孔機破壞表頭內容；顯示兩個定位圓圈（ISO 838：80mm 間距，居中）*/
.mr-punch-zone {
  flex: 0 0 ${PUNCH_ZONE_MM}mm;
  height: ${PUNCH_ZONE_MM}mm;
  width: 100%;
  position: relative;
  border-bottom: 0.3pt dashed #c8d3dd;
}
.mr-punch-hole {
  position: absolute;
  width: 8mm;
  height: 8mm;
  border-radius: 50%;
  border: 0.5pt dashed #b0b8c4;
  top: 50%;
  transform: translateY(-50%);
  background: #fff;
}
.mr-punch-hole:first-child { left: calc(50% - 44mm); }
.mr-punch-hole:last-child  { left: calc(50% + 36mm); }
</style>
</head>
<body>
${renderedPages.join('\n')}
</body>
</html>`;

// 以隱藏 iframe 列印，不另開視窗。
const printViaIframe = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // 須給 iframe 真實尺寸 (A4 橫向 @96dpi)，否則版面塌縮為 0，
  // 導致量測錯誤 (斜線消失、縮放/分頁異常)。移到畫面外即可隱藏。
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1123px';
  iframe.style.height = '794px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = (): void => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));

  const triggerPrint = (): void => {
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  if (doc.readyState === 'complete') {
    triggerPrint();
  } else {
    win.addEventListener('load', triggerPrint);
  }

  // 後備清理：列印對話框未觸發 afterprint 時，仍移除 iframe。
  window.setTimeout(cleanup, 60_000);
};
