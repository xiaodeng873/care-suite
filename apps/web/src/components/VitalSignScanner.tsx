import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { createWorker, type Worker } from 'tesseract.js';
import {
  parseVitalSignWords,
  type OcrWord,
  type VitalRecordType,
  type VitalSignScanResult,
} from '../utils/vitalSignOcrParser';

interface VitalSignScannerProps {
  recordType: VitalRecordType;
  onResult: (result: VitalSignScanResult) => void;
  onCancel: () => void;
}

type Phase = 'loading' | 'aligning' | 'detecting' | 'recognizing' | 'failed';

const STILLNESS_THRESHOLD = 12; // 平均像素差 (0-255) 低於此值視為靜止
const STILLNESS_DURATION = 1200; // 需維持靜止的毫秒數
const SAMPLE_INTERVAL = 200; // 取樣間隔
const SAMPLE_W = 80; // 取樣縮圖寬（用於偵測靜止，省效能）
const SAMPLE_H = 60;

// 從 Tesseract recognize 結果攤平出每個帶座標的文字詞。
const extractWords = (data: any): OcrWord[] => {
  const words: OcrWord[] = [];
  const blocks = data?.blocks ?? [];
  for (const b of blocks) {
    for (const p of b?.paragraphs ?? []) {
      for (const l of p?.lines ?? []) {
        for (const w of l?.words ?? []) {
          const bbox = w?.bbox;
          if (!bbox) continue;
          words.push({ text: w.text ?? '', x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 });
        }
      }
    }
  }
  return words;
};

const VitalSignScanner: React.FC<VitalSignScannerProps> = ({ recordType, onResult, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevSampleRef = useRef<Uint8ClampedArray | null>(null);
  const stillSinceRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  const stopDetectionLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    prevSampleRef.current = null;
    stillSinceRef.current = null;
  }, []);

  // 影像前處理：灰階 + 對比增強 + 2 倍放大，提升 LCD/LED 儀表辨識率。
  const buildPreprocessedDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = captureCanvasRef.current ?? document.createElement('canvas');
    captureCanvasRef.current = canvas;
    const scale = 2;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const contrast = 1.6;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      let v = contrast * gray + intercept;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }, []);

  const runRecognition = useCallback(async () => {
    const worker = workerRef.current;
    if (!worker) return;
    const dataUrl = buildPreprocessedDataUrl();
    if (!dataUrl) {
      busyRef.current = false;
      return;
    }
    setPhase('recognizing');
    try {
      const { data } = await worker.recognize(dataUrl, {}, { blocks: true } as any);
      const words = extractWords(data);
      const result = parseVitalSignWords(words, recordType);
      if (result.success) {
        onResult(result);
        return;
      }
      setPhase('failed');
    } catch (err) {
      console.error('OCR 辨識失敗:', err);
      setPhase('failed');
    } finally {
      busyRef.current = false;
    }
  }, [buildPreprocessedDataUrl, onResult, recordType]);

  // 靜止偵測：縮圖取樣，比較與上一幀的平均像素差。
  const sampleTick = useCallback(() => {
    if (busyRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = sampleCanvasRef.current ?? document.createElement('canvas');
    sampleCanvasRef.current = canvas;
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const curr = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
    const prev = prevSampleRef.current;

    if (prev) {
      let sum = 0;
      for (let i = 0; i < curr.length; i += 4) {
        const cg = curr[i] * 0.299 + curr[i + 1] * 0.587 + curr[i + 2] * 0.114;
        const pg = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
        sum += Math.abs(cg - pg);
      }
      const meanDiff = sum / (curr.length / 4);
      const now = Date.now();
      if (meanDiff < STILLNESS_THRESHOLD) {
        if (stillSinceRef.current == null) stillSinceRef.current = now;
        setPhase('detecting');
        if (now - stillSinceRef.current >= STILLNESS_DURATION) {
          busyRef.current = true;
          stopDetectionLoop();
          void runRecognition();
        }
      } else {
        stillSinceRef.current = null;
        setPhase('aligning');
      }
    }
    prevSampleRef.current = new Uint8ClampedArray(curr);
  }, [runRecognition, stopDetectionLoop]);

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    prevSampleRef.current = null;
    stillSinceRef.current = null;
    busyRef.current = false;
    setPhase('aligning');
    intervalRef.current = setInterval(sampleTick, SAMPLE_INTERVAL);
  }, [sampleTick, stopDetectionLoop]);

  const handleRetry = useCallback(() => {
    setError(null);
    startDetectionLoop();
  }, [startDetectionLoop]);

  // 初始化：相機 + Tesseract worker。
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg =
          err?.name === 'NotAllowedError'
            ? '鏡頭權限被拒絕，請改用手動輸入。'
            : '無法啟動鏡頭，請改用手動輸入。';
        setError(msg);
        setPhase('failed');
        return;
      }

      try {
        const worker = await createWorker('eng');
        if (cancelled) {
          await worker.terminate();
          return;
        }
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789./% ',
        });
        workerRef.current = worker;
        if (!cancelled) startDetectionLoop();
      } catch (err) {
        if (cancelled) return;
        console.error('OCR 引擎載入失敗:', err);
        setError('辨識引擎載入失敗，請改用手動輸入。');
        setPhase('failed');
      }
    };

    void init();

    return () => {
      cancelled = true;
      stopDetectionLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const w = workerRef.current;
      workerRef.current = null;
      if (w) void w.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = (): string => {
    switch (phase) {
      case 'loading':
        return '載入中…';
      case 'aligning':
        return '請對準儀表螢幕，保持穩定';
      case 'detecting':
        return '偵測中，請保持穩定…';
      case 'recognizing':
        return '辨識中…';
      case 'failed':
        return error ?? '辨識失敗，請重新對準';
      default:
        return '';
    }
  };

  const targetLabel = recordType === '血糖控制' ? '血糖儀' : '血壓計';

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* 頂部狀態列 */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white text-sm font-medium">掃描{targetLabel}</span>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full bg-black/50 text-white"
          aria-label="取消掃描"
        >
          <X size={22} />
        </button>
      </div>

      {/* 對準框 */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm aspect-[4/3] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>

      {/* 底部狀態 / 失敗操作 */}
      <div className="relative z-10 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-center text-white text-base font-medium mb-4">{statusText()}</p>
        {phase === 'failed' ? (
          <div className="flex gap-3">
            {!error && (
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 py-3 rounded-xl bg-white text-gray-900 font-semibold"
              >
                重試
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/40"
            >
              手動輸入
            </button>
          </div>
        ) : (
          <p className="text-center text-white/70 text-xs">將{targetLabel}讀數置於框內，系統會自動擷取</p>
        )}
      </div>
    </div>
  );
};

export default VitalSignScanner;
