import { supabase } from '../lib/supabase';
import { PRESCRIPTION_OCR_PROMPT_CORE } from '@care-suite/shared';

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
  // 注意：此 prompt 核心與 supabase/functions/ai-assistant/index.ts 共用 PRESCRIPTION_OCR_PROMPT_CORE
  return `你是醫療資料分類的專家，你能從文本中熟練地分辨、提取有效的資料，其他都會自動中文化（藥物名稱除外），數字阿拉伯化

請根據以下OCR識別的文本提取處方標籤資訊。

${PRESCRIPTION_OCR_PROMPT_CORE}

請以JSON格式返回以下欄位（如果標籤上沒有的欄位，可以省略）。`;
}
