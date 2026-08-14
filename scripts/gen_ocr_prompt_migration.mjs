import fs from 'fs';

const corePath = 'packages/shared/src/prescription-ocr-prompt.ts';
const src = fs.readFileSync(corePath, 'utf8');
const match = src.match(/export const PRESCRIPTION_OCR_PROMPT_CORE = `([\s\S]*)`;\s*$/);
if (!match) throw new Error('Core not found');
const core = match[1];

const fullPrompt = [
  '你是醫療資料分類的專家，你能從文本中熟練地分辨、提取有效的資料，其他都會自動中文化（藥物名稱除外），數字阿拉伯化',
  '',
  '請根據以下OCR識別的文本提取處方標籤資訊。',
  '',
  core,
  '',
  '請以JSON格式返回以下欄位（如果標籤上沒有的欄位，可以省略）。'
].join('\n');

const sqlContent = `/*\n  # 更新 OCR 處方標籤識別的系統預設 prompt\n\n  目的：\n  1. 與 AI 助護（supabase/functions/ai-assistant/index.ts）的處方管理 prompt 共用同一份文件：packages/shared/src/prescription-ocr-prompt.ts\n  2. 明確藥物名稱保持原始文字（包括劑量標示），不要附加中文註解\n  3. 新增「藥物數量」為必填欄位\n  4. 明確備註只填印刷的醫生指示（如「不可與XX同服」、「換了新包裝」），排除手寫處理註記\n  5. 服用途徑選項更細分：口服、皮下注射、肌肉注射、外用、滴眼、滴耳、鼻胃管\n  6. 處方日期務必填實際日期，找不到才留空\n  7. 服用時間、日期格式等規則與 AI 助護一致\n  8. 明確 extracted_data 必須使用 exact 鍵名，服用頻率與服用時間分開\n*/\n\nUPDATE ocr_prompt_templates\nSET\n  prompt_content = E'${fullPrompt.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',\n  updated_at = now()\nWHERE is_default = true;\n`;

fs.writeFileSync('supabase/migrations/20260814154000_update_ocr_prescription_prompt.sql', sqlContent, 'utf8');
console.log('Migration updated');
