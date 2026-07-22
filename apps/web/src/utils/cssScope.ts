/**
 * CSS 選擇器隔離工具：把一段 CSS 內的所有選擇器加上容器 class 前綴。
 * 用途：多份 doc_html 範本合併成一份文件列印時，
 * 各範本的裸元素選擇器（如 `td { border: 1px solid }`）會互相污染，
 * 必須改寫為 `.container td { ... }` 只作用於自己的容器。
 *
 * 規則：
 * - `body` / `html` → `.scope`（範本 body 內容會包進該容器 div，body 本身即容器）
 * - 其他選擇器 → `.scope 原選擇器`
 * - @media / @supports / @layer / @container：遞迴處理內部規則
 * - @page / @font-face / @keyframes 等：原樣保留
 */

/** 依頂層逗號拆分選擇器列表（忽略 () [] 與引號內的逗號） */
const splitSelectors = (selectorText: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let quote = '';
  for (const ch of selectorText) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
};

/** 單一選擇器加前綴；body/html 開頭對應容器本身 */
const scopeOneSelector = (raw: string, scope: string): string => {
  let s = raw.trim();
  if (!s) return s;
  // 去掉開頭的 html（容器外層，不存在於隔離環境）
  s = s.replace(/^html(?=[\s>+~:.#[\]]|$)/, '').trimStart();
  if (!s) return scope;
  const bodyMatch = s.match(/^body(?=[\s>+~:.#[\]]|$)/);
  if (bodyMatch) {
    const rest = s.slice(4);
    if (!rest) return scope; // body → .scope
    if (/^[\s>+~]/.test(rest)) return `${scope} ${rest.trimStart()}`; // body .a / body > .a
    return `${scope}${rest}`; // body.foo / body::before
  }
  return `${scope} ${s}`;
};

export const scopeCssText = (css: string, scopeClass: string): string => {  const scope = `.${scopeClass}`;
  let out = '';
  let i = 0;
  const n = css.length;

  /** css[open] 為 '{'，回傳對應 '}' 之後的位置（略過字串與註解） */
  const findBlockEnd = (open: number): number => {
    let depth = 0;
    let j = open;
    let quote = '';
    while (j < n) {
      const ch = css[j];
      if (quote) {
        if (ch === '\\') j++;
        else if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '/' && css[j + 1] === '*') {
        const e = css.indexOf('*/', j + 2);
        j = e === -1 ? n : e + 1;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) return j + 1;
      }
      j++;
    }
    return n;
  };

  while (i < n) {
    const ch = css[i];
    if (/\s/.test(ch)) { out += ch; i++; continue; }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '@') {
      const nameMatch = css.slice(i).match(/^@([\w-]+)/);
      const name = nameMatch ? nameMatch[1].toLowerCase() : '';
      // 讀取 prelude 直到頂層 ';' 或 '{'
      let j = i;
      let quote = '';
      while (j < n && css[j] !== ';' && css[j] !== '{') {
        if (quote) {
          if (css[j] === '\\') j++;
          else if (css[j] === quote) quote = '';
        } else if (css[j] === '"' || css[j] === "'") {
          quote = css[j];
        }
        j++;
      }
      const prelude = css.slice(i, j);
      if (j >= n) { out += prelude; i = j; break; }
      if (css[j] === ';') { out += prelude + ';'; i = j + 1; continue; }
      const end = findBlockEnd(j);
      const inner = css.slice(j + 1, end - 1);
      if (name === 'media' || name === 'supports' || name === 'layer' || name === 'container') {
        out += prelude + '{' + scopeCssText(inner, scopeClass) + '}';
      } else {
        out += prelude + '{' + inner + '}';
      }
      i = end;
      continue;
    }
    // 一般 style rule：讀取選擇器直到頂層 '{'
    let j = i;
    let quote = '';
    let depth = 0;
    while (j < n) {
      const c = css[j];
      if (quote) {
        if (c === '\\') j++;
        else if (c === quote) quote = '';
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '(' || c === '[') {
        depth++;
      } else if (c === ')' || c === ']') {
        depth--;
      } else if ((c === '{' || c === '}') && depth === 0) {
        break;
      }
      j++;
    }
    const selectorText = css.slice(i, j);
    if (j >= n || css[j] !== '{') { out += selectorText; i = j; continue; }
    const end = findBlockEnd(j);
    const scoped = splitSelectors(selectorText)
      .map((s) => scopeOneSelector(s, scope))
      .join(',');
    out += scoped + css.slice(j, end);
    i = end;
  }
  return out;
};

/**
 * 把 HTML 內每個 inline <script> 包進 IIFE，並用 Proxy 把 document 的
 * 查詢方法限定在文件容器 `.scopeClass` 內。用途與 scopeCssText 相同：
 * - 避免多份文件合併時，各範本頂層 `let i` 等重複宣告導致整段 script 編譯失敗
 * - 避免 DOMContentLoaded 腳本的 `querySelectorAll('.container')` 等
 *   誤傷其他文件的同名 class / 頁碼
 * document.write 在解析期於 IIFE 內呼叫仍會寫入 script 原位，行為不變。
 */
export const scopeInlineScripts = (html: string, scopeClass: string): string =>
  html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs: string, code: string) => {
    if (!code.trim() || /\bsrc\s*=/i.test(attrs)) return match;
    const wrapped = `(function () {
  var __realDoc = window.document;
  var __scope = __realDoc.querySelector('.${scopeClass}') || __realDoc.body;
  var document = new Proxy(__realDoc, {
    get: function (target, prop) {
      if (prop === 'querySelector' || prop === 'querySelectorAll') {
        return function (sel) { return __scope[prop](sel); };
      }
      if (prop === 'getElementById') {
        return function (id) { return __scope.querySelector('#' + id); };
      }
      if (prop === 'body') return __scope;
      var v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });
${code}
})();`;
    return `<script${attrs}>${wrapped}</script>`;
  });

/**
 * 把接近紙張高度的固定 `height: Nmm` 改寫為 `min-height: Nmm`。
 * 原因：固定高度的容器（特別是 flex）在具名 @page 的分頁邊界上屬於
 * 「不可分割盒」，Chrome 會裁掉其溢出內容，並連帶破壞整份合併文件
 * 其他文件的自然分頁；min-height 讓容器可增長、可正常跨頁，
 * 而內容不足一頁時視覺與固定高度完全一致。
 * 只處理 ≥150mm 的頁面級容器，簽名行等小高度不動。
 */
export const unfixPageHeights = (css: string): string =>
  css.replace(/(?<![-a-zA-Z])height:\s*(\d+(?:\.\d+)?)mm/gi, (match, num: string) =>
    parseFloat(num) >= 150 ? `min-height: ${num}mm` : match
  );
