// apps/web/src/utils/documentQuad.ts
var cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
function convexHull(points) {
  if (points.length <= 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
function minAreaRect(hull) {
  if (hull.length < 3) return null;
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const p0 = hull[i];
    const p1 = hull[(i + 1) % hull.length];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (!best || area < best.area) {
      const cosB = Math.cos(angle);
      const sinB = Math.sin(angle);
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ].map((p) => ({ x: p.x * cosB - p.y * sinB, y: p.x * sinB + p.y * cosB }));
      best = { corners, area };
    }
  }
  return best;
}
function orderQuad(corners) {
  let tl = corners[0], tr = corners[0], br = corners[0], bl = corners[0];
  let minSum = Infinity, maxSum = -Infinity, maxDiff = -Infinity, minDiff = Infinity;
  for (const p of corners) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < minSum) {
      minSum = sum;
      tl = p;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = p;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = p;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = p;
    }
  }
  return { tl, tr, br, bl };
}
function quadArea(q) {
  const pts = [q.tl, q.tr, q.br, q.bl];
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

// apps/web/src/utils/ocrProcessor.ts
var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
var TARGET_IMAGE_SIZE = 2 * 1024 * 1024;
var DOC_CROP_GRID = 96;
var DOC_CROP_MIN_AREA = 0.2;
var DOC_CROP_MAX_AREA = 0.92;
var DOC_CROP_PAD_CELLS = 2;
function readWhiteness(canvas) {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const white = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    white[j] = r < g ? r < b ? r : b : g < b ? g : b;
  }
  return white;
}
function detectDocumentBounds(canvas) {
  const { width, height } = canvas;
  const luma = readWhiteness(canvas);
  const scale = DOC_CROP_GRID / Math.max(width, height);
  const gw = Math.max(8, Math.round(width * scale));
  const gh = Math.max(8, Math.round(height * scale));
  const cw = width / gw;
  const ch = height / gh;
  const cellLuma = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * ch), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * ch));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * cw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cw));
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        const rowStart = y * width;
        for (let x = x0; x < x1; x++) sum += luma[rowStart + x];
      }
      cellLuma[gy * gw + gx] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < cellLuma.length; i++) hist[Math.min(255, Math.round(cellLuma[i]))]++;
  const total = cellLuma.length;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let sumB = 0, wB = 0, threshold = 0, bestVariance = 0;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVariance) {
      bestVariance = between;
      threshold = v;
    }
  }
  const brightThreshold = Math.min(240, Math.max(170, bestVariance > 0 ? threshold : 180));
  const bright = new Uint8Array(total);
  for (let i = 0; i < total; i++) bright[i] = cellLuma[i] > brightThreshold ? 1 : 0;
  const visited = new Uint8Array(total);
  let bestCells = [];
  let bestBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const stack = [];
  for (let i = 0; i < total; i++) {
    if (!bright[i] || visited[i]) continue;
    const cells = [];
    let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
    stack.push(i);
    visited[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const cx = c % gw, cy = c / gw | 0;
      if (cx < x0) x0 = cx;
      if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy;
      if (cy > y1) y1 = cy;
      const neighbors = [c - 1, c + 1, c - gw, c + gw];
      for (const n of neighbors) {
        if (n < 0 || n >= total || visited[n] || !bright[n]) continue;
        if ((n === c - 1 || n === c + 1) && (n / gw | 0) !== cy) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    if (cells.length > bestCells.length) {
      bestCells = cells;
      bestBox = { x0, y0, x1, y1 };
    }
  }
  const area = bestCells.length / total;
  if (area < DOC_CROP_MIN_AREA || area > DOC_CROP_MAX_AREA) return null;
  const pad = DOC_CROP_PAD_CELLS;
  const px0 = Math.max(0, Math.floor((bestBox.x0 - pad) * cw));
  const py0 = Math.max(0, Math.floor((bestBox.y0 - pad) * ch));
  const px1 = Math.min(width, Math.ceil((bestBox.x1 + 1 + pad) * cw));
  const py1 = Math.min(height, Math.ceil((bestBox.y1 + 1 + pad) * ch));
  if (px1 - px0 < 32 || py1 - py0 < 32) return null;
  let quad;
  const hull = convexHull(bestCells.map((c) => ({ x: c % gw, y: c / gw | 0 })));
  if (hull.length >= 4) {
    const rect = minAreaRect(hull);
    if (rect) {
      const grow = 0.5 + pad;
      const cenX = rect.corners.reduce((s, p) => s + p.x, 0) / 4;
      const cenY = rect.corners.reduce((s, p) => s + p.y, 0) / 4;
      const ordered = orderQuad(rect.corners);
      const expand = (p) => {
        const dx = p.x - cenX, dy = p.y - cenY;
        const len = Math.hypot(dx, dy) || 1;
        return {
          x: Math.min(width, Math.max(0, (p.x + dx / len * grow) * cw)),
          y: Math.min(height, Math.max(0, (p.y + dy / len * grow) * ch))
        };
      };
      const candidate = {
        tl: expand(ordered.tl),
        tr: expand(ordered.tr),
        br: expand(ordered.br),
        bl: expand(ordered.bl)
      };
      const bboxArea = (bestBox.x1 + 1 - bestBox.x0) * cw * (bestBox.y1 + 1 - bestBox.y0) * ch;
      if (quadArea(candidate) >= bboxArea * 0.55) quad = candidate;
    }
  }
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0, quad };
}

