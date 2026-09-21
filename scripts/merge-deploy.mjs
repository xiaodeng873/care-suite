// 合併 marketing（landing page）同 web（主 App）嘅 build 輸出做一個資料夾，
// 俾單一 Vercel project（ehms.vercel.app）同時serve兩個站：
//   dist-portal/           ← apps/marketing/dist（根路徑 /）
//   dist-portal/login/     ← apps/web/dist（子路徑 /login，vite base 已設為 /login/）
// 由 vercel.json 嘅 buildCommand 喺兩個 app build 完之後呼叫。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const marketingDist = path.join(root, 'apps', 'marketing', 'dist');
const webDist = path.join(root, 'apps', 'web', 'dist');
const output = path.join(root, 'dist-portal');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(marketingDist)) throw new Error(`Missing ${marketingDist} — build marketing first`);
if (!fs.existsSync(webDist)) throw new Error(`Missing ${webDist} — build web first`);

fs.rmSync(output, { recursive: true, force: true });
copyDir(marketingDist, output);
copyDir(webDist, path.join(output, 'login'));

console.log(`Merged output → ${output}`);
