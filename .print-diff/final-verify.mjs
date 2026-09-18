// 最終驗證：非雙面 + 雙面，兩個 PDF 都出，量度圓圈同 logo 位置
// 直向：正面圓圈左邊 x≈12（y 108.7/188.7），雙面背面 x≈192；橫向：正面頂 y≈12（x 105.5/185.5），背面底 y≈192
import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const stubDir = path.join(root, '.print-diff/stubs');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'PrintUtils', platform: 'browser',
  plugins: [{
    name: 'stubs',
    setup(build) {
      build.onResolve({ filter: /(^|\/)database$/ }, () => ({ path: path.join(stubDir, 'database.ts') }));
      build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
      build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    },
  }],
});
const iife = result.outputFiles[0].text;
const htmlPath = 'C:/Users/Admin/Desktop/care-suite/.print-diff/harness-batch-nonduplex.html';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { createCanvas } = require('@napi-rs/canvas');

const GRAY_MIN = 2;

const analyze = async (pdfPath) => {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const toMm = (pt) => pt / 72 * 25.4;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 4 });
    const canvas = createCanvas(vp.width, vp.height);
    await p.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const ctx = canvas.getContext('2d');
    const pageWmm = toMm(p.view[2]);
    const pageHmm = toMm(p.view[3]);
    const pxX = vp.width / pageWmm;
    const pxY = vp.height / pageHmm;
    const landscape = pageWmm > pageHmm;
    // 垂直帶（直向用）：x0-x1mm 入面搵灰色虛線嘅 y 中點
    const scanVStrip = (x0mm, x1mm) => {
      const rows = [];
      for (let y = 0; y < canvas.height; y++) {
        const row = ctx.getImageData(Math.round(x0mm * pxX), y, Math.round((x1mm - x0mm) * pxX), 1).data;
        let gray = 0;
        for (let x = 0; x < row.length; x += 4) {
          const r = row[x], g = row[x + 1], b = row[x + 2];
          if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && r > 130 && r < 180) gray++;
        }
        if (gray >= GRAY_MIN) rows.push(y);
      }
      return groupSegments(rows, pxY);
    };
    // 水平帶（橫向用）：y0-y1mm 入面搵灰色虛線嘅 x 中點
    const scanHStrip = (y0mm, y1mm) => {
      const cols = [];
      for (let x = 0; x < canvas.width; x++) {
        const col = ctx.getImageData(x, Math.round(y0mm * pxY), 1, Math.round((y1mm - y0mm) * pxY)).data;
        let gray = 0;
        for (let y = 0; y < col.length; y += 4) {
          const r = col[y], g = col[y + 1], b = col[y + 2];
          if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && r > 130 && r < 180) gray++;
        }
        if (gray >= GRAY_MIN) cols.push(x);
      }
      return groupSegments(cols, pxX);
    };
    // logo：圖像位置
    const ops = await p.getOperatorList();
    let cur = [1, 0, 0, 1, 0, 0]; const stack = [];
    const mul = (m1, m2) => [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]];
    const logos = [];
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j], args = ops.argsArray[j];
      if (fn === pdfjs.OPS.save) stack.push(cur);
      else if (fn === pdfjs.OPS.restore) cur = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === pdfjs.OPS.transform) cur = mul(cur, args);
      else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject)
        logos.push({ x: +toMm(cur[4]).toFixed(1), yTop: +toMm(pageHmm - cur[5]).toFixed(1) });
    }
    out.push({
      page: i, landscape,
      circlesA: landscape ? scanHStrip(9, 19.5) : scanVStrip(9, 19.5),
      circlesB: landscape ? scanHStrip(pageHmm - 19.5, pageHmm - 9) : scanVStrip(pageWmm - 21, pageWmm - 10.5),
      logos,
    });
  }
  return out;
};

function groupSegments(vals, pxPerMm) {
  const segs = []; let s = null, prev = null;
  for (const v of vals) { if (s === null) s = v; else if (v - prev > 15) { segs.push([s, prev]); s = v; } prev = v; }
  if (s !== null) segs.push([s, prev]);
  return segs.filter(([a, b]) => (b - a) > 3 * pxPerMm).map(([a, b]) => +(((a + b) / 2) / pxPerMm).toFixed(1));
}

const run = async (name, duplex) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  // screen 模式行 padOdd（同真實 app 一致），pdf 內部先轉 print
  await page.addScriptTag({ content: iife });
  await page.evaluate((duplex) => {
    const pageRuleRe = /@page (pg-\d+-\d+) \{([^}]*)\}/g;
    const rules = {};
    for (const st of Array.from(document.querySelectorAll('style'))) {
      const css = st.textContent || '';
      let m;
      while ((m = pageRuleRe.exec(css))) rules[m[1]] = m[2];
    }
    const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]')).filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
    const list = wrappers.map((w) => {
      const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
      const body = rules[pageName] || '';
      const margin = body.match(/margin:\s*([^;}]+)/)?.[1]?.trim() || '0 0 0 0';
      const orientation = /size:\s*A4\s+landscape/i.test(body) ? 'landscape' : 'portrait';
      return { selector: '.' + w.className, config: { size: 'A4', orientation, margin }, pageName };
    });
    window.PrintUtils.padOddPageDocuments(document, list, '', duplex);
  }, duplex);
  const pdfPath = `C:/Users/Admin/Desktop/care-suite/.print-diff/final-${name}.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const r = await analyze(pdfPath);
  for (const pg of r) {
    console.log(name, 'p' + pg.page, pg.landscape ? 'LAND' : 'port',
      'A:', JSON.stringify(pg.circlesA),
      'B:', JSON.stringify(pg.circlesB),
      'logos:', pg.logos.length, pg.logos.length ? `(x${pg.logos[0].x},y${pg.logos[0].yTop})` : '');
  }
};

await run('nonduplex', false);
await run('duplex', true);
