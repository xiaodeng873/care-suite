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
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 2 * 1024 * 1024;
// Gemini Flash 以 768×768 tile 處理圖片，長邊 ~1536px 已經係 2 tiles 上限，
// 再大只會被降採樣兼浪費 token——預處理統一縮到 1536px
const OCR_MAX_DIMENSION = 1536;
// deskew：分析用縮圖長邊 / 搜尋範圍 / 最小修正角度
const DESKEW_ANALYSIS_MAX = 600;
const DESKEW_MAX_ANGLE = 8;
const DESKEW_MIN_CORRECTION = 0.3;
// 文件邊界裁切：格網解析度 / 亮格佔比上下限（超過上限＝無背景可裁，低於下限＝偵測失敗）
const DOC_CROP_GRID = 96;
const DOC_CROP_MIN_AREA = 0.2;
const DOC_CROP_MAX_AREA = 0.92;
const DOC_CROP_PAD_CELLS = 2;

// 載入圖片並套用 EXIF 方向（手機影相常見 90/180/270° 旋轉）
async function loadImageWithExifOrientation(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // 舊瀏覽器唔支援 createImageBitmap options：現代瀏覽器將 HTMLImageElement
    // 畫上 canvas 時會自動套用 EXIF 方向
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('無法讀取檔案'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('無法載入圖片'));
      i.src = dataUrl;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  }
}

// 灰階化 + 對比度拉伸（1%–99% percentile）：強化淺色墨水/退色打印，圖更細上傳更快
function applyGrayscaleContrastStretch(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 灰階（Rec.601 luma）
  const luma = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    luma[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114 + 500) / 1000;
  }

  // 直方圖 → 1% / 99% percentile
  const hist = new Uint32Array(256);
  for (let j = 0; j < luma.length; j++) hist[luma[j]]++;
  const total = luma.length;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }

  if (hi > lo) {
    const scale = 255 / (hi - lo);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      let v = (luma[j] - lo) * scale;
      if (v < 0) v = 0; else if (v > 255) v = 255;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

// Otsu 自動二值化閾值
function otsuThreshold(luma: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let j = 0; j < luma.length; j++) hist[luma[j]]++;
  const total = luma.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = 0, bestVariance = 0;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVariance) { bestVariance = between; best = v; }
  }
  return best;
}

// 水平投影剖面方差：文字行對齊水平時方差最大
function profileVariance(luma: Uint8Array, width: number, height: number, threshold: number): number {
  let sum = 0, sumSq = 0;
  for (let y = 0; y < height; y++) {
    let rowDark = 0;
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      if (luma[rowStart + x] < threshold) rowDark++;
    }
    sum += rowDark;
    sumSq += rowDark * rowDark;
  }
  const mean = sum / height;
  return sumSq / height - mean * mean;
}

// 將 canvas 旋轉指定角度（同色尺寸，空白補白），用於剖面分析
function rotateCanvas(src: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

function readLuma(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const luma = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    luma[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114 + 500) / 1000;
  }
  return luma;
}

export interface DocumentBounds { x: number; y: number; w: number; h: number; }

// 白度圖：min(R,G,B)。白紙三通道都高；黃/紅枱面、皮膚 B 通道低即刻被壓低，
// 比純亮度更能喺彩色背景上分出白紙
function readWhiteness(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const white = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    white[j] = r < g ? (r < b ? r : b) : (g < b ? g : b);
  }
  return white;
}

/**
 * 文件邊界偵測：將圖片切成格網，逐格計平均「白度」（min(R,G,B)），
 * 用 Otsu 分出「紙（白）」同「背景（有色/暗）」，flood fill 取最大連通白區，
 * 返回佢嘅 bounding box（加少少 padding，canvas 像素座標）。
 * 偵測唔到、或無背景可裁（全幅文件）就返回 null。
 * 注意：要喺灰階化之前嘅彩色圖上跑。
 */
export function detectDocumentBounds(canvas: HTMLCanvasElement): DocumentBounds | null {
  const { width, height } = canvas;
  const luma = readWhiteness(canvas);

  // 格網化：長邊 DOC_CROP_GRID 格，逐格平均白度（薄表格線唔會令成格變暗）
  const scale = DOC_CROP_GRID / Math.max(width, height);
  const gw = Math.max(8, Math.round(width * scale));
  const gh = Math.max(8, Math.round(height * scale));
  const cw = width / gw;
  const ch = height / gh;
  const cellLuma = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * ch), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * ch));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * cw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cw));
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        const rowStart = y * width;
        for (let x = x0; x < x1; x++) sum += luma[rowStart + x];
      }
      cellLuma[gy * gw + gx] = sum / ((y1 - y0) * (x1 - x0));
    }
  }

  // Otsu 分亮/暗格
  const hist = new Uint32Array(256);
  for (let i = 0; i < cellLuma.length; i++) hist[Math.min(255, Math.round(cellLuma[i]))]++;
  const total = cellLuma.length;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let sumB = 0, wB = 0, threshold = 0, bestVariance = 0;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVariance) { bestVariance = between; threshold = v; }
  }
  const bright = new Uint8Array(total);
  for (let i = 0; i < total; i++) bright[i] = cellLuma[i] > threshold ? 1 : 0;

  // flood fill 搵最大連通亮區
  const visited = new Uint8Array(total);
  let bestSize = 0;
  let bestBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const stack: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!bright[i] || visited[i]) continue;
    let size = 0;
    let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
    stack.push(i);
    visited[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx = c % gw, cy = (c / gw) | 0;
      if (cx < x0) x0 = cx;
      if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy;
      if (cy > y1) y1 = cy;
      const neighbors = [c - 1, c + 1, c - gw, c + gw];
      for (const n of neighbors) {
        if (n < 0 || n >= total || visited[n] || !bright[n]) continue;
        // 左右鄰居要檢查唔係跨行
        if ((n === c - 1 || n === c + 1) && ((n / gw) | 0) !== cy) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestBox = { x0, y0, x1, y1 };
    }
  }

  // 防呆：亮區太細（偵測失敗）或幾乎全幅（本身已係全幅文件）→ 唔裁
  const area = bestSize / total;
  if (area < DOC_CROP_MIN_AREA || area > DOC_CROP_MAX_AREA) return null;

  const pad = DOC_CROP_PAD_CELLS;
  const px0 = Math.max(0, Math.floor((bestBox.x0 - pad) * cw));
  const py0 = Math.max(0, Math.floor((bestBox.y0 - pad) * ch));
  const px1 = Math.min(width, Math.ceil((bestBox.x1 + 1 + pad) * cw));
  const py1 = Math.min(height, Math.ceil((bestBox.y1 + 1 + pad) * ch));
  if (px1 - px0 < 32 || py1 - py0 < 32) return null;
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

