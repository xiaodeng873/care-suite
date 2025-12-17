import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

interface Patient {
  院友id: string;
  中文姓名: string;
  中文姓氏: string;
  中文名字: string;
  床號: string;
  性別?: string;
  出生日期?: string;
  身份證號碼?: string;
}

interface IncidentReport {
  id: string;
  patient_id: number;
  incident_date: string;
  incident_time?: string;
  incident_type: string;
  other_incident_type?: string;
  location?: string;
  other_location?: string;
  patient_activity?: string;
  other_patient_activity?: string;
  physical_discomfort?: any;
  unsafe_behavior?: any;
  environmental_factors?: any;
  treatment_date?: string;
  treatment_time?: string;
  vital_signs?: any;
  consciousness_level?: string;
  limb_movement?: any;
  injury_situation?: any;
  patient_complaint?: string;
  immediate_treatment?: any;
  medical_arrangement?: string;
  ambulance_call_time?: string;
  ambulance_arrival_time?: string;
  ambulance_departure_time?: string;
  hospital_destination?: string;
  family_notification_date?: string;
  family_notification_time?: string;
  family_name?: string;
  family_relationship?: string;
  other_family_relationship?: string;
  contact_phone?: string;
  notifying_staff_name?: string;
  notifying_staff_position?: string;
  hospital_treatment?: any;
  hospital_admission?: any;
  return_time?: string;
  submit_to_social_welfare?: boolean;
  submit_to_headquarters?: boolean;
  immediate_improvement_actions?: string;
  prevention_methods?: string;
  reporter_signature?: string;
  reporter_position?: string;
  report_date?: string;
  director_review_date?: string;
  submit_to_headquarters_flag?: boolean;
  submit_to_social_welfare_flag?: boolean;
}

// 格式化日期為 DD-MM-YYYY 格式
const formatDateChinese = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// 格式化時間為 HH:MM 格式
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  // 如果已經是 HH:MM 格式，直接返回
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }
  // 如果是 HH:MM:SS 格式，去掉秒數
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr.substring(0, 5);
  }
  // 嘗試解析為日期時間
  try {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch (e) {
    // 忽略解析錯誤
  }
  return timeStr;
};

// 計算年齡
const calculateAge = (birthDate?: string): string => {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age.toString();
};

// 處理複選框欄位（返回 ☑ 或 ☐，字體大小 8）
const processCheckbox = (obj: any, key: string): string => {
  // 返回帶有字體大小標記的複選框
  const checkbox = obj && obj[key] ? '☑' : '☐';
  return checkbox;
};

