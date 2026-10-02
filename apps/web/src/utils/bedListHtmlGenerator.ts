/**
 * 床位表 HTML 列印產生器 v5
 * A4 橫向，無統計欄；逐床縱向；字體與列高按卡片欄寬自動分級，床位列 flex 伸展填滿頁面高度
 */

import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

import { formatDisplayDate } from './dateFormat';
export interface BedListBed {
  bed_number: string;            // 當前床號（顯示主號）
  original_bed_number?: string;  // 原床號：僅暫時性調動時以小字顯示「原XXX」
  reserved?: boolean;            // 已佔床：院友暫時調往他床，此床為其原床（空置但保留）
  exclude_from_total?: boolean;  // 隔離病房的床：不計入床位統計（總床位/已入住/未入住）
  patient?: {
    name: string;
    admissionType?: string;
    infectionControl?: string[] | null;
  } | null;
}

function isTemporaryBed(bed: BedListBed): boolean {
  return !!bed.original_bed_number;
}

export interface BedListInput {
  stationName: string;
  facilityName?: string;
  beds: BedListBed[];
  printDate?: string;
}

function typeLabel(t?: string | null): string {
  if (t === '私位') return '私位';
  if (t === '買位') return '買位';
  if (t === '院舍券級別0' || t === '院舍券級別1-7') return '院舍券';
  if (t === '暫住') return '暫住';
  return '';
}

function badgeClass(t?: string | null): string {
  if (t === '私位') return 'bdg bdg-p';
  if (t === '買位') return 'bdg bdg-b';
  if (t === '院舍券級別0' || t === '院舍券級別1-7') return 'bdg bdg-v';
  if (t === '暫住') return 'bdg bdg-t';
  return '';
}

function roomOf(bedNum: string): string {
  const i = bedNum.lastIndexOf('-');
  return i > 0 ? bedNum.slice(0, i) : bedNum;
}

function stripCodePrefix(s: string): string {
  // 去掉第一個字母（代號），e.g. 'C202' → '202', 'C202-1' → '202-1'
  return s.slice(1);
}

