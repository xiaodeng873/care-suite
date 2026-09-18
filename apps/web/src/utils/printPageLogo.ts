/**
 * 列印文件每頁右上角院舍 logo 共用工具。
 * logo 來源同 loading/活動報表一致：facility_settings.logoDataUri，後備用 /sc-logo.png
 *
 * 統一做法：logo 喺所有文件都落喺「以紙張邊緣計」嘅同一絕對位置（右上角，距邊
 * LOGO_EDGE_MM，見 printUtils）。由於 Chrome 列印定位（fixed / absolute）只能以
 * @page 邊界內嘅內容原點起計（負值會令多頁文件出現幽靈副本或竄頁），
 * 所以做法係將 @page 上/右 margin **一律歸零**（無論本來幾大），再以
 * body padding 補回差額——內容版面唔變，而所有文件嘅 logo 統一用
 * `top/right = LOGO_EDGE_MM` 嘅非負座標，喺合併列印時全部精確重疊喺紙上同一位置
 * （合併 iframe 內每份文件各有一個 fixed logo，位置一致 = 視覺上只有一個；
 * margin 唔規範化嘅話，各文件 logo 會喺唔同座標重複出現）。
 *
 * logo 用 position:fixed：Chrome 列印時 fixed 元素會喺每一頁重複出現，
 * 正正係「每頁頁首 logo」嘅機制；非負 top/right 實測唔會產生重複副本。
 */
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from './facilitySettings';
import { extractPageConfig, normalizeMargin, cssLengthToMm, LOGO_EDGE_MM } from './printUtils';

/**
 * 將文件 @page 嘅上/右 margin **一律歸零**（bottom/left 保留原值），
 * 差額以 body padding 補回，等內容版面維持不變。
 * 回傳處理後嘅 html 同 logo 嘅 css 偏移（相對內容原點 = LOGO_EDGE_MM，保證 ≥ 0）。
 */
const normalizeMarginsForLogo = (html: string): { html: string; top: number; right: number; orig: { mt: number; mr: number; mb: number; ml: number } } => {
  const config = extractPageConfig(html);
  const [mt, mr, mb, ml] = normalizeMargin(config.margin).split(/\s+/);
  const mtMm = cssLengthToMm(mt);
  const mrMm = cssLengthToMm(mr);
  // 原 margin 記低（mm）：打孔指引（punchGuide）行後，會將原 ml/mt 寫入
  // .punch-guide-fixed 嘅 data-orig-ml/data-orig-mt，俾雙面背面內容讓位計算
  const orig = { mt: mtMm, mr: mrMm, mb: cssLengthToMm(mb), ml: cssLengthToMm(ml) };
  // 一律歸零：所有文件 logo 座標統一為 LOGO_EDGE_MM，合併列印時精確重疊
  const newMt = 0;
  const newMr = 0;
  const padTop = mtMm - newMt;
  const padRight = mrMm - newMr;

  let out = html;
  if (padTop > 0 || padRight > 0) {
    // 改寫第一個 @page block 嘅 margin shorthand（保留 bottom/left 原值）
    const m = /@page(?:\s+[^{\s]+)?\s*\{/i.exec(out);
    if (m) {
      const blockStart = m.index + m[0].length;
      let depth = 1;
      let j = blockStart;
      while (j < out.length && depth > 0) {
        if (out[j] === '{') depth++;
        else if (out[j] === '}') depth--;
        j++;
      }
      const block = out.slice(blockStart, j - 1);
      const newMargin = `margin: ${newMt}mm ${newMr}mm ${mb} ${ml}`;
      const newBlock = /margin\s*:/.test(block)
        ? block.replace(/margin\s*:[^;}]+/, newMargin)
        : `${newMargin};${block}`;
      out = out.slice(0, blockStart) + newBlock + out.slice(j - 1);
    }
    // body padding 補回差額（插喺 </head> 前 = 範本樣式之後，同 specificity 下後者勝）
    const padCss = `<style>body{padding-top:${padTop}mm;padding-right:${padRight}mm;}</style>`;
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${padCss}</head>`);
    else out = padCss + out;
  }
  return { html: out, top: LOGO_EDGE_MM - newMt, right: LOGO_EDGE_MM - newMr, orig };
};

// 唔可以包 @media print：合併列印前會喺 screen media 量度頁高（雙面補頁），
// 若 logo 只喺 print media 先 fixed，量度時佢會變 static 元素撐大文件高度，令頁數估算錯誤
const logoCss = (top: number, right: number): string =>
  `<style>.admission-page-logo{position:fixed;top:${top.toFixed(2)}mm;right:${right.toFixed(2)}mm;width:32mm;height:auto;z-index:2147483647;}</style>`;

const logoImgTag = (logoSrc: string, orig: { mt: number; mr: number; mb: number; ml: number }): string =>
  `<img class="admission-page-logo" src="${logoSrc}" alt="院舍標誌" data-orig-mt="${orig.mt.toFixed(2)}" data-orig-mr="${orig.mr.toFixed(2)}" data-orig-mb="${orig.mb.toFixed(2)}" data-orig-ml="${orig.ml.toFixed(2)}">`;

/** 取得院舍 logo 來源（data URI 或後備路徑） */
export const getFacilityLogoSrc = async (): Promise<string> => {
  const settings = await getFacilitySettings();
  return settings.logoDataUri || DEFAULT_FACILITY_SETTINGS.logoDataUri || '/sc-logo.png';
};

/**
 * 注入每頁右上角院舍 logo（fixed，列印時每頁重複）。
 * 位置以紙張邊緣計（距邊 LOGO_EDGE_MM），所有文件統一；必要時會收窄文件
 * @page 上/右 margin 並以 body padding 補償（見 normalizeMarginsForLogo）。
 */
export const injectPageLogo = (html: string, logoSrc: string): string => {
  if (!html) return html;
  const normalized = normalizeMarginsForLogo(html);
  const css = logoCss(normalized.top, normalized.right);
  let out = normalized.html;
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${css}</head>`);
  else out = css + out;
  const img = logoImgTag(logoSrc, normalized.orig);
  if (/<body[^>]*>/i.test(out)) out = out.replace(/<body([^>]*)>/i, `<body$1>${img}`);
  else out = img + out;
  return out;
};
