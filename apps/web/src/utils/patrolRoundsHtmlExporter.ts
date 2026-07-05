import { TIME_SLOTS } from './careRecordHelper';

export interface PatrolRoundRecord {
  patrol_date: string; // 'YYYY-MM-DD'
  scheduled_time: string; // '07:00'
  patrol_time?: string; // actual time
  recorder?: string;
  co_signer?: string | null;
}

export interface PatrolRoundsHtmlInput {
  facilityName?: string;
  logoBase64?: string;
  bedNumber: string;
  dates: string[]; // YYYY-MM-DD array (max 16 per page)
  rounds?: PatrolRoundRecord[];
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// render single page fragment (up to 16 cards per page)
function renderPageFragment(pageNum: number, totalPages: number, input: PatrolRoundsHtmlInput): string {
  const {
    facilityName = '善頤(福群)護老院',
    logoBase64,
    bedNumber,
    dates = [],
    rounds = [],
  } = input;

  const map = new Map<string, Map<string, PatrolRoundRecord>>();
  for (const r of rounds) {
    const dmap = map.get(r.patrol_date) ?? new Map();
    dmap.set(r.scheduled_time, r);
    map.set(r.patrol_date, dmap);
  }

  const logoHtml = logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo">` : '<div class="logo-ph">院舍<br/>Logo</div>';

  const cards: string[] = [];
  for (const date of dates) {
    const rows = TIME_SLOTS.map((ts, idx) => {
      const r = map.get(date)?.get(ts) ?? null;
      const rowClass = idx % 2 === 0 ? 'c-zebra' : '';
      return `<tr class="${rowClass}">
        <td class="c-slot">${esc(ts)}</td>
        <td class="c-time">${esc(r?.patrol_time ?? '')}</td>
        <td class="c-rec">${esc(r?.recorder ?? '')}</td>
        <td class="c-sign">${esc(r?.co_signer ?? '')}</td>
      </tr>`;
    }).join('');

    const card = `<div class="card">
      <div class="card-hd">
        <div class="card-date">${esc(date)}</div>
      </div>
      <div class="card-body">
        <table class="card-table">
          <thead><tr><th>時段</th><th>實際巡房時間</th><th>記錄者</th><th>加簽者</th></tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>`;
    cards.push(card);
  }

  const pageLabel = `巡房記錄 第 ${pageNum}/${totalPages} 頁`;

  return `
  <div class="pw page-item" data-page="${pageNum}"><div class="page">
    <div class="hdr">
      <div class="hdr-left">
        ${logoHtml}
      </div>
      <div class="hdr-center">
        <div class="facility">${esc(facilityName)}</div>
        <div class="doc-title">巡房記錄（床號 ${esc(bedNumber)}）</div>
      </div>
      <div class="hdr-right">
        <div class="bed-label">床號</div>
        <div class="bed-number">${esc(bedNumber)}</div>
      </div>
    </div>
    <div class="cards">
      ${cards.join('\n')}
    </div>
    <div class="footer">
      <div class="footer-left"></div>
      <div class="page-label">${esc(pageLabel)}</div>
      <div class="footer-right"></div>
    </div>
  </div></div>`;
}



// generate a full document from multiple page date arrays
function generateDocumentFromPages(
  facilityName: string,
  logoBase64: string,
  bedNumber: string,
  pages: string[][],
  rounds: PatrolRoundRecord[]
): string {
  const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page { size: A4 landscape; margin: 8mm 6mm; orphans: 0; widows: 0; }
html, body {font-family: 'Microsoft JhengHei','微軟正黑體','PingFang TC', sans-serif; font-size: 8pt; color: #0f172a; background: #fff;}
@media screen {
  html { background: linear-gradient(135deg, #e5e9f0 0%, #f0f4f8 100%); }
  body { background: linear-gradient(135deg, #e5e9f0 0%, #f0f4f8 100%); }
  .pw { padding: 12mm; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
  .page { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08); border-radius: 2px; }
}
@media print {
  html, body { background: #fff; margin: 0; padding: 0; }
  .pw { display: block; page-break-inside: avoid; }
  .page { box-shadow: none; page-break-inside: avoid; }
  .page-item { page-break-after: always; }
  .page-item:last-child { page-break-after: auto; }
}
.pw { min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
.page { width: 287mm; background: #fff; padding: 8mm 6mm 6mm; display: flex; flex-direction: column; position: relative; }
.hdr { display: grid; grid-template-columns: 24mm 1fr 32mm; gap: 8mm; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 6mm; margin-bottom: 6mm; }
.hdr-left { display: flex; justify-content: center; align-items: center; }
.logo { width: 22mm; height: 22mm; object-fit: contain; border-radius: 2px; }
.logo-ph { width: 22mm; height: 22mm; border: 1.5px dashed #d1d5db; background: #f9fafb; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #9ca3af; }
.hdr-center { text-align: center; }
.facility { font-size: 15pt; font-weight: 800; color: #0b2440; letter-spacing: 0.5pt; }
.doc-title { font-size: 9pt; color: #059669; margin-top: 2pt; font-weight: 600; letter-spacing: 0.3pt; }
.hdr-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 3pt; }
.bed-label { font-size: 7pt; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5pt; }
.bed-number { font-size: 16pt; font-weight: 800; color: #dc2626; }
.cards { display: grid; grid-template-columns: repeat(8, 1fr); grid-auto-rows: 1fr; gap: 2.5mm; flex: 1; margin-top: 3mm; }
.card { border: 1px solid #e5e7eb; padding: 2mm; display: flex; flex-direction: column; background: #fafbfc; border-radius: 3px; transition: box-shadow 0.2s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
@media screen { .card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); } }
.card-hd { display: flex; justify-content: center; align-items: center; margin-bottom: 2mm; padding-bottom: 1.5mm; border-bottom: 1px solid #d1d5db; background: linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 2px 2px 0 0; }
.card-date { font-weight: 700; font-size: 10pt; color: #1f2937; letter-spacing: 0.2pt; }
.card-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.card-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; line-height: 1.2; }
.card-table th, .card-table td { border: 0.5pt solid #d1d5db; padding: 1mm 0.8mm; text-align: center; vertical-align: middle; }
.card-table thead th { background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%); font-weight: 700; color: #0369a1; font-size: 7pt; }
.card-table tbody tr.c-zebra { background-color: #f9fafb; }
.card-table tbody tr:hover { background-color: #f0f4f8; }
.card-table td { text-align: left; font-size: 7.5pt; }
.card-table td.c-slot { font-weight: 600; color: #1f2937; text-align: center; width: 14%; background: #f3f4f6; }
.card-table td.c-time { width: 28%; }
.card-table td.c-rec { width: 29%; }
.card-table td.c-sign { width: 29%; }
.card-table tbody td { height: 5.5mm; }
.footer { margin-top: 4mm; padding-top: 3mm; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #6b7280; }
.footer-left, .footer-right { text-align: right; }
.page-label { text-align: center; font-weight: 600; color: #374151; }`;

  const totalPages = pages.length;
  const fragments = pages.map((dates, idx) =>
    renderPageFragment(idx + 1, totalPages, {
      facilityName,
      logoBase64,
      bedNumber,
      dates,
      rounds,
    })
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1120, initial-scale=1">
<title>巡房記錄</title>
<style>${css}</style>
</head>
<body>
${fragments}
</body>
</html>`;
}

// export range: continuous dates, 16 cards per page (2 rows x 8 cols)
export const exportPatrolRoundsRangeHtml = async (options: {
  facilityName?: string;
  logoBase64?: string;
  bedNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  rounds: PatrolRoundRecord[];
}) => {
  const { facilityName, logoBase64, bedNumber, startDate, endDate, rounds } = options;
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Generate continuous date array from startDate to endDate
  const dates: string[] = [];
  let current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  if (dates.length === 0) return;

  // Split into pages: 16 cards per page (2 rows x 8 cols)
  const pages: string[][] = [];
  for (let i = 0; i < dates.length; i += 16) {
    pages.push(dates.slice(i, i + 16));
  }

  const html = generateDocumentFromPages(
    facilityName ?? '善頤(福群)護老院',
    logoBase64 ?? '',
    bedNumber,
    pages,
    rounds
  );
  printViaIframe(html);
};

// 隱藏 iframe 列印（與其他匯出器一致）
const printViaIframe = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1123px';
  iframe.style.height = '794px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = (): void => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };

  const doc = iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }

  doc.open(); doc.write(html); doc.close();

  const win = iframe.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(cleanup, 200));

  const triggerPrint = (): void => {
    window.setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  if (doc.readyState === 'complete') triggerPrint(); else win.addEventListener('load', triggerPrint);
  window.setTimeout(cleanup, 60_000);
};


