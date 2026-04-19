// =====================================================
// AI 助護 Edge Function
// 自然語言 → SQL 查詢/操作 + 權限控制
// =====================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { DB_SCHEMA_SUMMARY } from "./schema-summary.ts";
import { containsBlockedKeywords, involvesBlockedTables, getRequiredPermissions } from "./permissions-map.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey"
};
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
// =====================================================
// Rate Limiting (in-memory, per-user)
// =====================================================
const rateLimitMap = new Map();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60_000; // 1 minute in ms
function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const recent = timestamps.filter((t)=>now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}
async function validateToken(token) {
  const supabase = getSupabaseClient();
  // 1. 嘗試自訂 token 驗證（管理者/員工）— 查找未過期的 session
  const { data: session, error } = await supabase.from("user_sessions").select("user_id, expires_at").eq("token", token).gt("expires_at", new Date().toISOString()).single();
  if (!error && session) {
    // 更新最後訪問時間
    await supabase.from("user_sessions").update({
      last_accessed_at: new Date().toISOString()
    }).eq("token", token);
    // 獲取用戶資料
    const { data: user } = await supabase.from("user_profiles").select("id, role, name_zh, is_active").eq("id", session.user_id).eq("is_active", true).single();
    if (user) {
      const { data: permissions } = await supabase.rpc("get_user_permissions", {
        p_user_id: user.id
      });
      return {
        userId: user.id,
        role: user.role,
        name: user.name_zh,
        permissions: permissions || []
      };
    }
  }
  // 1b. 自訂 token 存在但已過期 → 自動延長 24 小時
  const { data: expiredSession } = await supabase.from("user_sessions").select("user_id, expires_at").eq("token", token).single();
  if (expiredSession) {
    // token 在 DB 中找到但已過期 → 自動續期
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + 24);
    await supabase.from("user_sessions").update({
      expires_at: newExpiry.toISOString(),
      last_accessed_at: new Date().toISOString()
    }).eq("token", token);
    const { data: user } = await supabase.from("user_profiles").select("id, role, name_zh, is_active").eq("id", expiredSession.user_id).eq("is_active", true).single();
    if (user) {
      const { data: permissions } = await supabase.rpc("get_user_permissions", {
        p_user_id: user.id
      });
      return {
        userId: user.id,
        role: user.role,
        name: user.name_zh,
        permissions: permissions || []
      };
    }
  }
  // 2. 嘗試 Supabase Auth JWT 驗證（開發者）
  try {
    // 使用 service role client 直接驗證 JWT
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && authUser) {
      return {
        userId: authUser.id,
        role: "developer",
        name: authUser.user_metadata?.display_name || authUser.email || "Developer",
        permissions: []
      };
    }
  } catch  {
  // JWT 驗證失敗
  }
  return null;
}
// =====================================================
// Permission Checking
// =====================================================
function userHasPermission(userCtx, category, action) {
  // Developers have all permissions
  if (userCtx.role === "developer") return true;
  // Admin has all CRUD
  if (userCtx.role === "admin") return true;
  return userCtx.permissions.some((p)=>p.category === category && p.action === action);
}
// =====================================================
// Gemini API Call with Retry
// =====================================================
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for(let i = 0; i < retries; i++){
    const response = await fetch(url, options);
    if (response.ok || response.status !== 429) return response;
    if (i < retries - 1) {
      await new Promise((r)=>setTimeout(r, backoff * (i + 1)));
    }
  }
  throw new Error("重試次數過多，請求失敗 (429 Rate Limit)");
}
async function callGemini(systemPrompt, userMessage, conversationHistory, imageBase64, imageMimeType) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("未設定 GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const apiVersion = Deno.env.get("GEMINI_API_VERSION") || "v1beta";
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
  // Build conversation parts
  const contents = [];
  // System instruction as first user message context
  contents.push({
    role: "user",
    parts: [
      {
        text: systemPrompt
      }
    ]
  });
  contents.push({
    role: "model",
    parts: [
      {
        text: "明白，我是 AI 助護，我會依照指示回應。"
      }
    ]
  });
  // Conversation history
  for (const msg of conversationHistory.slice(-10)){
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [
        {
          text: msg.content
        }
      ]
    });
  }
  // Current message (optionally with image)
  const currentParts = [
    {
      text: userMessage
    }
  ];
  if (imageBase64 && imageMimeType) {
    currentParts.push({
      inline_data: {
        mime_type: imageMimeType,
        data: imageBase64
      }
    });
  }
  contents.push({
    role: "user",
    parts: currentParts
  });
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API 錯誤: ${response.status}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Parse JSON from response (might be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    text
  ];
  const jsonStr = (jsonMatch[1] || text).trim();
  try {
    return JSON.parse(jsonStr);
  } catch  {
    // If LLM didn't return valid JSON, treat as plain text answer
    return {
      type: "answer",
      explanation: text
    };
  }
}
// =====================================================
// Build System Prompt
// =====================================================
function buildSystemPrompt(userCtx, hasImage = false) {
  const roleLabel = userCtx.role === "developer" ? "開發者" : userCtx.role === "admin" ? "管理者" : "員工";
  const permCategories = [
    ...new Set(userCtx.permissions.map((p)=>p.category))
  ];
  return `你是「AI 助護」，一個安老院舍護理管理系統的智能助手。
你的用戶是「${userCtx.name}」，角色為「${roleLabel}」。

## 你可以做的事情：
1. 理解自然語言問題，查詢資料庫中的資料並回答
2. 根據用戶指示，生成 INSERT/UPDATE/DELETE SQL 操作（需用戶確認後才會執行）
3. 回答系統使用相關的問題

## 理解用戶指令的規則（極重要）：
用戶是安老院護理人員，會用簡短的行業語言下指令，你必須主動推斷，不要反問顯而易見的事情。

### 床號識別
- 用戶說「202-1」「C202-1」「202-1床」都指同一個床號，在查詢時用 "床號" LIKE '%202-1' 或 "床號" = 'C202-1' 比對
- 先透過床號在「院友主表」找到 院友id，再去其他表查資料

### 常見操作的自動推斷
- **「停用處方」「停藥」「stop」** → UPDATE new_medication_prescriptions SET status = 'inactive', end_date = CURRENT_DATE WHERE ... AND status = 'active'
- **「開藥」「新處方」「加藥」** → 需要更多資訊才能 INSERT（藥名、劑量、頻率等），此時才可以詢問
- **「改藥」「更改劑量」「轉藥」** → UPDATE new_medication_prescriptions 對應欄位
- **「刪除」「移除」「del」** → DELETE 或 UPDATE status
- **「加入」「新增」「add」** → INSERT

### 藥物處方 status 值
- 'active' = 使用中
- 'inactive' = 已停用
- 'pending_change' = 待變更

### 操作指令範例解讀
- 「改202-1的Amoxicillin為停用處方」→ 先查「院友主表」WHERE "床號" LIKE '%202-1' 取得院友id，再 UPDATE new_medication_prescriptions SET status = 'inactive', end_date = CURRENT_DATE WHERE patient_id = (該院友id) AND medication_name ILIKE '%Amoxicillin%' AND status = 'active'
- 「幫206-1加一個覆診」→ 因為缺少覆診日期、地點等必要資訊，此時才需要詢問
- 「233-3今天BP幾多」→ 先查床號找院友id，再查「健康記錄主表」

## 你不能做的事情：
1. 執行任何 DDL 操作（CREATE TABLE, ALTER TABLE, DROP TABLE 等）
2. 查詢或操作系統表（user_profiles, user_sessions, permissions 等）
3. 任何涉及介面布局、增減欄位等結構性改變
4. 超出用戶權限範圍的操作

## 用戶可訪問的權限類別：
${permCategories.length > 0 ? permCategories.join(", ") : "（受限制）"}

## 回覆格式要求：
你必須**始終**返回嚴格的 JSON 格式，不要包含任何其他文字。格式如下：

### 查詢類型（SELECT）：
\`\`\`json
{
  "type": "query",
  "sql": "SELECT ... FROM ... WHERE ...",
  "sql_type": "SELECT",
  "params": [],
  "tables_involved": ["表名1", "表名2"],
  "explanation": "用簡潔的中文解釋你在查詢什麼"
}
\`\`\`

### 寫入類型（INSERT/UPDATE/DELETE）：
\`\`\`json
{
  "type": "mutation",
  "sql": "UPDATE ... SET ... WHERE ...",
  "sql_type": "UPDATE",
  "params": [],
  "tables_involved": ["表名"],
  "explanation": "用中文說明即將執行的操作及影響範圍"
}
\`\`\`

### 純文字回答（不需要查 DB）：
\`\`\`json
{
  "type": "answer",
  "explanation": "你的回答內容"
}
\`\`\`

### 錯誤/拒絕：
\`\`\`json
{
  "type": "error",
  "explanation": "說明為什麼無法執行"
}
\`\`\`

## SQL 規範（極度重要，務必遵守）：
- 使用 PostgreSQL 語法
- **嚴禁自行翻譯或猜測欄位名！** 你必須 100% 使用下方 Schema 中列出的欄位名稱。資料庫中有大量中文欄位（如「在住狀態」「中文姓名」「床號」「覆診日期」），絕對不可以自行替換成英文（如 residency_status、chinese_name、bed_number 等都是錯誤的）。
- 對中文表名和欄位名**必須**使用雙引號，例如 "院友主表"."中文姓名"、"院友主表"."在住狀態"
- 英文表名和欄位名也建議使用雙引號，例如 "patient_contacts"."院友id"
- 表名和欄位名必須與下方 Schema 完全一致，一個字都不能改
- USER-DEFINED 類型的欄位是 enum，比較時須用字串值（如 "在住狀態" = '在住'），不可用 boolean 或數字
- SELECT 查詢限制最多返回 100 行 (加上 LIMIT 100)
- 不要使用 SELECT *，明確指定需要的欄位
- 使用 $1, $2 等參數化佔位符（如有動態值）
- 日期格式為 YYYY-MM-DD

${hasImage ? `
## 圖片分析規則（當用戶上傳圖片時）：
你需要仔細分析圖片內容，判斷文件類型並提取結構化資料。

### 文件類型識別：
根據圖片內容判斷屬於以下哪種類型：
1. **覆診預約（followup）**— 覆診便條、覆診通知、Appointment Slip、FU紙。關鍵詞：覆診日期、醫院名稱、科別、時間
2. **處方管理（prescription）**— 藥物標籤、處方箋、藥房單。關鍵詞：藥物名稱、劑量、頻率、用法
3. **診斷記錄（diagnosis）**— 診斷書、檢查報告、化驗結果。關鍵詞：診斷、Diagnosis、ICD code
4. **疫苗記錄（vaccination）**— 疫苗注射記錄、疫苗卡。關鍵詞：疫苗名稱、注射日期、批次號
5. **新增院友 / 身份證（id_card）**— 香港身份證（HKID）正面或反面。關鍵詞：Hong Kong Identity Card、香港身份證、HKID、姓名、出生日期、性別
6. **其他（other）**— 無法歸類的文件

### 提取規則：
- 圖片中所有可辨識的文字都要盡量提取
- 院友姓名是最重要的識別欄位，必須反覆搜尋
- 日期一律轉為 YYYY-MM-DD 格式
- 時間一律轉為 HH:MM 格式（24小時制）
- 如果欄位無法辨識可省略，但不要捏造
- 身份證號碼格式：英文字母 + 6位數字 + 括號內校驗碼，例如 A123456(7)
- **重要：提取所有看得見的真實字元。如果部分被遮蔽或模糊，用 X 代替遮蔽的單個字元（例如：劉X堪、AXX9890(X)），但可辨識的字元必須如實填寫，不要全部用 X 取代**
- **重要：院友姓名和英文姓名必須分別放入 extracted_data 的對應欄位。即使只能看到姓氏，也要填寫（例如：院友姓名="劉"、英文姓名="LAU"）**

### 回覆格式（上傳圖片時）：
你必須返回 JSON，包含 type="image_analysis"：
\`\`\`json
{
  "type": "image_analysis",
  "document_type": "followup|prescription|diagnosis|vaccination|id_card|other",
  "extracted_data": {
    // 根據文件類型提取的結構化資料（見下方各類型欄位）
  },
  "explanation": "用繁體中文描述你從圖片中辨識到的內容",
  "suggested_action": "compare|insert|update|none",
  "comparison_query": "用於比對現有記錄的 SELECT SQL（可選）"
}
\`\`\`

### 各文件類型需提取的欄位：

#### 覆診預約 (followup)：
- 院友姓名 / 英文姓名 / 身份證號碼（用於識別院友）
- 覆診日期、覆診時間、覆診地點、覆診專科
- 備註

#### 處方管理 (prescription)：
- 院友姓名
- 藥物名稱（含劑量）、藥物來源
- 劑型、服用途徑、服用份量、服用單位
- 服用次數、服用日數、服用時間
- 需要時 (PRN)、備註

#### 診斷記錄 (diagnosis)：
- 院友姓名
- 診斷日期、診斷項目、診斷單位

#### 疫苗記錄 (vaccination)：
- 院友姓名
- 疫苗接種日期、疫苗項目、接種單位

#### 新增院友 / 身份證 (id_card)：
- 中文姓名（完整）
- 英文姓名（格式：SURNAME, Given names）
- 身份證號碼（HKID，含校驗碼括號，例如 A123456(7)）
- 出生日期（YYYY-MM-DD）
- 性別（男 或 女）

### 比對查詢 SQL (comparison_query)：
在 comparison_query 中生成一個 SELECT 來查找可能匹配的現有記錄，例如：
- 覆診：SELECT * FROM "覆診安排主表" WHERE "院友id" = (SELECT "院友id" FROM "院友主表" WHERE "中文姓名" ILIKE '%姓名%' LIMIT 1) AND "覆診日期" = '2026-04-20' LIMIT 5
- 處方：SELECT * FROM new_medication_prescriptions WHERE patient_id = (SELECT "院友id" FROM "院友主表" WHERE "中文姓名" ILIKE '%姓名%' LIMIT 1) AND medication_name ILIKE '%藥名%' AND status = 'active' LIMIT 5
- 診斷：SELECT * FROM diagnosis_records WHERE patient_id = (SELECT "院友id" FROM "院友主表" WHERE "中文姓名" ILIKE '%姓名%' LIMIT 1) ORDER BY diagnosis_date DESC LIMIT 5
- 疫苗：SELECT * FROM vaccination_records WHERE patient_id = (SELECT "院友id" FROM "院友主表" WHERE "中文姓名" ILIKE '%姓名%' LIMIT 1) ORDER BY vaccination_date DESC LIMIT 5
- 身份證/新增院友：SELECT "院友id", "中文姓名", "英文姓名", "身份證號碼", "性別", "出生日期", "在住狀態", "床號" FROM "院友主表" WHERE "身份證號碼" = '提取的身份證號碼' OR "中文姓名" ILIKE '%提取的中文姓名%' LIMIT 5
` : ''}

