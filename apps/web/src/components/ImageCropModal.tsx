import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crop } from 'lucide-react';
import { detectDocumentBounds } from '../utils/ocrProcessor';
import { warpPerspective, type Quad, type Point } from '../utils/perspectiveCrop';

interface ImageCropModalProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
  /**
   * 'square'（預設）：固定 1:1 裁剪框，拖曳圖片 + 滑桿縮放（院友相片）。
   * 'free'：圖片固定顯示，四角透視裁剪——四隻角自由拖動點住文件四角，
   * 確認後透視拉正成矩形（文件/工作紙去周邊兼修正透視變形）。
   */
  mode?: 'square' | 'free';
  /** 標題（預設「裁剪圖片」） */
  title?: string;
  /** 確認輸出長邊上限（px），預設 1600 */
  maxOutput?: number;
}

// 正方形裁剪框邊長（CSS px，配合院友相片顯示比例）
const BOX = 320;

type CornerKey = keyof Quad; // 'tl' | 'tr' | 'br' | 'bl'
type DragTarget = CornerKey | 'move';

const CORNERS: CornerKey[] = ['tl', 'tr', 'br', 'bl'];

const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onConfirm, onCancel, mode = 'square', title = '裁剪圖片', maxOutput = 1600 }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  // square 模式 state
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // free 模式 state：圖片顯示尺寸 + 四角透視 quad（顯示 px，相對圖片左上角）
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [quad, setQuad] = useState<Quad | null>(null);
  const freeDragRef = useRef<{ target: DragTarget; startX: number; startY: number; orig: Quad } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      if (mode === 'square') {
        setBaseScale(Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight));
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else {
        const maxW = Math.min(720, window.innerWidth * 0.85);
        const maxH = window.innerHeight * 0.55;
        const s = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
        const w = image.naturalWidth * s;
        const h = image.naturalHeight * s;
        setDisp({ w, h });
        // 預設全圖四隻角（留少少 inset 等用戶見到角柄）
        const insetX = w * 0.02, insetY = h * 0.02;
        const fallback: Quad = {
          tl: { x: insetX, y: insetY },
          tr: { x: w - insetX, y: insetY },
          br: { x: w - insetX, y: h - insetY },
          bl: { x: insetX, y: h - insetY }
        };
        // 自動偵測文件邊界：偵測到就用 bounding box 四角做初始 quad，失敗先落返全圖
        let initial = fallback;
        try {
          const dc = document.createElement('canvas');
          dc.width = Math.round(w);
          dc.height = Math.round(h);
          const dctx = dc.getContext('2d');
          if (dctx && dc.width > 0 && dc.height > 0) {
            dctx.drawImage(image, 0, 0, dc.width, dc.height);
            const bounds = detectDocumentBounds(dc);
            if (bounds) {
              initial = {
                tl: { x: bounds.x, y: bounds.y },
                tr: { x: bounds.x + bounds.w, y: bounds.y },
                br: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
                bl: { x: bounds.x, y: bounds.y + bounds.h }
              };
            }
          }
        } catch {
          // 偵測失敗（例如跨域圖片）→ 維持全圖預設
        }
        setQuad(initial);
      }
    };
    image.src = imageSrc;
  }, [imageSrc, mode]);

  /* ==================== square 模式 ==================== */

  const scale = baseScale * zoom;

  // 圖片任何時候都要冚住裁剪框：offset 範圍 [BOX - 圖寬*s, 0]
  const clamp = useCallback((x: number, y: number, s: number) => {
    if (!img) return { x: 0, y: 0 };
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    return {
      x: Math.min(0, Math.max(BOX - w, x)),
      y: Math.min(0, Math.max(BOX - h, y))
    };
  }, [img]);

  const handleZoom = (z: number) => {
    const s = baseScale * z;
    setZoom(z);
    setOffset((prev) => clamp(prev.x, prev.y, s));
  };

  const onSquarePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onSquarePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, origX, origY } = dragRef.current;
    setOffset(clamp(origX + e.clientX - startX, origY + e.clientY - startY, scale));
  };
  const onSquarePointerUp = () => { dragRef.current = null; };

  /* ==================== free 模式（四角透視） ==================== */

  const clampPoint = (p: Point): Point => ({
    x: Math.min(Math.max(p.x, 0), disp.w),
    y: Math.min(Math.max(p.y, 0), disp.h)
  });

  const onFreePointerDown = (target: DragTarget) => (e: React.PointerEvent) => {
    if (!quad) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    freeDragRef.current = { target, startX: e.clientX, startY: e.clientY, orig: { ...quad } };
  };
  const onFreePointerMove = (e: React.PointerEvent) => {
    const drag = freeDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const o = drag.orig;
    if (drag.target === 'move') {
      // 成個 quad 移動：以最小包圍盒邊界做 clamp，避免推出圖外
      const minX = Math.min(o.tl.x, o.tr.x, o.br.x, o.bl.x);
      const maxX = Math.max(o.tl.x, o.tr.x, o.br.x, o.bl.x);
      const minY = Math.min(o.tl.y, o.tr.y, o.br.y, o.bl.y);
      const maxY = Math.max(o.tl.y, o.tr.y, o.br.y, o.bl.y);
      const cdx = Math.min(Math.max(dx, -minX), disp.w - maxX);
      const cdy = Math.min(Math.max(dy, -minY), disp.h - maxY);
      setQuad({
        tl: { x: o.tl.x + cdx, y: o.tl.y + cdy },
        tr: { x: o.tr.x + cdx, y: o.tr.y + cdy },
        br: { x: o.br.x + cdx, y: o.br.y + cdy },
        bl: { x: o.bl.x + cdx, y: o.bl.y + cdy }
      });
    } else {
      setQuad({ ...o, [drag.target]: clampPoint({ x: o[drag.target].x + dx, y: o[drag.target].y + dy }) });
    }
  };
  const onFreePointerUp = () => { freeDragRef.current = null; };

  /* ==================== 輸出 ==================== */

  const handleConfirm = () => {
    if (!img) return;

    if (mode === 'square') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // 裁剪框映射返原圖像素座標
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSize = BOX / scale;
      const outSize = Math.min(Math.round(sSize), maxOutput);
      canvas.width = outSize;
      canvas.height = outSize;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outSize, outSize);
      onConfirm(canvas.toDataURL('image/jpeg', 0.92));
      return;
    }

    // free：四角 quad → 原圖像素座標 → 透視拉正成矩形
    if (!quad || disp.w === 0) return;
    const s = img.naturalWidth / disp.w; // 顯示 → 原圖比例
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.naturalWidth;
    srcCanvas.height = img.naturalHeight;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;
    srcCtx.drawImage(img, 0, 0);
    const naturalQuad: Quad = {
      tl: { x: quad.tl.x * s, y: quad.tl.y * s },
      tr: { x: quad.tr.x * s, y: quad.tr.y * s },
      br: { x: quad.br.x * s, y: quad.br.y * s },
      bl: { x: quad.bl.x * s, y: quad.bl.y * s }
    };
    const out = warpPerspective(srcCanvas, naturalQuad, maxOutput);
    onConfirm(out.toDataURL('image/jpeg', 0.92));
  };

  const quadPath = quad
    ? `${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[70]" onClick={onCancel}>
      <div className={`bg-white rounded-lg w-full p-6 ${mode === 'free' ? 'max-w-3xl' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Crop className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {mode === 'square' ? (
          <>
            <div className="flex justify-center">
              <div
                className="relative overflow-hidden rounded-lg bg-gray-100 touch-none cursor-move select-none"
                style={{ width: BOX, height: BOX }}
                onPointerDown={onSquarePointerDown}
                onPointerMove={onSquarePointerMove}
                onPointerUp={onSquarePointerUp}
                onPointerCancel={onSquarePointerUp}
              >
                {img && (
                  <img
                    src={imageSrc}
                    alt="裁剪預覽"
                    draggable={false}
                    className="absolute max-w-none"
                    style={{
                      width: img.naturalWidth * scale,
                      height: img.naturalHeight * scale,
                      left: offset.x,
                      top: offset.y
                    }}
                  />
                )}
                {/* 邊框提示裁剪範圍 */}
                <div className="absolute inset-0 border-2 border-dashed border-white/80 pointer-events-none rounded-lg" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-gray-500 whitespace-nowrap">縮放</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoom(parseFloat(e.target.value))}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">拖曳圖片調整位置，拉動滑桿縮放。</p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                className="relative select-none"
                style={{ width: disp.w, height: disp.h }}
                onPointerMove={onFreePointerMove}
                onPointerUp={onFreePointerUp}
                onPointerCancel={onFreePointerUp}
              >
                {img && (
                  <img
                    src={imageSrc}
                    alt="裁剪預覽"
                    draggable={false}
                    className="absolute inset-0 w-full h-full"
                  />
                )}
                {quad && disp.w > 0 && (
                  <>
                    {/* 遮罩：quad 以外變暗 + quad 邊線；點擊 polygon 可成個拖移 */}
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox={`0 0 ${disp.w} ${disp.h}`}
                      style={{ touchAction: 'none' }}
                    >
                      <defs>
                        <mask id="crop-mask">
                          <rect x="0" y="0" width={disp.w} height={disp.h} fill="white" />
                          <polygon points={quadPath} fill="black" />
                        </mask>
                      </defs>
                      <rect x="0" y="0" width={disp.w} height={disp.h} fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" pointerEvents="none" />
                      <polygon
                        points={quadPath}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        className="cursor-move"
                        onPointerDown={onFreePointerDown('move')}
                      />
                    </svg>
                    {CORNERS.map((key) => (
                      <div
                        key={key}
                        onPointerDown={onFreePointerDown(key)}
                        className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm z-10 cursor-grab"
                        style={{ left: quad[key].x - 8, top: quad[key].y - 8, touchAction: 'none' }}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">已自動框住文件範圍；拖動四隻角點齊文件四角，確認後會透視拉正，去除周邊無關像素可提升識別準確度同速度。</p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button onClick={handleConfirm} disabled={!img || (mode === 'free' && !quad)} className="btn-primary flex-1">
            確認裁剪
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1">
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
