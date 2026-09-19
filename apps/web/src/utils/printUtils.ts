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
 * 同時將每份文件嘅 fixed logo 同打孔指引（.punch-guide-fixed）換成逐頁 absolute
 * 副本。必須轉換嘅情況：
 * - **雙面**：背面要轉邊（直向打右邊、橫向打底邊），fixed 做唔到逐頁轉邊；
 *   補白頁亦唔應出現 logo/圓圈。
 * - **非雙面多份合併**：每份文件各有自己嘅 fixed 圓圈/logo，Chrome 列印時 fixed
 *   元素會喺成個合併文件嘅**每一頁**重複——直向文件會見到橫向文件嘅孔位、多份
 *   文件嘅 logo 疊埋移位（單份文件冇交叉污染，先至可以安全用 fixed 原生重複）。
 * 非雙面轉換唔補空白頁；有打孔圈嘅文件背面孔位照樣鏡像（雙面裝訂係實體事實），
 * 純 logo 文件全部頁維持正面位（logo 右上）。
 * 副本放喺每頁開頭嘅頁元素（未 fragmented，absolute 定位先精準）入面嘅零尺寸
 * absolute 載體；頁內座標 = 紙面目標（圓圈鏡像、logo 唔鏡像）− 頁元素實量紙面
 * 偏移，y 要換算做 wrapper 全局（k × 內容盒高 + 頁內 y）先唔會變負數竄頁。頁元素
 * 盒外嘅副本（overflow:hidden 會裁）同搵唔到頁首元素嘅頁，退回 wrapper 級 clone
 * （fragmented 容器 absolute 喺部分 Chrome 有偏移，殘缺好過冇）。
 */
