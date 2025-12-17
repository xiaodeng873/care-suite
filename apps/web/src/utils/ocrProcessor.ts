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

export async function performOCR(imageBase64: string): Promise<OCRResult> {
  try {
    const startTime = Date.now();

    const { data, error } = await supabase.functions.invoke('vision-ocr', {
      body: { imageContent: imageBase64 }
    });

    if (error) {
      console.error('Vision OCR error:', error);
      return {
        success: false,
        error: `OCR識別失敗: ${error.message}`,
        processingTimeMs: Date.now() - startTime
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'OCR識別失敗',
        processingTimeMs: Date.now() - startTime
      };
    }

    return {
      success: true,
      text: data.text,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    console.error('OCR processing error:', error);
    return {
      success: false,
      error: error.message || '未知錯誤'
    };
  }
}

export async function extractDataWithAI(
  ocrText: string,
  prompt: string,
  classificationPrompt?: string
): Promise<OCRResult> {
  try {
    const startTime = Date.now();

    const { data, error } = await supabase.functions.invoke('gemini-extract', {
      body: { ocrText, prompt, classificationPrompt }
    });

    if (error) {
      console.error('Gemini extract error:', error);
      return {
        success: false,
        error: `AI擷取失敗: ${error.message}`,
        processingTimeMs: Date.now() - startTime
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'AI擷取失敗',
        processingTimeMs: Date.now() - startTime
      };
    }

    return {
      success: true,
      extractedData: data.extractedData,
      confidenceScores: data.confidenceScores,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    console.error('AI extraction error:', error);
    return {
      success: false,
      error: error.message || '未知錯誤'
    };
  }
}

export async function processImageAndExtract(
  file: File,
  prompt: string,
  classificationPrompt?: string,
  forceRefresh: boolean = false
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
        console.log('使用快取的OCR結果');
        return {
          success: true,
          text: cachedResult.ocr_text,
          extractedData: cachedResult.extracted_data,
          confidenceScores: cachedResult.confidence_scores,
          processingTimeMs: 0
        };
      }
    } else {
      console.log('強制重新識別，跳過快取');
    }

    const ocrResult = await performOCR(imageBase64);
    if (!ocrResult.success || !ocrResult.text) {
      await logOCRResult(imageHash, ocrResult, '', prompt);
      return ocrResult;
    }

    const extractResult = await extractDataWithAI(ocrResult.text, prompt, classificationPrompt);

    const finalResult: OCRResult = {
      success: extractResult.success,
      text: ocrResult.text,
      extractedData: extractResult.extractedData,
      confidenceScores: extractResult.confidenceScores,
      classification: extractResult.classification,
      error: extractResult.error,
      processingTimeMs: (ocrResult.processingTimeMs || 0) + (extractResult.processingTimeMs || 0)
    };

    await logOCRResult(imageHash, finalResult, ocrResult.text, prompt);

    return finalResult;
  } catch (error: any) {
    console.error('Complete OCR process error:', error);
    return {
      success: false,
      error: error.message || '處理過程發生錯誤'
    };
  }
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
        console.log('使用快取的識別結果');
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
      console.log('強制重新識別，跳過快取');
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
      console.error('Gemini Vision extract error:', error);
      const failResult: OCRResult = {
        success: false,
        error: `AI視覺識別失敗: ${error.message}`,
        processingTimeMs: Date.now() - startTime
      };
      await logOCRResult(imageHash, failResult, '', prompt);
      return failResult;
    }

    if (!data.success) {
      const failResult: OCRResult = {
        success: false,
        error: data.error || 'AI視覺識別失敗',
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
