// test-doc-crop：合成「深色背景 + 白色文件」相片，驗證 cropToDocument 裁返文件出嚟
const path = require('path');
const esbuild = require('esbuild');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const stubDir = path.resolve(__dirname, 'stubs');
const stubPlugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(stubDir, 'supabase.ts') }));
  },
};

global.document = {
  createElement: (tag) => (tag === 'canvas' ? createCanvas(1, 1) : {}),
};

// 深色枱面 + 一張放歪咗位置嘅白紙（內有模擬文字行）
function makePhoto(paperBox, w = 1200, h = 900, bg = 60) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.fillRect(0, 0, w, h);
  const { x, y, pw, ph } = paperBox;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, pw, ph);
  ctx.fillStyle = '#000';
  for (let ty = y + 40; ty < y + ph - 40; ty += 30) {
    for (let tx = x + 30; tx < x + pw - 30; tx += 16) {
      ctx.fillRect(tx, ty, 10, 8);
    }
  }
  return c;
}

function approx(actual, expect, tol) { return Math.abs(actual - expect) <= tol; }

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/ocrProcessor.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { cropToDocument } = mod.exports;

  // case 1：紙佔中間約一半面積 → 應裁到接近紙嘅範圍（容忍 padding）
  const box = { x: 200, y: 150, pw: 700, ph: 550 };
  const r1 = cropToDocument(makePhoto(box));
  const padTol = 60;
  const ok1 =
    approx(r1.width, box.pw, padTol) && approx(r1.height, box.ph, padTol);
  console.log(`${ok1 ? 'PASS' : 'FAIL'} 裁出文件範圍 ≈ ${box.pw}x${box.ph}（實際 ${r1.width}x${r1.height}）`);

  // case 2：全幅文件（紙充滿成個畫面）→ 唔應該裁
  const r2 = cropToDocument(makePhoto({ x: 0, y: 0, pw: 1200, ph: 900 }));
  const ok2 = r2.width === 1200 && r2.height === 900;
  console.log(`${ok2 ? 'PASS' : 'FAIL'} 全幅文件唔裁（實際 ${r2.width}x${r2.height}）`);

  // case 3：全黑圖（偵測失敗情境）→ 唔應該裁
  const dark = createCanvas(800, 600);
  const dctx = dark.getContext('2d');
  dctx.fillStyle = '#111';
  dctx.fillRect(0, 0, 800, 600);
  const r3 = cropToDocument(dark);
  const ok3 = r3.width === 800 && r3.height === 600;
  console.log(`${ok3 ? 'PASS' : 'FAIL'} 全黑圖唔裁（實際 ${r3.width}x${r3.height}）`);

  // case 4：細紙喺角落（亮區 <20% 面積 → 當偵測可疑，唔裁？呢度紙佔 ~6%，預期唔裁）
  const r4 = cropToDocument(makePhoto({ x: 20, y: 20, pw: 260, ph: 200 }));
  const ok4 = r4.width === 1200 && r4.height === 900;
  console.log(`${ok4 ? 'PASS' : 'FAIL'} 細紙角落（6%）唔裁（實際 ${r4.width}x${r4.height}）`);

  // case 5：黃色文件夾背景（真實案例：灰階亮度分唔到，白度分到）
  const yellow = makePhoto(box, 1200, 900);
  const yctx = yellow.getContext('2d');
  yctx.fillStyle = 'rgb(235,205,70)';
  yctx.fillRect(0, 0, 1200, 150);
  yctx.fillRect(0, 700, 1200, 200);
  yctx.fillRect(0, 0, 200, 900);
  yctx.fillRect(900, 0, 300, 900);
  const r5 = cropToDocument(yellow);
  const ok5 = approx(r5.width, box.pw, padTol) && approx(r5.height, box.ph, padTol);
  console.log(`${ok5 ? 'PASS' : 'FAIL'} 黃色背景都裁到 ≈ ${box.pw}x${box.ph}（實際 ${r5.width}x${r5.height}）`);

  // case 6：黃背景 + 膚色手揸住紙左邊（皮膚 B 通道低，唔會當係紙）
  const hand = makePhoto(box, 1200, 900);
  const hctx = hand.getContext('2d');
  hctx.fillStyle = 'rgb(235,205,70)';
  hctx.fillRect(0, 0, 1200, 150);
  hctx.fillRect(0, 700, 1200, 200);
  hctx.fillRect(0, 0, 200, 900);
  hctx.fillRect(900, 0, 300, 900);
  hctx.fillStyle = 'rgb(220,180,140)';
  hctx.fillRect(box.x, box.y + 150, 60, 250);
  const r6 = cropToDocument(hand);
  const ok6 = approx(r6.width, box.pw, padTol) && approx(r6.height, box.ph, padTol);
  console.log(`${ok6 ? 'PASS' : 'FAIL'} 黃背景+手都裁到 ≈ ${box.pw}x${box.ph}（實際 ${r6.width}x${r6.height}）`);

  const t0 = Date.now();
  cropToDocument(makePhoto(box));
  console.log(`耗時 ${Date.now() - t0}ms`);
})();
