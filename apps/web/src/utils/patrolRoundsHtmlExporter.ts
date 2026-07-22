import { TIME_SLOTS } from './careRecordHelper';
import { getFacilitySettings } from './facilitySettings';

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
  logoBase64?: string; // kept for API compatibility; doc_html template has no logo
  bedNumber: string;
  startDate: string;  // 'YYYY-MM-DD'
  endDate: string;    // 'YYYY-MM-DD'
  rounds: PatrolRoundRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 16; // 4 columns × 4 rows (portrait A4)

// 以 doc_html/院友巡房記錄表.html 為模板，並固定:
//   --row-height: 3.14mm
//   --footer-bottom: 2mm
const PAGE_CSS = `
*,*::before,*::after { box-sizing: border-box; }

@page { size: A4; margin: 4mm 0.2in; }

html, body {
  font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
  margin: 0; padding: 0;
  background: #fff; color: #000; line-height: 1.1;
}

.page {
  width: 100%;
  height: 288mm;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  page-break-after: always;
}
.page:last-child { page-break-after: avoid; }

.header-section { width: 100%; height: 24mm; box-sizing: border-box; position: relative; }
.header-top {
  position: relative;
  width: 100%;
  text-align: center;
  padding-top: 2mm;
}
.title-section { display: inline-block; text-align: center; margin-bottom: 2px; }
.title-section h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
.title-section h2 { margin: 1px 0 0 0; font-size: 18px; font-weight: bold; display: inline-block; padding-bottom: 1px; }
.logo-section { position: absolute; right: 0; top: 0; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; }
.logo-section img { max-width: 100%; max-height: 100%; object-fit: contain; }

.info-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
.info-table td { border: none; padding: 2px 0; vertical-align: bottom; font-size: 16px; font-weight: bold; white-space: nowrap; }
.db-line-input { border: none; border-bottom: 1.5px solid black; background: transparent; font-family: inherit; font-size: 16px; font-weight: bold; outline: none; padding: 0 0 1px 5px; box-sizing: border-box; }

.grid-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 3mm;
  height: 250mm;
  box-sizing: border-box;
  margin-top: 2px;
}

.card { border: 1.5px solid black; box-sizing: border-box; display: flex; flex-direction: column; background: #fff; height: 100%; }
.card-empty { border: none; box-sizing: border-box; }
.card-title { text-align: center; font-size: 11px; font-weight: bold; background-color: #fff; border-bottom: 1.5px solid black; height: 3.33mm; line-height: 3.33mm; box-sizing: border-box; }
.card-table { width: 100%; border-collapse: collapse; table-layout: fixed; height: calc(100% - 3.33mm); border: none; }
.card-table th, .card-table td { border: 1px solid black; text-align: center; padding: 0; font-size: 10px; box-sizing: border-box; }
.card-table th { height: 2.88mm; font-size: 9px; font-weight: bold; background: #fff; border-bottom: 1.5px solid black; }
.card-table td { height: 2.9mm; }
.card-table th:first-child, .card-table td:first-child { border-left: none; }
.card-table th:last-child, .card-table td:last-child { border-right: none; }
.card-table tr:last-child td { border-bottom: none; }

.db-text-cell { width: 100%; height: 100%; border: none; background: transparent; font-family: inherit; font-size: 10px; text-align: center; outline: none; display: block; box-sizing: border-box; padding: 0; }
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
    // 時間欄只顯示實際巡房時間；若無記錄則留空
    const timeDisplay = r?.patrol_time ?? '';
    return `<tr>
      <td><input class="db-text-cell" value="${esc(timeDisplay)}" readonly></td>
      <td><input class="db-text-cell" value="${esc(r?.recorder ?? '')}" readonly></td>
      <td><input class="db-text-cell" value="${esc(r?.co_signer ?? '')}" readonly></td>
    </tr>`;
  }).join('');

  const dayNum = new Date(`${date}T00:00:00`).getDate();

  return `<div class="card">
    <div class="card-title">${dayNum} 日</div>
    <table class="card-table">
      <thead><tr><th style="width: 18%;">時間</th><th style="width: 41%;">簽署</th><th style="width: 41%;">加簽</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildEmptyCard(): string {
  return '<div class="card-empty"></div>';
}

function buildPage(
  dates: string[],
  facilityName: string,
  logoDataUri: string | null,
  bedNumber: string,
  monthStr: string,
  dataIndex: Map<string, Map<string, PatrolRoundRecord>>
): string {
  const cards = dates.map(d => buildCard(d, dataIndex.get(d) ?? new Map())).join('');
  const emptyCards = Array.from({ length: CARDS_PER_PAGE - dates.length }, buildEmptyCard).join('');

  const logoHtml = logoDataUri
    ? `<div class="logo-section"><img src="${esc(logoDataUri)}" alt="Logo"></div>`
    : '<div class="logo-section"></div>';

  return `<div class="page">
  <div class="header-section">
    <div class="header-top">
      <div class="title-section">
        <h1>${esc(facilityName)}</h1>
        <h2>院友巡房記錄表</h2>
      </div>
      ${logoHtml}
    </div>
    <table class="info-table">
      <colgroup>
        <col style="width: 60%;">
        <col style="width: 40%;">
      </colgroup>
      <tr>
        <td>房 / 床號：<input type="text" class="db-line-input" style="width: 280px; display: inline-block;" value="${esc(bedNumber)}" readonly></td>
        <td style="text-align: right; padding-right: 20px;">月份：<input type="text" class="db-line-input" style="width: 180px; display: inline-block;" value="${esc(monthStr)}" readonly></td>
      </tr>
    </table>
  </div>
  <div class="grid-container">${cards}${emptyCards}</div>
</div>`;
}

function buildDocument(pages: string[], facilityName: string): string {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>${esc(facilityName)} 巡房記錄表</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: '794px', height: '1123px', border: '0',
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
    bedNumber,
    startDate,
    endDate,
    rounds,
  } = options;

  const settings = await getFacilitySettings();
  const facilityName = options.facilityName ?? settings.facilityNameZh;
  const logoDataUri = options.logoBase64 ?? settings.logoDataUri;

  const allDates = dateRange(startDate, endDate);
  if (allDates.length === 0) return;

  // Build lookup: date → (scheduledTime → record)
  const dataIndex = new Map<string, Map<string, PatrolRoundRecord>>();
  for (const r of rounds) {
    if (!dataIndex.has(r.patrol_date)) dataIndex.set(r.patrol_date, new Map());
    dataIndex.get(r.patrol_date)!.set(r.scheduled_time, r);
  }

  const pages = chunk(allDates, CARDS_PER_PAGE);

  const firstDate = new Date(`${allDates[0]}T00:00:00`);
  const monthStr = `${firstDate.getFullYear()}年${firstDate.getMonth() + 1}月`;

  const pageHtmls = pages.map((dates) =>
    buildPage(dates, facilityName, logoDataUri, bedNumber, monthStr, dataIndex)
  );

  printViaIframe(buildDocument(pageHtmls, facilityName));
}

export async function exportPatrolRoundsHtml(
  bedNumber: string,
  startDate: string,
  endDate: string,
  rounds: PatrolRoundRecord[]
): Promise<void> {
  return exportPatrolRoundsRangeHtml({ bedNumber, startDate, endDate, rounds });
}
