/**
 * 共用列印工具：合併多個 HTML 頁面為一次 iframe 列印
 */

import { scopeCssText, scopeInlineScripts } from './cssScope';

/** 從完整 HTML 字串中提取 <body> 內容 */
export const extractBodyHtml = (html: string): string =>
  html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? '';

const PX_PER_MM = 96 / 25.4;

/** 每頁 logo 同紙張上/右邊緣嘅距離（mm）——所有文件統一嘅絕對位置 */
export const LOGO_EDGE_MM = 2;

const PAGE_SIZES_MM: Record<string, [number, number]> = {
  a4: [210, 297],
  a5: [148, 210],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

/** CSS 長度（mm/cm/in/pt/px）轉 mm；無單位當 mm（@page margin 常見寫法） */
export const cssLengthToMm = (raw: string): number => {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)(mm|cm|in|pt|px)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'mm').toLowerCase()) {
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return n * 25.4 / 72;
    case 'px': return n * 25.4 / 96;
    default: return n;
  }
};

/** 由 PageConfig 計算紙張尺寸（闊/高，mm，已計方向） */
export const pagePaperSizeMm = (config: PageConfig): { w: number; h: number } => {
  const [pw, ph] = PAGE_SIZES_MM[config.size.toLowerCase()] ?? PAGE_SIZES_MM.a4;
  return config.orientation === 'landscape' ? { w: ph, h: pw } : { w: pw, h: ph };
};

/** 由 PageConfig 計算單頁內容盒（闊/高，mm） */
export const pageContentBoxMm = (config: PageConfig): { w: number; h: number } => {
  const paper = pagePaperSizeMm(config);
  const [mt, mr, mb, ml] = normalizeMargin(config.margin).split(/\s+/).map(cssLengthToMm);
  return { w: paper.w - ml - mr, h: paper.h - mt - mb };
};

const BREAK_DECL_RE = /(?:page-)?break-(?:before|after)\s*:\s*(always|page)\b/i;
const RULE_RE = /([^{}@][^{}]*)\{([^{}]*)\}/g;

/**
 * 將 @media print {...} 拆殼成無條件規則（其他 media 唔郁）。
 * 合併文件嘅 iframe 只用作列印，但雙面補頁嘅頁高量度喺 screen media 進行；
 * 拆殼後量度所見版面 = 列印版面（否則如「print 先 padding:0」嘅範本會度高咗）。
 */
export const unwrapPrintMedia = (css: string): string => {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const m = /@media[^{}]*\{/gi;
    m.lastIndex = i;
    const match = m.exec(css);
    if (!match) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, match.index);
    // 搵平衡嘅右 braces
    let depth = 0;
    let j = match.index + match[0].length - 1;
    for (; j < n; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = css.slice(match.index + match[0].length, j);
    out += /\bprint\b/i.test(match[0]) && !/\bscreen\b/i.test(match[0]) ? inner : match[0] + inner + '}';
    i = j + 1;
  }
  return out;
};

/** 從 CSS 文本抽出帶強制分頁（page-break-before/after: always|page）嘅選擇器 */
export const extractBreakSelectors = (cssText: string): string[] => {
  const selectors: string[] = [];
  RULE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RULE_RE.exec(cssText))) {
    if (!BREAK_DECL_RE.test(m[2])) continue;
    m[1].split(',').forEach((s) => {
      const t = s.trim();
      if (t) selectors.push(t);
    });
  }
  return selectors;
};

const isForcedBreak = (value: string): boolean => /^(always|page)$/.test((value || '').trim());

/**
 * 估算一份文件喺印刷排版下佔幾多頁。
 * 以 wrapper 實高 ÷ 單頁內容高為基礎，再按元素嘅強制分頁（page-break-before/after）
 * 切成多段各自計頁數——床頭表等以 `.container{page-break-after:always}` 明確分頁嘅
 * 文件，淨計總高會嚴重低估（每頁內容未填滿）。
 */
