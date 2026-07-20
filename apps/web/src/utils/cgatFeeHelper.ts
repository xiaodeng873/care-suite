import type { Patient } from '../lib/database';

/**
 * 合資格轄免收費人士判斷（runtime，不存 DB）
 * - 入住類型 = 院舍卷級別0 → 合資格
 * - 院舍卷級別1-7 → 不合資格（CGAT 收費等同自費）
 * - 社會福利.type = 綜合社會保障援助 → 合資格
 * - 公務員（本人 / 家屬）→ 合資格
 * - 社會福利.subtype = 長者生活津貼 且 年滿 75 歲 → 合資格
 */
export function calcAge(birthDate?: string, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

export interface FeeExemptResult {
  eligible: boolean;
  reasons: string[];
}

export function getFeeExemptEligibility(patient: Patient | undefined, today: Date = new Date()): FeeExemptResult {
  const reasons: string[] = [];
  if (!patient) return { eligible: false, reasons };

  if (patient.入住類型 === '院舍卷級別0') reasons.push('院舍卷級別0');

  const welfareType = patient.社會福利?.type;
  const welfareSubtype = patient.社會福利?.subtype;
  if (welfareType === '綜合社會保障援助') reasons.push('綜合社會保障援助');

  if (patient.公務員 === '公務員/家屬') reasons.push('公務員/家屬');
  if (patient.公務員 === '醫管局員工/家屬') reasons.push('醫管局員工/家屬');

  if (welfareSubtype === '長者生活津貼') {
    const age = calcAge(patient.出生日期, today);
    if (age !== null && age >= 75) reasons.push('長者生活津貼（年滿75歲）');
  }

  return { eligible: reasons.length > 0, reasons };
}

/**
 * 療程收費單位：以 4 週為一單位，不足 4 週亦算一個單位。
 */
export function treatmentUnits(weeks?: number | null): number {
  if (!weeks || weeks <= 0) return 0;
  return Math.ceil(weeks / 4);
}

export interface CgatFeeInput {
  patient?: Patient;
  feeExempted: boolean;                 // 一次性豁免
  medicationPickupArrangement?: string; // 取藥安排（家人前往 → 跳過費用）
  consultationFee: number;              // 診金
  medicationFeePerItem: number;         // 藥費（每處方）
  prescriptionCount?: number | null;    // 處方數量
  treatmentWeeks?: number | null;       // 療程周數
}

export interface CgatFeeResult {
  skipped: boolean;        // 是否跳過費用結算
  skipReason?: string;     // 跳過原因
  units: number;           // 療程收費單位
  medicationFee: number;   // 藥費小計
  total: number;           // 總費用
}

/**
 * 費用計算：
 * - 合資格 / 一次性豁免 / 取藥=家人前往 → 跳過（total = 0）
 * - 否則 總費用 = 診金 + 處方數量 × 藥費 × ceil(療程周數 / 4)
 */
export function calcCgatFee(input: CgatFeeInput, today: Date = new Date()): CgatFeeResult {
  const eligibility = getFeeExemptEligibility(input.patient, today);

  let skipReason: string | undefined;
  if (eligibility.eligible) skipReason = `合資格轄免收費人士（${eligibility.reasons.join('、')}）`;
  else if (input.feeExempted) skipReason = '一次性豁免';
  else if (input.medicationPickupArrangement === '家人前往') skipReason = '家人自取（家人前往）';

  if (skipReason) {
    return { skipped: true, skipReason, units: 0, medicationFee: 0, total: 0 };
  }

  const units = treatmentUnits(input.treatmentWeeks);
  const count = input.prescriptionCount ?? 0;
  const medicationFee = count * input.medicationFeePerItem * units;
  const total = input.consultationFee + medicationFee;

  return { skipped: false, units, medicationFee, total };
}
