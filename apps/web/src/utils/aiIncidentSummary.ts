// 意外報告詳情：由 AI 根據意外報告 modal 嘅欄位內容生成（替代舊公式串接）
// 對應 Edge Function：ai-generate-text
import { supabase } from '../lib/supabase';

/** 只攞有內容嘅欄位，用中文標籤砌成 JSON 俾 AI 參考（空欄位唔好俾，等 AI 唔會老作） */
function collectIncidentFields(formData: Record<string, any>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const put = (label: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v === true || (typeof v === 'string' && v.trim() !== ''));
      if (entries.length === 0) return;
      fields[label] = Object.fromEntries(entries);
      return;
    }
    fields[label] = value;
  };

  put('意外發生日期', formData.incident_date);
  put('意外發生時間', formData.incident_time);
  put('意外性質', formData.incident_type);
  put('其他意外性質說明', formData.other_incident_type);
  put('發生地點', formData.location);
  put('院友當時活動', formData.patient_activity);
  put('身體不適原因', formData.physical_discomfort);
  put('不安全行為', formData.unsafe_behavior);
  put('環境／個人因素', formData.environmental_factors);
  put('最後巡房時間', formData.last_patrol_time);
  put('目擊者／發現者', formData.witness_found_by);
  put('著地部位', formData.injury_location);
  put('清醒程度', formData.consciousness_level);
  put('四肢活動', formData.limb_movement);
  put('受傷情況', formData.injury_situation);
  put('院友申訴', formData.patient_complaint);
  put('生命表徵', formData.vital_signs);
  put('即時處理', formData.immediate_treatment);
  put('通知家屬日期', formData.family_notification_date);
  put('通知家屬時間', formData.family_notification_time);
  put('通知家屬職員職位', formData.notifying_staff_position);
  put('通知家屬職員姓名', formData.notifying_staff_name);
  put('家屬關係', formData.family_relationship);
  put('家屬姓名', formData.family_name);
  put('就診安排', formData.medical_arrangement);
  put('醫院診治情況', formData.hospital_treatment);

  return fields;
}

const SYSTEM_INSTRUCTION = `你是香港安老院的意外事件記錄撰寫員。你會收到一份意外報告表單欄位（JSON），請用繁體中文撰寫「意外經過詳情」。
要求：
- 一段完整連貫嘅記敘文字（約 200–350 字），按時間順序：發生經過 → 院友狀況（受傷、清醒程度、生命表徵等）→ 即時處理 → 通知家屬 → 就診安排。
- 所有時間一律用 24 小時制 HH:MM 格式（例如 03:45、09:15），唔好用「凌晨3時45分」等寫法。
- 「最後巡房時間」必須緊接意外發生時間之後，用半形括號包住（例如「於2026年9月30日03:45（職員最後巡房時間02:30）」）。
- 欄位入面每一個非空白項目嘅資訊都必須提及（日期時間、地點、當時活動、各項因素、著地部位、清醒程度、四肢活動、受傷情況、申訴、生命表徵、即時處理措施、通知家屬嘅職員／時間／家屬身份、醫院診治情況等），唔可以漏。
- 生命表徵必須生成，單位規定：血壓用 mmHg（例如 145/88mmHg）、脈搏同呼吸用 /min（例如 90/min）、血糖用 mmol/L、血氧用 %。
- 若就診安排為「沒有送院」或「保持觀察」：要加強描寫職員點樣向家屬回報事件經過、雙方商議嘅過程；結論用自然簡潔嘅寫法，例如「最終一致同意無需送院，留喺院舍保持觀察」，唔可以寫成「本次就診安排為沒有送院」呢類累贅句式。
- 只可以使用欄位提供嘅資料，唔可以編造或推測任何內容。
- 語句必須通暢、合乎文法、簡潔自然，避免累贅冗長嘅表述；客觀陳述，唔好用 markdown、標題、列點；直接輸出詳情正文，唔好加任何前言或解釋。`;

/** 由欄位內容生成意外詳情；失敗拋錯（message 已係中文） */
export async function generateIncidentDetailsByAi(
  patientName: string,
  formData: Record<string, any>
): Promise<string> {
  const fields = collectIncidentFields(formData);
  if (!Object.keys(fields).length) {
    throw new Error('請先填寫意外資料');
  }

  const prompt = `院友姓名：${patientName}\n意外報告欄位內容：\n${JSON.stringify(fields, null, 2)}\n\n請根據以上欄位撰寫意外經過詳情。`;

  const { data, error } = await supabase.functions.invoke('ai-generate-text', {
    body: { prompt, systemInstruction: SYSTEM_INSTRUCTION },
  });

  if (error) {
    throw new Error('AI 服務連線失敗，請稍後再試');
  }
  if (!data?.success) {
    throw new Error(data?.error?.message || 'AI 生成失敗，請稍後再試');
  }
  return data.text as string;
}
