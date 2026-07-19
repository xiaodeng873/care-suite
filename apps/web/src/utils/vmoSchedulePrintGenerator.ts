/**
 * VMO 排程 列印產生器
 * - 院友候診記錄表 (A4 landscape) – 整個排程一份，按床號排序
 * - 藥物處方單    (A4 portrait)  – 每位院友一份，預填基本資料
 *
 * 原 藥物處方單.html 根本問題：
 *   .a4-wrapper { height: 300mm } + .master-table { height: 100% }
 *   → table 被強制均分高度，所有行高嚴重變形
 *   修正：完全移除固定高度，讓各行由內容決定高度
 */

const FACILITY_ADDRESS = '九龍旺角博文街36號1字樓、2字樓及地下部分';
const IFRAME_ID = 'vmo-schedule-print-iframe';

import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (d: string | undefined | null): string => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('zh-TW'); }
  catch { return d; }
};

const birthYear = (d: string | undefined | null): string => {
  if (!d) return '';
  try { return String(new Date(d).getFullYear()); }
  catch { return ''; }
};

const printHtml = (html: string): void => {
  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface VmoPatientItem {
  patient: {
    床號?: string;
    中文姓氏?: string;
    中文名字?: string;
    英文姓氏?: string;
    英文名字?: string;
    英文姓名?: string;
    性別?: string;
    身份證號碼?: string;
    出生日期?: string;
    藥物敏感?: string[];
    不良藥物反應?: string[];
  };
  reasons?: { 原因名稱: string }[];
  症狀說明?: string;
  備註?: string;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. 院友候診記錄表（A4 landscape，按床號升序，最少 10 行）
// ══════════════════════════════════════════════════════════════════════════

export const generateVmoWaitingListHtml = (
  items: VmoPatientItem[],
  scheduleDate: string,
  stationLabel?: string,
  facilityName?: string,
): string => {
  const MIN_ROWS = 10;
  const sorted = [...items].sort((a, b) =>
    (a.patient?.床號 || '').localeCompare(b.patient?.床號 || '', 'zh-Hant', { numeric: true })
  );
  const total = Math.max(sorted.length, MIN_ROWS);

  const rows = Array.from({ length: total }, (_, i) => {
    const item = sorted[i];
    const p = item?.patient;
    const rowClass = i % 2 === 0 ? 'row-odd' : 'row-even';
    // H: 申請不適 = 症狀說明（自由文字，非 reasons array）
    const complaint = item?.症狀說明 || '';
    // I: 藥物敏感 = ✓ if 有敏感, NKDA if 無（只顯示符號，不列出藥名）
    const hasAllergy = !!(p?.藥物敏感?.length);
    const allergyText = hasAllergy ? '\u2713' : 'NKDA';
    // J: 年度體檢 = ✓ if 看診原因 包含 '年度體檢'
    const hasAnnual = item?.reasons?.some(r => r.原因名稱 === '年度體檢');
    // K: 約束物品同意書 = ✓ if 看診原因 包含 '約束物品同意書'
    const hasConsent = item?.reasons?.some(r => r.原因名稱 === '約束物品同意書');
    const eng = (p?.英文姓氏 || p?.英文名字)
      ? `${(p?.英文姓氏 || '').toUpperCase()}${p?.英文名字 ? ' ' + p.英文名字 : ''}`
      : (p?.英文姓名 || '');
    const c = (t: string) => `<td>${esc(t)}</td>`;
    const ck = (v: boolean) => `<td style="font-size:16px;font-weight:bold;">${v ? '\u2713' : ''}</td>`;
    const algCell = `<td>${esc(allergyText)}</td>`;
    return `<tr class="${rowClass}">
  <td><b>${i + 1}</b></td>
  ${c(p?.\u5e8a\u865f || '')}${c(p ? `${p.\u4e2d\u6587\u59d3\u6c0f || ''}${p.\u4e2d\u6587\u540d\u5b57 || ''}` : '')}${c(eng)}
  ${c(p?.\u8eab\u4efd\u8b49\u865f\u78bc || '')}${c(p?.\u6027\u5225 || '')}${c(p ? fmtDate(p.\u51fa\u751f\u65e5\u671f) : '')}
  ${c(complaint)}${algCell}${ck(!!hasAnnual)}${ck(!!hasConsent)}${c(item?.\u5099\u8a3b || '')}
</tr>`;
  }).join('\n');

  // 統計數字：為 info 區塊預填
  const annualCount = items.filter(i => i.reasons?.some(r => r.\u539f\u56e0\u540d\u7a31 === '\u5e74\u5ea6\u9ad4\u6aa2')).length;
  const consentCount = items.filter(i => i.reasons?.some(r => r.\u539f\u56e0\u540d\u7a31 === '\u7d04\u675f\u7269\u54c1\u540c\u610f\u66f8')).length;

  const title = stationLabel ? `院友候診記錄表（${esc(stationLabel)}）` : '院友候診記錄表';

  return `<!DOCTYPE html>
<html lang="zh-HK"><head><meta charset="UTF-8">
<meta name="viewport" content="width=1400">
<title>${title}</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
@media print { html,body { background:#fff; } .no-print { display:none !important; } .a4-wrapper { width:100%; } }
@media screen { body { background:#e0e0e0; } .a4-wrapper { margin:10mm auto; box-shadow:0 4px 16px rgba(0,0,0,.2); } }
body { font-family:"PMingLiU","MingLiU","新細明體",serif; margin:0; padding:0; color:#000; line-height:1.3; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.a4-wrapper { width:277mm; box-sizing:border-box; display:flex; flex-direction:column; background:#fff; }
.title-section { text-align:center; margin-bottom:8px; }
.title-section h1,.title-section h2 { margin:0; font-size:20px; font-weight:normal; }
.title-section h3 { margin:4px 0 0; font-size:20px; font-weight:bold; }
.date-line { text-align:center; font-size:14px; font-weight:bold; margin-bottom:6px; }
.info-layout { width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:8px; }
.info-layout td { border:none; padding:3px 0; vertical-align:bottom; white-space:nowrap; font-size:14px; font-weight:bold; }
.dbl { border:none; border-bottom:1px solid black; background:transparent; font-family:inherit; font-size:14px; outline:none; width:100%; display:block; box-sizing:border-box; padding:0 4px; }
.data-table { width:100%; border-collapse:collapse; table-layout:fixed; border:1.5px solid black; flex-grow:1; }
.data-table th,.data-table td { border:1px solid black; text-align:center; vertical-align:middle; padding:2px; font-size:14px; }
.data-table th { font-weight:bold; background:#fff; height:40px; }
.row-even td { background:#F2F2F2; }
.row-odd td { background:#fff; }
.data-table td { height:28px; word-break:normal; overflow-wrap:break-word; }
.footer-notes { margin-top:8px; font-size:13px; line-height:1.5; }
</style></head><body>
<div class="a4-wrapper">
  <div class="title-section">
    <h1>九龍樂善堂</h1>
    <h2>「院舍外展醫生到診服務」</h2>
    <h3>${title}</h3>
  </div>
  <div class="date-line">到診日期：${esc(fmtDate(scheduleDate))}</div>
  <table class="info-layout">
    <colgroup><col style="width:80px;"><col style="width:auto;"><col style="width:120px;"><col style="width:70px;"><col style="width:36px;"></colgroup>
    <tbody>
      <tr><td>醫生姓名：</td><td><input type="text" class="dbl"></td><td colspan="3"></td></tr>
      <tr><td>地點：</td><td><input type="text" class="dbl"></td>
          <td style="text-align:right;">看病人數：</td>
          <td><input type="text" class="dbl" value="${items.length}" style="text-align:center;"></td><td>(人)</td></tr>
      <tr><td colspan="2">院舎名稱：${esc(facilityName ?? DEFAULT_FACILITY_SETTINGS.facilityNameZh)}</td>
          <td style="text-align:right;">年度體檢：</td>
          <td><input type="text" class="dbl" value="${annualCount}" style="text-align:center;"></td><td>(份)</td></tr>
      <tr><td colspan="2">院舎地址：${esc(FACILITY_ADDRESS)}</td>
          <td style="text-align:right;">簽署約束同意書：</td>
          <td><input type="text" class="dbl" value="${consentCount}" style="text-align:center;"></td><td>(份)</td></tr>
    </tbody>
  </table>
  <table class="data-table">
    <colgroup>
      <col style="width:3%;"><col style="width:5%;"><col style="width:8%;"><col style="width:15%;">
      <col style="width:9%;"><col style="width:5%;"><col style="width:9%;"><col style="width:15%;">
      <col style="width:7%;"><col style="width:7%;"><col style="width:7%;"><col style="width:10%;">
    </colgroup>
    <thead><tr>
      <th></th><th>床號</th><th>姓名</th><th>英文姓名</th>
      <th>HKID No.</th><th>性別</th><th>出生日期</th><th>申請不適</th>
      <th>藥物敏感</th><th>年度體檢</th><th>約束物品<br>同意書</th><th>備註</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer-notes">
    <div>備註：請於醫生到診前 1 天將此記錄表，傳真 2361 1982 到外展醫療服務團隊。</div>
    <div>*院舍已確保以上報名候補院友/院友監護人同意接受樂善堂外展醫生診治及查閱相關醫療紀錄</div>
  </div>
</div></body></html>`;
};

// ══════════════════════════════════════════════════════════════════════════
// 2. 藥物處方單（重新製作，每位院友一份，預填基本資料）
// ══════════════════════════════════════════════════════════════════════════

const rxIn = (w: number): string =>
  `<input type="text" style="border:none;border-bottom:0.5px solid #000;background:transparent;font-family:inherit;font-size:12.5px;outline:none;text-align:center;width:${w}px;">`;

const rxRow = (l: string, r: string): string => `
<tr>
  <td style="text-align:center;"><input type="checkbox" class="dck"></td>
  <td colspan="5" class="BR"><div class="FC"><span>${l}</span><input type="text" class="DIL"></div></td>
  <td style="text-align:center;"><input type="checkbox" class="dck"></td>
  <td colspan="5"><div class="FC"><span>${r}</span><input type="text" class="DIL"></div></td>
</tr>`;

const singleRxHtml = (item: VmoPatientItem, isLast: boolean, facilityName?: string): string => {
  const p = item.patient;
  const name = `${p.中文姓氏 || ''}${p.中文名字 || ''}`;
  const allergy = p.藥物敏感?.length ? p.藥物敏感.join('、') : 'NKDA';
  const adr = p.不良藥物反應?.join('、') || '';
  const uid = esc(p.身份證號碼 || name).replace(/[^a-zA-Z0-9]/g, '_');
  const pb = isLast ? '' : ' style="page-break-after:always;"';

  return `<div class="RXF"${pb}>
<div class="FCODE">表格VMP-2(Ver:2022-11-22)</div>
<table class="MT">
  <colgroup>
    <col style="width:3.35%;"><col style="width:5.26%;"><col style="width:12.32%;">
    <col style="width:7.18%;"><col style="width:11%;"><col style="width:8.85%;">
    <col style="width:3.35%;"><col style="width:11.48%;"><col style="width:3.35%;">
    <col style="width:11%;"><col style="width:11%;"><col style="width:11.84%;">
  </colgroup>
  <tbody>
    <tr><td colspan="12" class="TM">九龍樂善堂 - 院舍外展醫生到診服務：藥物處方單</td></tr>
    <tr><td colspan="12" class="TS">94 ${esc(facilityName ?? DEFAULT_FACILITY_SETTINGS.facilityNameZh)} 23811038 / 23815181 九龍旺角博文街36號1字樓、 2字樓及地下部分</td></tr>
    <tr style="font-weight:bold;font-size:14px;">
      <td colspan="2">病人姓名：</td>
      <td colspan="2"><div class="FC"><input type="text" class="DIL" value="${esc(name)}"></div></td>
      <td style="text-align:right;">性別：</td>
      <td><div class="FC"><input type="text" class="DIL" value="${esc(p.性別 || '')}"></div></td>
      <td></td>
      <td style="text-align:right;">身份證號碼：</td>
      <td colspan="2"><div class="FC"><input type="text" class="DIL" value="${esc(p.身份證號碼 || '')}"></div></td>
      <td style="text-align:right;">出生年份：</td>
      <td><div class="FC"><input type="text" class="DIL" value="${esc(birthYear(p.出生日期))}"></div></td>
    </tr>
    <tr style="height:20px;">
      <td colspan="6" style="font-weight:bold;">藥物敏感(Allergy)：[必填]</td>
      <td colspan="6" rowspan="3" style="font-size:8px;line-height:1.25;padding-left:6px;white-space:normal;vertical-align:top;">
        • 此處方只供到診註冊醫生於院舍外展醫療服務下填寫/簽發。<br>
        • 任何以商品名標示的藥物，如醫生無特別指示，藥房將決定以同一成分不同品牌替代而不作另行通知。<br>
        • 如因藥物包裝或劑型限制而未能配發醫生指示之藥物總數量，藥房可自行決定並配發合理的藥物總數量。<br>
        • 如處方需要更改，藥劑師會與主診醫生確認變動後，註明於交給院舍的處方副本。<br>
        • 如醫生只寫藥名及用法，藥房會根據與醫生最新協議的藥物名冊內列出的藥物進行打單。<br>
        <span style="font-weight:bold;font-size:11px;font-family:sans-serif;">Fax: 2361-6933&nbsp;&nbsp;Whatsapp: 9730-0960&nbsp;&nbsp;Tel: 2361-1308</span>
      </td>
    </tr>
    <tr style="height:20px;"><td colspan="6"><div class="FC"><input type="text" class="DIL" style="border:none;" value="${esc(allergy)}"></div></td></tr>
    <tr style="height:20px;"><td colspan="6" style="font-weight:bold;">藥物不良反應(Adverse Drug Reaction / Alert)：[如有]</td></tr>
    <tr style="height:20px;">
      <td colspan="6" class="BBT"><div class="FC"><input type="text" class="DIL" style="border:none;" value="${esc(adr)}"></div></td>
      <td colspan="6" class="BBT"></td>
    </tr>
    <tr style="height:20px;"><td colspan="12" style="font-weight:bold;text-decoration:underline;">診斷 (Diagnoses)</td></tr>
    <tr style="height:30px;"><td colspan="12" class="BBT"><textarea class="DTA"></textarea></td></tr>
    <tr><td colspan="6" class="BR" style="font-weight:bold;text-decoration:underline;">Oral</td><td colspan="6"></td></tr>
    ${rxRow('Acetylcysteine 200mg/sac', `Lactéol fort (${rxIn(30)} cap)`)}
    ${rxRow('Ambroxol 30mg/tab', 'Lactobacillus Reuteri Tab')}
    ${rxRow(`Ampiclox 250mg+250mg (${rxIn(30)} cap)`, `Lasix tab (${rxIn(30)} mg)`)}
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Augmentin tab (${rxIn(30)} mg)</span><input type="text" class="DIL"></div></td>
      <td rowspan="2" class="BB BT BR" style="text-align:center;border-left:1px solid black;"><input type="checkbox" class="dck"></td>
      <td rowspan="2" class="BB BT BR" style="white-space:normal;font-size:11.5px;">Loperamide<br>2mg/tab</td>
      <td class="BT BR" style="text-align:center;"><input type="radio" class="DRD" name="lope_${uid}"></td>
      <td colspan="3" class="BT" style="white-space:normal;font-size:10.5px;"><div class="FC" style="white-space:normal;line-height:1.2;">PRN: 2 tabs initially, then 1 tab after each loose stool (Max${rxIn(30)}tabs/day),supply${rxIn(30)}days</div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Bromhexine 8mg/tab</span><input type="text" class="DIL"></div></td>
      <td class="BT BB BR" style="text-align:center;"><input type="radio" class="DRD" name="lope_${uid}"></td>
      <td colspan="3" class="BT BB"><div class="FC"><input type="text" class="DIL" style="border-bottom:none;"></div></td>
    </tr>
    ${rxRow('Buscopan 10mg/tab', 'Loratadine 10mg/tab')}
    ${rxRow(`CeleCOXIB cap (${rxIn(30)} mg)`, 'Lysozyme 60mg/tab')}
    ${rxRow('CetiriZINE 10mg/tab', 'Merision 6mg/tab')}
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Chlorpheniramine 4mg/tab</span><input type="text" class="DIL"></div></td>
      <td rowspan="2" class="BB BT BR" style="text-align:center;border-left:1px solid black;"><input type="checkbox" class="dck"></td>
      <td rowspan="2" class="BB BT BR" style="white-space:normal;font-size:11.5px;">Metronidazole<br>200mg/tab</td>
      <td class="BT BR" style="text-align:center;"><input type="radio" class="DRD" name="metro_${uid}"></td>
      <td colspan="3" class="BT" style="font-size:11px;"><div class="FC"><span style="text-decoration:underline;font-weight:bold;">LA:</span>&nbsp;to wound (${rxIn(30)}tabs) daily for ${rxIn(30)}days</div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Ciprofloxacin tab (${rxIn(30)} mg)</span><input type="text" class="DIL"></div></td>
      <td class="BT BB BR" style="text-align:center;"><input type="radio" class="DRD" name="metro_${uid}"></td>
      <td colspan="3" class="BT BB"><div class="FC"><span style="font-weight:bold;">PO:</span><input type="text" class="DIL" style="border-bottom:none;"></div></td>
    </tr>
    ${rxRow('Dequalinium 0.25mg/loz', 'Mylanta chewable tab')}
    ${rxRow('DexTROMETHORPHAN 15mg/tab', 'Pantoprazole 20mg/tab')}
    ${rxRow('DiphenhydrAMINE 25mg/cap', 'Paracetamol 500mg/tab')}
    ${rxRow(`Famotidine tab (${rxIn(30)} mg)`, `Pregabalin cap (${rxIn(30)} mg)`)}
    ${rxRow('GASteel 40mg/tab', 'Salbutamol 2mg/tab')}
    ${rxRow('GraVOL 50mg/tab', 'Senokot 7.5mg/tab')}
    ${rxRow(`Ibuprofen tab (${rxIn(30)} mg)`, `Theophylline SR (${rxIn(30)} mg)`)}
    <tr><td colspan="6" class="BR BT" style="font-weight:bold;text-decoration:underline;">Oral (Liquid)</td><td colspan="6" class="BT"></td></tr>
    ${rxRow('Benadryl Exp.', 'DM-Cocillana cpd. syrup')}
    ${rxRow('Cocillana cpd. syrup', 'Lactulose liquid')}
    ${rxRow('Dextromethorphan 15mg/5ml syrup', 'MES syrup')}
    <tr><td colspan="6" class="BR BT" style="font-weight:bold;text-decoration:underline;">External Preparations</td><td colspan="6" class="BT"></td></tr>
    <tr>
      <td colspan="6" class="BR" style="font-size:10px;color:#555;">(Qty can be multiples of 7.5g if pack size not specified)</td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Fucidin 2% cream [15g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Aciclovir 5% cream [5g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Gentamicin sulphate 0.3% cream</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}g)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Aqueous cream</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}g)</span></div></td>
      <td rowspan="2" class="BB BT BR" style="text-align:center;border-left:1px solid black;"><input type="checkbox" class="dck"></td>
      <td rowspan="2" class="BB BT BR">Hirudoid</td>
      <td class="BT BR" style="text-align:center;"><input type="radio" class="DRD" name="hiru_${uid}"></td>
      <td colspan="3" class="BT"><div class="FC"><span>Gel (250U/g) [20g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Bisacodyl 10mg supp PR</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}supp)</span></div></td>
      <td class="BT BB BR" style="text-align:center;"><input type="radio" class="DRD" name="hiru_${uid}"></td>
      <td colspan="3" class="BT BB"><div class="FC"><span>FORTE (400U/g) cream [15g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Chlorpheniramine 0.5%eye drops [10ml]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}Bot)</span></div></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5">Hydrocortisone 1%</td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Clotrimazole 1% cream [20g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
      <td></td>
      <td colspan="5"><div class="FC"><span>+ Miconazole 2% cream [15g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Diclofenac 1% gel [25g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Hypromellose 0.3% eye drops [10ml]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}Bot)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Eurax 10% cream</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}g)</span></div></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Mometasone 0.1% cream [15g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
    </tr>
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5" class="BR"><div class="FC"><span>Fluocinolone 0.025% cream [15g]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}tube)</span></div></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Olopatadine 0.1% eye drops [5ml]</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}Bot)</span></div></td>
    </tr>
    <tr>
      <td colspan="6" class="BR"></td>
      <td style="text-align:center;"><input type="checkbox" class="dck"></td>
      <td colspan="5"><div class="FC"><span>Zinc oxide cream</span><input type="text" class="DIL"><span style="white-space:nowrap;">(${rxIn(30)}g)</span></div></td>
    </tr>
    <tr>
      <td colspan="6" rowspan="3" class="BT BR" style="vertical-align:top;padding:2px;">
        <div style="font-weight:bold;text-decoration:underline;">其他藥物處方 (如有)/備註 [Other Prescriptions/Remarks]</div>
        <textarea class="DTA"></textarea>
      </td>
      <td colspan="6" class="BT" style="padding:4px 6px;">
        <div class="FC" style="font-weight:bold;font-size:14px;">醫生簽名：<input type="text" class="DIL" style="border-bottom:1px solid black;"></div>
      </td>
    </tr>
    <tr><td colspan="6" style="padding:4px 6px;">
      <div class="FC" style="font-weight:bold;font-size:14px;">醫生姓名/蓋印：<input type="text" class="DIL" style="border-bottom:1px solid black;"></div>
    </td></tr>
    <tr>
      <td colspan="6" style="padding:4px 6px;vertical-align:bottom;">
        <div class="FC" style="font-weight:bold;font-size:14px;margin-bottom:4px;">日期：<input type="text" class="DIL" style="border-bottom:1px solid black;"></div>
        <div style="font-size:8.5px;font-weight:bold;">[Address: Portion of 1/F, No.50 Junction Rd, Kowloon City, Kln.]</div>
      </td>
    </tr>
  </tbody>
</table>
</div>`;
};

export const generateVmoPrescriptionHtml = (items: VmoPatientItem[], facilityName?: string): string => {
  const forms = items.map((item, i) => singleRxHtml(item, i === items.length - 1, facilityName)).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-HK"><head><meta charset="UTF-8">
<meta name="viewport" content="width=1050">
<title>藥物處方單</title>
<style>
/* 修正核心：移除 height:300mm + table height:100%，讓內容決定高度 */
@page { size: A4 portrait; margin: 4mm 5mm; }
@media print { html,body { background:#fff; } .no-print { display:none !important; } .RXF { width:100%; } }
@media screen { body { background:#e0e0e0; } .RXF { margin:8mm auto; box-shadow:0 4px 16px rgba(0,0,0,.2); } }
body { font-family:"PMingLiU","MingLiU","新細明體",serif; margin:0; padding:0; background:#fff; color:#000; }
.RXF { width:200mm; border:2px solid black; box-sizing:border-box; padding:2px; background:#fff; }
.FCODE { text-align:right; font-size:11px; font-family:sans-serif; margin-bottom:2px; }
.MT { width:100%; border-collapse:collapse; table-layout:fixed; }
.MT td { padding:2px 3px; vertical-align:middle; font-size:12.5px; white-space:nowrap; border:none; }
.TM { font-size:18px; font-weight:bold; text-align:center; border-bottom:1px solid black; padding-bottom:4px; }
.TS { font-size:14px; font-weight:bold; padding:4px 0; border-bottom:2px solid black; }
.BR { border-right:1px solid black !important; }
.BB { border-bottom:1px solid black !important; }
.BT { border-top:1px solid black !important; }
.BBT { border-bottom:2px solid black !important; }
.DIL { border:none; border-bottom:0.5px solid #000; background:transparent; font-family:inherit; font-size:12.5px; outline:none; flex-grow:1; min-width:10px; }
.FC { display:flex; align-items:flex-end; width:100%; }
.dck { width:13px; height:13px; vertical-align:middle; cursor:pointer; margin:0; }
.DRD { width:13px; height:13px; vertical-align:middle; cursor:pointer; margin:0; }
.DTA { width:100%; height:100%; min-height:22px; border:none; background:transparent; font-family:inherit; font-size:12.5px; resize:none; outline:none; box-sizing:border-box; }
</style></head>
<body>${forms}</body></html>`;
};

// ══════════════════════════════════════════════════════════════════════════
// 3. 列印入口
// ══════════════════════════════════════════════════════════════════════════

export const printVmoWaitingList = async (
  items: VmoPatientItem[],
  scheduleDate: string,
  stationLabel?: string,
): Promise<void> => {
  const settings = await getFacilitySettings();
  printHtml(generateVmoWaitingListHtml(items, scheduleDate, stationLabel, settings.facilityNameZh));
};

export const printVmoPrescriptions = async (items: VmoPatientItem[]): Promise<void> => {
  if (items.length === 0) return;
  const settings = await getFacilitySettings();
  printHtml(generateVmoPrescriptionHtml(items, settings.facilityNameZh));
};
