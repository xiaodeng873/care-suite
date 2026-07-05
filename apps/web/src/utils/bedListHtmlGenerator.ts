/**
 * 床位表 HTML 列印產生器 v3
 * A4 橫向，4 區塊統計欄，逐床縱向，每行高度按該行最多床決定
 */

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
  logoBase64?: string;
  beds: BedListBed[];
  printDate?: string;
  /** 特別關顧人數（需從任務表預先計算，不提供則顯示 — ） */
  specialCareCount?: number;
}

function typeLabel(t?: string | null): string {
  if (t === '私位') return '私';
  if (t === '買位') return '買';
  if (t === '院舍卷') return '卷';
  if (t === '暫住') return '暫';
  return '';
}

function badgeClass(t?: string | null): string {
  if (t === '私位') return 'bdg bdg-p';
  if (t === '買位') return 'bdg bdg-b';
  if (t === '院舍卷') return 'bdg bdg-v';
  if (t === '暫住') return 'bdg bdg-t';
  return '';
}

function roomOf(bedNum: string): string {
  const i = bedNum.lastIndexOf('-');
  return i > 0 ? bedNum.slice(0, i) : bedNum;
}

export function generateBedListHtml(input: BedListInput): string {
  const {
    stationName,
    facilityName = '善頤(福群)護老院',
    logoBase64,
    beds,
    printDate,
    specialCareCount,
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
  const vouN      = occ.filter(b => b.patient?.admissionType === '院舍卷').length;
  const tempN     = occ.filter(b => b.patient?.admissionType === '暫住').length;
  // 護理 × 性別
  const care = (lvl: string, g: string) =>
    occ.filter(b => b.patient?.careLevel === lvl && b.patient?.gender === g).length;
  const fcM = care('全護理', '男'), fcF = care('全護理', '女');
  const hcM = care('半護理', '男'), hcF = care('半護理', '女');
  const scM = care('自理', '男'),   scF = care('自理', '女');
  const spN = specialCareCount ?? -1;
  // 感染控制：按類型統計
  const infMap = new Map<string, number>();
  for (const b of occ) {
    if (b.patient?.infectionControl) {
      for (const t of b.patient.infectionControl) {
        infMap.set(t, (infMap.get(t) ?? 0) + 1);
      }
    }
  }
  const infEntries = Array.from(infMap.entries()).sort((a, b) => b[1] - a[1]);

  /* ── 3. 版面自適應（per-row height） ── */
  const HDR_MM     = 6.5;
  const BED_ROW_MM = 5.0;
  const GAP        = 1.5;
  // 表頭 ~20mm + 統計欄 ~16mm + 間距 2×2.2mm = ~40.4mm
  const AVAIL_H    = 197 - 40;

  function totalCardH(c: number): number {
    let sum = 0;
    for (let i = 0; i < rooms.length; i += c) {
      const rowRooms = rooms.slice(i, i + c);
      const rowMax = Math.max(...rowRooms.map(([, bs]) => bs.length), 1);
      sum += HDR_MM + rowMax * BED_ROW_MM + 0.5;
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
    if (!bed.patient) {
      return `<div class="br br-e${alt}"><span class="bnum-e">${bed.bed_number}</span><span class="bempty-tag">空床</span></div>`;
    }
    const lbl = typeLabel(bed.patient.admissionType);
    const cls = badgeClass(bed.patient.admissionType);
    return `<div class="br${alt}"><span class="bnum">${bed.bed_number}</span>${cls ? `<span class="${cls}">${lbl}</span>` : ''}<span class="bname">${bed.patient.name}</span></div>`;
  };

  /* ── 6. 渲染房間卡片 ── */
  const renderRoom = ([roomId, roomBeds]: [string, BedListBed[]]): string => {
    const rows = roomBeds.map((b, i) => renderBedRow(b, i)).join('');
    return `<div class="rc"><div class="rh">${roomId}房</div><div class="rbed">${rows}<div class="rsp"></div></div></div>`;
  };

  /* ── 7. 組裝卡片列 ── */
  const cardRowsHtml: string[] = [];
  for (let i = 0; i < rooms.length; i += cols) {
    const rowRooms = rooms.slice(i, i + cols);
    const rowMax   = Math.max(...rowRooms.map(([, bs]) => bs.length), 1);
    const rowHmm   = HDR_MM + rowMax * BED_ROW_MM + 0.5;
    const phantoms = Array(cols - rowRooms.length).fill('<div class="rc rc-ph"></div>').join('');
    cardRowsHtml.push(
      `<div class="crow" style="height:${rowHmm.toFixed(1)}mm">${rowRooms.map(renderRoom).join('')}${phantoms}</div>`
    );
  }

  /* ── 8. Logo ── */
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="logo" alt="logo">`
    : `<div class="logo-ph"></div>`;

  /* ── 9. 統計欄 HTML（4 區塊） ── */
  const mkRow = (label: string, val: string | number) =>
    `<div class="sr"><span class="sl">${label}</span><span class="sv">${val}</span></div>`;
  const mkCareRow = (label: string, m: number, f: number) =>
    `<div class="sr-care"><span class="sc-lbl">${label}</span><span class="sc-g"><span class="sc-val">男 ${m}</span><span class="sc-sep">/</span><span class="sc-val">女 ${f}</span></span></div>`;

  const infHtml = infEntries.length > 0
    ? infEntries.map(([t, n]) => mkRow(t, n)).join('')
    : `<div class="sr"><span class="sl" style="color:#9ca3af">無記錄</span></div>`;

  const statsHtml = `
  <div class="stats-grid">
    <div class="sg-block">
      <div class="sg-title">床位統計</div>
      ${mkRow('總床位', totalBeds)}
      ${mkRow('已入住', occupiedN)}
      ${mkRow('空床', emptyN)}
    </div>
    <div class="sg-block">
      <div class="sg-title">入住類型</div>
      ${mkRow('私位', privateN)}
      ${mkRow('買位', buyN)}
      ${mkRow('院舍卷', vouN)}
      ${mkRow('暫住', tempN)}
    </div>
    <div class="sg-block sg-wide">
      <div class="sg-title">護理統計</div>
      ${mkCareRow('全護理', fcM, fcF)}
      ${mkCareRow('半護理', hcM, hcF)}
      ${mkCareRow('自理', scM, scF)}
      ${mkRow('特別關顧', spN >= 0 ? spN : '—')}
    </div>
    <div class="sg-block">
      <div class="sg-title">感染控制</div>
      ${infHtml}
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
.logo { width:13mm; height:13mm; object-fit:contain; flex-shrink:0; }
.logo-ph { width:13mm; height:13mm; border:1.5px dashed #ccc; border-radius:3px; flex-shrink:0; }
.hdr-mid { flex:1; }
.facility { font-size:15px; font-weight:bold; color:#1f2937; letter-spacing:.5px; }
.tbl-title { font-size:10px; color:#6b7280; margin-top:1.5px; }
.hdr-right { font-size:8.5px; color:#6b7280; text-align:right; white-space:nowrap; line-height:2; }

/* 統計欄（4 區塊 grid） */
.stats-grid {
  display:grid;
  grid-template-columns:1fr 1fr 1.7fr 1fr;
  border:1.5px solid #94a3b8;
  border-radius:4px;
  overflow:hidden;
  flex-shrink:0;
  background:#fff;
}
.sg-block { padding:2.5px 6px 3px; border-right:1px solid #d1d5db; display:flex; flex-direction:column; gap:0.5px; }
.sg-block:last-child { border-right:none; }
.sg-title { font-size:8px; font-weight:700; color:#334155; letter-spacing:.3px; border-bottom:1px solid #e5e7eb; padding-bottom:1.5px; margin-bottom:1.5px; text-transform:uppercase; }
.sr { display:flex; justify-content:space-between; align-items:center; padding:0.5px 0; }
.sl { font-size:8.5px; color:#64748b; }
.sv { font-size:10px; font-weight:700; color:#1e293b; }
.sr-care { display:flex; align-items:center; gap:3px; padding:0.5px 0; }
.sc-lbl { font-size:8.5px; color:#64748b; min-width:30px; flex-shrink:0; }
.sc-g { display:flex; align-items:center; gap:2px; }
.sc-val { font-size:9.5px; font-weight:700; color:#1e293b; }
.sc-sep { font-size:8px; color:#9ca3af; }

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
.br { display:flex; align-items:center; gap:3px; padding:0 4px; border-top:1px solid #f1f5f9; height:${BED_ROW_MM}mm; flex-shrink:0; background:#fff; overflow:hidden; }
.br:first-child { border-top:none; }
.br-alt { background:#f9fafb; }
.br-e {
  background: repeating-linear-gradient(
    -45deg,
    #f8f8f8,
    #f8f8f8 3px,
    #eff0f1 3px,
    #eff0f1 7px
  );
  border-top-color:#e5e7eb;
}
.br-e.br-alt { filter:brightness(.97); }
.bnum-e { font-size:8.5px; color:#9ca3af; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.bempty-tag { font-size:8px; font-weight:600; color:#9ca3af; background:#fff; border:1px solid #d1d5db; border-radius:3px; padding:0 4px; margin-left:auto; letter-spacing:.3px; }
.bnum { font-size:8.5px; color:#6b7280; flex-shrink:0; white-space:nowrap; font-variant-numeric:tabular-nums; }
.bname { flex:1; font-size:12px; font-weight:500; color:#111827; text-align:right; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
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
    ${logoHtml}
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

export function printBedList(input: BedListInput): void {
  const html = generateBedListHtml(input);
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
