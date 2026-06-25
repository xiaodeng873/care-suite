// 將 Gemini Vision API 回傳的儀表讀數 JSON 轉換為 VitalSignScanResult。
// 取代原本基於 Tesseract OCR 座標的啟發式解析，Gemini 理解儀表佈局語意，
// 直接輸出 {血壓收縮壓, 血壓舒張壓, 脈搏} 或 {血糖值}。

export type VitalRecordType = '生命表徵' | '血糖控制';

export interface VitalSignScanResult {
  success: boolean;
  lowConfidence: boolean; // true 時建議人手核對
  values: Partial<{
    血壓收縮壓: string;
    血壓舒張壓: string;
    脈搏: string;
    血含氧量: string;
    血糖值: string;
  }>;
  rawText: string; // Gemini 原始 JSON 字串（除錯用）
}

/** 將 Gemini 回傳的結構化 JSON 轉換為 VitalSignScanResult */
export function parseGeminiResponse(
  geminiData: Record<string, unknown> | null | undefined,
  recordType: VitalRecordType,
): VitalSignScanResult {
  const rawText = geminiData ? JSON.stringify(geminiData) : '';

  if (!geminiData || typeof geminiData !== 'object') {
    return { success: false, lowConfidence: false, values: {}, rawText };
  }

  if (recordType === '血糖控制') {
    const raw = geminiData['血糖值'];
    if (raw == null) {
      return { success: false, lowConfidence: false, values: {}, rawText };
    }
    const num = parseFloat(String(raw));
    if (!Number.isFinite(num) || num < 0.5 || num > 50) {
      return { success: false, lowConfidence: true, values: {}, rawText };
    }
    return {
      success: true,
      lowConfidence: false,
      values: { 血糖值: num.toFixed(1) },
      rawText,
    };
  }

  // 生命表徵：SBP 與 DBP 為必填
  const sbp = parseFloat(String(geminiData['血壓收縮壓'] ?? ''));
  const dbp = parseFloat(String(geminiData['血壓舒張壓'] ?? ''));

  if (!Number.isFinite(sbp) || !Number.isFinite(dbp)) {
    return { success: false, lowConfidence: false, values: {}, rawText };
  }

  // 合理性檢查
  const plausible = sbp > dbp && sbp >= 60 && sbp <= 260 && dbp >= 30 && dbp <= 160;

  const values: VitalSignScanResult['values'] = {
    血壓收縮壓: String(Math.round(sbp)),
    血壓舒張壓: String(Math.round(dbp)),
  };

  const pulse = geminiData['脈搏'];
  if (pulse != null) values.脈搏 = String(Math.round(parseFloat(String(pulse))));

  const spo2 = geminiData['血含氧量'];
  if (spo2 != null) values.血含氧量 = String(spo2);

  return {
    success: true,
    lowConfidence: !plausible,
    values,
    rawText,
  };
}

// ─── 已棄用的 Tesseract OCR 型別（保留以免舊引用報錯）────────────────────────
/** @deprecated Tesseract OCR 已由 Gemini Vision 取代，此型別不再使用 */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** @deprecated 改用 parseGeminiResponse */
export const parseVitalSignWords = (_words: OcrWord[], _recordType: VitalRecordType): VitalSignScanResult =>
  ({ success: false, lowConfidence: false, values: {}, rawText: '' });
