/**
 * 排班列印 HTML 產生器（純函數，不碰 supabase）
 *
 * 兩份文件：
 * - 假期預排表（roster_pre_schedule）：按月，員工 × 日格，顯示預排/請假/已排班時間簡寫
 * - 排班表（roster_schedule）：按週，每日一節，班次 × 居住區表格
 *
 * 輸出模式：
 * - separate：每個（文件 × 部門）一份輸出
 * - combined：每份文件一份輸出，部門各佔一個 print-page
 *
 * 所有頁面統一 A4 landscape，配合 printUtils.printGroupedHtml 列印。
 */

import type {
  UserProfile,
  UserEmploymentDetails,
  UserLeaveRecord,
  PublicHoliday,
  StationShiftSetting,
  UserShiftAssignment,
  ShiftName,
} from '@care-suite/shared';
import {
  getEmploymentPosition,
  POSITION_CARD_CODES,
  POSITION_DISPLAY_PRIORITY,
  SHIFT_NAME_LABELS,
} from '@care-suite/shared';
import {
  getAssignmentPositionForTable,
  getActiveShiftSettings,
  buildShiftAssignmentMap,
  buildDailyCompliance,
  formatShiftTimeAbbreviation,
  getShiftEndTime,
} from './roster';
import type { ComplianceRow } from './roster';
import { GRID_POSITIONS } from './facilityNatureSettings';
import type { SpecificHoursConfig } from './facilityNatureSettings';
import type { StaffingResult } from './staffingRequirements';

export type RosterPrintDocumentId = 'roster_pre_schedule' | 'roster_schedule';

export const ROSTER_PRINT_DEPARTMENTS = ['行政', '護士/保健員', '護理員', '庶務'] as const;

/** 與 RosterScheduleView props.getUserFullBalances 回傳型別一致 */
export interface UserFullBalances {
  doBalance: number;
  doAccumulated: number;
  doEstimated: number;
  restDayFraction: number;
  prdExpected: number;
  prdEstimated: number;
  phAvailable: number;
  phAccumulated: number;
  phEstimated: number;
  shAvailable: number;
  shAccumulated: number;
  shEstimated: number;
  alBalance: number;
  alAccumulated: number;
  alEstimated: number;
  whb: number;
}

export interface RosterPrintInput {
  users: UserProfile[];
  employmentDetails: Record<string, UserEmploymentDetails>;
  stations: { id: string; name: string }[];
  shiftSettings: StationShiftSetting[];
  /** 排班表當前週（週日至週六） */
  weekAnchor: Date;
  /** 當週班次 */
  weekAssignments: UserShiftAssignment[];
  /** 預排表當前月 */
  year: number;
  month: number;
  /** 當月班次（預排表時間簡寫用） */
  monthAssignments: UserShiftAssignment[];
  /** 排班表列印範圍月份（weekAnchor 所在月）的整月班次；缺省則用 weekAssignments */
  scheduleMonthAssignments?: UserShiftAssignment[];
  /** 當月預排/請假 */
  leaveRecords: UserLeaveRecord[];
  publicHolidays: PublicHoliday[];
  specificHours: SpecificHoursConfig;
  staffingResult: StaffingResult | null;
  dailyRequirements: { position: string; hours: number; peakHeadcount: number }[];
  hasContractHours: boolean;
  getUserFullBalances?: (userId: string) => UserFullBalances | null;
  facilityName: string;
}

export interface RosterPrintRequest {
  documents: RosterPrintDocumentId[];
  departments: string[];
  outputMode: 'separate' | 'combined';
  includeBalance: boolean;
  includeCompliance: boolean;
}

export interface RosterPrintFile {
  title: string;
  pages: string[];
}

