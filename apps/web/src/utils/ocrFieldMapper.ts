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

  if (ocrData.特殊用法) {
    mappedData.special_dosage_instruction = ocrData.特殊用法;
    confidences.special_dosage_instruction = confidenceScores['特殊用法'] || 0.85;
  } else if (ocrData.服用份量 || ocrData.服用單位) {
    const dosageText = `${ocrData.服用份量 || ''}${ocrData.服用單位 || ''}`;
    const matchedSpecial = specialInstructions.find(instruction =>
      dosageText.includes(instruction)
    );

    if (matchedSpecial) {
      mappedData.special_dosage_instruction = matchedSpecial;
      confidences.special_dosage_instruction = (confidenceScores['服用份量'] || confidenceScores['服用單位'] || 0.85) * 0.9;
    } else {
      if (ocrData.服用份量) {
        mappedData.dosage_amount = ocrData.服用份量;
        confidences.dosage_amount = confidenceScores['服用份量'] || 0.85;
      }
      if (ocrData.服用單位) {
        mappedData.dosage_unit = ocrData.服用單位;
        confidences.dosage_unit = confidenceScores['服用單位'] || 0.85;
      }
    }
  }

  if (ocrData.服用次數) {
    const frequency = parseInt(ocrData.服用次數);
    if (!isNaN(frequency) && frequency > 0) {
      mappedData.daily_frequency = frequency;
      confidences.daily_frequency = confidenceScores['服用次數'] || 0.85;
    }
  }

  if (ocrData.服用頻率) {
    const frequencyData = parseFrequency(ocrData.服用頻率);
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

  if (ocrData.服用時間 && Array.isArray(ocrData.服用時間)) {
    mappedData.medication_time_slots = ocrData.服用時間;
    confidences.medication_time_slots = confidenceScores['服用時間'] || 0.85;
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

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
  }

  return null;
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
