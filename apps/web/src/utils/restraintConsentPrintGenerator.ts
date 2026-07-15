/**
 * 使用約束措施的評估及同意書 列印產生器
 * 合併 P1 + P2 為單一 HTML，透過隱藏 iframe 直達列印畫面
 *
 * 資料來源映射：
 *  院友姓名       → patient.中文姓氏 + 中文名字
 *  性別／年齡     → patient.性別 + 由出生日期計算年齡
 *  身份證號碼     → patient.身份證號碼
 *  房／床號       → patient.床號
 *  上次評估日期   → assessment.doctor_signature_date
 *  下次評估日期   → 留空（不 mapping，供手寫）
 *  (一) 住客情況  → assessment.risk_factors (boolean map)
 *  (二) 折衷辦法  → assessment.alternatives (boolean map); 評估日期/有效/無效/備註留空
 *  (三) 約束物品  → assessment.suggested_restraints (per-item object)
 *  (四)–(七)      → 全部留空，供列印後手寫簽名
 */

import type { Patient, PatientRestraintAssessment } from '../lib/database';

const FACILITY_NAME = '善頤(福群)護老院';

// ── 輔助函數 ──────────────────────────────────────────────────────────────────

/** HTML 屬性值安全跳脫 */
const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 輸入框 value 屬性（有值才加） */
const val = (v: string | undefined | null): string =>
  v ? ` value="${esc(v)}"` : '';

/** checkbox checked 屬性 */
const chk = (v: boolean): string => v ? ' checked' : '';

/** 讀取 risk_factors 中某鍵的布林值 */
const rf = (riskFactors: any, key: string): boolean => !!(riskFactors?.[key]);

/** 讀取 alternatives 中某鍵的布林值 */
const alt = (alternatives: any, key: string): boolean => !!(alternatives?.[key]);

/**
 * 將 modal 時段代碼轉換為小時數字字串
 * "7A"→"7", "12N"→"12", "1P"→"13", "12M"→"0", "3A"→"3"
 */
const timeToHour = (t: string | undefined | null): string => {
  if (!t) return '';
  if (t === '12N') return '12';
  if (t === '12M') return '0';
  const match = t.match(/^(\d+)([APN])$/i);
  if (!match) return t;
  const num = parseInt(match[1], 10);
  const period = match[2].toUpperCase();
  if (period === 'A') return String(num);
  if (period === 'P') return String(num === 12 ? 12 : num + 12);
  return t;
};

/** 計算年齡（歲） */
const calcAge = (birthDate: string | undefined): string => {
  if (!birthDate) return '';
  const age = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return `${age}歲`;
};

/** 格式化日期為 YYYY/MM/DD */
const fmtDate = (d: string | undefined | null): string => {
  if (!d) return '';
  return d.replace(/-/g, '/');
};

// ── 約束物品行 HTML ────────────────────────────────────────────────────────────

interface RestraintRowOptions {
  label: string;               // 顯示標籤（可含 HTML）
  config: any;                 // suggested_restraints 中的對應物件
  isTableBoard?: boolean;      // true = 枱板（只有一個條件選項）
  isOther?: boolean;           // true = 其他（第一欄顯示文字輸入）
}

