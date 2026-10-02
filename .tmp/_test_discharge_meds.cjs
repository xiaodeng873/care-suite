"use strict";

// apps/web/src/utils/drugNameMatcher.ts
var SUGGEST_THRESHOLD = 0.6;
var CANDIDATE_THRESHOLD = 0.4;
var MAX_CANDIDATES = 3;
var FORM_WORDS = /* @__PURE__ */ new Set([
  "TABLET",
  "TABLETS",
  "TAB",
  "TABS",
  "CAPSULE",
  "CAPSULES",
  "CAP",
  "CAPS",
  "LIQUID",
  "SYRUP",
  "SOLUTION",
  "SUSPENSION",
  "SUSP",
  "CREAM",
  "OINTMENT",
  "OINT",
  "GEL",
  "LOTION",
  "DROPS",
  "DROP",
  "INJECTION",
  "INJ",
  "INFUSION",
  "PATCH",
  "PATCHES",
  "SACHET",
  "SACHETS",
  "SUPPOSITORY",
  "SUPP",
  "INHALER",
  "SPRAY",
  "POWDER",
  "GRANULES",
  "MIXTURE",
  "SR",
  "ER",
  "XR",
  "XL",
  "CR",
  "LA",
  "EC",
  "MR",
  "PR",
  "RETARD",
  "HCT"
]);
var stripFormWords = (tokens) => tokens.filter((t) => !FORM_WORDS.has(t));
var tokenize = (name) => {
  const upper = name.normalize("NFKC").toUpperCase().replace(/[µμ]G/g, "MCG");
  return stripFormWords(upper.split(/[^A-Z0-9.%]+/).filter(Boolean));
};
var normalizeDrugName = (name) => tokenize(name).join("");
var levenshteinRatio = (a, b) => {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const maxLen = Math.max(la, lb);
  if ((maxLen - Math.abs(la - lb)) / maxLen < 0.5) return 0;
  const s = la <= lb ? a : b;
  const l = la <= lb ? b : a;
  let prev = new Array(s.length + 1);
  let curr = new Array(s.length + 1);
  for (let j = 0; j <= s.length; j++) prev[j] = j;
  for (let i = 1; i <= l.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= s.length; j++) {
      const cost = l[i - 1] === s[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxLen * 0.6) return 0;
    [prev, curr] = [curr, prev];
  }
  const dist = prev[s.length];
  return 1 - dist / maxLen;
};
var tokenOverlap = (a, b) => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  if (inter === 0) return 0;
  return inter / Math.min(a.size, b.size);
};
var scorePair = (qNorm, qTokens, dNorm, dTokens) => {
  if (!qNorm || !dNorm) return 0;
  if (qNorm === dNorm) return 1;
  let score = 0;
  if (dNorm.includes(qNorm) || qNorm.includes(dNorm)) {
    const lenRatio = Math.min(qNorm.length, dNorm.length) / Math.max(qNorm.length, dNorm.length);
    score = Math.max(score, 0.7 + 0.25 * lenRatio);
  }
  score = Math.max(score, tokenOverlap(qTokens, dTokens) * 0.85);
  let bestTokenLev = 0;
  for (const qt of qTokens) {
    if (qt.length < 4 || !/^[A-Z]+$/.test(qt)) continue;
    for (const dt of dTokens) {
      if (dt.length < 4 || !/^[A-Z]+$/.test(dt)) continue;
      if (Math.abs(qt.length - dt.length) > 3) continue;
      const r = levenshteinRatio(qt, dt);
      if (r > bestTokenLev) bestTokenLev = r;
    }
  }
  score = Math.max(score, bestTokenLev * 0.9);
  score = Math.max(score, levenshteinRatio(qNorm, dNorm) * 0.8);
  return score;
};
function matchDrugName(ocrName, drugs) {
  const qNorm = normalizeDrugName(ocrName || "");
  const qTokens = new Set(tokenize(ocrName || ""));
  const result = { exact: null, candidates: [], best: null };
  if (!qNorm) return result;
  const scored = [];
  for (const drug of drugs) {
    const drugName = (drug.drug_name || "").trim();
    if (!drugName) continue;
    const dNorm = normalizeDrugName(drugName);
    if (dNorm === qNorm) {
      result.exact = drug;
      continue;
    }
    const score = scorePair(qNorm, qTokens, dNorm, new Set(tokenize(drugName)));
    if (score >= CANDIDATE_THRESHOLD) scored.push({ drug, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || (a.drug.drug_name || "").localeCompare(b.drug.drug_name || "", "en", { numeric: true, sensitivity: "base" })
  );
  result.candidates = scored.slice(0, MAX_CANDIDATES);
  result.best = result.candidates[0] && result.candidates[0].score >= SUGGEST_THRESHOLD ? result.candidates[0] : null;
  return result;
}

// apps/web/src/utils/dischargeSlipMedParser.ts
var str = (v) => typeof v === "string" ? v.trim() : v == null ? "" : String(v);
var HANDWRITTEN_MARK = /(?<![A-Z0-9.])(\d{1,2})\s?([APN])(?![A-Z0-9])/gi;
var parseHandwrittenMarks = (text) => {
  const slots = [];
  HANDWRITTEN_MARK.lastIndex = 0;
  let m;
  while ((m = HANDWRITTEN_MARK.exec(text)) !== null) {
    let hour = Number(m[1]);
    const meridian = m[2].toUpperCase();
    if (meridian === "A" && hour === 12) hour = 0;
    if ((meridian === "P" || meridian === "N") && hour !== 12) hour += 12;
    if (meridian === "N") hour = 12;
    if (hour >= 0 && hour < 24) slots.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return slots;
};
var VITAL_MAP = {
  SBP: "\u4E0A\u58D3",
  BP: "\u4E0A\u58D3",
  DBP: "\u4E0B\u58D3",
  HR: "\u8108\u640F",
  PULSE: "\u8108\u640F",
  SPO2: "\u8840\u542B\u6C27\u91CF",
  BSL: "\u8840\u7CD6\u503C",
  "BLOOD SUGAR": "\u8840\u7CD6\u503C",
  TEMP: "\u9AD4\u6EAB",
  TEMPERATURE: "\u9AD4\u6EAB"
};
var OPERATOR_MAP = {
  ">": "gt",
  "<": "lt",
  ">=": "gte",
  "=>": "gte",
  "<=": "lte",
  "=<": "lte"
};
var CONDITION_RE = /\b(give|administer|take|use|hold|withhold|stop|omit)\s+if\s+(SBP|DBP|BP|HR|PULSE|SPO2|BSL|BLOOD\s*SUGAR|TEMPERATURE|TEMP)\s*(>=|<=|=>|=<|>|<)\s*(\d+(?:\.\d+)?)\s*(MMHG|%|BPM|°C|MMOL\/?L)?/i;
function parseDischargeMedAnnotations(raw) {
  const corpus = [
    raw.\u670D\u7528\u983B\u7387,
    raw.\u670D\u7528\u983B\u7387\u53CA\u6642\u9593,
    raw.\u670D\u7528\u6B21\u6578,
    raw.\u670D\u7528\u6642\u6BB5,
    raw.\u5099\u8A3B,
    raw.\u7279\u6B8A\u7528\u6CD5,
    raw.\u670D\u7528\u4EFD\u91CF,
    raw.\u670D\u7528\u9014\u5F91
  ].map(str).filter(Boolean).join(" | ");
  const result = { timeSlots: [], hints: [] };
  if (!/[a-zA-Z]/.test(corpus)) return result;
  const upperCorpus = corpus.toUpperCase();
  if (/\b(QDS|QID)\b|\b(FOUR|4)\s*TIMES?\s*DAILY\b/i.test(corpus)) {
    result.dailyFrequency = 4;
    result.timeSlots.push("08:00", "12:00", "18:00", "22:00");
    result.hints.push("\u6BCF\u65E54\u6B21\uFF08QDS/QID\uFF09");
  } else if (/\b(TDS|TID)\b|\b(THREE|3)\s*TIMES?\s*DAILY\b/i.test(corpus)) {
    result.dailyFrequency = 3;
    result.timeSlots.push("08:00", "12:00", "18:00");
    result.hints.push("\u6BCF\u65E53\u6B21\uFF08TDS/TID\uFF09");
  } else if (/\b(BD|BID)\b|\bTWICE\s*DAILY\b|\b2\s*TIMES?\s*DAILY\b/i.test(corpus)) {
    result.dailyFrequency = 2;
    result.timeSlots.push("08:00", "16:00");
    result.hints.push("\u6BCF\u65E52\u6B21\uFF08BD\uFF09");
  } else if (/\b(QD|OD)\b|\bONCE\s*DAILY\b|\bDAILY\b/i.test(corpus)) {
    result.dailyFrequency = 1;
    result.hints.push("\u6BCF\u65E51\u6B21\uFF08QD/daily\uFF09");
  }
  if (/\bOM\b|\bMANE\b|\bIN\s*THE\s*MORNING\b/i.test(corpus)) {
    result.timeSlots.push("08:00");
    result.hints.push("\u65E9\u4E0A\uFF08OM/mane\uFF09");
  }
  if (/\bON\b(?!\s+DISCHARGE)|\bNOCTE\b|\bAT\s*NIGHT\b/i.test(corpus)) {
    result.timeSlots.push("20:00");
    result.hints.push("\u665A\u4E0A\uFF08ON/nocte\uFF09");
  }
  if (/\bAT\s*NOON\b|\bNOON\b|\bMIDDAY\b/i.test(corpus)) {
    result.timeSlots.push("12:00");
    result.hints.push("\u4E2D\u5348\uFF08at noon\uFF09");
  }
  const marks = parseHandwrittenMarks(upperCorpus);
  if (marks.length > 0) {
    result.timeSlots.push(...marks);
    result.hints.push(`\u624B\u5BEB\u6642\u9593\u6A19\u8A18 ${marks.join("\u3001")}`);
  }
  if (/\bPRN\b|\bWHEN\s*NECESSARY\b|\bAS\s*NEEDED\b/i.test(corpus)) {
    result.isPrn = true;
  }
  const daysMatch = corpus.match(/\bFOR\s+(\d+)\s*DAYS?\b/i);
  if (daysMatch) {
    result.durationDays = parseInt(daysMatch[1], 10);
    result.hints.push(`\u670D\u7528 ${result.durationDays} \u65E5`);
  }
  const condMatch = corpus.match(CONDITION_RE);
  if (condMatch) {
    const action = /^(hold|withhold|stop|omit)$/i.test(condMatch[1]) ? "block_dispensing" : "dispense_if_met";
    const vital = VITAL_MAP[condMatch[2].toUpperCase().replace(/\s+/g, " ")];
    const operator = OPERATOR_MAP[condMatch[3]];
    const value = parseFloat(condMatch[4]);
    if (vital && operator && Number.isFinite(value)) {
      result.inspection = {
        vital_sign_type: vital,
        condition_operator: operator,
        condition_value: value,
        action_if_met: action,
        sourceText: condMatch[0].trim()
      };
    }
  }
  result.timeSlots = [...new Set(result.timeSlots)].sort();
  return result;
}

// .tmp/_test_discharge_meds.ts
var db = [
  { drug_name: "PARACETAMOL 500MG TABLET" },
  { drug_name: "PARACETAMOL 250MG/5ML SYRUP" },
  { drug_name: "BISOPROLOL FUMARATE 2.5MG TABLET" },
  { drug_name: "AMOXICILLIN 500MG CAPSULE" },
  { drug_name: "IBUPROFEN 200MG TABLET" },
  { drug_name: "GLYCERYL TRINITRATE 400MCG SPRAY" }
];
var pass = 0;
var fail = 0;
var check = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`ok   ${label}`);
  } else {
    fail++;
    console.log(`FAIL ${label}`, detail ?? "");
  }
};
var r1 = matchDrugName("Paracetamol 500mg", db);
check("exact: Paracetamol 500mg \u2192 PARACETAMOL 500MG TABLET", r1.exact?.drug_name === "PARACETAMOL 500MG TABLET", r1);
var r2 = matchDrugName("Bisoprolol 2.5mg", db);
check("suggest: Bisoprolol 2.5mg \u2192 BISOPROLOL FUMARATE 2.5MG TABLET", !r2.exact && r2.best?.drug.drug_name === "BISOPROLOL FUMARATE 2.5MG TABLET", r2.best);
var r3 = matchDrugName("Amoxycillin 500mg", db);
check("typo: Amoxycillin 500mg \u2192 AMOXICILLIN 500MG CAPSULE", r3.best?.drug.drug_name === "AMOXICILLIN 500MG CAPSULE", r3.best);
var r4 = matchDrugName("GTN spray", db);
check("no false suggest: GTN spray \u2192 \u7121 best\uFF08\u7E2E\u5BEB\u5514\u61C9\u4E82\u4F30\uFF09", r4.best === null, r4.best);
var r5 = matchDrugName("Warfarin 1mg", db);
check("unmatched: Warfarin 1mg \u2192 \u7121 exact \u7121 best", !r5.exact && r5.best === null, r5.best);
check("normalize \u53BB\u5291\u578B\u8A5E", normalizeDrugName("Metformin 500mg tablet") === "METFORMIN500MG", normalizeDrugName("Metformin 500mg tablet"));
var p1 = parseDischargeMedAnnotations({ \u5099\u8A3B: "oral: 2.5 mg BD for 78 day(s)" });
check("BD \u2192 \u6BCF\u65E52\u6B21 + 08:00/16:00", p1.dailyFrequency === 2 && p1.timeSlots.join(",") === "08:00,16:00", p1);
check("for 78 day(s) \u2192 durationDays 78", p1.durationDays === 78, p1);
var p2 = parseDischargeMedAnnotations({ \u5099\u8A3B: "*** give if SBP >170mmHg, PRN" });
check("give if SBP >170 \u2192 \u4E0A\u58D3 gt 170 \u5148\u7D66\u85E5", p2.inspection?.vital_sign_type === "\u4E0A\u58D3" && p2.inspection.condition_operator === "gt" && p2.inspection.condition_value === 170 && p2.inspection.action_if_met === "dispense_if_met", p2.inspection);
check("PRN \u5075\u6E2C", p2.isPrn === true, p2);
var p3 = parseDischargeMedAnnotations({ \u5099\u8A3B: "hold if HR <50bpm" });
check("hold if HR <50 \u2192 \u8108\u640F lt 50 \u505C\u670D\u4E00\u6B21", p3.inspection?.vital_sign_type === "\u8108\u640F" && p3.inspection.condition_operator === "lt" && p3.inspection.condition_value === 50 && p3.inspection.action_if_met === "block_dispensing", p3.inspection);
var p4 = parseDischargeMedAnnotations({ \u670D\u7528\u983B\u7387: "TDS at noon", \u5099\u8A3B: "8A 12N 4P" });
check("TDS \u2192 \u6BCF\u65E53\u6B21 08:00/12:00/18:00", p4.dailyFrequency === 3 && p4.timeSlots.includes("18:00"), p4);
check("\u624B\u5BEB 8A/12N/4P \u2192 08:00/12:00/16:00", ["08:00", "12:00", "16:00"].every((t) => p4.timeSlots.includes(t)), p4.timeSlots);
var p5 = parseDischargeMedAnnotations({ \u5099\u8A3B: "adjusted 5/2026" });
check("adjusted 5/2026 \u2192 \u7121\u63A8\u65B7\uFF08\u53EA\u7559\u5099\u8A3B\uFF09", !p5.dailyFrequency && p5.timeSlots.length === 0 && !p5.inspection, p5);
var p6 = parseDischargeMedAnnotations({ \u5099\u8A3B: "rectal: 1 bottle(s) daily PRN" });
check("daily + PRN", p6.dailyFrequency === 1 && p6.isPrn === true, p6);
console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
