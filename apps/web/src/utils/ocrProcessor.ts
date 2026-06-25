import { supabase } from '../lib/supabase';
export interface DocumentClassification {
  type: 'vaccination' | 'followup' | 'allergy' | 'diagnosis' | 'prescription' | 'unknown';
  confidence: number;
  reasoning?: string;
}
export interface OCRResult {
  success: boolean;
  text?: string;
  extractedData?: any;
  confidenceScores?: Record<string, number>;
  classification?: DocumentClassification;
  error?: string;
  processingTimeMs?: number;
}
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 2 * 1024 * 1024;
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('無法建立canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        if (file.size > TARGET_IMAGE_SIZE) {
          quality = Math.max(0.6, TARGET_IMAGE_SIZE / file.size);
        }
        const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        resolve(base64);
      };
      img.onerror = () => {
        reject(new Error('無法載入圖片'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('無法讀取檔案'));
    };
    reader.readAsDataURL(file);
  });
}
export async function calculateImageHash(base64: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(base64.substring(0, 10000));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
async function logOCRResult(
  imageHash: string,
  result: OCRResult,
  ocrText: string,
  prompt: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ocr_recognition_logs').insert({
      user_id: user.id,
      image_hash: imageHash,
      ocr_text: ocrText,
      extracted_data: result.extractedData || null,
      prompt_used: prompt,
      confidence_scores: result.confidenceScores || null,
      success: result.success,
      error_message: result.error || null,
      processing_time_ms: result.processingTimeMs || 0
    });
  } catch (error) {
    console.error('Failed to log OCR result:', error);
  }
}

// 漏斗法錯誤碼 → 明確中文原因。任何失敗都必須對應到一句肯定的中文說明，
// 嚴禁把英文萬用訊息（如 "Edge Function returned a non-2xx status code"）丟給使用者。
export function mapGeminiErrorToChinese(code: string, rawMsg?: string): string {
  switch (code) {
    case 'GEMINI_QUOTA_EXCEEDED':
      return 'AI 服務繁忙或每日配額已用罄，請稍後再試。';
    case 'AUTH_MISSING_KEY':
      return '系統未設定 API 金鑰（GEMINI_API_KEY 遺失），請聯絡系統管理員。';
    case 'GEMINI_API_KEY_INVALID':
      return 'Gemini API 金鑰無效：請在 Supabase 重新設定 GEMINI_API_KEY，注意勿夾帶空白、換行或引號，並確認金鑰未被重新產生。';
    case 'GEMINI_FORBIDDEN':
      return 'API 金鑰失效或權限不足，請至 Google AI Studio 確認金鑰狀態。';
    case 'GEMINI_MODEL_NOT_FOUND':
      return 'AI 模型設定錯誤（找不到指定模型或 API 版本不符），請聯絡系統管理員。';
    case 'GEMINI_BAD_REQUEST':
      return 'AI 拒絕了此請求（圖片或參數格式問題），請重拍或改用手動輸入。';
    case 'GEMINI_DOWN':
    case 'UPSTREAM_ERROR':
      return 'AI 伺服器暫時異常，請稍後再試。';
    case 'NETWORK_ERROR':
      return '無法連線到 AI 服務，請檢查網路後再試。';
    case 'RESPONSE_TRUNCATED':
      return '圖片內容過多導致回應被截斷，請裁剪或分批上傳。';
    case 'EMPTY_RESPONSE':
      return 'AI 無法讀取此圖片（可能太模糊或被安全過濾），請重拍更清晰的照片。';
    case 'SAFETY_BLOCKED':
      return '圖片被 AI 安全過濾器攔截，請確認圖片內容。';
    case 'PARSE_ERROR':
      return 'AI 回傳的資料格式無法解析，請重試或手動輸入。';
    case 'MISSING_IMAGE':
      return '未收到圖片資料，請重新拍攝。';
    case 'MISSING_PROMPT':
      return '系統設定異常（缺少辨識指令），請聯絡系統管理員。';
    case 'BAD_REQUEST':
      return '傳送的資料格式錯誤，請重試。';
    case 'INTERNAL_SERVER_ERROR':
      return 'AI 服務發生未預期的系統錯誤，請稍後再試或聯絡系統管理員。';
    case 'EDGE_NON_2XX':
      return '無法連線到 AI 辨識服務（Edge Function 無回應），請稍後再試或聯絡系統管理員。';
    default:
      return rawMsg || 'AI 視覺識別失敗，請重試或手動輸入。';
  }
}

