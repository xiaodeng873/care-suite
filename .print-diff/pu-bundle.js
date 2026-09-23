"use strict";
var PrintUtils = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // apps/web/src/utils/printUtils.ts
  var printUtils_exports = {};
  __export(printUtils_exports, {
    LOGO_EDGE_MM: () => LOGO_EDGE_MM,
    MAX_PAGES_PER_IFRAME: () => MAX_PAGES_PER_IFRAME,
    addDays: () => addDays,
    cssLengthToMm: () => cssLengthToMm,
    dateChunks: () => dateChunks,
    extractBodyHtml: () => extractBodyHtml,
    extractBreakSelectors: () => extractBreakSelectors,
    extractPageConfig: () => extractPageConfig,
    groupPagesByConfig: () => groupPagesByConfig,
    normalizeMargin: () => normalizeMargin,
    padOddPageDocuments: () => padOddPageDocuments,
    pageContentBoxMm: () => pageContentBoxMm,
    pagePaperSizeMm: () => pagePaperSizeMm,
    printCombinedHtml: () => printCombinedHtml,
    printGroupedHtml: () => printGroupedHtml,
    stripPageBlocks: () => stripPageBlocks,
    unwrapPrintMedia: () => unwrapPrintMedia
  });

  // apps/web/src/utils/cssScope.ts
  var splitSelectors = (selectorText) => {
    const parts = [];
    let depth = 0;
    let cur = "";
    let quote = "";
    for (const ch of selectorText) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  };
  var scopeOneSelector = (raw, scope) => {
    let s = raw.trim();
    if (!s) return s;
    s = s.replace(/^html(?=[\s>+~:.#[\]]|$)/, "").trimStart();
    if (!s) return scope;
    const bodyMatch = s.match(/^body(?=[\s>+~:.#[\]]|$)/);
    if (bodyMatch) {
      const rest = s.slice(4);
      if (!rest) return scope;
      if (/^[\s>+~]/.test(rest)) return `${scope} ${rest.trimStart()}`;
      return `${scope}${rest}`;
    }
    return `${scope} ${s}`;
  };
  var scopeCssText = (css, scopeClass) => {
    const scope = `.${scopeClass}`;
    let out = "";
    let i = 0;
    const n = css.length;
    const findBlockEnd = (open) => {
      let depth = 0;
      let j = open;
      let quote = "";
      while (j < n) {
        const ch = css[j];
        if (quote) {
          if (ch === "\\") j++;
          else if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === "/" && css[j + 1] === "*") {
          const e = css.indexOf("*/", j + 2);
          j = e === -1 ? n : e + 1;
        } else if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0) return j + 1;
        }
        j++;
      }
      return n;
    };
    while (i < n) {
      const ch = css[i];
      if (/\s/.test(ch)) {
        out += ch;
        i++;
        continue;
      }
      if (ch === "/" && css[i + 1] === "*") {
        const end2 = css.indexOf("*/", i + 2);
        const stop = end2 === -1 ? n : end2 + 2;
        out += css.slice(i, stop);
        i = stop;
        continue;
      }
      if (ch === "@") {
        const nameMatch = css.slice(i).match(/^@([\w-]+)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : "";
        let j2 = i;
        let quote2 = "";
        while (j2 < n && css[j2] !== ";" && css[j2] !== "{") {
          if (quote2) {
            if (css[j2] === "\\") j2++;
            else if (css[j2] === quote2) quote2 = "";
          } else if (css[j2] === '"' || css[j2] === "'") {
            quote2 = css[j2];
          }
          j2++;
        }
        const prelude = css.slice(i, j2);
        if (j2 >= n) {
          out += prelude;
          i = j2;
          break;
        }
        if (css[j2] === ";") {
          out += prelude + ";";
          i = j2 + 1;
          continue;
        }
        const end2 = findBlockEnd(j2);
        const inner = css.slice(j2 + 1, end2 - 1);
        if (name === "media" || name === "supports" || name === "layer" || name === "container") {
          out += prelude + "{" + scopeCssText(inner, scopeClass) + "}";
        } else {
          out += prelude + "{" + inner + "}";
        }
        i = end2;
        continue;
      }
      let j = i;
      let quote = "";
      let depth = 0;
      while (j < n) {
        const c = css[j];
        if (quote) {
          if (c === "\\") j++;
          else if (c === quote) quote = "";
        } else if (c === '"' || c === "'") {
          quote = c;
        } else if (c === "(" || c === "[") {
          depth++;
        } else if (c === ")" || c === "]") {
          depth--;
        } else if ((c === "{" || c === "}") && depth === 0) {
          break;
        }
        j++;
      }
      const selectorText = css.slice(i, j);
      if (j >= n || css[j] !== "{") {
        out += selectorText;
        i = j;
        continue;
      }
      const end = findBlockEnd(j);
      const scoped = splitSelectors(selectorText).map((s) => scopeOneSelector(s, scope)).join(",");
      out += scoped + css.slice(j, end);
      i = end;
    }
    return out;
  };
  var scopeInlineScripts = (html, scopeClass) => html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, code) => {
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
    return `<script${attrs}>${wrapped}<\/script>`;
  });

  // apps/web/src/utils/printUtils.ts
  var extractBodyHtml = (html) => html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? "";
  var PX_PER_MM = 96 / 25.4;
  var LOGO_EDGE_MM = 2;
  var PAGE_SIZES_MM = {
    a4: [210, 297],
    a5: [148, 210],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6]
  };
  var cssLengthToMm = (raw) => {
    const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)(mm|cm|in|pt|px)?$/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    switch ((m[2] || "mm").toLowerCase()) {
      case "cm":
        return n * 10;
      case "in":
        return n * 25.4;
      case "pt":
        return n * 25.4 / 72;
      case "px":
        return n * 25.4 / 96;
      default:
        return n;
    }
  };
  var pagePaperSizeMm = (config) => {
    const [pw, ph] = PAGE_SIZES_MM[config.size.toLowerCase()] ?? PAGE_SIZES_MM.a4;
    return config.orientation === "landscape" ? { w: ph, h: pw } : { w: pw, h: ph };
  };
  var pageContentBoxMm = (config) => {
    const paper = pagePaperSizeMm(config);
    const [mt, mr, mb, ml] = normalizeMargin(config.margin).split(/\s+/).map(cssLengthToMm);
    return { w: paper.w - ml - mr, h: paper.h - mt - mb };
  };
  var BREAK_DECL_RE = /(?:page-)?break-(?:before|after)\s*:\s*(always|page)\b/i;
  var RULE_RE = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  var unwrapPrintMedia = (css) => {
    let out = "";
    let i = 0;
    const n = css.length;
    while (i < n) {
      const ch = css[i];
      if (ch === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        const stop = end === -1 ? n : end + 2;
        out += css.slice(i, stop);
        i = stop;
        continue;
      }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < n) {
          if (css[j] === "\\") j += 2;
          else if (css[j] === ch) {
            j++;
            break;
          } else j++;
        }
        out += css.slice(i, j);
        i = j;
        continue;
      }
      if (ch === "@" && /^@media\b/i.test(css.slice(i, i + 10))) {
        const braceIdx = css.indexOf("{", i);
        if (braceIdx === -1) {
          out += css.slice(i);
          break;
        }
        const prelude = css.slice(i, braceIdx + 1);
        let depth = 0;
        let j = braceIdx;
        let quote = "";
        for (; j < n; j++) {
          const c = css[j];
          if (quote) {
            if (c === "\\") j++;
            else if (c === quote) quote = "";
          } else if (c === '"' || c === "'") {
            quote = c;
          } else if (c === "/" && css[j + 1] === "*") {
            const e = css.indexOf("*/", j + 2);
            j = e === -1 ? n - 1 : e + 1;
          } else if (c === "{") {
            depth++;
          } else if (c === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        const inner = css.slice(braceIdx + 1, j);
        out += /\bprint\b/i.test(prelude) && !/\bscreen\b/i.test(prelude) ? inner : prelude + inner + "}";
        i = j + 1;
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  };
  var extractBreakSelectors = (cssText) => {
    const selectors = [];
    RULE_RE.lastIndex = 0;
    let m;
    while (m = RULE_RE.exec(cssText)) {
      if (!BREAK_DECL_RE.test(m[2])) continue;
      m[1].split(",").forEach((s) => {
        const t = s.trim();
        if (t) selectors.push(t);
      });
    }
    return selectors;
  };
  var isForcedBreak = (value) => /^(always|page)$/.test((value || "").trim());
  var measurePrintedPageCount = (win, wrapper, contentHeightPx, breakSelectors) => {
    const wRect = wrapper.getBoundingClientRect();
    const boundaries = [];
    if (breakSelectors.length) {
      let els;
      try {
        els = wrapper.querySelectorAll(breakSelectors.join(","));
      } catch {
        els = wrapper.querySelectorAll(":scope");
      }
      els.forEach((el) => {
        const cs = win.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (isForcedBreak(cs.pageBreakBefore) || isForcedBreak(cs.breakBefore ?? "")) {
          boundaries.push(r.top);
        }
        if (isForcedBreak(cs.pageBreakAfter) || isForcedBreak(cs.breakAfter ?? "")) {
          boundaries.push(r.bottom);
        }
      });
    }
    boundaries.sort((a, b) => a - b);
    const spanPages = (start, end) => {
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
  var padOddPageDocuments = (iframeDoc, wrappers, allCssText, duplexPadding = true) => {
    const win = iframeDoc.defaultView;
    if (!win) return;
    const breakSelectors = extractBreakSelectors(allCssText);
    wrappers.forEach(({ selector, config, pageName }, idx) => {
      const wrapper = iframeDoc.querySelector(selector);
      if (!wrapper) return;
      const contentHeightMm = pageContentBoxMm(config).h;
      const contentHeightPx = contentHeightMm * PX_PER_MM;
      if (contentHeightPx <= 0) return;
      const pageCount = measurePrintedPageCount(win, wrapper, contentHeightPx, breakSelectors);
      const paper = pagePaperSizeMm(config);
      const landscape = config.orientation === "landscape";
      const [mtFinal, , , mlFinal] = normalizeMargin(config.margin).split(/\s+/).map(cssLengthToMm);
      const punchEls = Array.from(wrapper.querySelectorAll(".punch-guide-fixed"));
      const logoEls = Array.from(wrapper.querySelectorAll("img.admission-page-logo"));
      const shouldConvert = duplexPadding || wrappers.length >= 2 || punchEls.length > 0;
      const duplex = duplexPadding;
      if (punchEls.length > 0 || logoEls.length > 0) {
        wrapper.style.position = "relative";
        const wRect = wrapper.getBoundingClientRect();
        const forcedBreakAfter = (el) => {
          const cs = win.getComputedStyle(el);
          return isForcedBreak(cs.pageBreakAfter) || isForcedBreak(cs.breakAfter ?? "");
        };
        const forcedBreakBefore = (el) => {
          const cs = win.getComputedStyle(el);
          return isForcedBreak(cs.pageBreakBefore) || isForcedBreak(cs.breakBefore ?? "");
        };
        const used = /* @__PURE__ */ new Set();
        const carriers = [];
        let prevK = -1;
        let prevBreakAfter = false;
        let baseTopPx = null;
        Array.from(wrapper.children).forEach((child) => {
          const el = child;
          if (!(el instanceof win.HTMLElement)) return;
          if (el.classList.contains("punch-guide-fixed") || el.classList.contains("admission-page-logo")) return;
          if (win.getComputedStyle(el).display === "none") return;
          if (baseTopPx === null) baseTopPx = el.offsetTop;
          const relTop = el.offsetTop - baseTopPx;
          const kGeo = Math.round(relTop / contentHeightPx);
          let k = -1;
          if (prevK >= 0 && (forcedBreakBefore(el) || prevBreakAfter)) k = prevK + 1;
          else if (prevK === -1) k = 0;
          else if (kGeo > prevK && Math.abs(relTop - kGeo * contentHeightPx) <= 3 * PX_PER_MM) k = kGeo;
          prevBreakAfter = forcedBreakAfter(el);
          if (k < 0 || k >= pageCount || used.has(k)) return;
          used.add(k);
          carriers.push({ el, k });
          prevK = k;
        });
        const dia = parseFloat(punchEls[0]?.style.width || "6") || 6;
        const origMl = parseFloat(punchEls[0]?.dataset.origMl || "0") || 0;
        const punchNoShift = punchEls[0]?.dataset.duplexShift === "off";
        const wrapperPadLeftMm = parseFloat(win.getComputedStyle(wrapper).paddingLeft) / PX_PER_MM;
        const wrapperPadTopMm = parseFloat(win.getComputedStyle(wrapper).paddingTop) / PX_PER_MM;
        const targets = [];
        punchEls.forEach((src) => {
          const px = parseFloat(src.dataset.paperLeft || "0") || 0;
          const py = parseFloat(src.dataset.paperTop || "0") || 0;
          targets.push({ x: px, y: py, w: dia, h: dia, mirror: true });
        });
        logoEls.forEach(() => {
          targets.push({ x: paper.w - LOGO_EDGE_MM - 32, y: LOGO_EDGE_MM, w: 32, h: null, mirror: false });
        });
        const wrapperClone = (src, tx, ty, wMm, hMm, k) => {
          const clone = src.cloneNode(true);
          clone.style.position = "absolute";
          clone.style.boxSizing = "border-box";
          clone.style.width = `${wMm.toFixed(2)}mm`;
          if (hMm !== null) clone.style.height = `${hMm.toFixed(2)}mm`;
          clone.style.left = `${(tx - mlFinal).toFixed(2)}mm`;
          clone.style.top = `${(k * contentHeightMm + ty - mtFinal).toFixed(2)}mm`;
          wrapper.appendChild(clone);
        };
        if (carriers.length > 0 && wrapperPadTopMm > 0.01) {
          carriers.forEach(({ el, k }) => {
            if (k === 0) return;
            const csEl = win.getComputedStyle(el);
            const elH = el.getBoundingClientRect().height / PX_PER_MM;
            const heightConstrained = csEl.boxSizing === "border-box" && (csEl.minHeight !== "0px" && csEl.minHeight !== "none" || csEl.height !== "auto");
            if (heightConstrained || elH + wrapperPadTopMm <= contentHeightMm - 1) {
              const existingTopMm = parseFloat(csEl.paddingTop) / PX_PER_MM || 0;
              el.style.paddingTop = `${(existingTopMm + wrapperPadTopMm).toFixed(2)}mm`;
            }
          });
        }
        if (!shouldConvert) return;
        if (carriers.length > 0) {
          carriers.forEach(({ el, k }) => {
            if (win.getComputedStyle(el).position === "static") el.style.position = "relative";
            const back = k % 2 === 1;
            if (back && punchEls.length > 0 && !punchNoShift && !landscape) {
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
            let n = el;
            while (n && n !== wrapper) {
              const zz = parseFloat(win.getComputedStyle(n).zoom || "1");
              if (zz > 0 && zz !== 1) zoom *= zz;
              n = n.parentElement;
            }
            const clippedByAncestor = () => {
              let a = el;
              while (a && a !== wrapper) {
                const cs = win.getComputedStyle(a);
                if (/hidden|clip|scroll|auto/.test(cs.overflowX) || /hidden|clip|scroll|auto/.test(cs.overflowY)) return true;
                a = a.parentElement;
              }
              return false;
            };
            const clips = clippedByAncestor();
            const carrier = iframeDoc.createElement("div");
            carrier.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;";
            el.appendChild(carrier);
            const place = (src, t) => {
              const tx = back && t.mirror && !landscape ? paper.w - t.x - t.w : t.x;
              const ty = back && t.mirror && landscape ? paper.h - t.y - (t.h ?? 0) : t.y;
              const localX = (tx - elPaperX) / zoom;
              const localY = (ty - mtFinal - (k === 0 ? wrapperPadTopMm : 0)) / zoom;
              const w = t.w / zoom;
              const h = t.h === null ? null : t.h / zoom;
              const fits = localX >= -0.5 && localY >= -0.5 && localX + w <= elW / zoom + 0.5 && (h === null || localY + h <= elH / zoom + 0.5);
              if (!fits && (clips || localX < 0 || localY < 0)) {
                wrapperClone(src, tx, ty, t.w, t.h, k);
                return;
              }
              const clone = src.cloneNode(true);
              clone.style.position = "absolute";
              clone.style.boxSizing = "border-box";
              clone.style.width = `${w.toFixed(2)}mm`;
              if (h !== null) clone.style.height = `${h.toFixed(2)}mm`;
              clone.style.left = `${localX.toFixed(2)}mm`;
              clone.style.top = `${localY.toFixed(2)}mm`;
              if (clone.style.right !== void 0) clone.style.right = "auto";
              carrier.appendChild(clone);
            };
            punchEls.forEach((src, i) => place(src, targets[i]));
            logoEls.forEach((src, i) => place(src, targets[punchEls.length + i]));
          });
          for (let k = 0; k < pageCount; k++) {
            if (used.has(k)) continue;
            const back = k % 2 === 1;
            targets.forEach((t, i) => {
              const src = i < punchEls.length ? punchEls[i] : logoEls[i - punchEls.length];
              const tx = back && t.mirror && !landscape ? paper.w - t.x - t.w : t.x;
              const ty = back && t.mirror && landscape ? paper.h - t.y - (t.h ?? 0) : t.y;
              wrapperClone(src, tx, ty, t.w, t.h, k);
            });
          }
          punchEls.forEach((el) => el.remove());
          logoEls.forEach((el) => el.remove());
          const wrapperKids = Array.from(wrapper.children);
          for (let ci = wrapperKids.length - 1; ci >= 0; ci--) {
            const el = wrapperKids[ci];
            if (!(el instanceof win.HTMLElement)) continue;
            if (el.classList.contains("punch-guide-fixed") || el.classList.contains("admission-page-logo")) continue;
            const cs = win.getComputedStyle(el);
            if (isForcedBreak(cs.pageBreakAfter) || isForcedBreak(cs.breakAfter ?? "")) {
              el.style.pageBreakAfter = "auto";
              el.style.breakAfter = "auto";
            }
            break;
          }
        } else {
          punchEls.forEach((src) => {
            const t = targets[punchEls.indexOf(src)];
            for (let k = 0; k < pageCount; k++) {
              const back = k % 2 === 1;
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
      if (!duplex) return;
      if (wrappers.length < 2) return;
      if (idx === wrappers.length - 1) return;
      if (pageCount % 2 === 0) return;
      const spacer = iframeDoc.createElement("div");
      spacer.className = `print-doc-blank-${idx}`;
      spacer.style.cssText = `height:0;${pageName ? `page:${pageName};` : ""}`;
      wrapper.insertAdjacentElement("afterend", spacer);
    });
  };
  var waitForLayoutReady = async (win) => {
    const images = Array.from(win.document.images).map(
      (img) => img.complete ? Promise.resolve() : img.decode().catch(() => void 0)
    );
    await Promise.race([
      Promise.all([win.document.fonts?.ready ?? Promise.resolve(), ...images]),
      new Promise((resolve) => setTimeout(resolve, 5e3))
    ]);
  };
  var DEFAULT_PAGE_CONFIG = {
    size: "A4",
    orientation: "portrait",
    margin: "0 0 0 0"
  };
  var normalizeMargin = (margin) => {
    if (!margin) return "0 0 0 0";
    const parts = margin.trim().split(/\s+/);
    if (parts.length === 0) return "0 0 0 0";
    if (parts.length === 1) return `${parts[0]} ${parts[0]} ${parts[0]} ${parts[0]}`;
    if (parts.length === 2) return `${parts[0]} ${parts[1]} ${parts[0]} ${parts[1]}`;
    if (parts.length === 3) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[1]}`;
    return parts.slice(0, 4).join(" ");
  };
  var parsePageBlockDeclarations = (block) => {
    const result = {};
    let i = 0;
    let depth = 0;
    let quote = "";
    let cur = "";
    while (i < block.length) {
      const ch = block[i];
      if (quote) {
        if (ch === "\\") {
          cur += ch;
          i++;
        } else if (ch === quote) {
          cur += ch;
          quote = "";
        }
      } else if (ch === '"' || ch === "'") {
        cur += ch;
        quote = ch;
      } else if (ch === "{" || ch === "(") {
        depth++;
        cur += ch;
      } else if (ch === "}" || ch === ")") {
        depth--;
        cur += ch;
      } else if (ch === ";" && depth === 0) {
        const colon = cur.indexOf(":");
        if (colon !== -1) {
          const key = cur.slice(0, colon).trim();
          const value = cur.slice(colon + 1).trim();
          if (key) result[key] = value;
        }
        cur = "";
      } else {
        cur += ch;
      }
      i++;
    }
    if (cur) {
      const colon = cur.indexOf(":");
      if (colon !== -1) {
        const key = cur.slice(0, colon).trim();
        const value = cur.slice(colon + 1).trim();
        if (key) result[key] = value;
      }
    }
    return result;
  };
  var extractFirstPageBlock = (css) => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const idx = noComments.search(/@page(?:\s+[\w-]+)?\s*\{/i);
    if (idx === -1) return null;
    const braceIdx = noComments.indexOf("{", idx);
    if (braceIdx === -1) return null;
    let depth = 0;
    let quote = "";
    let j = braceIdx;
    while (j < noComments.length) {
      const ch = noComments[j];
      if (quote) {
        if (ch === "\\") j++;
        else if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "/" && noComments[j + 1] === "*") {
        const end = noComments.indexOf("*/", j + 2);
        j = end === -1 ? noComments.length : end + 1;
        continue;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return noComments.slice(braceIdx + 1, j);
        }
      }
      j++;
    }
    return null;
  };
  var MM_TO_MM = 1;
  var CM_TO_MM = 10;
  var IN_TO_MM = 25.4;
  var normalizeSizeFromDimensions = (value) => {
    const match = value.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|in)\s+(\d+(?:\.\d+)?)\s*(mm|cm|in)$/i);
    if (!match) return null;
    const width = parseFloat(match[1]);
    const height = parseFloat(match[3]);
    const unit = match[2].toLowerCase();
    const toMm = unit === "mm" ? MM_TO_MM : unit === "cm" ? CM_TO_MM : IN_TO_MM;
    const wMm = width * toMm;
    const hMm = height * toMm;
    if (Math.abs(wMm - 210) <= 2 && Math.abs(hMm - 297) <= 2 || Math.abs(wMm - 297) <= 2 && Math.abs(hMm - 210) <= 2) {
      return { size: "A4", orientation: wMm > hMm ? "landscape" : "portrait" };
    }
    return null;
  };
  var extractPageConfig = (html) => {
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const css = styleMatches.map((tag) => tag.replace(/<\/?style[^>]*>/gi, "")).join("\n");
    const block = extractFirstPageBlock(css);
    if (!block) return DEFAULT_PAGE_CONFIG;
    const decls = parsePageBlockDeclarations(block);
    const sizeValue = decls.size || "";
    const marginValue = decls.margin || "";
    const orientationValue = decls.orientation || "";
    let size = "A4";
    let orientation = "portrait";
    if (sizeValue) {
      const dim = normalizeSizeFromDimensions(sizeValue);
      if (dim) {
        size = dim.size;
        orientation = dim.orientation;
      } else {
        const tokens = sizeValue.split(/\s+/);
        size = tokens[0] || "A4";
        if (tokens[1] && /^(landscape|portrait)$/i.test(tokens[1])) {
          orientation = tokens[1].toLowerCase();
        }
      }
    }
    if (orientationValue && /^(landscape|portrait)$/i.test(orientationValue)) {
      orientation = orientationValue.toLowerCase();
    }
    const margin = marginValue ? normalizeMargin(marginValue) : "0 0 0 0";
    return { size, orientation, margin };
  };
  var groupPagesByConfig = (pages) => {
    const groups = /* @__PURE__ */ new Map();
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
  var stripPageBlocks = (css) => {
    let out = "";
    let i = 0;
    const n = css.length;
    while (i < n) {
      const ch = css[i];
      if (ch === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        out += css.slice(i, end === -1 ? n : end + 2);
        i = end === -1 ? n : end + 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let j = i + 1;
        while (j < n) {
          if (css[j] === "\\") j += 2;
          else if (css[j] === quote) {
            j++;
            break;
          } else j++;
        }
        out += css.slice(i, j);
        i = j;
        continue;
      }
      if (css.slice(i, i + 5).toLowerCase() === "@page") {
        const braceIdx = css.indexOf("{", i);
        if (braceIdx !== -1) {
          let depth = 0;
          let quote = "";
          let j = braceIdx;
          while (j < n) {
            const c = css[j];
            if (quote) {
              if (c === "\\") j++;
              else if (c === quote) quote = "";
            } else if (c === '"' || c === "'") {
              quote = c;
            } else if (c === "/" && css[j + 1] === "*") {
              const end = css.indexOf("*/", j + 2);
              j = end === -1 ? n : end + 1;
              continue;
            } else if (c === "{") {
              depth++;
            } else if (c === "}") {
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
  var scopeDocumentHtml = (page, scopeClass, pageStrategy = "scope", wrapperStyle = "") => {
    const styleMatches = page.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    let hasBarePageRule = false;
    const scopedStyles = styleMatches.map((styleTag) => {
      const openMatch = styleTag.match(/^<style([^>]*)>([\s\S]*?)<\/style>$/i);
      if (!openMatch) return styleTag;
      const [, attrs, innerCss] = openMatch;
      const processedCss = pageStrategy === "strip" ? stripPageBlocks(innerCss) : innerCss;
      let scopedCss = scopeCssText(processedCss, scopeClass);
      scopedCss = unwrapPrintMedia(scopedCss);
      if (pageStrategy === "scope") {
        scopedCss = scopedCss.replace(/@page\s*\{/g, () => {
          hasBarePageRule = true;
          return `@page ${scopeClass} {`;
        });
      }
      return `<style${attrs}>${scopedCss}</style>`;
    });
    if (pageStrategy === "scope" && hasBarePageRule) {
      scopedStyles.push(`<style>.${scopeClass} { page: ${scopeClass}; }</style>`);
    }
    const bodyMatch = page.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawBody = bodyMatch ? bodyMatch[1].trim() : page.trim();
    const bodyContent = scopeInlineScripts(rawBody, scopeClass);
    return {
      styles: scopedStyles.join("\n"),
      body: `<div class="${scopeClass}"${wrapperStyle ? ` style="${wrapperStyle}"` : ""}>${bodyContent}</div>`
    };
  };
  var printCombinedHtml = (pages, iframeId, sequential = false) => {
    if (pages.length === 0) return;
    if (sequential) {
      let index = 0;
      const printNext = () => {
        while (index < pages.length && !pages[index].trim()) index++;
        if (index >= pages.length) return;
        const old2 = document.getElementById(iframeId);
        if (old2) old2.remove();
        const iframe2 = document.createElement("iframe");
        iframe2.id = iframeId;
        iframe2.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
        document.body.appendChild(iframe2);
        const doc2 = iframe2.contentWindow?.document;
        if (!doc2) return;
        doc2.open();
        doc2.write(pages[index]);
        doc2.close();
        const win2 = iframe2.contentWindow;
        if (!win2) return;
        const current = index;
        index++;
        const cleanup = () => {
          iframe2.remove();
          win2.removeEventListener("afterprint", cleanup);
          printNext();
        };
        win2.addEventListener("afterprint", cleanup);
        setTimeout(() => {
          if (document.body.contains(iframe2)) {
            iframe2.remove();
            printNext();
          }
        }, 5e3);
        setTimeout(() => {
          win2.print();
        }, 300);
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
        ...scopeDocumentHtml(page, `print-doc-${i}`, "scope", `box-sizing:border-box;width:${widthPx.toFixed(1)}px;`)
      };
    });
    const baseCss = `
  /* \u7BC4\u672C\u7684 body{margin:0} \u5DF2\u88AB\u9694\u96E2\u5230\u5BB9\u5668 class\uFF0C\u5916\u5C64 body \u5FC5\u9808\u81EA\u884C\u6B78\u96F6\uFF0C
     \u5426\u5247\u700F\u89BD\u5668\u9810\u8A2D 8px margin \u6703\u6539\u8B8A\u6BCF\u4EFD\u6587\u4EF6\u7684\u7248\u9762\u4F4D\u7F6E\u4E26\u53EF\u80FD\u5C0E\u81F4\u8D85\u9801 */
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  /* \u7BC4\u672C\u81EA\u5E36\u5605\u87A2\u5E55\u5217\u5370\u6309\u9215\u5514\u53EF\u4EE5\u53C3\u8207\u9801\u9AD8\u91CF\u5EA6\uFF08\u4F62\u54CB\u5605 @media print \u5148\u6703\u96B1\u85CF\uFF09 */
  .no-print { display: none !important; }`;
    const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}
</style>
${parts.map((p) => p.styles).join("\n")}
</head>
<body>
${parts.map((p) => p.body).join("\n")}
</body>
</html>`;
    const old = document.getElementById(iframeId);
    if (old) old.remove();
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(combined);
    doc.close();
    const win = iframe.contentWindow;
    if (!win) return;
    const doPrint = async () => {
      try {
        await waitForLayoutReady(win);
        padOddPageDocuments(
          doc,
          parts.map((p, i) => ({ selector: `.print-doc-${i}`, config: p.config })),
          `${baseCss}
${parts.map((p) => p.styles).join("\n")}`
        );
      } catch {
      }
      win.focus();
      win.print();
    };
    if (doc.readyState === "complete") void doPrint();
    else iframe.addEventListener("load", () => void doPrint(), { once: true });
  };
  var MAX_PAGES_PER_IFRAME = 30;
  var printGroupedHtml = (pages, iframeId, duplexPadding = true) => {
    const groups = groupPagesByConfig(pages);
    const batches = [];
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
      const marginPageNames = /* @__PURE__ */ new Map();
      const pageRules = [];
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
        const wrapperStyle = `page: ${pageName};box-sizing:border-box;width:${widthPx.toFixed(1)}px;`;
        return { pageConfig, pageName, ...scopeDocumentHtml(page, `print-doc-${batchIndex}-${i}`, "strip", wrapperStyle) };
      });
      const baseCss = `
  html, body { margin: 0; padding: 0; }
  [class*="print-doc-"] + [class*="print-doc-"] { page-break-before: always; break-before: page; }
  /* \u7BC4\u672C\u81EA\u5E36\u5605\u87A2\u5E55\u5217\u5370\u6309\u9215\u5514\u53EF\u4EE5\u53C3\u8207\u9801\u9AD8\u91CF\u5EA6\uFF08\u4F62\u54CB\u5605 @media print \u5148\u6703\u96B1\u85CF\uFF09 */
  .no-print { display: none !important; }
  @page { size: ${config.size}; margin: 0; }
  ${pageRules.join("\n  ")}`;
      const combined = `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<style>${baseCss}
</style>
${parts.map((p) => p.styles).join("\n")}
</head>
<body>
${parts.map((p) => p.body).join("\n")}
</body>
</html>`;
      const old = document.getElementById(iframeId);
      if (old) old.remove();
      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:none;";
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
        win.removeEventListener("afterprint", cleanup);
        printNext();
      };
      const doPrint = async () => {
        try {
          await waitForLayoutReady(win);
          padOddPageDocuments(
            doc,
            parts.map((p, i) => ({
              selector: `.print-doc-${batchIndex}-${i}`,
              config: { ...p.pageConfig, size: config.size },
              pageName: p.pageName
            })),
            `${baseCss}
${parts.map((p) => p.styles).join("\n")}`,
            duplexPadding
          );
        } catch {
        }
        win.addEventListener("afterprint", cleanup);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            iframe.remove();
            printNext();
          }
        }, 5e3);
        win.focus();
        win.print();
      };
      if (doc.readyState === "complete") void doPrint();
      else iframe.addEventListener("load", () => void doPrint(), { once: true });
    };
    printNext();
  };
  var addDays = (dateStr, n) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  };
  var dateChunks = (startDate, endDate, stepDays) => {
    const chunks = [];
    let cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      chunks.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + stepDays);
    }
    return chunks;
  };
  return __toCommonJS(printUtils_exports);
})();