// 轉換報告資料為範本資料
export const convertIncidentReportToTemplateData = (
  report: IncidentReport,
  patient: Patient
): Record<string, string> => {
  const data: Record<string, string> = {};

  // 一、基本資訊
  data['院友姓名'] = patient.中文姓名 || `${patient.中文姓氏}${patient.中文名字}`;
  data['床號'] = patient.床號 || '';
  data['性別'] = patient.性別 || '';
  data['出生日期'] = formatDateChinese(patient.出生日期);
  data['年齡'] = calculateAge(patient.出生日期);
  data['身份證號碼'] = patient.身份證號碼 || '';
  data['意外日期'] = formatDateChinese(report.incident_date);
  data['意外時間'] = formatTime(report.incident_time);

  // 二、事故性質
  data['事故性質_跌倒'] = report.incident_type === '跌倒' ? '☑' : '☐';
  data['事故性質_其他'] = report.incident_type === '其他' ? '☑' : '☐';
  data['事故性質_其他說明'] = report.other_incident_type || '';

  // 三、意外發生地點
  const locationMap = {
    '客廳/飯廳': '客廳飯廳',
    '走廊': '走廊',
    '廁所': '廁所',
    '浴室': '浴室',
    '床邊': '床邊',
    '其他地方': '其他地方'
  };

  Object.entries(locationMap).forEach(([key, placeholder]) => {
    data[`地點_${placeholder}`] = report.location === key ? '☑' : '☐';
  });
  data['地點_其他說明'] = report.other_location || '';

  // 四、院友當時活動
  const activityMap = {
    '躺臥': '躺臥',
    '站立': '站立',
    '步行': '步行',
    '起身下床/上床': '起身下床上床',
    '過床/椅/便椅/沖涼椅': '過床椅便椅沖涼椅',
    '進食': '進食',
    '梳洗': '梳洗',
    '如廁': '如廁',
    '洗澡': '洗澡',
    '穿/脫衣服': '穿脫衣服',
    '其他': '其他'
  };

  Object.entries(activityMap).forEach(([key, placeholder]) => {
    data[`活動_${placeholder}`] = report.patient_activity === key ? '☑' : '☐';
  });
  data['活動_其他說明'] = report.other_patient_activity || '';

  // 五、身體不適情況
  const discomfortOptions = ['下肢乏力', '關節疼痛', '暈眩', '暈倒', '心跳', '胸部劑痛', '其他', '不適用'];
  discomfortOptions.forEach(option => {
    data[`身體不適_${option}`] = processCheckbox(report.physical_discomfort, option);
  });
  data['身體不適_其他說明'] = (report.physical_discomfort && report.physical_discomfort['其他說明']) || '';

  // 六、不安全行為
  const unsafeBehaviorOptions = ['不安全的動作', '沒有使用合適輔助工具', '沒有找人幫助', '其他', '不適用'];
  unsafeBehaviorOptions.forEach(option => {
    data[`不安全行為_${option}`] = processCheckbox(report.unsafe_behavior, option);
  });
  data['不安全行為_不安全的動作說明'] = (report.unsafe_behavior && report.unsafe_behavior['不安全的動作說明']) || '';
  data['不安全行為_其他說明'] = (report.unsafe_behavior && report.unsafe_behavior['其他說明']) || '';

  // 七、環境因素
  const environmentalMap = {
    '地面濕滑/不平': '地面濕滑不平',
    '光線不足': '光線不足',
    '傢俬移動(如輪椅/便椅未上鎖)': '傢俬移動',
    '雜物障礙': '雜物障礙',
    '褲過長': '褲過長',
    '鞋覆問題': '鞋覆問題',
    '被別人碰到': '被別人碰到',
    '其他': '其他',
    '不適用': '不適用'
  };

  Object.entries(environmentalMap).forEach(([key, placeholder]) => {
    data[`環境因素_${placeholder}`] = processCheckbox(report.environmental_factors, key);
  });
  data['環境因素_其他說明'] = (report.environmental_factors && report.environmental_factors['其他說明']) || '';

  // 七之一、意外發生經過詳情
  data['意外發生經過詳情'] = report.incident_details || '';

  // 八、處理情況
  data['處理日期'] = formatDateChinese(report.treatment_date);
  data['處理時間'] = formatTime(report.treatment_time);

  // 生命表徵（帶單位）
  if (report.vital_signs) {
    const vs = report.vital_signs;
    data['血壓'] = (vs.blood_pressure_systolic && vs.blood_pressure_diastolic)
      ? `${vs.blood_pressure_systolic}/${vs.blood_pressure_diastolic} mmHg`
      : '';
    data['脈搏'] = vs.pulse ? `${vs.pulse} 次/分鐘` : '';
    data['體溫'] = vs.temperature ? `${vs.temperature} °C` : '';
    data['血氧'] = vs.oxygen_saturation ? `${vs.oxygen_saturation} %` : '';
    data['呼吸'] = (vs.respiration || vs.respiratory_rate) ? `${vs.respiration || vs.respiratory_rate} 次/分鐘` : '';
    data['血糖'] = (vs.blood_glucose || vs.blood_sugar) ? `${vs.blood_glucose || vs.blood_sugar} mmol/L` : '';
  } else {
    data['血壓'] = '';
    data['脈搏'] = '';
    data['體溫'] = '';
    data['血氧'] = '';
    data['呼吸'] = '';
    data['血糖'] = '';
  }

  // 九、意識程度
  data['意識_清醒'] = report.consciousness_level === '清醒' ? '☑' : '☐';
  data['意識_混亂'] = report.consciousness_level === '混亂' ? '☑' : '☐';
  data['意識_昏迷'] = report.consciousness_level === '昏迷' ? '☑' : '☐';

  // 十、四肢活動
  if (report.limb_movement) {
    const lm = report.limb_movement;
    data['四肢活動_正常'] = lm.status === '正常' ? '☑' : '☐';
    data['四肢活動_異常'] = lm.status === '異常' ? '☑' : '☐';
    data['四肢活動_詳情'] = lm.details || '';

    const abnormalLimbs = lm.abnormal_limbs || [];
    data['四肢_左上肢'] = abnormalLimbs.includes('左上肢') ? '☑' : '☐';
    data['四肢_右上肢'] = abnormalLimbs.includes('右上肢') ? '☑' : '☐';
    data['四肢_左下肢'] = abnormalLimbs.includes('左下肢') ? '☑' : '☐';
    data['四肢_右下肢'] = abnormalLimbs.includes('右下肢') ? '☑' : '☐';
  } else {
    data['四肢活動_正常'] = '☐';
    data['四肢活動_異常'] = '☐';
    data['四肢活動_詳情'] = '';
    data['四肢_左上肢'] = '☐';
    data['四肢_右上肢'] = '☐';
    data['四肢_左下肢'] = '☐';
    data['四肢_右下肢'] = '☐';
  }

  // 十一、受傷情況
  const injuryOptions = ['無皮外傷', '表皮擦損', '瘀腫', '骨折', '其他'];
  injuryOptions.forEach(option => {
    data[`受傷_${option}`] = processCheckbox(report.injury_situation, option);
  });
  data['受傷_瘀腫位置'] = (report.injury_situation && report.injury_situation['瘀腫位置']) || '';
  data['受傷_骨折位置'] = (report.injury_situation && report.injury_situation['骨折位置']) || '';
  // 注意：欄位名稱是「其他位置」而不是「其他說明」
  data['受傷_其他說明'] = (report.injury_situation && report.injury_situation['其他位置']) || '';

  // 十二、院友主訴
  data['院友主訴'] = report.patient_complaint || '';

  // 十三、即時處理
  const treatmentOptions = ['包紮傷口', '其他', '不適用'];
  treatmentOptions.forEach(option => {
    data[`即時處理_${option}`] = processCheckbox(report.immediate_treatment, option);
  });
  data['即時處理_其他說明'] = (report.immediate_treatment && report.immediate_treatment['其他說明']) || '';

  // 十四、醫療安排
  data['醫療安排_急症室'] = report.medical_arrangement === '急症室' ? '☑' : '☐';
  data['醫療安排_門診'] = report.medical_arrangement === '門診' ? '☑' : '☐';
  data['醫療安排_醫生到診'] = report.medical_arrangement === '醫生到診' ? '☑' : '☐';
  data['醫療安排_沒有送院'] = report.medical_arrangement === '沒有送院' ? '☑' : '☐';

  // 十五、救護車資訊
  data['召喚救護車時間'] = formatTime(report.ambulance_call_time);
  data['救護車抵達時間'] = formatTime(report.ambulance_arrival_time);
  data['救護車出發時間'] = formatTime(report.ambulance_departure_time);
  data['送往醫院'] = report.hospital_destination || '';

  // 十六、家屬通知
  data['家屬通知日期'] = formatDateChinese(report.family_notification_date);
  data['家屬通知時間'] = formatTime(report.family_notification_time);
  data['家屬姓名'] = report.family_name || '';
  data['家屬關係_保證人'] = report.family_relationship === '保證人' ? '☑' : '☐';
  data['家屬關係_監護人'] = report.family_relationship === '監護人' ? '☑' : '☐';
  data['家屬關係_家人'] = report.family_relationship === '家人' ? '☑' : '☐';
  data['家屬關係_其他'] = report.family_relationship === '其他' ? '☑' : '☐';
  data['家屬關係_其他說明'] = report.other_family_relationship || '';
  data['聯絡電話'] = report.contact_phone || '';
  data['通知職員姓名'] = report.notifying_staff_name || '';
  data['通知職員職位'] = report.notifying_staff_position || '';

  // 十七、醫院治療
  const hospitalTreatmentOptions = [
    '照X光',
    '預防破傷風針注射',
    '洗傷口',
    '不需要留醫',
    '返回護理院/家',
    '其他治療(例如藥物等)',
    '醫院留醫'
  ];

  const hospitalTreatmentMap = {
    '照X光': '照X光',
    '預防破傷風針注射': '預防破傷風針注射',
    '洗傷口': '洗傷口',
    '縫針': '縫針',
    '觀察病房': '觀察病房',
    '不需要留醫': '不需要留醫',
    '返回護理院/家': '返回護理院家',
    '其他治療(例如藥物等)': '其他治療',
    '醫院留醫': '醫院留醫'
  };

  Object.entries(hospitalTreatmentMap).forEach(([key, placeholder]) => {
    data[`醫院治療_${placeholder}`] = processCheckbox(report.hospital_treatment, key);
  });
  data['醫院治療_其他治療說明'] = (report.hospital_treatment && report.hospital_treatment['其他治療說明']) || '';

  // 十八、住院資訊
  if (report.hospital_admission) {
    const ha = report.hospital_admission;
    data['入院日期'] = formatDateChinese(ha.admission_date);
    data['入院時間'] = formatTime(ha.admission_time);
    data['病房'] = ha.ward || '';
    data['床號_醫院'] = ha.bed_number || '';
    data['樓層_醫院'] = ha.floor || '';
    data['醫院治療_醫院留醫_醫院名稱'] = ha.hospital || '';
    data['出院日期'] = formatDateChinese(ha.discharge_date);
    data['出院時間'] = formatTime(ha.discharge_time);
  } else {
    data['入院日期'] = '';
    data['入院時間'] = '';
    data['病房'] = '';
    data['床號_醫院'] = '';
    data['樓層_醫院'] = '';
    data['醫院治療_醫院留醫_醫院名稱'] = '';
    data['出院日期'] = '';
    data['出院時間'] = '';
  }
  data['返回時間'] = formatTime(report.return_time);

  // 十九、改善及預防
  data['即時改善行動'] = report.immediate_improvement_actions || '';
  data['預防方法'] = report.prevention_methods || '';

  // 二十、呈報
  // 1. 呈交「特別事故報告」予社署安老院牌照事務處
  const submitToSocialWelfare = report.submit_to_social_welfare || report.submit_to_social_welfare_flag;
  data['社署報告_需要'] = submitToSocialWelfare ? '☑' : '☐';
  data['社署報告_不需要'] = submitToSocialWelfare ? '☐' : '☑';

  // 2. 呈交「特別事故報告」(1)副本或「特別事故報告」(院舍存檔用)予總部
  const submitToHeadquarters = report.submit_to_headquarters || report.submit_to_headquarters_flag;
  data['總部報告_需要'] = submitToHeadquarters ? '☑' : '☐';
  data['總部報告_不需要'] = submitToHeadquarters ? '☐' : '☑';

  // 保留舊的佔位符以向後兼容
  data['呈報社會福利署'] = submitToSocialWelfare ? '☑' : '☐';
  data['呈報總部'] = submitToHeadquarters ? '☑' : '☐';

  // 二十一、簽署資訊
  data['填報人簽名'] = report.reporter_signature || '';
  data['填報人職位'] = report.reporter_position || '';
  data['填報日期'] = formatDateChinese(report.report_date);
  data['主任覆核日期'] = formatDateChinese(report.director_review_date);

  return data;
};