export async function processImageWithGeminiVision(
  file: File,
  prompt: string,
  forceRefresh: boolean = false,
  classificationPrompt?: string
): Promise<OCRResult> {
  try {
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: `圖片檔案過大，請選擇小於 ${MAX_IMAGE_SIZE / 1024 / 1024}MB 的圖片`
      };
    }
    const imageBase64 = await compressImage(file);
    const imageHash = await calculateImageHash(imageBase64);
    if (!forceRefresh) {
      const { data: cachedResult } = await supabase
        .from('ocr_recognition_logs')
        .select('*')
        .eq('image_hash', imageHash)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cachedResult && cachedResult.extracted_data) {
        return {
          success: true,
          text: undefined,
          extractedData: cachedResult.extracted_data,
          confidenceScores: cachedResult.confidence_scores,
          classification: cachedResult.classification,
          processingTimeMs: 0
        };
      }
    } else {
    }
    const startTime = Date.now();
    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const { data, error } = await supabase.functions.invoke('gemini-vision-extract', {
      body: {
        imageBase64,
        mimeType,
        prompt,
        classificationPrompt
      }
    });
    if (error) {
      // supabase-js 對 non-2xx 回應只給通用英文訊息且不解析 body。
      // 雖然 Edge Function 已改為一律回傳 200，這裡仍從 Response body 嘗試取出
      // 漏斗法的結構化錯誤碼作為雙保險，確保永遠顯示明確中文原因。
      let code = 'EDGE_NON_2XX';
      let rawMsg: string | undefined;
      const ctx: any = (error as any)?.context;
      try {
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          code = body?.error?.code ?? code;
          rawMsg = body?.error?.message ?? rawMsg;
        }
      } catch {
        // body 非 JSON 或已被讀取，維持預設碼
      }
      const userError = mapGeminiErrorToChinese(code, rawMsg);
      console.error(`[OCR Error] ${code}: ${rawMsg ?? error.message}`);
      const failResult: OCRResult = {
        success: false,
        error: userError,
        processingTimeMs: Date.now() - startTime
      };
      await logOCRResult(imageHash, failResult, '', prompt);
      return failResult;
    }
    if (!data.success) {
      const errObj = data.error;
      const errCode: string = (typeof errObj === 'object' && errObj !== null) ? (errObj as any).code : 'UNKNOWN';
      const errMsg: string = (typeof errObj === 'object' && errObj !== null) ? (errObj as any).message : (errObj || 'AI視覺識別失敗');

      const userError = mapGeminiErrorToChinese(errCode, errMsg);

      console.error(`[OCR Error] ${errCode}: ${errMsg}`);
      const failResult: OCRResult = {
        success: false,
        error: userError,
        processingTimeMs: Date.now() - startTime
      };
      await logOCRResult(imageHash, failResult, '', prompt);
      return failResult;
    }
    const finalResult: OCRResult = {
      success: true,
      text: undefined,
      extractedData: data.extractedData,
      confidenceScores: data.confidenceScores,
      classification: data.classification,
      processingTimeMs: Date.now() - startTime
    };
    await logOCRResult(imageHash, finalResult, '', prompt);
    return finalResult;
  } catch (error: any) {
    console.error('Gemini Vision process error:', error);
    return {
      success: false,
      error: error.message || '處理過程發生錯誤'
    };
  }
}
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '不支援的圖片格式，請使用 JPG、PNG 或 WEBP 格式'
    };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `圖片檔案過大，請選擇小於 ${MAX_IMAGE_SIZE / 1024 / 1024}MB 的圖片`
    };
  }
  return { valid: true };
}
