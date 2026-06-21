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
import { MR_LOGO_DATA_URI } from './medicationRecordLogo';

// 此匯出器完全以程式自寫的語意化 HTML/CSS 產生列印版面（不再依賴 Excel 範本檔）。
// 版面分三區：頂置院友資訊 / 中間動態處方區 / 底部指引＋給藥彙總；
// 日格依當月天數填滿寬度；內容超頁自動分頁，且單一處方區塊不會被切割到兩頁。

type RouteKind = 'oral' | 'topical' | 'subcutaneous' | 'intramuscular';
type MedicationPrescription = Record<string, any>;
type PatientWithPrescriptions = Record<string, any> & { prescriptions?: MedicationPrescription[] };

interface PrescriptionBlock {
  prescription: MedicationPrescription;
  timeSlots: string[];
}

interface PageData {
  patient: PatientWithPrescriptions;
  routeKind: RouteKind;
  blocks: PrescriptionBlock[];
  pageIndexInRoute: number;
  pageCountInRoute: number;
}

const ROUTE_LABELS: Record<RouteKind, string> = {
  oral: '口服',
  topical: '外用',
  subcutaneous: '皮下注射',
  intramuscular: '肌肉注射',
};

const ROUTE_SUBTITLES: Record<RouteKind, string> = {
  oral: '口服藥物',
  topical: '外用藥物',
  subcutaneous: '皮下注射藥物',
  intramuscular: '肌肉注射藥物',
};

const ROUTE_SHEET_LABELS: Record<RouteKind, string> = {
  oral: '口服藥紙',
  topical: '外用藥紙',
  subcutaneous: '皮下注射藥紙',
  intramuscular: '肌肉注射藥紙',
};

const ROUTE_ORDER: RouteKind[] = ['oral', 'topical', 'subcutaneous', 'intramuscular'];

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
const MAX_PRESCRIPTIONS_PER_PAGE = 4; // 每頁最多處方數
const MIN_SLOT_ROWS = 4;              // 每個處方最少顯示時段列數（不足補空行）
const MIN_SUMMARY_ROWS = 6;           // 彙總區最少列數（不足補空行）

export const exportMedicationRecordToHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords = false,
  includeBlankRows = false
): Promise<void> => {
  const html = await buildMedicationRecordHtml(patients, selectedMonth, includeWorkflowRecords, includeBlankRows);
  printViaIframe(html);
};

export const exportSelectedMedicationRecordToHtml = async (
  patient: PatientWithPrescriptions,
  prescriptions: MedicationPrescription[],
  selectedMonth: string,
  includeWorkflowRecords = false,
  includeBlankRows = false
): Promise<void> => {
  await exportMedicationRecordToHtml([{ ...patient, prescriptions }], selectedMonth, includeWorkflowRecords, includeBlankRows);
};

const buildMedicationRecordHtml = async (
  patients: PatientWithPrescriptions[],
  selectedMonth: string,
  includeWorkflowRecords: boolean,
  includeBlankRows: boolean
): Promise<string> => {
  const renderedPages: string[] = [];

  for (const patient of patients) {
    const prescriptions = patient.prescriptions ?? [];

    let workflowRecords: WorkflowRecord[] = [];
    if (includeWorkflowRecords && prescriptions.length > 0) {
      const prescriptionIds = prescriptions.map((prescription) => prescription.id);
      workflowRecords = await fetchWorkflowRecordsForMonth(patient.院友id, prescriptionIds, selectedMonth);
    }
    const staffMapping = generateStaffCodeMapping(extractStaffNamesFromWorkflowRecords(workflowRecords));

    for (const page of preparePages(patient, prescriptions)) {
      renderedPages.push(renderPage(page, selectedMonth, workflowRecords, staffMapping, includeBlankRows));
    }
  }

  return assembleDocument(renderedPages);
};

