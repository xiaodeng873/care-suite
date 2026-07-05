import fs from 'fs';

// Mock constants
const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00', '01:00', '03:00', '05:00'];

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function renderPageFragment(pageNum, totalPages, input) {
  const {
    facilityName = '善頤(福群)護老院',
    logoBase64,
    bedNumber,
    dates = [],
    rounds = [],
  } = input;

  const map = new Map();
  for (const r of rounds) {
    const dmap = map.get(r.patrol_date) ?? new Map();
    dmap.set(r.scheduled_time, r);
    map.set(r.patrol_date, dmap);
  }

  const logoHtml = logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo">` : '<div class="logo-ph">院舍<br/>Logo</div>';

  const cards = [];
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

function generateDocumentFromPages(facilityName, logoBase64, bedNumber, pages, rounds) {
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

// Generate sample patrol data for 3.5 pages (56 days)
const rounds = [];
for (let i = 0; i < 56; i++) {
  const d = i + 1;
  const mm = String(Math.floor(d / 30) + 7).padStart(2, '0');
  const dd = String((d % 30) || 30).padStart(2, '0');
  const date = `2026-${mm}-${dd}`;
  
  for (let tIdx = 0; tIdx < 6; tIdx++) {
    rounds.push({
      patrol_date: date,
      scheduled_time: TIME_SLOTS[tIdx],
      patrol_time: `${7 + tIdx * 2}:${15 + tIdx * 5}`,
      recorder: `張護士`,
      co_signer: `李主任`,
    });
  }
}

// Generate continuous dates: 2026-07-05 to 2026-08-29 (56 days = 3.5 pages)
const dates = [];
let current = new Date(2026, 6, 5); // July 5, 2026
const end = new Date(2026, 7, 29); // August 29, 2026
while (current <= end) {
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  dates.push(`${yyyy}-${mm}-${dd}`);
  current.setDate(current.getDate() + 1);
}

console.log(`Generated ${dates.length} continuous dates`);

// Split into pages: 16 cards per page
const pages = [];
for (let i = 0; i < dates.length; i += 16) {
  pages.push(dates.slice(i, i + 16));
}

console.log(`Split into ${pages.length} pages`);

const html = generateDocumentFromPages(
  '善頤(福群)護老院',
  '',
  'A-101',
  pages,
  rounds
);

fs.writeFileSync('/workspaces/care-suite/patrol_preview_redesigned.html', html);
console.log(`✓ Generated patrol_preview_redesigned.html (${pages.length} pages, ${dates.length} days, 8×2 grid per page)`);
