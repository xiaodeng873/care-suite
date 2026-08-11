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
function isOutOfScopeQuestion(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const t = text.trim().toLowerCase();
  const stripped = t.replace(/[!\uFF01?\uFF1F.。\\s]+$/g, "");
  // Greetings (Unicode escapes avoid source-encoding mismatches in Edge Runtime)
  const greetings = [
    "\u4f60\u597d", "\u60a8\u597d", "\u55e8", "hello", "hi",
    "\u65e9\u5b89", "\u5348\u5b89", "\u665a\u5b89",
    "\u8b1d\u8b1d", "\u591a\u8b1d", "\u611f\u8b1d",
    "\u518d\u898b", "\u62dc\u62dc", "bye"
  ];
  if (greetings.includes(stripped)) return true;
  // Weather
  if (t.includes("\u5929\u6c23") || t.includes("weather") || t.includes("\u6eab\u5ea6") || t.includes("\u5e7e\u5ea6")) return true;
  // News / politics / entertainment / small talk
  if (t.includes("\u65b0\u805e") || t.includes("news") || t.includes("\u653f\u6cbb") || t.includes("\u6295\u8cc7") || t.includes("\u80a1\u7968") || t.includes("\u57fa\u91d1") || t.includes("\u96fb\u5f71") || t.includes("\u97f3\u6a02") || t.includes("\u7b11\u8a71") || t.includes("\u9592\u804a") || t.includes("\u804a\u5929") || t.includes("\u904a\u6232")) return true;
  // Meta questions
  if (t.includes("\u4f60\u662f\u8ab0") || t.includes("\u4f60\u6709\u4ec0\u9ebc\u7528") || t.includes("\u4f60\u6703\u505a\u4ec0\u9ebc") || t.includes("who are you") || t.includes("what can you do")) return true;
  return false;
}
async function validateToken(token) {
  console.log("[AI Assistant] Validating token, length:", token?.length);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // 1. 嘗試自訂 token 驗證（管理者/員工）— 查找未過期的 session
  const { data: session, error: sessionError } = await supabase.from("user_sessions").select("user_id, expires_at").eq("token", token).gt("expires_at", now).single();
  if (sessionError) {
    console.log("[AI Assistant] Active session lookup error or not found:", sessionError?.message);
  }
  if (!sessionError && session) {
    console.log("[AI Assistant] Active session found for user:", session.user_id);
    await supabase.from("user_sessions").update({ last_accessed_at: new Date().toISOString() }).eq("token", token);
    const { data: user, error: userError } = await supabase.from("user_profiles").select("id, role, name_zh, is_active").eq("id", session.user_id).eq("is_active", true).single();
    if (userError || !user) {
      console.log("[AI Assistant] User not found or inactive for active session:", session.user_id);
      return null;
    }
    const { data: permissions } = await supabase.rpc("get_user_permissions", { p_user_id: user.id });
    return { userId: user.id, role: user.role, auth_type: "project_user", name: user.name_zh, permissions: permissions || [] };
  }

  // 1b. 自訂 token 存在但已過期 → 自動延長 24 小時
  console.log("[AI Assistant] No active session, checking for expired session to renew...");
  const { data: expiredSession, error: expiredError } = await supabase.from("user_sessions").select("user_id, expires_at").eq("token", token).single();
  if (expiredError) {
    console.log("[AI Assistant] Expired session lookup error or not found:", expiredError?.message);
  }
  if (expiredSession) {
    console.log("[AI Assistant] Found expired session for user:", expiredSession.user_id, "expires_at:", expiredSession.expires_at);
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + 24);
    const { error: updateError } = await supabase.from("user_sessions").update({
      expires_at: newExpiry.toISOString(),
      last_accessed_at: new Date().toISOString()
    }).eq("token", token);
    if (updateError) {
      console.error("[AI Assistant] Failed to renew session:", updateError);
      return null;
    }
    console.log("[AI Assistant] Session renewed, new expiry:", newExpiry.toISOString());
    const { data: user, error: userError } = await supabase.from("user_profiles").select("id, role, name_zh, is_active").eq("id", expiredSession.user_id).eq("is_active", true).single();
    if (userError || !user) {
      console.log("[AI Assistant] User not found or inactive after renewal:", expiredSession.user_id);
      return null;
    }
    const { data: permissions } = await supabase.rpc("get_user_permissions", { p_user_id: user.id });
    return { userId: user.id, role: user.role, auth_type: "project_user", name: user.name_zh, permissions: permissions || [] };
  }

  // 2. 嘗試 Supabase Auth JWT 驗證（開發者）
  console.log("[AI Assistant] No custom session found, trying Supabase Auth JWT...");
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError) {
      console.log("[AI Assistant] Supabase Auth validation error:", authError.message);
    }
    if (!authError && authUser) {
      console.log("[AI Assistant] Supabase Auth user validated:", authUser.id);
      return { userId: authUser.id, role: "developer", auth_type: "developer", name: authUser.user_metadata?.display_name || authUser.email || "Developer", permissions: [] };
    }
  } catch (err) {
    console.error("[AI Assistant] Supabase Auth JWT validation exception:", err);
  }
  console.log("[AI Assistant] Token validation failed for all methods");
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
// Usage Logging
// =====================================================
async function logUsage(logEntry) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("ai_assistant_usage_logs").insert({
      user_id: logEntry.userId,
      auth_type: logEntry.authType,
      user_role: logEntry.userRole,
      user_name: logEntry.userName,
      request_type: logEntry.requestType,
      message_text: logEntry.messageText,
      response_type: logEntry.responseType,
      model: logEntry.model,
      tokens_used: logEntry.tokensUsed,
      duration_ms: logEntry.durationMs,
      ip_address: logEntry.ipAddress,
      user_agent: logEntry.userAgent
    });
    if (error) {
      console.error("Failed to log AI usage:", error);
    }
  } catch (err) {
    console.error("Usage logging error:", err);
  }
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
async function callGemini(systemPrompt, userMessage, conversationHistory, imageBase64, imageMimeType, maxOutputTokens = 2048) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("未設定 GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
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
        maxOutputTokens
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
  const authLabel = userCtx.auth_type === "developer" ? "開發者帳戶" : "專案用戶帳戶";
  const permCategories = [
    ...new Set(userCtx.permissions.map((p)=>p.category))
  ];
  return `你是「AI 助護」，一個安老院舍護理管理系統的智能助手。
你的用戶是「${userCtx.name}」，角色為「${roleLabel}」，登入類型為「${authLabel}」。

## 你可以回答的主題範圍（醫療護理與安老院管理相關）：
1. 理解自然語言問題，查詢資料庫中的院友資料、健康記錄、用藥、覆診、護理紀錄等並回答
2. 根據用戶指示，生成 INSERT/UPDATE/DELETE SQL 操作（需用戶確認後才會執行）
3. 回答本系統使用相關的問題

## 你**絕對不能**回答的主題：
- 與安老院護理、醫療、藥物、院友管理、健康記錄、本系統使用**完全無關**的問題
- 一般閒聊、天氣、新聞、政治、投資、個人建議等非工作相關內容
- 任何涉及系統外服務、外部網站、程式碼生成以外的技術問題

**只有當問題完全與醫療護理、安老院管理、本系統使用無關時，你才回傳 refused。**
對於範圍外問題，你必須**直接拒絕**並回傳以下 JSON：
\`\`\`json
{
  "type": "refused",
  "explanation": "抱歉，AI 助護只回答醫療護理、安老院管理或本系統使用相關的問題。"
}
\`\`\`

**絕對不要回傳 refused 的例子**（這些都是允許的問題，要回答或生成 SQL）：
- 「如何新增院友」→ 回答系統操作步驟
- 「202-1 血壓」→ 生成 SELECT 查詢
- 「怎樣查血壓」→ 回答查詢方法
- 「如何停用處方」→ 生成 UPDATE SQL

**必須回傳 refused 的例子**（與工作完全無關）：
- 「今天天氣如何」、「你好」、「謝謝」、「有什麼新聞」

## 回答隱私規則（極重要）
- **院友id / 院友編號** 是內部系統識別碼，回答使用者時**絕對禁止**顯示。
- 可以透露的對外資訊包括：床號、中文姓名、英文姓名、性別、年齡、在住狀態、護理等級、入住類型等。
- 產生 SQL 查詢時仍可使用 "院友id" 進行 JOIN 或 WHERE，但最後回覆的 explanation、摘要與資料表格中，不可出現院友id / 院友編號。

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
- 「233-3今天BP幾多」→ 先查床號找院友id，再查「健康監測記錄」WHERE "監測類型" = '血壓'

## 你不能做的事情：
1. 執行任何 DDL 操作（CREATE TABLE, ALTER TABLE, DROP TABLE 等）
2. 查詢或操作系統表（user_profiles, user_sessions, permissions 等）
3. 任何涉及介面布局、增減欄位等結構性改變
4. 超出用戶權限範圍的操作

## 用戶可訪問的權限類別：
${permCategories.length > 0 ? permCategories.join(", ") : "（受限制）"}

## 回覆格式要求：
你必須**始終**返回嚴格的 JSON 格式，不要包含任何其他文字。
回答必須簡潔、直接，不要重複問題，不要添加多餘的問候或解釋。

### 查詢類型（SELECT）：
\`\`\`json
{
  "type": "query",
  "sql": "SELECT ... FROM ... WHERE ...",
  "sql_type": "SELECT",
  "params": [],
  "tables_involved": ["表名1", "表名2"],
  "explanation": "簡潔描述查詢意圖"
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
  "explanation": "你的回答內容（簡潔、直接回答問題）"
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
6. **監測工作紙（health_worksheet）**— 生命表徵 / 健康監測記錄表，通常是表格形式，每行一位院友。關鍵詞：監測工作紙、生命表徵記錄表、血壓、血糖、脈搏、床號、批量記錄
7. **院友人像相片（portrait）**— 院友正面人像、大頭照。畫面主要是一個人的面部或半身像，沒有文件或表格文字內容
8. **其他（other）**— 無法歸類的文件

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
  "document_type": "followup|prescription|diagnosis|vaccination|id_card|health_worksheet|portrait|other",
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

#### 監測工作紙 (health_worksheet)：
- extracted_data 是一個 JSON 陣列（不是物件），每個元素代表工作紙上一位院友的一行記錄：
  [{"床號": "A101", "院友姓名": "王大明", "記錄日期": "2026-07-01", "記錄時間": "08:00", "收縮壓": 120, "舒張壓": 80, "脈搏": 72, "血糖值": 6.5, "備註": ""}]
- 只輸出有值的欄位，無法辨識的欄位直接省略，不要輸出 null 或空字串
- 所有數值用數字類型（非字串）；血糖值保留一位小數
- 此類型不需要 comparison_query，suggested_action 用 "none"

#### 院友人像相片 (portrait)：
- 通常沒有文字可提取，extracted_data 可以是空物件 {}
- 如果圖片中附有姓名或床號等文字線索，放入 院友姓名 / 床號 欄位
- 此類型不需要 comparison_query，suggested_action 用 "none"

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
function substituteParams(sql, params = []) {
  if (!params || params.length === 0) return sql;
  let result = sql;
  for (let i = 0; i < params.length; i++) {
    const val = params[i];
    let replacement;
    if (val === null || val === undefined) {
      replacement = "NULL";
    } else if (typeof val === "number") {
      replacement = String(val);
    } else if (typeof val === "boolean") {
      replacement = val ? "TRUE" : "FALSE";
    } else {
      replacement = `'${String(val).replace(/'/g, "''")}'`;
    }
    result = result.replace(new RegExp(`\\$${i + 1}`, "g"), replacement);
  }
  return result;
}