const restraintRow = ({ label, config, isTableBoard = false, isOther = false }: RestraintRowOptions): string => {
  const checked = !!(config?.checked);
  const cond: string = config?.usageConditions ?? '';
  const dayTime: boolean = !!(config?.dayTime);
  const nightTime: boolean = !!(config?.nightTime);
  const allDay: boolean = !!(config?.allDay);
  const dayStart = timeToHour(config?.dayStartTime);
  const dayEnd = timeToHour(config?.dayEndTime);
  const nightStart = timeToHour(config?.nightStartTime);
  const nightEnd = timeToHour(config?.nightEndTime);
  const otherTime: string = config?.otherTime ?? '';
  const otherType: string = config?.otherRestraintType ?? '';

  // 第一欄：種類
  const colType = isOther
    ? `<div style="display:flex; flex-direction:column; row-gap:2px;"><div style="white-space:nowrap;"><input type="checkbox" class="db-checkbox"${chk(checked)}>${label}</div><input type="text" style="border:none; border-bottom:1px solid black; outline:none; width:100%; box-sizing:border-box; padding:0 2px; font-family:inherit; font-size:13px;"${val(otherType)}></div>`
    : `<input type="checkbox" class="db-checkbox"${chk(checked)}>${label}`;

  // 第二欄：使用情況
  const colCond = isTableBoard
    ? `<input type="checkbox" class="db-checkbox"${chk(checked && cond === '坐在椅上/輪椅上')}>坐在椅／輪椅上`
    : `<input type="checkbox" class="db-checkbox"${chk(checked && cond === '坐在椅上')}>坐在椅上&nbsp;&nbsp;<input type="checkbox" class="db-checkbox"${chk(checked && cond === '躺在床上')}>躺在床上<br><input type="checkbox" class="db-checkbox"${chk(checked && cond === '坐在椅上及躺在床上')}>坐在椅上及躺在床上`;

  // 第三欄：時段（晚上行改用 flex，讓「其他：」底線延伸至格末）
  const colTime =
    `<div style="white-space:nowrap;"><input type="checkbox" class="db-checkbox"${chk(checked && dayTime)}>日間 (由 <input type="text" style="width:28px; border:none; border-bottom:1px solid black; outline:none; text-align:center;"${val(dayTime ? dayStart : '')}> 時至 <input type="text" style="width:28px; border:none; border-bottom:1px solid black; outline:none; text-align:center;"${val(dayTime ? dayEnd : '')}> 時) &nbsp;<input type="checkbox" class="db-checkbox"${chk(checked && allDay)}>全日</div>` +
    `<div style="display:flex; align-items:baseline;"><span style="white-space:nowrap;"><input type="checkbox" class="db-checkbox"${chk(checked && nightTime)}>晚上 (由 <input type="text" style="width:28px; border:none; border-bottom:1px solid black; outline:none; text-align:center;"${val(nightTime ? nightStart : '')}> 時至 <input type="text" style="width:28px; border:none; border-bottom:1px solid black; outline:none; text-align:center;"${val(nightTime ? nightEnd : '')}> 時) &nbsp;<input type="checkbox" class="db-checkbox"${chk(checked && !!otherTime)}>其他：</span><input type="text" style="flex:1; min-width:0; border:none; border-bottom:1px solid black; outline:none; padding:0 2px;"${val(otherTime)}></div>`;

  return `<tr><td>${colType}</td><td>${colCond}</td><td>${colTime}</td></tr>`;
};

// ── 主 HTML 產生函數 ──────────────────────────────────────────────────────────

