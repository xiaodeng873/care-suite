import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const includesDir = path.join(srcDir, '_includes');

function ensureDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function loadIncludes() {
  const includes = {};
  if (!fs.existsSync(includesDir)) return includes;
  const files = fs.readdirSync(includesDir);
  for (const file of files) {
    const key = path.basename(file);
    includes[key] = fs.readFileSync(path.join(includesDir, file), 'utf-8');
  }
  return includes;
}

// Web app（登入入口）的網址。部署時以環境變數 APP_URL 指定（例如 https://app.example.com），
// 未設定時預設 '/app'（配合 PRD 的單一 domain 子路徑設計）。
const APP_URL = process.env.APP_URL || '/app';

function processHtml(content, includes, relativeDir) {
  // Replace <!-- INCLUDE: filename.html -->
  const withIncludes = content.replace(/<!--\s*INCLUDE:\s*([^\s]+)\s*-->/g, (match, filename) => {
    if (includes[filename]) return includes[filename];
    console.warn(`  Warning: include not found: ${filename}`);
    return '';
  });
  // 佔位符需在最後替換，include（nav/footer）內的 %APP_URL% 才會生效
  return withIncludes.replaceAll('%APP_URL%', APP_URL);
}

function build(src, dest, includes, baseDir = src) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_includes') continue;
      build(srcPath, destPath, includes, baseDir);
    } else if (entry.name.endsWith('.html')) {
      const raw = fs.readFileSync(srcPath, 'utf-8');
      const relativeDir = path.relative(baseDir, path.dirname(srcPath));
      const processed = processHtml(raw, includes, relativeDir);
      fs.writeFileSync(destPath, processed, 'utf-8');
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building marketing site...');
ensureDir(distDir);
copyDir(publicDir, distDir);
const includes = loadIncludes();
build(srcDir, distDir, includes);
console.log(`Built to ${distDir}`);
