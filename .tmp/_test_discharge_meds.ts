// 出院紙藥名比對 + 英文註明解析 smoke test（用完可刪）
import { matchDrugName, normalizeDrugName } from '../apps/web/src/utils/drugNameMatcher';
import { parseDischargeMedAnnotations } from '../apps/web/src/utils/dischargeSlipMedParser';

const db = [
  { drug_name: 'PARACETAMOL 500MG TABLET' },
  { drug_name: 'PARACETAMOL 250MG/5ML SYRUP' },
  { drug_name: 'BISOPROLOL FUMARATE 2.5MG TABLET' },
  { drug_name: 'AMOXICILLIN 500MG CAPSULE' },
  { drug_name: 'IBUPROFEN 200MG TABLET' },
  { drug_name: 'GLYCERYL TRINITRATE 400MCG SPRAY' },
];

let pass = 0, fail = 0;
const check = (label: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}`, detail ?? ''); }
};

// ── matcher ──
const r1 = matchDrugName('Paracetamol 500mg', db);
check('exact: Paracetamol 500mg → PARACETAMOL 500MG TABLET', r1.exact?.drug_name === 'PARACETAMOL 500MG TABLET', r1);

const r2 = matchDrugName('Bisoprolol 2.5mg', db);
check('suggest: Bisoprolol 2.5mg → BISOPROLOL FUMARATE 2.5MG TABLET', !r2.exact && r2.best?.drug.drug_name === 'BISOPROLOL FUMARATE 2.5MG TABLET', r2.best);

const r3 = matchDrugName('Amoxycillin 500mg', db);
check('typo: Amoxycillin 500mg → AMOXICILLIN 500MG CAPSULE', r3.best?.drug.drug_name === 'AMOXICILLIN 500MG CAPSULE', r3.best);

const r4 = matchDrugName('GTN spray', db);
check('no false suggest: GTN spray → 無 best（縮寫唔應亂估）', r4.best === null, r4.best);

const r5 = matchDrugName('Warfarin 1mg', db);
check('unmatched: Warfarin 1mg → 無 exact 無 best', !r5.exact && r5.best === null, r5.best);

check('normalize 去劑型詞', normalizeDrugName('Metformin 500mg tablet') === 'METFORMIN500MG', normalizeDrugName('Metformin 500mg tablet'));

// ── parser ──
const p1 = parseDischargeMedAnnotations({ 備註: 'oral: 2.5 mg BD for 78 day(s)' });
check('BD → 每日2次 + 08:00/16:00', p1.dailyFrequency === 2 && p1.timeSlots.join(',') === '08:00,16:00', p1);
check('for 78 day(s) → durationDays 78', p1.durationDays === 78, p1);

const p2 = parseDischargeMedAnnotations({ 備註: '*** give if SBP >170mmHg, PRN' });
check('give if SBP >170 → 上壓 gt 170 先給藥', p2.inspection?.vital_sign_type === '上壓' && p2.inspection.condition_operator === 'gt' && p2.inspection.condition_value === 170 && p2.inspection.action_if_met === 'dispense_if_met', p2.inspection);
check('PRN 偵測', p2.isPrn === true, p2);

const p3 = parseDischargeMedAnnotations({ 備註: 'hold if HR <50bpm' });
check('hold if HR <50 → 脈搏 lt 50 停服一次', p3.inspection?.vital_sign_type === '脈搏' && p3.inspection.condition_operator === 'lt' && p3.inspection.condition_value === 50 && p3.inspection.action_if_met === 'block_dispensing', p3.inspection);

const p4 = parseDischargeMedAnnotations({ 服用頻率: 'TDS at noon', 備註: '8A 12N 4P' });
check('TDS → 每日3次 08:00/12:00/18:00', p4.dailyFrequency === 3 && p4.timeSlots.includes('18:00'), p4);
check('手寫 8A/12N/4P → 08:00/12:00/16:00', ['08:00', '12:00', '16:00'].every(t => p4.timeSlots.includes(t)), p4.timeSlots);

const p5 = parseDischargeMedAnnotations({ 備註: 'adjusted 5/2026' });
check('adjusted 5/2026 → 無推斷（只留備註）', !p5.dailyFrequency && p5.timeSlots.length === 0 && !p5.inspection, p5);

const p6 = parseDischargeMedAnnotations({ 備註: 'rectal: 1 bottle(s) daily PRN' });
check('daily + PRN', p6.dailyFrequency === 1 && p6.isPrn === true, p6);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