export const generateRestraintConsentPrintHtml = (
  assessment: PatientRestraintAssessment,
  patient: Patient
): string => {
  const r = assessment.risk_factors ?? {};
  const a = assessment.alternatives ?? {};
  const s = assessment.suggested_restraints ?? {};

  const patientName = `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}` || patient.中文姓名;
  const genderAge = `${patient.性別 ?? ''}／${calcAge(patient.出生日期)}`;
  const lastAssessDate = fmtDate(assessment.doctor_signature_date);
  const nextAssessDate = fmtDate(assessment.next_due_date);

  // 折衷辦法的 11 個選項（對應 P1 (二) 表格的 11 行）
  const alternativeOptions = [
    '延醫診治，找出影響情緒或神志昏亂的原因並處理',
    '與註冊醫生/註冊中醫/表列中醫商討療程或調校藥物',
    '尋求物理治療師/職業治療師/臨床心理學家/社工的介入',
    '改善家具：使用更合適的座椅、座墊或其他配件',
    '改善環境：令住客對環境感安全、舒適及熟悉',
    '提供消閒及分散注意力的活動',
    '多與住客傾談，建立融洽互信的關係',
    '安老院員工定期觀察及巡視',
    '調節日常護理程序以配合住客的特殊需要',
    '請家人/親友探望協助',
    '其他，請註明：',
  ];

  const altRows = alternativeOptions.map(opt => {
    const isChecked = alt(a, opt);
    const isOtherOpt = opt === '其他，請註明：';
    const optDisplay = isOtherOpt
      ? `<input type="checkbox" class="db-checkbox"${chk(isChecked)}>其他，請註明：<div style="flex-grow:1;"><input type="text" class="db-input" style="border-bottom:1px solid black;"${val(a['其他說明'] ?? '')}></div>`
      : `<input type="checkbox" class="db-checkbox"${chk(isChecked)}>${esc(opt)}`;
    const tdStyle = isOtherOpt ? ' style="display:flex; align-items:flex-end; border:none;"' : '';
    return `<tr>
      <td${tdStyle}>${optDisplay}</td>
      <td><input type="text" class="db-input" style="border:none;"></td>
      <td style="text-align:center;"><input type="checkbox" class="db-checkbox" style="margin:0;"></td>
      <td style="text-align:center;"><input type="checkbox" class="db-checkbox" style="margin:0;"${chk(isChecked)}></td>
      <td><input type="text" class="db-input" style="border:none;"></td>
    </tr>`;
  }).join('\n');

  // 約束物品建議（P1 後兩行＋P2 前五行）
  const restraintDefs = [
    { key: '約束衣',       label: '約束衣' },
    { key: '約束腰帶',     label: '約束腰帶' },
    { key: '手腕帶',       label: '手腕帶' },
    { key: '約束手套/連指手套', label: '約束手套／<br>&nbsp;&nbsp;&nbsp;連指手套' },
    { key: '防滑褲/防滑褲帶',   label: '防滑褲／<br>&nbsp;&nbsp;&nbsp;防滑褲帶' },
    { key: '枱板',         label: '枱板' },
    { key: '其他：',       label: '其他：' },
  ];

  // P1 最後兩行（約束衣、約束腰帶）
  const p1RestraintRows = restraintDefs.slice(0, 2).map(d =>
    restraintRow({ label: d.label, config: s[d.key] })
  ).join('\n');

  // P2 首五行（手腕帶 … 其他）
  const p2RestraintRows = restraintDefs.slice(2).map(d =>
    restraintRow({
      label: d.label,
      config: s[d.key],
      isTableBoard: d.key === '枱板',
      isOther: d.key === '其他：',
    })
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1120">
<title>使用約束措施的評估及同意書</title>
<style>
/* ── 列印設定 ── */
@page { size: A4; margin: 5mm 12mm 10mm 12mm; }

/* ── 螢幕預覽（含固定 width，防列印後 cascade 競爭） ── */
@media screen {
  body { background: #c8ccd0; }
  .pw { padding: 10mm; }
  .page { width: 186mm; box-shadow: 0 6px 24px rgba(0,0,0,.22); margin: 0 auto 12mm; }
  .page-1 { height: 277mm; overflow: hidden; }
}

/* ── 列印（width:100% 覆蓋螢幕固定值，自動貼合邊距） ── */
@media print {
  html, body { background: white; }
  .pw { display: block; margin: 0; padding: 0; }
  .page { width: 100%; height: auto; overflow: visible; box-shadow: none; margin: 0; }
  .page-1 { page-break-after: always; break-after: page; }
  .no-print { display: none !important; }
}

/* ── 共用（不設 width，避免 cascade 覆蓋 @media print 的 100%） ── */
body {
  font-family: "DFKai-SB","BiauKai","標楷體",serif;
  margin: 0; padding: 0; color: #000; line-height: 1.3;
}
.page {
  background: #fff;
  box-sizing: border-box;
}
.a4-container { width: 100%; box-sizing: border-box; position: relative; }

/* 頂部資訊 */
.header-top { display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; }
.inst-name-box { text-align:center; font-size:16px; font-weight:bold; margin-bottom:5px; }
.title-section { text-align:center; margin-bottom:10px; }
.title-section h1 { margin:0; font-size:20px; font-weight:bold; display:inline-block; padding-bottom:2px; }
.title-section p { margin:4px 0 0 0; font-size:15px; }

/* 隱形排版表格 */
.layout-table { width:100%; border-collapse:collapse; table-layout:fixed; }
.layout-table td { border:none; padding:2px 0; vertical-align:bottom; white-space:nowrap; font-size:14px; }
.layout-table td.allow-wrap { white-space: normal; }

/* 輸入框 */
.db-input {
  border:none; border-bottom:1px solid black; background:transparent;
  font-family:inherit; font-size:14px; outline:none;
  width:100%; display:block; box-sizing:border-box; padding:0 4px;
}
.db-checkbox { width:14px; height:14px; vertical-align:middle; margin-right:3px; cursor:pointer; }

/* 原則框 */
.principle-box { font-size:12.5px; line-height:1.4; text-align:justify; margin:8px 0; padding:0 2px; }

/* 雙線大框 */
.double-border-box { border:3px double black; width:100%; box-sizing:border-box; }
.double-border-box.bottom-margin { margin-bottom:8px; }
.section-block { border-bottom:3px double black; padding:4px 6px; }
.section-block:last-child { border-bottom:none; }
.section-title { font-weight:bold; font-size:15px; margin-bottom:4px; }
.section-title span.underline { text-decoration:underline; text-underline-offset:2px; }
.small-note { font-weight:normal; font-size:13px; }

/* (一) 風險因素 */
.risk-group { margin-bottom:6px; }
.risk-title { font-weight:bold; font-size:15px; margin-bottom:2px; display:flex; align-items:center; }

/* 數據表格 (二) (三) */
table.data-table {
  width:100%; border-collapse:collapse; table-layout:fixed;
  border:1.5px solid black; margin-top:5px;
}
table.data-table th, table.data-table td {
  border:1px solid black; padding:3px; font-size:13px; vertical-align:middle;
}
table.data-table th { font-weight:normal; text-align:center; }
.col-type { width:18%; } .col-cond { width:28%; } .col-time { width:54%; }

/* P2 主表格 */
table.main-table {
  width:100%; border-collapse:collapse; table-layout:fixed;
  border:2px solid black; margin-bottom:5px;
}
table.main-table th, table.main-table td {
  border:1px solid black; padding:2px 4px; vertical-align:middle; font-size:13px;
}

/* 頁碼 */
.footer-wrap { margin-top:8px; text-align:center; font-size:14px; font-weight:bold; }

/* P2 特有 */
.split-box { display:flex; width:100%; }
.split-left { width:50%; border-right:1px solid black; padding-right:6px; box-sizing:border-box; text-align:justify; }
.split-right { width:50%; padding-left:6px; box-sizing:border-box; }
.content-text { font-size:13px; line-height:1.4; text-align:justify; }
</style>
</head>
<body>
<div class="pw">

<!-- ═══════════════════════ 第 1 頁 ═══════════════════════ -->
<div class="page page-1">
<div class="a4-container">

  <!-- 頂部資訊 -->
  <div class="header-top">
    <div>《安老院實務守則》2024 年 6 月（修訂版）</div>
    <div style="text-decoration:underline;">附件 12.4</div>
  </div>

  <!-- 機構名稱 -->
  <div class="inst-name-box">
    <div style="display:inline-block; width:350px;">
      <input type="text" class="db-input" style="text-align:center;"${val(FACILITY_NAME)}>
    </div>（安老院名稱）
  </div>

  <!-- 標題 -->
  <div class="title-section">
    <h1>使用約束措施的評估及同意書</h1>
    <p>（須最少每 6 個月或因住客情況轉變評估一次）</p>
  </div>

  <!-- 個人資料 -->
  <table class="layout-table" style="margin-bottom:8px;">
    <colgroup>
      <col style="width:80px;"><col style="width:160px;">
      <col style="width:95px;"><col style="width:120px;">
      <col style="width:100px;"><col style="width:auto;">
    </colgroup>
    <tr>
      <td>住客姓名</td>
      <td><input type="text" class="db-input"${val(patientName)}></td>
      <td style="text-align:center;">性別／年齡</td>
      <td><input type="text" class="db-input"${val(genderAge)}></td>
      <td style="text-align:right; padding-right:5px;">身份證號碼</td>
      <td><input type="text" class="db-input"${val(esc(patient.身份證號碼))}></td>
    </tr>
    <tr>
      <td>房／床號</td>
      <td><input type="text" class="db-input"${val(esc(patient.床號))}></td>
      <td></td><td></td>
      <td style="text-align:right; padding-right:5px;">上次評估日期</td>
      <td><input type="text" class="db-input"${val(lastAssessDate)}></td>
    </tr>
  </table>

  <!-- 原則 -->
  <div class="principle-box">
    〔 原則：約束措施是指為限制住客活動以避免其對自己及／或其他人造成傷害而使用的方法，安老院應採取盡量避免使用約束的措施，只有在沒有其他限制程度較低的方法可供使用（即在嘗試其他折衷辦法失敗後）或在緊急情況下，當該住客及／或其他住客的安全、健康或福祉受威脅時，才可考慮使用約束措施。使用約束措施亦須先取得相關人士的同意。〕
  </div>

  <!-- 雙線大框 -->
  <div class="double-border-box bottom-margin">

    <!-- (一) 住客情況／風險因素 -->
    <div class="section-block">
      <div class="section-title">（一）<span class="underline">住客情況／風險因素</span> <span class="small-note">（請在合適的方格內加上「✓」號，可作多項選擇）</span></div>

      <!-- 精神及/或行為異常 -->
      <div class="risk-group">
        <div class="risk-title"><input type="checkbox" class="db-checkbox"${chk(rf(r,'精神及/或行為異常的情況'))}>精神及／或行為異常的情況</div>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:190px;"><col style="width:100px;"><col style="width:200px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'情緒問題/神志昏亂'))}>情緒問題／神志昏亂</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'遊走'))}>遊走</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'傷害自己的行為，請註明：'))}>傷害自己的行為，請註明：</td>
            <td><input type="text" class="db-input"${val(r['傷害自己的行為說明'] ?? '')}></td>
          </tr>
        </table>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:240px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'傷害/騷擾他人的行為，請註明：'))}>傷害／騷擾他人的行為，請註明：</td>
            <td><input type="text" class="db-input"${val(r['傷害/騷擾他人的行為說明'] ?? '')}></td>
          </tr>
        </table>
      </div>

      <!-- 未能保持正確坐姿 -->
      <div class="risk-group">
        <div class="risk-title"><input type="checkbox" class="db-checkbox"${chk(rf(r,'未能保持正確坐姿'))}>未能保持正確坐姿</div>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:180px;"><col style="width:80px;"><col style="width:100px;"><col style="width:130px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'背部及腰肢肌肉無力'))}>背部及腰肢肌肉無力</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'癱瘓'))}>癱瘓</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'關節退化'))}>關節退化</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'其他，請註明：'))}>其他，請註明：</td>
            <td><input type="text" class="db-input"${val(r['其他未能保持正確坐姿說明'] ?? '')}></td>
          </tr>
        </table>
      </div>

      <!-- 有跌倒風險 -->
      <div class="risk-group">
        <div class="risk-title"><input type="checkbox" class="db-checkbox"${chk(rf(r,'有跌倒風險'))}>有跌倒風險</div>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:220px;"><col style="width:250px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'步履失平衡'))}>步履失平衡</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'住院期間曾經跌倒'))}>住院期間曾經跌倒</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'視/聽力衰退'))}>視／聽力衰退</td>
          </tr>
        </table>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:220px;"><col style="width:220px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'受藥物影響'))}>受藥物影響</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'其他跌倒的風險，請註明：'))}>其他跌倒的風險，請註明：</td>
            <td><input type="text" class="db-input"${val(r['其他跌倒的風險說明'] ?? '')}></td>
          </tr>
        </table>
      </div>

      <!-- 曾除去醫療器材 -->
      <div class="risk-group">
        <div class="risk-title"><input type="checkbox" class="db-checkbox"${chk(rf(r,'曾除去治療用之醫療器材及／或維護身體的用品'))}>曾除去治療用之醫療器材及／或維護身體的用品</div>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:180px;"><col style="width:200px;"><col style="width:150px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'餵食管'))}>餵食管</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'氧氣喉管或面罩'))}>氧氣喉管或面罩</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'尿片或衣服'))}>尿片或衣服</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'其他造口護理裝置'))}>其他造口護理裝置</td>
          </tr>
        </table>
        <table class="layout-table" style="width:calc(100% - 20px); margin-left:20px;">
          <colgroup><col style="width:180px;"><col style="width:130px;"><col style="width:auto;"></colgroup>
          <tr>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'導尿管'))}>導尿管</td>
            <td><input type="checkbox" class="db-checkbox"${chk(rf(r,'其他醫療器材，請註明：'))}>其他，請註明：</td>
            <td><input type="text" class="db-input"${val(r['其他醫療器材說明'] ?? '')}></td>
          </tr>
        </table>
      </div>

      <!-- 其他（整體） -->
      <table class="layout-table" style="margin-bottom:0;">
        <colgroup><col style="width:135px;"><col style="width:auto;"></colgroup>
        <tr>
          <td style="font-weight:bold; font-size:15px;"><input type="checkbox" class="db-checkbox"${chk(rf(r,'其他，請註明：'))}>其他，請註明：</td>
          <td><input type="text" class="db-input"${val(r['其他風險因素說明'] ?? '')}></td>
        </tr>
      </table>
    </div><!-- end (一) -->

    <!-- (二) 折衷辦法 -->
    <div class="section-block">
      <div class="section-title">（二）<span class="underline">折衷辦法</span></div>
      <table class="data-table">
        <colgroup>
          <col style="width:58%;"><col style="width:12%;"><col style="width:7%;"><col style="width:7%;"><col style="width:auto;">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" style="text-align:left; padding-left:5px;">約束措施以外的折衷辦法<br>（請在合適的方格內加上「✓」號，可作多項選擇）</th>
            <th rowspan="2">評估日期</th>
            <th colspan="2">評估結果</th>
            <th rowspan="2">備註</th>
          </tr>
          <tr><th>有效</th><th>無效</th></tr>
        </thead>
        <tbody>
          ${altRows}
        </tbody>
      </table>
    </div><!-- end (二) -->

    <!-- (三) 約束物品建議（P1 前兩行） -->
    <div class="section-block" style="padding-bottom:0; border-bottom:none;">
      <div class="section-title">（三）<span class="underline">約束物品建議</span> <span class="small-note">（請在合適的方格內加上「✓」號，可作多項選擇）</span></div>
      <table class="data-table" style="border-bottom:none; border-left:none; border-right:none;">
        <colgroup>
          <col class="col-type"><col class="col-cond"><col class="col-time">
        </colgroup>
        <thead>
          <tr>
            <th style="font-weight:normal;">約束物品種類</th>
            <th style="font-weight:normal;">使用約束物品情況</th>
            <th style="font-weight:normal;">使用約束物品的時段</th>
          </tr>
        </thead>
        <tbody>
          ${p1RestraintRows}
        </tbody>
      </table>
    </div><!-- end (三) partial -->

  </div><!-- end 雙線大框 P1 -->

  <!-- 頁尾 -->
  <div class="footer-wrap">附件 12.4 - 1</div>

