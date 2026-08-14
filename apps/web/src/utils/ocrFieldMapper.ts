export interface OCRExtractedData {
  院友姓名?: string;
  處方日期?: string;
  藥物名稱?: string;
  藥物來源?: string;
  藥物數量?: string;
  劑型?: string;
  服用途徑?: string;
  服用份量?: string;
  服用單位?: string;
  特殊用法?: string;
  服用次數?: string;
  服用日數?: string;
  服用頻率?: string;
  需要時?: boolean;
  備註?: string;
  服用時間?: string[];
  檢測項?: Array<{
    項目?: string;
    條件?: string;
    數值?: number;
  }>;
  [key: string]: any;
}

export interface PrescriptionFormData {
  patient_id: string;
  medication_name: string;
  medication_source: string;
  medication_quantity: string;
  prescription_date: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration_days: string;
  dosage_form: string;
  administration_route: string;
  dosage_amount: string;
  dosage_unit: string;
  special_dosage_instruction: string;
  daily_frequency: number;
  frequency_type: string;
  frequency_value: number;
  specific_weekdays: number[];
  is_odd_even_day: string;
  medication_time_slots: string[];
  meal_timing: string;
  is_prn: boolean;
  preparation_method: string;
  status: string;
  notes: string;
}

export interface FieldConfidence {
  [key: string]: number;
}

