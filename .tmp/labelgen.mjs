var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// <define:import.meta.env>
var define_import_meta_env_default;
var init_define_import_meta_env = __esm({
  "<define:import.meta.env>"() {
    define_import_meta_env_default = { BASE_URL: "/" };
  }
});

// scripts/_supabase_stub.mjs
var init_supabase_stub = __esm({
  "scripts/_supabase_stub.mjs"() {
    init_define_import_meta_env();
  }
});

// apps/web/src/lib/recycleBin.ts
var init_recycleBin = __esm({
  "apps/web/src/lib/recycleBin.ts"() {
    "use strict";
    init_define_import_meta_env();
    init_supabase_stub();
  }
});

// apps/web/src/utils/stayTypeChanges.ts
var init_stayTypeChanges = __esm({
  "apps/web/src/utils/stayTypeChanges.ts"() {
    "use strict";
    init_define_import_meta_env();
  }
});

// apps/web/src/config/supabase.config.ts
var SUPABASE_CONFIG;
var init_supabase_config = __esm({
  "apps/web/src/config/supabase.config.ts"() {
    "use strict";
    init_define_import_meta_env();
    SUPABASE_CONFIG = {
      url: define_import_meta_env_default.VITE_SUPABASE_URL ?? "",
      anonKey: define_import_meta_env_default.VITE_SUPABASE_ANON_KEY ?? ""
    };
  }
});

// apps/web/src/utils/storageUpload.ts
var init_storageUpload = __esm({
  "apps/web/src/utils/storageUpload.ts"() {
    "use strict";
    init_define_import_meta_env();
    init_supabase_stub();
    init_supabase_config();
  }
});

// apps/web/src/utils/patientPhotoUpload.ts
var init_patientPhotoUpload = __esm({
  "apps/web/src/utils/patientPhotoUpload.ts"() {
    "use strict";
    init_define_import_meta_env();
    init_storageUpload();
  }
});

// apps/web/src/lib/database.tsx
var init_database = __esm({
  "apps/web/src/lib/database.tsx"() {
    "use strict";
    init_define_import_meta_env();
    init_supabase_stub();
    init_recycleBin();
    init_stayTypeChanges();
    init_storageUpload();
    init_patientPhotoUpload();
  }
});

// apps/web/src/utils/prescriptionLabelHtmlGenerator.ts
init_define_import_meta_env();

// apps/web/src/utils/medicationRecordHtmlExporter.ts
init_define_import_meta_env();

// apps/web/src/utils/medicationWorkflowHelper.ts
init_define_import_meta_env();
init_supabase_stub();

// apps/web/src/utils/facilitySettings.ts
init_define_import_meta_env();
init_supabase_stub();

// apps/web/src/utils/prescriptionSchedule.ts
init_define_import_meta_env();
var DAY_MS = 1e3 * 60 * 60 * 24;

// apps/web/src/utils/prescriptionExpiry.ts
init_define_import_meta_env();

// apps/web/src/utils/workflowCellRule.ts
init_define_import_meta_env();

// apps/web/src/utils/mealTiming.ts
init_define_import_meta_env();

// apps/web/src/utils/dateFormat.ts
init_define_import_meta_env();

// apps/web/src/utils/bedTransferUtils.ts
init_define_import_meta_env();
init_database();

