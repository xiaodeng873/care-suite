import { supabase } from '../lib/supabase';

export interface FacilitySettings {
  facilityNameZh: string;
  facilityNameEn: string;
  logoDataUri: string | null;
}

// 預設值：與 DB 的 facility_name_zh 格式一致（半形括號、無空格），
// 只在尚未設定或讀取失敗時作後備使用。
export const DEFAULT_FACILITY_SETTINGS: FacilitySettings = {
  facilityNameZh: '善頤(福群)護老院',
  facilityNameEn: 'SeniorCare',
  logoDataUri: null,
};

let cachedSettings: FacilitySettings | null = null;

function mapRow(row: {
  facility_name_zh?: string | null;
  facility_name_en?: string | null;
  logo_data_uri?: string | null;
}): FacilitySettings {
  return {
    facilityNameZh: row.facility_name_zh?.trim() || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
    facilityNameEn: row.facility_name_en?.trim() ?? '',
    logoDataUri: row.logo_data_uri || null,
  };
}

/**
 * 讀取院舍設定（單列，id = 1）。讀取失敗或尚未設定時回傳預設值。
 * 結果會快取於模組層，可用 forceRefresh 強制重新讀取。
 */
export async function getFacilitySettings(forceRefresh = false): Promise<FacilitySettings> {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }

  const { data, error } = await supabase
    .from('facility_settings')
    .select('facility_name_zh, facility_name_en, logo_data_uri')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn('讀取院舍設定失敗，使用預設值:', error.message);
    }
    return DEFAULT_FACILITY_SETTINGS;
  }

  cachedSettings = mapRow(data);
  return cachedSettings;
}

/**
 * 儲存院舍設定（單列，id = 1）。成功後更新模組快取。
 */
export async function saveFacilitySettings(settings: FacilitySettings): Promise<void> {
  const facilityNameZh = settings.facilityNameZh.trim();
  if (!facilityNameZh) {
    throw new Error('院舍名稱為必填');
  }

  const { error } = await supabase
    .from('facility_settings')
    .upsert(
      {
        id: 1,
        facility_name_zh: facilityNameZh,
        facility_name_en: settings.facilityNameEn.trim() || null,
        logo_data_uri: settings.logoDataUri || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) {
    throw new Error(`儲存院舍設定失敗：${error.message}`);
  }

  cachedSettings = {
    facilityNameZh,
    facilityNameEn: settings.facilityNameEn.trim(),
    logoDataUri: settings.logoDataUri || null,
  };
}
