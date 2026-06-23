// 將儀表 OCR 結果（帶座標的文字詞）解析為監測記錄欄位。
// 設計重點：血壓計的 SBP/DBP 字體大小相同，僅靠「垂直位置（上=SBP、下=DBP）」
// 與「數值範圍（SBP>DBP）」區分；脈搏通常字體較小且在最底（可能帶心形圖示）。

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type VitalRecordType = '生命表徵' | '血糖控制';

export interface VitalSignScanResult {
  success: boolean;
  lowConfidence: boolean; // true 表示位置與數值兩種判斷不一致，建議人手核對
  values: Partial<{
    血壓收縮壓: string;
    血壓舒張壓: string;
    脈搏: string;
    血含氧量: string;
    血糖值: string;
  }>;
  rawText: string;
}

interface NumberCandidate {
  value: number;
  isDecimal: boolean;
  y0: number;
  yCenter: number;
  area: number;
}

const toCandidates = (words: OcrWord[]): NumberCandidate[] => {
  const candidates: NumberCandidate[] = [];
  for (const w of words) {
    const match = String(w.text ?? '').match(/\d+(?:\.\d+)?/);
    if (!match) continue;
    const raw = match[0];
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    const width = Math.max(1, w.x1 - w.x0);
    const height = Math.max(1, w.y1 - w.y0);
    candidates.push({
      value,
      isDecimal: raw.includes('.'),
      y0: w.y0,
      yCenter: (w.y0 + w.y1) / 2,
      area: width * height,
    });
  }
  return candidates;
};

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const rawTextOf = (words: OcrWord[]): string => words.map((w) => w.text).join(' ').trim();

// 血糖：取一個落在 1.0–33.3 mmol/L 的數值（優先小數）。
const parseGlucose = (words: OcrWord[]): VitalSignScanResult => {
  const rawText = rawTextOf(words);
  const candidates = toCandidates(words).filter((c) => c.value >= 1 && c.value <= 33.3);
  if (candidates.length === 0) {
    return { success: false, lowConfidence: false, values: {}, rawText };
  }
  // 優先小數（血糖儀幾乎都顯示一位小數），否則取面積最大者。
  const decimals = candidates.filter((c) => c.isDecimal);
  const pick = (decimals.length > 0 ? decimals : candidates).sort((a, b) => b.area - a.area)[0];
  const value = pick.isDecimal ? pick.value.toFixed(1) : String(pick.value);
  return {
    success: true,
    lowConfidence: candidates.length > 1 && decimals.length !== 1,
    values: { 血糖值: value },
    rawText,
  };
};

// 生命表徵：辨識 SBP / DBP / 脈搏（必要時血含氧量）。
const parseVitalSigns = (words: OcrWord[]): VitalSignScanResult => {
  const rawText = rawTextOf(words);
  // 整數候選，落在生命表徵合理範圍。
  const all = toCandidates(words).filter((c) => !c.isDecimal && c.value >= 30 && c.value <= 250);
  if (all.length < 2) {
    return { success: false, lowConfidence: false, values: {}, rawText };
  }

  // 先抽出可能的血含氧量（90–100，且通常獨立顯示）。
  // 僅當候選多於 3 個時才認定其中一個為血含氧量，避免把 DBP(如 95) 誤判。
  let spo2: NumberCandidate | undefined;
  const spo2Pool = all.filter((c) => c.value >= 90 && c.value <= 100);
  let working = [...all];
  if (all.length >= 4 && spo2Pool.length > 0) {
    spo2 = spo2Pool.sort((a, b) => a.area - b.area)[0];
    working = all.filter((c) => c !== spo2);
  }

  // 脈搏：字體通常較小。若有明顯較小者（面積 < 其餘中位數的 0.7）取之，否則取最底部。
  const areas = working.map((c) => c.area);
  const medArea = median(areas);
  let pulse: NumberCandidate | undefined;
  const smaller = working
    .filter((c) => c.area < medArea * 0.7 && c.value >= 30 && c.value <= 200)
    .sort((a, b) => a.area - b.area);
  if (smaller.length > 0) {
    pulse = smaller[0];
  } else if (working.length >= 3) {
    pulse = [...working].sort((a, b) => b.y0 - a.y0)[0]; // 最底部
  }

  const bpCandidates = working.filter((c) => c !== pulse);
  if (bpCandidates.length < 2) {
    return { success: false, lowConfidence: false, values: {}, rawText };
  }

  // 取面積最大的兩個作為血壓對（SBP/DBP 同字大小）。
  const pair = [...bpCandidates].sort((a, b) => b.area - a.area).slice(0, 2);

  // 位置判斷：上方(y 較小)= SBP、下方= DBP。
  const byPosition = [...pair].sort((a, b) => a.y0 - b.y0);
  const posSbp = byPosition[0];
  const posDbp = byPosition[1];

  // 數值判斷：較大者= SBP、較小者= DBP。
  const byValue = [...pair].sort((a, b) => b.value - a.value);
  const valSbp = byValue[0];
  const valDbp = byValue[1];

  // 兩種判斷一致則高信心，否則以數值為準但標記低信心。
  const agree = posSbp === valSbp && posDbp === valDbp;
  const sbp = agree ? posSbp : valSbp;
  const dbp = agree ? posDbp : valDbp;

  const values: VitalSignScanResult['values'] = {
    血壓收縮壓: String(sbp.value),
    血壓舒張壓: String(dbp.value),
  };
  if (pulse) values.脈搏 = String(pulse.value);
  if (spo2) values.血含氧量 = String(spo2.value);

  // 合理性檢查：SBP 應大於 DBP 且在合理範圍。
  const plausible = sbp.value > dbp.value && sbp.value >= 70 && dbp.value >= 30;

  return {
    success: true,
    lowConfidence: !agree || !plausible,
    values,
    rawText,
  };
};

export const parseVitalSignWords = (
  words: OcrWord[],
  recordType: VitalRecordType,
): VitalSignScanResult => {
  if (recordType === '血糖控制') return parseGlucose(words);
  return parseVitalSigns(words);
};