export function mapOCRDataToPrescriptionForm(
  ocrData: OCRExtractedData,
  confidenceScores: Record<string, number>,
  patients: any[]
): { formData: Partial<PrescriptionFormData>; confidences: FieldConfidence } {
  const mappedData: Partial<PrescriptionFormData> = {};
  const confidences: FieldConfidence = {};

  if (ocrData.院友姓名) {
    const matchedPatient = findPatientByName(ocrData.院友姓名, patients);
    if (matchedPatient) {
      mappedData.patient_id = matchedPatient.院友id.toString();
      confidences.patient_id = confidenceScores['院友姓名'] || 0.85;
    } else {
      confidences.patient_id = 0.3;
    }
  }

  if (ocrData.藥物名稱) {
    mappedData.medication_name = ocrData.藥物名稱;
    confidences.medication_name = confidenceScores['藥物名稱'] || 0.85;
  }

  if (ocrData.藥物來源) {
    mappedData.medication_source = ocrData.藥物來源;
    confidences.medication_source = confidenceScores['藥物來源'] || 0.85;
  }

  if (ocrData.藥物數量) {
    mappedData.medication_quantity = ocrData.藥物數量;
    confidences.medication_quantity = confidenceScores['藥物數量'] || 0.85;
  }

  if (ocrData.處方日期) {
    const parsedDate = parseDate(ocrData.處方日期);
    if (parsedDate) {
      mappedData.prescription_date = parsedDate;
      mappedData.start_date = parsedDate;
      confidences.prescription_date = confidenceScores['處方日期'] || 0.85;
      confidences.start_date = confidenceScores['處方日期'] || 0.85;
    }
  }

  if (ocrData.劑型) {
    mappedData.dosage_form = ocrData.劑型;
    confidences.dosage_form = confidenceScores['劑型'] || 0.85;
  }

  if (ocrData.服用途徑) {
    mappedData.administration_route = ocrData.服用途徑;
    confidences.administration_route = confidenceScores['服用途徑'] || 0.85;
  }

  const specialInstructions = ['搽患處', '貼在皮膚上', '適量', '薄薄一層', '按需要使用'];

  // 服用份量 / 服用單位：優先使用「服用份量」，也接受「服用劑量」別名
  const dosageAmountSource = ocrData.服用份量 ?? ocrData.服用劑量;
  if (ocrData.特殊用法) {
    mappedData.special_dosage_instruction = ocrData.特殊用法;
    confidences.special_dosage_instruction = confidenceScores['特殊用法'] || 0.85;
  } else if (dosageAmountSource || ocrData.服用單位) {
    // 若服用劑量包含「每次 X 單位」或「X 單位」，嘗試拆出份量與單位
    let amount = String(dosageAmountSource || '');
    let unit = ocrData.服用單位 || '';
    if (!unit && ocrData.服用劑量) {
      const doseMatch = String(ocrData.服用劑量).match(/(?:每次|每劑)?\s*(\d+(?:\.\d+)?)\s*(粒|片|膠囊|毫升|滴|口|支|包|茶匙|湯匙|mg|ml|g|mcg|IU)/i);
      if (doseMatch) {
        amount = doseMatch[1];
        unit = doseMatch[2];
      }
    }
    const dosageText = `${amount}${unit}`;
    const matchedSpecial = specialInstructions.find(instruction => dosageText.includes(instruction));

    if (matchedSpecial) {
      mappedData.special_dosage_instruction = matchedSpecial;
      confidences.special_dosage_instruction = (confidenceScores['服用份量'] || confidenceScores['服用單位'] || 0.85) * 0.9;
    } else {
      if (amount) {
        mappedData.dosage_amount = amount;
        confidences.dosage_amount = confidenceScores['服用份量'] || confidenceScores['服用劑量'] || 0.85;
      }
      if (unit) {
        mappedData.dosage_unit = unit;
        confidences.dosage_unit = confidenceScores['服用單位'] || 0.85;
      }
    }
  }

  // 服用頻率：接受「服用頻率」或「服用頻率及時間」的文字部分
  const frequencySource = ocrData.服用頻率 ?? ocrData.服用頻率及時間;
  if (frequencySource) {
    const frequencyText = stripTimeFromFrequencyText(String(frequencySource));
    const frequencyData = parseFrequency(frequencyText);
    if (frequencyData) {
      mappedData.frequency_type = frequencyData.type;
      mappedData.frequency_value = frequencyData.value;
      if (frequencyData.weekdays) {
        mappedData.specific_weekdays = frequencyData.weekdays;
      }
      if (frequencyData.oddEven) {
        mappedData.is_odd_even_day = frequencyData.oddEven;
      }
      confidences.frequency_type = confidenceScores['服用頻率'] || 0.8;
      confidences.frequency_value = confidenceScores['服用頻率'] || 0.8;
    }
  }

  if (ocrData.服用次數) {
    const frequency = parseInt(ocrData.服用次數);
    if (!isNaN(frequency) && frequency > 0) {
      mappedData.daily_frequency = frequency;
      confidences.daily_frequency = confidenceScores['服用次數'] || 0.85;
    }
  }

  if (ocrData.服用時間) {
    const slots = parseTimeSlots(ocrData.服用時間);
    if (slots.length > 0) {
      mappedData.medication_time_slots = slots;
      confidences.medication_time_slots = confidenceScores['服用時間'] || 0.85;
    }
  } else if (ocrData.服用頻率及時間) {
    // 若時間被合併在頻率欄位，嘗試拆出時間
    const slots = parseTimeSlotsFromCombinedFrequency(String(ocrData.服用頻率及時間));
    if (slots.length > 0) {
      mappedData.medication_time_slots = slots;
      confidences.medication_time_slots = confidenceScores['服用時間'] || 0.85;
    }
  }

  if (typeof ocrData.需要時 === 'boolean') {
    mappedData.is_prn = ocrData.需要時;
    confidences.is_prn = confidenceScores['需要時'] || 0.85;
  }

  if (ocrData.備註) {
    mappedData.notes = ocrData.備註;
    confidences.notes = confidenceScores['備註'] || 0.85;
  }

  if (ocrData.服用日數) {
    const daysMatch = ocrData.服用日數.match(/(\d+)/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      mappedData.duration_days = days.toString();
      confidences.duration_days = confidenceScores['服用日數'] || 0.85;

      if (ocrData.處方日期 && days > 0) {
        const startDate = new Date(parseDate(ocrData.處方日期) || new Date());
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + days);
        mappedData.end_date = endDate.toISOString().split('T')[0];
        confidences.end_date = (confidenceScores['服用日數'] || 0.85) * 0.9;
      }
    }
  }

  return { formData: mappedData, confidences };
}

function findPatientByName(name: string, patients: any[]): any | null {
  if (!name || !patients || patients.length === 0) return null;

  const cleanName = name.trim().replace(/\s+/g, '');

  for (const patient of patients) {
    const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.replace(/\s+/g, '');
    const patientName = patient.中文姓名?.replace(/\s+/g, '');

    if (patientFullName === cleanName || patientName === cleanName) {
      return patient;
    }
  }

  for (const patient of patients) {
    const patientFullName = `${patient.中文姓氏}${patient.中文名字}`.replace(/\s+/g, '');
    const patientName = patient.中文姓名?.replace(/\s+/g, '');

    if (patientFullName.includes(cleanName) || cleanName.includes(patientFullName)) {
      return patient;
    }
    if (patientName && (patientName.includes(cleanName) || cleanName.includes(patientName))) {
      return patient;
    }
  }

  return null;
}

function parseDate(dateString: string): string | null {
  if (!dateString) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // 處理兩位年份：DD/MM/YY 或 YY/MM/DD
  const twoDigitYearMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (twoDigitYearMatch) {
    const [, a, b, yy] = twoDigitYearMatch;
    const yearNum = parseInt(yy);
    // 50-99 視為 1900年代，00-49 視為 2000年代
    const fullYear = yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum;
    // 若第一組明顯大於 12 則為 DD/MM/YY，否則假設 DD/MM/YY（香港慣例）
    const dayVal = parseInt(a);
    const monthVal = parseInt(b);
    if (dayVal <= 31 && monthVal <= 12) {
      return `${fullYear}-${String(monthVal).padStart(2, '0')}-${String(dayVal).padStart(2, '0')}`;
    }
  }

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
  }

  return null;
}

