import React, { useState, useEffect } from 'react';
import { Camera, ChevronDown, ChevronUp, Upload, X, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
import { getUserActivePrompt, getDefaultPrompt } from '../utils/promptManager';
import { usePatientData } from '../context/PatientContext';
import ImageSourcePicker from './ImageSourcePicker';

interface OCRPrescriptionBlockProps {
  onOCRComplete: (extractedData: any, confidenceScores: Record<string, number>) => void;
  onOCRError: (error: string) => void;
  // 揀咗/清除圖片時通知上層（處方儲存時會將圖片上傳 Storage）
  onImageSelected?: (file: File | null) => void;
}

const OCRPrescriptionBlock: React.FC<OCRPrescriptionBlockProps> = ({ onOCRComplete, onOCRError, onImageSelected }) => {
  const { patients } = usePatientData();
  const [isExpanded, setIsExpanded] = useState(false);
  // 多圖支援（仿 OCRDocumentBlock followup 分支）：逐張 OCR，每張可含 records 多藥
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Prompt 只讀取使用；編輯已搬到「系統設定 → 輔助工具」
  const [prompt, setPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    loadPromptData();
  }, []);

  const loadPromptData = async () => {
    const userPrompt = await getUserActivePrompt();
    if (userPrompt) {
      setPrompt(userPrompt);
    } else {
      const defaultPrompt = await getDefaultPrompt();
      setPrompt(defaultPrompt);
    }
  };

  /** 載入圖片（拍照/相簿/拖放共用，可多張追加） */
  const loadFiles = (files: File[]) => {
    files.forEach(file => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        onOCRError(validation.error || '無效的圖片檔案');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFiles(prev => {
          const next = [...prev, file];
          // 單圖流程維持現行 onImageSelected 回調（處方儲存時上傳 Storage）；
          // 多圖時圖片改由批量核對 modal 處理，這裡回 null
          onImageSelected?.(next.length === 1 ? file : null);
          return next;
        });
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.onerror = () => onOCRError('無法讀取圖片檔案');
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (idx: number) => {
    setSelectedFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onImageSelected?.(next.length === 1 ? next[0] : null);
      return next;
    });
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    setOcrResult(null);
  };

  const handlePickerSelect = (files: File[]) => {
    if (isProcessing) return;
    loadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) {
      return;
    }

    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length) loadFiles(files);
  };

  const handleClearImages = () => {
    setSelectedFiles([]);
    setImagePreviews([]);
    setOcrResult(null);
    onImageSelected?.(null);
  };

  /** 與 ocrFieldMapper 的 findPatientByName 相同的院友姓名匹配邏輯 */
  const findMatchingPatient = (name: unknown): number | undefined => {
    if (!name || !patients || patients.length === 0) return undefined;
    const cleanName = String(name).trim().replace(/\s+/g, '');
    if (!cleanName) return undefined;

    for (const patient of patients) {
      const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.replace(/\s+/g, '');
      const patientName = patient.中文姓名?.replace(/\s+/g, '');
      if (patientFullName === cleanName || patientName === cleanName) return patient.院友id;
    }
    for (const patient of patients) {
      const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.replace(/\s+/g, '');
      const patientName = patient.中文姓名?.replace(/\s+/g, '');
      if (patientFullName.includes(cleanName) || (patientFullName && cleanName.includes(patientFullName))) {
        return patient.院友id;
      }
      if (patientName && (patientName.includes(cleanName) || cleanName.includes(patientName))) {
        return patient.院友id;
      }
    }
    return undefined;
  };

  const handleStartOCR = async () => {
    // 防止重複執行（React Strict Mode 或連點防護）
    if (isProcessing) return;

    if (selectedFiles.length === 0) {
      onOCRError('請先選擇圖片');
      return;
    }

    if (!prompt.trim()) {
      onOCRError('請輸入或選擇Prompt');
      return;
    }

    setIsProcessing(true);
    setOcrResult(null);

    try {
      setProcessingStage('正在壓縮圖片...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // 逐張識別；每張結果有 records（多藥）則展開，否則當一筆；全部聚合
      const aggregated: Record<string, unknown>[] = [];
      let firstExtractedData: any = null;
      let lastResult: any = null;
      let lastError: string | null = null;

      for (let i = 0; i < selectedFiles.length; i++) {
        setProcessingStage(
          selectedFiles.length > 1
            ? `正在識別第 ${i + 1}/${selectedFiles.length} 張圖片...`
            : '正在使用AI...'
        );
        const result = await processImageWithGeminiVision(selectedFiles[i], prompt, false, undefined);
        lastResult = result;
        if (!result.success || !result.extractedData) {
          lastError = result.error || 'OCR識別失敗';
          continue;
        }
        const ed = result.extractedData;
        if (!firstExtractedData) firstExtractedData = ed;
        const recs = Array.isArray(ed.records) ? ed.records : null;
        if (recs && recs.length > 0) {
          recs.forEach((r: any) => {
            if (r && typeof r === 'object') aggregated.push({ ...r, __sourceImageIndex: i });
          });
        } else {
          const { records: _records, ...topLevel } = ed;
          aggregated.push({ ...topLevel, __sourceImageIndex: i });
        }
      }

      if (!firstExtractedData) {
        setIsProcessing(false);
        setProcessingStage('');
        onOCRError(lastError || 'OCR識別失敗');
        return;
      }

      setProcessingStage('正在匹配院友資料...');
      await new Promise(resolve => setTimeout(resolve, 300));

      const matchedPatientId = findMatchingPatient(firstExtractedData.院友姓名);

      setIsProcessing(false);
      setProcessingStage('');
      setOcrResult(lastResult);

      if (aggregated.length <= 1) {
        // 單筆：payload 與現行完全相同（單圖單藥流程不變）
        onOCRComplete(
          { ...firstExtractedData, patient_id: matchedPatientId },
          lastResult.confidenceScores || {}
        );
      } else {
        onOCRComplete(
          {
            ...firstExtractedData,
            records: aggregated,
            patient_id: matchedPatientId,
            imagePreviews,
            imageFiles: selectedFiles,
          },
          lastResult.confidenceScores || {}
        );
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingStage('');
      onOCRError(error.message || '處理過程發生錯誤');
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 mb-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-white hover:bg-opacity-50 transition-colors rounded-lg"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Camera className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">智能識別處方標籤</h3>
            <p className="text-sm text-gray-600">上傳處方標籤圖片，自動識別並填入資料</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ocrResult?.success && (
            <span className="flex items-center space-x-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>已識別</span>
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-4">
              <div>
                <label className="form-label">
                  圖片上傳
                  {selectedFiles.length > 0 && (
                    <span className="ml-2 text-xs text-green-600">
                      ✓ 已選擇 {selectedFiles.length} 張圖片
                    </span>
                  )}
                </label>
                <div className="relative">
                  <ImageSourcePicker
                    onSelect={handlePickerSelect}
                    albumMultiple
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                  >
                    {(openPicker) => (
                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={imagePreviews.length > 0 || isProcessing ? undefined : openPicker}
                        className={`flex flex-col items-center justify-center w-full ${imagePreviews.length > 0 ? '' : 'h-40'} border-2 border-dashed rounded-lg transition-colors ${
                          imagePreviews.length > 0
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50 cursor-pointer'
                        } ${isProcessing ? 'opacity-50' : ''}`}
                      >
                        {imagePreviews.length > 0 ? (
                          <div className="flex flex-wrap gap-2 p-3 w-full">
                            {imagePreviews.map((src, i) => (
                              <div key={i} className="relative w-20 h-20">
                                <img
                                  src={src}
                                  alt={`圖片${i + 1}`}
                                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveImage(i);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                                  disabled={isProcessing}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isProcessing) openPicker();
                              }}
                              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-500"
                            >
                              <Upload className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClearImages();
                              }}
                              className="self-center text-xs text-red-600 hover:text-red-700 px-2"
                              disabled={isProcessing}
                            >
                              全部清除
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Upload className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 mb-2">點擊拍照或選擇相簿圖片（支援多張）</p>
                            <p className="text-xs text-gray-500">支援 JPG、PNG、WEBP 格式，亦可拖放圖片到此</p>
                          </div>
                        )}
                      </div>
                    )}
                  </ImageSourcePicker>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleStartOCR}
                  disabled={selectedFiles.length === 0 || isProcessing || !prompt.trim()}
                  className="btn-primary w-full flex flex-wrap items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>{processingStage}</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-5 w-5" />
                      <span>開始識別</span>
                    </>
                  )}
                </button>
              </div>

              {ocrResult && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                    <h4 className="font-medium text-gray-900">識別結果</h4>
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {showRawText ? '隱藏' : '顯示'}原始文字
                    </button>
                  </div>
                  {ocrResult.success ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>識別成功 ({ocrResult.processingTimeMs}ms)</span>
                      </div>
                      {showRawText && ocrResult.text && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 max-h-32 overflow-y-auto">
                          {ocrResult.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{ocrResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">使用提示：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>請確保圖片清晰，文字可辨識</li>
                  <li>支援多張圖片及一張藥單多種藥物，識別後會開批量核對視窗逐項確認</li>
                  <li>識別後的資料會自動填入對應欄位，請務必檢查並修正錯誤</li>
                  <li>低信心度的欄位會有特別標示，請特別注意</li>
                  <li>智能識別指令可到「系統設定 → 輔助工具」修改</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRPrescriptionBlock;