const preparePages = (patient: PatientWithPrescriptions, prescriptions: MedicationPrescription[]): PageData[] => {
  const categorized: Record<RouteKind, MedicationPrescription[]> = { oral: [], topical: [], subcutaneous: [], intramuscular: [] };
  for (const prescription of prescriptions) {
    categorized[classifyRoute(prescription)].push(prescription);
  }

  const pages: PageData[] = [];
  for (const routeKind of ROUTE_ORDER) {
    const routePrescriptions = categorized[routeKind];
    if (routePrescriptions.length === 0) continue;

    const blocks: PrescriptionBlock[] = routePrescriptions.map((prescription) => ({
      prescription,
      timeSlots: sortDistinctTimeSlots(prescription.medication_time_slots ?? []),
    }));

    const grouped = paginateBlocks(blocks);
    grouped.forEach((pageBlocks, index) => {
      pages.push({
        patient,
        routeKind,
        blocks: pageBlocks,
        pageIndexInRoute: index + 1,
        pageCountInRoute: grouped.length,
      });
    });
  }
  return pages;
};

// 分頁規則：每頁最多 MAX_PRESCRIPTIONS_PER_PAGE 個處方。
// 簽署效益最佳化：若當前頁全為相同時段組合（slotSig），下一個處方屬不同組合且會增加彙總列數，
// 則優先新開一頁，以減少每頁彙總行數（每日需簽名次數）。
const paginateBlocks = (blocks: PrescriptionBlock[]): PrescriptionBlock[][] => {
  const slotSig = (block: PrescriptionBlock): string =>
    [...block.timeSlots].sort().join('|');

  const result: PrescriptionBlock[][] = [];
  let current: PrescriptionBlock[] = [];

  for (const block of blocks) {
    if (current.length === 0) {
      current = [block];
      continue;
    }

    // 已達上限：強制新頁
    if (current.length >= MAX_PRESCRIPTIONS_PER_PAGE) {
      result.push(current);
      current = [block];
      continue;
    }

    // 最佳化：當前頁純一組合且下一個跨組會增加彙總列 → 新頁
    const firstSig = slotSig(current[0]);
    const allSameSig = current.every((b) => slotSig(b) === firstSig);
    if (allSameSig && slotSig(block) !== firstSig) {
      const beforeRows = summaryRowCount(current);
      const afterRows = summaryRowCount([...current, block]);
      if (afterRows > beforeRows) {
        result.push(current);
        current = [block];
        continue;
      }
    }

    current.push(block);
  }

  if (current.length > 0) result.push(current);
  return result.length > 0 ? result : [[]];
};

// 彙總區列數：每個去重時段一列給藥列（檢測值已移至處方區）。
const summaryRowCount = (blocks: PrescriptionBlock[]): number => {
  const slots = sortDistinctTimeSlots(blocks.flatMap((block) => block.timeSlots));
  return slots.length;
};

// ---- 服藥前檢測項 ----

const INSPECTION_OPERATOR_LABELS: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤' };
const INSPECTION_ACTION_LABELS: Record<string, string> = { block_dispensing: '停服' };

const prescriptionHasInspection = (prescription: MedicationPrescription): boolean =>
  Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.length > 0;

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

const sortDistinctTimeSlots = (slots: string[]): string[] => {
  const distinct = [...new Set((slots ?? []).filter((slot) => slot != null && String(slot).trim() !== ''))];
  return distinct.sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
};

const classifyRoute = (prescription: MedicationPrescription): RouteKind => {
  const route = String(prescription.administration_route ?? '').trim();
  if (route.includes('皮下注射')) return 'subcutaneous';
  if (route.includes('注射')) return 'intramuscular'; // 肌肉注射及舊版「注射」
  if (route === '口服') return 'oral';
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
    + renderHeaderRegion(page.patient, page.routeKind)
    + `<div class="mr-body">${renderBodyTable(page, selectedMonth, dayCount, workflowRecords, staffMapping, includeBlankRows)}</div>`
    + '<div class="mr-spacer"></div>'
    + renderFooterRegion(page, selectedMonth, dayCount, workflowRecords, staffMapping, pageLabel, includeBlankRows)
    + '</section>';
};