// apps/web/src/utils/medicationRecordHtmlExporter.ts
init_supabase_stub();
var MIN_SLOT_ROWS = 4;
var MM_PER_PX = 25.4 / 96;
var ROW_SIGN_MM = 6;
var FILLER_BLOCK_MM = MIN_SLOT_ROWS * ROW_SIGN_MM;
var formatSlotShortLabel = (slot) => {
  const match = String(slot ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return slot;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  if (hour === 12 && minute === "00") return "12N";
  const suffix = hour < 12 ? "A" : "P";
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return minute === "00" ? `${hour12}${suffix}` : `${hour12}:${minute}${suffix}`;
};

// apps/web/src/utils/estimatedEndDate.ts
init_define_import_meta_env();
var toNumber = (v) => {
  if (v === null || v === void 0 || v === "") return NaN;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
};
function computeDailyAverageUsage(rx) {
  const dosage = toNumber(rx.dosage_amount);
  if (!Number.isFinite(dosage) || dosage <= 0) return NaN;
  const dailyFreq = rx.daily_frequency || (Array.isArray(rx.medication_time_slots) ? rx.medication_time_slots.length : 0) || 1;
  const freqType = rx.frequency_type || "daily";
  const freqValue = Number(rx.frequency_value) || 1;
  switch (freqType) {
    case "daily":
      return dosage * dailyFreq;
    case "every_x_days":
      return dosage * dailyFreq / (freqValue > 0 ? freqValue : 1);
    case "every_x_weeks":
      return dosage * dailyFreq / ((freqValue > 0 ? freqValue : 1) * 7);
    case "odd_even_days":
      return dosage * dailyFreq / 2;
    case "weekly_days": {
      const n = Array.isArray(rx.specific_weekdays) ? rx.specific_weekdays.length : 0;
      if (n <= 0) return NaN;
      return dosage * dailyFreq * n / 7;
    }
    case "every_x_months":
      return dosage * dailyFreq / ((freqValue > 0 ? freqValue : 1) * 30);
    case "hourly":
      return dosage * (24 / (freqValue > 0 ? freqValue : 24));
    default:
      return dosage * dailyFreq;
  }
}
function computeEstimatedEndDate(rx) {
  if (rx.end_date) return "";
  if (!rx.prescription_date) return "";
  const quantity = toNumber(rx.medication_quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return "";
  const perDay = computeDailyAverageUsage(rx);
  if (!Number.isFinite(perDay) || perDay <= 0) return "";
  const days = Math.floor(quantity / perDay);
  if (days <= 0) return "";
  const base = /* @__PURE__ */ new Date(`${rx.prescription_date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

// apps/web/src/utils/prescriptionLabelHtmlGenerator.ts
var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var formatDosage = (p) => {
  if (!p.dosage_amount) return "";
  const amt = String(p.dosage_amount).trim();
  if (!amt) return "";
  const unit = p.dosage_unit ?? "";
  return /^\d+(\.\d+)?$/.test(amt) ? amt + unit : amt;
};
var buildOddEvenMonths = (prescription, refDate = /* @__PURE__ */ new Date()) => {
  if (prescription.frequency_type !== "every_x_days") return null;
  if (Number(prescription.frequency_value) !== 2) return null;
  const parseDay = (raw) => {
    const m = String(raw ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const start = parseDay(prescription.start_date);
  const lastTaken = parseDay(prescription.last_taken_date);
  const anchor = lastTaken && (!start || lastTaken >= start) && lastTaken || start || parseDay(prescription.prescription_date);
  if (!anchor) return null;
  const startYear = refDate.getFullYear();
  const startMonth = refDate.getMonth();
  const endRaw = prescription.end_date || prescription.estimated_end_date || computeEstimatedEndDate(prescription) || "";
  const em = String(endRaw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let monthCount = 5;
  if (em) {
    const diff = (Number(em[1]) - startYear) * 12 + (Number(em[2]) - 1 - startMonth) + 1;
    monthCount = Math.min(6, Math.max(1, diff));
  }
  const DAY_MS2 = 24 * 60 * 60 * 1e3;
  const result = [];
  for (let i = 0; i < monthCount; i++) {
    const y = startYear + Math.floor((startMonth + i) / 12);
    const m0 = (startMonth + i) % 12;
    const firstOfMonth = new Date(y, m0, 1);
    const diffDays = Math.round((firstOfMonth.getTime() - anchor.getTime()) / DAY_MS2);
    result.push(`${m0 + 1}\u6708${diffDays % 2 === 0 ? "\u55AE" : "\u96D9"}\u65E5`);
  }
  return result;
};
var buildLabelContent = (patient, prescription, refDate = /* @__PURE__ */ new Date()) => {
  const patientName = (patient.\u4E2D\u6587\u59D3\u540D || `${patient.\u4E2D\u6587\u59D3\u6C0F ?? ""}${patient.\u4E2D\u6587\u540D\u5B57 ?? ""}`).trim();
  const dosage = formatDosage(prescription);
  const doseSuffix = dosage ? ` \xD7 ${dosage}` : "";
  const slots = (prescription.medication_time_slots ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  let dosageLines;
  if (slots.length > 0) {
    dosageLines = [...new Set(slots)].map((slot) => `${formatSlotShortLabel(slot)}${doseSuffix}`);
  } else if (prescription.is_prn) {
    dosageLines = [`\u9700\u8981\u6642${doseSuffix}`];
  } else {
    dosageLines = dosage ? [dosage] : [];
  }
  const hasQtyOrDuration = Boolean(
    String(prescription.medication_quantity ?? "").trim() || String(prescription.duration_days ?? "").trim()
  );
  const formatLabelDate = (iso) => {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
  };
  const endDateRaw = prescription.end_date || (prescription.is_prn ? "" : prescription.estimated_end_date);
  const endDateLine = hasQtyOrDuration && endDateRaw ? `#${formatLabelDate(endDateRaw)}` : null;
  const oddEvenMonths = buildOddEvenMonths(prescription, refDate);
  return {
    patientName,
    drugName: String(prescription.medication_name ?? "").trim(),
    dosageLines,
    endDateLine,
    oddEvenMonths
  };
};
var slotFontSizePt = (lineCount, hasEndDate) => {
  if (lineCount <= 0) return 13;
  const availMm = 30 - (2.5 + 7.2 + 1.2 + (hasEndDate ? 3.6 : 0));
  const pt = availMm / (lineCount * 1.25 * 0.3528);
  return Math.max(6, Math.min(13, Math.floor(pt * 2) / 2));
};
var renderLabelHtml = (content) => {
  const endDateHtml = content.endDateLine ? `<div class="enddate">${escapeHtml(content.endDateLine)}</div>` : "";
  const monthsHtml = content.oddEvenMonths ? `<div class="months">${content.oddEvenMonths.map((mo) => `<div class="month">${escapeHtml(mo)}\uFF1B</div>`).join("")}</div>` : "";
  const slotPt = slotFontSizePt(
    content.dosageLines.length,
    Boolean(content.endDateLine)
  );
  return `<div class="label">
  <div class="top">
    <div class="name">${escapeHtml(content.patientName)}</div>
    <div class="drug">${escapeHtml(content.drugName)}</div>
  </div>
  <div class="divider"></div>
  <div class="bottom">
    <div class="main">
      <div class="slots">${content.dosageLines.map((l) => `<div class="slot" style="font-size:${slotPt}pt">${escapeHtml(l)}</div>`).join("")}</div>
      ${endDateHtml}
    </div>
    ${monthsHtml}
  </div>
</div>`;
};
var LABEL_CSS = `
  @page { size: 40mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Microsoft JhengHei", "PingFang HK", "Noto Sans HK", sans-serif; color: #000; }
  .label {
    width: 40mm; height: 30mm; overflow: hidden;
    padding: 1.5mm 2mm 1mm;
    display: flex; flex-direction: column;
  }
  .top { flex: 0 0 auto; }
  .name { font-size: 9pt; font-weight: 700; line-height: 1.15; }
  .drug { font-size: 7.5pt; font-weight: 700; line-height: 1.15; margin-top: 0.5mm;
          word-break: break-all; }
  /* \u5169\u5340\u5206\u9694\u7DDA\uFF1A\u4E0A\u5340\u59D3\u540D+\u85E5\u540D\uFF0C\u4E0B\u5340\u5176\u9918 */
  .divider { flex: 0 0 auto; border-top: 0.35mm solid #000; margin: 0.8mm 0; }
  .bottom { flex: 1 1 auto; display: flex; flex-direction: row; min-height: 0; min-width: 0; }
  /* \u5DE6\u5340\uFF1A\u6642\u9593\u9EDE+\u5291\u91CF\u70BA\u4E3B\u89D2\uFF0C\u5782\u76F4\u7F6E\u4E2D\uFF1B\u7D50\u675F\u65E5\u671F\u7F6E\u5E95 */
  .main { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .slots { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
  .slot { font-weight: 900; line-height: 1.25; letter-spacing: 0.2mm; }
  .enddate { flex: 0 0 auto; font-size: 8.5pt; font-weight: 700; line-height: 1.2; }
  /* \u53F3\u6B04\u6708\u4EFD\u6307\u5F15\uFF1A\u5514\u4F54\u5782\u76F4\u9AD8\u5EA6\uFF0C\u6BCF\u6708\u4E00\u884C\u5206\u865F\u5206\u9694\uFF0C\u5DE6\u908A\u5206\u754C\u7DDA */
  .months { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center;
            border-left: 0.25mm solid #000; padding-left: 1.2mm; margin-left: 1.5mm;
            font-size: 6.5pt; font-weight: 700; line-height: 1.25; white-space: nowrap; }
`;
var generatePrescriptionLabelDocument = (labels) => {
  const pages = labels.map(
    (content, i) => `<div class="label-page"${i < labels.length - 1 ? ' style="page-break-after: always;"' : ""}>${renderLabelHtml(content)}</div>`
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<title>\u8655\u65B9\u6A19\u7C64</title>
<style>${LABEL_CSS}
.label-page { width: 40mm; height: 30mm; overflow: hidden; }
</style>
</head>
<body>
${pages}
</body>
</html>`;
};
var generateSingleLabelDocument = (patient, prescription) => generatePrescriptionLabelDocument([buildLabelContent(patient, prescription)]);
var printPrescriptionLabels = (labels) => {
  if (typeof document === "undefined" || labels.length === 0) return;
  const html = generatePrescriptionLabelDocument(labels);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:300px;height:200px;border:0;";
  document.body.appendChild(iframe);
  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  win.addEventListener("afterprint", () => setTimeout(cleanup, 200));
  const trigger = () => {
    win.focus();
    win.print();
  };
  if (doc.readyState === "complete") {
    setTimeout(trigger, 100);
  } else {
    win.addEventListener("load", () => setTimeout(trigger, 100));
  }
};
export {
  buildLabelContent,
  buildOddEvenMonths,
  generatePrescriptionLabelDocument,
  generateSingleLabelDocument,
  printPrescriptionLabels,
  renderLabelHtml,
  slotFontSizePt
};
