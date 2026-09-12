/**
 * 院舍活動報表 列印表格 (iframe HTML 版)
 * 複刻 upload/活動記錄.pdf（附件3.2 A19C FK (11.2020)）嘅版面：
 * 附件 3.2 框 + 院舍名 + 「每月院舍活動資料」標題、年月份附註行、
 * 項目/日期/時間/主辦機構/團體/活動名稱/地點/有否義工協助/預計參加人數 表格、
 * 底部舍監/院長簽署欄同文件編號。
 *
 * 每月一份表格，超頁時標題/表頭/頁尾每頁重複；項目編號按年份連續（同手寫原表做法）。
 */
import type { HomeActivity } from '../lib/homeActivities';

const ROWS_PER_PAGE = 11;
const DOC_CODE = 'A19C FK (11.2020)(附件 3.2)';
const LOGO_SRC = '/sc-logo.png';

const escapeHtml = (text: string): string => {
  if (!text) return '';
  const map: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');
const fmtTimeRange = (r: HomeActivity) => {
  if (r.start_time && r.end_time) return `${fmtTime(r.start_time)}-${fmtTime(r.end_time)}`;
  return fmtTime(r.start_time) || fmtTime(r.end_time) || '';
};
const fmtDateDMY = (dateStr: string) => {
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月`;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

interface MonthPage {
  label: string;
  rows: { itemNo: number; record: HomeActivity }[];
}

const NOTE_TEXT = '（請於每月25號前傳真下個月資料到總部，如有項目更改，須於3日前通知總部）';

const pageBlock = (page: MonthPage, facilityName: string): string => {
  const dataRows = page.rows
    .map(
      ({ itemNo, record }) => `<tr style="height: 28px;">
    <td style="font-size: 13px;">${itemNo}</td>
    <td style="font-size: 12px;">${fmtDateDMY(record.activity_date)}</td>
    <td style="font-size: 12px;">${escapeHtml(fmtTimeRange(record))}</td>
    <td style="font-size: 12px; text-align: left; padding: 0 4px;">${escapeHtml(record.organizer || '')}</td>
    <td style="font-size: 12px; text-align: left; padding: 0 4px;">${escapeHtml(record.activity_name)}</td>
    <td style="font-size: 12px; text-align: left; padding: 0 4px;">${escapeHtml(record.location || '')}</td>
    <td style="font-size: 12px;">${record.volunteer_count || ''}</td>
    <td style="font-size: 12px;">${record.participant_count || ''}</td>
  </tr>`
    )
    .join('');
  const emptyRows = Array(Math.max(ROWS_PER_PAGE - page.rows.length, 0))
    .fill(`<tr style="height: 28px;">${'<td></td>'.repeat(8)}</tr>`)
    .join('');

  return `
<div class="container">
  <div class="form-head">
    <div class="attach-box">附件 3.2</div>
    <div class="header-center">
      <h1>${escapeHtml(facilityName)}</h1>
      <h2>每月院舍活動資料</h2>
    </div>
    <div class="head-right"><img src="${LOGO_SRC}" alt="院舍標誌"></div>
  </div>
  <div class="month-note">${page.label}${NOTE_TEXT}</div>
  <table>
    <colgroup>
      <col style="width: 46px;">
      <col style="width: 84px;">
      <col style="width: 108px;">
      <col style="width: auto;">
      <col style="width: 21%;">
      <col style="width: 17%;">
      <col style="width: 52px;">
      <col style="width: 58px;">
    </colgroup>
    <thead>
      <tr>
        <th>項目</th>
        <th>日期</th>
        <th>時間</th>
        <th>主辦機構/團體</th>
        <th>活動名稱</th>
        <th>地點<br>（如外出，請列明）</th>
        <th>有否義<br>工協助</th>
        <th>預計參<br>加人數</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows}
      ${emptyRows}
    </tbody>
  </table>

  <div class="sign-row">
    <div class="sign-left">舍監/院長簽署：＿＿＿＿＿＿＿＿＿＿</div>
    <div class="sign-date">日期：＿＿＿＿＿＿＿＿</div>
  </div>

  <div class="footer">
    <div class="doc-code">${DOC_CODE}</div>
  </div>
</div>`;
};

export const generateHomeActivitiesPages = (
  records: HomeActivity[],
  facilityName: string,
  currentYm?: string,
  byMonth = true
): string => {
  const sorted = [...records].sort((a, b) =>
    a.activity_date === b.activity_date
      ? (a.start_time || '').localeCompare(b.start_time || '')
      : a.activity_date.localeCompare(b.activity_date)
  );

  const pages: MonthPage[] = [];
  if (sorted.length === 0) {
    // 冇任何記錄：照出空白表格
    const ym = currentYm || new Date().toISOString().slice(0, 7);
    pages.push({ label: monthLabel(ym), rows: [] });
  } else {
    // 項目編號按年份連續（同手寫原表）
    const yearCounter = new Map<string, number>();
    const numbered = sorted.map(record => {
      const year = record.activity_date.slice(0, 4);
      const itemNo = (yearCounter.get(year) || 0) + 1;
      yearCounter.set(year, itemNo);
      return { itemNo, record };
    });
    if (byMonth) {
      const byMonthMap = new Map<string, typeof numbered>();
      for (const row of numbered) {
        const ym = row.record.activity_date.slice(0, 7);
        if (!byMonthMap.has(ym)) byMonthMap.set(ym, []);
        byMonthMap.get(ym)!.push(row);
      }
      for (const ym of [...byMonthMap.keys()].sort()) {
        chunk(byMonthMap.get(ym)!, ROWS_PER_PAGE).forEach(rows =>
          pages.push({ label: monthLabel(ym), rows })
        );
      }
    } else {
      // 唔按月分頁：整段範圍連續列表，標題列顯示日期範圍
      const first = sorted[0].activity_date;
      const last = sorted[sorted.length - 1].activity_date;
      const rangeLabel = first === last
        ? `${fmtDateDMY(first)}`
        : `${fmtDateDMY(first)} 至 ${fmtDateDMY(last)}`;
      chunk(numbered, ROWS_PER_PAGE).forEach(rows =>
        pages.push({ label: rangeLabel, rows })
      );
    }
  }

  return pages.map(p => pageBlock(p, facilityName)).join('');
};

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body { font-family: "DFKai-SB", "BiauKai", "標楷體", serif; margin: 0; padding: 0; background-color: #fff; color: #000; line-height: 1.1; }
  .no-print { text-align: center; margin: 10px; }
  .no-print button { padding: 8px 20px; font-size: 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  /* 比例 140%：容器預先縮細（zoom 會連尺寸一齊放大），
     放大後啱好填滿 A4 橫向可印範圍（闊 284.3mm / 高 200mm），底部文件編號唔會超頁 */
  .container { width: 203mm; min-height: 141mm; zoom: 1.4; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; }
  .container:last-of-type { page-break-after: auto; }
  .form-head { display: flex; align-items: flex-start; justify-content: space-between; }
  .attach-box { border: 1.5px solid black; padding: 6px 10px; font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .header-center { text-align: center; flex: 1; }
  .header-center h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; }
  .header-center h2 { margin: 2px 0 0 0; font-size: 20px; font-weight: bold; display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; }
  .head-right { width: 130px; text-align: right; }
  .head-right img { width: 130px; }
  .month-note { font-size: 13px; font-weight: bold; margin: 4px 0 2px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid black; }
  th, td { border: 1px solid black; text-align: center; vertical-align: middle; padding: 0; overflow: hidden; }
  th { font-size: 12px; font-weight: bold; padding: 2px 0; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 14px; font-size: 14px; font-weight: bold; width: 75%; }
  .footer { margin-top: auto; display: flex; justify-content: flex-end; position: relative; height: 30px; font-weight: bold; }
  .doc-code { font-size: 11px; font-weight: bold; align-self: flex-end; }
  @media print {
    .no-print { display: none !important; }
  }
`;

export const generateHomeActivitiesPrintFormHtml = (
  records: HomeActivity[],
  facilityName: string,
  currentYm?: string,
  byMonth = true
): string => {
  const pagesHtml = generateHomeActivitiesPages(records, facilityName, currentYm, byMonth);

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>每月院舍活動資料</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">列印</button></div>
${pagesHtml}
</body>
</html>`;
};

export const printHomeActivitiesForm = (records: HomeActivity[], facilityName: string): void => {
  const html = generateHomeActivitiesPrintFormHtml(records, facilityName);
  const old = document.getElementById('home-activities-printform-iframe');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'home-activities-printform-iframe';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }
};
