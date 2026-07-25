/**
 * 床位表 HTML 列印產生器 v4
 * A4 橫向，6 區塊統計欄（護理統計2欄/醫療項目3欄），逐床縱向，每行高度按該行最多床決定
 */

import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

export interface BedListBed {
  bed_number: string;
  patient?: {
    name: string;
    gender?: string;
    admissionType?: string;
    careLevel?: string;
    infectionControl?: string[] | null;
  } | null;
}

export interface BedListInput {
  stationName: string;
  facilityName?: string;
  beds: BedListBed[];
  printDate?: string;
  /** 特別關顧（男/女），從任務表預先計算 */
  specialCare?: { 男: number; 女: number };
  /** 入住醫院（男/女） */
  hospitalized?: { 男: number; 女: number };
  /** 暫時回家（男/女） */
  vacation?: { 男: number; 女: number };
  /** 過去 24 小時統計 */
  over24h?: { 新收: number; 退住: number; 死亡: number; 當月累積死亡: number };
  /** 醫療項目人數 */
  medical?: { 鼻胃飼: number; 尿管: number; 傷口: number; 壓瘡: number; 腹膜透析: number; 吸氧: number; 造口: number; 傳染病隔離: number; 使用約束物品: number };
  /** 意外事件統計 */
  incidents?: { 藥物: number; 跌倒: number; 死亡: number };
}

function typeLabel(t?: string | null): string {
  if (t === '私位') return '私';
  if (t === '買位') return '買';
  if (t === '院舍卷級別0' || t === '院舍卷級別1-7') return '卷';
  if (t === '暫住') return '暫';
  return '';
}