// 自動裁切版：偵測到文件邊界就 crop，否則原圖返回（OCR 預處理用）
export function cropToDocument(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const bounds = detectDocumentBounds(canvas);
  if (!bounds) return canvas;
  const out = document.createElement('canvas');
  out.width = bounds.w;
  out.height = bounds.h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, out.width, out.height);
  return out;
}

/**
 * 投影剖面 deskew：縮圖上試 -8°~+8°（粗 1°、細 0.1°），
 * 取水平投影方差最大嘅角度作修正角。方差無明顯提升（+5%）就當無傾斜。
 */
export function detectSkewAngle(canvas: HTMLCanvasElement): number {
  // 分析用縮圖
  const scale = Math.min(1, DESKEW_ANALYSIS_MAX / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const sctx = small.getContext('2d')!;
  sctx.drawImage(canvas, 0, 0, small.width, small.height);

  const baseLuma = readLuma(small);
  const threshold = otsuThreshold(baseLuma);
  const zeroVariance = profileVariance(baseLuma, small.width, small.height, threshold);

  const evalAngle = (angle: number): number => {
    if (angle === 0) return zeroVariance;
    const rotated = rotateCanvas(small, angle);
    return profileVariance(readLuma(rotated), rotated.width, rotated.height, threshold);
  };

  // 粗搜
  let bestAngle = 0;
  let bestVariance = zeroVariance;
  for (let a = -DESKEW_MAX_ANGLE; a <= DESKEW_MAX_ANGLE; a += 1) {
    const v = evalAngle(a);
    if (v > bestVariance) { bestVariance = v; bestAngle = a; }
  }
  // 細搜：粗搜最佳 ±1°，步長 0.1°
  for (let a = bestAngle - 1; a <= bestAngle + 1; a += 0.1) {
    const angle = Math.round(a * 10) / 10;
    const v = evalAngle(angle);
    if (v > bestVariance) { bestVariance = v; bestAngle = angle; }
  }

  // 防呆：角度太細、或方差提升唔明顯（非文件類圖片）→ 唔修正
  if (Math.abs(bestAngle) < DESKEW_MIN_CORRECTION) return 0;
  if (bestVariance < zeroVariance * 1.05) return 0;
  return bestAngle;
}

export async function compressImage(file: File): Promise<string> {
  const { source, width: srcW, height: srcH } = await loadImageWithExifOrientation(file);

  let width = srcW;
  let height = srcH;
  if (width > OCR_MAX_DIMENSION || height > OCR_MAX_DIMENSION) {
    if (width > height) {
      height = (height / width) * OCR_MAX_DIMENSION;
      width = OCR_MAX_DIMENSION;
    } else {
      width = (width / height) * OCR_MAX_DIMENSION;
      height = OCR_MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立canvas context');

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source instanceof ImageBitmap) source.close();

  // 第三階段：裁走紙外背景（影埋枱面嘅部分）。要用彩色圖嘅白度判別，所以先裁後灰階；
  // 裁完 deskew 剖面都更準
  const cropped = cropToDocument(canvas);
  const croppedCtx = cropped.getContext('2d');
  if (!croppedCtx) throw new Error('無法建立canvas context');
  applyGrayscaleContrastStretch(cropped, croppedCtx);

  // deskew：投影剖面偵測傾斜角，超過 0.3° 先修正（修正後四角空白補白）
  const skewAngle = detectSkewAngle(cropped);
  const finalCanvas = skewAngle !== 0 ? rotateCanvas(cropped, skewAngle) : cropped;

  let quality = 0.9;
  if (file.size > TARGET_IMAGE_SIZE) {
    quality = Math.max(0.6, TARGET_IMAGE_SIZE / file.size);
  }
  return finalCanvas.toDataURL('image/jpeg', quality).split(',')[1];
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
      return '系統未設定 AI 服務金鑰，請聯絡系統管理員。';
    case 'GEMINI_API_KEY_INVALID':
      return 'AI 服務金鑰無效：請聯絡系統管理員重新設定，注意勿夾帶空白、換行或引號，並確認金鑰未被重新產生。';
    case 'GEMINI_FORBIDDEN':
      return 'AI 服務金鑰失效或權限不足，請聯絡系統管理員確認金鑰狀態。';
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
      return '無法連線到 AI 辨識服務（服務暫無回應），請稍後再試或聯絡系統管理員。';
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
    const { data, error } = await supabase.functions.invoke('vision-extract', {
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
