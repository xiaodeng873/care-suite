import React, { useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Upload, X, Loader, FileText, RefreshCw, CreditCard } from 'lucide-react';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
import { getDefaultPrompt } from '../utils/promptManager';

interface OCRIDCardBlockProps {
  onOCRComplete: (extractedData: any) => void;
  onOCRError: (error: string) => void;
}

const OCRIDCardBlock: React.FC<OCRIDCardBlockProps> = ({ onOCRComplete, onOCRError }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRawText, setShowRawText] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      onOCRError(validation.error || '無效的圖片檔案');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      onOCRError(validation.error || '無效的圖片檔案');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setOcrResult(null);
    setShowRawText(false);
    const fileInput = document.getElementById('idcard-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleStartOCR = async (skipCache: boolean = false) => {
    // 防止重複執行（React Strict Mode 或連點防護）
    if (isProcessing) return;

    if (!selectedFile) {
      onOCRError('請先選擇圖片');
      return;
    }

    setIsProcessing(true);
    setOcrResult(null);

    try {
      if (skipCache) {
        setProcessingStage('強制重新識別（跳過快取）...');
      } else {
        setProcessingStage('正在壓縮圖片...');
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingStage('正在使用 Gemini Vision 視覺識別...');
      const prompt = await getDefaultPrompt();
      const result = await processImageWithGeminiVision(selectedFile, prompt, skipCache, undefined);

      if (result.success && result.extractedData) {
        setIsProcessing(false);
        setProcessingStage('');
        setOcrResult(result);
        onOCRComplete(result.extractedData);
      } else {
        setIsProcessing(false);
        setProcessingStage('');
        onOCRError(result.error || 'OCR識別失敗');
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingStage('');
      onOCRError(error.message || '處理過程發生錯誤');
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200 mb-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white hover:bg-opacity-50 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <CreditCard className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">智能識別身份證</h3>
            <p className="text-sm text-gray-600">上傳身份證圖片，自動識別並填入資料</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {ocrResult && (
            <span className="text-green-600 text-sm font-medium flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              已識別
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
        <div className="px-4 pb-4 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <FileText className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">使用提示：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>請確保圖片清晰，文字可辨識</li>
                  <li>識別後資料會自動填入對應欄位</li>
                  <li>請務必檢查並修正識別結果</li>
                  <li>支援香港身份證正反面</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                圖片上傳
              </label>
              <div className="relative">
                <input
                  id="idcard-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="idcard-file-input"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors relative"
                >
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveImage();
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 mb-2">點擊選擇或拖放圖片</p>
                      <p className="text-xs text-gray-500 mb-3">支援 JPG、PNG、WEBP 格式</p>
                      <div className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                        選擇檔案
                      </div>
                    </div>
                  )}
                </label>
              </div>
              {selectedFile && (
                <p className="text-xs text-gray-600 mt-1">
                  檔案: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleStartOCR(false)}
                disabled={!selectedFile || isProcessing}
                className="btn-primary w-full flex items-center justify-center space-x-2"
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

              {ocrResult && (
                <button
                  type="button"
                  onClick={() => handleStartOCR(true)}
                  disabled={!selectedFile || isProcessing}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>強制重新識別（清除快取）</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {ocrResult && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">識別結果</h4>
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    {showRawText ? '隱藏原始文字' : '顯示原始文字'}
                  </button>
                </div>

                {showRawText && ocrResult.text && (
                  <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap break-words">
                      {ocrResult.text}
                    </p>
                  </div>
                )}

                <div className="text-sm text-gray-700">
                  <div className="grid grid-cols-2 gap-2">
                    {ocrResult.extractedData.中文姓名 && (
                      <div>
                        <span className="font-medium">中文姓名：</span>
                        <span>{ocrResult.extractedData.中文姓名}</span>
                      </div>
                    )}
                    {ocrResult.extractedData.英文姓名 && (
                      <div>
                        <span className="font-medium">英文姓名：</span>
                        <span>{ocrResult.extractedData.英文姓名}</span>
                      </div>
                    )}
                    {ocrResult.extractedData.身份證號碼 && (
                      <div>
                        <span className="font-medium">身份證號碼：</span>
                        <span>{ocrResult.extractedData.身份證號碼}</span>
                      </div>
                    )}
                    {ocrResult.extractedData.出生日期 && (
                      <div>
                        <span className="font-medium">出生日期：</span>
                        <span>{ocrResult.extractedData.出生日期}</span>
                      </div>
                    )}
                    {ocrResult.extractedData.性別 && (
                      <div>
                        <span className="font-medium">性別：</span>
                        <span>{ocrResult.extractedData.性別}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  處理時間: {ocrResult.processingTimeMs}ms
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function CheckCircle({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default OCRIDCardBlock;