// ---- 頂置院友資訊區 ----

const renderHeaderRegion = (patient: PatientWithPrescriptions, routeKind: RouteKind): string => {
  const name = patient.中文姓氏 != null || patient.中文名字 != null
    ? `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`
    : (patient.中文姓名 ?? '');
  const photo = patient.院友相片;
  const photoHtml = photo
    ? `<img class="mr-photo" src="${escapeAttr(String(photo))}" alt="">`
    : '<div class="mr-photo mr-photo-empty">相片</div>';

  return '<header class="mr-header">'
    + '<table class="mr-header-table"><colgroup>'
      + '<col class="mr-hc-logo"><col class="mr-hc-title"><col class="mr-hc-photo">'
      + '<col class="mr-hc-info"><col class="mr-hc-info"><col class="mr-hc-react">'
    + '</colgroup><tbody>'
      + '<tr>'
        + `<td class="mr-h-logo" rowspan="2"><img class="mr-logo" src="${MR_LOGO_DATA_URI}" alt="善頤護老 SeniorCare"></td>`
        + '<td class="mr-h-title"><div class="mr-org">善頤 (福群) 護老院</div><div class="mr-doc">個人備藥及給藥記錄</div></td>'
        + `<td class="mr-h-photo" rowspan="2">${photoHtml}</td>`
        + infoCell('院友姓名', name)
        + infoCell('院號', String(patient.床號 ?? ''))
        + reactCell('藥物過敏反應', joinList(patient.藥物敏感))
      + '</tr>'
      + '<tr>'
        + `<td class="mr-h-subtitle"><div class="mr-subtitle">${escapeHtml(ROUTE_SUBTITLES[routeKind])}</div></td>`
        + infoCell('性別 / 年齡', formatGenderAge(patient))
        + infoCell('出生日期', formatDate(patient.出生日期))
        + reactCell('藥物不良反應', joinList(patient.不良藥物反應))
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
    .map((block) => renderPrescriptionBlock(block, selectedMonth, dayCount, workflowRecords, staffMapping, includeBlankRows))
    .join('');

  // 填充空白處方列：勾選「處方空白列」時，每頁不足 MAX_PRESCRIPTIONS_PER_PAGE 個處方時補空行
  const missingSlots = includeBlankRows ? Math.max(0, MAX_PRESCRIPTIONS_PER_PAGE - page.blocks.length) : 0;
  let fillerRows = '';
  if (missingSlots > 0) {
    const inactiveDayCells = Array(dayCount).fill('<td class="c-day mr-inactive">&nbsp;</td>').join('');
    // 第一行：c-date / c-name / c-route 以 rowspan=MIN_SLOT_ROWS 合併，模擬真實處方區塊結構
    const fillerFirstRow = `<tr class="mr-sign-row mr-filler-row">`
      + `<td class="c-date" rowspan="${MIN_SLOT_ROWS}">&nbsp;</td>`
      + `<td class="c-name" rowspan="${MIN_SLOT_ROWS}">&nbsp;</td>`
      + `<td class="c-route" rowspan="${MIN_SLOT_ROWS}">&nbsp;</td>`
      + `<td class="c-time">&nbsp;</td>${inactiveDayCells}</tr>`;
    // 後續行：只有 c-time + 日格
    const fillerSubRow = `<tr class="mr-sign-row mr-filler-row"><td class="c-time">&nbsp;</td>${inactiveDayCells}</tr>`;
    const fillerBlock = fillerFirstRow + Array(MIN_SLOT_ROWS - 1).fill(fillerSubRow).join('');
    fillerRows = Array(missingSlots).fill(fillerBlock).join('');
  }

  return `<table class="mr-grid">${colGroup(dayCount)}${header}<tbody>${body}${fillerRows}</tbody></table>`;
};

