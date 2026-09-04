import { supabase } from '../lib/supabase';

export interface FacilitySettings {
  facilityNameZh: string;
  facilityNameEn: string;
  facilityAddressZh: string;
  facilityAddressEn: string;
  facilityPhone: string;
  facilityFax: string;
  logoDataUri: string | null;
}

// 預設值：只在尚未設定或讀取失敗時作後備使用。
// 多租戶下不可寫死任何一間院舍的名稱，後備用 eHMS 品牌。
export const DEFAULT_FACILITY_SETTINGS: FacilitySettings = {
  facilityNameZh: 'eHMS',
  facilityNameEn: '',
  facilityAddressZh: '',
  facilityAddressEn: '',
  facilityPhone: '',
  facilityFax: '',
  logoDataUri: null,
};

let cachedSettings: FacilitySettings | null = null;

// 從 dbToken 解出當前院舍 id（無院舍 = developer 維運模式，回傳 null）
export function getCurrentFacilityId(): number | null {
  try {
    const token = localStorage.getItem('care_suite_db_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.facility_id === 'number' ? payload.facility_id : null;
  } catch {
    return null;
  }
}

/** 清除模組快取（切換院舍後必須呼叫，否則會繼續顯示上一間院舍的設定） */
export function clearFacilitySettingsCache(): void {
  cachedSettings = null;
}

function mapRow(row: {
  facility_name_zh?: string | null;
  facility_name_en?: string | null;
  facility_address_zh?: string | null;
  facility_address_en?: string | null;
  facility_phone?: string | null;
  facility_fax?: string | null;
  logo_data_uri?: string | null;
}): FacilitySettings {
  return {
    facilityNameZh: row.facility_name_zh?.trim() || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
    facilityNameEn: row.facility_name_en?.trim() ?? '',
    facilityAddressZh: row.facility_address_zh?.trim() ?? '',
    facilityAddressEn: row.facility_address_en?.trim() ?? '',
    facilityPhone: row.facility_phone?.trim() ?? '',
    facilityFax: row.facility_fax?.trim() ?? '',
    logoDataUri: row.logo_data_uri || null,
  };
}

/**
 * 讀取當前院舍的設定。讀取失敗或尚未設定時回傳預設值。
 * 結果會快取於模組層，可用 forceRefresh 強制重新讀取；
 * 切換院舍後必須呼叫 clearFacilitySettingsCache()，否則會沿用上一間院舍的設定。
 */
export async function getFacilitySettings(forceRefresh = false): Promise<FacilitySettings> {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }

  const facilityId = getCurrentFacilityId();
  let query = supabase
    .from('facility_settings')
    .select('facility_name_zh, facility_name_en, facility_address_zh, facility_address_en, facility_phone, facility_fax, logo_data_uri');
  // 有院舍上下文（dbToken claim）→ 讀該院舍的設定列；developer 維運模式 → 沿用舊行 id=1
  if (facilityId != null) {
    query = query.eq('facility_id', facilityId);
  } else {
    query = query.eq('id', 1);
  }

  const { data, error } = await query.maybeSingle();

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
  const facilityAddressZh = settings.facilityAddressZh.trim();
  const facilityPhone = settings.facilityPhone.trim();
  const facilityFax = settings.facilityFax.trim();

  if (!facilityNameZh) {
    throw new Error('院舍名稱為必填');
  }
  if (!facilityAddressZh) {
    throw new Error('院舍中文地址為必填');
  }
  if (!facilityPhone) {
    throw new Error('院舍電話為必填');
  }
  if (!facilityFax) {
    throw new Error('院舍傳真為必填');
  }

  const facilityId = getCurrentFacilityId();

  // 定位當前院舍的設定列：先以 facility_id 找既有列，找不到才新建（facility_id 需寫入）
  let rowId: number | null = null;
  if (facilityId != null) {
    const { data: existing } = await supabase
      .from('facility_settings')
      .select('id')
      .eq('facility_id', facilityId)
      .maybeSingle();
    rowId = existing?.id ?? null;
  } else {
    rowId = 1; // developer 維運模式：沿用舊行
  }

  const { error } = await supabase
    .from('facility_settings')
    .upsert(
      {
        ...(rowId != null ? { id: rowId } : {}),
        ...(facilityId != null ? { facility_id: facilityId } : {}),
        facility_name_zh: facilityNameZh,
        facility_name_en: settings.facilityNameEn.trim() || null,
        facility_address_zh: facilityAddressZh,
        facility_address_en: settings.facilityAddressEn.trim() || null,
        facility_phone: facilityPhone,
        facility_fax: facilityFax,
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
    facilityAddressZh,
    facilityAddressEn: settings.facilityAddressEn.trim(),
    facilityPhone,
    facilityFax,
    logoDataUri: settings.logoDataUri || null,
  };
}
