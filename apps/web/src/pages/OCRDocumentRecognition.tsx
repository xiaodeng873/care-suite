import React, { useState, useEffect } from 'react';
import { Camera, Upload, X, Loader, CheckCircle, AlertTriangle, Save, RotateCcw, ChevronDown, ChevronUp, User, FileText, Syringe, CalendarCheck } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { processImageAndExtract, validateImageFile, type DocumentClassification as OCRDocClassification } from '../utils/ocrProcessor';
import { getUserClassificationRules, saveClassificationRules } from '../utils/promptManager';
import VaccinationRecordModal from '../components/VaccinationRecordModal';
import FollowUpModal from '../components/FollowUpModal';
import DiagnosisRecordModal from '../components/DiagnosisRecordModal';

type DocumentType = 'vaccination' | 'followup' | 'diagnosis' | 'unknown';

interface PatientMatch {
  patient: any;
  matchedFields: string[];
  confidence: number;
}

interface DocumentClassification {
  type: DocumentType;
  confidence: number;
  extractedData: any;
}

const OCRDocumentRecognition: React.FC = () => {
  const { patients } = usePatients();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');

  // 階段性結果
  const [patientMatches, setPatientMatches] = useState<PatientMatch[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [documentClassification, setDocumentClassification] = useState<DocumentClassification | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);

  // 模態框控制
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(null);
  const [showManualTypeSelector, setShowManualTypeSelector] = useState(false);
  const [showClassificationEditor, setShowClassificationEditor] = useState(false);
  const [classificationRules, setClassificationRules] = useState<string>('');

  useEffect(() => {
    loadClassificationData();
  }, []);

  const getDefaultClassificationRules = () => {
    return `文件分類專家指引：

請根據以下規則判斷文件類型（只有三種類型）。

【覆診資料 - followup】
判斷標準（優先級最高）：
✓ 標題包含：預約、Appointment、覆診、門診、Appointment Slip
✓ 有明確的就診日期和時間
✓ 有醫院或診所名稱
✓ 有專科名稱（如眼專科、骨科、內科）
✓ 有登記時間

重要排除規則：
- 出現「敏感個人資料」不代表是藥物敏感，可能只是隱私聲明
- 預約便條、覆診卡都屬於覆診資料

範例文字特徵：
- "預約便條-Appointment Slip"
- "覆診日期: 2025/10/24"
- "香港眼科醫院"
- "眼專科 Eye Specialty"

【疫苗注射記錄 - vaccination】
判斷標準：
✓ 明確提到疫苗名稱（流感疫苗、COVID-19疫苗、肺炎球菌疫苗等）
✓ 有注射日期
✓ 關鍵字：vaccine, vaccination, immunization, 疫苗, 接種, 注射

範例文字特徵：
- "流感疫苗接種記錄"
- "COVID-19 Vaccination Record"
- "注射日期: 2024-09-15"

【診斷記錄 - diagnosis】
判斷標準：
✓ 有診斷病名或診斷項目
✓ 醫生診斷報告或診斷證明
✓ 關鍵字：diagnosis, diagnosed, 診斷, 確診, 病症

範例文字特徵：
- "診斷: 高血壓"
- "Diagnosis: Diabetes Mellitus"
- "診斷日期: 2024-08-20"

判斷優先順序：
1. 先檢查文件標題和類型標識（最重要）
2. 再檢查核心內容特徵
3. 最後才檢查關鍵字

如果無法確定，返回 type: "unknown"

返回格式：
{
  "type": "followup",
  "confidence": 95,
  "reasoning": "文件標題為'預約便條-Appointment Slip'，包含覆診日期、時間、醫院名稱和專科，明確是覆診預約"
}`;
  };

  const loadClassificationData = async () => {
    const userRules = await getUserClassificationRules();
    if (userRules) {
      setClassificationRules(userRules);
    } else {
      setClassificationRules(getDefaultClassificationRules());
    }
  };

  const initializeClassificationRules = () => {
    setClassificationRules(getDefaultClassificationRules());
  };

  const handleSaveClassificationRules = async () => {
    const success = await saveClassificationRules(classificationRules);
    if (success) {
      alert('分類規則已儲存為您的預設設定');
    } else {
      alert('儲存分類規則失敗，請重試');
    }
  };

  const getExtractionPrompt = () => {
    return `你是醫療文件資料提取專家。請從OCR識別的原始文字中智能提取關鍵資訊。

【核心原則】
1. OCR文字通常格式混亂，請智能理解語義，不要被格式干擾
2. 尋找關鍵標籤詞（如：姓名、日期、時間、專科等）
3. 提取後統一使用標準欄位名稱和格式
4. 處理中文和英文混合的情況

【基本資訊提取】
標準欄位名稱：
- "中文姓名": 中文姓名（純中文部分，去除括號內容）
- "英文姓名": 英文姓名（括號內或姓名後的英文）
- "身份證號碼": 香港身份證（格式如 A123456(7)）
- "年齡": 純數字

【覆診預約提取】（最重要！）
標準欄位名稱：
- "followup_date": 覆診/預約日期，格式必須是 YYYY-MM-DD
- "followup_time": 覆診/登記時間，格式必須是 HH:MM（24小時制）
- "followup_location": 醫院完整名稱（中文或英文皆可）
- "specialty": 專科名稱（提取主要專科，去除括號和額外說明）

【覆診預約實際案例】
原始OCR文字範例：
"香港眼科醫院
預約便條-Appointment Slip
眼專科 Eye Specialty (No VA)
日期: 24/10/2025
登記時間: 上午 9 時 45 分
姓名: 鍾蓮女 (Chung, Lin Nui)
身份證號碼: AXX8686(X)"

正確提取：
{
  "中文姓名": "鍾蓮女",
  "英文姓名": "Chung, Lin Nui",
  "身份證號碼": "AXX8686(X)",
  "followup_date": "2025-10-24",
  "followup_time": "09:45",
  "followup_location": "香港眼科醫院",
  "specialty": "眼專科"
}

【疫苗注射記錄提取】
標準欄位名稱：
- "vaccination_date": 注射日期，格式 YYYY-MM-DD
- "vaccine_item": 疫苗名稱（如：流感疫苗、COVID-19疫苗）
- "vaccination_unit": 注射機構名稱

【診斷記錄提取】
標準欄位名稱：
- "diagnosis_date": 診斷日期，格式 YYYY-MM-DD
- "diagnosis_item": 診斷/病名
- "diagnosis_unit": 診斷機構名稱

【日期處理規則】
識別這些標籤詞：日期、Date、年、月、日、Year、Month、Day
常見格式轉換：
- "24/10/2025" → "2025-10-24"
- "2025年10月24日" → "2025-10-24"
- "月 24 10 年 2025 日" → "2025-10-24"（OCR混亂格式）
- "日期: 2025 年 [Year] 月 24 10 [Month] 日" → "2025-10-24"

【時間處理規則】
識別這些標籤詞：時間、Time、登記時間、Registration、時、分、Hour、Minute
常見格式轉換：
- "上午 9 時 45 分" → "09:45"
- "下午 2 時 15 分" → "14:15"
- "9 45" → "09:45"（假設是時和分）
- "上午 9 時 分 45" → "09:45"（OCR可能錯位）

【專科名稱處理】
識別標籤詞：專科、Specialty、科、Department
提取規則：
- "眼專科 Eye Specialty (No VA)" → "眼專科"
- "骨科 (Orthopedics)" → "骨科"
- "內科專科" → "內科"
只提取主要科別名稱，去除括號內說明

【醫院名稱處理】
識別標籤詞：頂部大標題、Hospital、醫院
提取規則：
- 優先從文件頂部提取完整醫院名稱
- "香港眼科醫院\nHong Kong Eye Hospital" → "香港眼科醫院"
- 保留完整中文名稱

【姓名處理】
識別標籤詞：姓名、Name、病人
提取規則：
- "鍾蓮女\n(Chung, Lin Nui)" → 中文: "鍾蓮女", 英文: "Chung, Lin Nui"
- "姓名: 鍾蓮女 鍾蓮女 [Name] (Chung, Lin Nui)" → 中文: "鍾蓮女", 英文: "Chung, Lin Nui"
- 去重複出現的姓名

【身份證處理】
識別標籤詞：身份證、HKID、ID
格式：字母+數字+括號內校驗碼
- "AXX8686(X)" 保持原樣

【重要提醒】
1. OCR文字可能有重複、錯位、空格問題，請智能理解
2. 日期和時間是最重要的欄位，必須準確提取和轉換
3. 如果某個欄位找不到，該欄位可以省略（不要填null或空字串）
4. 只返回JSON，不要任何解釋文字

【輸出格式】
純JSON，不含markdown標記：
{
  "中文姓名": "值",
  "followup_date": "YYYY-MM-DD",
  "followup_time": "HH:MM",
  ...
}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      alert('無法讀取圖片檔案');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      alert('無法讀取圖片檔案');
      setSelectedFile(null);
      setImagePreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setPatientMatches([]);
    setSelectedPatient(null);
    setDocumentClassification(null);
    setOcrText('');
    const fileInput = document.getElementById('ocr-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const findMatchingPatients = (extractedData: any, documentType?: DocumentType): PatientMatch[] => {
    const matches: PatientMatch[] = [];

    patients.forEach(patient => {
      const matchedFields: string[] = [];
      let score = 0;

      // === 中文姓名匹配 - 支援多種欄位名稱 ===
      const possibleChineseNameFields = [
        '中文姓名', '姓名', '院友姓名', '病人姓名',
        '患者姓名', 'Name', 'Chinese_Name'
      ];

      let chineseNameToMatch = '';
      for (const field of possibleChineseNameFields) {
        if (extractedData[field]) {
          chineseNameToMatch = String(extractedData[field]).trim();
          // 清理特殊格式：移除括號內容和換行符
          chineseNameToMatch = chineseNameToMatch.split('\n')[0].trim();
          chineseNameToMatch = chineseNameToMatch.split('(')[0].trim();
          break;
        }
      }

      if (chineseNameToMatch) {
        const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.trim();
        if (patientFullName === chineseNameToMatch ||
            patientFullName.includes(chineseNameToMatch) ||
            chineseNameToMatch.includes(patientFullName)) {
          matchedFields.push('中文姓名');
          score += 40;
        }
      }

      // === 英文姓名匹配 - 支援多種欄位名稱 ===
      const possibleEnglishNameFields = [
        '英文姓名', 'English_Name', 'Name_EN', 'English Name'
      ];

      let englishNameToMatch = '';
      for (const field of possibleEnglishNameFields) {
        if (extractedData[field]) {
          englishNameToMatch = String(extractedData[field]).toLowerCase().trim();
          // 清理格式：移除括號、逗號後的內容
          englishNameToMatch = englishNameToMatch.replace(/[()]/g, ' ').trim();
          break;
        }
      }

      if (englishNameToMatch) {
        const patientEnglishName = `${patient.英文姓氏 || ''} ${patient.英文名字 || ''}`.toLowerCase().trim();
        if (patientEnglishName && (
            patientEnglishName === englishNameToMatch ||
            patientEnglishName.includes(englishNameToMatch) ||
            englishNameToMatch.includes(patientEnglishName)
        )) {
          matchedFields.push('英文姓名');
          score += 35;
        }
      }

      // === 身份證號碼匹配（支援完整和部分匹配）===
      const possibleIdFields = ['身份證號碼', 'HKID', 'ID', 'Identity'];
      let idToMatch = '';
      for (const field of possibleIdFields) {
        if (extractedData[field]) {
          idToMatch = String(extractedData[field]).replace(/\s+/g, '').toUpperCase();
          break;
        }
      }

      if (idToMatch && patient.身份證號碼) {
        const patientId = patient.身份證號碼.replace(/\s+/g, '').toUpperCase();

        // 完整匹配（最高分）
        if (patientId === idToMatch) {
          matchedFields.push('身份證號碼（完整）');
          score += 50;
        } else {
          // 部分匹配：逐字符比對對應位格
          let matchedPositions = 0;
          let totalValidPositions = 0;

          const maxLength = Math.max(patientId.length, idToMatch.length);

          for (let i = 0; i < maxLength; i++) {
            const extractedChar = idToMatch[i];
            const patientChar = patientId[i];

            // 忽略 X（遮罩）和特殊符號
            if (extractedChar && extractedChar !== 'X' && extractedChar !== '_' &&
                extractedChar !== '*' && extractedChar !== '(' && extractedChar !== ')') {
              totalValidPositions++;

              if (patientChar && extractedChar === patientChar) {
                matchedPositions++;
              }
            }
          }

          // 如果至少有3個字符匹配，且匹配率 >= 60%
          if (matchedPositions >= 3 && totalValidPositions > 0) {
            const matchRate = matchedPositions / totalValidPositions;
            if (matchRate >= 0.6) {
              matchedFields.push(`身份證號碼（部分 ${matchedPositions}/${totalValidPositions}）`);
              // 根據匹配率給分：60% = 25分，100% = 40分
              score += Math.round(25 + (matchRate - 0.6) * 37.5);
            }
          }
        }
      }

      // === 出生日期匹配 ===
      if (extractedData.出生日期 || extractedData.Birth_Date) {
        const birthDate = extractedData.出生日期 || extractedData.Birth_Date;
        if (patient.出生日期 && patient.出生日期 === birthDate) {
          matchedFields.push('出生日期');
          score += 30;
        }
      }

      // === 年齡匹配（模糊匹配，±1歲）===
      if (extractedData.年齡 || extractedData.Age) {
        const age = parseInt(extractedData.年齡 || extractedData.Age);
        if (!isNaN(age) && patient.出生日期) {
          const patientAge = new Date().getFullYear() - new Date(patient.出生日期).getFullYear();
          if (Math.abs(patientAge - age) <= 1) {
            matchedFields.push('年齡');
            score += 15;
          }
        }
      }

      // 只要有至少1個線索匹配就加入候選清單
      if (matchedFields.length >= 1) {
        // 根據匹配線索數量調整信心度
        let finalConfidence = Math.min(score, 100);

        // 只有1個線索匹配時，降低信心度以提醒用戶確認
        if (matchedFields.length === 1) {
          finalConfidence = Math.min(finalConfidence, 65);
        }

        matches.push({
          patient,
          matchedFields,
          confidence: finalConfidence
        });
      }
    });

    // 按信心度排序
    return matches.sort((a, b) => b.confidence - a.confidence);
  };

  const mapExtractedDataToModalFields = (extractedData: any, documentType: DocumentType, patientId: number): any => {
    const baseData = {
      院友id: patientId,
      patient_id: patientId
    };

    switch (documentType) {
      case 'vaccination': {
        const possibleDateFields = ['vaccination_date', '注射日期', 'injection_date', 'date'];
        const possibleItemFields = ['vaccine_item', '疫苗名稱', '疫苗項目', '疫苗', 'vaccine', 'vaccine_name'];
        const possibleUnitFields = ['vaccination_unit', '注射單位', 'unit', 'hospital', '醫院', '診所'];

        const vaccinationDate = findFieldValue(extractedData, possibleDateFields);
        const vaccineItem = findFieldValue(extractedData, possibleItemFields);
        const vaccinationUnit = findFieldValue(extractedData, possibleUnitFields);

        return {
          ...baseData,
          vaccination_date: vaccinationDate || '',
          vaccine_item: vaccineItem || '',
          vaccination_unit: vaccinationUnit || ''
        };
      }

      case 'followup': {
        const possibleDateFields = [
          'followup_date', '覆診日期', 'appointment_date', '預約日期', 'date',
          '處方日期', '日期', 'registration_date', '登記日期'
        ];
        const possibleTimeFields = [
          'followup_time', '覆診時間', 'appointment_time', '預約時間', '登記時間',
          'time', '時間', 'registration_time'
        ];
        const possibleLocationFields = [
          'followup_location', '覆診地點', 'location', 'hospital', '醫院', '地點',
          '藥物來源', '診所', 'clinic', '醫療機構', 'institution'
        ];
        const possibleSpecialtyFields = [
          'specialty', '專科', '覆診專科', 'department', '科別',
          '科室', '門診科別', '診療科'
        ];
        const possibleDepartureFields = ['departure_time', '出發時間'];

        return {
          ...baseData,
          覆診日期: findFieldValue(extractedData, possibleDateFields) || '',
          覆診時間: findFieldValue(extractedData, possibleTimeFields) || '',
          覆診地點: findFieldValue(extractedData, possibleLocationFields) || '',
          覆診專科: findFieldValue(extractedData, possibleSpecialtyFields) || '',
          出發時間: findFieldValue(extractedData, possibleDepartureFields) || '',
          交通安排: '',
          陪診人員: '',
          備註: '',
          狀態: '' as ''
        };
      }

      case 'diagnosis': {
        const possibleDateFields = ['diagnosis_date', '診斷日期', 'date'];
        const possibleItemFields = ['diagnosis_item', '診斷項目', '診斷', 'diagnosis', '病名'];
        const possibleUnitFields = ['diagnosis_unit', '診斷單位', 'unit', 'hospital', '醫院'];

        const diagnosisDate = findFieldValue(extractedData, possibleDateFields);
        const diagnosisItem = findFieldValue(extractedData, possibleItemFields);
        const diagnosisUnit = findFieldValue(extractedData, possibleUnitFields);

        return {
          ...baseData,
          diagnosis_date: diagnosisDate || '',
          diagnosis_item: diagnosisItem || '',
          diagnosis_unit: diagnosisUnit || ''
        };
      }

      default:
        return baseData;
    }
  };

  const findFieldValue = (data: any, possibleFieldNames: string[]): string | null => {
    console.log('尋找欄位值 - 候選欄位名稱:', possibleFieldNames);
    console.log('可用的資料欄位:', Object.keys(data));

    for (const fieldName of possibleFieldNames) {
      if (data[fieldName] !== undefined && data[fieldName] !== null && data[fieldName] !== '') {
        const value = String(data[fieldName]).trim();
        console.log(`✓ 找到欄位 "${fieldName}": "${value}"`);
        return value;
      }
    }
    console.log('✗ 未找到任何匹配的欄位');
    return null;
  };

  const classifyDocument = (extractedData: any, ocrText: string): DocumentClassification => {
    let maxScore = 0;
    let bestType: DocumentType = 'unknown';
    const scores: Record<DocumentType, number> = {
      vaccination: 0,
      followup: 0,
      diagnosis: 0,
      unknown: 0
    };

    const lowerText = ocrText.toLowerCase();
    const hasData = (field: string) => extractedData[field] !== undefined && extractedData[field] !== null && extractedData[field] !== '';

    // === 覆診資料特徵（優先級最高）===
    // 標題關鍵字（高權重）
    if (lowerText.includes('appointment slip') ||
        lowerText.includes('預約便條') ||
        lowerText.includes('預約卡')) {
      scores.followup += 60;
    }

    if (lowerText.includes('appointment') ||
        lowerText.includes('覆診') ||
        lowerText.includes('門診')) {
      scores.followup += 30;
    }

    if (hasData('覆診日期') || hasData('覆診時間') || hasData('覆診地點')) {
      scores.followup += 40;
    }

    if (lowerText.includes('專科') || lowerText.includes('specialty')) {
      scores.followup += 20;
    }

    // 排除：「敏感個人資料」不影響覆診判斷
    if (lowerText.includes('敏感個人資料') || lowerText.includes('sensitive personal data')) {
      // 不做任何處理，這只是隱私聲明
    }

    // === 疫苗記錄特徵 ===
    if (lowerText.includes('vaccine') ||
        lowerText.includes('vaccination') ||
        lowerText.includes('immunization') ||
        lowerText.includes('疫苗') ||
        lowerText.includes('接種')) {
      scores.vaccination += 50;
    }

    if (hasData('疫苗名稱') || hasData('vaccine_item')) {
      scores.vaccination += 40;
    }

    if (hasData('注射日期') || hasData('vaccination_date')) {
      scores.vaccination += 30;
    }

    // === 診斷記錄特徵 ===
    if (lowerText.includes('diagnosis') ||
        lowerText.includes('diagnosed') ||
        lowerText.includes('診斷') ||
        lowerText.includes('確診')) {
      scores.diagnosis += 50;
    }

    if (hasData('診斷項目') || hasData('diagnosis_item')) {
      scores.diagnosis += 40;
    }

    if (hasData('診斷日期') || hasData('diagnosis_date')) {
      scores.diagnosis += 30;
    }

    // 選擇得分最高的類型
    Object.entries(scores).forEach(([type, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestType = type as DocumentType;
      }
    });

    // 如果最高分數太低，判定為未知
    if (maxScore < 30) {
      bestType = 'unknown';
    }

    return {
      type: bestType,
      confidence: Math.min(maxScore, 100),
      extractedData
    };
  };

  const handleStartOCR = async () => {
    if (!selectedFile) {
      alert('請先選擇圖片');
      return;
    }

    setIsProcessing(true);
    setPatientMatches([]);
    setSelectedPatient(null);
    setDocumentClassification(null);
    setOcrText('');

    try {
      setProcessingStage('正在壓縮圖片...');
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingStage('正在識別文字...');
      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingStage('正在擷取資料並分類文件...');
      const extractionPrompt = getExtractionPrompt();
      const result = await processImageAndExtract(selectedFile, extractionPrompt, classificationRules);

      if (result.success && result.extractedData && result.text) {
        setOcrText(result.text);

        // 階段1: 使用 AI 分類結果或降級到硬編碼邏輯
        setProcessingStage('正在分類文件類型...');
        await new Promise(resolve => setTimeout(resolve, 300));

        let classification: DocumentClassification;
        if (result.classification) {
          // 使用 AI 分類結果
          classification = {
            type: result.classification.type,
            confidence: result.classification.confidence,
            extractedData: result.extractedData
          };
        } else {
          // 降級使用硬編碼邏輯
          classification = classifyDocument(result.extractedData, result.text);
        }
        setDocumentClassification(classification);

        // 階段2: 根據文件類型匹配院友
        setProcessingStage('正在匹配院友資料...');
        await new Promise(resolve => setTimeout(resolve, 300));
        const matches = findMatchingPatients(result.extractedData, classification.type);
        setPatientMatches(matches);

        if (matches.length > 0) {
          setSelectedPatient(matches[0].patient);
        }

        setIsProcessing(false);
        setProcessingStage('');

        // 階段3: 自動開啟模態框（延遲500ms讓用戶看到結果）
        if (matches.length > 0 && classification.type !== 'unknown') {
          await new Promise(resolve => setTimeout(resolve, 500));
          handleOpenModalWithType(classification.type, matches[0].patient, result.extractedData);
        }
      } else {
        setIsProcessing(false);
        setProcessingStage('');
        alert(result.error || 'OCR識別失敗');
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingStage('');
      alert(error.message || '處理過程發生錯誤');
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
  };

  const handleOpenModalWithType = (type: DocumentType, patient: any, extractedData: any) => {
    console.log('=== OCR 提取的原始資料 ===');
    console.log('文件類型:', type);
    console.log('提取資料:', JSON.stringify(extractedData, null, 2));

    const mappedData = mapExtractedDataToModalFields(extractedData, type, patient.院友id);

    console.log('=== 映射後的資料 ===');
    console.log('映射結果:', JSON.stringify(mappedData, null, 2));

    setPrefilledData(mappedData);

    switch (type) {
      case 'vaccination':
        setShowVaccinationModal(true);
        break;
      case 'followup':
        setShowFollowUpModal(true);
        break;
      case 'diagnosis':
        setShowDiagnosisModal(true);
        break;
      default:
        alert('未知的文件類型');
    }
  };

  const handleOpenModal = () => {
    if (!selectedPatient) {
      alert('請先選擇院友');
      return;
    }

    if (!documentClassification) {
      alert('尚未分類文件類型');
      return;
    }

    handleOpenModalWithType(documentClassification.type, selectedPatient, documentClassification.extractedData);
  };

  const handleManualSelectType = (type: DocumentType) => {
    if (!selectedPatient) {
      alert('請先選擇院友');
      return;
    }

    if (!documentClassification) {
      alert('尚未識別資料');
      return;
    }

    handleOpenModalWithType(type, selectedPatient, documentClassification.extractedData);
  };

  const getDocumentTypeLabel = (type: DocumentType): string => {
    const labels: Record<DocumentType, string> = {
      vaccination: '疫苗注射記錄',
      followup: '覆診資料',
      diagnosis: '診斷記錄',
      unknown: '未知類型'
    };
    return labels[type];
  };

  const getDocumentTypeIcon = (type: DocumentType) => {
    const icons: Record<DocumentType, any> = {
      vaccination: Syringe,
      followup: CalendarCheck,
      diagnosis: FileText,
      unknown: AlertTriangle
    };
    return icons[type];
  };

  const getDocumentTypeColor = (type: DocumentType): string => {
    const colors: Record<DocumentType, string> = {
      vaccination: 'bg-green-50 border-green-300 text-green-800',
      followup: 'bg-blue-50 border-blue-300 text-blue-800',
      allergy: 'bg-orange-50 border-orange-300 text-orange-800',
      diagnosis: 'bg-purple-50 border-purple-300 text-purple-800',
      prescription: 'bg-pink-50 border-pink-300 text-pink-800',
      unknown: 'bg-gray-50 border-gray-300 text-gray-800'
    };
    return colors[type];
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OCR 智能文件識別</h1>
            <p className="text-sm text-gray-600 mt-1">上傳文件圖片，自動識別院友資料並分類文件類型</p>
          </div>
        </div>
      </div>

      {/* 上傳區域 */}
      <div className="card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：圖片上傳 */}
          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center space-x-2">
                <Camera className="h-5 w-5 text-blue-600" />
                <span>圖片上傳</span>
                {selectedFile && (
                  <span className="text-xs text-green-600">✓ 已選擇檔案</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ocr-file-input"
                  disabled={isProcessing}
                />
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!imagePreview) {
                      document.getElementById('ocr-file-input')?.click();
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg transition-colors ${
                    imagePreview
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50 cursor-pointer'
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
                          e.stopPropagation();
                          handleClearImage();
                        }}
                        className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-2">點擊選擇或拖放圖片</p>
                      <p className="text-xs text-gray-500 mb-3">支援 JPG、PNG、WEBP 格式</p>
                      <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                        選擇檔案
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedFile && (
                <p className="text-xs text-gray-600 mt-2">
                  檔案: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartOCR}
              disabled={!selectedFile || isProcessing}
              className="btn-primary w-full flex items-center justify-center space-x-2 py-3"
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

          {/* 右側：分類規則編輯器 */}
          <div className="space-y-4">
            {/* 分類規則編輯器 */}
            <div>
              <button
                onClick={() => setShowClassificationEditor(!showClassificationEditor)}
                className="form-label flex items-center justify-between w-full hover:text-blue-600 transition-colors"
              >
                <span>文件分類規則設定</span>
                {showClassificationEditor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showClassificationEditor && (
                <div className="space-y-3 mt-2">
                  <div className="text-xs text-gray-600 mb-2 bg-green-50 p-2 rounded border border-green-200">
                    <p className="text-green-800 font-medium mb-1">✓ 系統現已使用 AI 根據以下規則進行智能分類</p>
                    <p className="text-green-700">編輯這些規則將直接影響文件分類結果。如 AI 分類失敗，系統會自動降級使用硬編碼邏輯。</p>
                  </div>

                  <textarea
                    value={classificationRules}
                    onChange={(e) => setClassificationRules(e.target.value)}
                    className="form-input font-mono text-xs"
                    rows={15}
                    placeholder="編輯分類規則..."
                    disabled={isProcessing}
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      自訂分類規則可提高分類準確度
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={initializeClassificationRules}
                        className="text-xs text-gray-600 hover:text-gray-800 flex items-center space-x-1 px-2 py-1 rounded hover:bg-gray-100"
                        disabled={isProcessing}
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>恢復預設</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveClassificationRules}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 px-2 py-1 rounded hover:bg-blue-50"
                        disabled={isProcessing}
                      >
                        <Save className="h-3 w-3" />
                        <span>儲存為預設</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!showClassificationEditor && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">使用提示：</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>請確保圖片清晰，文字可辨識</li>
                      <li>系統會自動識別院友並分類文件類型</li>
                      <li>支援文件類型：疫苗注射記錄、覆診資料、診斷記錄</li>
                      <li>只需匹配至少 1 個院友線索即可（姓名、身份證、出生日期等）</li>
                      <li>識別後會自動開啟對應功能模組填入資料</li>
                      <li>如 AI 判斷錯誤，可手動選擇正確的文件類型</li>
                      <li>需要重新識別？修改分類規則後再次點擊「開始識別」按鈕</li>
                      <li>藥物處方請使用「處方 OCR」頁面，藥物敏感在「院友資料」頁面維護</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 識別結果 */}
      {(patientMatches.length > 0 || documentClassification) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 院友匹配結果 */}
          {patientMatches.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <User className="h-5 w-5 text-blue-600" />
                <span>院友匹配結果</span>
                <span className="text-sm font-normal text-gray-500">({patientMatches.length} 位)</span>
              </h3>

              <div className="space-y-3">
                {patientMatches.map((match, index) => (
                  <div
                    key={match.patient.院友id}
                    onClick={() => handleSelectPatient(match.patient)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedPatient?.院友id === match.patient.院友id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                          {match.patient.院友相片 ? (
                            <img
                              src={match.patient.院友相片}
                              alt={match.patient.中文姓名}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {match.patient.中文姓氏}{match.patient.中文名字}
                          </p>
                          <p className="text-sm text-gray-600">床號: {match.patient.床號}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          match.confidence >= 80 ? 'bg-green-100 text-green-800' :
                          match.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {match.confidence}% 信心度
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {match.matchedFields.map(field => (
                        <span key={field} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {field}
                        </span>
                      ))}
                      {match.matchedFields.length === 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          僅1個線索匹配，請確認院友
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 文件分類結果 */}
          {documentClassification && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>文件分類結果</span>
              </h3>

              <div className={`p-4 border-2 rounded-lg ${getDocumentTypeColor(documentClassification.type)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {React.createElement(getDocumentTypeIcon(documentClassification.type), { className: 'h-6 w-6' })}
                    <span className="text-lg font-medium">{getDocumentTypeLabel(documentClassification.type)}</span>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    documentClassification.confidence >= 70 ? 'bg-green-100 text-green-800' :
                    documentClassification.confidence >= 50 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {documentClassification.confidence}% 信心度
                  </div>
                </div>

                {documentClassification.type !== 'unknown' && selectedPatient && (
                  <button
                    onClick={handleOpenModal}
                    className="btn-primary w-full mt-3 flex items-center justify-center space-x-2"
                  >
                    <span>開啟 {getDocumentTypeLabel(documentClassification.type)} 模態框</span>
                    <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                  </button>
                )}

                {documentClassification.type === 'unknown' && (
                  <div className="mt-3 text-sm text-gray-600">
                    <p>無法判斷文件類型，建議：</p>
                    <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
                      <li>檢查圖片是否清晰</li>
                      <li>調整 Prompt 內容</li>
                      <li>手動選擇功能模組輸入</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 手動選擇文件類型 */}
              <div className="mt-4">
                <button
                  onClick={() => setShowManualTypeSelector(!showManualTypeSelector)}
                  className="w-full text-sm text-gray-700 hover:text-blue-600 flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <span className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>AI 判斷錯誤？手動選擇正確的文件類型（將使用已識別的資料）</span>
                  </span>
                  {showManualTypeSelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showManualTypeSelector && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleManualSelectType('vaccination')}
                      disabled={!selectedPatient}
                      className="flex items-center space-x-2 p-3 border-2 border-green-300 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Syringe className="h-5 w-5" />
                      <span className="text-sm font-medium">疫苗注射記錄</span>
                    </button>

                    <button
                      onClick={() => handleManualSelectType('followup')}
                      disabled={!selectedPatient}
                      className="flex items-center space-x-2 p-3 border-2 border-blue-300 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarCheck className="h-5 w-5" />
                      <span className="text-sm font-medium">覆診資料</span>
                    </button>

                    <button
                      onClick={() => handleManualSelectType('diagnosis')}
                      disabled={!selectedPatient}
                      className="flex items-center space-x-2 p-3 border-2 border-purple-300 bg-purple-50 text-purple-800 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="h-5 w-5" />
                      <span className="text-sm font-medium">診斷記錄</span>
                    </button>

                    {!selectedPatient && (
                      <div className="col-span-3 text-xs text-center text-gray-500 py-2">
                        請先選擇院友才能開啟功能模組
                      </div>
                    )}
                  </div>
                )}
              </div>

              {ocrText && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <span>{showRawText ? '隱藏' : '顯示'}原始識別文字</span>
                    {showRawText ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showRawText && (
                    <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                      {ocrText}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 模態框 */}
      {showVaccinationModal && selectedPatient && (
        <VaccinationRecordModal
          patientId={selectedPatient.院友id}
          existingRecords={[]}
          prefilledData={prefilledData}
          onClose={() => {
            setShowVaccinationModal(false);
            setPrefilledData(null);
          }}
        />
      )}

      {showFollowUpModal && selectedPatient && prefilledData && (
        <FollowUpModal
          appointment={prefilledData}
          onClose={() => {
            setShowFollowUpModal(false);
            setPrefilledData(null);
          }}
        />
      )}

      {showDiagnosisModal && selectedPatient && (
        <DiagnosisRecordModal
          patientId={selectedPatient.院友id}
          existingRecords={[]}
          prefilledData={prefilledData}
          onClose={() => {
            setShowDiagnosisModal(false);
            setPrefilledData(null);
          }}
        />
      )}

    </div>
  );
};

export default OCRDocumentRecognition;