const renderPrescriptionBlock = (
  block: PrescriptionBlock,
  selectedMonth: string,
  dayCount: number,
  workflowRecords: WorkflowRecord[],
  staffMapping: StaffCodeMapping,
  includeBlankRows: boolean
): string => {
  const { prescription, timeSlots } = block;
  const actualSlots = timeSlots.length > 0 ? timeSlots : [''];

  const dateInfo = `<div>開始：${escapeHtml(formatDate(prescription.start_date))}</div>`
    + `<div>處方：${escapeHtml(formatDate(prescription.prescription_date))}</div>`;
  const inspectionRequirement = formatInspectionRequirement(prescription);
  const nameInfo = `<div class="mr-med-name">${escapeHtml(prescription.medication_name ?? '')}</div>`
    + (inspectionRequirement ? `<div class="mr-med-test">${escapeHtml(inspectionRequirement)}</div>` : '')
    + (prescription.medication_source ? `<div class="mr-med-source">來源：${escapeHtml(String(prescription.medication_source))}</div>` : '');
  const routeInfo = [
    prescription.administration_route ?? '',
    getFrequencyDescription(prescription),
    getDosageText(prescription),
    prescription.is_prn ? '需要時' : '',
  ]
    .filter((line) => line != null && String(line).trim() !== '')
    .map((line) => `<div>${escapeHtml(String(line))}</div>`)
    .join('');

  // 每個處方的檢測項類型（不重複），各自在時段下方加一行。
  const inspectionTypes: string[] = prescriptionHasInspection(prescription)
    ? [...new Set((prescription.inspection_rules as any[])
        .map((r: any) => String(r?.vital_sign_type ?? '').trim()).filter(Boolean))]
    : [];
  const paddingSlotCount = includeBlankRows ? Math.max(0, MIN_SLOT_ROWS - actualSlots.length) : 0;
  const rowsPerSlot = 1 + inspectionTypes.length;
  const totalRowCount = actualSlots.length * rowsPerSlot + paddingSlotCount;
  const boundary = getBoundaryCells(prescription, actualSlots, selectedMonth, dayCount);

  const inactiveDayCells = Array(dayCount).fill('<td class="c-day mr-inactive">&nbsp;</td>').join('');
  const slotRows = actualSlots
    .flatMap((slot, slotIndex) => {
      const leftCells = slotIndex === 0
        ? `<td class="c-date" rowspan="${totalRowCount}">${dateInfo}</td>`
          + `<td class="c-name" rowspan="${totalRowCount}">${nameInfo}</td>`
          + `<td class="c-route" rowspan="${totalRowCount}">${routeInfo || '&nbsp;'}</td>`
        : '';
      const timeCell = `<td class="c-time">${escapeHtml(formatTimeSlot(slot))}</td>`;
      const dayCells = signatureDayCells(prescription, slot, selectedMonth, dayCount, workflowRecords, staffMapping, boundary);
      const signRow = `<tr class="mr-sign-row">${leftCells}${timeCell}${dayCells}</tr>`;
      const inspRows = inspectionTypes.map((inspType) =>
        renderBodyInspectionRow(block, slot, inspType, selectedMonth, dayCount, workflowRecords)
      );
      return [signRow, ...inspRows];
    });
  const paddingRow = `<tr class="mr-sign-row"><td class="c-time"></td>${inactiveDayCells}</tr>`;
  const paddingRows = Array(paddingSlotCount).fill(paddingRow);
  return [...slotRows, ...paddingRows].join('');
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

// 計算處方邊界標記格：▶ = 開始前 N 格，◄ = 結束後 N 格（N = 此處方所有日內時段數）。
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
    if (isDateInPrescriptionRange(allCells[i][0], allCells[i][1], prescription)) { firstActiveIdx = i; break; }
  }
  let lastActiveIdx = -1;
  for (let i = allCells.length - 1; i >= 0; i -= 1) {
    if (isDateInPrescriptionRange(allCells[i][0], allCells[i][1], prescription)) { lastActiveIdx = i; break; }
  }
  if (firstActiveIdx > 0) {
    for (let i = Math.max(0, firstActiveIdx - N); i < firstActiveIdx; i += 1) {
      before.add(`${allCells[i][0]}__${allCells[i][1]}`);
    }
  }
  if (lastActiveIdx >= 0 && lastActiveIdx < allCells.length - 1) {
    for (let i = lastActiveIdx + 1; i <= Math.min(allCells.length - 1, lastActiveIdx + N); i += 1) {
      after.add(`${allCells[i][0]}__${allCells[i][1]}`);
    }
  }
  return { before, after };
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
    let content = '';
    const inRange = slot && isDateInPrescriptionRange(dateStr, slot, prescription);
    if (inRange) {
      const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
      content = formatWorkflowCellContent(record, staffMapping) || '';
    } else {
      const key = `${dateStr}__${slot}`;
      if (boundary.before.has(key)) content = '▶';
      else if (boundary.after.has(key)) content = '◄';
    }
    const inactiveClass = !inRange ? (isImmediate ? ' mr-inactive-prn' : ' mr-inactive') : '';
    const boundaryClass = !inRange && content ? ' mr-boundary' : '';
    cells += `<td class="c-day ${diagClass}${inactiveClass}${boundaryClass}">${content ? escapeHtml(content) : '&nbsp;'}</td>`;
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
  pageLabel: string,
  includeBlankRows: boolean
): string => {
  const pageSlots = sortDistinctTimeSlots(page.blocks.flatMap((block) => block.timeSlots));
  const rawSummarySlots = pageSlots.length > 0 ? pageSlots : [''];
  const summarySlots = [...rawSummarySlots];
  if (includeBlankRows) {
    while (summarySlots.length < MIN_SUMMARY_ROWS) summarySlots.push('');
  }
  const totalRows = summarySlots.length;

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
    + staffCodesHtml;

  const rows: string[] = [];
  let labelEmitted = false;
  for (const slot of summarySlots) {
    const labelCell = labelEmitted
      ? ''
      : `<td class="mr-sum-label" colspan="3" rowspan="${totalRows}">${legendHtml}</td>`;
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
  let cells = '';
  for (let day = 1; day <= dayCount; day += 1) {
    const dateStr = toDateString(selectedMonth, day);
    let content = '';
    let anyInRange = false;
    if (slot) {
      let successContent = '';
      let fallbackContent = '';
      for (const block of blocks) {
        const prescription = block.prescription;
        if (!block.timeSlots.includes(slot)) continue;
        if (!isDateInPrescriptionRange(dateStr, slot, prescription)) continue;
        anyInRange = true;
        if (prescription.preparation_method === 'custom') {
          if (!successContent) successContent = 'S';
          continue;
        }
        const record = getWorkflowRecordForPrescriptionDateTimeSlot(workflowRecords, prescription.id, dateStr, slot);
        const value = formatDispenseCellContent(record, staffMapping);
        if (value) {
          if (record?.dispensing_status === 'completed') {
            successContent = value;
            break;
          } else if (!fallbackContent) {
            fallbackContent = value;
          }
        }
      }
      content = successContent || fallbackContent;
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
          if (hasAfter) content = '◄';
        }
      }
    }
    const boundaryClass = !anyInRange && content ? ' mr-boundary' : '';
    cells += `<td class="c-day${anyInRange ? '' : ' mr-inactive'}${boundaryClass}">${content ? escapeHtml(content) : '&nbsp;'}</td>`;
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
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots, daily_frequency } = prescription;
  const timeSlotsCount = medication_time_slots?.length ?? 0;
  const perDay = timeSlotsCount || daily_frequency || frequency_value || 1;

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

