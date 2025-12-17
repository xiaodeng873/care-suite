import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Eye, AlertCircle, CheckCircle, X } from 'lucide-react';
import { getTemplatesMetadata, uploadTemplateFile, createTemplateMetadata, deleteTemplateMetadata, deleteFileFromStorage, downloadTemplateFile } from '../lib/database';
import { extractRestraintConsentTemplateFormat } from '../utils/restraintConsentExcelGenerator';
import { extractRestraintObservationTemplateFormat } from '../utils/restraintObservationChartExcelGenerator';
import { extractPrescriptionTemplateFormat } from '../utils/prescriptionExcelGenerator';
import { extractWaitingListTemplateFormat } from '../utils/waitingListExcelGenerator';
import { extractVitalSignTemplateFormat } from '../utils/vitalsignExcelGenerator';
import { extractBloodSugarTemplateFormat } from '../utils/bloodSugarExcelGenerator';
import { extractBodyweightTemplateFormat } from '../utils/bodyweightExcelGenerator';
import { extractFollowUpTemplateFormat } from '../utils/followUpListGenerator';
import { extractPrintFormTemplateFormat } from '../utils/printFormExcelGenerator';
import { extractDiaperChangeTemplateFormat } from '../utils/diaperChangeExcelGenerator';
import { extractMedicationRecordTemplateFormat } from '../utils/medicationRecordExcelGenerator';
import { extractPersonalMedicationListTemplateFormat } from '../utils/personalMedicationListExcelGenerator';
import { extractAnnualHealthCheckupTemplateFormat } from '../utils/annualHealthCheckupExcelGenerator';

type TemplateType = 'waiting-list' | 'prescription' | 'medication-record' | 'personal-medication-list' | 'consent-form' | 'vital-signs' | 'blood-sugar' | 'weight-control' | 'follow-up-list' | 'restraint-observation' | 'diaper-change-record' | 'personal-hygiene-record' | 'admission-layout' | 'annual-health-checkup' | 'incident-report';

interface TemplateMetadata {
  id: number;
  name: string;
  type: TemplateType;
  original_name: string;
  storage_path: string;
  upload_date: string;
  file_size: number;
  description: string;
  extracted_format: any;
}

const TemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [selectedType, setSelectedType] = useState<TemplateType>('waiting-list');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateTypes = [
    { value: 'waiting-list', label: '院友候診記錄表', description: '醫生到診時的院友候診記錄' },
    { value: 'prescription', label: 'VMO處方箋', description: '醫生開立的處方箋' },
    { value: 'medication-record', label: '個人備藥及給藥記錄', description: '院友的個人用藥記錄' },
    { value: 'personal-medication-list', label: '個人藥物記錄', description: '院友的個人藥物處方清單' },
    { value: 'consent-form', label: '約束物品同意書', description: '約束物品使用同意書' },
    { value: 'vital-signs', label: '生命表徵觀察記錄表', description: '院友生命表徵監測記錄' },
    { value: 'blood-sugar', label: '血糖測試記錄表', description: '院友血糖監測記錄' },
    { value: 'weight-control', label: '體重記錄表', description: '院友體重監測記錄' },
    { value: 'follow-up-list', label: '覆診記錄表', description: '院友覆診安排記錄' },
    { value: 'restraint-observation', label: '約束物品觀察表', description: '約束物品使用觀察記錄' },
    { value: 'diaper-change-record', label: '換片記錄', description: '院友換片護理記錄表' },
    { value: 'personal-hygiene-record', label: '個人衛生記錄', description: '院友個人衛生護理記錄表' },
    { value: 'admission-layout', label: '入住排版', description: '院友入住相關文件排版' },
    { value: 'bed-layout', label: '床位表', description: '站點床位配置和院友分佈表' },
    { value: 'annual-health-checkup', label: '安老院住客體格檢驗報告書', description: '年度體格檢驗報告書範本' },
    { value: 'incident-report', label: '意外事件報告', description: '院友意外事件記錄報告' }
  ];

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplatesMetadata();
      setTemplates(data);
    } catch (error) {
      console.error('載入範本失敗:', error);
      alert('載入範本失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const extractTemplateFormatByType = async (file: File, type: TemplateType): Promise<any> => {
    console.log(`開始提取 ${type} 範本格式...`);
    
    try {
      switch (type) {
        case 'consent-form':
          return await extractRestraintConsentTemplateFormat(file);
        case 'restraint-observation':
          return await extractRestraintObservationTemplateFormat(file);
        case 'prescription':
          return await extractPrescriptionTemplateFormat(file);
        case 'waiting-list':
          return await extractWaitingListTemplateFormat(file);
        case 'vital-signs':
          return await extractVitalSignTemplateFormat(file);
        case 'blood-sugar':
          return await extractBloodSugarTemplateFormat(file);
        case 'weight-control':
          return await extractBodyweightTemplateFormat(file);
        case 'follow-up-list':
          return await extractFollowUpTemplateFormat(file);
        case 'diaper-change-record':
          return await extractDiaperChangeTemplateFormat(file);
        case 'medication-record':
          return await extractMedicationRecordTemplateFormat(file);
        case 'personal-medication-list':
          return await extractPersonalMedicationListTemplateFormat(file);
        case 'annual-health-checkup':
          return await extractAnnualHealthCheckupTemplateFormat(file);
        case 'personal-hygiene-record':
        case 'admission-layout':
        case 'bed-layout':
          return await extractPrintFormTemplateFormat(file);
        default:
          throw new Error(`不支援的範本類型: ${type}`);
      }
    } catch (error) {
      console.error(`提取 ${type} 範本格式失敗:`, error);
      throw error;
    }
  };

  const handleFileUpload = async (file: File) => {
    // 意外事件報告範本允許 Word 檔案
    if (selectedType === 'incident-report') {
      if (!file.name.match(/\.(docx)$/i)) {
        alert('意外事件報告範本請選擇 Word 檔案 (.docx)');
        return;
      }
    } else {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        alert('請選擇 Excel 檔案 (.xlsx 或 .xls)');
        return;
      }
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert('檔案大小不能超過 50MB');
      return;
    }

    // Sanitize filename for storage path
    const sanitizeFilename = (filename: string): string => {
      const extension = filename.substring(filename.lastIndexOf('.'));
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      
      // Replace non-ASCII characters, spaces, and special characters with underscores
      const sanitized = nameWithoutExt
        .replace(/[^\x00-\x7F]/g, '_') // Replace non-ASCII characters
        .replace(/\s+/g, '_') // Replace spaces
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace other special characters
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
      
      return sanitized + extension;
    };

    const uploadId = Date.now().toString();
    
    try {
      setUploading(true);
      setUploadProgress({ [uploadId]: 0 });

      // Step 1: Extract template format (skip for Word templates)
      console.log('第1步: 提取範本格式...');
      setUploadProgress({ [uploadId]: 20 });

      let extractedFormat: any = {};
      if (selectedType === 'incident-report') {
        // Word 範本不需要提取格式，使用空物件
        console.log('Word 範本，跳過格式提取');
        extractedFormat = {};
      } else {
        extractedFormat = await extractTemplateFormatByType(file, selectedType);
        console.log('範本格式提取完成:', extractedFormat);
      }

      // Step 2: Upload file to storage
      console.log('第2步: 上傳檔案到儲存空間...');
      setUploadProgress({ [uploadId]: 40 });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedFilename = sanitizeFilename(file.name);
      const storagePath = `${selectedType}/${timestamp}_${sanitizedFilename}`;
      
      const uploadedPath = await uploadTemplateFile(file, storagePath);
      if (!uploadedPath) {
        throw new Error('檔案上傳失敗');
      }
      console.log('檔案上傳成功:', uploadedPath);

      // Step 3: Save metadata to database
      console.log('第3步: 儲存範本元數據...');
      setUploadProgress({ [uploadId]: 80 });
      
      const templateName = `${templateTypes.find(t => t.value === selectedType)?.label || selectedType}_${timestamp}`;
      
      const metadata = {
        name: templateName,
        type: selectedType,
        original_name: file.name,
        storage_path: uploadedPath,
        file_size: file.size,
        description: templateTypes.find(t => t.value === selectedType)?.description || '',
        extracted_format: extractedFormat
      };

      const savedMetadata = await createTemplateMetadata(metadata);
      if (!savedMetadata) {
        throw new Error('儲存範本元數據失敗');
      }
      console.log('範本元數據儲存成功:', savedMetadata);

      setUploadProgress({ [uploadId]: 100 });
      
      // Refresh templates list
      await loadTemplates();
      
      alert(`範本「${templateName}」上傳成功！`);
      
    } catch (error) {
      console.error('上傳範本失敗:', error);

      let errorMessage = '上傳範本失敗：';
      if (error instanceof Error) {
        if (error.message.includes('Bucket not found')) {
          errorMessage += '\n\n請先在 Supabase Dashboard 中建立 "templates" 儲存桶。\n\n詳細設定說明請參考 SUPABASE_SETUP_INSTRUCTIONS.md 檔案。';
        } else if (error.message.includes('row-level security policy')) {
          errorMessage += '\n\n權限設定問題。請檢查 Supabase 的 Row Level Security 設定。\n\n詳細設定說明請參考 SUPABASE_SETUP_INSTRUCTIONS.md 檔案。';
        } else if (error.message.includes('缺少') && error.message.includes('工作表')) {
          errorMessage += '\n\n' + error.message;
          if (selectedType === 'medication-record') {
            errorMessage += '\n\n個人備藥及給藥記錄範本必須包含三個工作表：\n1. 個人備藥及給藥記錄 (口服)\n2. 個人備藥及給藥記錄 (外用)\n3. 個人備藥及給藥記錄 (注射)\n\n請確認您的範本檔案包含這三個工作表後重新上傳。';
          }
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += '未知錯誤';
      }

      alert(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress({});
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteTemplate = async (template: TemplateMetadata) => {
    if (!confirm(`確定要刪除範本「${template.name}」嗎？此操作無法復原。`)) {
      return;
    }

    try {
      // Delete from storage
      await deleteFileFromStorage(template.storage_path);

      // Delete metadata from database
      await deleteTemplateMetadata(template.id);

      // Refresh templates list
      await loadTemplates();
      alert(`範本「${template.name}」刪除成功`);
      
    } catch (error) {
      console.error('刪除範本失敗:', error);
      alert('刪除範本失敗，請重試');
    }
  };

  const handleDownloadTemplate = async (template: TemplateMetadata) => {
    try {
      await downloadTemplateFile(template.storage_path, template.original_name);
    } catch (error) {
      console.error('下載範本失敗:', error);
      alert('下載範本失敗，請重試');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTemplateTypeLabel = (type: TemplateType): string => {
    return templateTypes.find(t => t.value === type)?.label || type;
  };

  const getTemplateTypeColor = (type: TemplateType): string => {
    const colorMap: { [key in TemplateType]: string } = {
      'waiting-list': 'bg-blue-100 text-blue-800',
      'prescription': 'bg-green-100 text-green-800',
      'medication-record': 'bg-purple-100 text-purple-800',
      'consent-form': 'bg-yellow-100 text-yellow-800',
      'vital-signs': 'bg-red-100 text-red-800',
      'blood-sugar': 'bg-pink-100 text-pink-800',
      'weight-control': 'bg-indigo-100 text-indigo-800',
      'follow-up-list': 'bg-teal-100 text-teal-800',
      'restraint-observation': 'bg-orange-100 text-orange-800',
      'diaper-change-record': 'bg-cyan-100 text-cyan-800',
      'personal-hygiene-record': 'bg-lime-100 text-lime-800',
      'personal-medication-list': 'bg-violet-100 text-violet-800',
      'admission-layout': 'bg-amber-100 text-amber-800',
      'bed-layout': 'bg-emerald-100 text-emerald-800',
      'incident-report': 'bg-rose-100 text-rose-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">範本管理</h1>
      </div>

      {/* Upload Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">上傳新範本</h2>
        
        <div className="mb-4">
          <label className="form-label">範本類型</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as TemplateType)}
            className="form-input"
            disabled={uploading}
          >
            {templateTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-1">
            {templateTypes.find(t => t.value === selectedType)?.description}
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {uploading ? '上傳中...' : '拖放 Excel 檔案到此處'}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            {uploading ? '請稍候，正在處理範本...' : '或點擊下方按鈕選擇檔案'}
          </p>
          
          {!uploading && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
            >
              選擇檔案
            </button>
          )}
          
          {uploading && Object.values(uploadProgress).length > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Object.values(uploadProgress)[0]}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {Object.values(uploadProgress)[0]}% 完成
              </p>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept={selectedType === 'incident-report' ? '.docx' : '.xlsx,.xls'}
            onChange={handleFileInput}
            className="hidden"
            disabled={uploading}
          />
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p><strong>支援格式：</strong>{selectedType === 'incident-report' ? 'Word 檔案 (.docx)' : 'Excel 檔案 (.xlsx, .xls)'}</p>
          <p><strong>檔案大小限制：</strong>最大 50MB</p>
          <p><strong>注意事項：</strong>上傳的範本將用於自動生成對應的文件格式</p>
        </div>
      </div>

      {/* Templates List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">已上傳的範本</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">載入中...</p>
          </div>
        ) : templates.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {templates.map(template => (
              <div key={template.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTemplateTypeColor(template.type)}`}>
                        {getTemplateTypeLabel(template.type)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">原始檔名：</span>
                        {template.original_name}
                      </div>
                      <div>
                        <span className="font-medium">檔案大小：</span>
                        {formatFileSize(template.file_size)}
                      </div>
                      <div>
                        <span className="font-medium">上傳時間：</span>
                        {new Date(template.upload_date).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-2">{template.description}</p>
                    )}
                    
                    {/* Template format status */}
                    <div className="mt-3">
                      {template.extracted_format && Object.keys(template.extracted_format).length > 0 ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">範本格式已提取</span>
                          <span className="text-xs text-gray-500">
                            ({Object.keys(template.extracted_format.cellData || {}).length} 個儲存格樣式)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-orange-600">範本格式未提取</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownloadTemplate(template)}
                      className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50"
                      title="下載範本"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                      title="刪除範本"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無範本</h3>
            <p className="text-gray-600">上傳您的第一個範本以開始使用</p>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用說明</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <p>選擇對應的範本類型，然後上傳您的 Excel 範本檔案</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <p>系統會自動提取範本的格式（欄寬、列高、合併儲存格、字型、邊框等）</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <p>在相關功能中匯出資料時，系統會使用您上傳的範本格式</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">4</span>
            <p>如需更新範本，請刪除舊範本後重新上傳新版本</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateManagement;