/**
 * 列印文件打孔虛線指引（配合標準 2-hole 打孔器）。
 *
 * 設計困境同取捨（出血位係排版設計嘅固定邊界，唔可以郁；內容向打孔區遷就，
 * 唯有喺內容盒落手）：
 * - **直向**：@page 左 margin 歸零（上/右/下保留原值，右邊出血完全唔變），以
 *   `body { padding-left: PUNCH_ZONE_MM }` 補償——in-flow 內容（表格 width:100%）
 *   起點向右移、闊度等比縮減讓位，而 fixed / absolute 元素嘅定位原點變成紙張
 *   左邊緣，可以用非負座標落到打孔區。合併列印時 body 選擇器會被 scope 到文件
 *   wrapper（見 scopeDocumentHtml），效果一樣。
 * - **橫向**：打孔區喺**頂部**（2-hole 打長邊；橫向時長邊係上/下），同樣手法：
 *   @page 上 margin 歸零、`body { padding-top }` 補償，指引圓圈貼上邊界。
 *
 * 機制同 printPageLogo 一脈相承（該處實戰經驗：fixed / absolute 負值偏移喺多頁
 * 文件會出現幽靈副本或竄頁，所以全部座標都係非負）：
 * 1. 注入 `position:fixed` 指引盒（.punch-guide-fixed）：Chrome 列印時 fixed 元素
 *    每頁重複出現，單張直印（iframe 直印、量度失敗回退、**非雙面合併列印**）
 *    已經每頁有指引，而且座標精準。
 *    重要：`body { overflow-x: clip }` 係固定座標精準嘅前提——實測 Chromium
 *    列印時，只要文件內容橫向溢出頁面內容盒（如某啲範本嘅 210mm 固定闊容器
 *    喺打孔讓位後嘅 190mm 內寬入面），fixed 元素嘅垂直座標會被系统性破壞
 *    （105.5mm 落地變 99.3mm）；clip 喺內容盒邊緣裁剪，視覺上同紙邊裁剪
 *    一模一樣（原本溢出嘅部分都係印唔出嘅）。
 * 2. **雙面**合併列印時由 padOddPageDocuments（printUtils）將 fixed 指引換成
 *    逐頁 absolute 圓圈，放喺「頁首 in-flow 元素」入面嘅零高度載體 div——呢個
 *    載體唔會 fragmented，absolute 定位係精準嘅（fragmented 容器入面嘅
 *    absolute 定位喺唔同 Chrome 版本有系統性偏移，唔可靠）。直向背面以紙寬
 *    鏡像去右邊；橫向背面以紙高鏡像去下邊。
 *
 * 幾何（A4）：
 * - 打孔區讓位 20mm：孔心距紙邊 15mm + 半孔 3mm + 2mm 緩衝
 * - 孔 Ø6mm、兩孔相距 80mm、以紙張垂直中線對稱（標準 2-hole 位置）
 * - 直向：圓圈貼左邊（x=12mm，y=105.5/185.5mm）；橫向：貼頂部（x=105.5/185.5mm，y=12mm）
 * - 每個孔一個虛線圓圈（唔畫穿線）
 */

import { extractPageConfig, normalizeMargin, cssLengthToMm, pagePaperSizeMm } from './printUtils';

export const PUNCH_ZONE_MM = 20;         // 內容讓位（打孔區）
export const PUNCH_HOLE_CENTER_MM = 15;  // 孔心距紙邊
export const PUNCH_HOLE_DIA_MM = 6;      // 孔徑（標準 2-hole）
export const PUNCH_HOLE_GAP_MM = 80;     // 兩孔中心距
const GUIDE_Z_INDEX = 2147483646;        // 低過 logo（2147483647）

/**
 * 將文件 @page 其中一邊 margin 歸零（其餘保留），body padding 補償讓位。
 * axis='left'：左 margin 歸零（直向，打孔區喺左）；axis='top'：上 margin 歸零（橫向）。
 */
