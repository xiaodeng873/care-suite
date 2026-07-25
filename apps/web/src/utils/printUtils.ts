/**
 * 共用列印工具：合併多個 HTML 頁面為一次 iframe 列印
 */

import { scopeCssText, scopeInlineScripts } from './cssScope';

/** 從完整 HTML 字串中提取 <body> 內容 */
export const extractBodyHtml = (html: string): string =>
  html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? '';

/**
 * 把一份 HTML（完整文件或 body 片段）拆解並隔離：
 * - 抽出 <style>，所有選擇器加 `.scopeClass` 前綴（body → 容器本身），
 *   否則多份文件合併時，範本的 `td{...}` 等裸元素選擇器會互相污染
 * - 無名 @page 改寫為具名 @page（讓每份文件保留自己的紙張大小/方向/margin）
 * - body 內容包進 `<div class="scopeClass">`
 */
const scopeDocumentHtml = (page: string, scopeClass: string): { styles: string; body: string } => {
  const styleMatches = page.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  let hasBarePageRule = false;
  const scopedStyles = styleMatches.map((styleTag) => {
    // 無名 @page → 具名 @page
    let s = styleTag.replace(/@page\s*\{/g, () => {
      hasBarePageRule = true;
      return `@page ${scopeClass} {`;
    });
    // 全部選擇器加容器前綴，徹底隔離樣式
    s = s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (_m, open: string, inner: string, close: string) =>
      open + scopeCssText(inner, scopeClass) + close
    );
    return s;
  });
  if (hasBarePageRule) {
    scopedStyles.push(`<style>.${scopeClass} { page: ${scopeClass}; }</style>`);
  }
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
  // inline <script> 各自包 IIFE 並把 document 查詢限定在容器內，
  // 避免多份文件的腳本互相干擾（頂層 let 重複宣告、跨文件改頁碼等）
  const bodyContent = scopeInlineScripts(rawBody, scopeClass);
  return {
    styles: scopedStyles.join('\n'),
    body: `<div class="${scopeClass}">${bodyContent}</div>`,
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
