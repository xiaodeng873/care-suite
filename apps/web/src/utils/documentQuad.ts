/**
 * 文件四邊形（透視）幾何：凸包、最小面積外接矩形、四角排序、面積。
 * detectDocumentBounds 嘅 quad 偵測用呢啲純函數，抽晒出嚟方便獨立測試。
 */

export interface QuadPoint { x: number; y: number; }

export interface DocQuad {
  tl: QuadPoint;
  tr: QuadPoint;
  br: QuadPoint;
  bl: QuadPoint;
}

const cross = (o: QuadPoint, a: QuadPoint, b: QuadPoint): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Andrew monotone chain 凸包（共線點剔除），輸出逆時針頂點 */
export function convexHull(points: QuadPoint[]): QuadPoint[] {
  if (points.length <= 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: QuadPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: QuadPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** rotating calipers：對凸包逐邊角度試轉，取面積最細嘅外接矩形（四角無固定順序） */
export function minAreaRect(hull: QuadPoint[]): { corners: QuadPoint[]; area: number } | null {
  if (hull.length < 3) return null;
  let best: { corners: QuadPoint[]; area: number } | null = null;
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
        { x: minX, y: maxY },
      ].map(p => ({ x: p.x * cosB - p.y * sinB, y: p.x * sinB + p.y * cosB }));
      best = { corners, area };
    }
  }
  return best;
}

/** 按相對位置定 tl/tr/br/bl（座標系 y 軸向下）：tl 最小 x+y，br 最大 x+y，tr 最大 x−y，bl 最小 x−y */
export function orderQuad(corners: QuadPoint[]): DocQuad {
  let tl = corners[0], tr = corners[0], br = corners[0], bl = corners[0];
  let minSum = Infinity, maxSum = -Infinity, maxDiff = -Infinity, minDiff = Infinity;
  for (const p of corners) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < minSum) { minSum = sum; tl = p; }
    if (sum > maxSum) { maxSum = sum; br = p; }
    if (diff > maxDiff) { maxDiff = diff; tr = p; }
    if (diff < minDiff) { minDiff = diff; bl = p; }
  }
  return { tl, tr, br, bl };
}

/** shoelace 四邊形面積 */
export function quadArea(q: DocQuad): number {
  const pts = [q.tl, q.tr, q.br, q.bl];
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
