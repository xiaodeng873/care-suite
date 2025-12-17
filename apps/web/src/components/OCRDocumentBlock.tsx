import React, { useState, useEffect } from 'react';
import { Camera, ChevronDown, ChevronUp, Upload, X, Loader, CheckCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
import { getDefaultPrompt } from '../utils/promptManager';
import { usePatients } from '../context/PatientContext';

interface OCRDocumentBlockProps {
  documentType: 'vaccination' | 'diagnosis' | 'followup';
  onOCRComplete: (extractedData: any) => void;
  onOCRError: (error: string) => void;
}

const OCRDocumentBlock: React.FC<OCRDocumentBlockProps> = ({ documentType, onOCRComplete, onOCRError }) => {
  const { patients } = usePatients();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  const titles = {
    vaccination: '智能識別疫苗記錄',
    diagnosis: '智能識別診斷記錄',
    followup: '智能識別覆診預約'
  };

  const descriptions = {
    vaccination: '上傳疫苗記錄圖片，自動識別並填入資料',
    diagnosis: '上傳診斷記錄圖片，自動識別並填入資料',
    followup: '上傳覆診預約便條圖片，自動識別並填入資料'
  };

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
    reader.onerror = () => {
      onOCRError('無法讀取圖片檔案');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
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
    reader.onerror = () => {
      onOCRError('無法讀取圖片檔案');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setOcrResult(null);
    const fileInput = document.getElementById(`ocr-file-input-${documentType}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const findMatchingPatient = (extractedData: any): number | undefined => {
    if (!patients || patients.length === 0) return undefined;

    let bestMatch: { patient: any; score: number } | null = null;

    patients.forEach(patient => {
      let score = 0;

      const chineseNameToMatch = extractedData.中文姓名 || extractedData.姓名 || extractedData.院友姓名;
      if (chineseNameToMatch) {
        const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.trim();
        if (patientFullName === chineseNameToMatch || patientFullName.includes(chineseNameToMatch)) {
          score += 40;
        }
      }

      const englishNameToMatch = extractedData.英文姓名 || extractedData.English_Name;
      if (englishNameToMatch) {
        const patientEnglishName = `${patient.英文姓氏 || ''} ${patient.英文名字 || ''}`.toLowerCase().trim();
        const extractedLower = String(englishNameToMatch).toLowerCase().trim();
        if (patientEnglishName && (patientEnglishName === extractedLower || patientEnglishName.includes(extractedLower))) {
          score += 35;
        }
      }

      const idToMatch = extractedData.身份證號碼 || extractedData.HKID;
      if (idToMatch && patient.身份證號碼) {
        const patientId = patient.身份證號碼.replace(/\s+/g, '').toUpperCase();
        const extractedId = String(idToMatch).replace(/\s+/g, '').toUpperCase();

        if (patientId === extractedId) {
          score += 50;
        } else {
          let matchedPositions = 0;
          let totalValidPositions = 0;
          const maxLength = Math.max(patientId.length, extractedId.length);

          for (let i = 0; i < maxLength; i++) {
            const extractedChar = extractedId[i];
            const patientChar = patientId[i];

            if (extractedChar && extractedChar !== 'X' && extractedChar !== '_' &&
                extractedChar !== '*' && extractedChar !== '(' && extractedChar !== ')') {
              totalValidPositions++;
              if (patientChar && extractedChar === patientChar) {
                matchedPositions++;
              }
            }
          }

          if (matchedPositions >= 3 && totalValidPositions > 0) {
            const matchRate = matchedPositions / totalValidPositions;
            if (matchRate >= 0.6) {
              score += Math.round(25 + (matchRate - 0.6) * 37.5);
            }
          }
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { patient, score };
      }
    });

    return bestMatch ? bestMatch.patient.院友id : undefined;
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
        setProcessingStage('正在匹配院友資料...');
        await new Promise(resolve => setTimeout(resolve, 300));

        const matchedPatientId = findMatchingPatient(result.extractedData);

        const dataWithPatientId = {
          ...result.extractedData,
          patient_id: matchedPatientId
        };

        setIsProcessing(false);
        setProcessingStage('');
        setOcrResult(result);
        setForceRefresh(false);
        onOCRComplete(dataWithPatientId);
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
    <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200 mb-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white hover:bg-opacity-50 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Camera className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{titles[documentType]}</h3>
            <p className="text-sm text-gray-600">{descriptions[documentType]}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
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
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id={`ocr-file-input-${documentType}`}
                    disabled={isProcessing}
                  />
                  <label
                    htmlFor={`ocr-file-input-${documentType}`}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={(e) => {
                      if (imagePreview) {
                        e.preventDefault();
                      }
                    }}
                    className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors ${
                      imagePreview
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50 cursor-pointer active:bg-blue-100'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        <p className="text-sm text-gray-600 mb-2">點擊選擇或拖放圖片</p>
                        <p className="text-xs text-gray-500 mb-3">支援 JPG、PNG、WEBP 格式</p>
                        <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
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
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {showRawText ? '隱藏' : '顯示'}原始文字
                    </button>
                  </div>
                  {ocrResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-green-600">
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
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{ocrResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">使用提示：</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>請確保圖片清晰，文字可辨識</li>
                      <li>識別後的資料會自動填入對應欄位</li>
                      <li>請務必檢查並修正錯誤資料</li>
                      <li>支援多筆記錄自動新增</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRDocumentBlock;
