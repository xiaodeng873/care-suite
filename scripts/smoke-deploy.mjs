// 一次性 smoke test：模擬 Vercel 路由規則（filesystem 優先 → rewrites）serve dist-portal，
// 逐個 URL 檢查 status 同 content-type，完咗自動退出（避免殘留進程鎖住 dist-portal）。
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-portal');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
const APP_RE = /^\/(dashboard|scheduling|station-bed|follow-up|tasks|meal-guidance|patient-logs|restraint|evening-care-plan|tube-care|admission-records|print-forms|wound|wound-old|activity-records|fee-records|prescriptions|prescription-search|drug-database|drug-reactions|medication-workflow|hospital-outreach|annual-health-checkup|incident-reports|diagnosis-records|vaccination-records|care-records|diaper-usage-records|patients|patient-contacts|templates|health|health-assessments|individual-care-plan|reports|settings|rehabilitation|infection-control|roster-management)(\/|$)/;

const rel = q => path.join(root, q);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // 模擬 vercel.json rewrites（Vercel 係 filesystem 優先，呢度簡化：先試檔案）
  let file = p.endsWith('/') ? p + 'index.html' : p;
  if (!path.extname(file) && fs.existsSync(rel(file + '.html'))) file += '.html';
  if (!fs.existsSync(rel(file)) || fs.statSync(rel(file)).isDirectory()) {
    if (p === '/login' || p.startsWith('/login/') || APP_RE.test(p)) file = '/login/index.html';
  }
  fs.readFile(rel(file), (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); }
    else { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(d); }
  });
});

const urls = [
  ['GET /', '/', 'text/html'],
  ['GET /pricing', '/pricing', 'text/html'],
  ['GET /features/medication', '/features/medication', 'text/html'],
  ['GET /login（App 入口）', '/login', 'text/html'],
  ['GET /dashboard（App 主頁）', '/dashboard', 'text/html'],
  ['GET /health（App 內頁）', '/health', 'text/html'],
  ['GET /care-records（App 內頁）', '/care-records', 'text/html'],
  ['GET /patients?x=1（帶 query）', '/patients?x=1', 'text/html'],
  ['GET App 主 JS', null, 'text/javascript'],
  ['GET /login/sc-logo.png', '/login/sc-logo.png', 'image/png'],
  ['GET /login/fonts/kaiu.ttf', '/login/fonts/kaiu.ttf', 'font/ttf'],
  ['GET /robots.txt', '/robots.txt', 'text/plain'],
];

const mainJs = fs.readFileSync(rel('login/index.html'), 'utf-8').match(/src="(\/login\/assets\/js\/main-[^"]+)"/)[1];
urls[8][1] = mainJs;

server.listen(0, async () => {
  const port = server.address().port;
  let fail = 0;
  for (const [label, u, expect] of urls) {
    const r = await fetch(`http://localhost:${port}${u}`);
    const ct = (r.headers.get('content-type') || '').split(';')[0];
    const body = await r.text();
    const isApp = body.includes('院舍管理系統') && body.includes('id="root"');
    const isLanding = body.includes('eHMS');
    const tag = u.startsWith('/login') || APP_RE.test(u.split('?')[0]) ? (isApp ? 'App' : '⚠️非App') : (isLanding || u.includes('assets') || u.includes('.' ) ? '' : '');
    const ok = r.status === 200 && ct === expect;
    if (!ok) fail++;
    console.log(`${ok ? '✓' : '✗'} ${r.status} ${ct} ${label}${tag ? ` [${tag}]` : ''}`);
  }
  // 確認 /login 同 /health serve 嘅係 App（而 / 係 landing page）
  server.close();
  process.exit(fail ? 1 : 0);
});
