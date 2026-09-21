import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crop } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

// 裁剪框邊長（CSS px，正方形 1:1，配合院友相片顯示比例）
const BOX = 320;

/**
 * 院友相片裁剪 modal：固定 1:1 裁剪框，拖曳移動圖片 + 滑桿縮放，
 * 確認後以原圖像素輸出（上限 1600px），交返 caller 做壓縮。
 */
const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  // baseScale：令圖片啱好冚住裁剪框嘅比例；zoom 係額外倍率
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setBaseScale(Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight));
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.src = imageSrc;
  }, [imageSrc]);

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

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, origX, origY } = dragRef.current;
    setOffset(clamp(origX + e.clientX - startX, origY + e.clientY - startY, scale));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleConfirm = () => {
    if (!img) return;
    // 裁剪框映射返原圖像素座標
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = BOX / scale;
    const outSize = Math.min(Math.round(sSize), 1600);
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outSize, outSize);
    onConfirm(canvas.toDataURL('image/jpeg', 0.92));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[70]" onClick={onCancel}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Crop className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">裁剪院友照片</h3>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg bg-gray-100 touch-none cursor-move select-none"
            style={{ width: BOX, height: BOX }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
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

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button onClick={handleConfirm} disabled={!img} className="btn-primary flex-1">
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
