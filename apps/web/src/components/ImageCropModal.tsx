import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crop } from 'lucide-react';
import { detectDocumentBounds } from '../utils/ocrProcessor';

interface ImageCropModalProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
  /**
   * 'square'（預設）：固定 1:1 裁剪框，拖曳圖片 + 滑桿縮放（院友相片）。
   * 'free'：圖片固定顯示，自由比例裁剪矩形可拖曳移動、四角縮放（文件/工作紙去周邊）。
   */
  mode?: 'square' | 'free';
  /** 標題（預設「裁剪圖片」） */
  title?: string;
  /** 確認輸出長邊上限（px），預設 1600 */
  maxOutput?: number;
}

// 正方形裁剪框邊長（CSS px，配合院友相片顯示比例）
const BOX = 320;
// free 模式裁剪矩形最小尺寸（顯示 px）
const MIN_RECT = 24;

interface Rect { x: number; y: number; w: number; h: number; }
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onConfirm, onCancel, mode = 'square', title = '裁剪圖片', maxOutput = 1600 }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  // square 模式 state
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // free 模式 state：圖片顯示尺寸 + 裁剪矩形（顯示 px，相對圖片左上角）
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const freeDragRef = useRef<{ handle: Handle; startX: number; startY: number; orig: Rect } | null>(null);

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
        // 預設全圖裁剪（留少少 inset 等用戶見到四角手柄）
        const fallback = { x: w * 0.02, y: h * 0.02, w: w * 0.96, h: h * 0.96 };
        // 自動偵測文件邊界：偵測到就直接框住張紙，失敗先落返全圖
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
                x: Math.max(0, bounds.x),
                y: Math.max(0, bounds.y),
                w: Math.min(bounds.w, w),
                h: Math.min(bounds.h, h)
              };
            }
          }
        } catch {
          // 偵測失敗（例如跨域圖片）→ 維持全圖預設
        }
        setRect(initial);
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

  /* ==================== free 模式 ==================== */

  const clampRect = (r: Rect): Rect => {
    const w = Math.min(Math.max(r.w, MIN_RECT), disp.w);
    const h = Math.min(Math.max(r.h, MIN_RECT), disp.h);
    return {
      w, h,
      x: Math.min(Math.max(r.x, 0), disp.w - w),
      y: Math.min(Math.max(r.y, 0), disp.h - h)
    };
  };

  const onFreePointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    freeDragRef.current = { handle, startX: e.clientX, startY: e.clientY, orig: { ...rect } };
  };
  const onFreePointerMove = (e: React.PointerEvent) => {
    const drag = freeDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const o = drag.orig;
    let r: Rect;
    switch (drag.handle) {
      case 'move':
        r = { ...o, x: o.x + dx, y: o.y + dy };
        break;
      case 'nw':
        r = { x: o.x + dx, y: o.y + dy, w: o.w - dx, h: o.h - dy };
        break;
      case 'ne':
        r = { x: o.x, y: o.y + dy, w: o.w + dx, h: o.h - dy };
        break;
      case 'sw':
        r = { x: o.x + dx, y: o.y, w: o.w - dx, h: o.h + dy };
        break;
      case 'se':
        r = { x: o.x, y: o.y, w: o.w + dx, h: o.h + dy };
        break;
    }
    // 角落 resize 時 x/y 唔可以推過對面邊
    if (r.w < MIN_RECT && (drag.handle === 'nw' || drag.handle === 'sw')) r.x = o.x + o.w - MIN_RECT;
    if (r.h < MIN_RECT && (drag.handle === 'nw' || drag.handle === 'ne')) r.y = o.y + o.h - MIN_RECT;
    setRect(clampRect(r));
  };
  const onFreePointerUp = () => { freeDragRef.current = null; };

  /* ==================== 輸出 ==================== */

  const handleConfirm = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mode === 'square') {
      // 裁剪框映射返原圖像素座標
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSize = BOX / scale;
      const outSize = Math.min(Math.round(sSize), maxOutput);
      canvas.width = outSize;
      canvas.height = outSize;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outSize, outSize);
    } else {
      if (!rect || disp.w === 0) return;
      const s = img.naturalWidth / disp.w; // 顯示 → 原圖比例
      const sx = rect.x * s;
      const sy = rect.y * s;
      const sw = rect.w * s;
      const sh = rect.h * s;
      const outScale = Math.min(1, maxOutput / Math.max(sw, sh));
      canvas.width = Math.max(1, Math.round(sw * outScale));
      canvas.height = Math.max(1, Math.round(sh * outScale));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }
    onConfirm(canvas.toDataURL('image/jpeg', 0.92));
  };

  const cornerHandle = (handle: Handle, style: React.CSSProperties) => (
    <div
      onPointerDown={onFreePointerDown(handle)}
      className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm z-10"
      style={{ ...style, cursor: `${handle}-resize`, touchAction: 'none' }}
    />
  );

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
                {rect && (
                  <div
                    className="absolute border-2 border-blue-500 cursor-move"
                    style={{
                      left: rect.x, top: rect.y, width: rect.w, height: rect.h,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                      touchAction: 'none'
                    }}
                    onPointerDown={onFreePointerDown('move')}
                  >
                    {cornerHandle('nw', { left: -8, top: -8 })}
                    {cornerHandle('ne', { right: -8, top: -8 })}
                    {cornerHandle('sw', { left: -8, bottom: -8 })}
                    {cornerHandle('se', { right: -8, bottom: -8 })}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">已自動框住文件範圍；拖曳四角或框內微調，去除周邊無關像素可提升識別準確度同速度。</p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button onClick={handleConfirm} disabled={!img || (mode === 'free' && !rect)} className="btn-primary flex-1">
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
