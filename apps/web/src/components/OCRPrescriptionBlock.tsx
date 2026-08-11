import React, { useState, useEffect } from 'react';
import { Camera, ChevronDown, ChevronUp, Upload, X, Loader, CheckCircle, AlertTriangle, RefreshCw, Save, RotateCcw } from 'lucide-react';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
import { getPromptTemplates, getUserActivePrompt, saveUserPrompt, getDefaultPrompt, PromptTemplate } from '../utils/promptManager';
import ImageSourcePicker from './ImageSourcePicker';

interface OCRPrescriptionBlockProps {
  onOCRComplete: (extractedData: any, confidenceScores: Record<string, number>) => void;
  onOCRError: (error: string) => void;
}

const OCRPrescriptionBlock: React.FC<OCRPrescriptionBlockProps> = ({ onOCRComplete, onOCRError }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    loadPromptData();
  }, []);

  const loadPromptData = async () => {
    const templates = await getPromptTemplates();
    setPromptTemplates(templates);

    if (templates.length > 0) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
    }

    const userPrompt = await getUserActivePrompt();
    if (userPrompt) {
      setPrompt(userPrompt);
    } else {
      const defaultPrompt = await getDefaultPrompt();
      setPrompt(defaultPrompt);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      setPrompt(template.prompt_content);
    }
  };

  const handleSavePrompt = async () => {
    const success = await saveUserPrompt(prompt);
    if (success) {
      alert('Prompt已儲存為您的預設設定');
    } else {
      alert('儲存Prompt失敗，請重試');
    }
  };

  const handleRestoreDefault = async () => {
    const defaultPrompt = await getDefaultPrompt();
    setPrompt(defaultPrompt);
    const defaultTemplate = promptTemplates.find(t => t.is_default);
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  };

  /** 載入單張圖片（拍照/相簿/拖放共用） */
  const loadFile = (file: File) => {
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
    reader.onerror = () => {
      console.error('FileReader error');
      onOCRError('無法讀取圖片檔案');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePickerSelect = (files: File[]) => {
    if (isProcessing) return;
    const file = files[0];
    if (file) loadFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) {
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setOcrResult(null);
  };

  const handleStartOCR = async () => {
    // 防止重複執行（React Strict Mode 或連點防護）
    if (isProcessing) return;

    if (!selectedFile) {
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

      setProcessingStage('正在使用AI...');
      const result = await processImageWithGeminiVision(selectedFile, prompt, false, undefined);

      setIsProcessing(false);
      setProcessingStage('');

      if (result.success && result.extractedData) {
        setOcrResult(result);
        onOCRComplete(result.extractedData, result.confidenceScores || {});
      } else {
        onOCRError(result.error || 'OCR識別失敗');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="form-label">
                  圖片上傳
                  {selectedFile && (
                    <span className="ml-2 text-xs text-green-600">
                      ✓ 已選擇檔案
                    </span>
                  )}
                </label>
                <div className="relative">
                  <ImageSourcePicker
                    onSelect={handlePickerSelect}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                  >
                    {(openPicker) => (
                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={imagePreview || isProcessing ? undefined : openPicker}
                        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors ${
                          imagePreview
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50 cursor-pointer'
                        } ${isProcessing ? 'opacity-50' : ''}`}
                      >
                        {imagePreview ? (
                          <div className="relative w-full h-full p-2">
                            <img
                              src={imagePreview}
                              alt="預覽"
                              className="w-full h-full object-contain rounded"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClearImage();
                              }}
                              className="absolute top-3 right-3 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                              disabled={isProcessing}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Upload className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 mb-2">點擊拍照或選擇相簿圖片</p>
                            <p className="text-xs text-gray-500">支援 JPG、PNG、WEBP 格式，亦可拖放圖片到此</p>
                          </div>
                        )}
                      </div>
                    )}
                  </ImageSourcePicker>
                </div>
                {selectedFile && (
                  <p className="text-xs text-gray-600 mt-1">
                    檔案: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleStartOCR}
                  disabled={!selectedFile || isProcessing || !prompt.trim()}
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

            <div className="space-y-4">
              <div>
                <label className="form-label">Prompt模板</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="form-input"
                  disabled={isProcessing}
                >
                  <option value="">選擇模板...</option>
                  {promptTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.is_default ? '(預設)' : ''}
                    </option>
                  ))}
                </select>
                {promptTemplates.find(t => t.id === selectedTemplateId)?.description && (
                  <p className="text-xs text-gray-600 mt-1">
                    {promptTemplates.find(t => t.id === selectedTemplateId)?.description}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">AI識別指令 (Prompt)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="form-input font-mono text-sm"
                  rows={8}
                  placeholder="輸入AI識別指令..."
                  disabled={isProcessing}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
                  <p className="text-xs text-gray-500">
                    自訂prompt可提高識別準確度
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreDefault}
                      className="text-xs text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                      disabled={isProcessing}
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>恢復預設</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      disabled={isProcessing}
                    >
                      <Save className="h-3 w-3" />
                      <span>儲存為預設</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">使用提示：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>請確保圖片清晰，文字可辨識</li>
                  <li>識別後的資料會自動填入對應欄位，請務必檢查並修正錯誤</li>
                  <li>低信心度的欄位會有特別標示，請特別注意</li>
                  <li>可以修改Prompt來改善識別效果</li>
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
