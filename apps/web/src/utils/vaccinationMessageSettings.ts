import { supabase } from '../lib/supabase';
import { loadDeveloperSetting, saveDeveloperSetting } from './developerSettings';

export interface VaccinationMessageSettings {
  message_template: string;
  vaccine_name: string;
  vaccine_name_2: string;
  vaccination_date: string;
  deadline: string;
}

export const DEFAULT_VACCINATION_MESSAGE_SETTINGS: VaccinationMessageSettings = {
  message_template: '您好! 這是來自"{院舍名稱}"的訊息： 本院受惠於衛生署的疫苗接種計劃, 於"{接種日期}"將有註冊醫生及護士到院協助院友接種疫苗。本次接種的是"{疫苗名稱}"，鑑於"{院友名稱}"未能自行決定，所以詢問您對院友"{院友名稱}"接種疫苗的意向，我們已預備好同意書/ 反對書文件，請在"{截止日期}"前到本院簽署，謝謝。',
  vaccine_name: '',
  vaccine_name_2: '',
  vaccination_date: '',
  deadline: '',
};

// 開發者（無 userProfile）設定由 developer_settings 表統一管理（DB），首次讀取由舊 localStorage 遷移
const LOCAL_STORAGE_KEY = 'vaccination_message_settings_local';
const DEVELOPER_SETTINGS_KEY = 'vaccination_message_settings';

function normalizeSettings(raw: Partial<VaccinationMessageSettings> | null | undefined): VaccinationMessageSettings {
  return {
    message_template: raw?.message_template ?? DEFAULT_VACCINATION_MESSAGE_SETTINGS.message_template,
    vaccine_name: raw?.vaccine_name ?? '',
    vaccine_name_2: raw?.vaccine_name_2 ?? '',
    vaccination_date: raw?.vaccination_date ?? '',
    deadline: raw?.deadline ?? '',
  };
}

function loadLocalSettings(): VaccinationMessageSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_VACCINATION_MESSAGE_SETTINGS };
  }
}

function saveLocalSettings(settings: VaccinationMessageSettings): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

// userId 為 undefined（開發者）時讀 developer_settings（DB）；有 userId 時由 user_profiles 讀取（DB 為 null 時回預設值，唔寫 DB）
export async function loadVaccinationMessageSettings(
  userId: string | undefined
): Promise<VaccinationMessageSettings> {
  if (!userId) {
    const db = await loadDeveloperSetting<Partial<VaccinationMessageSettings>>(DEVELOPER_SETTINGS_KEY);
    if (db) return normalizeSettings(db);
    // 遷移：DB 未有記錄時讀舊 localStorage，並順手寫入 DB
    const local = loadLocalSettings();
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) saveDeveloperSetting(DEVELOPER_SETTINGS_KEY, JSON.parse(raw)).catch(() => {});
    } catch { /* 本機不可用就略過 */ }
    return local;
  }
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('vaccination_message_template, vaccination_vaccine_name, vaccination_vaccine_name_2, vaccination_vaccination_date, vaccination_deadline')
      .eq('id', userId)
      .single();

    return normalizeSettings({
      message_template: data?.vaccination_message_template ?? undefined,
      vaccine_name: data?.vaccination_vaccine_name ?? undefined,
      vaccine_name_2: data?.vaccination_vaccine_name_2 ?? undefined,
      vaccination_date: data?.vaccination_vaccination_date ?? undefined,
      deadline: data?.vaccination_deadline ?? undefined,
    });
  } catch {
    return loadLocalSettings();
  }
}

export async function saveVaccinationMessageSettings(
  userId: string | undefined,
  settings: VaccinationMessageSettings
): Promise<void> {
  if (!userId) {
    await saveDeveloperSetting(DEVELOPER_SETTINGS_KEY, settings);
    saveLocalSettings(settings); // 同步本機快取（舊版兼容）
    return;
  }
  const { error } = await supabase
    .from('user_profiles')
    .update({
      vaccination_message_template: settings.message_template,
      vaccination_vaccine_name: settings.vaccine_name,
      vaccination_vaccine_name_2: settings.vaccine_name_2,
      vaccination_vaccination_date: settings.vaccination_date,
      vaccination_deadline: settings.deadline,
    })
    .eq('id', userId);

  if (error) throw error;
}

export function buildVaccinationMessage(
  settings: VaccinationMessageSettings,
  vars: { 院友名稱: string; 院舍名稱: string }
): string {
  const vaccineNames = [settings.vaccine_name, settings.vaccine_name_2]
    .map(name => name.trim())
    .filter(Boolean);
  const joinedNames = vaccineNames.join('及');
  return settings.message_template
    .split('{院舍名稱}').join(vars.院舍名稱)
    .split('{接種日期}').join(settings.vaccination_date)
    .split('{疫苗名稱1}').join(settings.vaccine_name.trim())
    .split('{疫苗名稱2}').join(settings.vaccine_name_2.trim())
    .split('{疫苗名稱}').join(joinedNames)
    .split('{院友名稱}').join(vars.院友名稱)
    .split('{截止日期}').join(settings.deadline);
}