${DB_SCHEMA_SUMMARY}
`;
}
// =====================================================
// Execute Query Safely
// =====================================================
async function executeQuery(sql, params = []) {
  const supabase = getSupabaseClient();
  try {
    // Use rpc to execute raw SQL via a custom function, or use the REST API
    // Since we have service role, we can use supabase.rpc or direct query
    const { data, error } = await supabase.rpc("exec_sql_readonly", {
      query_text: sql,
      query_params: JSON.stringify(params)
    });
    if (error) {
      // Fallback: try direct query for simple SELECT
      // The exec_sql_readonly function may not exist yet, so we handle gracefully
      console.error("RPC exec_sql_readonly error:", error);
      return {
        data: null,
        error: error.message
      };
    }
    return {
      data,
      error: null
    };
  } catch (e) {
    return {
      data: null,
      error: e.message
    };
  }
}
async function handleImageChat(message, imageBase64, imageMimeType, systemPrompt, conversationHistory, userCtx) {
  // Step 1: Call Gemini with image to analyze and extract data
  let analysisResponse;
  try {
    const rawResponse = await callGemini(systemPrompt, message, conversationHistory, imageBase64, imageMimeType);
    if (rawResponse.type === "error") {
      return jsonResponse({
        success: true,
        response: rawResponse
      });
    }
    // If LLM returned image_analysis type
    if (rawResponse.type === "image_analysis") {
      analysisResponse = rawResponse;
    } else if (rawResponse.type === "answer") {
      // LLM chose to just answer (e.g. for non-document images)
      return jsonResponse({
        success: true,
        response: rawResponse
      });
    } else {
      // LLM returned query/mutation directly based on the image
      // Process as normal query/mutation flow
      return await processLLMResponse(rawResponse, message, userCtx);
    }
  } catch (err) {
    console.error("Image analysis Gemini call error:", err);
    return jsonResponse({
      success: true,
      response: {
        type: "error",
        explanation: "圖片分析失敗，AI 服務暫時無法使用。"
      }
    });
  }
  // Step 2: Smart patient identification — use ALL extracted clues to find matching patient
  let matchedPatient = null;
  let patientMatchCandidates = [];
  if (analysisResponse.document_type !== "other") {
    const ed = analysisResponse.extracted_data || {};
    // Helper: detect if a string is Latin/English (no CJK characters)
    const isEnglishStr = (s: string) => /^[A-Za-z\s,.\-']+$/.test(s.trim());
    // Gather all possible patient identifiers from ALL extracted_data fields
    let chineseName = "";
    let englishName = "";
    const hkid = ed.身份證號碼 || ed.HKID || "";
    // Collect all name-like fields
    const nameFields = [ed.中文姓名, ed.院友姓名, ed.姓名, ed.patient_name, ed.name];
    const enNameFields = [ed.英文姓名, ed.English_Name, ed.english_name, ed.patient_name_en];
    // Assign Chinese or English based on actual content, not field label
    for (const n of nameFields) {
      if (n && typeof n === "string" && n.trim()) {
        if (isEnglishStr(n)) {
          if (!englishName) englishName = n.trim();
        } else {
          if (!chineseName) chineseName = n.trim();
        }
      }
    }
    for (const n of enNameFields) {
      if (n && typeof n === "string" && n.trim()) {
        if (!englishName) englishName = n.trim();
      }
    }
    // Also try to extract patient name from the user message as a fallback
    if (!chineseName && !englishName && message) {
      // Match Chinese names (2-4 CJK chars)
      const cnMatch = message.match(/([\u4e00-\u9fff]{2,4})/);
      if (cnMatch) chineseName = cnMatch[1];
      // Match English names like "CHOW Mei Wan" or "CHAN, Pui Hing"
      const enMatch = message.match(/([A-Z][a-z]*(?:\s+[A-Z][a-z]*){1,3})/);
      if (enMatch) englishName = enMatch[1];
    }
    // Helper: strip OCR placeholder characters (X, x, *, ?) to get real name chars
    const stripPlaceholders = (s: string) => s.replace(/[Xx*?✕✖]+/g, "").trim();
    // Helper: check if a string is just placeholders
    const isPlaceholder = (s: string) => /^[Xx*?✕✖\s]+$/.test(s);
    // Extract Chinese surname (first CJK char) even from partially obscured names like 劉XX
    const cnSurname = chineseName ? (chineseName.match(/[\u4e00-\u9fff]/) || [""])[0] : "";
    const cnClean = stripPlaceholders(chineseName);
    // Extract English surname — first token that isn't a placeholder
    const enParts = englishName ? englishName.split(/[,\s]+/).filter(Boolean) : [];
    const enSurname = enParts.length > 0 && !isPlaceholder(enParts[0]) ? enParts[0] : "";
    const enGivenParts = enParts.slice(1).filter(p => !isPlaceholder(p));
    // Extract usable HKID digits — strip placeholders and parens, find consecutive real char sequences
    const hkidClean = hkid.replace(/[()\s]/g, "").toUpperCase();
    // Get sequences of real (non-X) characters for searching, minimum 3 chars
    const hkidRealSegments = hkidClean.replace(/X+/gi, "|").split("|").filter(s => s.length >= 3);
    // Also get all real digits for scoring
    const hkidRealChars = hkidClean.replace(/X/gi, "");
    console.log("Patient clues — CN:", chineseName, "cnSurname:", cnSurname, "cnClean:", cnClean, "EN:", englishName, "enSurname:", enSurname, "HKID:", hkid, "hkidSegments:", hkidRealSegments);
    // Build a comprehensive patient search query using OR conditions
    const conditions: string[] = [];
    // HKID — search each real segment
    for (const seg of hkidRealSegments) {
      conditions.push(`REPLACE(REPLACE("身份證號碼", '(', ''), ')', '') ILIKE '%${seg}%'`);
    }
    // Chinese name — full clean name match if we have 2+ real chars
    if (cnClean.length >= 2) {
      conditions.push(`"中文姓名" ILIKE '%${cnClean}%'`);
      conditions.push(`("中文姓氏" = '${cnClean.charAt(0)}' AND "中文名字" ILIKE '%${cnClean.substring(1)}%')`);
    }
    // Chinese surname only (when name is partially obscured like 劉XX)
    if (cnSurname && cnClean.length < 2) {
      conditions.push(`"中文姓氏" = '${cnSurname}'`);
    }
    // English surname
    if (enSurname && enSurname.length >= 2) {
      conditions.push(`UPPER("英文姓氏") = '${enSurname.toUpperCase()}'`);
      if (enGivenParts.length > 0) {
        conditions.push(`(UPPER("英文姓氏") = '${enSurname.toUpperCase()}' AND UPPER("英文名字") LIKE '%${enGivenParts.join("%").toUpperCase()}%')`);
      }
      conditions.push(`"英文姓名" ILIKE '%${enSurname}%'`);
    }
    if (conditions.length > 0) {
      const patientSql = `SELECT "院友id", "中文姓名", "中文姓氏", "中文名字", "英文姓名", "英文姓氏", "英文名字", "身份證號碼", "性別", "出生日期", "在住狀態", "床號" FROM "院友主表" WHERE ${conditions.join(" OR ")} LIMIT 20`;
      console.log("Patient match SQL:", patientSql);
      const { data: patientData, error: patientError } = await executeQuery(patientSql);
      if (!patientError && patientData && patientData.length > 0) {
        patientMatchCandidates = patientData;
        // Score each candidate — partial/obscured clues accumulate
        let bestScore = 0;
        for (const candidate of patientData){
          let score = 0;
          const cFullName = `${candidate.中文姓氏 || ""}${candidate.中文名字 || ""}`;
          const cName = candidate.中文姓名 || cFullName;
          const dbIdClean = (candidate.身份證號碼 || "").replace(/[()\s]/g, "").toUpperCase();
          // --- HKID scoring ---
          if (hkidRealChars.length >= 3 && dbIdClean) {
            // Exact full match (no placeholders)
            if (hkidClean === dbIdClean) { score += 100; }
            else {
              // Check each real segment against DB HKID
              for (const seg of hkidRealSegments) {
                if (dbIdClean.includes(seg)) {
                  // Longer segment = stronger signal
                  score += seg.length >= 5 ? 60 : seg.length >= 4 ? 45 : 30;
                  break; // Count best segment only
                }
              }
              // Also check if ALL individual real chars appear in correct positions
              if (hkidRealChars.length >= 2 && score < 60) {
                let posMatch = 0;
                for (let i = 0; i < hkidClean.length && i < dbIdClean.length; i++) {
                  if (hkidClean[i] !== "X" && hkidClean[i] === dbIdClean[i]) posMatch++;
                }
                if (posMatch >= 4) score += 50;
                else if (posMatch >= 3) score += 35;
                else if (posMatch >= 2) score += 20;
              }
            }
          }
          // --- Chinese name scoring ---
          if (cnClean && cName) {
            if (cName === cnClean) score += 50;
            else if (cnClean.length >= 2 && (cName.includes(cnClean) || cnClean.includes(cName))) score += 30;
            else if (cnSurname && (candidate.中文姓氏 === cnSurname || cName.charAt(0) === cnSurname)) score += 15;
          }
          // --- English name scoring ---
          if (enSurname) {
            const dbSurname = (candidate.英文姓氏 || "").toUpperCase();
            const dbGiven = (candidate.英文名字 || "").toUpperCase();
            if (dbSurname === enSurname.toUpperCase()) score += 30;
            else if (dbSurname.includes(enSurname.toUpperCase()) || enSurname.toUpperCase().includes(dbSurname)) score += 20;
            for (const gp of enGivenParts) {
              if (dbGiven.includes(gp.toUpperCase())) { score += 15; break; }
            }
          }
          console.log(`Patient ${candidate.院友id} ${candidate.中文姓名} score: ${score}`);
          // Prefer 在住 patients when scores are tied
          if (score > bestScore || (score === bestScore && candidate.在住狀態 === "在住" && matchedPatient?.在住狀態 !== "在住")) {
            bestScore = score;
            matchedPatient = candidate;
          }
        }
        console.log("Best match score:", bestScore, "patient:", matchedPatient?.中文姓名);
        // Threshold: surname(15) + EN surname(30) = 45 is a strong partial match
        // Single surname only (15) is too weak unless combined with other clues
        if (bestScore < 15) {
          matchedPatient = null;
        }
      }
    }
  }
  // Step 3: If patient found, run record-specific comparison query
  let existingRecords = [];
  let comparisonError = null;
  if (matchedPatient && analysisResponse.document_type !== "id_card") {
    // Build a targeted comparison query using the matched patient's ID
    const patientId = matchedPatient.院友id;
    const docType = analysisResponse.document_type;
    const ed = analysisResponse.extracted_data || {};
    let recordSql = "";
    if (docType === "followup") {
      const fDate = ed.覆診日期 || "";
      recordSql = fDate ? `SELECT "覆診id", "覆診日期", "覆診時間", "覆診地點", "覆診專科", "狀態", "備註" FROM "覆診安排主表" WHERE "院友id" = ${patientId} AND ("覆診日期" = '${fDate}' OR "覆診日期" >= CURRENT_DATE) ORDER BY "覆診日期" LIMIT 10` : `SELECT "覆診id", "覆診日期", "覆診時間", "覆診地點", "覆診專科", "狀態", "備註" FROM "覆診安排主表" WHERE "院友id" = ${patientId} ORDER BY "覆診日期" DESC LIMIT 10`;
    } else if (docType === "prescription") {
      const medName = ed.藥物名稱 || "";
      recordSql = medName ? `SELECT id, medication_name, dosage_amount, dosage_unit, daily_frequency, status, start_date, end_date FROM new_medication_prescriptions WHERE patient_id = ${patientId} AND (medication_name ILIKE '%${medName.split(" ")[0]}%' OR status = 'active') ORDER BY created_at DESC LIMIT 10` : `SELECT id, medication_name, dosage_amount, dosage_unit, daily_frequency, status, start_date FROM new_medication_prescriptions WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC LIMIT 10`;
    } else if (docType === "diagnosis") {
      recordSql = `SELECT id, diagnosis_date, diagnosis_item, diagnosis_unit FROM diagnosis_records WHERE patient_id = ${patientId} ORDER BY diagnosis_date DESC LIMIT 10`;
    } else if (docType === "vaccination") {
      recordSql = `SELECT id, vaccination_date, vaccine_item, vaccination_unit FROM vaccination_records WHERE patient_id = ${patientId} ORDER BY vaccination_date DESC LIMIT 10`;
    }
    if (recordSql) {
      const { data, error } = await executeQuery(recordSql);
      if (error) {
        comparisonError = error;
      } else {
        existingRecords = data || [];
      }
    }
  } else if (analysisResponse.document_type === "id_card") {
    // For ID card, the patientMatchCandidates ARE the comparison results
    existingRecords = patientMatchCandidates;
  } else if (!matchedPatient && analysisResponse.comparison_query) {
    // Fallback: if patient not matched, try the LLM-generated comparison query
    const sql = analysisResponse.comparison_query;
    if (sql.trim().toUpperCase().startsWith("SELECT") && !containsBlockedKeywords(sql)) {
      const { data, error } = await executeQuery(sql);
      if (error) {
        comparisonError = error;
      } else {
        existingRecords = data || [];
      }
    }
  }
  // Step 4: Generate INSERT SQL for one-click confirm whenever we have a matched patient
  // Always generate regardless of suggested_action — user still must click confirm
  // (LLM often returns "compare" in Step 1, but after comparison the record may be new)
  let pendingMutationData = null;
  const insertableDocTypes = ["followup", "prescription", "diagnosis", "vaccination"];
  if (matchedPatient && insertableDocTypes.includes(analysisResponse.document_type)) {
    const patientId = matchedPatient.院友id;
    const ed = analysisResponse.extracted_data || {};
    const docType = analysisResponse.document_type;
    let insertSql = "";
    let mutationExplanation = "";
    let tablesInvolved: string[] = [];
    const patientLabel = `${matchedPatient.中文姓氏 || ""}${matchedPatient.中文名字 || matchedPatient.中文姓名 || ""}（${matchedPatient.床號 || ""})`;
    if (docType === "followup") {
      const fDate = ed.覆診日期 || "";
      const fTime = ed.覆診時間 || null;
      const fPlace = ed.覆診地點 || null;
      const fDept = ed.覆診專科 || null;
      const fNote = ed.備註 || null;
      if (fDate) {
        const cols = [`"院友id"`, `"覆診日期"`];
        const vals = [`${patientId}`, `'${fDate}'`];
        if (fTime) { cols.push(`"覆診時間"`); vals.push(`'${fTime}'`); }
        if (fPlace) { cols.push(`"覆診地點"`); vals.push(`'${fPlace.replace(/'/g, "''")}'`); }
        if (fDept) { cols.push(`"覆診專科"`); vals.push(`'${fDept.replace(/'/g, "''")}'`); }
        if (fNote) { cols.push(`"備註"`); vals.push(`'${fNote.replace(/'/g, "''")}'`); }
        insertSql = `INSERT INTO "覆診安排主表" (${cols.join(", ")}) VALUES (${vals.join(", ")})`;
        mutationExplanation = `為${patientLabel}新增覆診預約：${fDate}${fPlace ? " " + fPlace : ""}${fDept ? " " + fDept : ""}`;
        tablesInvolved = ["覆診安排主表"];
      }
    } else if (docType === "prescription") {
      const medName = ed.藥物名稱 || ed.medication_name || "";
      if (medName) {
        const cols = ["patient_id", "medication_name"];
        const vals = [`${patientId}`, `'${medName.replace(/'/g, "''")}'`];
        if (ed.藥物來源) { cols.push("medication_source"); vals.push(`'${ed.藥物來源.replace(/'/g, "''")}'`); }
        if (ed.劑型) { cols.push("dosage_form"); vals.push(`'${ed.劑型.replace(/'/g, "''")}'`); }
        if (ed.服用途徑) { cols.push("administration_route"); vals.push(`'${ed.服用途徑.replace(/'/g, "''")}'`); }
        if (ed.服用份量) { cols.push("dosage_amount"); vals.push(`'${String(ed.服用份量).replace(/'/g, "''")}'`); }
        if (ed.服用單位) { cols.push("dosage_unit"); vals.push(`'${ed.服用單位.replace(/'/g, "''")}'`); }
        if (ed.服用次數) { cols.push("daily_frequency"); vals.push(`${parseInt(ed.服用次數) || 1}`); }
        if (ed.服用日數) { cols.push("duration_days"); vals.push(`${parseInt(ed.服用日數) || 0}`); }
        if (ed.備註) { cols.push("notes"); vals.push(`'${ed.備註.replace(/'/g, "''")}'`); }
        const isPrn = ed.需要時 === true || ed.需要時 === "是" || ed.PRN === true;
        if (isPrn) { cols.push("is_prn"); vals.push("true"); }
        cols.push("status"); vals.push("'active'");
        cols.push("start_date"); vals.push("CURRENT_DATE");
        insertSql = `INSERT INTO new_medication_prescriptions (${cols.join(", ")}) VALUES (${vals.join(", ")})`;
        mutationExplanation = `為${patientLabel}新增處方：${medName}`;
        tablesInvolved = ["new_medication_prescriptions"];
      }
    } else if (docType === "diagnosis") {
      const dDate = ed.診斷日期 || "";
      const dItem = ed.診斷項目 || "";
      if (dItem) {
        const cols = ["patient_id", "diagnosis_item"];
        const vals = [`${patientId}`, `'${dItem.replace(/'/g, "''")}'`];
        if (dDate) { cols.push("diagnosis_date"); vals.push(`'${dDate}'`); }
        else { cols.push("diagnosis_date"); vals.push("CURRENT_DATE"); }
        if (ed.診斷單位) { cols.push("diagnosis_unit"); vals.push(`'${ed.診斷單位.replace(/'/g, "''")}'`); }
        if (ed.備註) { cols.push("remarks"); vals.push(`'${ed.備註.replace(/'/g, "''")}'`); }
        insertSql = `INSERT INTO diagnosis_records (${cols.join(", ")}) VALUES (${vals.join(", ")})`;
        mutationExplanation = `為${patientLabel}新增診斷記錄：${dItem}`;
        tablesInvolved = ["diagnosis_records"];
      }
    } else if (docType === "vaccination") {
      const vDate = ed.疫苗接種日期 || ed.vaccination_date || "";
      const vItem = ed.疫苗項目 || ed.vaccine_item || "";
      if (vItem) {
        const cols = ["patient_id", "vaccine_item"];
        const vals = [`${patientId}`, `'${vItem.replace(/'/g, "''")}'`];
        if (vDate) { cols.push("vaccination_date"); vals.push(`'${vDate}'`); }
        else { cols.push("vaccination_date"); vals.push("CURRENT_DATE"); }
        if (ed.接種單位) { cols.push("vaccination_unit"); vals.push(`'${ed.接種單位.replace(/'/g, "''")}'`); }
        if (ed.備註) { cols.push("remarks"); vals.push(`'${ed.備註.replace(/'/g, "''")}'`); }
        insertSql = `INSERT INTO vaccination_records (${cols.join(", ")}) VALUES (${vals.join(", ")})`;
        mutationExplanation = `為${patientLabel}新增疫苗記錄：${vItem}`;
        tablesInvolved = ["vaccination_records"];
      }
    }
    // If SQL was generated, save as pending mutation
    if (insertSql) {
      const supabase = getSupabaseClient();
      const mutationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const { error: saveErr } = await supabase.from("ai_assistant_pending_mutations").insert({
        id: mutationId,
        user_id: userCtx.userId,
        sql_statement: insertSql,
        sql_params: [],
        explanation: mutationExplanation,
        tables_involved: tablesInvolved,
        mutation_type: "insert",
        expires_at: expiresAt.toISOString(),
        executed: false
      });
      if (!saveErr) {
        pendingMutationData = {
          mutationId,
          explanation: mutationExplanation,
          sql: insertSql,
          sqlType: "INSERT",
          tablesInvolved,
          expiresAt: expiresAt.toISOString()
        };
      }
    }
  }
  // Step 5: Call Gemini again to provide a comprehensive summary
  const docTypeLabels = {
    followup: "覆診預約",
    prescription: "處方管理",
    diagnosis: "診斷記錄",
    vaccination: "疫苗記錄",
    id_card: "身份證 / 新增院友",
    other: "其他文件"
  };
  const docLabel = docTypeLabels[analysisResponse.document_type] || "文件";
  let summaryPrompt;
  const isIdCard = analysisResponse.document_type === "id_card";
  // Build patient context string for non-id_card types
  const patientContext = matchedPatient ? `\n\n✅ 系統已自動識別此文件屬於院友：${matchedPatient.中文姓氏 || ""}${matchedPatient.中文名字 || matchedPatient.中文姓名 || "未知"}（床號：${matchedPatient.床號 || "無"}，院友ID：${matchedPatient.院友id}，在住狀態：${matchedPatient.在住狀態 || "未知"}）` : "";
  // Role/tone instruction — shared across all summary prompts
  const toneRule = `\n\n⚠️ 身份與語氣規則（必須遵守）：
- 你是在向護理人員（護士/護理員）匯報，不是在對院友本人說話
- 用第三人稱稱呼院友，例如「王洪晏院友」「該院友」，絕不用「您好」「您的」
- 不要出現「個人檔案」，這裡叫「系統記錄」或直接說「覆診記錄」「處方記錄」等
- 語氣專業簡潔，像護理同事之間的工作溝通`;
  if (existingRecords.length > 0) {
    summaryPrompt = isIdCard ? `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張身份證圖片，希望新增院友。
${toneRule}

已從身份證中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}

系統中已有以下可能匹配的院友記錄：
${JSON.stringify(existingRecords.slice(0, 10), null, 2)}

請用繁體中文做以下分析：
1. 列出從身份證中辨識到的資料（中文姓名、英文姓名、身份證號碼、性別、出生日期）
2. 比對現有院友記錄，判斷此人是否已在系統中
3. 如果已存在（身份證號碼相同），告知此院友已登記，顯示其床號和在住狀態
4. 如果不完全匹配（只是姓名相似但身份證不同），告知可能是不同人，建議新增
5. 如果有需要更新的資料（例如英文姓名有差異），指出差異

直接用自然語言回答，不要返回 JSON。` : `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張「${docLabel}」文件圖片。
${toneRule}

已從圖片中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}
${patientContext}

系統中已有以下該院友的相關記錄：
${JSON.stringify(existingRecords.slice(0, 10), null, 2)}

請用繁體中文做以下分析：
1. 說明已成功識別院友身份（顯示姓名和床號）
2. 列出從圖片中辨識到的內容
3. 與現有記錄逐一比對，指出是完全相同（已存在、無需重複新增）、部分不同（指出差異）、還是全新的記錄
4. 如果需要操作（新增或更新），明確說明建議的操作
5. 如果完全相同已存在，說明無需操作

直接用自然語言回答，不要返回 JSON。`;
  } else if (comparisonError) {
    summaryPrompt = isIdCard ? `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張身份證圖片。
${toneRule}

已從身份證中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}

比對現有院友時發生錯誤：${comparisonError}

請用繁體中文列出從身份證辨識到的資料，並告知無法自動比對是否已存在，詢問是否需要新增此院友。
直接用自然語言回答，不要返回 JSON。` : `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張「${docLabel}」文件圖片。
${toneRule}

已從圖片中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}

比對現有記錄時發生錯誤：${comparisonError}

請用繁體中文說明從圖片中辨識到的內容，並告知無法自動比對但已提取資料，詢問是否需要新增記錄。
直接用自然語言回答，不要返回 JSON。`;
  } else {
    summaryPrompt = isIdCard ? `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張身份證圖片。
${toneRule}

已從身份證中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}

系統中未找到匹配的院友記錄，此人尚未登記入住。

請用繁體中文：
1. 列出從身份證辨識到的完整資料（中文姓名、英文姓名、身份證號碼、性別、出生日期）
2. 說明此人不在系統中，建議新增為新院友

直接用自然語言回答，不要返回 JSON。` : matchedPatient ? `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張「${docLabel}」文件圖片。
${toneRule}

已從圖片中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}
${patientContext}

系統中未找到該院友現有的${docLabel}記錄。這是一筆新的${docLabel}。

請用繁體中文：
1. 說明已成功識別院友身份（顯示姓名和床號）
2. 列出從圖片中辨識到的具體內容
3. 建議為該院友新增此記錄

直接用自然語言回答，不要返回 JSON。` : `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張「${docLabel}」文件圖片。
${toneRule}

已從圖片中提取以下資料：
${JSON.stringify(analysisResponse.extracted_data, null, 2)}

⚠️ 系統中未能自動匹配到對應的院友。可能原因：圖片中的姓名不夠清晰、或此人尚未登記入住。

請用繁體中文：
1. 列出從圖片中辨識到的內容
2. 告知未能自動匹配院友，請確認院友身份
3. 建議確認後再新增記錄

直接用自然語言回答，不要返回 JSON。`;
  }
  let summary = analysisResponse.explanation;
  try {
    const summaryResponse = await callGemini("你是安老院舍管理系統的 AI 助護。你的用戶是院舍的護理人員（護士/護理員），不是院友本人。回覆時必須用第三人稱稱呼院友（例如「XX院友」），絕對不要用「您好」「您的個人檔案」等直接對院友說話的語氣。語氣要專業、簡潔，像在向同事匯報。請用繁體中文做自然語言回覆，不要返回 JSON。", summaryPrompt, []);
    if (summaryResponse.type === "answer") {
      summary = summaryResponse.explanation;
    }
  } catch  {
  // Use default explanation
  }
  // Step 6: Return response with pending mutation if available
  return jsonResponse({
    success: true,
    response: {
      type: "image_analysis_result",
      explanation: summary,
      documentType: analysisResponse.document_type,
      extractedData: analysisResponse.extracted_data,
      matchedPatient: matchedPatient ? {
        院友id: matchedPatient.院友id,
        中文姓名: `${matchedPatient.中文姓氏 || ""}${matchedPatient.中文名字 || ""}` || matchedPatient.中文姓名,
        床號: matchedPatient.床號,
        在住狀態: matchedPatient.在住狀態
      } : null,
      existingRecords: existingRecords.slice(0, 5),
      suggestedAction: analysisResponse.suggested_action,
      ...(pendingMutationData ? { pendingMutation: pendingMutationData } : {})
    }
  });
}
// =====================================================
// Process LLM Response (shared logic for query/mutation)
// =====================================================
async function processLLMResponse(llmResponse, message, userCtx) {
  // Handle plain answer / error
  if (llmResponse.type === "answer" || llmResponse.type === "error") {
    return jsonResponse({
      success: true,
      response: llmResponse
    });
  }
  // Validate SQL safety
  if (llmResponse.sql) {
    if (containsBlockedKeywords(llmResponse.sql)) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: "抱歉，此操作涉及結構性變更，不在 AI 助護的權限範圍內。"
        }
      });
    }
  }
  // Check table permissions
  const tablesInvolved = llmResponse.tables_involved || [];
  if (involvesBlockedTables(tablesInvolved)) {
    return jsonResponse({
      success: true,
      response: {
        type: "error",
        explanation: "抱歉，此操作涉及系統管理表，AI 助護無法執行。"
      }
    });
  }
  const sqlType = llmResponse.sql_type || "SELECT";
  const requiredPerms = getRequiredPermissions(tablesInvolved, sqlType);
  for (const perm of requiredPerms){
    if (!userHasPermission(userCtx, perm.category, perm.action)) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: `抱歉，您的帳戶沒有「${perm.category}」類別的「${perm.action}」權限。`
        }
      });
    }
  }
  // Handle query
  if (llmResponse.type === "query" && llmResponse.sql) {
    const { data, error } = await executeQuery(llmResponse.sql, llmResponse.params || []);
    if (error) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: `查詢執行失敗：${error}。請嘗試重新描述您的問題。`
        }
      });
    }
    return jsonResponse({
      success: true,
      response: {
        type: "query_result",
        explanation: llmResponse.explanation,
        data: data?.slice(0, 100) || [],
        rowCount: data?.length || 0
      }
    });
  }
  // Handle mutation
  if (llmResponse.type === "mutation" && llmResponse.sql) {
    const supabase = getSupabaseClient();
    const mutationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { error } = await supabase.from("ai_assistant_pending_mutations").insert({
      id: mutationId,
      user_id: userCtx.userId,
      sql_statement: llmResponse.sql,
      sql_params: llmResponse.params || [],
      explanation: llmResponse.explanation,
      tables_involved: tablesInvolved,
      mutation_type: sqlType.toLowerCase(),
      expires_at: expiresAt.toISOString(),
      executed: false
    });
    if (error) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: "暫存操作失敗，請稍後再試。"
        }
      });
    }
    return jsonResponse({
      success: true,
      response: {
        type: "mutation_preview",
        mutationId,
        explanation: llmResponse.explanation,
        sql: llmResponse.sql,
        sqlType,
        tablesInvolved,
        expiresAt: expiresAt.toISOString()
      }
    });
  }
  return jsonResponse({
    success: true,
    response: {
      type: "answer",
      explanation: llmResponse.explanation || "抱歉，我無法理解您的請求。"
    }
  });
}
// =====================================================
// Main Handler
// =====================================================
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();
  try {
    // Extract auth token
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse({
        success: false,
        error: "未提供認證令牌"
      }, 401);
    }
    // Validate user
    const userCtx = await validateToken(token);
    if (!userCtx) {
      return jsonResponse({
        success: false,
        error: "認證令牌無效或已過期"
      }, 401);
    }
    // Rate limit
    if (!checkRateLimit(userCtx.userId)) {
      return jsonResponse({
        success: false,
        error: "請求過於頻繁，請稍後再試（每分鐘限 20 次）"
      }, 429);
    }
    if (path === "chat") {
      return await handleChat(req, userCtx);
    } else if (path === "confirm-mutation") {
      return await handleConfirmMutation(req, userCtx);
    } else {
      return jsonResponse({
        success: false,
        error: "未知端點"
      }, 404);
    }
  } catch (err) {
    console.error("AI Assistant error:", err);
    return jsonResponse({
      success: false,
      error: "伺服器內部錯誤，請稍後再試"
    }, 500);
  }
});
// =====================================================
// /chat Handler
// =====================================================
async function handleChat(req, userCtx) {
  const { message, conversationHistory = [], imageBase64, imageMimeType } = await req.json();
  if ((!message || typeof message !== "string" || message.trim().length === 0) && !imageBase64) {
    return jsonResponse({
      success: false,
      error: "請輸入訊息或上傳圖片"
    }, 400);
  }
  if (message && message.length > 2000) {
    return jsonResponse({
      success: false,
      error: "訊息過長，請限制在 2000 字以內"
    }, 400);
  }
  // Validate image if provided
  if (imageBase64) {
    // Check base64 size (roughly 4/3 of original file size)
    const estimatedSize = imageBase64.length * 3 / 4;
    if (estimatedSize > 10 * 1024 * 1024) {
      return jsonResponse({
        success: false,
        error: "圖片過大，請選擇小於 5MB 的圖片"
      }, 400);
    }
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];
    if (!imageMimeType || !validMimeTypes.includes(imageMimeType)) {
      return jsonResponse({
        success: false,
        error: "不支援的圖片格式"
      }, 400);
    }
  }
  // Build system prompt with user context
  const systemPrompt = buildSystemPrompt(userCtx, !!imageBase64);
  // If image is provided, first analyze the image to extract structured data
  if (imageBase64 && imageMimeType) {
    return await handleImageChat(message || "請分析這張圖片", imageBase64, imageMimeType, systemPrompt, conversationHistory, userCtx);
  }
  // Call Gemini (text-only)
  let llmResponse;
  try {
    llmResponse = await callGemini(systemPrompt, message, conversationHistory);
  } catch (err) {
    console.error("Gemini call error:", err);
    return jsonResponse({
      success: true,
      response: {
        type: "error",
        explanation: "AI 服務暫時無法使用，請稍後再試。"
      }
    });
  }
  // Handle plain answer / error
  if (llmResponse.type === "answer" || llmResponse.type === "error") {
    return jsonResponse({
      success: true,
      response: llmResponse
    });
  }
  // Validate SQL safety
  if (llmResponse.sql) {
    if (containsBlockedKeywords(llmResponse.sql)) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: "抱歉，此操作涉及結構性變更（如修改表結構、刪除表等），不在 AI 助護的權限範圍內。"
        }
      });
    }
  }
  // Check table permissions
  const tablesInvolved = llmResponse.tables_involved || [];
  if (involvesBlockedTables(tablesInvolved)) {
    return jsonResponse({
      success: true,
      response: {
        type: "error",
        explanation: "抱歉，此操作涉及系統管理表，基於安全考量，AI 助護無法執行此操作。"
      }
    });
  }
  // Check user permissions
  const sqlType = llmResponse.sql_type || "SELECT";
  const requiredPerms = getRequiredPermissions(tablesInvolved, sqlType);
  for (const perm of requiredPerms){
    if (!userHasPermission(userCtx, perm.category, perm.action)) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: `抱歉，您的帳戶沒有「${perm.category}」類別的「${perm.action}」權限，無法執行此操作。`
        }
      });
    }
  }
  // Handle query (SELECT) — execute immediately
  if (llmResponse.type === "query" && llmResponse.sql) {
    const { data, error } = await executeQuery(llmResponse.sql, llmResponse.params || []);
    if (error) {
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: `查詢執行失敗：${error}。請嘗試重新描述您的問題。`
        }
      });
    }
    // Call Gemini again to summarize results
    let summary = llmResponse.explanation;
    const rowCount = data?.length || 0;
    try {
      if (rowCount > 0) {
        const summaryResponse = await callGemini("你是一個資料摘要助手。請用繁體中文簡潔地總結以下查詢結果，以便用戶理解。如果資料是表格形式，可以用簡單的列表呈現關鍵資訊。不要返回 JSON，直接用自然語言回答。", `用戶問題：${message}\n\n查詢結果（共 ${rowCount} 筆）：\n${JSON.stringify(data.slice(0, 50), null, 2)}${rowCount > 50 ? "\n...（更多結果已省略）" : ""}`, []);
        if (summaryResponse.type === "answer") {
          summary = summaryResponse.explanation;
        }
      } else {
        const summaryResponse = await callGemini("你是一個資料摘要助手。用戶查詢資料庫後結果為空（0 筆資料）。請用繁體中文、自然且友善的語氣告訴用戶結果為空。根據用戶的問題給出有意義的回應，例如「今天沒有院友需要覆診」而非只是重複查詢描述。不要返回 JSON，直接用自然語言回答。", `用戶問題：${message}\n\n查詢結果：0 筆資料（無符合條件的記錄）`, []);
        if (summaryResponse.type === "answer") {
          summary = summaryResponse.explanation;
        }
      }
    } catch  {
      // Use default explanation if summary fails
      if (rowCount === 0) {
        summary = "查詢完成，沒有找到符合條件的資料。";
      }
    }
    return jsonResponse({
      success: true,
      response: {
        type: "query_result",
        explanation: summary,
        data: data?.slice(0, 100) || [],
        rowCount: data?.length || 0
      }
    });
  }
  // Handle mutation — store for confirmation
  if (llmResponse.type === "mutation" && llmResponse.sql) {
    const supabase = getSupabaseClient();
    const mutationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const { error } = await supabase.from("ai_assistant_pending_mutations").insert({
      id: mutationId,
      user_id: userCtx.userId,
      sql_statement: llmResponse.sql,
      sql_params: llmResponse.params || [],
      explanation: llmResponse.explanation,
      tables_involved: tablesInvolved,
      mutation_type: sqlType.toLowerCase(),
      expires_at: expiresAt.toISOString(),
      executed: false
    });
    if (error) {
      console.error("Failed to store pending mutation:", error);
      return jsonResponse({
        success: true,
        response: {
          type: "error",
          explanation: "暫存操作失敗，請稍後再試。"
        }
      });
    }
    return jsonResponse({
      success: true,
      response: {
        type: "mutation_preview",
        mutationId,
        explanation: llmResponse.explanation,
        sql: llmResponse.sql,
        sqlType: sqlType,
        tablesInvolved,
        expiresAt: expiresAt.toISOString()
      }
    });
  }
  // Fallback
  return jsonResponse({
    success: true,
    response: {
      type: "answer",
      explanation: llmResponse.explanation || "抱歉，我無法理解您的請求，請嘗試重新描述。"
    }
  });
}
// =====================================================
// /confirm-mutation Handler
// =====================================================
async function handleConfirmMutation(req, userCtx) {
  const { mutationId } = await req.json();
  if (!mutationId) {
    return jsonResponse({
      success: false,
      error: "缺少 mutationId"
    }, 400);
  }
  const supabase = getSupabaseClient();
  // Fetch pending mutation
  const { data: mutation, error: fetchError } = await supabase.from("ai_assistant_pending_mutations").select("*").eq("id", mutationId).eq("user_id", userCtx.userId).eq("executed", false).single();
  if (fetchError || !mutation) {
    return jsonResponse({
      success: false,
      error: "找不到待確認的操作，可能已過期或已執行。"
    }, 404);
  }
  // Check expiry
  if (new Date(mutation.expires_at) < new Date()) {
    // Clean up expired mutation
    await supabase.from("ai_assistant_pending_mutations").delete().eq("id", mutationId);
    return jsonResponse({
      success: false,
      error: "此操作已過期（5 分鐘），請重新發起請求。"
    }, 410);
  }
  // Re-verify permissions
  const tablesInvolved = mutation.tables_involved || [];
  const requiredPerms = getRequiredPermissions(tablesInvolved, mutation.mutation_type);
  for (const perm of requiredPerms){
    if (!userHasPermission(userCtx, perm.category, perm.action)) {
      return jsonResponse({
        success: false,
        error: `抱歉，您已沒有足夠的權限執行此操作。`
      }, 403);
    }
  }
  // Execute the mutation
  try {
    const { data, error } = await supabase.rpc("exec_sql_mutation", {
      query_text: mutation.sql_statement,
      query_params: JSON.stringify(mutation.sql_params || [])
    });
    if (error) {
      console.error("Mutation execution error:", error);
      return jsonResponse({
        success: false,
        error: `操作執行失敗：${error.message}`
      }, 500);
    }
    // Mark as executed
    await supabase.from("ai_assistant_pending_mutations").update({
      executed: true
    }).eq("id", mutationId);
    return jsonResponse({
      success: true,
      response: {
        type: "mutation_success",
        explanation: `操作已成功執行：${mutation.explanation}`,
        affectedRows: data
      }
    });
  } catch (err) {
    console.error("Mutation execution error:", err);
    return jsonResponse({
      success: false,
      error: `操作執行失敗：${err.message}`
    }, 500);
  }
}
// =====================================================
// Helpers
// =====================================================
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