function normalizeSql(sql: string): string {
  if (!sql) return sql;
  return sql.trim().replace(/;\s*$/, "");
}

function sanitizeDataForResponse(data) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeDataForResponse);
  }
  if (typeof data === "object" && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "院友id" || key === "patient_id") continue;
      sanitized[key] = sanitizeDataForResponse(value);
    }
    return sanitized;
  }
  return data;
}

function getRowValue(row: Record<string, any>, names: string[]): string {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
      return String(row[name]);
    }
  }
  return "";
}

function generateQueryResultSummary(data: any[], originalExplanation: string = ""): string {
  if (!data || data.length === 0) {
    if (originalExplanation && (originalExplanation.includes("沒有") || originalExplanation.includes("空") || originalExplanation.includes("無") || originalExplanation.includes("0 筆"))) {
      return originalExplanation;
    }
    return "查詢完成，沒有找到符合條件的資料。";
  }

  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  const bed = getRowValue(firstRow, ["床號", "bed_number", "bed"]);
  const name = getRowValue(firstRow, ["中文姓名", "姓名", "name", "patient_name"]);
  const enName = getRowValue(firstRow, ["英文姓名", "english_name", "name_en"]);
  const gender = getRowValue(firstRow, ["性別", "gender"]);
  const status = getRowValue(firstRow, ["在住狀態", "residency_status", "status"]);

  // Vital signs / health monitoring — handle before generic patient lookup
  const isVitalSign = keys.some((k: string) => k.includes("血壓") || k.includes("收縮壓") || k.includes("舒張壓") || k.includes("脈搏") || k.includes("體溫") || k.includes("血糖") || k.includes("血氧") || k.includes("監測"));
  if (isVitalSign && data.length === 1) {
    const row = firstRow;
    const date = getRowValue(row, ["監測日期", "記錄日期", "日期", "date"]);
    const time = getRowValue(row, ["監測時間", "記錄時間", "時間", "time"]);
    const type = getRowValue(row, ["監測類型", "類型", "type"]);
    const sys = getRowValue(row, ["收縮壓", "systolic_bp"]);
    const dia = getRowValue(row, ["舒張壓", "diastolic_bp"]);
    const value = getRowValue(row, ["監測數值", "數值", "value", "測量值"]);
    const unit = getRowValue(row, ["單位", "unit"]);
    const pulse = getRowValue(row, ["脈搏", "心率", "pulse", "heart_rate"]);
    const temp = getRowValue(row, ["體溫", "temperature"]);
    const spo2 = getRowValue(row, ["血氧", "spo2"]);

    const parts: string[] = [];
    if (bed && name) parts.push(`床號 ${bed} ${name}院友`);
    else if (name) parts.push(`${name}院友`);
    else if (bed) parts.push(`床號 ${bed} 院友`);

    const itemName = type || (sys && dia ? "血壓" : "監測值");
    const dt = date && time ? `${date} ${time}` : date || time;
    if (dt) parts.push(`${itemName}（${dt}）`);
    else parts.push(`${itemName}`);

    if (sys && dia) parts.push(`為 ${sys}/${dia} mmHg`);
    else if (temp) parts.push(`為 ${temp}°C`);
    else if (spo2) parts.push(`為 ${spo2}%`);
    else if (pulse) parts.push(`為 ${pulse} 次/分`);
    else if (value) parts.push(`為 ${value}${unit ? " " + unit : ""}`);

    if (parts.length >= 2) return parts.join("") + "。";
  }

  // Single patient lookup
  if (data.length === 1 && (name || bed)) {
    const parts: string[] = [];
    if (bed && name) {
      parts.push(`床號 ${bed} 的院友是${name}`);
    } else if (name) {
      parts.push(`${name}院友`);
    } else if (bed) {
      parts.push(`床號 ${bed}`);
    }
    if (enName && parts.length > 0) {
      parts[0] = parts[0] + `（${enName}）`;
    }
    if (gender) parts.push(`${gender}性`);
    if (status) parts.push(`目前在住狀態為「${status}」`);
    if (firstRow["年齡"] || firstRow["age"]) parts.push(`年齡 ${firstRow["年齡"] || firstRow["age"]} 歲`);
    if (firstRow["護理等級"]) parts.push(`護理等級為「${firstRow["護理等級"]}」`);
    if (firstRow["入住類型"]) parts.push(`入住類型為「${firstRow["入住類型"]}」`);
    if (parts.length > 0) return parts.join("，") + "。";
  }

  // General: summarize first few rows
  const maxRows = 3;
  const rowSummaries: string[] = [];
  for (let i = 0; i < Math.min(data.length, maxRows); i++) {
    const row = data[i];
    const rowName = getRowValue(row, ["中文姓名", "姓名", "name"]) || getRowValue(row, ["床號", "bed_number", "bed"]);
    const label = rowName || `第 ${i + 1} 筆`;
    const pairs = keys
      .filter((k: string) => k !== "院友id" && k !== "patient_id")
      .slice(0, 4)
      .map((k: string) => `${k}: ${row[k]}`)
      .join("、");
    rowSummaries.push(`${label}：${pairs}`);
  }

  if (data.length === 1) {
    return `查到 1 筆資料：${rowSummaries[0]}。`;
  }
  let summary = `查到 ${data.length} 筆資料：`;
  summary += "\n" + rowSummaries.join("\n");
  if (data.length > maxRows) summary += `\n...還有 ${data.length - maxRows} 筆。`;
  return summary;
}

