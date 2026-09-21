const path = require('path');
const esbuild = require('esbuild');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const stubPlugin = { name: 'stubs', setup(build) {
  build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir = path.resolve(__dirname, 'stubs'), 'supabase.ts') }));
}};
let stubDir;
global.document = { createElement: (t) => (t === 'canvas' ? createCanvas(1, 1) : {}) };
(async () => {
  const r = await esbuild.build({ entryPoints: [path.join(root, 'apps/web/src/utils/ocrProcessor.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin] });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require);
  const { cropToDocument } = mod.exports;
  // 亮背景（淺色枱面 200）+ 白紙 245
  const c = createCanvas(1200, 900);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(200,200,200)'; ctx.fillRect(0,0,1200,900);
  ctx.fillStyle = 'rgb(245,245,245)'; ctx.fillRect(200,150,700,550);
  ctx.fillStyle = '#000';
  for (let y=190;y<660;y+=30) for (let x=230;x<870;x+=16) ctx.fillRect(x,y,10,8);
  const out = cropToDocument(c);
  console.log(`亮背景案例：${out.width}x${out.height}（原圖 1200x900，期望 ≈750x600）`);
})();
