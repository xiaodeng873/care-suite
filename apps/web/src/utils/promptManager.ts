import { supabase } from '../lib/supabase';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt_content: string;
  is_default: boolean;
}

export interface UserPrompt {
  id: string;
  user_id: string;
  prompt_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('ocr_prompt_templates')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) {
      console.error('Failed to fetch prompt templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    return [];
  }
}

export async function getUserActivePrompt(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_ocr_prompts')
      .select('prompt_content')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch user prompt:', error);
      return null;
    }

    return data?.prompt_content || null;
  } catch (error) {
    console.error('Error fetching user prompt:', error);
    return null;
  }
}

export async function saveUserPrompt(promptContent: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    await supabase
      .from('user_ocr_prompts')
      .update({ is_active: false })
      .eq('user_id', user.id);

    const { error } = await supabase
      .from('user_ocr_prompts')
      .insert({
        user_id: user.id,
        prompt_content: promptContent,
        is_active: true
      });

    if (error) {
      console.error('Failed to save user prompt:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving user prompt:', error);
    return false;
  }
}

export async function getDefaultPrompt(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('ocr_prompt_templates')
      .select('prompt_content')
      .eq('is_default', true)
      .maybeSingle();

    if (error || !data) {
      console.error('Failed to fetch default prompt:', error);
      return getHardcodedDefaultPrompt();
    }

    return data.prompt_content;
  } catch (error) {
    console.error('Error fetching default prompt:', error);
    return getHardcodedDefaultPrompt();
  }
}

export async function getUserClassificationRules(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_ocr_prompts')
      .select('classification_rules')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch classification rules:', error);
      return null;
    }

    return data?.classification_rules || null;
  } catch (error) {
    console.error('Error fetching classification rules:', error);
    return null;
  }
}

export async function saveClassificationRules(rulesContent: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    const { data: existingPrompt } = await supabase
      .from('user_ocr_prompts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingPrompt) {
      const { error } = await supabase
        .from('user_ocr_prompts')
        .update({ classification_rules: rulesContent })
        .eq('id', existingPrompt.id);

      if (error) {
        console.error('Failed to update classification rules:', error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('user_ocr_prompts')
        .insert({
          user_id: user.id,
          prompt_content: await getDefaultPrompt(),
          classification_rules: rulesContent,
          is_active: true
        });

      if (error) {
        console.error('Failed to save classification rules:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving classification rules:', error);
    return false;
  }
}

function getHardcodedDefaultPrompt(): string {
  return `你是醫療資料分類的專家，你能從文本中熟練地分辨、提取有效的資料，其他都會自動中文化（藥物名稱以外），數字阿拉伯化

請根據以下OCR識別的文本提取處方標籤資訊。

提取時必須嚴格遵守以下規則：
1. 提取藥物來源時，不要提取完整地址，僅提取藥房名稱或醫生名稱
2. 如果提取不到院友姓名，必須反覆再尋找，一定會找到，不得留空
3. 藥物名稱必須包括其劑量（如果標籤上有顯示）
4. 劑型必須從以下選項中選擇：片劑、膠囊、藥水、注射劑、外用藥膏、滴劑
5. 服用途徑必須從以下選項中選擇：口服、注射、外用、滴眼、滴耳、鼻胃管
6. 服用份量的單位必須從以下選項中選擇：粒、片、膠囊、毫升、滴、口、支、包、茶匙、湯匙、mg、ml、g、mcg、IU
7. 提取"服用日數"時要附有量詞，例如："5日"
8. 如果藥物標籤出現"需要時"、"PRN"、"有需要時"等字樣，判定為需要時服藥（true），否則是false
9. 處方日期、開始日期必須為YYYY-MM-DD格式
10. 服用時間必須為24小時制HH:MM格式的陣列，例如：["08:00", "14:00", "20:00"]

請以JSON格式返回以下欄位（如果標籤上沒有的欄位，可以省略）：
{
  "院友姓名": "陳大文",
  "處方日期": "2025-04-30",
  "藥物名稱": "Paracetamol 500mg",
  "藥物來源": "樂善堂李賢義伉儷社區藥房",
  "劑型": "片劑",
  "服用途徑": "口服",
  "服用份量": "1",
  "服用單位": "片",
  "服用次數": "3",
  "服用日數": "5日",
  "需要時": false,
  "備註": "需配合潤滑劑使用",
  "總數": "15",
  "服用時間": ["08:00", "14:00", "20:00"]
}`;
}
