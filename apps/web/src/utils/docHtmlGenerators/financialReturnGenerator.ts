import type { DocumentGeneratorContext } from '../patientPrintBundleGenerator';

const DOC_CODE = 'A23B FK (11.2020)';

const escapeHtml = (text: string | number | undefined | null): string => {
  if (text == null) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

export async function generateFinancialReturnHtml(ctx: DocumentGeneratorContext): Promise<string> {
  let facilityName = ctx.facilityName || '';
  if (!facilityName) {
    const { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } = await import('../facilitySettings');
    const settings = await getFacilitySettings();
    facilityName = settings.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh || '';
  }

  const { patient, contentMode } = ctx;
  const isBlank = contentMode === 'blank';

  const residentName = isBlank
    ? ''
    : patient.中文姓名 || `${patient.中文姓氏 || ''}${patient.中文名字 || ''}`;
  const residentHkid = isBlank ? '' : patient.身份證號碼 || '';

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>領回託管財物證明書</title>
<style>
  @page { size: A4; margin: 5mm 0.25in; }
  * { box-sizing: border-box; }
  body {
    font-family: "DFKai-SB", "BiauKai", "標楷體", serif;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #000;
    line-height: 1.6;
  }
  .container {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 287mm;
    page-break-after: always;
  }
  .container:last-of-type { page-break-after: auto; }
  .title-section {
    text-align: center;
    margin-bottom: 30px;
  }
  .title-section h1 {
    margin: 0;
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 2px;
  }
  .title-section h2 {
    margin: 8px 0 0 0;
    font-size: 22px;
    font-weight: bold;
    display: inline-block;
    border-bottom: 1.5px solid black;
    padding-bottom: 2px;
  }
  .content {
    font-size: 16px;
    padding: 0 5mm;
  }
  .paragraph {
    margin-bottom: 18px;
    text-align: justify;
  }
  .db-line-input {
    display: inline-block;
    border: none;
    border-bottom: 1px solid black;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    color: #000;
    padding: 0 5px;
    margin: 0 3px;
    outline: none;
    text-align: center;
    vertical-align: bottom;
    line-height: 1.2;
  }
  .items-list {
    margin: 25px 0 25px 30px;
    padding: 0;
    list-style: none;
  }
  .items-list li {
    margin-bottom: 14px;
    display: flex;
    align-items: baseline;
  }
  .item-num {
    font-size: 16px;
    font-weight: bold;
    min-width: 30px;
  }
  .item-line {
    width: 25%;
    border-bottom: 1px solid black;
    height: 22px;
  }
  .sign-section {
    margin-top: 30px;
    padding: 0 5mm;
  }
  .sign-row {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    margin-bottom: 14px;
    font-size: 16px;
    font-weight: bold;
  }
  .sign-label {
    white-space: nowrap;
  }
  .sign-line {
    display: inline-block;
    width: 180px;
    border-bottom: 1px solid black;
    height: 22px;
    margin-left: 5px;
  }
  .footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
    position: relative;
    height: 30px;
  }
  .ref-text {
    position: absolute;
    left: 5mm;
    bottom: 0;
    font-size: 13px;
  }
  .page-num {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 24px;
    font-weight: bold;
    bottom: 0;
  }
  .doc-code {
    font-size: 11px;
    font-weight: bold;
    align-self: flex-end;
  }
</style>
</head>
<body>
<div class="container">
  <div class="title-section">
    <h1>${escapeHtml(facilityName)}</h1>
    <h2>領回託管財物證明書</h2>
  </div>

  <div class="content">
    <div class="paragraph">
      本人（姓名）<input type="text" class="db-line-input" style="width: 230px;" value="${escapeHtml(residentName)}" readonly>（身份證號碼 <input type="text" class="db-line-input" style="width: 200px;" value="${escapeHtml(residentHkid)}" readonly>）為*貴院院友／貴院院友（院友姓名）<input type="text" class="db-line-input" style="width: 200px;" value="${escapeHtml(residentName)}" readonly>的*監護人／保證人／家人／親屬，於（日期）<input type="text" class="db-line-input" style="width: 180px;" readonly>與貴院核對記錄後，現已領回及妥收*本人／該院友日前寄存於貴院之下列物品：
    </div>

    <ol class="items-list">
      <li><span class="item-num">1)</span><div class="item-line"></div></li>
      <li><span class="item-num">2)</span><div class="item-line"></div></li>
      <li><span class="item-num">3)</span><div class="item-line"></div></li>
      <li><span class="item-num">4)</span><div class="item-line"></div></li>
      <li><span class="item-num">5)</span><div class="item-line"></div></li>
      <li><span class="item-num">6)</span><div class="item-line"></div></li>
      <li><span class="item-num">7)</span><div class="item-line"></div></li>
      <li><span class="item-num">8)</span><div class="item-line"></div></li>
    </ol>
  </div>

  <div class="sign-section">
    <div class="sign-row">
      <span class="sign-label">*院友／監護人／保證人／家人／親屬簽署或指模：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">*院友／監護人／保證人／家人／親屬姓名：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">負責職員簽署：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">負責職員姓名及職位：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">見證職員簽署：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">見證職員姓名及職位：</span>
      <span class="sign-line"></span>
    </div>
    <div class="sign-row">
      <span class="sign-label">日 期：</span>
      <span class="sign-line"></span>
    </div>
  </div>

  <div class="footer">
    <div class="ref-text">(Ref. SWD 782/95 IV dd.08/04/2008)</div>
    <div class="page-num">20</div>
    <div class="doc-code">${DOC_CODE}</div>
  </div>
</div>
</body>
</html>`;
}