const isDateInPrescriptionRange = (dateStr: string, timeSlot: string | undefined, prescription: MedicationPrescription): boolean => {
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
  return date.toLocaleDateString('zh-TW');
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
@page { size: A4 landscape; margin: 7mm; }
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: border-box; }
body {
  font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", "Noto Sans TC", "Heiti TC", sans-serif;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.mr-page {
  width: 283mm;
  height: 196mm;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.mr-page:last-child { page-break-after: auto; break-after: auto; }
.mr-spacer { flex: 1 1 auto; }

/* 頂置院友資訊區 */
.mr-header { flex: 0 0 auto; margin-bottom: 1mm; }
.mr-header-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 0.8pt solid #2f3a45; }
.mr-header-table td { border: 0.4pt solid #9aa7b4; padding: 1mm 1.5mm; vertical-align: middle; }
.mr-hc-logo { width: 36mm; }
.mr-hc-title { width: 58mm; }
.mr-hc-photo { width: 28mm; }
.mr-hc-info { width: 36mm; }
.mr-h-logo { text-align: center; background: #f1f5f9; }
.mr-logo { width: 100%; max-width: 35mm; height: auto; object-fit: contain; display: block; margin: 0 auto; }
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
.mr-sign-row td { height: 6mm; }
.mr-sign-row td.c-date, .mr-sign-row td.c-name, .mr-sign-row td.c-route {
  font-size: 8pt;
  text-align: left;
  padding: 0.4mm 1mm;
  vertical-align: top;
}
.mr-med-name { font-weight: bold; }
.mr-med-test { font-size: 7.2pt; color: #b45309; margin-top: 0.4mm; }
.mr-med-source { font-size: 7.2pt; color: #475569; margin-top: 0.4mm; }

/* 每個簽署日格的左下→右上斜線（執＝左下、核＝右上） */
td.mr-diag {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 0.4px), #9aa7b4 calc(50% - 0.4px),
    #9aa7b4 calc(50% + 0.4px), transparent calc(50% + 0.4px));
}
/* 不在處方有效期內的日格：灰底、移除斜線 */
td.mr-inactive { background: #e2e8f0 !important; background-image: none !important; }
/* 即時備藥（preparation_method=immediate）簽署格：深色細斜線提示 */
td.mr-diag-prn {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 0.4px), #334155 calc(50% - 0.4px),
    #334155 calc(50% + 0.4px), transparent calc(50% + 0.4px));
}
/* 即時備藥非有效期日格：空格（無斜線無灰底） */
td.mr-inactive-prn { background: #fff !important; background-image: none !important; }
/* ▶/◄ 邊界標記格：紫色提示開始/結束 */
td.mr-boundary { color: #7c3aed; font-weight: bold; }
/* 處方區空白填充列 */
.mr-filler-row td { background: #f8fafc; }

/* 底部給藥彙總（左側標籤格內含簽署指引） */
.mr-footer-region { flex: 0 0 auto; }
.mr-summary td { height: 6mm; }
.mr-grid td.mr-sum-label {
  background: #f1f5f9;
  vertical-align: top;
  text-align: left;
  padding: 1mm 1.2mm;
}
.mr-legend-title, .mr-staff-title { font-weight: bold; font-size: 8pt; color: #0f2740; }
.mr-staff-title { margin-top: 1mm; }
.mr-legend-codes, .mr-staff-codes { font-size: 7.2pt; line-height: 1.45; color: #1f2c38; margin-top: 0.3mm; }
.mr-legend-codes span { margin-right: 2.4mm; white-space: nowrap; }
.mr-staff-codes span { margin-right: 2.4mm; white-space: nowrap; }
.mr-legend-note { font-size: 7pt; line-height: 1.3; color: #64748b; margin-top: 0.3mm; }
.mr-sum-row td.c-time { font-size: 8pt; }
.mr-insp-body-row td { height: 5mm; }
.mr-insp-type { font-size: 7.2pt; font-weight: bold; color: #1d4ed8; }
td.mr-insp-fail { color: #dc2626; font-weight: bold; }
.mr-pagelabel { text-align: right; font-size: 8pt; color: #475569; margin-top: 0.6mm; }
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
