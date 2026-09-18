import { chromium } from 'playwright-core';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import path from 'path';
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
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 800 });
await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: iife });
const info = await page.evaluate(() => {
  const PX_PER_MM = 96 / 25.4;
  const wrappers = Array.from(document.querySelectorAll('[class*="print-doc-"]'))
    .filter((el) => /^print-doc-\d+-\d+$/.test(el.className));
  const margins = {};
  const pageRuleRe = /@page (pg-\d+-\d+) \{[^}]*margin: ([^;}]+)/g;
  for (const st of Array.from(document.querySelectorAll('style'))) {
    const css = st.textContent || '';
    let m;
    while ((m = pageRuleRe.exec(css))) margins[m[1]] = m[2].trim();
  }
  const list = wrappers.map((w) => {
    const pageName = (w.getAttribute('style') || '').match(/page:\s*(pg-\d+-\d+)/)?.[1];
    return { selector: '.' + w.className, config: { size: 'A4', orientation: 'portrait', margin: margins[pageName] || '0 0 0 0' }, pageName };
  });
  window.PrintUtils.padOddPageDocuments(document, list, '', true);
  const w = wrappers[6];
  const out = { cls: w.className, children: [] };
  Array.from(w.children).forEach((el) => {
    const clones = el.querySelectorAll ? el.querySelectorAll('img.admission-page-logo, .punch-guide-fixed').length : 0;
    out.children.push({
      cls: typeof el.className === 'string' ? el.className : el.tagName,
      style: (el.getAttribute('style') || '').slice(0, 120),
      offsetTopMm: +(el.offsetTop / PX_PER_MM).toFixed(2),
      nestedClones: clones,
    });
  });
  out.remainingPunch = w.querySelectorAll(':scope > .punch-guide-fixed').length;
  out.remainingLogo = w.querySelectorAll(':scope > img.admission-page-logo').length;
  out.absClones = Array.from(w.querySelectorAll('img.admission-page-logo, .punch-guide-fixed')).map((el) => ({
    cls: el.className,
    parentCls: el.parentElement.className,
    style: (el.getAttribute('style') || '').slice(0, 160),
  }));
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