export function generateBedListHtml(input: BedListInput): string {
  const {
    stationName,
    facilityName = DEFAULT_FACILITY_SETTINGS.facilityNameZh,
    beds,
    printDate,
  } = input;

  /* ── 1. 排序 & 分組 ── */
  const sorted = [...beds].sort((a, b) =>
    a.bed_number.localeCompare(b.bed_number, 'zh-Hant', { numeric: true })
  );
  const roomMap = new Map<string, BedListBed[]>();
  for (const b of sorted) {
    const r = roomOf(b.bed_number);
    if (!roomMap.has(r)) roomMap.set(r, []);
    roomMap.get(r)!.push(b);
  }
  const rooms = Array.from(roomMap.entries());

  /* ── 2. 版面自適應（欄寬分級字體 + per-row height） ── */
  const GAP = 1.5;
  // 表頭 ~20mm + 間距 = ~23mm
  const AVAIL_H = 197 - 23;
  const PAGE_W  = 287;

  // 卡片欄寬越窄，字體與列高退回越小；寬卡片才放大
  interface Tier {
    hdrMm: number; padMm: number; nameMm: number; subMm: number;
    rhPx: number; bnamePx: number; bnumPx: number; bnumEPx: number; badgePx: number; binfPx: number; btempPx: number;
  }
  const tierFor = (cardWmm: number): Tier => {
    if (cardWmm >= 44) return { hdrMm: 8.0, padMm: 1.6, nameMm: 7.4, subMm: 3.8, rhPx: 12,  bnamePx: 20,   bnumPx: 15,   bnumEPx: 14,   badgePx: 10.5, binfPx: 8.5, btempPx: 9 };
    if (cardWmm >= 35) return { hdrMm: 7.5, padMm: 1.3, nameMm: 6.4, subMm: 3.4, rhPx: 11,  bnamePx: 17,   bnumPx: 13.5, bnumEPx: 12.5, badgePx: 9.5,  binfPx: 8,   btempPx: 8 };
    return               { hdrMm: 6.5, padMm: 1.0, nameMm: 5.4, subMm: 3.0, rhPx: 9.5, bnamePx: 14.5, bnumPx: 12,   bnumEPx: 12,   badgePx: 8.5,  binfPx: 7.5, btempPx: 7 };
  };
  const cardWmm = (c: number) => (PAGE_W - (c - 1) * GAP) / c;

  let tier: Tier;
  // 床位行高 = 內距 + 姓名行 + 附屬資訊行數（原床 / 入住類型 / 感染控制每項一行）
  function getBedRowHeight(bed: BedListBed): number {
    if (!bed.patient) return tier.padMm + tier.nameMm;
    const subLines =
      (isTemporaryBed(bed) ? 1 : 0) +
      (typeLabel(bed.patient.admissionType) ? 1 : 0) +
      (bed.patient.infectionControl?.length ?? 0);
    return tier.padMm + tier.nameMm + subLines * tier.subMm;
  }
  function getRoomHeight(roomBeds: BedListBed[]): number {
    return tier.hdrMm + roomBeds.reduce((sum, b) => sum + getBedRowHeight(b), 0) + 0.5;
  }

  function totalCardH(c: number): number {
    let sum = 0;
    for (let i = 0; i < rooms.length; i += c) {
      const rowRooms = rooms.slice(i, i + c);
      const rowMax = Math.max(...rowRooms.map(([, bs]) => getRoomHeight(bs)), tier.hdrMm + tier.padMm + tier.nameMm + 0.5);
      sum += rowMax;
    }
    const rowCount = Math.ceil(rooms.length / c);
    return sum + (rowCount - 1) * GAP;
  }

  let cols = 10;
  tier = tierFor(cardWmm(10));
  const startCols = Math.min(6, rooms.length || 6);
  for (let c = startCols; c <= 10; c++) {
    const t = tierFor(cardWmm(c));
    tier = t;
    cols = c;
    if (totalCardH(c) <= AVAIL_H) break;
  }

  /* ── 3. 列印日期 ── */
  const today = printDate
    ?? formatDisplayDate(new Date());

  /* ── 4. 渲染床行 ── */
  const renderBedRow = (bed: BedListBed, idx: number): string => {
    const alt = idx % 2 === 1 ? ' br-alt' : '';
    const rowH = getBedRowHeight(bed);
    const flexStyle = `flex:${rowH.toFixed(1)}; min-height:${rowH.toFixed(1)}mm; max-height:${(rowH * 1.8).toFixed(1)}mm`;
    if (!bed.patient) {
      const emptyLabel = bed.reserved ? '已佔床' : '未入住';
      const tempBedHtml = isTemporaryBed(bed)
        ? `<div class="bsub-line"><span class="btemp">(原${bed.original_bed_number})</span></div>`
        : '';
      return `<div class="br br-e${alt}" style="${flexStyle}">
  <div class="br-left"><span class="bnum-e">${stripCodePrefix(bed.bed_number)}</span></div>
  <div class="br-right">
    <div class="bname-line"><span class="bempty-tag">${emptyLabel}</span></div>
    ${tempBedHtml}
  </div>
</div>`;
    }
    // 姓名在上，原床 / 感染控制（每項一行）在姓名之下；入住類型（全寫）緊接床號之下
    const tempBedHtml = isTemporaryBed(bed)
      ? `<div class="bsub-line"><span class="btemp">(原${bed.original_bed_number})</span></div>`
      : '';
    const lbl = typeLabel(bed.patient.admissionType);
    const cls = badgeClass(bed.patient.admissionType);
    const typeHtml = cls ? `<span class="${cls}">${lbl}</span>` : '';
    const infectionHtml = (bed.patient.infectionControl ?? [])
      .map(ic => `<div class="binf-line"><span class="binf">${ic}</span></div>`)
      .join('');
    return `<div class="br${alt}" style="${flexStyle}">
  <div class="br-left">
    <span class="bnum">${stripCodePrefix(bed.bed_number)}</span>
    ${typeHtml}
  </div>
  <div class="br-right">
    <div class="bname-line"><span class="bname">${bed.patient.name}</span></div>
    ${tempBedHtml}
    ${infectionHtml}
  </div>
</div>`;
  };

  /* ── 5. 渲染房間卡片 ── */
  const renderRoom = ([roomId, roomBeds]: [string, BedListBed[]]): string => {
    const rows = roomBeds.map((b, i) => renderBedRow(b, i)).join('');
    return `<div class="rc"><div class="rh">${stripCodePrefix(roomId)}房</div><div class="rbed">${rows}<div class="rsp"></div></div></div>`;
  };

  /* ── 6. 組裝卡片列 ── */
  const cardRowsHtml: string[] = [];
  for (let i = 0; i < rooms.length; i += cols) {
    const rowRooms = rooms.slice(i, i + cols);
    const rowMax   = Math.max(...rowRooms.map(([, bs]) => getRoomHeight(bs)), tier.hdrMm + tier.padMm + tier.nameMm + 0.5);
    const phantoms = Array(cols - rowRooms.length).fill('<div class="rc rc-ph"></div>').join('');
    cardRowsHtml.push(
      `<div class="crow" style="flex:${rowMax.toFixed(1)}; min-height:${rowMax.toFixed(1)}mm">${rowRooms.map(renderRoom).join('')}${phantoms}</div>`
    );
  }

  /* ── 7. 完整 HTML ── */
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1120, initial-scale=1">
<title>${facilityName} ${stationName} 床位表</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif; color: #111; }
@page { size: A4 landscape; margin: 5mm; }
.btemp { font-size: ${tier.btempPx}px; color: #666; white-space: nowrap; }
/* 共用：不含 height/overflow/shadow，由各 media 自己定義 */
.page { width:287mm; display:flex; flex-direction:column; gap:2mm; background:#fff; flex-shrink:0; }

/* 表頭 */
.hdr { display:flex; align-items:center; gap:3mm; padding-bottom:2.5mm; border-bottom:2px solid #1f2937; flex-shrink:0; }
.hdr-mid { flex:1; }
.facility { font-size:15px; font-weight:bold; color:#1f2937; letter-spacing:.5px; }
.tbl-title { font-size:10px; color:#6b7280; margin-top:1.5px; }
.hdr-right { font-size:8.5px; color:#6b7280; text-align:right; white-space:nowrap; line-height:2; }

/* 卡片區 */
.card-area { flex:1; display:flex; flex-direction:column; gap:${GAP}mm; overflow:hidden; min-height:0; }
.crow { display:flex; gap:${GAP}mm; overflow:hidden; }

/* 房間卡片 */
.rc { flex:1; border:1.5px solid #94a3b8; border-radius:3px; display:flex; flex-direction:column; min-width:0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.10); }
.rc-ph { border:none; background:transparent; box-shadow:none; visibility:hidden; }
.rh { background:#1f2937; color:#fff; font-size:${tier.rhPx}px; font-weight:700; text-align:center; padding:2px 3px; letter-spacing:.5px; flex-shrink:0; line-height:1.4; }

/* 床位列（flex 伸展填滿房間卡片，min-height 由 inline 保底） */
.rbed { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
.rsp { flex:1; min-height:0; }
.br { display:flex; align-items:stretch; gap:3px; padding:0 4px; border-top:1px solid #f1f5f9; background:#fff; overflow:hidden; }
.br:first-child { border-top:none; }
.br-alt { background:#f9fafb; }
.br-e { background: repeating-linear-gradient(-45deg, #f8f8f8, #f8f8f8 3px, #eff0f1 3px, #eff0f1 7px); border-top-color:#e5e7eb; }
.br-e.br-alt { filter:brightness(.97); }
/* 床號與姓名同一水平線開始，資訊行往下排列；入住類型在床號之下 */
.br-left { display:flex; flex-direction:column; align-items:flex-start; gap:1px; flex-shrink:0; padding-top:${(tier.padMm / 2).toFixed(1)}mm; }
.br-right { flex:1; display:flex; flex-direction:column; justify-content:flex-start; min-width:0; gap:1px; padding-top:${(tier.padMm / 2).toFixed(1)}mm; }
.bname-line { display:flex; justify-content:flex-end; align-items:center; line-height:1.1; }
.bsub-line { display:flex; justify-content:flex-end; align-items:center; line-height:1.15; }
.binf-line { display:flex; justify-content:flex-end; align-items:center; line-height:1.15; }
.bnum-e { font-size:${tier.bnumEPx}px; color:#9ca3af; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.bempty-tag { font-size:${tier.bnumEPx}px; font-weight:600; color:#9ca3af; background:#fff; border:1px solid #d1d5db; border-radius:3px; padding:0 4px; letter-spacing:.3px; }
.bnum { font-size:${tier.bnumPx}px; color:#6b7280; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; font-weight:600; }
.binf { font-size:${tier.binfPx}px; color:#dc2626; font-weight:600; white-space:nowrap; }
.bname { font-size:${tier.bnamePx}px; font-weight:700; color:#111827; text-align:right; white-space:nowrap; line-height:1.1; }
.bname-e { flex:1; }

/* 入住類型小標籤 */
.bdg { display:inline-flex; align-items:center; justify-content:center; padding:1px 4px; border-radius:3px; font-size:${tier.badgePx}px; font-weight:700; color:#fff; line-height:1.2; flex-shrink:0; }
.bdg-p { background:#3b82f6; }
.bdg-b { background:#f59e0b; }
.bdg-v { background:#10b981; }
.bdg-t { background:#8b5cf6; }

/* 列印按鈕 */
.print-btn { position:fixed; top:12px; right:12px; background:#2563eb; color:#fff; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-size:13px; font-family:inherit; font-weight:600; z-index:9999; box-shadow:0 2px 8px rgba(37,99,235,.4); }
.print-btn:hover { background:#1d4ed8; }
/* ── 螢幕專用：置中、背景、固定高度、陰影 ── */
@media screen {
  html { min-height:100%; background:#c8ccd0; }
  body { background:#c8ccd0; }
  .pw  { padding:10mm; }
  .page { height:197mm; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.22); margin:auto; }
}
/* ── 列印專用：移除 wrapper 開銷、固定一頁高度讓床位列伸展填滿 ── */
@media print {
  .no-print { display:none; }
  html, body { background:white; }
  .pw  { display:block; }
  .page { width:100%; height:197mm; overflow:hidden; box-shadow:none; }
}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">列印</button>
<div class="pw">
<div class="page">
  <div class="hdr">
    <div class="hdr-mid">
      <div class="facility">${facilityName}</div>
      <div class="tbl-title">${stationName} · 床位表</div>
    </div>
    <div class="hdr-right">列印日期<br>${today}</div>
  </div>
  <div class="card-area">
    ${cardRowsHtml.join('\n    ')}
  </div>
</div>
</div>
</body>
</html>`;
}

export async function printBedList(input: BedListInput): Promise<void> {
  const settings = await getFacilitySettings();
  const html = generateBedListHtml({
    ...input,
    facilityName: input.facilityName ?? settings.facilityNameZh,
  });
  const old = document.getElementById('bed-list-printframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'bed-list-printframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
}
