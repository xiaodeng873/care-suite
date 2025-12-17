import React, { useState, useEffect } from 'react';
import { X, Upload, Camera, Loader, CheckCircle, AlertTriangle, Save, RotateCcw, Trash2, Edit2, Plus } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { processImageWithGeminiVision, validateImageFile } from '../utils/ocrProcessor';
import { supabase } from '../lib/supabase';
import PatientAutocomplete from './PatientAutocomplete';

interface BatchHealthRecordOCRModalProps {
  onClose: () => void;
}

interface ExtractedRecord {
  id: string;
  imageFile: File;
  imagePreview: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  rawData?: any;
  parsedRecords?: ParsedHealthRecord[];
}

interface ParsedHealthRecord {
  tempId: string;
  院友id: number | null;
  記錄類型: '生命表徵' | '血糖控制' | '體重控制';
  記錄日期: string;
  記錄時間: string;
  血壓收縮壓?: number;
  血壓舒張壓?: number;
  脈搏?: number;
  血糖值?: number;
  體重?: number;
  備註?: string;
  task_id?: string | null;
  matchedPatient?: any;
  matchedTask?: any;
  區域?: string;
}

const DEFAULT_PROMPT = `你是醫療記錄數據提取專家。請從手寫健康記錄表圖片中提取所有院友的健康監測數據。

**重要：如果數值缺失或無法辨識，請直接省略該欄位，不要輸出 null 或空字串。**

**時間標記解析規則：**
- 7A 或 7a → 07:00
- 12N 或 12n → 12:00
- 4P 或 4p → 16:00
- 其他時間直接轉換為 HH:MM 格式

**提取規則：**
1. 識別所有院友的床號和姓名
2. 提取每位院友的監測數據（生命表徵、血糖、體重）
3. 每位院友的每個時間點都是一條獨立記錄
4. **只輸出有值的欄位，跳過空白或無法辨識的數據**
5. 記錄日期從表格標題提取（格式：YYYY-MM-DD）

**返回JSON格式：**
{
  "記錄日期": "2025-01-15",
  "records": [
    {
      "床號": "A01",
      "院友姓名": "陳大文",
      "記錄時間": "07:00",
      "記錄類型": "生命表徵",
      "血壓收縮壓": 120,
      "血壓舒張壓": 80,
      "脈搏": 72,
      "體溫": 36.5,
      "血含氧量": 98,
      "呼吸頻率": 18
    },
    {
      "床號": "A01",
      "院友姓名": "陳大文",
      "記錄時間": "12:00",
      "記錄類型": "血糖控制",
      "血糖值": 5.5
    }
  ]
}

**注意：只包含已填寫的數據欄位，空白欄位不要輸出。所有數值都是數字類型，時間都轉換為標準格式。**`;

