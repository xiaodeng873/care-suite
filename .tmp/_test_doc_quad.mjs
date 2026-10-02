// detectDocumentBounds quad 偵測 smoke test（用完即刪）
// 合成白紙（白底）+ 有色背景像素，經 canvas stub 行真實偵測函數
import { detectDocumentBounds } from '../apps/web/src/utils/ocrProcessor.ts';

const W = 960, H = 720; // 格網 96×72，1 格 = 10px
const CELL = 10;
const GROW_CELLS = 0.5 + 2; // 半格補償 + DOC_CROP_PAD_CELLS

let pass = 0, fail = 0;
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}`, detail ?? ''); }
};

const makeCanvasStub = (data) => ({
  width: W,
  height: H,
  getContext: () => ({ getImageData: () => ({ data }) }),
});

/** 底色 + 旋轉白紙（白 255；紙外維持底色） */
const synthImage = (bg, rect) => {
  const data = new Uint8ClampedArray(W * H * 4);
  const cos = rect ? Math.cos(rect.theta) : 1, sin = rect ? Math.sin(rect.theta) : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let inside = false;
      if (rect) {
        const dx = x - rect.cx, dy = y - rect.cy;
        const rx = dx * cos + dy * sin;
        const ry = -dx * sin + dy * cos;
        inside = Math.abs(rx) <= rect.hw && Math.abs(ry) <= rect.hh;
      }
      const i = (y * W + x) * 4;
      const [r, g, b] = inside ? [255, 255, 255] : bg;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return data;
};

/** 旋轉矩形真實四角（無序） */
const trueCorners = (rect) => {
  const cos = Math.cos(rect.theta), sin = Math.sin(rect.theta);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => ({
    x: rect.cx + sx * rect.hw * cos - sy * rect.hh * sin,
    y: rect.cy + sx * rect.hw * sin + sy * rect.hh * cos,
  }));
};

/** 預期偵測角 = 真實角沿遠離質心方向外擴 GROW_CELLS 格 */
const expectedCorners = (rect) => {
  const corners = trueCorners(rect);
  return corners.map(p => {
    const dx = p.x - rect.cx, dy = p.y - rect.cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * GROW_CELLS * CELL, y: p.y + (dy / len) * GROW_CELLS * CELL };
  });
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const assertQuadClose = (label, quad, rect, tolPx) => {
  const expected = expectedCorners(rect);
  const got = [quad.tl, quad.tr, quad.br, quad.bl];
  const unmatched = [...expected];
  for (const g of got) {
    let bestI = -1, bestD = Infinity;
    unmatched.forEach((e, i) => { const d = dist(g, e); if (d < bestD) { bestD = d; bestI = i; } });
    if (bestI >= 0) unmatched.splice(bestI, 1);
    if (bestD > tolPx) {
      check(label, false, `角 (${g.x.toFixed(0)},${g.y.toFixed(0)}) 最近預期角距離 ${bestD.toFixed(1)}px > ${tolPx}px`);
      return;
    }
  }
  check(label, true);
};

// ── 1. 黃背景（min-channel 80）+ 15° 旋轉白紙 → quad 四角準 ──
const rect1 = { cx: 480, cy: 360, hw: 300, hh: 200, theta: (15 * Math.PI) / 180 };
const b1 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], rect1)));
check('黃背景+15°紙：偵測到 bounds', !!b1);
check('黃背景+15°紙：有 quad', !!b1?.quad, b1);
if (b1?.quad) assertQuadClose('黃背景+15°紙：quad 四角誤差 < 2 格', b1.quad, rect1, 2 * CELL);

// ── 2. 紅背景（min-channel 60）+ 軸對齊白紙 ──
const rect2 = { cx: 480, cy: 360, hw: 200, hh: 220, theta: 0 };
const b2 = detectDocumentBounds(makeCanvasStub(synthImage([220, 60, 60], rect2)));
check('紅背景+正放紙：偵測到 bounds 且有 quad', !!b2?.quad, b2);
if (b2?.quad) assertQuadClose('紅背景+正放紙：quad 四角誤差 < 2 格', b2.quad, rect2, 2 * CELL);

// ── 3. 全白圖 → null（無背景可裁） ──
const b3 = detectDocumentBounds(makeCanvasStub(synthImage([255, 255, 255], null)));
check('全白圖：返回 null', b3 === null, b3);

// ── 4. 全黃圖（無白紙）→ null ──
const b4 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], null)));
check('全黃圖：返回 null', b4 === null, b4);

// ── 5. 40° 大旋轉長方形：quad 面積 < bbox 55% → 棄用 quad，bbox 照舊 ──
const rect5 = { cx: 480, cy: 360, hw: 300, hh: 150, theta: (40 * Math.PI) / 180 };
const b5 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], rect5)));
check('40° 旋轉：bbox 照舊返回', !!b5, b5);
check('40° 旋轉：quad 被 55% 防呆棄用', !!b5 && !b5.quad, b5?.quad);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