async function executeQuery(sql, params = []) {
  const supabase = getSupabaseClient();
  try {
    // Use rpc to execute raw SQL via a custom function, or use the REST API
    // Since we have service role, we can use supabase.rpc or direct query
    const { data, error } = await supabase.rpc("exec_sql_readonly", {
      query_text: substituteParams(normalizeSql(sql), params),
      query_params: JSON.stringify([])
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
  if (analysisResponse.document_type !== "other" && analysisResponse.document_type !== "health_worksheet") {
    const ed = analysisResponse.extracted_data || {};
    // Helper: detect if a string is Latin/English (no CJK characters)
    const isEnglishStr = (s: string) => /^[A-Za-z\s,.\-']+$/.test(s.trim());
    // Gather all possible patient identifiers from ALL extracted_data fields
    let chineseName = "";
    let englishName = "";
    let bedNo = "";
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
    // Bed number clue extracted from image (e.g. portrait with a bed label)
    if (ed.床號 && typeof ed.床號 === "string") bedNo = ed.床號.trim();
    // Also try to extract patient name from the user message as a fallback
    // (strip the frontend's default image-upload boilerplate first)
    const msgForClues = (message || "").replace(/請分析這張圖片（第 \d+\/\d+ 張）|請分析這張圖片/g, "").trim();
    if (!chineseName && !englishName && msgForClues) {
      // Match Chinese names (2-4 CJK chars)
      const cnMatch = msgForClues.match(/([\u4e00-\u9fff]{2,4})/);
      if (cnMatch) chineseName = cnMatch[1];
      // Match English names like "CHOW Mei Wan" or "CHAN, Pui Hing"
      const enMatch = msgForClues.match(/([A-Z][a-z]*(?:\s+[A-Z][a-z]*){1,3})/);
      if (enMatch) englishName = enMatch[1];
    }
    // Portrait photos carry no text clues — also match a bed number from the user message
    if (!bedNo && analysisResponse.document_type === "portrait" && msgForClues) {
      const bedMatch = msgForClues.match(/([A-Za-z]{1,2}\d{2,4}[A-Za-z]?)/);
      if (bedMatch) bedNo = bedMatch[1].toUpperCase();
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
    // Bed number (from image label or user message — portrait fallback)
    if (bedNo) {
      conditions.push(`UPPER("床號") = '${bedNo.toUpperCase().replace(/'/g, "''")}'`);
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
          // --- Bed number scoring ---
          if (bedNo && (candidate.床號 || "").toUpperCase() === bedNo.toUpperCase()) {
            score += 40;
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
    health_worksheet: "監測工作紙",
    portrait: "院友相片",
    other: "其他文件"
  };
  const docLabel = docTypeLabels[analysisResponse.document_type] || "文件";
  let summaryPrompt;
  const isIdCard = analysisResponse.document_type === "id_card";
  const isWorksheet = analysisResponse.document_type === "health_worksheet";
  const isPortrait = analysisResponse.document_type === "portrait";
  // Build patient context string for non-id_card types
  const patientContext = matchedPatient ? `\n\n✅ 系統已自動識別此文件屬於院友：${matchedPatient.中文姓氏 || ""}${matchedPatient.中文名字 || matchedPatient.中文姓名 || "未知"}（床號：${matchedPatient.床號 || "無"}，在住狀態：${matchedPatient.在住狀態 || "未知"}）` : "";
  // Role/tone instruction — shared across all summary prompts
  const toneRule = `\n\n⚠️ 身份與語氣規則（必須遵守）：
- 你是在向護理人員（護士/護理員）匯報，不是在對院友本人說話
- 用第三人稱稱呼院友，例如「王洪晏院友」「該院友」，絕不用「您好」「您的」
- 不要出現「個人檔案」，這裡叫「系統記錄」或直接說「覆診記錄」「處方記錄」等
- 語氣專業簡潔，像護理同事之間的工作溝通`;
  if (isWorksheet) {
    const worksheetRecords = Array.isArray(analysisResponse.extracted_data) ? analysisResponse.extracted_data : [];
    summaryPrompt = `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張「監測工作紙」圖片。
${toneRule}

已從工作紙中提取 ${worksheetRecords.length} 筆監測記錄：
${JSON.stringify(worksheetRecords.slice(0, 30), null, 2)}

請用繁體中文：
1. 簡要列出每位院友的監測數值（床號、姓名、血壓/脈搏/血糖等，有值的才列）
2. 告知護理人員可點擊下方按鈕開啟「監測記錄核對」表單，逐筆核對並儲存
3. 如果有欄位缺失或模糊之處，提醒在表單中人手補填

直接用自然語言回答，不要返回 JSON。`;
  } else if (isPortrait) {
    summaryPrompt = matchedPatient ? `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張院友人像相片。
${toneRule}

系統已根據線索匹配到院友：${matchedPatient.中文姓氏 || ""}${matchedPatient.中文名字 || matchedPatient.中文姓名 || "未知"}（床號：${matchedPatient.床號 || "無"}，在住狀態：${matchedPatient.在住狀態 || "未知"}）

請用繁體中文：
1. 說明已識別此相片屬於該院友（顯示姓名和床號）
2. 告知護理人員可點擊下方「設為院友相片」按鈕，將此相片儲存為該院友的院友相片
3. 如果匹配可能不正確，提醒先核對院友身份

直接用自然語言回答，不要返回 JSON。` : `你是安老院舍管理系統的 AI 助護。護理人員上傳了一張院友人像相片。
${toneRule}

系統未能自動匹配到對應的院友（人像相片本身沒有文字線索）。

請用繁體中文：
1. 說明已收到人像相片，但無法確定是哪位院友
2. 請護理人員在訊息中註明院友姓名或床號，然後重新上傳相片

直接用自然語言回答，不要返回 JSON。`;
  } else if (existingRecords.length > 0) {
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
    const summaryResponse = await callGemini("你是安老院舍管理系統的 AI 助護。你的用戶是院舍的護理人員（護士/護理員），不是院友本人。回覆時必須用第三人稱稱呼院友（例如「XX院友」），絕對不要用「您好」「您的個人檔案」等直接對院友說話的語氣。語氣要專業、簡潔，像在向同事匯報。請用繁體中文做自然語言回覆，不要返回 JSON。", summaryPrompt, [], null, null, 1024);
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
  // Handle plain answer / error / refused
  if (llmResponse.type === "refused" && message && !isOutOfScopeQuestion(message)) {
    // Override LLM over-refusal: the guard didn't flag this as out-of-scope, so it should be answered
    llmResponse = {
      type: "answer",
      explanation: "我可以協助處理這個問題。請更具體描述你想查詢或操作的內容，例如「查 202-1 血壓」或「新增院友 張三」。"
    };
  }
  if (llmResponse.type === "answer" || llmResponse.type === "error" || llmResponse.type === "refused") {
    return jsonResponse({
      success: true,
      response: llmResponse
    });
  }
  // Validate SQL safety
  if (llmResponse.sql) {
    llmResponse.sql = normalizeSql(llmResponse.sql);
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
    const sanitizedData = sanitizeDataForResponse(data?.slice(0, 100)) || [];
    const summary = generateQueryResultSummary(sanitizedData, llmResponse.explanation);
    return jsonResponse({
      success: true,
      response: {
        type: "query_result",
        explanation: summary,
        data: sanitizedData,
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
      sql_statement: normalizeSql(llmResponse.sql),
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
        sql: normalizeSql(llmResponse.sql),
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
  const startTime = Date.now();
  let userCtx = null;
  let responseType = "error";
  let requestType = path === "chat" ? "chat" : path === "confirm-mutation" ? "confirm-mutation" : "unknown";
  let model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
  let durationMs = 0;
  let ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  let userAgent = req.headers.get("user-agent") || "";
  let messageText = "";

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
    userCtx = await validateToken(token);
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

    let result;
    if (path === "chat") {
      // Extract message text for logging (best effort before handler consumes body)
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        messageText = body.message || "";
        if (body.imageBase64) requestType = "image";
      } catch {
        // ignore clone/parse errors
      }
      result = await handleChat(req, userCtx);
    } else if (path === "confirm-mutation") {
      requestType = "confirm-mutation";
      result = await handleConfirmMutation(req, userCtx);
    } else if (path === "stats") {
      requestType = "stats";
      result = await handleStats(req, userCtx);
    } else {
      return jsonResponse({
        success: false,
        error: "未知端點"
      }, 404);
    }

    durationMs = Date.now() - startTime;

    // Determine response type from result body
    try {
      const bodyText = await result.clone().text();
      const body = JSON.parse(bodyText);
      if (body?.response?.type) {
        responseType = body.response.type;
      } else if (body?.success === false) {
        responseType = "error";
      }
    } catch {
      responseType = "error";
    }

    // Log usage
    await logUsage({
      userId: userCtx.userId,
      authType: userCtx.auth_type,
      userRole: userCtx.role,
      userName: userCtx.name,
      requestType,
      messageText: messageText.length > 2000 ? messageText.slice(0, 2000) : messageText,
      responseType,
      model,
      tokensUsed: null,
      durationMs,
      ipAddress,
      userAgent
    });

    return result;
  } catch (err) {
    console.error("AI Assistant error:", err);
    durationMs = Date.now() - startTime;
    if (userCtx) {
      await logUsage({
        userId: userCtx.userId,
        authType: userCtx.auth_type,
        userRole: userCtx.role,
        userName: userCtx.name,
        requestType,
        messageText: messageText.length > 2000 ? messageText.slice(0, 2000) : messageText,
        responseType: "error",
        model,
        tokensUsed: null,
        durationMs,
        ipAddress,
        userAgent
      });
    }
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
  // Fast rule-based guard for obvious non-medical / non-work questions
  if (message && isOutOfScopeQuestion(message)) {
    return jsonResponse({
      success: true,
      response: {
        type: "refused",
        explanation: "抱歉，AI 助護只回答醫療護理、安老院管理或本系統使用相關的問題。"
      }
    });
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
  } catch (err: any) {
    console.error("Gemini call error:", err);
    return jsonResponse({
      success: true,
      response: {
        type: "error",
        explanation: "AI 服務暫時無法使用，請稍後再試。"
      }
    });
  }
  // Handle plain answer / error / refused
  if (llmResponse.type === "refused" && message && !isOutOfScopeQuestion(message)) {
    // Override LLM over-refusal: the guard didn't flag this as out-of-scope, so it should be answered
    llmResponse = {
      type: "answer",
      explanation: "我可以協助處理這個問題。請更具體描述你想查詢或操作的內容，例如「查 202-1 血壓」或「新增院友 張三」。"
    };
  }
  if (llmResponse.type === "answer" || llmResponse.type === "error" || llmResponse.type === "refused") {
    return jsonResponse({
      success: true,
      response: llmResponse
    });
  }
  // Validate SQL safety
  if (llmResponse.sql) {
    llmResponse.sql = normalizeSql(llmResponse.sql);
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
    // Generate a direct answer from the returned data instead of echoing the LLM's pre-execution description
    const sanitizedData = sanitizeDataForResponse(data?.slice(0, 100)) || [];
    const summary = generateQueryResultSummary(sanitizedData, llmResponse.explanation);
    return jsonResponse({
      success: true,
      response: {
        type: "query_result",
        explanation: summary,
        data: sanitizedData,
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
      sql_statement: normalizeSql(llmResponse.sql),
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
        sql: normalizeSql(llmResponse.sql),
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
      query_text: substituteParams(normalizeSql(mutation.sql_statement), mutation.sql_params || []),
      query_params: JSON.stringify([])
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
// /stats Handler — AI 助護使用統計（僅 admin / developer 可存取）
// =====================================================
async function handleStats(req, userCtx) {
  // Only developers and admins can view usage statistics
  if (userCtx.role !== "developer" && userCtx.role !== "admin") {
    return jsonResponse({
      success: false,
      error: "沒有權限查看使用統計"
    }, 403);
  }

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const supabase = getSupabaseClient();

  // Total count in date range
  const { count: totalCount, error: totalError } = await supabase
    .from("ai_assistant_usage_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startDate.toISOString());

  if (totalError) {
    console.error("Stats total error:", totalError);
    return jsonResponse({ success: false, error: "統計查詢失敗" }, 500);
  }

  // By auth_type
  const { data: byAuthType, error: authTypeError } = await supabase.rpc("get_ai_usage_by_auth_type", {
    p_start_date: startDate.toISOString()
  });

  // By role
  const { data: byRole, error: roleError } = await supabase.rpc("get_ai_usage_by_role", {
    p_start_date: startDate.toISOString()
  });

  // By response_type
  const { data: byResponseType, error: responseTypeError } = await supabase.rpc("get_ai_usage_by_response_type", {
    p_start_date: startDate.toISOString()
  });

  // Recent logs
  const { data: recentLogs, error: logsError } = await supabase
    .from("ai_assistant_usage_logs")
    .select("id, user_id, auth_type, user_role, user_name, request_type, response_type, model, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (logsError) {
    console.error("Stats recent logs error:", logsError);
  }

  // Daily trend (fallback if RPCs don't exist)
  const { data: dailyTrend, error: dailyError } = await supabase
    .from("ai_assistant_daily_stats")
    .select("day, auth_type, response_type, count")
    .gte("day", startDate.toISOString())
    .order("day", { ascending: true });

  if (dailyError) {
    console.error("Stats daily trend error:", dailyError);
  }

  return jsonResponse({
    success: true,
    data: {
      totalCount: totalCount || 0,
      dateRange: { days, startDate: startDate.toISOString() },
      byAuthType: byAuthType || [],
      byRole: byRole || [],
      byResponseType: byResponseType || [],
      dailyTrend: dailyTrend || [],
      recentLogs: recentLogs || []
    }
  });
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