const measurePrintedPageCount = (
  win: Window,
  wrapper: HTMLElement,
  contentHeightPx: number,
  breakSelectors: string[]
): number => {
  const wRect = wrapper.getBoundingClientRect();
  const boundaries: number[] = [];
  if (breakSelectors.length) {
    let els: NodeListOf<Element>;
    try {
      els = wrapper.querySelectorAll(breakSelectors.join(','));
    } catch {
      els = wrapper.querySelectorAll(':scope'); // 選擇器語法異常時當無強制分頁
    }
    els.forEach((el) => {
      const cs = win.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (isForcedBreak(cs.pageBreakBefore) || isForcedBreak((cs as CSSStyleDeclaration & { breakBefore?: string }).breakBefore ?? '')) {
        boundaries.push(r.top);
      }
      if (isForcedBreak(cs.pageBreakAfter) || isForcedBreak((cs as CSSStyleDeclaration & { breakAfter?: string }).breakAfter ?? '')) {
        boundaries.push(r.bottom);
      }
    });
  }
  boundaries.sort((a, b) => a - b);
  const spanPages = (start: number, end: number): number => {
    const hPx = end - start;
    if (hPx < 1) return 0;
    return Math.max(1, Math.ceil(hPx / contentHeightPx - 0.01));
  };
  let pages = 0;
  let segStart = wRect.top;
  for (const y of boundaries) {
    pages += spanPages(segStart, y);
    segStart = y;
  }
  pages += spanPages(segStart, wRect.bottom);
  return Math.max(1, pages);
};

/**
 * 雙面列印對齊：量度每份文件嘅印刷頁數，奇數頁嘅文件後面補一頁空白，
 * 等下一份文件必定由新一張紙嘅正面開始（Chrome 唔支援 break-before: right，
 * 只能靠實際插入空白頁）。最後一份文件唔使補。
 * spacer 嘅 class 含 "print-doc-"，令 `[class*="print-doc-"] + [class*="print-doc-"]`
 * 分頁規則喺 spacer 前後都生效。
 *
 * 同時將每份文件嘅 fixed logo 換成「逐頁 absolute logo」：fixed 會喺包括空白補頁
 * 在內嘅每一頁重複，換成按量度頁數注入嘅 absolute 副本後，空白頁冇 logo，
 * 而且每頁只會顯示自己文件嘅 logo（唔再係全部文件嘅 logo 疊埋一齊）。
 * 第 k 頁嘅 logo top = k × 內容盒高 + (LOGO_EDGE_MM − marginTop)：Chrome 對 fragmented
 * relative 容器入面嘅 absolute 子元素，係以「內容流座標」（每頁推進一個內容盒高，
 * 唔係紙高）定位；扣減 margin 後 logo 喺紙張上同其他文件同一絕對位置（右上角，
 * 距紙邊 LOGO_EDGE_MM）。
 */