const zeroMargin = (html: string, axis: 'left' | 'top', mt: number, mr: number, mb: number, ml: number): string => {
  const m = /@page(?:\s+[^{\s]+)?\s*\{/i.exec(html);
  const newMargin = axis === 'left'
    ? `margin: ${mt}mm ${mr}mm ${mb}mm 0`
    : `margin: 0 ${mr}mm ${mb}mm ${ml}mm`;
  if (!m) {
    const pageCss = `<style>@page { size: A4; ${newMargin}; }</style>`;
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${pageCss}</head>`) : pageCss + html;
  }
  const blockStart = m.index + m[0].length;
  let depth = 1;
  let j = blockStart;
  while (j < html.length && depth > 0) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') depth--;
    j++;
  }
  const block = html.slice(blockStart, j - 1);
  const newBlock = /margin\s*:/.test(block)
    ? block.replace(/margin\s*:[^;}]+/, newMargin)
    : `${newMargin};${block}`;
  return html.slice(0, blockStart) + newBlock + html.slice(j - 1);
};

/**
 * 注入打孔虛線指引。可重複呼叫（已有指引嘅文件會原樣回傳）。
 * 同時將 @page 打孔側 margin 歸零並以 body padding 讓位（內容遷就打孔區、
 * 其他邊唔郁）。直向打孔區喺左、橫向喺頂。所有座標以紙張邊緣計（歸零後
 * fixed 原點 = 紙緣），並記錄喺 data-paper-left/data-paper-top 供雙面鏡像用。
 */
export const injectPunchGuide = (html: string): string => {
  if (!html || html.includes('punch-guide-fixed')) return html;

  const config = extractPageConfig(html);
  const [mtRaw, mrRaw, mbRaw, mlRaw] = normalizeMargin(config.margin).split(/\s+/);
  const mt = cssLengthToMm(mtRaw);
  const mr = cssLengthToMm(mrRaw);
  const mb = cssLengthToMm(mbRaw);
  const ml = cssLengthToMm(mlRaw);
  const paper = pagePaperSizeMm(config);
  const landscape = config.orientation === 'landscape';

  // 標準 2-hole：兩孔中心距 80mm，以「打孔邊」中點對稱；孔心距紙邊 15mm
  const holeOffset = PUNCH_HOLE_CENTER_MM - PUNCH_HOLE_DIA_MM / 2; // 圓圈外緣距紙邊 = 12mm
  const midAlong = (landscape ? paper.w : paper.h) / 2;            // 打孔邊長度嘅中點
  const hole1Mid = midAlong - PUNCH_HOLE_GAP_MM / 2;
  const hole2Mid = midAlong + PUNCH_HOLE_GAP_MM / 2;
  // 直向：圓圈 (x=12, y=孔位)；橫向：圓圈 (x=孔位, y=12)
  const circlePos = (mid: number): { x: number; y: number } =>
    landscape ? { x: mid - PUNCH_HOLE_DIA_MM / 2, y: holeOffset } : { x: holeOffset, y: mid - PUNCH_HOLE_DIA_MM / 2 };

  const guide = (mid: number, origMl: number, origMt: number): string => {
    // 紙面座標（data-*）供雙面鏡像；inline 座標 = 紙面 − 最終 margin（fixed 原點
    // 喺頁面內容盒左上角：直向 ml 已歸零但 mt 保留；橫向 mt 已歸零但 ml 保留）。
    // data-orig-ml/mt = 歸零前嘅原始 margin：logo 先行（上/右已歸零），所以優先
    // 由 logo img 嘅 data-orig-* 讀返；無 logo 嘅文件此時 @page margin 仲係原值
    const { x, y } = circlePos(mid);
    const inlineLeft = x - (landscape ? ml : 0);
    const inlineTop = y - (landscape ? 0 : mt);
    return `<div class="punch-guide-fixed" data-paper-left="${x.toFixed(2)}" data-paper-top="${y.toFixed(2)}" data-orig-ml="${origMl.toFixed(2)}" data-orig-mt="${origMt.toFixed(2)}" style="left:${inlineLeft.toFixed(2)}mm;top:${inlineTop.toFixed(2)}mm;width:${PUNCH_HOLE_DIA_MM}mm;height:${PUNCH_HOLE_DIA_MM}mm;border:0.35mm dashed #999;border-radius:50%;"></div>`;
  };

  const padDecl = landscape ? `padding-top: ${PUNCH_ZONE_MM}mm;` : `padding-left: ${PUNCH_ZONE_MM}mm;`;
  const fitDecl = landscape ? '' : `
  /* 固定 210mm 闊嘅滿版容器（託管書/健康記錄等，可能嵌套喺 doc-page 入面）：
     內容盒讓位 20mm 後自動縮闊，右邊維持貼紙邊，唔會再被裁走右邊文字 */
  body > *, body .a4-container { max-width: 100%; }`;
  const css = `<style>
  body { ${padDecl} overflow-x: clip; }${fitDecl}
  .punch-guide-fixed { position: fixed; pointer-events: none; z-index: ${GUIDE_Z_INDEX}; }
  </style>`;

  // 歸零打孔側 margin（直向左、橫向上）；body padding 已經喺上面補償
  let out = zeroMargin(html, landscape ? 'top' : 'left', mt, mr, mb, ml);
  if (landscape) {
    // 滿版 min-height 容器（如急症室記錄 .container 195mm）喺讓位 20mm 後會超出
    // 內容盒 20mm，逼出幽靈頁：接近滿版嘅 min-height 一律減返 20mm（細容器唔郁）
    const contentHm = paper.h - mt - mb;
    const threshold = contentHm - PUNCH_ZONE_MM;
    out = out.replace(/min-height\s*:\s*(\d+(?:\.\d+)?)mm/g, (s, v) => {
      const n = parseFloat(v);
      return n > threshold ? `min-height:${n - PUNCH_ZONE_MM}mm` : s;
    });
  }
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${css}</head>`);
  else out = css + out;
  const origAttr = (name: string): number | null => {
    const m = html.match(new RegExp(`data-orig-${name}="(\\d+(?:\\.\\d+)?)"`));
    return m ? parseFloat(m[1]) : null;
  };
  // 原始 ml/mt：有 logo 時上/右已被 logo 歸零，要由 logo img 嘅 data-orig-* 讀返；
  // 無 logo 時此時 @page margin 仲未郁，直接讀
  const origMlAttr = origAttr('ml');
  const origMtAttr = origAttr('mt');
  const origMl = origMlAttr !== null ? origMlAttr : ml;
  const origMt = origMtAttr !== null ? origMtAttr : mt;

  const guides = guide(hole1Mid, origMl, origMt) + guide(hole2Mid, origMl, origMt);
  if (/<body[^>]*>/i.test(out)) out = out.replace(/<body([^>]*)>/i, `<body$1>${guides}`);
  else out = guides + out;
  return out;
};
