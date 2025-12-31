/**
 * 年度體檢報告書 PDF/HTML 生成器
 * 附件12.1 - Medical Examination Form for Residents in Residential Care Homes for the Elderly
 * 安老院住客體格檢驗報告書
 */
import { AnnualHealthCheckup, parseMentalStateAssessment } from './annualHealthCheckupHelper';
import { supabase } from '../lib/supabase';
interface Patient {
  院友id: number;
  床號: string;
  中文姓名: string;
  中文姓氏: string;
  中文名字: string;
  英文姓名?: string;
  英文姓氏?: string;
  英文名字?: string;
  性別: '男' | '女';
  身份證號碼: string;
  出生日期?: string;
  藥物敏感?: string[];
  感染控制?: string[];
}
interface MedicationPrescription {
  id: string;
  medication_name: string;
  dosage_form?: string;
  administration_route?: string;
  dosage_amount?: string;
  dosage_unit?: string;
  daily_frequency?: number;
  frequency_type: string;
  frequency_value?: number;
  is_prn?: boolean;
  medication_time_slots?: string[];
  meal_timing?: string;
  status: string;
}
// 計算年齡
const calculateAge = (birthDate?: string): string => {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age.toString();
};
// 獲取活躍處方
export const getActivePrescriptions = async (patientId: number): Promise<MedicationPrescription[]> => {
  try {
    const { data, error } = await supabase
      .from('new_medication_prescriptions')
      .select('id, medication_name, dosage_form, administration_route, dosage_amount, dosage_unit, daily_frequency, frequency_type, frequency_value, is_prn, medication_time_slots, meal_timing, status')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return [];
  }
};
// 格式化頻次 - 返回 QD/BD/TDS/QID 或其他頻率（只顯示字母縮寫）
const formatFrequencyDisplay = (prescription: MedicationPrescription): string => {
  const dailyFreq = prescription.daily_frequency || 1;
  // 頻率代碼映射 - 只顯示字母縮寫
  const freqCodeMap: { [key: number]: string } = {
    1: 'QD',
    2: 'BD',
    3: 'TDS',
    4: 'QID'
  };
  let freqText = '';
  // 根據 frequency_type 決定顯示
  switch (prescription.frequency_type) {
    case 'daily':
      freqText = freqCodeMap[dailyFreq] || `${dailyFreq}次/日`;
      break;
    case 'every_x_days':
      freqText = `Q${prescription.frequency_value || 1}D`;
      break;
    case 'every_x_months':
      freqText = `Q${prescription.frequency_value || 1}M`;
      break;
    case 'weekly_days':
      freqText = 'QW';
      break;
    case 'odd_even_days':
      freqText = 'EOD';
      break;
    case 'hourly':
      freqText = `Q${prescription.frequency_value || 1}H`;
      break;
    default:
      freqText = freqCodeMap[dailyFreq] || `${dailyFreq}次/日`;
  }
  return freqText;
};
// 格式化處方列表 - 新格式: 藥名 劑型 給藥途徑 頻次 PRN (每次)N(單位)
const formatPrescriptionList = (prescriptions: MedicationPrescription[]): string => {
  if (!prescriptions || prescriptions.length === 0) return '';
  return prescriptions.map(p => {
    const parts = [p.medication_name];
    if (p.dosage_form) parts.push(p.dosage_form);
    if (p.administration_route) parts.push(p.administration_route);
    const freq = formatFrequencyDisplay(p);
    if (freq) parts.push(freq);
    if (p.is_prn) parts.push('PRN');
    if (p.dosage_amount) parts.push(`每次${p.dosage_amount}${p.dosage_unit || ''}`);
    return parts.join(' ');
  }).join('\n');
};
// 勾選框 HTML
const checkbox = (checked: boolean): string => {
  return checked
    ? `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;text-align:center;line-height:10px;font-size:9px;vertical-align:middle;margin:0 3px;">✓</span>`
    : `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;vertical-align:middle;margin:0 3px;"></span>`;
};
// 生成 HTML
export const generateMedicalExaminationFormHTML = (
  checkup: AnnualHealthCheckup,
  patient: Patient,
  prescriptions: MedicationPrescription[]
): string => {
  const mentalState = parseMentalStateAssessment(checkup.mental_state_assessment);
  return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>安老院住客體格檢驗報告書</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", "PMingLiU", "新細明體", serif; font-size: 10pt; line-height: 1.4; background: #fff; }
    .page {
      width: 210mm; height: 297mm;
      padding: 8mm 15mm 8mm 15mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .header { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 3mm; }
    .title { text-align: center; margin-bottom: 4mm; }
    .title h1 { font-size: 13pt; font-weight: bold; margin: 2px 0; }
    .title h2 { font-size: 11pt; font-weight: bold; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #000; padding: 4px 8px; vertical-align: bottom; font-size: 10pt; line-height: 1.4; }
    .section-header { background: #d9d9d9; font-weight: bold; }
    .section-header td { padding: 5px 10px; vertical-align: middle; }
    .no-border { border: none !important; }
    .no-top { border-top: none !important; }
    .no-bottom { border-bottom: none !important; }
    .no-left { border-left: none !important; }
    .no-right { border-right: none !important; }
    .field-line { border-bottom: 1px solid #000; min-height: 1.2em; display: block; margin-top: auto; }
    .indent { padding-left: 15px; }
    @media print {
      .page { margin: 0; }
    }
  </style>
</head>
<body>
<!-- ===== 第1頁: Part I + Part II ===== -->
<div class="page">
  <div class="header">
    <span>《安老院實務守則》2024年6月（修訂版）</span>
    <span>附件 12.1</span>
  </div>
  <div class="title">
    <h1>Medical Examination Form</h1>
    <h1>for Residents in Residential Care Homes for the Elderly</h1>
    <h2>安老院住客體格檢驗報告書</h2>
  </div>
  <!-- Part I -->
  <table style="margin-bottom:3mm; border-collapse:collapse; border:1px solid #000;">
    <tr class="section-header">
      <td style="width:18%; border-right:1px solid #000;">Part I<br/>第一部分</td>
      <td style="">Particulars of Resident<br/>住客資料</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">Name<br/>姓名</td>
      <td style="border:none; padding:5px;">
        <table class="no-border" style="width:100%;">
          <tr>
            <td class="no-border" style="width:32%; text-align:center;"><span class="field-line">${patient.中文姓名 || ''}</span></td>
            <td class="no-border" style="width:15%;">Sex 性別</td>
            <td class="no-border" style="width:15%; text-align:center;"><span class="field-line">${patient.性別 || ''}</span></td>
            <td class="no-border" style="width:15%;">Age 年齡</td>
            <td class="no-border" style="width:15%; text-align:center;"><span class="field-line">${calculateAge(patient.出生日期)}</span></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">HKIC No.<br/>香港身份證號碼</td>
      <td style="border:none; padding:5px;">
        <table class="no-border" style="width:100%;">
          <tr>
            <td class="no-border" style="width:45%; text-align:center;"><span class="field-line">${patient.身份證號碼 || ''}</span></td>
            <td class="no-border" style="width:28%;">Hospital/Clinic Ref. No.<br/>醫院／診所檔號</td>
            <td class="no-border" style="width:30%; text-align:center;"><span class="field-line">${checkup.followup_treatment_details || ''}</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!-- Part II -->
  <table style="border-collapse:collapse; border:1px solid #000;">
    <tr class="section-header">
      <td style="width:12%; border-right:1px solid #000;">Part II<br/>第二部分</td>
      <td colspan="2" style="">Medical History<br/>病歷</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(1)</td>
      <td style="border:none; padding:5px;">Any history of major illnesses/operations?<br/>曾否患嚴重疾病／接受大型手術？<br/>If yes, please specify the diagnosis: 如有，請註明診斷結果：</td>
      <td style="width:18%; text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.has_serious_illness)} No 無 ${checkbox(!checkup.has_serious_illness)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.serious_illness_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(2)</td>
      <td style="border:none; padding:5px;">Any allergy to food or drugs?<br/>有否食物或藥物過敏？<br/>If yes, please specify: 如有，請註明：</td>
      <td style="text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.has_allergy)} No 無 ${checkbox(!checkup.has_allergy)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.allergy_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(3)<br/>(a)</td>
      <td style="border:none; padding:5px;">Any signs of infectious disease?<br/>有否傳染病徵狀？<br/>If yes, please specify: 如有，請註明：</td>
      <td style="text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.has_infectious_disease)} No 無 ${checkbox(!checkup.has_infectious_disease)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.infectious_disease_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(3)<br/>(b)</td>
      <td style="border:none; padding:5px;">Any further investigation or treatment required?<br/>是否需要接受跟進檢查或治療？<br/>If yes, please specify and also state the hospital/clinic attended and reference number.<br/>如有，請註明並填寫覆診的醫院／診所和檔號。</td>
      <td style="text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.needs_followup_treatment)} No 無 ${checkbox(!checkup.needs_followup_treatment)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.followup_treatment_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(4)</td>
      <td style="border:none; padding:5px;">Any swallowing difficulties/easy choking?<br/>有否吞嚥困難／容易哽塞？<br/>If yes, please specify: 如有，請註明：</td>
      <td style="text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.has_swallowing_difficulty)} No 無 ${checkbox(!checkup.has_swallowing_difficulty)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.swallowing_difficulty_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(5)</td>
      <td style="border:none; padding:5px;">Any need of special diet?<br/>有否特別膳食需要？<br/>If yes, please specify: 如有，請註明：</td>
      <td style="text-align:right; border:none; padding:5px; white-space:nowrap;">Yes 有 ${checkbox(checkup.has_special_diet)} No 無 ${checkbox(!checkup.has_special_diet)}</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.special_diet_details || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(6)</td>
      <td colspan="2" style="border:none; padding:5px;">Past psychiatric history, if any, including the diagnosis and whether regular follow-up treatment is required.<br/>如過往有精神病紀錄，請詳述病歷及是否需要定期跟進治療。</td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="2" style="border:none; padding:5px;"><div style="border-bottom:1px solid #000; min-height:16px;">${checkup.mental_illness_record || ''}</div></td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;">(7)</td>
      <td colspan="2" style="border:none; padding:5px;">Details of present medication, if any, including the name and dosage.<br/>如目前須服用藥物，請詳述藥名及服用量。<span style="font-size:8pt;color:#666;">（見附頁：個人藥物記錄）</span></td>
    </tr>
  </table>
  <p style="text-align:center; margin-top:3mm; font-size:9pt;">附件 12.1 - 1</p>
</div>
<!-- ===== 個人藥物記錄頁 ===== -->
<div class="page">
  <div class="header">
    <span>《安老院實務守則》2024年6月（修訂版）</span>
    <span>附件 12.1</span>
  </div>
  <div class="title">
    <h1>Personal Medication Record</h1>
    <h2>個人藥物記錄</h2>
  </div>
  <table style="margin-bottom:5mm;">
    <tr>
      <td style="width:25%; background:#f0f0f0; font-weight:bold; vertical-align:top;">Name 姓名</td>
      <td style="width:25%; vertical-align:top;">${patient.中文姓名 || ''}</td>
      <td style="width:25%; background:#f0f0f0; font-weight:bold; vertical-align:top;">Bed No. 床號</td>
      <td style="width:25%; vertical-align:top;">${patient.床號 || ''}</td>
    </tr>
    <tr>
      <td style="background:#f0f0f0; font-weight:bold; vertical-align:top;">HKID No. 身份證號碼</td>
      <td style="vertical-align:top;">${patient.身份證號碼 || ''}</td>
      <td style="background:#f0f0f0; font-weight:bold; vertical-align:top;">Date 日期</td>
      <td style="vertical-align:top;">${new Date().toLocaleDateString('zh-TW')}</td>
    </tr>
  </table>
  <table>
    <tr style="background:#d9d9d9; font-weight:bold;">
      <td style="width:5%; text-align:center; vertical-align:top;">#</td>
      <td style="width:26%; vertical-align:top;">Medication Name<br/>藥物名稱</td>
      <td style="width:10%; vertical-align:top;">Form<br/>劑型</td>
      <td style="width:12%; vertical-align:top;">Route<br/>給藥途徑</td>
      <td style="width:10%; vertical-align:top;">Frequency<br/>頻次</td>
      <td style="width:8%; text-align:center; vertical-align:top;">PRN<br/>需要時</td>
      <td style="width:17%; vertical-align:top;">Dosage<br/>劑量</td>
    </tr>
    ${prescriptions.length > 0 ? prescriptions.map((p, index) => `
    <tr>
      <td style="text-align:center; vertical-align:top;">${index + 1}</td>
      <td style="vertical-align:top;">${p.medication_name || ''}</td>
      <td style="vertical-align:top;">${p.dosage_form || ''}</td>
      <td style="vertical-align:top;">${p.administration_route || ''}</td>
      <td style="vertical-align:top;">${formatFrequencyDisplay(p)}</td>
      <td style="text-align:center; vertical-align:top;">${p.is_prn ? '✓' : ''}</td>
      <td style="vertical-align:top;">${p.dosage_amount ? `每次${p.dosage_amount}${p.dosage_unit || ''}` : ''}</td>
    </tr>
    `).join('') : `
    <tr>
      <td colspan="7" style="text-align:center; padding:20px; color:#666; vertical-align:top;">暫無在服藥物記錄</td>
    </tr>
    `}
  </table>
  <p style="text-align:center; margin-top:5mm; font-size:9pt;">附件 12.1 - 1a</p>
</div>
<!-- ===== 第2頁: Part III ===== -->
<div class="page">
  <div class="header">
    <span>《安老院實務守則》2024年6月（修訂版）</span>
    <span>附件 12.1</span>
  </div>
  <table style="margin-bottom:3mm;">
    <tr class="section-header">
      <td style="width:18%;">Part III<br/>第三部分</td>
      <td>Physical Examination<br/>身體檢查</td>
    </tr>
  </table>
  <table style="margin-bottom:3mm;">
    <tr>
      <td style="width:33%; text-align:center; font-weight:bold;">Blood Pressure 血壓</td>
      <td style="width:33%; text-align:center; font-weight:bold;">Pulse 脈搏</td>
      <td style="width:34%; text-align:center; font-weight:bold;">Body Weight 體重</td>
    </tr>
    <tr>
      <td style="text-align:center; height:30px; vertical-align:middle;">${checkup.blood_pressure_systolic || ''}/${checkup.blood_pressure_diastolic || ''} mmHg</td>
      <td style="text-align:center; height:30px; vertical-align:middle;">${checkup.pulse || ''} /min</td>
      <td style="text-align:center; height:30px; vertical-align:middle;">${checkup.body_weight || ''} kg</td>
    </tr>
  </table>
  <p style="margin-bottom:3mm; font-size:10pt;">Please specify: 請註明:</p>
  <table style="border-collapse:collapse;">
    <tr>
      <td style="width:35%; border:none; border-left:1px solid #000; border-top:1px solid #000; padding:3px 5px;">Cardiovascular System<br/>循環系統</td>
      <td style="width:65%; border:none; border-right:1px solid #000; border-top:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.cardiovascular_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Respiratory System<br/>呼吸系統</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.respiratory_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Central Nervous System<br/>中樞神經系統</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.central_nervous_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Musculo-skeletal<br/>肌骨</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.musculo_skeletal_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Abdomen/Urogenital System<br/>腹/泌尿及生殖系統</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.abdomen_urogenital_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Lymphatic System<br/>淋巴系統</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.lymphatic_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Thyroid<br/>甲狀腺</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.thyroid_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Skin Condition, e.g. pressure injuries (pressure sores)<br/>皮膚狀況,如:壓力性損傷(壓瘡)</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.skin_condition_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Foot<br/>足部</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.foot_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Eye/Ear, Nose and Throat<br/>眼/耳鼻喉</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.eye_ear_nose_throat_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; padding:3px 5px;">Oral/Dental Condition<br/>口腔/牙齒狀況</td>
      <td style="border:none; border-right:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.oral_dental_notes || ''}</span></td>
    </tr>
    <tr>
      <td style="border:none; border-left:1px solid #000; border-bottom:1px solid #000; padding:3px 5px;">Others<br/>其他</td>
      <td style="border:none; border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 5px;"><span class="field-line">${checkup.physical_exam_others || ''}</span></td>
    </tr>
  </table>
  <p style="text-align:center; margin-top:5mm; font-size:9pt;">附件 12.1 - 2</p>
</div>
<!-- ===== 第3頁: Part IV ===== -->
<div class="page">
  <div class="header">
    <span>《安老院實務守則》2024年6月（修訂版）</span>
    <span>附件 12.1</span>
  </div>
  <table>
    <tr class="section-header">
      <td style="width:18%;">Part IV<br/>第四部分</td>
      <td>Functional Assessment<br/>身體機能評估</td>
    </tr>
    <tr>
      <td colspan="2" style="height:3mm; border:none;"></td>
    </tr>
  </table>
  <table style="border-collapse:collapse; border:1px solid #000;">
    <tr>
      <td style="width:18%; font-weight:bold; vertical-align:top; border:none; padding:5px;">
        Vision 視力<br/>
        <span style="font-weight:normal;font-size:8pt;">
          (${checkup.with_visual_corrective_devices === true ? 'with' : checkup.with_visual_corrective_devices === false ? '<s>with</s>' : 'with'}/${checkup.with_visual_corrective_devices === false ? 'without' : checkup.with_visual_corrective_devices === true ? '<s>without</s>' : 'without'}* visual corrective devices<br/>
          ${checkup.with_visual_corrective_devices === true ? '有' : checkup.with_visual_corrective_devices === false ? '<s>有</s>' : '有'}/${checkup.with_visual_corrective_devices === false ? '沒有' : checkup.with_visual_corrective_devices === true ? '<s>沒有</s>' : '沒有'}*配戴視力矯正器)
        </span>
      </td>
      <td style="width:20.5%; vertical-align:top; border:none; padding:5px;">${checkbox(checkup.vision_assessment === '正常')} normal<br/>正常</td>
      <td style="width:20.5%; vertical-align:top; border:none; padding:5px;">${checkbox(checkup.vision_assessment === '不能閱讀報紙字體')} unable to read newspaper print<br/>不能閱讀報紙字體</td>
      <td style="width:20.5%; vertical-align:top; border:none; padding:5px;">${checkbox(checkup.vision_assessment === '只能見光影')} see lights only<br/>只能見光影</td>
      <td style="width:20.5%; vertical-align:top; border:none; padding:5px;">${checkbox(checkup.vision_assessment === '不能觀看電視')} unable to watch TV<br/>不能觀看到電視</td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;">
        Hearing 聽覺<br/>
        <span style="font-weight:normal;font-size:8pt;">
          (${checkup.with_hearing_aids === true ? 'with' : checkup.with_hearing_aids === false ? '<s>with</s>' : 'with'}/${checkup.with_hearing_aids === false ? 'without' : checkup.with_hearing_aids === true ? '<s>without</s>' : 'without'}* hearing aids<br/>
          ${checkup.with_hearing_aids === true ? '有' : checkup.with_hearing_aids === false ? '<s>有</s>' : '有'}/${checkup.with_hearing_aids === false ? '沒有' : checkup.with_hearing_aids === true ? '<s>沒有</s>' : '沒有'}*配戴助聽器)
        </span>
      </td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.hearing_assessment === '正常')} normal<br/>正常</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.hearing_assessment === '難以正常聲浪溝通')} difficult to communicate with normal voice<br/>普通聲量下難以溝通</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.hearing_assessment === '難以話語的情況下也難以溝通')} difficult to communicate with loud voice<br/>大聲說話的情況下也難以溝通</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.hearing_assessment === '大聲話語情況下也不能溝通')} cannot communicate with loud voice<br/>大聲說話的情況下也不能溝通</td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;">Speech<br/>語言能力</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.speech_assessment === '能正常表達')} able to express<br/>能正常表達</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.speech_assessment === '需慢慢表達')} need time to express<br/>需慢慢表達</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.speech_assessment === '需靠提示表達')} need clues to express<br/>需靠提示表達</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.speech_assessment === '不能以語言表達')} unable to express<br/>不能以語言表達</td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;" rowspan="2">Mental state<br/>精神狀況</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.mental_state === '正常警覺穩定')} normal/alert/stable<br/>正常/敏銳/穩定</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.mental_state === '輕度受困擾')} mildly disturbed<br/>輕度受困擾</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.mental_state === '中度受困擾')} moderately disturbed<br/>中度受困擾</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.mental_state === '嚴重受困擾')} seriously disturbed<br/>嚴重受困擾</td>
    </tr>
    <tr>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.dementia_stage === '早期認知障礙症')} early stage of dementia<br/>早期認知障礙症</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.dementia_stage === '中期認知障礙症')} middle stage of dementia<br/>中期認知障礙症</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(mentalState.dementia_stage === '後期認知障礙症')} late stage of dementia<br/>後期認知障礙症</td>
      <td style="border:none; padding:5px;"></td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;">Mobility<br/>活動能力</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.mobility_assessment === '獨立行動')} independent<br/>行動自如</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.mobility_assessment === '可自行用助行器或輪椅移動')} self-ambulatory with walking aid or wheelchair<br/>可自行用助行器或輪椅移動</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.mobility_assessment === '經常需要別人幫助')} always need assistance from other people<br/>經常需要別人幫助</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.mobility_assessment === '長期臥床')} bedridden<br/>長期臥床</td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;">Continence<br/>禁制能力</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.continence_assessment === '正常')} normal<br/>正常</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.continence_assessment === '偶然大小便失禁')} occasional faecal or urinary incontinence<br/>大/小便偶爾失禁</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.continence_assessment === '頻繁大小便失禁')} frequent faecal or urinary incontinence<br/>大/小便經常失禁</td>
      <td style="vertical-align:top; border:none; padding:5px;">${checkbox(checkup.continence_assessment === '大小便完全失禁')} double incontinence<br/>大小便完全失禁</td>
    </tr>
    <tr>
      <td style="font-weight:bold; vertical-align:top; border:none; padding:5px;">A.D.L.<br/>自我照顧能力</td>
      <td colspan="4" style="vertical-align:top; border:none; padding:5px;">
        ${checkbox(checkup.adl_assessment === '完全獨立')} <b>Independent 完全獨立/不需協助</b><br/>
        <span style="font-size:8pt;padding-left:18px;display:block;">(No supervision or assistance needed in all daily living activities, including bathing, dressing, toileting, transfer, urinary and faecal continence and feeding)<br/>(於洗澡、穿衣、如廁、位置轉移、大小便禁制及進食方面均無需指導或協助)</span>
      </td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="4" style="vertical-align:top; border:none; padding:5px;">
        ${checkbox(checkup.adl_assessment === '偶爾需要協助')} <b>Occasional assistance 偶爾需要協助</b><br/>
        <span style="font-size:8pt;padding-left:18px;display:block;">(Need assistance in bathing and supervision or assistance in other daily living activities)<br/>(於洗澡時需要協助及於其他日常生活活動方面需要指導或協助)</span>
      </td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="4" style="vertical-align:top; border:none; padding:5px;">
        ${checkbox(checkup.adl_assessment === '經常需要協助')} <b>Frequent assistance 經常需要協助</b><br/>
        <span style="font-size:8pt;padding-left:18px;display:block;">(Need supervision or assistance in bathing and no more than 4 other daily living activities)<br/>(於洗澡及其他不超過四項日常生活活動方面需要指導或協助)</span>
      </td>
    </tr>
    <tr>
      <td style="border:none; padding:5px;"></td>
      <td colspan="4" style="vertical-align:top; border:none; padding:5px;">
        ${checkbox(checkup.adl_assessment === '完全需要協助')} <b>Totally dependent 完全需要協助</b><br/>
        <span style="font-size:8pt;padding-left:18px;display:block;">(Need assistance in all daily living activities)<br/>(於日常生活活動方面均需要完全的協助)</span>
      </td>
    </tr>
  </table>
  <p style="text-align:center; margin-top:5mm; font-size:9pt;">附件 12.1 - 3</p>