export const padOddPageDocuments = (
  iframeDoc: Document,
  wrappers: { selector: string; config: PageConfig; pageName?: string }[],
  allCssText: string,
  duplexPadding = true
): void => {
  if (wrappers.length < 2) return;
  const win = iframeDoc.defaultView;
  if (!win) return;
  const breakSelectors = extractBreakSelectors(allCssText);
  wrappers.forEach(({ selector, config, pageName }, idx) => {
    const wrapper = iframeDoc.querySelector<HTMLElement>(selector);
    if (!wrapper) return;
    const contentHeightMm = pageContentBoxMm(config).h;
    const contentHeightPx = contentHeightMm * PX_PER_MM;
    if (contentHeightPx <= 0) return;
    const pageCount = measurePrintedPageCount(win, wrapper, contentHeightPx, breakSelectors);

    const fixedImg = wrapper.querySelector('img.admission-page-logo');
    if (fixedImg) {
      const src = fixedImg.getAttribute('src') || '';
      fixedImg.remove();
      wrapper.style.position = 'relative';
      const [mt, mr] = normalizeMargin(config.margin).split(/\s+/).map(cssLengthToMm);
      // injectPageLogo 已將 margin 收窄到 ≤ LOGO_EDGE_MM，偏移保證 ≥ 0（負值會竄頁/出幽靈副本）
      const logoTop = Math.max(0, LOGO_EDGE_MM - mt);
      const logoRight = Math.max(0, LOGO_EDGE_MM - mr);
      for (let k = 0; k < pageCount; k++) {
        const img = iframeDoc.createElement('img');
        img.className = 'admission-page-logo';
        img.src = src;
        img.alt = '院舍標誌';
        // +0.3mm：k×內容盒高啱啱喺 fragment 邊界，Chrome 會歸去前一頁底部；微調入 fragment 內
        img.style.cssText = `position:absolute;top:${(k * contentHeightMm + logoTop + 0.3).toFixed(1)}mm;right:${logoRight.toFixed(1)}mm;width:32mm;height:auto;z-index:2147483647;`;
        wrapper.appendChild(img);
      }
    }

    if (!duplexPadding) return; // 唔勾雙面列印就唔補空白頁（logo 注入照做）
    if (idx === wrappers.length - 1) return; // 最後一份唔使補空白頁
    if (pageCount % 2 === 0) return;
    const spacer = iframeDoc.createElement('div');
    spacer.className = `print-doc-blank-${idx}`;
    // 跟返自己文件嘅 named page（橫向文件嘅補頁都係橫向空白）
    spacer.style.cssText = `height:0;${pageName ? `page:${pageName};` : ''}`;
    wrapper.insertAdjacentElement('afterend', spacer);
  });
};

/** 等 iframe 內字體同圖片就緒（上限 5 秒），先至量度頁高先準 */
const waitForLayoutReady = async (win: Window): Promise<void> => {
  const images = Array.from(win.document.images).map((img) =>
    img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
  );
  await Promise.race([
    Promise.all([win.document.fonts?.ready ?? Promise.resolve(), ...images]),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
};

export interface PageConfig {
  size: string;
  orientation: 'portrait' | 'landscape';
  margin: string; // normalized top right bottom left
}

const DEFAULT_PAGE_CONFIG: PageConfig = {
  size: 'A4',
  orientation: 'portrait',
  margin: '0 0 0 0',
};

/** Normalize a margin shorthand to `top right bottom left` */
export const normalizeMargin = (margin: string): string => {
  if (!margin) return '0 0 0 0';
  const parts = margin.trim().split(/\s+/);
  if (parts.length === 0) return '0 0 0 0';
  if (parts.length === 1) return `${parts[0]} ${parts[0]} ${parts[0]} ${parts[0]}`;
  if (parts.length === 2) return `${parts[0]} ${parts[1]} ${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[1]}`;
  return parts.slice(0, 4).join(' ');
};

/** Parse the top-level declarations of an @page block (skips nested at-rules) */
const parsePageBlockDeclarations = (block: string): Record<string, string> => {
  const result: Record<string, string> = {};
  let i = 0;
  let depth = 0;
  let quote = '';
  let cur = '';
  while (i < block.length) {
    const ch = block[i];
    if (quote) {
      if (ch === '\\') { cur += ch; i++; }
      else if (ch === quote) { cur += ch; quote = ''; }
    } else if (ch === '"' || ch === "'") {
      cur += ch;
      quote = ch;
    } else if (ch === '{' || ch === '(') {
      depth++;
      cur += ch;
    } else if (ch === '}' || ch === ')') {
      depth--;
      cur += ch;
    } else if (ch === ';' && depth === 0) {
      const colon = cur.indexOf(':');
      if (colon !== -1) {
        const key = cur.slice(0, colon).trim();
        const value = cur.slice(colon + 1).trim();
        if (key) result[key] = value;
      }
      cur = '';
    } else {
      cur += ch;
    }
    i++;
  }
  if (cur) {
    const colon = cur.indexOf(':');
    if (colon !== -1) {
      const key = cur.slice(0, colon).trim();
      const value = cur.slice(colon + 1).trim();
      if (key) result[key] = value;
    }
  }
  return result;
};

/** Extract the first @page block content (inside the braces) from CSS text */
const extractFirstPageBlock = (css: string): string | null => {
  // strip comments to avoid matching @page inside comments
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const idx = noComments.search(/@page(?:\s+[\w-]+)?\s*\{/i);
  if (idx === -1) return null;
  const braceIdx = css.indexOf('{', idx);
  if (braceIdx === -1) return null;
  let depth = 0;
  let quote = '';
  let j = braceIdx;
  while (j < css.length) {
    const ch = css[j];
    if (quote) {
      if (ch === '\\') j++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '/' && css[j + 1] === '*') {
      const end = css.indexOf('*/', j + 2);
      j = end === -1 ? css.length : end + 1;
      continue;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return css.slice(braceIdx + 1, j);
      }
    }
    j++;
  }
  return null;
};

const MM_TO_MM = 1;
const CM_TO_MM = 10;
const IN_TO_MM = 25.4;

/** Normalize `210mm 297mm` / `297mm 210mm` to A4 portrait/landscape */
const normalizeSizeFromDimensions = (value: string): { size: string; orientation: 'portrait' | 'landscape' } | null => {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|in)\s+(\d+(?:\.\d+)?)\s*(mm|cm|in)$/i);
  if (!match) return null;
  const width = parseFloat(match[1]);
  const height = parseFloat(match[3]);
  const unit = match[2].toLowerCase();
  const toMm = unit === 'mm' ? MM_TO_MM : unit === 'cm' ? CM_TO_MM : IN_TO_MM;
  const wMm = width * toMm;
  const hMm = height * toMm;
  if (
    (Math.abs(wMm - 210) <= 2 && Math.abs(hMm - 297) <= 2) ||
    (Math.abs(wMm - 297) <= 2 && Math.abs(hMm - 210) <= 2)
  ) {
    return { size: 'A4', orientation: wMm > hMm ? 'landscape' : 'portrait' };
  }
  return null;
};