</div><!-- end a4-container P1 -->
</div><!-- end page-1 -->

<!-- ═══════════════════════ 第 2 頁 ═══════════════════════ -->
<div class="page page-2">
<div class="a4-container">

  <!-- (三) 約束物品建議（P2 續）-->
  <div class="double-border-box" style="margin-bottom:6px;">
    <table class="main-table" style="border:none; margin-bottom:0;">
      <colgroup>
        <col class="col-type"><col class="col-cond"><col class="col-time">
      </colgroup>
      <tbody>
        ${p2RestraintRows}
      </tbody>
    </table>
  </div>

  <!-- 下次評估日期 + 護士簽名（均分三欄：文字在前，底線在後延伸至欄末） -->
  <table class="layout-table" style="margin-bottom:6px;">
    <colgroup><col style="width:100px;"><col style="width:180px;"><col style="width:auto;"></colgroup>
    <tr>
      <td>下次評估日期</td>
      <td><input type="text" class="db-input"></td>
      <td></td>
    </tr>
  </table>
  <table style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:12px;">
    <colgroup><col style="width:33%;"><col style="width:34%;"><col style="width:33%;"></colgroup>
    <tr>
      <td style="padding:2px 0;">
        <div style="display:flex; align-items:flex-end; font-size:14px; font-family:inherit;">
          <span style="white-space:nowrap; flex-shrink:0;">護士／保健員姓名</span>
          <input type="text" style="flex:1; min-width:0; border:none; border-bottom:1px solid black; background:transparent; font-family:inherit; font-size:14px; outline:none; padding:0 2px;">
        </div>
      </td>
      <td style="padding:2px 6px;">
        <div style="display:flex; align-items:flex-end; font-size:14px; font-family:inherit;">
          <span style="white-space:nowrap; flex-shrink:0;">護士／保健員簽署</span>
          <input type="text" style="flex:1; min-width:0; border:none; border-bottom:1px solid black; background:transparent; font-family:inherit; font-size:14px; outline:none; padding:0 2px;">
        </div>
      </td>
      <td style="padding:2px 6px;">
        <div style="display:flex; align-items:flex-end; font-size:14px; font-family:inherit;">
          <span style="white-space:nowrap; flex-shrink:0;">日期</span>
          <input type="text" style="flex:1; min-width:0; border:none; border-bottom:1px solid black; background:transparent; font-family:inherit; font-size:14px; outline:none; padding:0 2px;">
        </div>
      </td>
    </tr>
  </table>

  <!-- (四)–(七) 雙線大框 -->
  <div class="double-border-box bottom-margin">

    <!-- (四) 醫生意見 -->
    <div class="section-block">
      <div class="section-title">（四）註冊醫生意見 <span class="small-note">(請在合適的方格內加上「✓」號)</span></div>
      <div class="content-text" style="margin-bottom:5px;">
        <div style="margin-bottom:2px;">&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" class="db-checkbox"> 同意上述住客按第（三）部分的建議使用約束物品</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" class="db-checkbox"> 不同意上述住客使用約束物品</div>
      </div>
      <table class="layout-table">
        <colgroup><col style="width:50px;"><col style="width:auto;"></colgroup>
        <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;備註：</td><td><input type="text" class="db-input"></td></tr>
      </table>
      <table class="layout-table" style="margin-top:5px;">
        <colgroup>
          <col style="width:70px;"><col style="width:230px;">
          <col style="width:80px;"><col style="width:230px;">
          <col style="width:45px;"><col style="width:auto;">
        </colgroup>
        <tr>
          <td>醫生姓名</td><td><input type="text" class="db-input"></td>
          <td style="text-align:right; padding-right:8px;">醫生簽署</td><td><input type="text" class="db-input"></td>
          <td style="text-align:right; padding-right:8px;">日期</td><td><input type="text" class="db-input"></td>
        </tr>
      </table>
    </div>

    <!-- (五) 住客意願 -->
    <div class="section-block">
      <div class="section-title">（五）住客意願 <span class="small-note">(請在合適的方格內加上「✓」號，並在*處刪去不適用者)</span></div>
      <div class="split-box">
        <div class="split-left">
          <table class="layout-table">
            <colgroup><col style="width:35px;"><col style="width:auto;"><col style="width:100px;"></colgroup>
            <tr><td>本人</td><td><input type="text" class="db-input"${val(patientName)}></td><td>(住客姓名) 經</td></tr>
          </table>
          <div class="content-text" style="margin-bottom:5px;">
            *安老院員工／註冊醫生向本人清楚解釋需要使用約束物品的原因、使用約束物品的種類和時段、使用約束物品可能帶來的短期及長遠影響 (見下文「特別注意事項」)、以及院舍職員曾嘗試採用的折衷辦法及其成效後，本人現 <input type="checkbox" class="db-checkbox">同意／<input type="checkbox" class="db-checkbox">不同意 按第(三)部分的建議使用保護性約束物品。
          </div>
          <table class="layout-table">
            <colgroup><col style="width:70px;"><col style="width:110px;"><col style="width:50px;"><col style="width:auto;"></colgroup>
            <tr>
              <td>住客簽署</td><td><input type="text" class="db-input"></td>
              <td style="text-align:right; padding-right:8px;">日期</td><td><input type="text" class="db-input"></td>
            </tr>
          </table>
        </div>
        <div class="split-right">
          <div style="font-weight:bold; margin-bottom:2px;">若住客未能明白使用約束措施事宜則只填寫此部分</div>
          <table class="layout-table">
            <colgroup><col style="width:50px;"><col style="width:auto;"><col style="width:100px;"></colgroup>
            <tr><td>本人乃</td><td><input type="text" class="db-input"${val(patientName)}></td><td>(住客姓名) 的</td></tr>
          </table>
          <div class="content-text" style="margin-bottom:5px;">
            *監護人／保證人／家人／親屬／註冊醫生，現見證該住客因未能明白使用約束措施事宜而不能簽署同意書。
          </div>
          <table class="layout-table" style="margin-bottom:2px;">
            <colgroup><col style="width:80px;"><col style="width:auto;"><col style="width:45px;"><col style="width:auto;"></colgroup>
            <tr>
              <td>見證人姓名</td><td><input type="text" class="db-input"></td>
              <td style="text-align:right; padding-right:8px;">關係</td><td><input type="text" class="db-input"></td>
            </tr>
          </table>
          <table class="layout-table">
            <colgroup><col style="width:80px;"><col style="width:auto;"><col style="width:45px;"><col style="width:auto;"></colgroup>
            <tr>
              <td>見證人簽署</td><td><input type="text" class="db-input"></td>
              <td style="text-align:right; padding-right:8px;">日期</td><td><input type="text" class="db-input"></td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- (六) 監護人意願 -->
    <div class="section-block">
      <div class="section-title">（六）監護人／保證人／家人／親屬意願 <span class="small-note">(請在合適的方格內加上「✓」號，並在*處刪去不適用者)</span></div>
      <table class="layout-table" style="margin-bottom:2px;">
        <colgroup><col style="width:20px;"><col style="width:28px;"><col style="width:110px;"><col style="width:18px;"><col style="width:90px;"><col style="width:auto;"></colgroup>
        <tr>
          <td><input type="checkbox" class="db-checkbox"></td>
          <td>本人</td><td><input type="text" class="db-input"></td>
          <td style="text-align:center; padding:0 3px;">乃</td><td><input type="text" class="db-input"${val(patientName)}></td>
          <td class="allow-wrap">(住客姓名) 的 *監護人／保證人／家人／親屬，經</td>
        </tr>
      </table>
      <div class="content-text" style="margin-bottom:5px;">
        *安老院員工／註冊醫生向本人清楚解釋上述住客需要使用約束物品的原因、使用約束物品的種類、使用約束物品的時段、使用約束物品可能帶來的短期及長遠影響 (見第 (八) 部分「特別注意事項」)、以及院舍職員曾嘗試採用的折衷辦法及其成效後，本人現 <input type="checkbox" class="db-checkbox">同意／<input type="checkbox" class="db-checkbox">不同意 上述住客按第 (三) 部分的建議使用保護性約束物品。
      </div>
      <table class="layout-table" style="margin-bottom:4px;">
        <colgroup><col style="width:40px;"><col style="width:auto;"><col style="width:90px;"><col style="width:auto;"><col style="width:45px;"><col style="width:auto;"></colgroup>
        <tr>
          <td>簽署</td><td><input type="text" class="db-input"></td>
          <td style="text-align:right; padding-right:8px;">與住客關係</td><td><input type="text" class="db-input"></td>
          <td style="text-align:right; padding-right:8px;">日期</td><td><input type="text" class="db-input"></td>
        </tr>
      </table>
      <div style="font-size:13px;">
        <input type="checkbox" class="db-checkbox"> 上述住客沒有 *監護人／保證人／家人／親屬。
      </div>
    </div>

    <!-- (七) 主管確認 -->
    <div class="section-block">
      <div class="section-title">（七）主管確認</div>
      <table class="layout-table">
        <colgroup><col style="width:40px;"><col style="width:150px;"><col style="width:175px;"><col style="width:70px;"><col style="width:160px;"><col style="width:45px;"><col style="width:auto;"></colgroup>
        <tr>
          <td>本人</td><td><input type="text" class="db-input"></td>
          <td>確認上述資料均屬真確。</td>
          <td style="text-align:right; padding-right:8px;">主管簽署</td><td><input type="text" class="db-input"></td>
          <td style="text-align:right; padding-right:8px;">日期</td><td><input type="text" class="db-input"></td>
        </tr>
      </table>
    </div>

  </div><!-- end (四)–(七) 雙線框 -->

  <!-- (八) 特別注意事項 -->
  <div class="double-border-box" style="padding:4px 6px; margin-bottom:0;">
    <div class="section-title">（八）特別注意事項</div>
    <div style="font-size:13px; line-height:1.25;">
      <div style="margin-left:15px; text-indent:-15px;">1. 須最少每 2 小時檢查一次住客使用約束措施的情況。</div>
      <div style="margin-left:15px; text-indent:-15px;">2. 約束物品會使住客長期處於坐或臥的狀態，減少了住客的活動和關節的活動能力，令肌肉萎縮。</div>
      <div style="margin-left:15px; text-indent:-15px;">3. 骨骼可能會因為減少了負重而變得疏鬆和脆弱。</div>
      <div style="margin-left:15px; text-indent:-15px;">4. 由於血液循環系統的功能下降，下肢可能會出現水腫。</div>
      <div style="margin-left:15px; text-indent:-15px;">5. 受約束的住客可能會出現憤怒、羞辱、恐懼、無助、不安等負面情緒。</div>
      <div style="margin-left:15px; text-indent:-15px;">6. 長期約束會令住客變得脾氣暴躁、焦慮，甚至有抑鬱的傾向。</div>
      <div style="margin-left:15px; text-indent:-15px;">7. 受約束的住客身體會轉弱和精神變差，更容易引致跌倒及受傷。</div>
      <div style="margin-left:15px; text-indent:-15px;">8. 有些住客十分抗拒被約束，並會嘗試掙脫約束物品，因此可能會造成自身傷害或跌倒。</div>
      <div style="margin-left:15px; text-indent:-15px;">9. 由於活動能力受到限制，住客與人傾談和相處的機會亦逐漸減少，影響了他們的社交健康。</div>
    </div>
  </div>

  <!-- 頁尾 -->
  <div class="footer-wrap">附件 12.4 - 2</div>

