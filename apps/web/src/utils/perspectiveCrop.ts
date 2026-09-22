// 四邊形透視裁剪：用戶框住文件四角（梯形），拉正成矩形輸出。
// 做法：homography（單位正方形 → 四角 quad）+ 逐像素 bilinear 採樣。

export interface Point { x: number; y: number; }
export interface Quad { tl: Point; tr: Point; br: Point; bl: Point; }

// 解 8x8 線性方程（Gaussian elimination），求單位正方形 → quad 嘅 homography
function solveHomography(quad: Quad): number[] {
  // (u,v) ∈ [0,1]² → (x,y)：x = (a·u + b·v + c) / (g·u + h·v + 1)，y = (d·u + e·v + f) / (g·u + h·v + 1)
  const pts = [quad.tl, quad.tr, quad.br, quad.bl];
  const uv = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 1 }
  ];
  // A·h = b，h = [a,b,c,d,e,f,g,h]
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { u, v } = uv[i];
    const { x, y } = pts[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    if (Math.abs(A[col][col]) < 1e-12) continue;
    for (let row = col + 1; row < n; row++) {
      const f = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= f * A[col][k];
      b[row] -= f * b[col];
    }
  }
  const h = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let s = b[row];
    for (let k = row + 1; k < n; k++) s -= A[row][k] * h[k];
    h[row] = Math.abs(A[row][row]) < 1e-12 ? 0 : s / A[row][row];
  }
  return h;
}

function dist(p: Point, q: Point): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

// 兩直線交點（齊次座標 cross product）；近乎平行返回 null
function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/**
 * 由四邊形反推原始矩形嘅長闊比（w/h）。
 * 方法：兩組對邊嘅消失點 + 主點假設喺相片中間 → 求焦距 → 還原 3D 邊長比。
 * 退化情況（對邊近乎平行、焦距無解）返回 null，调用方 fallback。
 */
export function estimateQuadAspect(quad: Quad, imgW: number, imgH: number): number | null {
  const v1 = lineIntersection(quad.tl, quad.tr, quad.bl, quad.br); // 水平邊消失點
  const v2 = lineIntersection(quad.tl, quad.bl, quad.tr, quad.br); // 垂直邊消失點
  if (!v1 || !v2) return null;

  const cx = imgW / 2, cy = imgH / 2;
  // 正交約束：(v1-c)·(v2-c) + f² = 0
  const f2 = -((v1.x - cx) * (v2.x - cx) + (v1.y - cy) * (v2.y - cy));
  if (f2 <= 0 || !isFinite(f2)) return null;
  const f = Math.sqrt(f2);

  // 3D 射線方向（相機座標）：K⁻¹·p
  const ray = (p: Point): [number, number, number] => [(p.x - cx) / f, (p.y - cy) / f, 1];
  const norm = (v: [number, number, number]): [number, number, number] => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a: [number, number, number], b: [number, number, number]): number =>
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);

  const d1 = norm(ray(v1)); // 水平邊 3D 方向
  const d2 = norm(ray(v2)); // 垂直邊 3D 方向
  const rA = ray(quad.tl), rB = ray(quad.tr), rD = ray(quad.bl);
  // 深度比：λ_B/λ_A = |rA×d1| / |rB×d1|，λ_D/λ_A = |rA×d2| / |rD×d2|
  const denomB = cross(rB, d1), denomD = cross(rD, d2);
  if (denomB < 1e-9 || denomD < 1e-9) return null;
  const lambdaA = 1;
  const lambdaB = (cross(rA, d1) / denomB) * lambdaA;
  const lambdaD = (cross(rA, d2) / denomD) * lambdaA;
  // 真實邊長：w = |λ_B·rB − λ_A·rA|，h = |λ_D·rD − λ_A·rA|
  const wVec: [number, number, number] = [
    lambdaB * rB[0] - lambdaA * rA[0],
    lambdaB * rB[1] - lambdaA * rA[1],
    lambdaB * rB[2] - lambdaA * rA[2]
  ];
  const hVec: [number, number, number] = [
    lambdaD * rD[0] - lambdaA * rA[0],
    lambdaD * rD[1] - lambdaA * rA[1],
    lambdaD * rD[2] - lambdaA * rA[2]
  ];
  const w = Math.hypot(...wVec);
  const h = Math.hypot(...hVec);
  if (h < 1e-9 || !isFinite(w) || !isFinite(h)) return null;
  const aspect = w / h;
  // 合理範圍防呆（文件唔會極端長條）
  if (aspect < 0.2 || aspect > 5) return null;
  return aspect;
}

/**
 * 將 canvas 入面 quad 框住嘅梯形區域拉正成矩形。
 * 輸出尺寸＝四邊平均長（原圖像素），長邊唔超過 maxOutput。
 */
export function warpPerspective(
  canvas: HTMLCanvasElement,
  quad: Quad,
  maxOutput: number = 1600
): HTMLCanvasElement {
  const srcCtx = canvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
  const srcData = src.data;
  const SW = canvas.width;
  const SH = canvas.height;

  const outWNat = (dist(quad.tl, quad.tr) + dist(quad.bl, quad.br)) / 2;
  const outHNat = (dist(quad.tl, quad.bl) + dist(quad.tr, quad.br)) / 2;
  // 長闊比：優先用消失點反推真實比例（修正透視縮短），失敗先用平均邊長比
  const aspect = estimateQuadAspect(quad, canvas.width, canvas.height);
  const outHAdj = aspect ? outWNat / aspect : outHNat;
  const scale = Math.min(1, maxOutput / Math.max(outWNat, outHAdj));
  const W = Math.max(1, Math.round(outWNat * scale));
  const H = Math.max(1, Math.round(outHAdj * scale));

  const [a, b, c, d, e, f, g, h] = solveHomography(quad);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const outCtx = out.getContext('2d')!;
  const dst = outCtx.createImageData(W, H);
  const dd = dst.data;

  for (let y = 0; y < H; y++) {
    const v = H === 1 ? 0 : y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = W === 1 ? 0 : x / (W - 1);
      const den = g * u + h * v + 1;
      if (Math.abs(den) < 1e-9) continue;
      const sx = (a * u + b * v + c) / den;
      const sy = (d * u + e * v + f) / den;
      // bilinear 採樣；出界留白
      const di = (y * W + x) * 4;
      if (sx < 0 || sy < 0 || sx > SW - 1 || sy > SH - 1) {
        dd[di] = dd[di + 1] = dd[di + 2] = 255;
        dd[di + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(SW - 1, x0 + 1), y1 = Math.min(SH - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * SW + x0) * 4, i10 = (y0 * SW + x1) * 4;
      const i01 = (y1 * SW + x0) * 4, i11 = (y1 * SW + x1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = srcData[i00 + ch] * (1 - fx) + srcData[i10 + ch] * fx;
        const bot = srcData[i01 + ch] * (1 - fx) + srcData[i11 + ch] * fx;
        dd[di + ch] = top * (1 - fy) + bot * fy;
      }
      dd[di + 3] = 255;
    }
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
}
