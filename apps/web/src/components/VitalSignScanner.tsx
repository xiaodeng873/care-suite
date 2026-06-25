import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader, RefreshCw, X } from 'lucide-react';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
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

type Phase = 'idle' | 'recognizing' | 'failed';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = recordType === '血糖控制' ? '血糖儀' : '血壓計';

  const openCamera = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  // 進入時自動開啟原生相機（沿用使用者點擊「掃描」的手勢）
  useEffect(() => {
    const t = setTimeout(() => fileInputRef.current?.click(), 0);
    return () => clearTimeout(t);
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // 允許重拍同一張
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || '無效的圖片檔案');
        setPhase('failed');
        return;
      }

      // 預覽
      const previewUrl = URL.createObjectURL(file);
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return previewUrl;
      });
      setPhase('recognizing');
      setError(null);

      try {
        // 走與「智能識別文件」相同的成功路徑：原生相機高品質照片 → 彩色壓縮 → Gemini（含 thinking）
        const ocr = await processImageWithGeminiVision(file, DEVICE_PROMPTS[recordType], true, undefined);

        if (!ocr.success || !ocr.extractedData) {
          setError(ocr.error || 'AI 視覺識別失敗，請重拍或改用手動輸入。');
          setPhase('failed');
          return;
        }

        const parsed = parseGeminiResponse(ocr.extractedData as Record<string, unknown>, recordType);
        if (!parsed.success) {
          console.warn('[拍照辨識] 有回應但未通過驗證，原始讀數:', ocr.extractedData);
          setError('讀數無法確認，請對準螢幕重拍，或改用手動輸入。');
          setPhase('failed');
          return;
        }

        onResult(parsed);
      } catch (err: any) {
        console.error('[拍照辨識] 例外:', err);
        setError(err?.message || '處理過程發生錯誤，請重試。');
        setPhase('failed');
      }
    },
    [onResult, recordType],
  );

  // 卸載時釋放預覽 URL
  useEffect(() => {
    return () => {
      setImagePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* 隱藏的原生相機輸入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* 頂部狀態列 */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white text-sm font-medium">拍攝{targetLabel}</span>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full bg-black/50 text-white"
          aria-label="取消"
        >
          <X size={22} />
        </button>
      </div>

      {/* 預覽 / 內容區 */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="拍攝預覽"
            className="max-h-[60vh] w-auto max-w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="text-center text-white/80">
            <Camera size={64} className="mx-auto mb-4 opacity-70" />
            <p className="text-base">請拍攝{targetLabel}的螢幕，盡量正對、清晰、避免反光</p>
          </div>
        )}
      </div>

      {/* 底部狀態 / 操作 */}
      <div className="relative z-10 p-6 bg-gradient-to-t from-black/80 to-transparent space-y-4">
        {phase === 'recognizing' && (
          <div className="flex items-center justify-center gap-2 text-white">
            <Loader size={20} className="animate-spin" />
            <span className="text-base font-medium">辨識中…</span>
          </div>
        )}

        {phase === 'failed' && (
          <p className="text-center text-red-300 text-sm">{error ?? '辨識失敗，請重拍。'}</p>
        )}

        {phase !== 'recognizing' && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={openCamera}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-medium active:bg-blue-700"
            >
              {phase === 'failed' ? <RefreshCw size={18} /> : <Camera size={18} />}
              {phase === 'failed' ? '重拍' : `拍攝${targetLabel}`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-full bg-white/15 text-white font-medium active:bg-white/25"
            >
              手動輸入
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VitalSignScanner;