// .tmp/_test_doc_quad.mjs
var W = 960;
var H = 720;
var CELL = 10;
var GROW_CELLS = 0.5 + 2;
var pass = 0;
var fail = 0;
var check = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`ok   ${label}`);
  } else {
    fail++;
    console.log(`FAIL ${label}`, detail ?? "");
  }
};
var makeCanvasStub = (data) => ({
  width: W,
  height: H,
  getContext: () => ({ getImageData: () => ({ data }) })
});
var synthImage = (bg, rect) => {
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
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
};
var trueCorners = (rect) => {
  const cos = Math.cos(rect.theta), sin = Math.sin(rect.theta);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => ({
    x: rect.cx + sx * rect.hw * cos - sy * rect.hh * sin,
    y: rect.cy + sx * rect.hw * sin + sy * rect.hh * cos
  }));
};
var expectedCorners = (rect) => {
  const corners = trueCorners(rect);
  return corners.map((p) => {
    const dx = p.x - rect.cx, dy = p.y - rect.cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + dx / len * GROW_CELLS * CELL, y: p.y + dy / len * GROW_CELLS * CELL };
  });
};
var dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var assertQuadClose = (label, quad, rect, tolPx) => {
  const expected = expectedCorners(rect);
  const got = [quad.tl, quad.tr, quad.br, quad.bl];
  const unmatched = [...expected];
  for (const g of got) {
    let bestI = -1, bestD = Infinity;
    unmatched.forEach((e, i) => {
      const d = dist(g, e);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0) unmatched.splice(bestI, 1);
    if (bestD > tolPx) {
      check(label, false, `\u89D2 (${g.x.toFixed(0)},${g.y.toFixed(0)}) \u6700\u8FD1\u9810\u671F\u89D2\u8DDD\u96E2 ${bestD.toFixed(1)}px > ${tolPx}px`);
      return;
    }
  }
  check(label, true);
};
var rect1 = { cx: 480, cy: 360, hw: 300, hh: 200, theta: 15 * Math.PI / 180 };
var b1 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], rect1)));
check("\u9EC3\u80CC\u666F+15\xB0\u7D19\uFF1A\u5075\u6E2C\u5230 bounds", !!b1);
check("\u9EC3\u80CC\u666F+15\xB0\u7D19\uFF1A\u6709 quad", !!b1?.quad, b1);
if (b1?.quad) assertQuadClose("\u9EC3\u80CC\u666F+15\xB0\u7D19\uFF1Aquad \u56DB\u89D2\u8AA4\u5DEE < 2 \u683C", b1.quad, rect1, 2 * CELL);
var rect2 = { cx: 480, cy: 360, hw: 200, hh: 220, theta: 0 };
var b2 = detectDocumentBounds(makeCanvasStub(synthImage([220, 60, 60], rect2)));
check("\u7D05\u80CC\u666F+\u6B63\u653E\u7D19\uFF1A\u5075\u6E2C\u5230 bounds \u4E14\u6709 quad", !!b2?.quad, b2);
if (b2?.quad) assertQuadClose("\u7D05\u80CC\u666F+\u6B63\u653E\u7D19\uFF1Aquad \u56DB\u89D2\u8AA4\u5DEE < 2 \u683C", b2.quad, rect2, 2 * CELL);
var b3 = detectDocumentBounds(makeCanvasStub(synthImage([255, 255, 255], null)));
check("\u5168\u767D\u5716\uFF1A\u8FD4\u56DE null", b3 === null, b3);
var b4 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], null)));
check("\u5168\u9EC3\u5716\uFF1A\u8FD4\u56DE null", b4 === null, b4);
var rect5 = { cx: 480, cy: 360, hw: 300, hh: 150, theta: 40 * Math.PI / 180 };
var b5 = detectDocumentBounds(makeCanvasStub(synthImage([230, 200, 80], rect5)));
check("40\xB0 \u65CB\u8F49\uFF1Abbox \u7167\u820A\u8FD4\u56DE", !!b5, b5);
check("40\xB0 \u65CB\u8F49\uFF1Aquad \u88AB 55% \u9632\u5446\u68C4\u7528", !!b5 && !b5.quad, b5?.quad);
console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