// 生成意外事件報告 Word 文件
export const generateIncidentReportWord = async (
  report: IncidentReport,
  patient: Patient,
  templateArrayBuffer: ArrayBuffer
): Promise<void> => {
  try {
    // 載入範本
    const zip = new PizZip(templateArrayBuffer);
    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
    } catch (docError: any) {
      // 顯示詳細的模板錯誤
      if (docError.properties && docError.properties.errors) {
        console.error('範本錯誤詳情:', docError.properties.errors);
        const errorMessages = docError.properties.errors.map((err: any) => {
          let msg = err.message || '未知錯誤';
          if (err.properties) {
            if (err.properties.id === 'unopened_tag') {
              msg = `標籤未開啟: {${err.properties.xtag}}`;
            } else if (err.properties.id === 'unclosed_tag') {
              msg = `標籤未閉合: {${err.properties.xtag}}`;
            } else if (err.properties.id === 'closing_tag_does_not_match_opening_tag') {
              msg = `標籤不匹配: 開啟 {${err.properties.openingtag}} 但閉合 {${err.properties.closingtag}}`;
            }
          }
          const location = err.properties?.offset ? `字元位置 ${err.properties.offset}` : '未知位置';
          return `${msg} (${location})`;
        }).join('\n');
        throw new Error(`範本格式錯誤，請檢查 Word 範本:\n${errorMessages}\n\n提示：請確保所有 {標籤} 都正確閉合`);
      }
      throw docError;
    }

    // 轉換資料
    const templateData = convertIncidentReportToTemplateData(report, patient);

    console.log('範本資料:', templateData);

    // 設定範本資料
    doc.setData(templateData);

    // 渲染文件
    try {
      doc.render();
    } catch (renderError: any) {
      // 顯示詳細的模板錯誤
      if (renderError.properties && renderError.properties.errors) {
        console.error('範本渲染錯誤詳情:', renderError.properties.errors);
        const errorMessages = renderError.properties.errors.map((err: any) => {
          let msg = err.message || '未知錯誤';
          if (err.properties) {
            if (err.properties.id === 'multi_error') {
              msg = '多個錯誤';
            } else if (err.properties.id === 'unopened_tag') {
              msg = `標籤未開啟: {${err.properties.xtag}}`;
            } else if (err.properties.id === 'unclosed_tag') {
              msg = `標籤未閉合: {${err.properties.xtag}}`;
            }
          }
          const part = err.properties?.part || '未知位置';
          return `${msg} (位置: ${part})`;
        }).join('\n');
        throw new Error(`範本渲染失敗:\n${errorMessages}\n\n提示：請檢查 Word 範本中的標籤語法`);
      }
      throw renderError;
    }

    // 生成輸出
    const output = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // 生成檔案名稱
    const fileName = `意外事件報告_${patient.床號}_${patient.中文姓名}_${report.incident_date}.docx`;

    // 下載檔案
    saveAs(output, fileName);
  } catch (error) {
    console.error('生成 Word 文件失敗:', error);
    throw error;
  }
};
 