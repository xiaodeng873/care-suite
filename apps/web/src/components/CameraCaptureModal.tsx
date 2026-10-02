import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Image as ImageIcon, Trash2, X } from 'lucide-react';

interface CapturedPhoto {
  id: string;
  url: string;
  file: File;
}

interface CameraCaptureModalProps {
  /** 按「完成」後回呼已拍的所有相片（連拍可回傳多張） */
  onConfirm: (files: File[]) => void;
  /** 取消（已拍相片會被丟棄） */
  onCancel: () => void;
  /** 無相機 / 拒絕權限時，由 caller 決定的替代流程（例如改用相簿或原生相機） */
  onFallback: () => void;
}

/**
 * In-app 連拍相機：全螢幕 video 預覽，每按一次快門 capture 一幀加入佇列，
 * 不關相機可繼續連拍；底部縮圖列可逐張刪除，「完成」一次回傳所有相片。
 * 關閉 / unmount 時會 stop 所有 media tracks。
 */
const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  onConfirm,
  onCancel,
  onFallback,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [cameraError, setCameraError] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err) {
          console.error('無法開啟攝影機:', err);
          if (!cancelled) setCameraError(true);
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  // unmount 時釋放所有縮圖 object URL
  useEffect(() => {
    return () => {
      setPhotos(prev => {
        prev.forEach(p => URL.revokeObjectURL(p.url));
        return prev;
      });
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // 快門視覺反饋
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);

    canvas.toBlob(
      blob => {
        if (!blob) return;
        const timestamp = Date.now();
        const file = new File([blob], `capture-${timestamp}.jpg`, { type: 'image/jpeg' });
        setPhotos(prev => [
          ...prev,
          { id: `${timestamp}-${prev.length}`, url: URL.createObjectURL(blob), file },
        ]);
      },
      'image/jpeg',
      0.9,
    );
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(p => p.id !== id);
    });
  };

  const handleConfirm = () => {
    if (photos.length === 0) return;
    onConfirm(photos.map(p => p.file));
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col">
      {/* 頂部列 */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white text-sm font-medium">
          連續拍攝{photos.length > 0 ? `（已拍 ${photos.length} 張）` : ''}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-white hover:text-gray-300 rounded-full"
          aria-label="取消"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Camera className="h-12 w-12 text-gray-500" />
          <p className="text-white text-sm">
            無法開啟攝影機，請檢查相機權限設定，或改用相簿 / 檔案上傳。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onFallback}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
              改用相簿 / 檔案
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 預覽區 */}
          <div className="relative flex-1 min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* 快門白閃 */}
            <div
              className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${
                flash ? 'opacity-80' : 'opacity-0'
              }`}
            />
          </div>

          {/* 已拍縮圖列 */}
          {photos.length > 0 && (
            <div className="bg-black/80 px-4 py-2 overflow-x-auto">
              <div className="flex gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="relative flex-shrink-0">
                    <img
                      src={photo.url}
                      alt="已拍相片"
                      className="h-16 w-16 object-cover rounded-lg border border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-600 text-white hover:bg-red-700"
                      aria-label="刪除此張"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 底部控制列 */}
          <div className="bg-black px-4 pt-3 pb-6 flex items-center justify-between gap-4">
            <div className="w-24" />
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-shrink-0 h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center"
              aria-label="拍照"
            >
              <span className="h-11 w-11 rounded-full bg-white" />
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={photos.length === 0}
              className="w-24 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              <Check className="h-4 w-4" />
              完成{photos.length > 0 ? `（${photos.length} 張）` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CameraCaptureModal;
