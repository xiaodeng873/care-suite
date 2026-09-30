// 覆診安排通知訊息模板（陪診員／輪椅的士／問家人）
// 做法跟疫苗接種訊息一致（utils/vaccinationMessageSettings.ts）：
// 佔位符 {…} 模板，per-user 存 user_profiles.followup_message_templates jsonb；
// 開發者（無 userProfile）存 developer_settings 表（同用戶一樣由 DB 管理，
// 首次讀取會將舊 localStorage 設定遷移入 DB）
import { supabase } from '../lib/supabase';
import { loadDeveloperSetting, saveDeveloperSetting } from './developerSettings';

export interface FollowUpMessageTemplate {
  /** 訊息模板，可用佔位符：{院友名稱} {居住區} {院舍名稱} {覆診日期} {覆診星期} {覆診時間} {出發時間} {覆診地點} {覆診專科} */
  template: string;
  /** 接收方電話號碼（跟模板一齊儲存；問家人嗰張用院友聯絡人下拉，唔用呢個欄） */
  phone: string;
}

export interface FollowUpMessageTemplates {
  companion: FollowUpMessageTemplate; // 陪診員安排通知訊息
  taxi: FollowUpMessageTemplate;      // 輪椅的士安排通知訊息
  family: FollowUpMessageTemplate;    // 問家人覆診安排通知訊息
}

export const DEFAULT_FOLLOWUP_MESSAGE_TEMPLATES: FollowUpMessageTemplates = {
  companion: {
    template: '您好！這是{院舍名稱}：{院友名稱}將於{覆診日期}{覆診時間}到{覆診地點}{覆診專科}覆診（出發時間{出發時間}），請安排陪診員陪同，謝謝！',
    phone: '',
  },
  taxi: {
    template: '預約日期：{覆診日期}（{覆診星期}）\n上車時間：{出發時間}\n起點：{院舍名稱}\n目的地：{覆診地點}\n預約：來回程\n同行人數(不計院友)：1職員陪診\n院友姓名：{居住區}{院友名稱}\n聯絡電話：',
    phone: '',
  },
  family: {
    template: '您好！這是{院舍名稱}的信息：{院友名稱}將於{覆診日期}的{覆診時間}，於{覆診地點}有{覆診專科}的醫療安排。請問需要輪椅的士代步/陪診員嗎？請盡快告知您的安排，謝謝！',
    phone: '',
  },
};

export interface FollowUpMessageVars {
  院友名稱: string;
  居住區: string;
  院舍名稱: string;
  覆診日期: string;
  覆診星期: string;
  覆診時間: string;
  出發時間: string;
  覆診地點: string;
  覆診專科: string;
}

/** 佔位符替換：逐個 split/join，避免 regex 特殊字符問題 */
export function buildFollowUpMessage(template: string, vars: FollowUpMessageVars): string {
  return template
    .split('{院友名稱}').join(vars.院友名稱)
    .split('{居住區}').join(vars.居住區)
    .split('{院舍名稱}').join(vars.院舍名稱)
    .split('{覆診日期}').join(vars.覆診日期)
    .split('{覆診星期}').join(vars.覆診星期)
    .split('{覆診時間}').join(vars.覆診時間)
    .split('{出發時間}').join(vars.出發時間)
    .split('{覆診地點}').join(vars.覆診地點)
    .split('{覆診專科}').join(vars.覆診專科);
}

const LOCAL_STORAGE_KEY = 'followup_message_templates_local';
const DEVELOPER_SETTINGS_KEY = 'followup_message_templates';

function normalizeTemplates(raw: Partial<FollowUpMessageTemplates> | null | undefined): FollowUpMessageTemplates {
  const d = DEFAULT_FOLLOWUP_MESSAGE_TEMPLATES;
  const norm = (r: Partial<FollowUpMessageTemplate> | undefined, def: FollowUpMessageTemplate): FollowUpMessageTemplate => ({
    template: r?.template ?? def.template,
    phone: r?.phone ?? def.phone,
  });
  return {
    companion: norm(raw?.companion, d.companion),
    taxi: norm(raw?.taxi, d.taxi),
    family: norm(raw?.family, d.family),
  };
}

function loadLocalTemplates(): FollowUpMessageTemplates {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return normalizeTemplates(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeTemplates(null);
  }
}

function saveLocalTemplates(templates: FollowUpMessageTemplates): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
}

// userId 為 undefined（開發者）時讀 developer_settings（DB）；有 userId 時由 user_profiles 讀取（DB 為 null 時回預設值，唔寫 DB）
export async function loadFollowUpMessageTemplates(
  userId: string | undefined
): Promise<FollowUpMessageTemplates> {
  if (!userId) {
    const db = await loadDeveloperSetting<Partial<FollowUpMessageTemplates>>(DEVELOPER_SETTINGS_KEY);
    if (db) return normalizeTemplates(db);
    // 遷移：DB 未有記錄時讀舊 localStorage，並順手寫入 DB（之後同用戶一樣由 DB 管理）
    const local = loadLocalTemplates();
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) saveDeveloperSetting(DEVELOPER_SETTINGS_KEY, JSON.parse(raw)).catch(() => {});
    } catch { /* 本機不可用就略過 */ }
    return local;
  }
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('followup_message_templates')
      .eq('id', userId)
      .single();

    return normalizeTemplates(data?.followup_message_templates as Partial<FollowUpMessageTemplates> | null | undefined);
  } catch {
    return loadLocalTemplates();
  }
}

export async function saveFollowUpMessageTemplates(
  userId: string | undefined,
  templates: FollowUpMessageTemplates
): Promise<void> {
  if (!userId) {
    await saveDeveloperSetting(DEVELOPER_SETTINGS_KEY, templates);
    saveLocalTemplates(templates); // 同步本機快取（舊版兼容）
    return;
  }
  const { error } = await supabase
    .from('user_profiles')
    .update({ followup_message_templates: templates })
    .eq('id', userId);

  if (error) throw error;
}