</div><!-- end a4-container P2 -->
</div><!-- end page-2 -->

</div><!-- end pw -->

<script>
/* 自動微調：偵測 P1 是否超出單頁可列印高度，若超出則按比例縮放（置中，避免靠左），
   使其剛好容納於一張 A4 內，不會溢出到第 2 頁。 */
(function () {
  function fitAll() {
    var pages = document.querySelectorAll('.page-1');
    if (!pages.length) return;
    // 單張 A4 可列印內容高度 = 297mm - 上邊距 5mm - 下邊距 10mm = 282mm
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:282mm;';
    document.body.appendChild(probe);
    var avail = probe.offsetHeight;
    probe.remove();
    pages.forEach(function (page) {
      var inner = page.querySelector('.a4-container');
      if (!inner) return;
      // 先重置，確保重複呼叫時量到的是原始高度
      inner.style.transform = '';
      inner.style.transformOrigin = '';
      page.style.height = '';
      page.style.overflow = '';
      var h = inner.getBoundingClientRect().height;
      if (h > avail) {
        var k = avail / h;
        inner.style.transformOrigin = 'top center';
        inner.style.transform = 'scale(' + k + ')';
        page.style.height = (h * k) + 'px';
        page.style.overflow = 'hidden';
      }
    });
  }
  // 供父視窗在列印前再呼叫一次，確保字型載入後量測正確
  window.__fitRestraintP1 = fitAll;
  var run = function () {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fitAll);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
</script>
</body>
</html>`;
};

// ── 列印入口（隱藏 iframe，一鍵直達列印畫面）─────────────────────────────────

const IFRAME_ID = 'restraint-consent-print-iframe';

export const printRestraintConsentForm = (
  assessment: PatientRestraintAssessment,
  patient: Patient
): void => {
  const html = generateRestraintConsentPrintHtml(assessment, patient);

  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    try { (iframe.contentWindow as any)?.__fitRestraintP1?.(); } catch { /* noop */ }
    iframe.contentWindow?.print();
  }, 400);
};

/**
 * 列印多位院友的同意書（一次 iframe，各自換頁）
 */
export const printRestraintConsentForms = (
  items: Array<{ assessment: PatientRestraintAssessment; patient: Patient }>
): void => {
  if (items.length === 0) return;

  if (items.length === 1) {
    printRestraintConsentForm(items[0].assessment, items[0].patient);
    return;
  }

  // 合併多份：取第一份完整 HTML，後續各份取 body 內容插入
  let combined = generateRestraintConsentPrintHtml(items[0].assessment, items[0].patient);

  // 在 </style> 前注入換頁 CSS（若未含）
  if (!combined.includes('page-1')) {
    combined = combined.replace('</style>', '.page-1 { page-break-after: always; }\n</style>');
  }

  for (let i = 1; i < items.length; i++) {
    const extra = generateRestraintConsentPrintHtml(items[i].assessment, items[i].patient);
    const bodyMatch = extra.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      combined = combined.replace('</body>', bodyMatch[1] + '\n</body>');
    }
  }

  const old = document.getElementById(IFRAME_ID);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(combined);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    try { (iframe.contentWindow as any)?.__fitRestraintP1?.(); } catch { /* noop */ }
    iframe.contentWindow?.print();
  }, 400);
};