function badgeClass(t?: string | null): string {
  if (t === '私位') return 'bdg bdg-p';
  if (t === '買位') return 'bdg bdg-b';
  if (t === '院舍卷級別0' || t === '院舍卷級別1-7') return 'bdg bdg-v';
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
    specialCare,
    hospitalized,
    vacation,
    over24h,
    medical,
    incidents,
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

  /* ── 2. 統計 ── */
  const totalBeds = beds.length;
  const occ       = beds.filter(b => b.patient);
  const occupiedN = occ.length;
  const emptyN    = totalBeds - occupiedN;
  const privateN  = occ.filter(b => b.patient?.admissionType === '私位').length;
  const buyN      = occ.filter(b => b.patient?.admissionType === '買位').length;
  const vouN      = occ.filter(b => b.patient?.admissionType === '院舍卷級別0' || b.patient?.admissionType === '院舍卷級別1-7').length;
  const tempN     = occ.filter(b => b.patient?.admissionType === '暫住').length;
  // 護理 × 性別
  const care = (lvl: string, g: string) =>
    occ.filter(b => b.patient?.careLevel === lvl && b.patient?.gender === g).length;
  const fcM = care('全護理', '男'), fcF = care('全護理', '女');
  const hcM = care('半護理', '男'), hcF = care('半護理', '女');
  const scM = care('自理', '男'),   scF = care('自理', '女');

  /* ── 3. 版面自適應（per-row height） ── */
  const HDR_MM         = 6.5;
  const BED_ROW_MM     = 5.0;
  const BED_ROW_INF_MM = 8.0;  // 有感染控制項目時加高，讓 7px 小字可折 2 行
  const GAP            = 1.5;
  // 表頭 ~20mm + 統計欄 ~16mm + 間距 2×2.2mm = ~40.4mm
  const AVAIL_H        = 197 - 40;

  function getBedRowHeight(bed: BedListBed): number {
    return bed.patient?.infectionControl && bed.patient.infectionControl.length > 0 ? BED_ROW_INF_MM : BED_ROW_MM;
  }
  function getRoomHeight(roomBeds: BedListBed[]): number {
    return HDR_MM + roomBeds.reduce((sum, b) => sum + getBedRowHeight(b), 0) + 0.5;
  }

  function totalCardH(c: number): number {
    let sum = 0;
    for (let i = 0; i < rooms.length; i += c) {
      const rowRooms = rooms.slice(i, i + c);
      const rowMax = Math.max(...rowRooms.map(([, bs]) => getRoomHeight(bs)), HDR_MM + BED_ROW_MM + 0.5);
      sum += rowMax;
    }
    const rowCount = Math.ceil(rooms.length / c);
    return sum + (rowCount - 1) * GAP;
  }

  let cols = 6;
  for (let c = 6; c <= 10; c++) {
    cols = c;
    if (totalCardH(c) <= AVAIL_H) break;
  }

  /* ── 4. 列印日期 ── */
  const today = printDate
    ?? new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });

  /* ── 5. 渲染床行 ── */
  const renderBedRow = (bed: BedListBed, idx: number): string => {
    const alt = idx % 2 === 1 ? ' br-alt' : '';
    const rowH = getBedRowHeight(bed);
    if (!bed.patient) {
      return `<div class="br br-e${alt}" style="height:${rowH.toFixed(1)}mm"><span class="bnum-e">${stripCodePrefix(bed.bed_number)}</span><span class="bempty-tag">未入住</span></div>`;
    }
    const lbl = typeLabel(bed.patient.admissionType);
    const cls = badgeClass(bed.patient.admissionType);
    // 感染控制項目：獨立第二行，靠左，小字，可折 2 行
    const infectionCtrlHtml = bed.patient.infectionControl && bed.patient.infectionControl.length > 0
      ? `<div class="binf-line"><span class="binf">${bed.patient.infectionControl.join('/')}</span></div>`
      : '';
    return `<div class="br${alt}" style="height:${rowH.toFixed(1)}mm">
  <div class="br-left">
    <span class="bnum">${stripCodePrefix(bed.bed_number)}</span>
    ${cls ? `<span class="${cls}">${lbl}</span>` : ''}
  </div>
  <div class="br-right">
    <div class="bname-line"><span class="bname">${bed.patient.name}</span></div>
    ${infectionCtrlHtml}
  </div>
</div>`;
  };

  /* ── 6. 渲染房間卡片 ── */
  const renderRoom = ([roomId, roomBeds]: [string, BedListBed[]]): string => {
    const rows = roomBeds.map((b, i) => renderBedRow(b, i)).join('');
    return `<div class="rc"><div class="rh">${stripCodePrefix(roomId)}房</div><div class="rbed">${rows}<div class="rsp"></div></div></div>`;
  };

  /* ── 7. 組裝卡片列 ── */
  const cardRowsHtml: string[] = [];
  for (let i = 0; i < rooms.length; i += cols) {
    const rowRooms = rooms.slice(i, i + cols);
    const rowMax   = Math.max(...rowRooms.map(([, bs]) => getRoomHeight(bs)), HDR_MM + BED_ROW_MM + 0.5);
    const phantoms = Array(cols - rowRooms.length).fill('<div class="rc rc-ph"></div>').join('');
    cardRowsHtml.push(
      `<div class="crow" style="height:${rowMax.toFixed(1)}mm">${rowRooms.map(renderRoom).join('')}${phantoms}</div>`
    );
  }

  /* ── 9. 統計欄 HTML（6 區塊） ── */
  const dash = '—';
  const nv = (v?: number) => v != null ? String(v) : dash;
  const mkRow = (label: string, val: string | number) =>
    `<div class="sr"><span class="sl">${label}</span><span class="sv">${val}</span></div>`;
  const mkCareRow2 = (label: string, mf?: { 男: number; 女: number } | null) =>
    `<div class="sr-c2"><span class="sc-l2">${label}</span><span class="sc-v2">${mf ? `男${mf.男}/女${mf.女}` : dash}</span></div>`;

  const statsHtml = `
  <div class="stats-grid">
    <div class="sg-block">
      <div class="sg-title">床位統計</div>
      ${mkRow('總床位', totalBeds)}
      ${mkRow('已入住', occupiedN)}
      ${mkRow('未入住', emptyN)}
    </div>
    <div class="sg-block">
      <div class="sg-title">入住類型</div>
      ${mkRow('私位', privateN)}
      ${mkRow('買位', buyN)}
      ${mkRow('院舍卷（0/1-7）', vouN)}
      ${mkRow('暫住', tempN)}
    </div>
    <div class="sg-block">
      <div class="sg-title">過去 24 小時</div>
      ${mkRow('新收', nv(over24h?.新收))}
      ${mkRow('退住', nv(over24h?.退住))}
      ${mkRow('死亡', nv(over24h?.死亡))}
      ${mkRow('月累積死亡', nv(over24h?.當月累積死亡))}
    </div>
    <div class="sg-block">
      <div class="sg-title">護理統計</div>
      <div class="sg-2col">
        <div class="sg-sub">
          ${mkCareRow2('全護理', { 男: fcM, 女: fcF })}
          ${mkCareRow2('半護理', { 男: hcM, 女: hcF })}
          ${mkCareRow2('自理', { 男: scM, 女: scF })}
        </div>
        <div class="sg-sub">
          ${mkCareRow2('特別關顧', specialCare ?? null)}
          ${mkCareRow2('入住醫院', hospitalized ?? null)}
          ${mkCareRow2('暫時回家', vacation ?? null)}
        </div>
      </div>
    </div>
    <div class="sg-block">
      <div class="sg-title">醫療項目</div>
      <div class="sg-3col">
        <div class="sg-sub">
          ${mkRow('鼻胃飼', nv(medical?.鼻胃飼))}
          ${mkRow('尿管', nv(medical?.尿管))}
          ${mkRow('傷口', nv(medical?.傷口))}
        </div>
        <div class="sg-sub">
          ${mkRow('壓瘡', nv(medical?.壓瘡))}
          ${mkRow('腹膜透析', nv(medical?.腹膜透析))}
          ${mkRow('吸氧', nv(medical?.吸氧))}
        </div>
        <div class="sg-sub">
          ${mkRow('造口', nv(medical?.造口))}
          ${mkRow('傳染病隔離', nv(medical?.傳染病隔離))}
          ${mkRow('約束物品', nv(medical?.使用約束物品))}
        </div>
      </div>
    </div>
    <div class="sg-block">
      <div class="sg-title">意外事件</div>
      ${mkRow('藥物', nv(incidents?.藥物))}
      ${mkRow('跌倒', nv(incidents?.跌倒))}
      ${mkRow('死亡', nv(incidents?.死亡))}
    </div>
  </div>`;

  /* ── 10. 完整 HTML ── */
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
/* 共用：不含 height/overflow/shadow，由各 media 自己定義 */
.page { width:287mm; display:flex; flex-direction:column; gap:2mm; background:#fff; flex-shrink:0; }

/* 表頭 */
.hdr { display:flex; align-items:center; gap:3mm; padding-bottom:2.5mm; border-bottom:2px solid #1f2937; flex-shrink:0; }
.hdr-mid { flex:1; }
.facility { font-size:15px; font-weight:bold; color:#1f2937; letter-spacing:.5px; }
.tbl-title { font-size:10px; color:#6b7280; margin-top:1.5px; }
.hdr-right { font-size:8.5px; color:#6b7280; text-align:right; white-space:nowrap; line-height:2; }

/* 統計欄（6 區塊 grid） */
.stats-grid {
  display:grid;
  grid-template-columns:1fr 1fr 1fr 2.2fr 3fr 1fr;
  border:1.5px solid #94a3b8;
  border-radius:4px;
  overflow:hidden;
  flex-shrink:0;
  background:#fff;
}
.sg-block { padding:2.5px 5px 3px; border-right:1px solid #d1d5db; display:flex; flex-direction:column; gap:0.5px; }
.sg-block:last-child { border-right:none; }
.sg-title { font-size:8px; font-weight:700; color:#334155; letter-spacing:.3px; border-bottom:1px solid #e5e7eb; padding-bottom:1.5px; margin-bottom:1.5px; }
.sr { display:flex; justify-content:space-between; align-items:center; padding:0.5px 0; }
.sl { font-size:7.5px; color:#64748b; }
.sv { font-size:9.5px; font-weight:700; color:#1e293b; }
/* 護理統計 & 醫療項目 內部子欄 */
.sg-2col { display:flex; flex:1; gap:4px; align-items:stretch; }
.sg-3col { display:flex; flex:1; gap:2px; align-items:stretch; }
.sg-sub { flex:1; display:flex; flex-direction:column; gap:0.5px; min-width:0; }
.sg-sub + .sg-sub { border-left:1px solid #e5e7eb; padding-left:3px; }
/* 護理統計 compact care row（標籤 + 男X/女Y） */
.sr-c2 { display:flex; align-items:center; justify-content:space-between; padding:0.5px 0; }
.sc-l2 { font-size:7px; color:#64748b; flex-shrink:0; white-space:nowrap; }
.sc-v2 { font-size:7.5px; font-weight:700; color:#1e293b; white-space:nowrap; }

/* 卡片區 */
.card-area { flex:1; display:flex; flex-direction:column; gap:${GAP}mm; overflow:hidden; min-height:0; }
.crow { display:flex; gap:${GAP}mm; flex-shrink:0; overflow:hidden; }

/* 房間卡片 */
.rc { flex:1; border:1.5px solid #94a3b8; border-radius:3px; display:flex; flex-direction:column; min-width:0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.10); }
.rc-ph { border:none; background:transparent; box-shadow:none; visibility:hidden; }
.rh { background:#1f2937; color:#fff; font-size:9.5px; font-weight:700; text-align:center; padding:2px 3px; letter-spacing:.5px; flex-shrink:0; line-height:1.4; }

/* 床位列 */
.rbed { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.rsp { flex:1; min-height:0; }
.br { display:flex; align-items:stretch; gap:3px; padding:0 4px; border-top:1px solid #f1f5f9; flex-shrink:0; background:#fff; overflow:hidden; }
.br:first-child { border-top:none; }
.br-alt { background:#f9fafb; }
.br-e { align-items:center; background: repeating-linear-gradient(-45deg, #f8f8f8, #f8f8f8 3px, #eff0f1 3px, #eff0f1 7px); border-top-color:#e5e7eb; }
.br-e.br-alt { filter:brightness(.97); }
.br-left { display:flex; align-items:center; gap:3px; flex-shrink:0; }
.br-right { flex:1; display:flex; flex-direction:column; justify-content:center; min-width:0; }
.bname-line { display:flex; justify-content:flex-end; align-items:center; line-height:1.1; }
.binf-line { display:flex; justify-content:flex-end; align-items:center; line-height:1.1; }
.bnum-e { font-size:12px; color:#9ca3af; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.bempty-tag { font-size:12px; font-weight:600; color:#9ca3af; background:#fff; border:1px solid #d1d5db; border-radius:3px; padding:0 4px; margin-left:auto; letter-spacing:.3px; }
.bnum { font-size:12px; color:#6b7280; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; font-weight:600; }
.binf { font-size:7px; color:#dc2626; font-weight:600; line-height:1.1; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.bname { font-size:13.5px; font-weight:600; color:#111827; text-align:right; white-space:nowrap; line-height:1.1; }
.bname-e { flex:1; }

/* 入住類型小標籤 */
.bdg { display:inline-flex; align-items:center; justify-content:center; padding:1px 4px; border-radius:3px; font-size:8.5px; font-weight:700; color:#fff; line-height:1.2; flex-shrink:0; }
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
/* ── 列印專用：移除 wrapper 開銷、高度自適應 ── */
@media print {
  .no-print { display:none; }
  html, body { background:white; }
  .pw  { display:block; }
  .page { width:100%; height:auto; overflow:visible; box-shadow:none; }
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
  ${statsHtml}
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