</div>
<!-- ===== 第4頁: Part V ===== -->
<div class="page">
  <div class="header">
    <span>《安老院實務守則》2024年6月（修訂版）</span>
    <span>附件 12.1</span>
  </div>
  <table style="margin-bottom:6mm;">
    <tr class="section-header">
      <td style="width:18%;">Part V<br/>第五部分</td>
      <td>Recommendation<br/>建議</td>
    </tr>
  </table>
  <div style="border:1px solid #000; padding:12px 15px;">
    <p style="margin-bottom:12px;">The applicant is fit for admission to the following type of residential care homes for the elderly -<br/>申請人適合入住以下類別的安老院:</p>
    <div style="margin-bottom:10px;">
      ${checkbox(checkup.recommendation === '低度照顧安老院')} <b>1. Self-care Hostel 低度照顧安老院</b><br/>
      <p style="font-size:7.5pt; margin-left:22px; line-height:1.2;">(an establishment providing residential care, supervision and guidance for persons who have attained the age of 60 years and who are capable of observing personal hygiene and performing household duties related to cleaning, cooking, laundering, shopping and other domestic tasks)<br/>(即提供住宿照顧、監管及指導予年滿 60 歲人士的機構,而該等人士有能力保持個人衞生,亦有能力處理關於清潔、烹飪、洗衣、購物的家居工作及其他家務)</p>
    </div>
    <div style="margin-bottom:10px;">
      ${checkbox(checkup.recommendation === '中度照顧安老院')} <b>2. Aged Home 中度照顧安老院</b><br/>
      <p style="font-size:7.5pt; margin-left:22px; line-height:1.2;">(an establishment providing residential care, supervision and guidance for persons who have attained the age of 60 years and who are capable of observing personal hygiene but have a degree of difficulty in performing household duties related to cleaning, cooking, laundering, shopping and other domestic tasks)<br/>(即提供住宿照顧、監管及指導予年滿 60 歲人士的機構,而該等人士有能力保持個人衞生,但在處理關於清潔、烹飪、洗衣、購物的家居工作及其他家務方面,有一定程度的困難)</p>
    </div>
    <div style="margin-bottom:10px;">
      ${checkbox(checkup.recommendation === '高度照顧安老院')} <b>3. Care-and-Attention Home 高度照顧安老院</b><br/>
      <p style="font-size:7.5pt; margin-left:22px; line-height:1.2;">(an establishment providing residential care, supervision and guidance for persons who have attained the age of 60 years and who are generally weak in health and are suffering from a functional disability to the extent that they require personal care and attention in the course of daily living activities but do not require a high degree of professional medical or nursing care)<br/>(即提供住宿照顧、監管及指導予年滿 60 歲人士的機構,而該等人士一般健康欠佳,而且身體機能喪失或衰退,以致在日常起居方面需要專人照顧料理,但不需要高度的專業醫療或護理)</p>
    </div>
    <div style="margin-bottom:10px;">
      ${checkbox(checkup.recommendation === '護養院')} <b>4. Nursing Home 護養院</b><br/>
      <p style="font-size:7.5pt; margin-left:22px; line-height:1.2;">(an establishment providing residential care, supervision and guidance for persons who have attained the age of 60 years, and who are suffering from a functional disability to the extent that they require personal care and attention in the course of daily living activities, and a high degree of professional nursing care, but do not require continuous medical supervision)<br/>(即提供住宿照顧、監管及指導予年滿 60 歲人士的機構,而該等人士身體機能喪失,程度達到在日常起居方面,需要專人照顧料理及高度的專業護理,但不需要持續醫療監管)</p>
    </div>
  </div>
  <!-- Part VI 整合到第4頁 -->
  <table style="margin-top:8mm; margin-bottom:4mm;">
    <tr class="section-header">
      <td style="width:18%;">Part VI<br/>第六部分</td>
      <td>Other Comment<br/>其他批註</td>
    </tr>
    <tr>
      <td colspan="2" style="height:auto; padding:6px 8px;">
        <div style="border-bottom:1px solid #000; height:20px; margin-bottom:5px;"></div>
        <div style="border-bottom:1px solid #000; height:20px; margin-bottom:5px;"></div>
        <div style="border-bottom:1px solid #000; height:20px; margin-bottom:5px;"></div>
        <div style="border-bottom:1px solid #000; height:20px; margin-bottom:5px;"></div>
        <div style="border-bottom:1px solid #000; height:20px; margin-bottom:5px;"></div>
        <div style="border-bottom:1px solid #000; height:20px;"></div>
      </td>
    </tr>
  </table>
  <div style="display:flex; gap:15px; font-size:9pt;">
    <div style="width:50%;">
      <p style="margin-bottom:2px; font-size:8.5pt;">Registered Medical Practitioner's Signature<br/>註冊醫生簽署</p>
      <div style="border-bottom:1px solid #000; height:30px; margin-bottom:8px;"></div>
      <p style="margin-bottom:2px; font-size:8.5pt;">Registered Medical Practitioner's Name<br/>註冊醫生姓名</p>
      <div style="border-bottom:1px solid #000; height:30px; margin-bottom:8px;"></div>
      <p style="margin-bottom:2px; font-size:8.5pt;">Date 日期</p>
      <div style="border-bottom:1px solid #000; height:15px;">${checkup.last_doctor_signature_date ? new Date(checkup.last_doctor_signature_date).toLocaleDateString('zh-TW') : ''}</div>
    </div>
    <div style="width:50%;">
      <p style="margin-bottom:2px; font-size:8.5pt;">Name of Hospital/Clinic<br/>醫院／診所名稱</p>
      <div style="border-bottom:1px solid #000; height:30px; margin-bottom:8px;"></div>
      <p style="margin-bottom:2px; font-size:8.5pt;">Stamp of Hospital/Clinic/Registered Medical<br/>Practitioner<br/>醫院／診所／註冊醫生印鑑</p>
      <div style="border:1px solid #000; height:45px; margin-top:3px;"></div>
    </div>
  </div>
  <p style="text-align:center; margin-top:5mm; font-size:9pt;">附件 12.1 - 4</p>