function parseTimeSlots(value: unknown): string[] {
  if (!value) return [];

  let tokens: string[] = [];
  if (Array.isArray(value)) {
    tokens = value.map(String);
  } else if (typeof value === 'string') {
    // 拆開逗號、中文逗號、空格、頓號；先移除外圍括號與引號
    const cleaned = value
      .replace(/^[\[(\s"'"`]+|[\])\s"'"`]+$/g, '')
      .replace(/（/g, '(').replace(/）/g, ')')
      .replace(/、/g, ',');
    tokens = cleaned.split(/[,\s]+/).filter(Boolean);
  } else {
    return [];
  }

  const mealTimeMap: Record<string, string> = {
    '早': '08:00', '早餐': '08:00', '早餐前': '07:00', '早餐後': '09:00',
    '午': '12:00', '午餐': '12:00', '午餐前': '11:00', '午餐後': '13:00',
    '下午': '16:00', '下午茶': '15:00',
    '晚': '18:00', '晚餐': '18:00', '晚餐前': '17:00', '晚餐後': '19:00',
    '睡前': '22:00', '睡': '22:00',
    'midnight': '00:00', '午夜': '00:00',
  };

  const results: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;

    // 已經是 HH:MM
    if (/^\d{1,2}:\d{2}$/.test(token)) {
      const [h, m] = token.split(':');
      results.push(`${String(Number(h)).padStart(2, '0')}:${m}`);
      continue;
    }

    // HHMM 格式
    if (/^\d{4}$/.test(token)) {
      const h = token.slice(0, 2);
      const m = token.slice(2, 4);
      if (Number(h) < 24 && Number(m) < 60) {
        results.push(`${h}:${m}`);
      }
      continue;
    }

    // AM/PM 格式：8A, 12N, 4P, 8AM, 12pm, 4:30pm
    const ampmMatch = token.match(/^(\d{1,2})(?::(\d{2}))?(a|p|am|pm|n|noon)$/);
    if (ampmMatch) {
      let hour = Number(ampmMatch[1]);
      const minute = ampmMatch[2] || '00';
      const meridian = ampmMatch[3];
      if (['a', 'am'].includes(meridian) && hour === 12) hour = 0;
      if (['p', 'pm', 'n', 'noon'].includes(meridian) && hour !== 12) hour += 12;
      if (hour < 24 && Number(minute) < 60) {
        results.push(`${String(hour).padStart(2, '0')}:${minute}`);
      }
      continue;
    }

    // 餐別/時間關鍵字
    if (mealTimeMap[token]) {
      results.push(mealTimeMap[token]);
      continue;
    }
    for (const [key, time] of Object.entries(mealTimeMap)) {
      if (token.includes(key)) {
        results.push(time);
        break;
      }
    }
  }

  return [...new Set(results)].sort();
}

function stripTimeFromFrequencyText(text: string): string {
  // 移除括號內的時間描述，例如「每日三次（早、午、下午：8A, 12N, 4P)」
  return text
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function parseTimeSlotsFromCombinedFrequency(text: string): string[] {
  // 從「服用頻率及時間」合併欄位中拆出時間；保留括號內時間部分
  return parseTimeSlots(text);
}

function parseFrequency(frequencyString: string): {
  type: string;
  value: number;
  weekdays?: number[];
  oddEven?: string;
} | null {
  if (!frequencyString) return null;

  const freq = frequencyString.toLowerCase();

  if (freq.includes('每日') || freq.includes('每天') || freq === 'daily') {
    return { type: 'daily', value: 1 };
  }

  const everyXDaysMatch = freq.match(/每(\d+)日|每隔(\d+)日|every\s*(\d+)\s*days?/i);
  if (everyXDaysMatch) {
    const days = parseInt(everyXDaysMatch[1] || everyXDaysMatch[2] || everyXDaysMatch[3]);
    return { type: 'every_x_days', value: days };
  }

  const everyXMonthsMatch = freq.match(/每(\d+)月|每隔(\d+)月|every\s*(\d+)\s*months?/i);
  if (everyXMonthsMatch) {
    const months = parseInt(everyXMonthsMatch[1] || everyXMonthsMatch[2] || everyXMonthsMatch[3]);
    return { type: 'every_x_months', value: months };
  }

  if (freq.includes('單日') || freq.includes('odd day')) {
    return { type: 'odd_even_days', value: 1, oddEven: 'odd' };
  }

  if (freq.includes('雙日') || freq.includes('even day')) {
    return { type: 'odd_even_days', value: 1, oddEven: 'even' };
  }

  const weekdayMap: Record<string, number> = {
    '星期一': 1, '週一': 1, '禮拜一': 1, 'monday': 1, 'mon': 1,
    '星期二': 2, '週二': 2, '禮拜二': 2, 'tuesday': 2, 'tue': 2,
    '星期三': 3, '週三': 3, '禮拜三': 3, 'wednesday': 3, 'wed': 3,
    '星期四': 4, '週四': 4, '禮拜四': 4, 'thursday': 4, 'thu': 4,
    '星期五': 5, '週五': 5, '禮拜五': 5, 'friday': 5, 'fri': 5,
    '星期六': 6, '週六': 6, '禮拜六': 6, 'saturday': 6, 'sat': 6,
    '星期日': 7, '週日': 7, '禮拜日': 7, 'sunday': 7, 'sun': 7
  };

  const weekdays: number[] = [];
  for (const [key, value] of Object.entries(weekdayMap)) {
    if (freq.includes(key)) {
      weekdays.push(value);
    }
  }

  if (weekdays.length > 0) {
    return { type: 'weekly_days', value: 1, weekdays: weekdays.sort() };
  }

  return { type: 'daily', value: 1 };
}

export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high': return 'bg-blue-50 border-blue-300';
    case 'medium': return 'bg-yellow-50 border-yellow-300';
    case 'low': return 'bg-orange-50 border-orange-300';
  }
}

export function getConfidenceIcon(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high': return '✓';
    case 'medium': return '!';
    case 'low': return '⚠';
  }
}
