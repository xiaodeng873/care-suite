/**
 * 輔助工具設定：管理虛擬數據和快速簽署功能的開關
 * 儲存於 localStorage；鍵名固定，方便未來遷移至 Supabase。
 */

export interface ToolsSettings {
  virtualDataEnabled: boolean;  // 虛擬數據：數據生成器、一鍵體溫、監測預填、巡房預填等
  quickSignEnabled: boolean;    // 快速簽署：一鍵執藥、一鍵核藥、一鍵派藥
}

export const DEFAULT_TOOLS_SETTINGS: ToolsSettings = {
  virtualDataEnabled: true,   // 預設啟用
  quickSignEnabled: true,     // 預設啟用
};

const STORAGE_KEY = 'care_suite_tools_settings';

/**
 * 讀取輔助工具設定。讀取失敗或尚未設定時回傳預設值。
 */
export function getToolsSettings(): ToolsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TOOLS_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ToolsSettings>;
    // Merge with defaults to handle schema additions gracefully
    return {
      ...DEFAULT_TOOLS_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_TOOLS_SETTINGS };
  }
}

/**
 * 儲存輔助工具設定。
 */
export function saveToolsSettings(settings: ToolsSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * 重設輔助工具設定為預設值。
 */
export function resetToolsSettings(): ToolsSettings {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_TOOLS_SETTINGS };
}

/**
 * 檢查虛擬數據功能是否啟用。
 */
export function isVirtualDataEnabled(): boolean {
  return getToolsSettings().virtualDataEnabled;
}

/**
 * 檢查快速簽署功能是否啟用。
 */
export function isQuickSignEnabled(): boolean {
  return getToolsSettings().quickSignEnabled;
}
