import { TIME_SLOTS } from './careRecordHelper';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatrolRoundRecord {
  patrol_date: string;      // 'YYYY-MM-DD'
  scheduled_time: string;   // 'HH:MM'
  patrol_time?: string;     // actual recorded time
  recorder?: string;
  co_signer?: string | null;
}

export interface PatrolRoundsExportOptions {
  facilityName?: string;
  logoBase64?: string;
  bedNumber: string;
  startDate: string;  // 'YYYY-MM-DD'
  endDate: string;    // 'YYYY-MM-DD'
  rounds: PatrolRoundRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 16; // 8 columns × 2 rows

const PAGE_CSS = `
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: A4 landscape; margin: 6mm 5mm; }

html, body {
  font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
  font-size: 8pt;
  color: #111827;
  background: #fff;
}

@media screen {
  body { background: #dde3ec; padding: 16mm; }
  .page { box-shadow: 0 6px 24px rgba(0,0,0,.18); margin-bottom: 16mm; }
}

@media print {
  body { background: #fff; padding: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
}

/* ── Page shell ── */
.page {
  width: 287mm;
  min-height: 190mm;
  background: #fff;
  padding: 6mm 5mm 5mm;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.hdr {
  display: grid;
  grid-template-columns: 14mm 1fr 28mm;
  column-gap: 4mm;
  align-items: center;
  padding-bottom: 2mm;
  border-bottom: 1.5px solid #1d4ed8;
  margin-bottom: 2.5mm;
}
.logo {
  width: 12mm; height: 12mm;
  object-fit: contain;
}
.logo-ph {
  width: 12mm; height: 12mm;
  border: 1pt solid #94a3b8;
  background: #f1f5f9;
  display: flex; align-items: center; justify-content: center;
  font-size: 5.5pt; color: #64748b; text-align: center;
  line-height: 1.3;
}
.hdr-title { text-align: center; }
.facility {
  font-size: 13pt; font-weight: 900;
  color: #1e3a5f; letter-spacing: .3pt;
}
.doc-title {
  margin-top: 1pt;
  font-size: 8pt; font-weight: 700;
  color: #047857;
}
.hdr-meta { text-align: right; }
.bed-label { font-size: 6pt; color: #6b7280; letter-spacing: .5pt; }
.bed-no { font-size: 15pt; font-weight: 900; color: #1e3a5f; line-height: 1; }

/* ── Card grid ── */
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-auto-rows: 1fr;
  gap: 2mm;
  flex: 1;
}

/* ── Day card ── */
.card {
  border: .5pt solid #cbd5e1;
  border-radius: 2pt;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-date {
  background: #1d4ed8;
  color: #fff;
  font-size: 7.5pt; font-weight: 700;
  text-align: center;
  padding: 1mm 0;
  letter-spacing: .2pt;
}
.card-empty .card-date { background: #e5e7eb; color: #9ca3af; }

.card table {
  width: 100%; border-collapse: collapse;
  table-layout: fixed;
  font-size: 6.5pt; line-height: 1.15;
  flex: 1;
}
.card table th {
  background: #eff6ff;
  color: #1e40af;
  font-weight: 700; font-size: 6pt;
  border: .3pt solid #bfdbfe;
  padding: .6mm .4mm;
  text-align: center;
}
.card table td {
  border: .3pt solid #e2e8f0;
  padding: .5mm .4mm;
  vertical-align: middle;
}
.card table td.slot {
  text-align: center;
  font-weight: 700;
  color: #374151;
  background: #f8fafc;
  width: 15%;
}
.card table td.val { width: 28.3%; }
.card table tr:nth-child(even) td { background: #f9fafb; }
.card table tr:nth-child(even) td.slot { background: #f1f5f9; }

/* ── Footer ── */
.footer {
  margin-top: 3mm;
  padding-top: 2.5mm;
  border-top: 1pt solid #e5e7eb;
  display: flex;
  justify-content: center;
  font-size: 7.5pt;
  font-weight: 600;
  color: #374151;
}
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const fin = new Date(end);
  while (cur <= fin) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Page builder ─────────────────────────────────────────────────────────────

function buildCard(date: string, roundMap: Map<string, PatrolRoundRecord>): string {
  const rows = TIME_SLOTS.map(ts => {
    const r = roundMap.get(ts);
    return `<tr>
      <td class="slot">${esc(ts)}</td>
      <td class="val">${esc(r?.patrol_time ?? '')}</td>
      <td class="val">${esc(r?.recorder ?? '')}</td>
      <td class="val">${esc(r?.co_signer ?? '')}</td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-date">${esc(date)}</div>
    <table>
      <thead><tr><th>時段</th><th>實際時間</th><th>記錄者</th><th>加簽</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildPage(
  pageIndex: number,
  totalPages: number,
  dates: string[],
  facilityName: string,
  logoBase64: string,
  bedNumber: string,
  dataIndex: Map<string, Map<string, PatrolRoundRecord>>
): string {
  const cards = dates.map(d =>
    buildCard(d, dataIndex.get(d) ?? new Map())
  ).join('\n');

  const logoHtml = logoBase64
    ? `<img class="logo" src="${esc(logoBase64)}" alt="logo">`
    : `<div class="logo-ph">院舍<br>Logo</div>`;

  return `<div class="page">
  <div class="hdr">
    <div>${logoHtml}</div>
    <div class="hdr-title">
      <div class="facility">${esc(facilityName)}</div>
      <div class="doc-title">巡房記錄</div>
    </div>
    <div class="hdr-meta">
      <div class="bed-label">床號 BED</div>
      <div class="bed-no">${esc(bedNumber)}</div>
    </div>
  </div>
  <div class="grid">${cards}</div>
  <div class="footer">第 ${pageIndex} / ${totalPages} 頁</div>
</div>`;
}

function buildDocument(
  pages: string[],
  facilityName: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1120,initial-scale=1">
<title>${esc(facilityName)} 巡房記錄</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

// ─── Print via iframe ─────────────────────────────────────────────────────────

function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: '1123px', height: '794px', border: '0',
  });
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const remove = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };

  const doc = iframe.contentWindow?.document;
  if (!doc) { remove(); return; }
  doc.open(); doc.write(html); doc.close();

  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(remove, 200));
  const trigger = () => setTimeout(() => { win.focus(); win.print(); }, 400);

  if (doc.readyState === 'complete') trigger(); else win.addEventListener('load', trigger);
  setTimeout(remove, 60_000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function exportPatrolRoundsRangeHtml(options: PatrolRoundsExportOptions): Promise<void> {
  const {
    facilityName = '善頤(福群)護老院',
    logoBase64 = '',
    bedNumber,
    startDate,
    endDate,
    rounds,
  } = options;

  const allDates = dateRange(startDate, endDate);
  if (allDates.length === 0) return;

  // Build lookup: date → (scheduledTime → record)
  const dataIndex = new Map<string, Map<string, PatrolRoundRecord>>();
  for (const r of rounds) {
    if (!dataIndex.has(r.patrol_date)) dataIndex.set(r.patrol_date, new Map());
    dataIndex.get(r.patrol_date)!.set(r.scheduled_time, r);
  }

  const pages = chunk(allDates, CARDS_PER_PAGE);
  const totalPages = pages.length;

  const pageHtmls = pages.map((dates, i) =>
    buildPage(i + 1, totalPages, dates, facilityName, logoBase64, bedNumber, dataIndex)
  );

  printViaIframe(buildDocument(pageHtmls, facilityName));
}
