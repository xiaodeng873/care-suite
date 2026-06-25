import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  parseGeminiResponse,
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
const STILLNESS_DURATION = 450; // 需維持靜止的毫秒數（縮短以加快觸發）
const SAMPLE_INTERVAL = 120; // 取樣間隔（縮短以更快偵測穩定）
const SAMPLE_W = 80; // 取樣縮圖寬（用於偵測靜止，省效能）
const SAMPLE_H = 60;
const CAPTURE_MAX_EDGE = 1280; // 送 Gemini 前縮放長邊上限：縮小負載、加速上傳與推論，又保留 LCD 數字清晰度
const MAX_AUTO_RETRIES = 6; // 連續辨識失敗上限，達到後才停下提示手動輸入

// 血壓計 / 血糖儀的 Gemini Vision prompt
const DEVICE_PROMPTS: Record<VitalRecordType, string> = {
  '生命表徵': `你是醫療設備讀取專家。圖片是電子血壓計的螢幕。
螢幕上通常有三個大型數字（7 段式 LCD）：
- 最上方數字為 SYS 收縮壓（常見範圍 90–200）
- 中間數字為 DIA 舒張壓（常見範圍 50–130）
- 最下方數字（常伴隨心形圖示）為 PULSE 脈搏（常見範圍 40–150）
請讀出這三個數字，忽略 mmHg、日期、時間等文字。
只返回 JSON，不要任何其他文字或說明：
{"血壓收縮壓": 120, "血壓舒張壓": 80, "脈搏": 72}
若某個數字確實看不清楚，省略該欄位。`,
  '血糖控制': `你是醫療設備讀取專家。圖片是血糖儀的螢幕。
螢幕中央有一個大型主要數字，即血糖讀數（單位 mmol/L，常見範圍 2.0–30.0，通常含一位小數）。
請只讀取這個主要的血糖數字，忽略電池格、日期、時間、單位文字等其他顯示資訊。
只返回 JSON，不要任何其他文字或說明：
{"血糖值": 6.5}`,
};

const VitalSignScanner: React.FC<VitalSignScannerProps> = ({ recordType, onResult, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevSampleRef = useRef<Uint8ClampedArray | null>(null);
  const stillSinceRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const failCountRef = useRef(0);

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

  // 擷取相機畫面送 Gemini 辨識。
  // 重要：送「彩色、未經灰階/強對比處理」的高品質影像，與文件識別一致。
  // 灰階+強對比是傳統 OCR(Tesseract) 的前處理，會讓 LCD 反光區死白、
  // 數字邊緣斷裂，反而降低 Gemini Vision 的辨識率。
  const buildCaptureDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = captureCanvasRef.current ?? document.createElement('canvas');
    captureCanvasRef.current = canvas;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // 將長邊縮放至上限，縮小 payload 與 Gemini 推論成本（小螢幕數字仍清晰）
    const scale = Math.min(1, CAPTURE_MAX_EDGE / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const runGeminiRecognition = useCallback(async () => {
    const dataUrl = buildCaptureDataUrl();
    if (!dataUrl) {
      busyRef.current = false;
      return;
    }
    setPhase('recognizing');
    let recognised = false;
    try {
      const base64 = dataUrl.split(',')[1];
      const { data, error } = await supabase.functions.invoke('gemini-vision-extract', {
        body: {
          imageBase64: base64,
          mimeType: 'image/jpeg',
          prompt: DEVICE_PROMPTS[recordType],
          fastMode: true, // 關閉模型 thinking、降低 token 上限，大幅縮短回應時間
        },
      });
      if (error || !data?.success) {
        // Edge Function 層級錯誤（金鑰、模型、配額等）
        console.error('[掃描] Gemini 呼叫失敗:', data?.error ?? error?.message ?? error, data);
      } else {
        const result = parseGeminiResponse(data.extractedData, recordType);
        if (result.success) {
          recognised = true;
          failCountRef.current = 0;
          onResult(result);
          return;
        }
        // Gemini 有回應但讀數未通過驗證 → 印出原始讀數方便診斷，並自動重試
        console.warn('[掃描] Gemini 有回應但未通過驗證，將自動重試。原始讀數:', data.extractedData);
      }
    } catch (err) {
      console.error('[掃描] Gemini 辨識例外:', err);
    } finally {
      busyRef.current = false;
    }

    // 本次未成功：累計失敗次數，未達上限則由偵測迴圈自動重試
    if (!recognised) {
      failCountRef.current += 1;
      if (failCountRef.current >= MAX_AUTO_RETRIES) {
        stopDetectionLoop();
        setPhase('failed');
      }
    }
  }, [buildCaptureDataUrl, onResult, recordType, stopDetectionLoop]);

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
          // 不停止迴圈，只用 busyRef 暫停取樣；辨識失敗後自動重試。
          busyRef.current = true;
          stillSinceRef.current = null;
          void runGeminiRecognition();
        }
      } else {
        stillSinceRef.current = null;
        setPhase('aligning');
      }
    }
    prevSampleRef.current = new Uint8ClampedArray(curr);
  }, [runGeminiRecognition, stopDetectionLoop]);

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    prevSampleRef.current = null;
    stillSinceRef.current = null;
    busyRef.current = false;
    failCountRef.current = 0;
    setPhase('aligning');
    intervalRef.current = setInterval(sampleTick, SAMPLE_INTERVAL);
  }, [sampleTick, stopDetectionLoop]);

  const handleRetry = useCallback(() => {
    failCountRef.current = 0;
    setError(null);
    startDetectionLoop();
  }, [startDetectionLoop]);

  // 初始化：相機
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
        if (!cancelled) startDetectionLoop();
      } catch (err: any) {
        if (cancelled) return;
        const msg =
          err?.name === 'NotAllowedError'
            ? '鏡頭權限被拒絕，請改用手動輸入。'
            : '無法啟動鏡頭，請改用手動輸入。';
        setError(msg);
        setPhase('failed');
      }
    };

    void init();

    return () => {
      cancelled = true;
      stopDetectionLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
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