</div>
</body>
</html>
`;
};
// 打開打印視窗
const openPrintWindow = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    alert('無法創建列印預覽，請重試');
    document.body.removeChild(iframe);
    return;
  }
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };
};
// 主函數：生成並打印報告
export const printMedicalExaminationForm = async (
  checkup: AnnualHealthCheckup,
  patient: Patient
): Promise<void> => {
  try {
    console.log('PDF生成器接收到的checkup數據:', {
      has_serious_illness: checkup.has_serious_illness,
      has_allergy: checkup.has_allergy,
      has_infectious_disease: checkup.has_infectious_disease,
      needs_followup_treatment: checkup.needs_followup_treatment,
      has_swallowing_difficulty: checkup.has_swallowing_difficulty,
      has_special_diet: checkup.has_special_diet,
      serious_illness_details: checkup.serious_illness_details,
      allergy_details: checkup.allergy_details,
      infectious_disease_details: checkup.infectious_disease_details
    });
    // 獲取活躍處方
    const prescriptions = await getActivePrescriptions(patient.院友id);
    // 生成 HTML
    const html = generateMedicalExaminationFormHTML(checkup, patient, prescriptions);
    // 打開打印視窗
    openPrintWindow(html);
  } catch (error) {
    console.error('Error generating medical examination form:', error);
    alert('生成體檢報告書失敗，請重試');
  }
};