const BatchHealthRecordOCRModal: React.FC<BatchHealthRecordOCRModalProps> = ({ onClose }) => {
  const { patients, patientHealthTasks, healthRecords, addHealthRecord } = usePatients();
  const { displayName } = useAuth();

  const [images, setImages] = useState<ExtractedRecord[]>([]);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allParsedRecords, setAllParsedRecords] = useState<ParsedHealthRecord[]>([]);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUserPrompt();
  }, []);

  const loadUserPrompt = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_ocr_prompts')
        .select('batch_health_record_prompt')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (data?.batch_health_record_prompt) {
        setPrompt(data.batch_health_record_prompt);
      }
    } catch (error) {
      console.error('載入Prompt失敗:', error);
    }
  };

  const saveUserPrompt = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_ocr_prompts')
        .update({ is_active: false })
        .eq('user_id', user.id);

      await supabase
        .from('user_ocr_prompts')
        .insert({
          user_id: user.id,
          prompt_content: '',
          batch_health_record_prompt: prompt,
          is_active: true
        });

      alert('Prompt已儲存');
    } catch (error) {
      console.error('儲存Prompt失敗:', error);
      alert('儲存失敗');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => validateImageFile(file).valid);

    const newImages: ExtractedRecord[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
      status: 'pending'
    }));

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const parseTimeMarker = (timeStr: string | null | undefined): string => {
    // 空值保護：如果沒有時間，返回預設值 08:00
    if (!timeStr) return '08:00';

    const time = timeStr.trim().toLowerCase();

    // 如果trim後是空字串，返回預設值
    if (!time) return '08:00';

    if (time.match(/^7[ap]?$/i)) return '07:00';
    if (time.match(/^12[np]?$/i)) return '12:00';
    if (time.match(/^4p?$/i)) return '16:00';

    const match = time.match(/^(\d{1,2}):?(\d{2})?$/);
    if (match) {
      const hour = match[1].padStart(2, '0');
      const minute = match[2] || '00';
      return `${hour}:${minute}`;
    }

    return time;
  };

  // 將24小時制轉換為12小時制 + AM/PM
  const convertTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // 將12小時制 + AM/PM 轉換為24小時制
  const convertTo24Hour = (time12: string): string => {
    if (!time12) return '';
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return time12;

    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const matchPatient = (床號: string | null | undefined, 院友姓名: string | null | undefined): any => {
    // 空值保護：如果兩者都沒有，無法匹配
    if (!床號 && !院友姓名) return null;

    // 只匹配在住院友
    return patients.find(p =>
      p.在住狀態 === '在住' &&
      (
        (床號 && p.床號 === 床號) ||
        (院友姓名 && p.中文姓名 === 院友姓名) ||
        (p.中文姓名 && 院友姓名 && p.中文姓名.includes(院友姓名))
      )
    );
  };

  const matchTask = (patientId: number, recordType: string | null | undefined, recordDate: string, recordTime: string): any => {
    // 空值保護：如果沒有記錄類型或時間，無法匹配
    if (!recordType || !recordTime) return null;

    const patientTasks = patientHealthTasks.filter(t =>
      t.patient_id === patientId.toString() &&
      t.health_record_type === recordType
    );

    if (patientTasks.length === 0) return null;

    const targetDateTime = new Date(`${recordDate}T${recordTime}`);

    for (const task of patientTasks) {
      if (!task.specific_times || task.specific_times.length === 0) continue;

      for (const taskTime of task.specific_times) {
        const taskDateTime = new Date(`${recordDate}T${taskTime}`);
        const diffMinutes = Math.abs((targetDateTime.getTime() - taskDateTime.getTime()) / 60000);

        if (diffMinutes <= 30) {
          return { task, matchType: 'exact' };
        }
      }
    }

    for (const task of patientTasks) {
      if (!task.specific_times || task.specific_times.length === 0) continue;

      for (const taskTime of task.specific_times) {
        const taskDateTime = new Date(`${recordDate}T${taskTime}`);
        const diffMinutes = Math.abs((targetDateTime.getTime() - taskDateTime.getTime()) / 60000);

        if (diffMinutes <= 60) {
          return { task, matchType: 'fuzzy' };
        }
      }
    }

    return null;
  };

  const handleStartOCR = async (skipCache: boolean = false) => {
    // 防止重複執行（React Strict Mode 或連點防護）
    if (isProcessing) return;

    if (images.length === 0) {
      alert('請先上傳圖片');
      return;
    }

    setIsProcessing(true);
    const allRecords: ParsedHealthRecord[] = [];

    for (const image of images) {
      setImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, status: 'processing' } : img
      ));

      try {
        const result = await processImageWithGeminiVision(image.imageFile, prompt, skipCache);

        if (result.success && result.extractedData) {
          const { 記錄日期, records } = result.extractedData;

          if (!記錄日期 || !records || !Array.isArray(records)) {
            console.error('[BatchOCR] 數據格式錯誤:', { 記錄日期, records });
            setImages(prev => prev.map(img =>
              img.id === image.id
                ? { ...img, status: 'error', error: 'AI返回的數據格式不正確，請檢查Prompt' }
                : img
            ));
            continue;
          }

          if (records.length === 0) {
            console.warn('[BatchOCR] AI未識別到任何記錄');
            setImages(prev => prev.map(img =>
              img.id === image.id
                ? { ...img, status: 'error', error: 'AI未識別到任何記錄，請檢查圖片是否清晰' }
                : img
            ));
            continue;
          }

          console.log(`[BatchOCR] 正在解析 ${records.length} 條記錄`);

          const parsedRecords: ParsedHealthRecord[] = records.map((record: any, index: number) => {
            console.log(`[BatchOCR] 處理第 ${index + 1} 條記錄:`, {
              床號: record.床號,
              姓名: record.院友姓名,
              時間: record.記錄時間,
              類型: record.記錄類型
            });

            const recordTime = parseTimeMarker(record.記錄時間);
            const matchedPatient = matchPatient(record.床號, record.院友姓名);

            if (!recordTime) {
              console.warn(`[BatchOCR] 第 ${index + 1} 條記錄缺少時間`);
            }
            if (!matchedPatient) {
              console.warn(`[BatchOCR] 第 ${index + 1} 條記錄無法匹配院友: 床號=${record.床號}, 姓名=${record.院友姓名}`);
            } else {
              console.log(`[BatchOCR] ✅ 第 ${index + 1} 條記錄成功匹配院友:`, {
                院友id: matchedPatient.院友id,
                床號: matchedPatient.床號,
                姓名: matchedPatient.中文姓名
              });
            }

            let matchedTask = null;
            if (matchedPatient) {
              const taskMatch = matchTask(
                matchedPatient.院友id,
                record.記錄類型,
                記錄日期,
                recordTime
              );
              matchedTask = taskMatch?.task || null;
            }

            // 確定區域顯示：優先提取床號字母前綴，其次完整床號，最後顯示「已匹配」
            let 區域 = '未知';
            if (matchedPatient) {
              if (matchedPatient.床號) {
                // 嘗試提取字母前綴（如 A01 -> A）
                const areaPrefix = matchedPatient.床號.match(/^[A-Z]+/)?.[0];
                區域 = areaPrefix || matchedPatient.床號;
              } else {
                // 沒有床號但匹配到院友，顯示「已匹配」
                區域 = '已匹配';
              }
            }

            const parsedRecord = {
              tempId: Math.random().toString(36).substr(2, 9),
              院友id: matchedPatient?.院友id || null,
              記錄類型: record.記錄類型,
              記錄日期,
              記錄時間: recordTime,
              血壓收縮壓: record.血壓收縮壓,
              血壓舒張壓: record.血壓舒張壓,
              脈搏: record.脈搏,
              血糖值: record.血糖值,
              體重: record.體重,
              備註: record.備註,
              task_id: matchedTask?.id || null,
              matchedPatient,
              matchedTask,
              區域
            };

            console.log(`[BatchOCR] 創建記錄對象:`, {
              tempId: parsedRecord.tempId,
              院友id: parsedRecord.院友id,
              區域: parsedRecord.區域
            });

            return parsedRecord;
          });

          allRecords.push(...parsedRecords);

          setImages(prev => prev.map(img =>
            img.id === image.id
              ? { ...img, status: 'success', rawData: result.extractedData, parsedRecords }
              : img
          ));
        } else {
          const errorMsg = result.error || '識別失敗';
          console.error(`[BatchOCR] 圖片 ${image.imageFile.name} 識別失敗:`, errorMsg);
          setImages(prev => prev.map(img =>
            img.id === image.id
              ? { ...img, status: 'error', error: errorMsg }
              : img
          ));
        }
      } catch (error: any) {
        const errorMsg = error.message || '處理過程發生錯誤';
        console.error(`[BatchOCR] 圖片 ${image.imageFile.name} 處理異常:`, error);
        setImages(prev => prev.map(img =>
          img.id === image.id
            ? { ...img, status: 'error', error: errorMsg }
            : img
        ));
      }
    }

    setAllParsedRecords(allRecords);
    setIsProcessing(false);
  };

  // 生成隨機生命體徵值 (與 HealthRecordModal 相同的邏輯)
  const generateRandomDefaults = (recordType: string) => {
    if (recordType === '生命表徵') {
      return {
        體溫: Number((Math.random() * 0.9 + 36.0).toFixed(1)), // 36.0-36.9°C
        血含氧量: Math.floor(Math.random() * 5 + 95), // 95-99%
        呼吸頻率: Math.floor(Math.random() * 9 + 14) // 14-22次/分
      };
    }
    return {};
  };

  // 校驗單筆記錄
  const validateRecord = (record: ParsedHealthRecord): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!record.院友id) {
      errors.push('必須選擇院友');
    }

    if (!record.記錄日期) {
      errors.push('必須選擇日期');
    }

    if (!record.記錄時間) {
      errors.push('必須選擇時間');
    }

    if (!record.記錄類型) {
      errors.push('必須選擇記錄類型');
    }

    // 至少需要一個監測數值
    const hasBloodPressure = record.血壓收縮壓 && record.血壓舒張壓;
    const hasBloodSugar = record.血糖值;
    const hasWeight = record.體重;
    const hasRequiredValue = hasBloodPressure || hasBloodSugar || hasWeight;

    if (!hasRequiredValue) {
      errors.push('至少需要一個監測數值（血壓、血糖或體重）');
    }

    return { valid: errors.length === 0, errors };
  };

  // 自動填充隨機生命體徵值（只對生命表徵類型）
  const fillRandomVitals = (record: ParsedHealthRecord) => {
    if (record.記錄類型 === '生命表徵') {
      const defaults = generateRandomDefaults('生命表徵');
      return {
        體溫: defaults.體溫,
        血含氧量: defaults.血含氧量,
        呼吸頻率: defaults.呼吸頻率
      };
    }
    return {};
  };

  // 刪除記錄
  const deleteRecord = (tempId: string) => {
    if (confirm('確定要刪除這條記錄嗎？')) {
      setAllParsedRecords(prev => prev.filter(record => record.tempId !== tempId));
    }
  };

  // 單行儲存
  const handleSingleSave = async (tempId: string) => {
    const record = allParsedRecords.find(r => r.tempId === tempId);
    if (!record) return;

    // 校驗記錄
    const validation = validateRecord(record);
    if (!validation.valid) {
      alert('儲存失敗：\n' + validation.errors.join('\n'));
      return;
    }

    setIsSaving(true);

    try {
      // 自動填充生命體徵隨機值
      const vitals = fillRandomVitals(record);

      const recordData = {
        院友id: record.院友id!,
        task_id: record.task_id || null,
        記錄日期: record.記錄日期,
        記錄時間: record.記錄時間,
        記錄類型: record.記錄類型,
        血壓收縮壓: record.血壓收縮壓 || null,
        血壓舒張壓: record.血壓舒張壓 || null,
        脈搏: record.脈搏 || null,
        體溫: vitals.體溫 || null,
        血含氧量: vitals.血含氧量 || null,
        呼吸頻率: vitals.呼吸頻率 || null,
        血糖值: record.血糖值 || null,
        體重: record.體重 || null,
        備註: record.備註 || null,
        記錄人員: displayName || null,
      };

      await addHealthRecord(recordData);

      // 從表格中移除已儲存的記錄
      setAllParsedRecords(prev => prev.filter(r => r.tempId !== tempId));

      alert('儲存成功');
    } catch (error) {
      console.error('儲存記錄失敗:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 批量儲存
  const handleBatchSave = async () => {
    if (allParsedRecords.length === 0) {
      alert('沒有可儲存的記錄');
      return;
    }

    // 校驗所有記錄
    const validationResults = allParsedRecords.map(record => ({
      record,
      validation: validateRecord(record)
    }));

    const invalidRecords = validationResults.filter(r => !r.validation.valid);
    const validRecords = validationResults.filter(r => r.validation.valid);

    if (invalidRecords.length > 0) {
      const errorMessages = invalidRecords.slice(0, 5).map(r => {
        const bed = r.record.床號 || '未知床號';
        const name = r.record.院友姓名 || '未知姓名';
        return `${bed} ${name}: ${r.validation.errors.join(', ')}`;
      }).join('\n');

      const moreCount = invalidRecords.length > 5 ? `\n...還有 ${invalidRecords.length - 5} 筆記錄有錯誤` : '';

      const message = `發現 ${invalidRecords.length} 筆記錄有錯誤：\n\n${errorMessages}${moreCount}\n\n${validRecords.length > 0 ? `是否只儲存 ${validRecords.length} 筆有效記錄？` : '請修正錯誤後再儲存。'}`;

      if (validRecords.length === 0 || !confirm(message)) {
        return;
      }
    }

    setIsSaving(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const savedIds: string[] = [];

      for (const { record } of validRecords) {
        try {
          // 自動填充生命體徵隨機值
          const vitals = fillRandomVitals(record);

          const recordData = {
            院友id: record.院友id!,
            task_id: record.task_id || null,
            記錄日期: record.記錄日期,
            記錄時間: record.記錄時間,
            記錄類型: record.記錄類型,
            血壓收縮壓: record.血壓收縮壓 || null,
            血壓舒張壓: record.血壓舒張壓 || null,
            脈搏: record.脈搏 || null,
            體溫: vitals.體溫 || null,
            血含氧量: vitals.血含氧量 || null,
            呼吸頻率: vitals.呼吸頻率 || null,
            血糖值: record.血糖值 || null,
            體重: record.體重 || null,
            備註: record.備註 || null,
            記錄人員: displayName || null,
          };

          await addHealthRecord(recordData);
          successCount++;
          savedIds.push(record.tempId);
        } catch (error) {
          console.error('儲存記錄失敗:', error);
          errorCount++;
        }
      }

      // 從表格中移除已儲存的記錄
      setAllParsedRecords(prev => prev.filter(r => !savedIds.includes(r.tempId)));

      const message = `批量儲存完成\n成功：${successCount} 筆\n失敗：${errorCount} 筆${invalidRecords.length > 0 ? `\n跳過：${invalidRecords.length} 筆` : ''}`;
      alert(message);

      if (successCount > 0 && allParsedRecords.length === savedIds.length) {
        onClose();
      }
    } catch (error) {
      console.error('批量儲存失敗:', error);
      alert('批量儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // 更新單筆記錄
  const updateRecord = (tempId: string, field: keyof ParsedHealthRecord, value: any) => {
    console.log(`[BatchOCR] 更新記錄 ${tempId}, 欄位: ${field}, 值:`, value);

    setAllParsedRecords(prev => prev.map(record => {
      if (record.tempId !== tempId) return record;

      const updated = { ...record, [field]: value };

      // 如果更改院友ID，更新相關資料
      if (field === '院友id' && value) {
        const matchedPatient = patients.find(p => p.院友id === Number(value));
        if (matchedPatient) {
          updated.matchedPatient = matchedPatient;

          // 確定區域顯示：優先提取床號字母前綴，其次完整床號，最後顯示「已匹配」
          if (matchedPatient.床號) {
            const areaPrefix = matchedPatient.床號.match(/^[A-Z]+/)?.[0];
            updated.區域 = areaPrefix || matchedPatient.床號;
          } else {
            updated.區域 = '已匹配';
          }

          console.log(`[BatchOCR] ✅ 更新院友成功: ${matchedPatient.中文姓名} (${matchedPatient.床號}), 院友id=${matchedPatient.院友id}`);
        } else {
          console.warn(`[BatchOCR] ⚠️ 找不到院友id=${value}`);
        }
      }

      return updated;
    }));
  };

  // 新增空白記錄
  const addBlankRecord = () => {
    const newRecord: ParsedHealthRecord = {
      tempId: Math.random().toString(36).substr(2, 9),
      院友id: null,
      記錄類型: '生命表徵',
      記錄日期: new Date().toISOString().split('T')[0],
      記錄時間: new Date().toTimeString().split(' ')[0].substring(0, 5),
      task_id: null,
      matchedPatient: null,
      matchedTask: null,
      區域: '未知'
    };
    setAllParsedRecords(prev => [...prev, newRecord]);
  };

  const groupedRecords = allParsedRecords.reduce((acc, record) => {
    const area = record.區域 || '未知';
    if (!acc[area]) acc[area] = [];
    acc[area].push(record);
    return acc;
  }, {} as Record<string, ParsedHealthRecord[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <Camera className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">批量健康記錄OCR上傳</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">使用說明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>上傳識別</strong>：上傳手寫健康記錄表照片（支援多張），系統自動識別並匹配院友</li>
              <li>• <strong>院友匹配</strong>：根據床號或姓名自動匹配，可隨時手動調整選擇的院友</li>
              <li>• <strong>編輯調整</strong>：所有欄位都可編輯，支持手動修正日期、時間、類型、數值等</li>
              <li>• <strong>新增記錄</strong>：點擊「新增空白列」按鈕可手動新增記錄</li>
             
            </ul>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="batch-file-input"
            />
            <label
              htmlFor="batch-file-input"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-700 font-medium mb-1">點擊選擇或拖放圖片</p>
              <p className="text-sm text-gray-500">支援 JPG、PNG、WEBP 格式，可上傳多張</p>
            </label>
          </div>

          {images.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">已上傳圖片 ({images.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {images.map(img => (
                  <div key={img.id} className="border rounded-lg overflow-hidden bg-white">
                    <div className="relative">
                      <img src={img.imagePreview} alt="" className="w-full h-48 object-cover" />
                      <div className="absolute top-2 right-2">
                        {img.status === 'pending' && (
                          <div className="bg-gray-500 text-white text-xs px-2 py-1 rounded">待處理</div>
                        )}
                        {img.status === 'processing' && (
                          <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                        )}
                        {img.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {img.status === 'error' && (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      {img.status === 'error' && img.error && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-500 bg-opacity-90 text-white text-xs p-2">
                          {img.error}
                        </div>
                      )}
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute bottom-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        disabled={isProcessing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 識別結果區域 */}
                    {img.status === 'success' && img.parsedRecords && img.parsedRecords.length > 0 && (
                      <div className="p-3 border-t bg-gray-50">
                        <div className="text-xs text-gray-600">
                          已識別 {img.parsedRecords.length} 筆記錄
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-gray-900">AI識別指令 (Prompt)</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPrompt(DEFAULT_PROMPT)}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>恢復預設</span>
                </button>
                <button
                  onClick={saveUserPrompt}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  disabled={isProcessing}
                >
                  <Save className="h-3 w-3" />
                  <span>儲存為預設</span>
                </button>
                <button
                  onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>{showPromptEditor ? '收起' : '編輯'}</span>
                </button>
              </div>
            </div>
            {showPromptEditor && (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="form-input font-mono text-sm w-full"
                rows={12}
                disabled={isProcessing}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex space-x-3">
              <button
                onClick={() => handleStartOCR(false)}
                disabled={images.length === 0 || isProcessing}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>識別中...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-5 w-5" />
                    <span>開始批量識別</span>
                  </>
                )}
              </button>
              <button
                onClick={handleBatchSave}
                disabled={allParsedRecords.length === 0 || isSaving}
                className="btn-primary flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>儲存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>批量儲存 ({allParsedRecords.length})</span>
                  </>
                )}
              </button>
            </div>

            {/* 強制重新識別按鈕 - 只在有識別結果時顯示 */}
            {Object.keys(groupedRecords).length > 0 && (
              <button
                onClick={() => handleStartOCR(true)}
                disabled={images.length === 0 || isProcessing}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <RotateCcw className="h-5 w-5" />
                <span>強制重新識別（清除快取）</span>
              </button>
            )}
          </div>

          {Object.keys(groupedRecords).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">識別結果（按區域分組）</h3>
              </div>
              {Object.entries(groupedRecords).map(([area, records]) => (
                <div key={area} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 flex items-center justify-between">
                    <span>{area}區 ({records.length} 筆)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500" style={{minWidth: '200px'}}>院友</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">時間</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">類型</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">收縮壓</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">舒張壓</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">脈搏</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">血糖</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">體重</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(record => (
                          <tr key={record.tempId} className="border-t hover:bg-gray-50">
                            {/* 院友選擇 */}
                            <td className="px-3 py-2">
                              <PatientAutocomplete
                                value={record.院友id ? record.院友id.toString() : ''}
                                onChange={(patientId) => {
                                  console.log('[BatchOCR] 手動選擇院友:', patientId);
                                  updateRecord(record.tempId, '院友id', Number(patientId));
                                }}
                                className="text-xs"
                                placeholder="選擇院友..."
                              />
                            </td>
                            {/* 日期 */}
                            <td className="px-2 py-2">
                              <input
                                type="date"
                                value={record.記錄日期 || ''}
                                onChange={(e) => updateRecord(record.tempId, '記錄日期', e.target.value)}
                                className="w-28 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                                disabled={isSaving}
                              />
                            </td>
                            {/* 時間 */}
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={record.記錄時間 ? convertTo12Hour(record.記錄時間) : ''}
                                onChange={(e) => {
                                  const time24 = convertTo24Hour(e.target.value);
                                  updateRecord(record.tempId, '記錄時間', time24);
                                }}
                                onBlur={(e) => {
                                  // 自動格式化輸入
                                  if (e.target.value && !e.target.value.match(/AM|PM/i)) {
                                    // 如果用戶只輸入了時間沒有AM/PM，嘗試轉換
                                    const time24 = e.target.value.includes(':') ? e.target.value : '';
                                    if (time24) {
                                      updateRecord(record.tempId, '記錄時間', time24);
                                    }
                                  }
                                }}
                                className="w-24 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                                placeholder="HH:MM AM/PM"
                                disabled={isSaving}
                              />
                            </td>
                            {/* 類型 */}
                            <td className="px-2 py-2">
                              <select
                                value={record.記錄類型}
                                onChange={(e) => updateRecord(record.tempId, '記錄類型', e.target.value)}
                                className="w-24 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                                disabled={isSaving}
                              >
                                <option value="生命表徵">生命表徵</option>
                                <option value="血糖控制">血糖控制</option>
                                <option value="體重控制">體重控制</option>
                              </select>
                            </td>
                            {/* 收縮壓 */}
                            <td className="px-2 py-2">
                              {record.記錄類型 === '生命表徵' ? (
                                <input
                                  type="number"
                                  value={record.血壓收縮壓 || ''}
                                  onChange={(e) => updateRecord(record.tempId, '血壓收縮壓', e.target.value ? Number(e.target.value) : null)}
                                  className={`w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500 ${!record.血壓收縮壓 ? 'bg-red-50' : ''}`}
                                  placeholder="mmHg"
                                  disabled={isSaving}
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 舒張壓 */}
                            <td className="px-2 py-2">
                              {record.記錄類型 === '生命表徵' ? (
                                <input
                                  type="number"
                                  value={record.血壓舒張壓 || ''}
                                  onChange={(e) => updateRecord(record.tempId, '血壓舒張壓', e.target.value ? Number(e.target.value) : null)}
                                  className={`w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500 ${!record.血壓舒張壓 ? 'bg-red-50' : ''}`}
                                  placeholder="mmHg"
                                  disabled={isSaving}
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 脈搏 */}
                            <td className="px-2 py-2">
                              {record.記錄類型 === '生命表徵' ? (
                                <input
                                  type="number"
                                  value={record.脈搏 || ''}
                                  onChange={(e) => updateRecord(record.tempId, '脈搏', e.target.value ? Number(e.target.value) : null)}
                                  className={`w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500 ${!record.脈搏 ? 'bg-red-50' : ''}`}
                                  placeholder="bpm"
                                  disabled={isSaving}
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 血糖 */}
                            <td className="px-2 py-2">
                              {record.記錄類型 === '血糖控制' ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={record.血糖值 || ''}
                                  onChange={(e) => updateRecord(record.tempId, '血糖值', e.target.value ? Number(e.target.value) : null)}
                                  className={`w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500 ${!record.血糖值 ? 'bg-red-50' : ''}`}
                                  placeholder="mmol/L"
                                  disabled={isSaving}
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 體重 */}
                            <td className="px-2 py-2">
                              {record.記錄類型 === '體重控制' ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={record.體重 || ''}
                                  onChange={(e) => updateRecord(record.tempId, '體重', e.target.value ? Number(e.target.value) : null)}
                                  className={`w-16 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500 ${!record.體重 ? 'bg-red-50' : ''}`}
                                  placeholder="kg"
                                  disabled={isSaving}
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {/* 操作 */}
                            <td className="px-2 py-2">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => handleSingleSave(record.tempId)}
                                  disabled={isSaving}
                                  className="text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="儲存此記錄"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteRecord(record.tempId)}
                                  disabled={isSaving}
                                  className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="刪除此記錄"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* 新增空白列按鈕 - 放在所有表格底部 */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={addBlankRecord}
                  disabled={isSaving}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                  title="新增空白列"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增空白列</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchHealthRecordOCRModal;