/** Extract the printed page configuration from a full HTML document */
export const extractPageConfig = (html: string): PageConfig => {
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const css = styleMatches.map((tag) => tag.replace(/<\/?style[^>]*>/gi, '')).join('\n');
  const block = extractFirstPageBlock(css);
  if (!block) return DEFAULT_PAGE_CONFIG;

  const decls = parsePageBlockDeclarations(block);
  const sizeValue = decls.size || '';
  const marginValue = decls.margin || '';
  const orientationValue = decls.orientation || '';

  let size = 'A4';
  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (sizeValue) {
    const dim = normalizeSizeFromDimensions(sizeValue);
    if (dim) {
      size = dim.size;
      orientation = dim.orientation;
    } else {
      const tokens = sizeValue.split(/\s+/);
      size = tokens[0] || 'A4';
      if (tokens[1] && /^(landscape|portrait)$/i.test(tokens[1])) {
        orientation = tokens[1].toLowerCase() as 'portrait' | 'landscape';
      }
    }
  }
  if (orientationValue && /^(landscape|portrait)$/i.test(orientationValue)) {
    orientation = orientationValue.toLowerCase() as 'portrait' | 'landscape';
  }

  const margin = marginValue ? normalizeMargin(marginValue) : '0 0 0 0';
  return { size, orientation, margin };
};

/** Group pages by printed size（orientation 唔分組：Chrome 支援同一文件混合唔同方向嘅
    具名 @page，橫向文件如急症室記錄可以同直向文件同一 iframe 一次過列印；
    margin 唔參與分組，稍後以具名 @page 還原） */
export const groupPagesByConfig = (
  pages: string[]
): Map<string, { config: PageConfig; pages: string[] }> => {
  const groups = new Map<string, { config: PageConfig; pages: string[] }>();
  for (const page of pages) {
    if (!page.trim()) continue;
    const config = extractPageConfig(page);
    const key = config.size;
    const existing = groups.get(key);
    if (existing) {
      existing.pages.push(page);
    } else {
      groups.set(key, { config, pages: [page] });
    }
  }
  return groups;
};

