// 截圖 pipeline：為營銷站捕捉功能畫面
// 用法：node scripts/screenshots/capture.mjs [target...]（冇參數 = 全部）
// 兩輪 headless Chrome：第一輪量度目標 frame 尺寸，第二輪以 2x 截圖
// 輸出：apps/marketing/public/images/screenshots/<name>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MKT = join(ROOT, 'apps', 'marketing');
const OUT = join(MKT, 'public', 'images', 'screenshots');
const TMP = join(ROOT, '.tmp', 'shots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const FRAME_IDS = ['dashboard', 'emar', 'roster', 'leave', 'beds', 'vitals', 'ocr', 'ai', 'wound', 'print', 'reports', 'permissions', 'mobile', 'treatment', 'operations'];

// 每個截圖目標：輸出名、來源（demo frame / label bundle）、頁面標題（host 用）
const TARGETS = {
  'dashboard': { kind: 'demo', frame: 'demo-dashboard' },
  'emar': { kind: 'demo', frame: 'demo-emar' },
  'bed-map': { kind: 'demo', frame: 'demo-beds' },
  'vitals': { kind: 'demo', frame: 'demo-vitals' },
  'print-modal': { kind: 'demo', frame: 'demo-print' },
  'reports': { kind: 'demo', frame: 'demo-reports' },
  'prescription-label': { kind: 'label' },
};

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const css = (p) => readFileSync(join(MKT, 'public', 'css', p), 'utf8');
const demoJs = readFileSync(join(MKT, 'public', 'js', 'features-demo.js'), 'utf8');

const demoHost = (frameId) => `<!doctype html><html class="light"><head><meta charset="utf-8">
<meta name="color-scheme" content="light">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<style>${css('main.css')}</style>
<style>${css('features-demo.css')}</style>
<style>${css('webapp-components.css')}</style>
<style>
  html { color-scheme: light; }
  body { background: #f3f4f6; margin: 0; padding: 24px; }
  .fd-frame { display: none; }
  #${frameId} { display: block; max-width: 1080px; margin: 0 auto; }
</style></head><body>
${FRAME_IDS.map((id) => `<div class="fd-frame" id="demo-${id}"></div>`).join('\n')}
<pre id="measure" style="display:none"></pre>
<script>${demoJs}</script>
<script>
window.addEventListener('load', function () {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(function () {
    var el = document.getElementById('${frameId}');
    var r = el.getBoundingClientRect();
    document.getElementById('measure').textContent = JSON.stringify({ w: Math.ceil(r.width + 48), h: Math.ceil(r.height + 48) });
  }, 2500);
});
</script></body></html>`;

const chromeOut = (args) => execFileSync(CHROME, ['--headless', '--disable-gpu', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const captureDemo = (name, frameId) => {
  const host = join(TMP, `${name}.html`);
  writeFileSync(host, demoHost(frameId));
  const dom = chromeOut(['--virtual-time-budget=12000', '--window-size=1400,1000', '--dump-dom', `file:///${host.replace(/\\/g, '/')}`]);
  const m = dom.match(/<pre id="measure"[^>]*>([^<]+)<\/pre>/);
  if (!m) throw new Error(`${name}: measure failed`);
  const { w, h } = JSON.parse(m[1]);
  chromeOut([`--screenshot=${join(OUT, name + '.png')}`, `--window-size=${w},${h}`, '--force-device-scale-factor=2', '--hide-scrollbars', '--virtual-time-budget=12000', `file:///${host.replace(/\\/g, '/')}`]);
  console.log(`${name}.png ${w}x${h} @2x`);
};

const captureLabel = async () => {
  // 用真實處方標籤產生器出 3 張示範標籤（沿用 repo 嘅 _build_preview.mjs bundle 工具）
  execFileSync('node', [join(ROOT, 'scripts', '_build_preview.mjs'), join(ROOT, 'apps/web/src/utils/prescriptionLabelHtmlGenerator.ts'), join(TMP, 'label_bundle.mjs'), 'node'], { stdio: 'inherit' });
  const g = await import(`file:///${join(TMP, 'label_bundle.mjs').replace(/\\/g, '/')}`);
  const samples = [
    { patient: { 中文姓名: '陳樂怡' }, rx: { medication_name: 'MADOPAR TABLET 250MG', medication_time_slots: ['07:00', '11:00', '15:00', '19:00'], dosage_amount: 1, dosage_unit: '粒' } },
    { patient: { 中文姓名: '黃志強' }, rx: { medication_name: 'PARACETAMOL TAB 500MG', medication_time_slots: ['08:00', '14:00', '20:00'], dosage_amount: 1, dosage_unit: '粒', end_date: '2026-11-15', medication_quantity: 90 } },
    { patient: { 中文姓名: '周淑賢' }, rx: { medication_name: 'LORAZEPAM TAB 0.5MG', medication_time_slots: [], dosage_amount: 0.5, dosage_unit: '粒', is_prn: true } },
    { patient: { 中文姓名: '盧葉慧卿' }, rx: { medication_name: 'THYROXINE SODIUM TAB 100MCG', medication_time_slots: ['08:00'], dosage_amount: 1, dosage_unit: '粒', frequency_type: 'every_x_days', frequency_value: 2, start_date: '2026-09-01', prescription_date: '2026-09-01', end_date: '2027-01-31', medication_quantity: 90 } },
  ];
  const labels = samples.map((s) => `<div class="label-wrap">${g.renderLabelHtml(g.buildLabelContent(s.patient, s.rx, new Date(2026, 8, 15)))}</div>`).join('\n');
  const doc = g.generatePrescriptionLabelDocument([]);
  const labelCss = doc.match(/<style>([\s\S]*?)<\/style>/)[1];
  const host = `<!doctype html><html class="light"><head><meta charset="utf-8"><style>${labelCss}</style>
<style>
  html { color-scheme: light; }
  body { margin: 0; }
  #shot { padding: 28px; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); display: inline-flex; gap: 22px; align-items: flex-start; }
  .label-wrap { width: 120mm; height: 90mm; overflow: hidden; flex: 0 0 auto; }
  .label { zoom: 3; background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18); border-radius: 0.8mm; }
</style></head><body><div id="shot">${labels}</div>
<pre id="measure" style="display:none"></pre>
<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    var r = document.getElementById('shot').getBoundingClientRect();
    document.getElementById('measure').textContent = JSON.stringify({ w: Math.ceil(r.width), h: Math.ceil(r.height) });
  }, 800);
});
</script></body></html>`;
  const hostPath = join(TMP, 'prescription-label.html');
  writeFileSync(hostPath, host);
  const dom = chromeOut(['--virtual-time-budget=6000', '--window-size=1600,800', '--dump-dom', `file:///${hostPath.replace(/\\/g, '/')}`]);
  const m = dom.match(/<pre id="measure"[^>]*>([^<]+)<\/pre>/);
  if (!m) throw new Error('label: measure failed');
  const { w, h } = JSON.parse(m[1]);
  chromeOut([`--screenshot=${join(OUT, 'prescription-label.png')}`, `--window-size=${w},${h}`, '--force-device-scale-factor=2', '--hide-scrollbars', '--virtual-time-budget=6000', `file:///${hostPath.replace(/\\/g, '/')}`]);
  console.log(`prescription-label.png ${w}x${h} @2x`);
};

const only = process.argv.slice(2);
for (const [name, t] of Object.entries(TARGETS)) {
  if (only.length > 0 && !only.includes(name)) continue;
  if (t.kind === 'demo') captureDemo(name, t.frame);
  else await captureLabel();
}
console.log('done →', OUT);
