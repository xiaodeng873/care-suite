// 部署路由同步檢查：
// ehms.vercel.app 合併部署下，App 用根路徑路由（/health、/care-records…），
// Vercel 靠 vercel.json 嘅 rewrite 將呢啲路徑交俾 App（/login/index.html），
// landing page 嘅靜態檔案（/、/pricing…）就 filesystem 優先。
// 所以 App.tsx 每加一條 Route，vercel.json 嘅 :appRoute(...) alternation
// 同 apps/marketing/public/robots.txt 嘅 Disallow 都要同步加，否則：
//   - vercel.json 漏咗 → 新頁面直接 404 / 去咗 marketing 404
//   - robots.txt 漏咗 → Google 會收錄 App 內頁（只係登入 modal）
// 此 script 喺 vercel.json buildCommand 第一步執行，唔同步就直接 fail build。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const appSrc = fs.readFileSync(path.join(root, 'apps', 'web', 'src', 'App.tsx'), 'utf-8');
const appRoutes = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map(m => m[1].replace(/^\//, ''))
  .filter(r => r && r !== 'login'); // /login 由獨立 rewrite + login/index.html 處理

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf-8'));
const rewrite = vercel.rewrites.find(r => r.source.includes(':appRoute('));
if (!rewrite) throw new Error('vercel.json 搵唔到 :appRoute(...) rewrite 規則');
const inVercel = rewrite.source.match(/:appRoute\(([^)]*)\)/)[1].split('|').sort();

// normalize \r\n（本機 autocrlf=true 會將 checkout 變 CRLF；Vercel Linux 係 LF）
const robots = fs.readFileSync(path.join(root, 'apps', 'marketing', 'public', 'robots.txt'), 'utf-8').replace(/\r\n/g, '\n');

const missingInVercel = appRoutes.filter(r => !inVercel.includes(r));
const staleInVercel = inVercel.filter(r => !appRoutes.includes(r));
const missingInRobots = appRoutes.filter(r => !robots.includes(`Disallow: /${r}\n`) && !robots.endsWith(`Disallow: /${r}`));

// App 路由同 marketing 頁面撞名檢查：Vercel filesystem 優先，
// 如果 marketing 有同名頁（例如 /patients.html），App 嗰頁會永遠去唔到。
// 用 src 而唔係 dist 檢查，因為 buildCommand 第一步行呢個 script 時 dist 仲未存在
const marketingSrc = path.join(root, 'apps', 'marketing', 'src');
const marketingPages = fs.readdirSync(marketingSrc)
  .filter(f => f.endsWith('.html'))
  .map(f => f.replace(/\.html$/, ''));
const collisions = appRoutes.filter(r => marketingPages.includes(r));

// marketing 頂層頁（index/404 除外）要靠 vercel.json 嘅 :mktPage(...) rewrite
// 先可以用 clean URL（/pricing → /pricing.html）— Vercel 冇自動 clean URL
const mktRewrite = vercel.rewrites.find(r => r.source.includes(':mktPage('));
const inMktRewrite = mktRewrite ? mktRewrite.source.match(/:mktPage\(([^)]*)\)/)[1].split('|') : [];
const mktNeedsRewrite = marketingPages.filter(p => p !== 'index' && p !== '404');
const missingMktRewrite = mktNeedsRewrite.filter(p => !inMktRewrite.includes(p));

let ok = true;
if (missingInVercel.length) { console.error('❌ vercel.json :appRoute 漏咗:', missingInVercel.join(', ')); ok = false; }
if (staleInVercel.length) { console.error('❌ vercel.json :appRoute 有已刪除嘅路由:', staleInVercel.join(', ')); ok = false; }
if (missingInRobots.length) { console.error('❌ robots.txt 漏咗 Disallow:', missingInRobots.map(r => `/${r}`).join(', ')); ok = false; }
if (collisions.length) { console.error('❌ App 路由同 marketing 頁面撞名（filesystem 優先，App 頁會失效）:', collisions.map(r => `/${r}`).join(', ')); ok = false; }
if (missingMktRewrite.length) { console.error('❌ vercel.json :mktPage 漏咗 marketing 頁（clean URL 會 404）:', missingMktRewrite.map(p => `/${p}`).join(', ')); ok = false; }

if (!ok) process.exit(1);
console.log(`✓ 部署路由同步：${appRoutes.length} 條 App 路由已對齊 vercel.json 同 robots.txt`);
