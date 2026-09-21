// test-deskew：合成一個旋轉咗嘅「文字行」文件，驗證 detectSkewAngle 搵返個修正角
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

// 合成文件：白底 + 多行黑色橫條（模擬文字行），再旋轉 skewDeg
function makeSkewedDoc(skewDeg, w = 800, h = 1000) {
  const base = createCanvas(w, h);
  const bctx = base.getContext('2d');
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#000';
  for (let y = 100; y < h - 100; y += 40) {
    for (let x = 100; x < w - 100; x += 18) {
      bctx.fillRect(x, y, 12, 10);
    }
  }
  const out = createCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((skewDeg * Math.PI) / 180);
  ctx.drawImage(base, -w / 2, -h / 2);
  return out;
}

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/ocrProcessor.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [stubPlugin],
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { detectSkewAngle } = mod.exports;

  const cases = [
    ['無傾斜 → 唔修正', 0, 0],
    ['傾斜 +3° → 修正角 ≈ -3', 3, -3],
    ['傾斜 -5° → 修正角 ≈ +5', -5, 5],
    ['傾斜 +1.2° → 修正角 ≈ -1.2', 1.2, -1.2],
  ];
  for (const [name, skew, expect] of cases) {
    const t0 = Date.now();
    const detected = detectSkewAngle(makeSkewedDoc(skew));
    const ms = Date.now() - t0;
    const ok = Math.abs(detected - expect) <= 0.3;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}（detected=${detected.toFixed(1)}°, ${ms}ms）`);
  }
})();