export const padOddPageDocuments = (
  iframeDoc: Document,
  wrappers: { selector: string; config: PageConfig; pageName?: string }[],
  allCssText: string,
  duplexPadding = true
): void => {
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

    // 非雙面單份文件：打孔指引/logo 維持 fixed 原生每頁重複（無交叉污染，座標
    // 精準——injectPunchGuide 已經喺 body 加 overflow-x:clip 保證 fixed 垂直座標），
    // 所以「逐頁 absolute 轉換」喺後面按 shouldConvert 閘住；但頁首上出血補償
    // 係版式修正，所有模式都要行（單面多頁文件第 2 頁起一樣會貼紙頂）。
    const paper = pagePaperSizeMm(config);
    const landscape = config.orientation === 'landscape';
    const [mtFinal, , , mlFinal] = normalizeMargin(config.margin).split(/\s+/).map(cssLengthToMm);
    const punchEls = Array.from(wrapper.querySelectorAll<HTMLElement>('.punch-guide-fixed'));
    const logoEls = Array.from(wrapper.querySelectorAll<HTMLElement>('img.admission-page-logo'));
    // 有打孔圈嘅文件係雙面裝訂表格：背面孔位喺另一邊係實體事實，唔跟
    // 「雙面補白頁」checkbox——呢類文件一定要轉換先可以逐頁鏡像孔位
    const shouldConvert = duplexPadding || wrappers.length >= 2 || punchEls.length > 0;
    const duplex = duplexPadding; // 非雙面轉換：唔補空白頁（孔位鏡像照做，見 back 註解）

    // fixed 圓圈/logo 換成逐頁 absolute 副本（背面鏡像轉邊；補白頁自然冇）。
    // 主機制：每頁開頭嘅 in-flow 頁元素（未 fragmented，定位精準）入面嘅零尺寸
    // absolute 載體。圓圈喺每張紙嘅位置固定（直向 x 隻頁數鏡像去右、橫向 y 鏡像去底），
    // 所以頁內座標 = 紙面目標 − 頁元素紙面偏移（實量 rect），再除 ancestor zoom。
    // 頁元素盒外（如託管書正面孔位喺 20mm 讓位區左邊）會俾 overflow:hidden 裁剪，
    // 呢啲副本改用 wrapper 級（fragmented 容器 absolute 喺部分 Chrome 有偏移，殘缺好過冇）。
    if (punchEls.length > 0 || logoEls.length > 0) {
      wrapper.style.position = 'relative';
      const wRect = wrapper.getBoundingClientRect();

      const forcedBreakAfter = (el: HTMLElement): boolean => {
        const cs = win.getComputedStyle(el);
        return isForcedBreak(cs.pageBreakAfter) || isForcedBreak((cs as CSSStyleDeclaration & { breakAfter?: string }).breakAfter ?? '');
      };
      const forcedBreakBefore = (el: HTMLElement): boolean => {
        const cs = win.getComputedStyle(el);
        return isForcedBreak(cs.pageBreakBefore) || isForcedBreak((cs as CSSStyleDeclaration & { breakBefore?: string }).breakBefore ?? '');
      };

      // 檢測頁首元素（每頁開頭嘅 in-flow 直接子元素）：
      // 順序追蹤——強制分頁（break-before / 上一個 break-after）= 新頁；
      // 否則 offsetTop − 基線 ≈ k × 內容盒高（±3mm）= 自然滿版頁（如託管書 297mm 容器）。
      // 基線 = 第一個 in-flow 子元素嘅 offsetTop：logo 補償會喺 body 加 padding-top
      // （原 mt，如 5mm），令第一頁 offsetTop 唔係 0——第一個 in-flow 子元素定義上
      // 必定喺第 0 頁，用佢做基線先唔會被呢個 padding 整死。
      // 讓位後高度縮咗嘅頁（如急症室記錄 175mm）offsetTop 對唔上 k × 內容高，
      // 靠強制分頁先搵到，所以兩條規則都要有。
      const used = new Set<number>();
      const carriers: { el: HTMLElement; k: number }[] = [];
      let prevK = -1;
      let prevBreakAfter = false;
      let baseTopPx: number | null = null;
      Array.from(wrapper.children).forEach((child) => {
        const el = child as HTMLElement;
        if (!(el instanceof win.HTMLElement)) return;
        if (el.classList.contains('punch-guide-fixed') || el.classList.contains('admission-page-logo')) return;
        if (win.getComputedStyle(el).display === 'none') return; // 隱藏元素（如範本嘅 .no-print 按鈕）唔會係頁首
        if (baseTopPx === null) baseTopPx = el.offsetTop;
        const relTop = el.offsetTop - baseTopPx;
        const kGeo = Math.round(relTop / contentHeightPx);
        let k = -1;
        if (prevK >= 0 && (forcedBreakBefore(el) || prevBreakAfter)) k = prevK + 1;
        else if (prevK === -1) k = 0; // 第一個 in-flow 子元素必定喺第 0 頁
        else if (kGeo > prevK && Math.abs(relTop - kGeo * contentHeightPx) <= 3 * PX_PER_MM) k = kGeo;
        prevBreakAfter = forcedBreakAfter(el);
        if (k < 0 || k >= pageCount || used.has(k)) return;
        used.add(k);
        carriers.push({ el, k });
        prevK = k;
      });

      const dia = parseFloat(punchEls[0]?.style.width || '6') || 6;
      // 雙面背面內容讓位嘅原始左 margin（歸零前，由 punchGuide 記錄喺 data-orig-*）
      const origMl = parseFloat(punchEls[0]?.dataset.origMl || '0') || 0;
      // 「雙面文件 = 內容相同」嘅表格（如護理及治療記錄）：背面內容唔讓位
      // （打孔圈照樣鏡像去右邊對齊實體孔位）
      const punchNoShift = punchEls[0]?.dataset.duplexShift === 'off';
      // 打孔讓位實際 baseline：內容而家坐喺 body padding（打孔區 20mm）之後
      const wrapperPadLeftMm = parseFloat(win.getComputedStyle(wrapper).paddingLeft) / PX_PER_MM;
      const wrapperPadTopMm = parseFloat(win.getComputedStyle(wrapper).paddingTop) / PX_PER_MM;
      const targets: { x: number; y: number; w: number; h: number | null; mirror: boolean }[] = [];
      punchEls.forEach((src) => {
        const px = parseFloat(src.dataset.paperLeft || '0') || 0;
        const py = parseFloat(src.dataset.paperTop || '0') || 0;
        targets.push({ x: px, y: py, w: dia, h: dia, mirror: true });
      });
      logoEls.forEach(() => {
        targets.push({ x: paper.w - LOGO_EDGE_MM - 32, y: LOGO_EDGE_MM, w: 32, h: null, mirror: false });
      });

      const wrapperClone = (src: HTMLElement, tx: number, ty: number, wMm: number, hMm: number | null, k: number) => {
        // wrapper 級副本：wrapper 邊界 = 頁內容原點；第 k 頁 = k × 內容盒高 + 頁內座標
        const clone = src.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.boxSizing = 'border-box';
        clone.style.width = `${wMm.toFixed(2)}mm`;
        if (hMm !== null) clone.style.height = `${hMm.toFixed(2)}mm`;
        clone.style.left = `${(tx - mlFinal).toFixed(2)}mm`;
        clone.style.top = `${(k * contentHeightMm + ty - mtFinal).toFixed(2)}mm`;
        wrapper.appendChild(clone);
      };

      // 頁首上出血補償（所有列印模式都做）：logo 歸零化將 @page 上 margin 轉咗做
      // wrapper padding-top，但 CSS 分頁時 padding 只喺第 0 頁 fragment 生效，
      // 第 k≥1 頁內容會貼紙頂。逐個頁首元素補返相同 padding-top。
      // 用 padding（唔係 margin）避開分頁邊界嘅 margin 截斷語義；border-box 且有
      // 高度限制嘅容器（如 .page min-height）padding 喺盒內消化、唔加高度；
      // 其他容器要有餘量先加，唔夠位就跳過（保持現狀好過超頁）
      if (carriers.length > 0 && wrapperPadTopMm > 0.01) {
        carriers.forEach(({ el, k }) => {
          if (k === 0) return;
          const csEl = win.getComputedStyle(el);
          const elH = el.getBoundingClientRect().height / PX_PER_MM;
          const heightConstrained = csEl.boxSizing === 'border-box' &&
            ((csEl.minHeight !== '0px' && csEl.minHeight !== 'none') || csEl.height !== 'auto');
          if (heightConstrained || elH + wrapperPadTopMm <= contentHeightMm - 1) {
            const existingTopMm = parseFloat(csEl.paddingTop) / PX_PER_MM || 0;
            el.style.paddingTop = `${(existingTopMm + wrapperPadTopMm).toFixed(2)}mm`;
          }
        });
      }

      // 非雙面、單份、無打孔圈：logo 維持 fixed 原生每頁重複，唔做逐頁轉換（上出血已補）
      if (!shouldConvert) return;

      if (carriers.length > 0) {
        carriers.forEach(({ el, k }) => {
          if (win.getComputedStyle(el).position === 'static') el.style.position = 'relative';
          // 背面（雙數頁）打孔喺另一邊（直向右、橫向底）——內容讓位方向要同孔位相反，
          // 否則內容偏向孔位（打孔會打穿內容）。正面靠 wrapper padding（打孔區 20mm）
          // 讓位；背面要還原返文件嘅原始左/上出血（淨係避開打孔區，唔係推到貼紙邊），
          // 所以偏移量 = 原 margin − 讓位 baseline。無打孔指引嘅文件（純 logo）唔郁。
          // 非雙面轉換全部頁當正面：唔鏡像、唔移位。
          const back = k % 2 === 1; // 有打孔圈嘅文件係雙面表格：背面孔位鏡像係實體事實，唔跟補白頁 checkbox
          if (back && punchEls.length > 0 && !punchNoShift && !landscape) {
            // 背面內容讓位（直向）：打孔喺右，內容向左移，左邊出血還原做文件
            // 原始 margin（淨係避開打孔區，唔係推到貼紙邊）。橫向唔郁：分頁座標係
            // 跨頁連續嘅，任何垂直移位（margin/relative）都會令內容跨過分頁界，
            // 將下一頁標題拉返上上一頁底（孤兒頁）；橫向背面孔喺底，內容盒經已
            // 由 min-height 縮減避開（見 punchGuide），唔使再郁
            const shiftMm = origMl - wrapperPadLeftMm;
            if (Math.abs(shiftMm) > 0.01) {
              el.style.marginLeft = `${shiftMm.toFixed(2)}mm`;
            }
          }
          const elRect = el.getBoundingClientRect();
          const elPaperX = mlFinal + (elRect.left - wRect.left) / PX_PER_MM;
          const elW = elRect.width / PX_PER_MM;
          const elH = elRect.height / PX_PER_MM;
          let zoom = 1;
          let n: HTMLElement | null = el;
          while (n && n !== wrapper) {
            const zz = parseFloat((win.getComputedStyle(n).zoom as unknown as string) || '1');
            if (zz > 0 && zz !== 1) zoom *= zz;
            n = n.parentElement;
          }
          // 裁剪檢查：頁元素同 wrapper 之間有冇 overflow 裁剪（孔位喺盒外先有意義）
          const clippedByAncestor = (): boolean => {
            let a: HTMLElement | null = el;
            while (a && a !== wrapper) {
              const cs = win.getComputedStyle(a);
              if (/hidden|clip|scroll|auto/.test(cs.overflowX) || /hidden|clip|scroll|auto/.test(cs.overflowY)) return true;
              a = a.parentElement;
            }
            return false;
          };
          const clips = clippedByAncestor();
          const carrier = iframeDoc.createElement('div');
          carrier.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;';
          el.appendChild(carrier);
          const place = (src: HTMLElement, t: { x: number; y: number; w: number; h: number | null; mirror: boolean }) => {
            // 背面鏡像（只限圓圈）：直向以紙寬鏡 x（打右邊）；橫向以紙高鏡 y（打底邊）；
            // logo 每頁右上角唔鏡像
            const tx = back && t.mirror && !landscape ? paper.w - t.x - t.w : t.x;
            const ty = back && t.mirror && landscape ? paper.h - t.y - (t.h ?? 0) : t.y;
            // 頁首元素（carrier）必定喺所屬頁內容頂（wrapper 每頁 fragment 由 @page
            // 上 margin + wrapper padding-top 開始），所以頁內 y = 紙面目標 − mt −
            // wrapper padding-top——直接用紙面座標，唔好靠 screen offsetTop 換算
            // （screen 用自然高度堆疊、print 有分頁擴張，容器高度≠內容盒高時會錯，
            // 如急症室記錄 175mm 容器喺 205mm 內容盒，舊公式偏差 10mm/頁）。
            // x 繼續用實量 elPaperX：背面內容 margin-left 偏移後，logo 要跟返紙面座標。
            const localX = (tx - elPaperX) / zoom;
            // wrapper padding-top 只在第 0 頁生效（padding 喺 wrapper 開頭一次過），
            // 第 k 頁由該頁 content 頂重新開始，唔會每頁重複減 padTop
            const localY = (ty - mtFinal - (k === 0 ? wrapperPadTopMm : 0)) / zoom;
            const w = t.w / zoom;
            const h = t.h === null ? null : t.h / zoom;
            const fits = localX >= -0.5 && localY >= -0.5 &&
              localX + w <= elW / zoom + 0.5 && (h === null || localY + h <= elH / zoom + 0.5);
            // 負值座標（超出頁首元素頂/左）喺 Chrome 列印會被丟棄或竄頁（logo 補償
            // padding 令第 0 頁 carrier 低於紙面原點時 localY 會變負），必須轉
            // wrapper 級副本；右/下方溢出無裁剪祖先時 carrier 副本仍正常繪出
            if (!fits && (clips || localX < 0 || localY < 0)) {
              wrapperClone(src, tx, ty, t.w, t.h, k);
              return;
            }
            const clone = src.cloneNode(true) as HTMLElement;
            clone.style.position = 'absolute';
            clone.style.boxSizing = 'border-box';
            clone.style.width = `${w.toFixed(2)}mm`;
            if (h !== null) clone.style.height = `${h.toFixed(2)}mm`;
            clone.style.left = `${localX.toFixed(2)}mm`;
            clone.style.top = `${localY.toFixed(2)}mm`;
            if (clone.style.right !== undefined) clone.style.right = 'auto'; // logo 範本 CSS 有 right:2mm
            carrier.appendChild(clone);
          };
          punchEls.forEach((src, i) => place(src, targets[i]));
          logoEls.forEach((src, i) => place(src, targets[punchEls.length + i]));
        });
        // 冇頁首元素嘅頁（純流動內容跨頁，如健康評估/活動記錄表）：每頁補返
        // wrapper 級 logo 同圓圈副本（至少齊件；位置精度不如載體方案）
        for (let k = 0; k < pageCount; k++) {
          if (used.has(k)) continue;
          const back = k % 2 === 1; // 有打孔圈嘅文件係雙面表格：背面孔位鏡像係實體事實，唔跟補白頁 checkbox
          targets.forEach((t, i) => {
            const src = i < punchEls.length ? punchEls[i] : logoEls[i - punchEls.length];
            const tx = back && t.mirror && !landscape ? paper.w - t.x - t.w : t.x;
            const ty = back && t.mirror && landscape ? paper.h - t.y - (t.h ?? 0) : t.y;
            wrapperClone(src, tx, ty, t.w, t.h, k);
          });
        }
        punchEls.forEach((el) => el.remove());
        logoEls.forEach((el) => el.remove());

        // wrapper 級副本（carrier 之外的後備方案）會加喺 wrapper 最尾，令原本係
        // :last-child 嘅最後頁元素（如護理記錄 .page）唔再係最後一個，scoped 嘅
        // page-break-after: always 隨即生效，喺文件末尾無端端多一張空白頁。
        // 後面有下一份文件/補頁 spacer 時佢哋自帶 break-before，撤銷呢個尾部分頁
        // 唔會影響雙面對齊；淨係撤銷 in-flow 最後一個非副本子元素。
        const wrapperKids = Array.from(wrapper.children);
        for (let ci = wrapperKids.length - 1; ci >= 0; ci--) {
          const el = wrapperKids[ci] as HTMLElement;
          if (!(el instanceof win.HTMLElement)) continue;
          if (el.classList.contains('punch-guide-fixed') || el.classList.contains('admission-page-logo')) continue;
          const cs = win.getComputedStyle(el);
          if (isForcedBreak(cs.pageBreakAfter) || isForcedBreak((cs as CSSStyleDeclaration & { breakAfter?: string }).breakAfter ?? '')) {
            el.style.pageBreakAfter = 'auto';
            (el.style as CSSStyleDeclaration & { breakAfter?: string }).breakAfter = 'auto';
          }
          break;
        }
      } else {
        // 退化：搵唔到頁首元素（純流動內容），全部 wrapper 級 clone（位置可能偏移）
        punchEls.forEach((src) => {
          const t = targets[punchEls.indexOf(src)];
          for (let k = 0; k < pageCount; k++) {
            const back = k % 2 === 1; // 有打孔圈嘅文件係雙面表格：背面孔位鏡像係實體事實，唔跟補白頁 checkbox
            const tx = back && t.mirror && !landscape ? paper.w - t.x - t.w : t.x;
            const ty = back && t.mirror && landscape ? paper.h - t.y - (t.h ?? 0) : t.y;
            wrapperClone(src, tx, ty, t.w, t.h, k);
          }
          src.remove();
        });
        logoEls.forEach((src) => {
          for (let k = 0; k < pageCount; k++) {
            const t = targets[punchEls.length + logoEls.indexOf(src)];
            wrapperClone(src, t.x, t.y, t.w, t.h, k);
          }
          src.remove();
        });
      }
    }

    if (!duplex) return; // 非雙面唔補空白頁（轉換歸轉換，補頁只屬雙面對齊）
    if (wrappers.length < 2) return; // 單份文件唔使補空白頁（打孔指引轉換上面已做）
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
  // 成個解析都喺 noComments 上面做：idx 同 brace 位置必須用同一份字串，
  // 否則 @page 前面有註釋時（如 injectPunchGuide 注入嘅 style），
  // 去註釋後嘅 idx 套落原字串會搵錷 '{'（跌入前面規則嘅 block）
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const idx = noComments.search(/@page(?:\s+[\w-]+)?\s*\{/i);
  if (idx === -1) return null;
  const braceIdx = noComments.indexOf('{', idx);
  if (braceIdx === -1) return null;
  let depth = 0;
  let quote = '';
  let j = braceIdx;
  while (j < noComments.length) {
    const ch = noComments[j];
    if (quote) {
      if (ch === '\\') j++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '/' && noComments[j + 1] === '*') {
      const end = noComments.indexOf('*/', j + 2);
      j = end === -1 ? noComments.length : end + 1;
      continue;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return noComments.slice(braceIdx + 1, j);
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
      // border-box：logo 文件嘅 @page 上/右 margin 已被 injectPageLogo 歸零並以
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
      // border-box：logo 文件嘅 @page 上/右 margin 已被 injectPageLogo 歸零並以
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
