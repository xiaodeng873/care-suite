// test-perspective：用真實針孔相機模型投影一張 3D 文件，驗證 warpPerspective 拉正＋比例還原
const path = require('path');
const esbuild = require('esbuild');
const { createCanvas } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');

global.document = {
  createElement: (tag) => (tag === 'canvas' ? createCanvas(1, 1) : {}),
};

// 針孔投影：文件平面 z=0，尺寸 PW x PH，相機旋轉 R + 平移 t，焦距 f，主點 (cx,cy)
function makeProjectedPhoto(PW, PH, tiltXDeg, yawYDeg, distZ, f, imgW, imgH) {
  const rx = (tiltXDeg * Math.PI) / 180, ry = (yawYDeg * Math.PI) / 180;
  const cxr = Math.cos(rx), sxr = Math.sin(rx), cyr = Math.cos(ry), syr = Math.sin(ry);
  // R = Ry * Rx
  const R = [
    [cyr, 0, syr],
    [sxr * syr, cxr, -sxr * cyr],
    [-cxr * syr, sxr, cxr * cyr]
  ];
  const t = [0, 0, distZ];
  const cx = imgW / 2, cy = imgH / 2;
  const project = (X) => {
    const [x, y, z] = X;
    const wx = R[0][0] * x + R[0][1] * y + R[0][2] * z + t[0];
    const wy = R[1][0] * x + R[1][1] * y + R[1][2] * z + t[1];
    const wz = R[2][0] * x + R[2][1] * y + R[2][2] * z + t[2];
    return { x: (f * wx) / wz + cx, y: (f * wy) / wz + cy, z: wz };
  };

  const corners3d = [
    [-PW / 2, -PH / 2, 0], // tl
    [PW / 2, -PH / 2, 0],  // tr
    [PW / 2, PH / 2, 0],   // br
    [-PW / 2, PH / 2, 0]   // bl
  ];
  const proj = corners3d.map(project);
  const quad = { tl: proj[0], tr: proj[1], br: proj[2], bl: proj[3] };

  // 畫 photo：深灰背景，逐像素反查文件平面（z=0）決定顏色
  const photo = createCanvas(imgW, imgH);
  const pctx = photo.getContext('2d');
  pctx.fillStyle = 'rgb(50,50,50)';
  pctx.fillRect(0, 0, imgW, imgH);
  const img = pctx.getImageData(0, 0, imgW, imgH);
  // 反投影：射線（世界座標）與文件平面 z=0 相交。世界系下平面法線就係 (0,0,1)
  const n = [0, 0, 1];
  // 射線：cam 原點喺世界座標 = -Rᵀ·t；方向 dir = Rᵀ·[(x-cx)/f, (y-cy)/f, 1]
  const Rt = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
  const camPos = [
    -(Rt[0][0] * t[0] + Rt[0][1] * t[1] + Rt[0][2] * t[2]),
    -(Rt[1][0] * t[0] + Rt[1][1] * t[1] + Rt[1][2] * t[2]),
    -(Rt[2][0] * t[0] + Rt[2][1] * t[1] + Rt[2][2] * t[2])
  ];
  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const d = [(x - cx) / f, (y - cy) / f, 1];
      const dir = [
        Rt[0][0] * d[0] + Rt[0][1] * d[1] + Rt[0][2] * d[2],
        Rt[1][0] * d[0] + Rt[1][1] * d[1] + Rt[1][2] * d[2],
        Rt[2][0] * d[0] + Rt[2][1] * d[1] + Rt[2][2] * d[2]
      ];
      const denom = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
      if (Math.abs(denom) < 1e-12) continue;
      const lambda = -(n[0] * camPos[0] + n[1] * camPos[1] + n[2] * camPos[2]) / denom;
      if (lambda <= 0) continue;
      const px = camPos[0] + lambda * dir[0];
      const py = camPos[1] + lambda * dir[1];
      if (px < -PW / 2 || px > PW / 2 || py < -PH / 2 || py > PH / 2) continue;
      // 文件內容：白色底 + 一個黑色標記喺 (u=0.2, v=0.16) 附近
      const u = (px + PW / 2) / PW, v = (py + PH / 2) / PH;
      const inMark = u > 0.125 && u < 0.375 && v > 0.12 && v < 0.28;
      const val = inMark ? 0 : 255;
      const di = (y * imgW + x) * 4;
      img.data[di] = img.data[di + 1] = img.data[di + 2] = val;
      img.data[di + 3] = 255;
    }
  }
  pctx.putImageData(img, 0, 0);
  return { photo, quad };
}

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'apps/web/src/utils/perspectiveCrop.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, require);
  const { warpPerspective, estimateQuadAspect } = mod.exports;

  const { photo, quad } = makeProjectedPhoto(400, 500, 35, 12, 900, 700, 560, 700);
  console.log(`quad: tl(${quad.tl.x.toFixed(0)},${quad.tl.y.toFixed(0)}) tr(${quad.tr.x.toFixed(0)},${quad.tr.y.toFixed(0)}) br(${quad.br.x.toFixed(0)},${quad.br.y.toFixed(0)}) bl(${quad.bl.x.toFixed(0)},${quad.bl.y.toFixed(0)})`);

  const aspect = estimateQuadAspect(quad, 560, 700);
  console.log(`估計長闊比 ${aspect?.toFixed(3)}（真實 0.800）`);

  const t0 = Date.now();
  const out = warpPerspective(photo, quad, 1600);
  const ms = Date.now() - t0;
  console.log(`輸出 ${out.width}x${out.height}，耗時 ${ms}ms`);

  const octx = out.getContext('2d');
  const px = octx.getImageData(Math.round(out.width * 0.2), Math.round(out.height * 0.16), 1, 1).data;
  const isBlack = px[0] < 100;
  console.log(`${isBlack ? 'PASS' : 'FAIL'} 標記位置正確拉正（rgb=${px[0]},${px[1]},${px[2]}）`);

  const corner = octx.getImageData(2, 2, 1, 1).data;
  const isWhite = corner[0] > 200;
  console.log(`${isWhite ? 'PASS' : 'FAIL'} 角落係文件白色（rgb=${corner[0]},${corner[1]},${corner[2]}）`);

  const ratio = out.width / out.height;
  const ratioOk = Math.abs(ratio - 0.8) < 0.05;
  console.log(`${ratioOk ? 'PASS' : 'FAIL'} 長闊比 ≈ 0.8（實際 ${ratio.toFixed(3)}）`);
})();
