import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  missingLookbackDays?: number; // how many past days to scan for missing records
}

const SETTINGS_KEY = 'app_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  missingLookbackDays: 30,
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as AppSettings;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('讀取設定失敗:', err);
    return DEFAULT_SETTINGS;
  }
};

export const setSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('儲存設定失敗:', err);
  }
};

export const getMissingLookbackDays = async (): Promise<number> => {
  const s = await getSettings();
  return s.missingLookbackDays ?? DEFAULT_SETTINGS.missingLookbackDays!;
};

export const setMissingLookbackDays = async (days: number): Promise<void> => {
  const s = await getSettings();
  s.missingLookbackDays = days;
  await setSettings(s);
};

export default {
  getSettings,
  setSettings,
  getMissingLookbackDays,
  setMissingLookbackDays,
};
