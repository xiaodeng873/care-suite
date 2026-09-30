// 開發者（無 user_profiles 記錄）嘅個人設定，同用戶一樣由 DB 統一管理（developer_settings 表）
// key 例子：'followup_message_templates' / 'vaccination_message_settings'
import { supabase } from '../lib/supabase';

export async function loadDeveloperSetting<T>(key: string): Promise<T | null> {
  try {
    const { data } = await supabase
      .from('developer_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return (data?.value as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveDeveloperSetting<T>(key: string, value: T): Promise<void> {
  const { error } = await supabase
    .from('developer_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