/** Remove all @page blocks from CSS (including nested @top-center etc.) */
export const stripPageBlocks = (css: string): string => {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const ch = css[i];
    // skip comments
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      out += css.slice(i, end === -1 ? n : end + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    // skip strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (css[j] === '\\') j += 2;
        else if (css[j] === quote) { j++; break; }
        else j++;
      }
      out += css.slice(i, j);
      i = j;
      continue;
    }
    // check for @page
    if (css.slice(i, i + 5).toLowerCase() === '@page') {
      const braceIdx = css.indexOf('{', i);
      if (braceIdx !== -1) {
        let depth = 0;
        let quote = '';
        let j = braceIdx;
        while (j < n) {
          const c = css[j];
          if (quote) {
            if (c === '\\') j++;
            else if (c === quote) quote = '';
          } else if (c === '"' || c === "'") {
            quote = c;
          } else if (c === '/' && css[j + 1] === '*') {
            const end = css.indexOf('*/', j + 2);
            j = end === -1 ? n : end + 1;
            continue;
          } else if (c === '{') {
            depth++;
          } else if (c === '}') {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
          j++;
        }
        i = j;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
};

/**
 * 把一份 HTML（完整文件或 body 片段）拆解並隔離：
 * - 抽出 <style>，所有選擇器加 `.scopeClass` 前綴（body → 容器本身），
 *   否則多份文件合併時，範本的 `td{...}` 等裸元素選擇器會互相污染
 * - 無名 @page 改寫為具名 @page（讓每份文件保留自己的紙張大小/方向/margin）
 * - body 內容包進 `<div class="scopeClass">`
 */
const scopeDocumentHtml = (
  page: string,
  scopeClass: string,
  pageStrategy: 'scope' | 'strip' = 'scope',
  wrapperStyle = ''
): { styles: string; body: string } => {
  const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  let hasBarePageRule = false;
  const scopedStyles = styleMatches.map((styleTag) => {
    const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
    if (!openMatch) return styleTag;
    const [, attrs, innerCss] = openMatch;
    const processedCss = pageStrategy === 'strip' ? stripPageBlocks(innerCss) : innerCss;
    let scopedCss = scopeCssText(processedCss, scopeClass);
    // 見 unwrapPrintMedia：令 screen 量度（雙面補頁）同 print 輸出用同一套版面規則
    scopedCss = unwrapPrintMedia(scopedCss);
    if (pageStrategy === 'scope') {
      scopedCss = scopedCss.replace(/@page\s*\{/g, () => {
        hasBarePageRule = true;
        return `@page ${scopeClass} {`;
      });
    }
    return `<style${attrs}>${scopedCss}</style>`;
  });
  if (pageStrategy === 'scope' && hasBarePageRule) {
    scopedStyles.push(`<style>.${scopeClass} { page: ${scopeClass}; }</style>`);
  }
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
  const bodyContent = scopeInlineScripts(rawBody, scopeClass);
  return {
    styles: scopedStyles.join('\n'),
    body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ''}>${bodyContent}</div>`,
  };
};

/**
 * 合併多個 HTML 頁面並透過隱藏 iframe 列印。
 * 每個元素可以是完整 HTML 文件或純 body 片段；
 * 每份文件的樣式與內容會被隔離（見 scopeDocumentHtml），文件之間自動分頁。
 *
 * 若 `sequential` 為 true，會為每份文件各自開一個 iframe 並依序叫出列印對話框。
 * 這是唯一能保證多份混和 orientation / margin 的文件與原範本完全一致的
 * 客戶端做法，因為 Chrome 對同一份文件內大量具名 @page 的分頁有已知缺陷：
 * 當一份文件內出現數十個不同名稱的 @page 時，自然溢出的內容會被無故裁掉。
 *
 * 非 sequential 模式會量度每份文件嘅印刷頁數，奇數頁文件後補一頁空白
 * （padOddPageDocuments），令雙面列印時每份文件都由新一張紙嘅正面開始。
 */
export const printCombinedHtml = (pages: string[], iframeId: string, sequential = false): void => {
  if (pages.length === 0) return;

  if (sequential) {
    let index = 0;
    const printNext = () => {
      // 跳過空頁
      while (index < pages.length && !pages[index].trim()) index++;
      if (index >= pages.length) return;

      const old = document.getElementById(iframeId);
      if (old) old.remove();

      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(pages[index]);
      doc.close();

      const win = iframe.contentWindow;
      if (!win) return;

      const current = index;
      index++;

      const cleanup = () => {
        iframe.remove();
        win.removeEventListener('afterprint', cleanup);
        printNext();
      };

      // afterprint 會在使用者關閉列印對話框後觸發（不論按下列印或取消）
      win.addEventListener('afterprint', cleanup);

      // 保險：若 afterprint 未觸發，5 秒後強制繼續下一頁
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.remove();
          printNext();
        }
      }, 5000);

      setTimeout(() => { win.print(); }, 300);
    };

    printNext();
    return;
  }

  const parts = pages.map((page, i) => {
    const config = extractPageConfig(page);
    const widthPx = pageContentBoxMm(config).w * PX_PER_MM;
    return {
      config,
      // border-box：logo 文件嘅 @page 上/右 margin 已被 injectPageLogo 收窄並以
      // body padding 補償，wrapper 闊度要連 padding 先啱啱填滿內容盒
      ...scopeDocumentHtml(page, `print-doc-${i}`, 'scope', `box-sizing:border-box;width:${widthPx.toFixed(1)}px;`),
    };
  });

  const baseCss = `
  /* 範本的 body{margin:0} 已被隔離到容器 class，外層 body 必須自行歸零，
     否則瀏覽器預設 8px margin 會改變每份文件的版面位置並可能導致超頁 */
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  /* 範本自帶嘅螢幕列印按鈕唔可以參與頁高量度（佢哋嘅 @media print 先會隱藏） */
  .no-print { display: none !important; }`;
  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}
</style>
${parts.map((p) => p.styles).join('\n')}
</head>
<body>
${parts.map((p) => p.body).join('\n')}
</body>
</html>`;

  const old = document.getElementById(iframeId);
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = iframeId;
  // 離屏但有真實版面闊度：量度雙面補頁所需嘅頁高時，版面先同印刷一致
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(combined);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) return;

  const doPrint = async () => {
    // 雙面列印：奇數頁文件後補空白頁，下一份文件唔會印喺上一張紙嘅背面
    try {
      await waitForLayoutReady(win);
      padOddPageDocuments(
        doc,
        parts.map((p, i) => ({ selector: `.print-doc-${i}`, config: p.config })),
        `${baseCss}\n${parts.map((p) => p.styles).join('\n')}`
      );
    } catch {
      // 量度失敗就照印（行為同未補頁一樣）
    }
    win.focus();
    win.print();
  };
  if (doc.readyState === 'complete') void doPrint();
  else iframe.addEventListener('load', () => void doPrint(), { once: true });
};

/** 每個 iframe 最多渲染的文件份數，超過則拆成多組依序列印 */
export const MAX_PAGES_PER_IFRAME = 30;

/**
 * 依 `size` 把 pages 分組，同組文件合併到單一 iframe 列印。
 * - 同組文件的 orientation / margin 可能不同：以「具名 @page」還原每份文件自己嘅
 *   方向同 margin（Chrome 實測支援同一文件混合 portrait / landscape 具名 @page，
 *   所以橫向文件如急症室記錄可以同其他文件同一 iframe 一次過列印；
 *   每個 batch 內只會有少數幾種組合，避開 Chrome 對大量具名 @page 的分頁缺陷；
 *   不可用容器 padding 代替 margin——Chrome 分頁時 padded 容器內的滿版 flex 頁
 *   會把頁尾擠去下一頁，造成「下方超頁」）
 * - 每組最多 MAX_PAGES_PER_IFRAME 份文件（目前 30 份），超出再拆成多個 iframe
 * - 不同組/批次之間依序叫出列印對話框（上組關閉後才開下組）
 * - 每批列印前會量度各文件嘅印刷頁數，奇數頁文件後補一頁空白
 *   （padOddPageDocuments），令雙面列印時每份文件都由新一張紙嘅正面開始
 */
export const printGroupedHtml = (pages: string[], iframeId: string, duplexPadding = true): void => {
  const groups = groupPagesByConfig(pages);
  // 每組再按 30 份一批切分
  const batches: { config: PageConfig; pages: string[] }[] = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.pages.length; i += MAX_PAGES_PER_IFRAME) {
      batches.push({ config: group.config, pages: group.pages.slice(i, i + MAX_PAGES_PER_IFRAME) });
    }
  }
  if (batches.length === 0) return;

  let index = 0;
  const printNext = () => {
    if (index >= batches.length) return;
    const { config, pages: batchPages } = batches[index];
    const batchIndex = index;
    index++;

    // 收集 batch 內不同的 orientation + margin 組合，各配一個具名 @page
    const marginPageNames = new Map<string, string>();
    const pageRules: string[] = [];
    const parts = batchPages.map((page, i) => {
      const pageConfig = extractPageConfig(page);
      const margin = pageConfig.margin;
      const pageKey = `${pageConfig.orientation}|${margin}`;
      let pageName = marginPageNames.get(pageKey);
      if (!pageName) {
        pageName = `pg-${batchIndex}-${marginPageNames.size}`;
        marginPageNames.set(pageKey, pageName);
        pageRules.push(`@page ${pageName} { size: ${config.size} ${pageConfig.orientation}; margin: ${margin}; }`);
      }
      const widthPx = pageContentBoxMm({ ...pageConfig, size: config.size }).w * PX_PER_MM;
      // border-box：logo 文件嘅 @page 上/右 margin 已被 injectPageLogo 收窄並以
      // body padding 補償，wrapper 闊度要連 padding 先啱啱填滿內容盒
      const wrapperStyle = `page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;`;
      return { pageConfig, pageName, ...scopeDocumentHtml(page, `print-doc-${batchIndex}-${i}`, 'strip', wrapperStyle) };
    });

    const baseCss = `
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  /* 範本自帶嘅螢幕列印按鈕唔可以參與頁高量度（佢哋嘅 @media print 先會隱藏） */
  .no-print { display: none !important; }
  @page { size: ${config.size}; margin: 0; }
  ${pageRules.join('\n  ')}`;
    const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}
</style>
${parts.map((p) => p.styles).join('\n')}
</head>
<body>
${parts.map((p) => p.body).join('\n')}
</body>
</html>`;

    const old = document.getElementById(iframeId);
    if (old) old.remove();

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    // 離屏但有真實版面闊度：量度雙面補頁所需嘅頁高時，版面先同印刷一致
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(combined);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) return;

    const cleanup = () => {
      iframe.remove();
      win.removeEventListener('afterprint', cleanup);
      printNext();
    };

    const doPrint = async () => {
      // 雙面列印：奇數頁文件後補空白頁，下一份文件唔會印喺上一張紙嘅背面
      try {
        await waitForLayoutReady(win);
        padOddPageDocuments(
          doc,
          parts.map((p, i) => ({
            selector: `.print-doc-${batchIndex}-${i}`,
            config: { ...p.pageConfig, size: config.size },
            pageName: p.pageName,
          })),
          `${baseCss}\n${parts.map((p) => p.styles).join('\n')}`,
          duplexPadding
        );
      } catch {
        // 量度失敗就照印（行為同未補頁一樣）
      }
      win.addEventListener('afterprint', cleanup);
      // 保險：若 afterprint 未觸發，5 秒後強制繼續下一批
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.remove();
          printNext();
        }
      }, 5000);
      win.focus();
      win.print();
    };
    if (doc.readyState === 'complete') void doPrint();
    else iframe.addEventListener('load', () => void doPrint(), { once: true });
  };

  printNext();
};

/** 日期加 N 天，回傳 'YYYY-MM-DD' */
export const addDays = (dateStr: string, n: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

/** 迭代日期範圍，每次步進 stepDays，回傳每個 chunk 的 startDate 字串陣列 */
export const dateChunks = (startDate: string, endDate: string, stepDays: number): string[] => {
  const chunks: string[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    chunks.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + stepDays);
  }
  return chunks;
};
