/**
 * 共用列印工具：合併多個 HTML 頁面為一次 iframe 列印
 */

/** 從完整 HTML 字串中提取 <body> 內容 */
export const extractBodyHtml = (html: string): string =>
  html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? '';

/**
 * 合併多個「各自完整的 HTML 頁面」並透過隱藏 iframe 列印。
 * 第一個 HTML 提供 CSS/head；後續頁面只取 body 內容追加。
 * 會自動在 </style> 前注入 page-break CSS，確保每個頁面容器印在獨立頁。
 */
export const printCombinedHtml = (pages: string[], iframeId: string): void => {
  if (pages.length === 0) return;

  let combined = pages[0];

  // 注入 page-break-after 讓每個容器獨佔一印刷頁
  const breakCss = [
    '.form-container',
    '.page-container',
    '.io-page-break',
  ].join(', ') + ' { page-break-after: always; break-after: page; }\n';
  combined = combined.replace('</style>', breakCss + '</style>');

  // 追加後續頁面的 body 內容（放在 </body> 前）
  if (pages.length > 1) {
    const extra = pages.slice(1).map(extractBodyHtml).join('\n');
    combined = combined.replace('</body>', extra + '\n</body>');
  }

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
