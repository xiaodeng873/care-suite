/**
 * 共用列印工具：合併多個 HTML 頁面為一次 iframe 列印
 */

import { scopeCssText, scopeInlineScripts } from './cssScope';

/** 從完整 HTML 字串中提取 <body> 內容 */
export const extractBodyHtml = (html: string): string =>
  html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? '';

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
const normalizeMargin = (margin: string): string => {
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

/** Group pages by printed size + orientation (margin 不參與分組，稍後以容器 padding 還原) */
export const groupPagesByConfig = (
  pages: string[]
): Map<string, { config: PageConfig; pages: string[] }> => {
  const groups = new Map<string, { config: PageConfig; pages: string[] }>();
  for (const page of pages) {
    if (!page.trim()) continue;
    const config = extractPageConfig(page);
    const key = `${config.size}|${config.orientation}`;
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
const stripPageBlocks = (css: string): string => {
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

  const parts = pages.map((page, i) => scopeDocumentHtml(page, `print-doc-${i}`));

  const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
  /* 範本的 body{margin:0} 已被隔離到容器 class，外層 body 必須自行歸零，
     否則瀏覽器預設 8px margin 會改變每份文件的版面位置並可能導致超頁 */
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
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
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(combined);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => { iframe.contentWindow?.print(); }, 400);
};

/** 每個 iframe 最多渲染的文件份數，超過則拆成多組依序列印 */
export const MAX_PAGES_PER_IFRAME = 100;

/**
 * 依 `size + orientation` 把 pages 分組，同組文件合併到單一 iframe 列印。
 * - 同組文件的 margin 可能不同：組的 @page 統一 margin: 0，
 *   每份文件自己的 margin 改以容器 padding 還原，列印版面與原範本一致
 *   （唯一差異：自然溢出的續頁頂部少了原 @page margin 的留白，
 *    但續頁可用空間只會更多、不會裁切內容）
 * - 每組最多 MAX_PAGES_PER_IFRAME 份文件，超出再拆成多個 iframe
 * - 不同組/批次之間依序叫出列印對話框（上組關閉後才開下組）
 */
export const printGroupedHtml = (pages: string[], iframeId: string): void => {
  const groups = groupPagesByConfig(pages);
  // 每組再按 100 份一批切分
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
    index++;

    const parts = batchPages.map((page, i) => {
      // 用文件自己的 margin 作為容器 padding，還原原範本的可列印範圍
      const margin = extractPageConfig(page).margin;
      const wrapperStyle = margin === '0 0 0 0' ? '' : `padding: ${margin};`;
      return scopeDocumentHtml(page, `print-doc-${index - 1}-${i}`, 'strip', wrapperStyle);
    });

    const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  @page { size: ${config.size} ${config.orientation}; margin: 0; }
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
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
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

    win.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.remove();
        printNext();
      }
    }, 5000);

    setTimeout(() => { win.print(); }, 400);
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