const DOCUMENT_NAMES: Record<RosterPrintDocumentId, string> = {
  roster_pre_schedule: '假期預排表',
  roster_schedule: '排班表',
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 對照 RosterScheduleView 的 LEAVE_BADGE_COLORS（Tailwind → 十六進制） */
const LEAVE_BADGE_HEX: Record<string, string> = {
  AL: '#22c55e',
  PRD: '#3b82f6',
  DO: '#c084fc',
  SL: '#ef4444',
  NPL: '#9ca3af',
  PH: '#facc15',
  SH: '#f472b6',
};

const OK_COLOR = '#16a34a';
const BAD_COLOR = '#dc2626';

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

const signed = (n: number): string => String(n);

/** WHB 顯示：正數不帶 + */
const whbSigned = (n: number): string => String(n);

const isPartTime = (user: UserProfile): boolean => user.employment_type === '兼職';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatDateStr = (y: number, m: number, d: number): string =>
  `${y}-${pad2(m)}-${pad2(d)}`;

/** 員工姓名下的職位小字：主要職位 + 次要職位 */
function userDisplayPositions(user: UserProfile): string {
  const primary = getEmploymentPosition(user);
  const parts: string[] = [];
  if (primary) parts.push(primary);
  const secondary = (user.secondary_positions || []).filter((p) => p !== primary);
  if (secondary.length) parts.push(...secondary);
  if (parts.length === 0 && user.department) parts.push(user.department);
  return parts.join('、') || '未設定';
}

/** 該部門適用的員工，按職位優先級 > 入職日期排序 */
function departmentUsers(input: RosterPrintInput, department: string): UserProfile[] {
  const users = input.users.filter((u) => getAssignmentPositionForTable(u, department) !== null);
  return users.sort((a, b) => {
    const posA = getAssignmentPositionForTable(a, department) as keyof typeof POSITION_DISPLAY_PRIORITY | null;
    const posB = getAssignmentPositionForTable(b, department) as keyof typeof POSITION_DISPLAY_PRIORITY | null;
    const priA = posA && posA in POSITION_DISPLAY_PRIORITY ? POSITION_DISPLAY_PRIORITY[posA] : 99;
    const priB = posB && posB in POSITION_DISPLAY_PRIORITY ? POSITION_DISPLAY_PRIORITY[posB] : 99;
    if (priA !== priB) return priA - priB;
    return (a.hire_date || '9999-12-31').localeCompare(b.hire_date || '9999-12-31');
  });
}

function pageStyles(orientation: 'landscape' | 'portrait' = 'landscape'): string {
  const margin = '3mm';
  const size = orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape';
  return `<style>
    @page { size: ${size}; margin: ${margin}; }
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", "PingFang TC", sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
      line-height: 1.1;
      font-size: ${orientation === 'portrait' ? '7px' : '8px'};
    }
    .print-page { width: 100%; position: relative; }
    .rp-header { text-align: center; margin-bottom: ${orientation === 'portrait' ? '2px' : '3px'}; }
    .rp-header h1 { margin: 0; font-size: ${orientation === 'portrait' ? '11px' : '14px'}; font-weight: bold; }
    .rp-header h2 { margin: 1px 0 0 0; font-size: ${orientation === 'portrait' ? '9px' : '11px'}; font-weight: bold; }
    .rp-header .rp-period { margin-top: 1px; font-size: ${orientation === 'portrait' ? '8px' : '10px'}; color: #333; }
    table.rp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rp-table th, table.rp-table td {
      border: 0.5px solid #666;
      padding: 0.5px 1px;
      font-size: 7px;
      vertical-align: middle;
      overflow: hidden;
    }
    table.rp-table th { background: #f2f2f2; font-weight: bold; text-align: center; }
    .rp-pre-schedule th, .rp-pre-schedule td { padding: 0.5px; font-size: 6px; text-align: center; }
    .rp-pre-schedule .rp-name { font-size: 7px; }
    .rp-pre-schedule .rp-pos { font-size: 5px; }
    .rp-schedule-table th, .rp-schedule-table td { padding: 1px; font-size: 7px; vertical-align: top; }
    .rp-schedule-table .rp-day-cell { background: #f2f2f2; font-weight: bold; font-size: 7px; }
    .rp-schedule-table .rp-shift-cell { background: #f9fafb; text-align: center; font-size: 7px; }
    .rp-name { font-weight: bold; font-size: ${orientation === 'portrait' ? '8px' : '10px'}; }
    .rp-pos { font-size: 7px; color: #555; font-weight: normal; }
    .rp-sunday { color: #dc2626; }
    .rp-badge {
      display: inline-block;
      min-width: 2.2em;
      padding: 0 2px;
      border-radius: 2px;
      color: #fff;
      font-size: 6px;
      text-align: center;
    }
    .rp-overridden { outline: 2px solid #ef4444; outline-offset: -2px; }
    .rp-shift { display: inline-block; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 2px; color: #374151; padding: 0 2px; font-size: 6px; }
    .rp-balance div { white-space: nowrap; }
    .rp-whb { color: #2563eb; }
    .rp-muted { color: #9ca3af; }
    .rp-card { border: 0.5px solid #93c5fd; background: #eff6ff; border-radius: 1px; padding: 0 1px; margin: 0 0 1px 0; text-align: left; line-height: 1.15; }
    .rp-card-name { font-size: 7px; font-weight: bold; }
    .rp-card-code { font-size: 6px; color: #555; font-weight: normal; margin-right: 1px; }
    .rp-card-time { font-size: 6px; color: #1d4ed8; }
    .rp-two-col { display: flex; gap: 2px; width: 100%; align-items: flex-start; }
    .rp-col { width: 50%; min-width: 50%; }
    .rp-compliance { font-size: 8px; }
    .rp-page-footer { position: absolute; bottom: 1mm; right: 1mm; font-size: 8px; color: #333; }
    table.rp-table tr { break-inside: avoid; }
    .rp-ok { color: ${OK_COLOR}; }
    .rp-bad { color: ${BAD_COLOR}; }
    .rp-holiday { color: #dc2626; font-weight: normal; font-size: 6px; }
    .rp-small-table th, .rp-small-table td { border: 0.5px solid #666; padding: 1px 2px; font-size: 7px; text-align: center; }
  </style>`;
}

function pageShell(
  content: string,
  orientation: 'landscape' | 'portrait' = 'landscape',
  pageInfo?: { pageNumber: number; totalPages: number },
): string {
  const footer = pageInfo
    ? `<div class="rp-page-footer">${pageInfo.pageNumber} / ${pageInfo.totalPages}</div>`
    : '';
  return `${pageStyles(orientation)}<div class="print-page">${content}${footer}</div>`;
}

function headerHtml(input: RosterPrintInput, docName: string, period: string, department: string): string {
  return `<div class="rp-header">
    <h1>${escapeHtml(input.facilityName)}</h1>
    <h2>${escapeHtml(docName)}（${escapeHtml(department)}）</h2>
    <div class="rp-period">${escapeHtml(period)}</div>
  </div>`;
}

// =====================================================
// 假期預排表
// =====================================================

const PRE_SCHEDULE_MAX_ROWS_PER_PAGE = 18;
const PRE_SCHEDULE_CONTENT_HEIGHT_MM = 174;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildPreSchedulePage(
  input: RosterPrintInput,
  department: string,
  includeBalance: boolean,
): string[] {
  const { year, month } = input;
  const daysInMonth = new Date(year, month, 0).getDate();
  const users = departmentUsers(input, department);
  const period = `${year}年${month}月`;

  const leaveMap = new Map<string, UserLeaveRecord>();
  for (const r of input.leaveRecords) {
    leaveMap.set(`${r.user_id}|${r.leave_date}`, r);
  }
  const assignmentMap = new Map<string, UserShiftAssignment[]>();
  for (const a of input.monthAssignments) {
    const key = `${a.user_id}|${a.work_date}`;
    const list = assignmentMap.get(key) || [];
    list.push(a);
    assignmentMap.set(key, list);
  }

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const date = new Date(year, month - 1, d);
    const isSunday = date.getDay() === 0;
    return `<th class="${isSunday ? 'rp-sunday' : ''}" style="width: 2.4%;"><div>${d}</div><div>${WEEKDAYS[date.getDay()]}</div></th>`;
  }).join('');

  const balanceHeaders = includeBalance
    ? `<th style="width: 5.5%;">累積</th><th style="width: 5.5%;">預計${month}月收穫</th>`
    : '';

  function buildUserRow(user: UserProfile, rowHeight: string): string {
    const details = input.employmentDetails[user.id];
    const full = input.getUserFullBalances?.(user.id) ?? null;

    let balanceCells = '';
    if (includeBalance) {
      if (!full || isPartTime(user)) {
        balanceCells = `<td class="rp-muted">兼職不適用</td><td class="rp-muted">—</td>`;
      } else {
        const accumulated = [
          `<div>DO ${signed(full.doAccumulated)}</div>`,
          `<div>PRD ${signed(full.restDayFraction)}</div>`,
          details?.public_holiday_type === 'PH' ? `<div>PH ${signed(full.phAccumulated)}</div>` : '',
          details?.public_holiday_type === 'SH' ? `<div>SH ${signed(full.shAccumulated)}</div>` : '',
          `<div>AL ${signed(full.alAccumulated)}</div>`,
          `<div class="rp-whb">WHB ${whbSigned(full.whb)}</div>`,
        ].join('');
        const estimatedParts = [
          full.doEstimated !== 0 ? `<div>DO ${signed(full.doEstimated)}</div>` : '',
          full.prdEstimated !== 0 ? `<div>PRD ${signed(full.prdEstimated)}</div>` : '',
          details?.public_holiday_type === 'PH' && full.phEstimated !== 0 ? `<div>PH ${signed(full.phEstimated)}</div>` : '',
          details?.public_holiday_type === 'SH' && full.shEstimated !== 0 ? `<div>SH ${signed(full.shEstimated)}</div>` : '',
          full.alEstimated !== 0 ? `<div>AL ${signed(full.alEstimated)}</div>` : '',
        ].filter(Boolean);
        const estimated = estimatedParts.length > 0 ? estimatedParts.join('') : '<span class="rp-muted">—</span>';
        balanceCells = `<td class="rp-balance">${accumulated}</td><td class="rp-balance">${estimated}</td>`;
      }
    }

    const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = formatDateStr(year, month, d);
      const record = leaveMap.get(`${user.id}|${dateStr}`);
      const assignments = assignmentMap.get(`${user.id}|${dateStr}`) ?? [];

      let cell = '';
      if (record) {
        if (record.record_type === 'leave' && record.leave_type) {
          const color = LEAVE_BADGE_HEX[record.leave_type] ?? '#9ca3af';
          const overridden = record.is_overridden ? ' rp-overridden' : '';
          const mandatory = record.urgency === 'mandatory' ? ' ⚡' : '';
          cell = `<span class="rp-badge${overridden}" style="background:${color};">${escapeHtml(record.leave_type)}${mandatory}</span>`;
        } else if (record.record_type === 'availability') {
          const start = record.availability_start_time?.slice(0, 2) ?? '';
          const end = record.availability_end_time?.slice(0, 2) ?? '';
          const overridden = record.is_overridden ? ' rp-overridden' : '';
          const mandatory = record.urgency === 'mandatory' ? ' ⚡' : '';
          cell = `<span class="rp-badge${overridden}" style="background:#60a5fa;">${start}-${end}${mandatory}</span>`;
        }
      } else if (assignments.length > 0) {
        const a = assignments[0];
        const end = a.end_time || getShiftEndTime(a.start_time, details?.daily_contract_hours ?? null);
        cell = `<span class="rp-shift">${escapeHtml(formatShiftTimeAbbreviation(a.start_time, end))}</span>`;
      }
      return `<td style="text-align: center;">${cell}</td>`;
    }).join('');

    return `<tr style="height: ${rowHeight};">
      <td><div class="rp-name">${escapeHtml(user.name_zh)}</div><div class="rp-pos">${escapeHtml(userDisplayPositions(user))}</div></td>
      ${balanceCells}
      ${dayCells}
    </tr>`;
  }

  function buildTableBody(chunkUsers: UserProfile[]): string {
    if (chunkUsers.length === 0) {
      return `<tr><td colspan="${daysInMonth + 1 + (includeBalance ? 2 : 0)}" style="text-align: center; color: #9ca3af; padding: 8px;">暫無適用職位員工</td></tr>`;
    }
    const rowHeight = `${(PRE_SCHEDULE_CONTENT_HEIGHT_MM / chunkUsers.length).toFixed(1)}mm`;
    return chunkUsers.map((user) => buildUserRow(user, rowHeight)).join('');
  }

  const chunks = users.length > 0 ? chunkArray(users, PRE_SCHEDULE_MAX_ROWS_PER_PAGE) : [[]];
  const totalPages = chunks.length;

  return chunks.map((chunk, idx) => {
    const pageNumber = idx + 1;
    const rows = buildTableBody(chunk);
    const content = `${headerHtml(input, DOCUMENT_NAMES.roster_pre_schedule, period, department)}
      <table class="rp-table rp-pre-schedule">
        <thead>
          <tr>
            <th style="width: 7%;">員工</th>
            ${balanceHeaders}
            ${dayHeaders}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    return pageShell(content, 'landscape', { pageNumber, totalPages });
  });
}

// =====================================================
// 排班表
// =====================================================

const SHIFT_ORDER: ShiftName[] = ['早班', '日班', '午班', '晚班'];

/** 部門對應的達標檢查 row 職位 */
function compliancePositionsForDepartment(department: string): string[] {
  if (department === '行政' || department === '庶務') return ['助理員'];
  if (department === '護士/保健員') return ['註冊/登記護士', '保健員'];
  return ['護理員'];
}

function complianceRowHtml(row: ComplianceRow, hasContractHours: boolean): string {
  const parts: string[] = [`<b>${escapeHtml(row.position)}</b>`];
  if (hasContractHours) {
    const cls = row.hoursOk ? 'rp-ok' : 'rp-bad';
    const suffix = row.hoursOk ? '' : ' 工時不足';
    parts.push(`工時 <span class="${cls}">${row.actualHours.toFixed(1)}/${row.requiredHours.toFixed(1)} hr${suffix}</span>`);
  }
  if (row.hasSpecificSlotRequirement) {
    const segments = row.specificSegments
      .map((s) => {
        const cls = s.actual >= s.required ? 'rp-ok' : 'rp-bad';
        return `${escapeHtml(s.label)} <span class="${cls}">${s.actual}/${s.required} 人</span>`;
      })
      .join('；');
    parts.push(`${row.isA1Contract ? '甲一買位' : '特定鐘點'}：${segments}`);
  }
  return parts.join('　');
}

function buildSchedulePage(
  input: RosterPrintInput,
  department: string,
  includeCompliance: boolean,
  options: {
    period: string;
    days: { date: string; weekday: string; weekdayIndex: number }[];
  },
): string[] {
  const { period, days } = options;
  const users = departmentUsers(input, department);
  const userSet = new Set(users.map((u) => u.id));

  // 行政部門不分居住區，全域一欄（stationId null）；其他部門為各居住區 + 未分區
  const isGlobal = department === '行政';
  const columns: { id: string | null; name: string }[] = isGlobal
    ? [{ id: null, name: '全域' }]
    : [...input.stations.map((s) => ({ id: s.id as string | null, name: s.name })), { id: null, name: '未分區' }];

  // 只列各區出現過的 active 班次，順序 早/日/午/晚
  const shiftSet = new Set<ShiftName>();
  for (const col of columns) {
    for (const s of getActiveShiftSettings(input.shiftSettings, col.id, department)) {
      shiftSet.add(s.shift_name);
    }
  }
  const shiftNames = SHIFT_ORDER.filter((n) => shiftSet.has(n));

  const scheduleAssignments = input.scheduleMonthAssignments ?? input.weekAssignments;
  const assignmentMap = buildShiftAssignmentMap(scheduleAssignments, input.users, department);

  const dateWidth = 8;
  const shiftWidth = 5;
  const stationWidth = Math.floor((100 - dateWidth - shiftWidth) / columns.length);
  const headerCells = columns
    .map((col) => `<th style="width: ${stationWidth}%; font-size: 7px;">${escapeHtml(col.name)}</th>`)
    .join('');

  function buildHalfTable(halfDays: { date: string; weekday: string; weekdayIndex: number }[]): string {
    const tableRows = halfDays
      .flatMap((day) => {
        const holiday = input.publicHolidays.find((h) => h.holiday_date === day.date);
        const dateLabel = `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}<br>${WEEKDAYS[day.weekdayIndex]}`;
        const holidayHtml = holiday ? `<br><span class="rp-holiday">${escapeHtml(holiday.name)}</span>` : '';
        const isSunday = day.weekdayIndex === 0;
        const titleCls = isSunday ? 'rp-sunday' : '';

        return shiftNames.map((shiftName, idx) => {
          const cells = columns
            .map((col) => {
              const key = `${col.id ?? 'unassigned'}|${shiftName}|${day.date}`;
              const list = (assignmentMap.byKey.get(key) || []).filter((a) => userSet.has(a.user_id));
              const cards = list
                .map((a) => {
                  const user = input.users.find((u) => u.id === a.user_id);
                  if (!user) return '';
                  const position = getEmploymentPosition(user);
                  const code = position ? POSITION_CARD_CODES[position] : undefined;
                  const endTime =
                    a.end_time || getShiftEndTime(a.start_time, input.employmentDetails[a.user_id]?.daily_contract_hours ?? null);
                  return `<div class="rp-card">
                    <div class="rp-card-name">${code ? `<span class="rp-card-code">${escapeHtml(code)}</span>` : ''}${escapeHtml(user.name_zh)}</div>
                    <div class="rp-card-time">${escapeHtml(a.start_time)}-${escapeHtml(endTime)}</div>
                  </div>`;
                })
                .join('');
              return `<td style="vertical-align: top; padding: 1px;">${cards}</td>`;
            })
            .join('');
          const dateCell =
            idx === 0
              ? `<td rowspan="${shiftNames.length}" class="rp-day-cell" style="width: ${dateWidth}%; text-align: center; vertical-align: top;">
                  <div class="${titleCls}">${dateLabel}</div>${holidayHtml}
                 </td>`
              : '';
          return `<tr>
            ${dateCell}
            <td class="rp-shift-cell" style="width: ${shiftWidth}%; text-align: center; vertical-align: middle;">${SHIFT_NAME_LABELS[shiftName]}</td>
            ${cells}
          </tr>`;
        });
      })
      .join('');

    const emptyRow =
      tableRows.length === 0
        ? `<tr><td colspan="${columns.length + 2}" style="text-align: center; color: #9ca3af; padding: 4px;">無班次資料</td></tr>`
        : '';

    return `<table class="rp-table rp-schedule-table">
      <thead>
        <tr>
          <th style="width: ${dateWidth}%;">日期</th>
          <th style="width: ${shiftWidth}%;">班次</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${tableRows}${emptyRow}</tbody>
    </table>`;
  }

  // 一頁只放半個月；半個月從中間再分左右兩欄
  const mid = Math.floor(days.length / 2);
  const leftDays = days.slice(0, mid);
  const rightDays = days.slice(mid);
  const leftTable = buildHalfTable(leftDays);
  const rightTable = buildHalfTable(rightDays);

  const schedulePage = `${headerHtml(input, DOCUMENT_NAMES.roster_schedule, period, department)}
    <div class="rp-two-col">
      <div class="rp-col">${leftTable}</div>
      <div class="rp-col">${rightTable}</div>
    </div>`;

  const pages: string[] = [pageShell(schedulePage, 'portrait')];

  if (includeCompliance) {
    const requiredHoursMap: Record<string, number> = {};
    for (const r of input.dailyRequirements) requiredHoursMap[r.position] = r.hours;
    const requiredHourly: Record<string, number[]> = {};
    if (input.staffingResult) {
      for (let c = 0; c < GRID_POSITIONS.length; c++) {
        const pos = GRID_POSITIONS[c];
        requiredHourly[pos] = Array.from({ length: 24 }, (_, h) => input.staffingResult!.grid[h]?.[c] ?? 0);
      }
    }
    const compliancePositions = compliancePositionsForDepartment(department);
    const complianceRows = days
      .map((day) => {
        const rows = buildDailyCompliance(
          day.date,
          requiredHoursMap,
          requiredHourly,
          input.specificHours,
          input.users,
          input.employmentDetails,
          scheduleAssignments,
        );
        const lines = compliancePositions
          .map((pos) => rows.find((r) => r.position === pos))
          .filter((r): r is ComplianceRow => !!r)
          .map((r) => complianceRowHtml(r, input.hasContractHours))
          .join('；');
        return `<tr><td style="width: 10%; text-align: center;">${day.date.slice(8, 10)}</td><td style="text-align: left;">${lines || '<span class="rp-muted">無達標資料</span>'}</td></tr>`;
      })
      .join('');
    const compliancePage = `${headerHtml(input, `${DOCUMENT_NAMES.roster_schedule} - 達標檢查`, period, department)}
      <table class="rp-table rp-small-table">
        <thead><tr><th>日</th><th>達標檢查</th></tr></thead>
        <tbody>${complianceRows}</tbody>
      </table>`;
    pages.push(pageShell(compliancePage, 'portrait'));
  }

  return pages;
}

// =====================================================
// 入口
// =====================================================

function buildMonthSplit(
  year: number,
  month: number,
): { period: string; days: { date: string; weekday: string; weekdayIndex: number }[] }[] {
  const lastDay = new Date(year, month, 0).getDate();
  const makeDay = (d: number) => {
    const date = new Date(year, month - 1, d);
    return {
      date: formatDateStr(year, month, d),
      weekday: WEEKDAYS[date.getDay()],
      weekdayIndex: date.getDay(),
    };
  };
  const firstHalf = Array.from({ length: 15 }, (_, i) => makeDay(i + 1));
  const secondHalf = Array.from({ length: lastDay - 15 }, (_, i) => makeDay(i + 16));
  return [
    { period: `${year}年${month}月1日 - 15日`, days: firstHalf },
    { period: `${year}年${month}月16日 - ${lastDay}日`, days: secondHalf },
  ];
}

/**
 * 依 request 產生每份輸出 HTML 文件的 pages（每頁一個 print-page div）與標題。
 * separate：每個（文件 × 部門）一個 entry；combined：每個文件一個 entry，部門各佔一頁。
 */
export function generateRosterPrintPages(
  input: RosterPrintInput,
  request: RosterPrintRequest,
): RosterPrintFile[] {
  const monthSplit = buildMonthSplit(input.year, input.month);
  const buildPage = (docId: RosterPrintDocumentId, department: string): string[] => {
    if (docId === 'roster_pre_schedule') {
      return buildPreSchedulePage(input, department, request.includeBalance);
    }
    return monthSplit.flatMap((half) =>
      buildSchedulePage(input, department, request.includeCompliance, half),
    );
  };

  const files: RosterPrintFile[] = [];
  for (const docId of request.documents) {
    const docName = DOCUMENT_NAMES[docId];
    if (request.outputMode === 'separate') {
      for (const department of request.departments) {
        files.push({
          title: `${docName}（${department}）`,
          pages: buildPage(docId, department),
        });
      }
    } else {
      files.push({
        title: docName,
        pages: request.departments.flatMap((department) => buildPage(docId, department)),
      });
    }
  }
  return files;
}
