// 量度 code-generated 文件嘅 topMm：用 bundle basic 模式嘅呼叫方式產生 HTML → print → 計 topMm
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /facilitySettings$/ }, () => ({ path: path.join(stubDir, 'facilitySettings.ts') }));
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
    // ?raw 範本 import：當 text 載入
    build.onResolve({ filter: /\.html\?raw$/ }, (args) => ({
      path: path.resolve(path.dirname(args.importer), args.path.replace(/\?raw$/, '')),
      namespace: 'raw-html',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw-html' }, (args) => ({
      contents: fs.readFileSync(args.path, 'utf8'), loader: 'text',
    }));
  },
};
const pt2mm = (pt) => (pt * 25.4) / 72;
function matMul(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}
const applyM = (m, x, y) => { const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f]; };

const FAC = '善頤(福群)護老院';
const PATIENT = { 院友id: 999, 中文姓名: '測試院友', 中文姓氏: '測', 中文名字: '試', 床號: 'A101-1', 性別: '女', 出生日期: '1929-01-01' };
const DATES = ['2026-09-01', '2026-09-14'];

// docId → { entry, export, args(doc) }；accident_report 用 raw 範本（generator 要 DOMParser）
const CODE_DOCS = {
  vital_signs_record: { entry: 'bloodPressureRecordWorksheetGenerator.ts', exp: 'generateBloodPressureRecordHtml', args: () => [...DATES, [999], { includeData: false }] },
  vaccination_record: { entry: 'vaccinationRecordPrintGenerator.ts', exp: 'generateVaccinationRecordHtml', args: () => [PATIENT, [], FAC] },
  health_assessment: { entry: 'healthAssessmentPrintGenerator.ts', exp: 'generateHealthAssessmentHtml', args: () => [{}, PATIENT, FAC] },
  er_record: { entry: 'erRecordPrintGenerator.ts', exp: 'generateERRecordFormsHtml', args: () => [[{ patient_id: 999 }], [PATIENT], FAC] },
  follow_up_record: { entry: 'followUpRecordPrintGenerator.ts', exp: 'generateFollowUpRecordFormsHtml', args: () => [[{ 院友id: 999 }], [PATIENT], '', FAC] },
  incident_report: { entry: 'printIncidentReport.ts', exp: 'generateIncidentReportPrintHTML', args: () => [[{ patient: PATIENT, report: {} }], FAC] },
  activity_record: { entry: 'activityRecordPrintFormHtml.ts', exp: 'generateActivityRecordPrintFormHtml', args: () => [[PATIENT], new Map([[999, []]]), FAC] },
  medication_list_short: { entry: 'medicationListHtmlGenerator.ts', exp: 'generateMedicationListHtml', args: () => [[{ ...PATIENT, prescriptions: [] }], { allowBlankPage: true, termType: 'short' }] },
  medication_list_long: { entry: 'medicationListHtmlGenerator.ts', exp: 'generateMedicationListHtml', args: () => [[{ ...PATIENT, prescriptions: [] }], { allowBlankPage: true, termType: 'long' }] },
  temperature_record: { entry: 'temperatureRecordWorksheetGenerator.ts', exp: 'generateTemperatureRecordHtml', args: () => [...DATES, [999], { includeData: false }] },
  bodyweight_record: { entry: 'bodyweightRecordWorksheetGenerator.ts', exp: 'generateBodyweightRecordHtml', args: () => [...DATES, [999], { includeData: false }] },
  blood_sugar_record: { entry: 'glucoseRecordWorksheetGenerator.ts', exp: 'generateGlucoseRecordHtml', args: () => [...DATES, [999], { includeData: false }] },
  nursing_treatment: { entry: 'patientLogNursingTreatmentGenerator.ts', exp: 'generatePatientLogNursingTreatmentHtml', args: () => [[{ id: 'blank', patient_id: 999, log_date: '', log_type: '其他', content: '', recorder: '' }], [PATIENT], ['blank']] },
  wound_assessment: { entry: 'woundAssessmentPrintGenerator.ts', exp: 'generateWoundAssessmentHtml', args: () => [{ id: 'blank', patient_id: 999, wound_code: '', wound_location: { x: 0, y: 0, side: 'front' }, status: 'active' }, [], PATIENT] },
  restraint_usage_common: { entry: 'restraintUsageRecordPrintGenerator.ts', exp: 'generateRestraintUsageRecordHtml', args: () => [[], PATIENT, FAC] },
};

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  const browser = await chromium.launch({ executablePath: CHROME });
  const logoResult = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/printPageLogo.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const logoMod = { exports: {} };
  new Function('module', 'exports', 'require', logoResult.outputFiles[0].text)(logoMod, logoMod.exports, require);
  const pngB64 = fs.readFileSync(path.join(root, 'apps/web/public/sc-logo.png')).toString('base64');
  const logoSrc = `data:image/png;base64,${pngB64}`;

  const results = {};
  for (const [docId, cfg] of Object.entries(CODE_DOCS)) {
    try {
      const result = await esbuild.build({
        entryPoints: [path.join(root, 'apps/web/src/utils', cfg.entry)],
        bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
      });
      const mod = { exports: {} };
      new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
      const gen = mod.exports[cfg.exp];
      if (!gen) { console.log(`${docId}: 搵唔到 export ${cfg.exp}`); continue; }
      let html = await gen(...cfg.args());
      if (Array.isArray(html)) html = html.filter(Boolean).join('\n');
      if (!html || !html.trim()) { console.log(`${docId}: 無 HTML 輸出`); continue; }
      html = logoMod.exports.injectPageLogo(html, logoSrc, 1.3);
      const marginMatch = html.match(/@page\s*\{[\s\S]*?margin(?:-top)?\s*:\s*([^;}]+)/);
      let marginMm = 0;
      if (marginMatch) {
        const first = marginMatch[1].trim().split(/\s+/)[0];
        const num = parseFloat(first);
        if (isFinite(num)) {
          if (first.endsWith('mm')) marginMm = num;
          else if (first.endsWith('cm')) marginMm = num * 10;
          else if (first.endsWith('in')) marginMm = num * 25.4;
          else if (first.endsWith('px')) marginMm = (num * 25.4) / 96;
        }
      }
      const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
      await page.close();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf) }).promise;
      const pdfPage = await doc.getPage(1);
      const vp = pdfPage.getViewport({ scale: 1 });
      const ops = await pdfPage.getOperatorList();
      const stack = []; let ctm = [1, 0, 0, 1, 0, 0]; const imgRects = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() || ctm;
        else if (fn === OPS.transform) ctm = matMul(ctm, ops.argsArray[i]);
        else if (fn === OPS.paintImageXObject) {
          const pts = [applyM(ctm, 0, 0), applyM(ctm, 1, 0), applyM(ctm, 0, 1), applyM(ctm, 1, 1)];
          imgRects.push({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) });
        }
      }
      const logoRect = imgRects.find((r) => { const w = pt2mm(r.x1 - r.x0); return w > 25 && w < 40 && r.x0 > vp.width * 0.7; });
      const tc = await pdfPage.getTextContent();
      let title = tc.items.find((it) => (it.str || '').trim().startsWith('善'));
      if (!title) {
        // follow_up 等：標題可能逐字或前面有其他字，改搵包含「護老院」嘅合併 item，或者第一個大於 5mm 字體
        title = tc.items.find((it) => (it.str || '').includes('護老院'))
          || tc.items.find((it) => Math.hypot(it.transform[1], it.transform[3]) * 25.4 / 72 > 5);
      }
      if (!title || !logoRect) { console.log(`${docId}: 量度失敗 (title=${!!title} logo=${!!logoRect} imgs=${imgRects.length})`); continue; }
      const fsPt = Math.hypot(title.transform[1], title.transform[3]);
      const baselineRelMm = pt2mm(vp.height - title.transform[5]) - marginMm;
      const logoRelMm = pt2mm(vp.height - logoRect.y1) - marginMm;
      const glyphRelMm = baselineRelMm - pt2mm(0.72 * fsPt);
      const topMm = Math.round((1.3 + glyphRelMm - logoRelMm) * 10) / 10;
      results[docId] = topMm;
      console.log(`${docId}: baseline rel=${baselineRelMm.toFixed(2)} fs=${pt2mm(fsPt).toFixed(2)} 字頂≈${glyphRelMm.toFixed(2)} logoRel=${logoRelMm.toFixed(2)} → topMm=${topMm}`);
    } catch (e) {
      console.log(`${docId}: ${String(e).slice(0, 120)}`);
    }
  }
  console.log('\n表：', JSON.stringify(results));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
