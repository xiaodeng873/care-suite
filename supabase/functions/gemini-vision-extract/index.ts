import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 自訂錯誤類別，攜帶 HTTP 狀態碼與機器可讀錯誤碼
class APIError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "APIError";
  }
}

interface GeminiVisionRequest {
  imageBase64: string;
  mimeType?: string;
  prompt: string;
  classificationPrompt?: string;
  fastMode?: boolean;
}

interface DocumentClassification {
  type: 'vaccination' | 'followup' | 'diagnosis' | 'unknown';
  confidence: number;
  reasoning?: string;
}

interface GeminiVisionResponse {
  success: boolean;
  extractedData?: any;
  confidenceScores?: Record<string, number>;
  classification?: DocumentClassification;
  error?: { code: string; message: string };
}

// 呼叫 Gemini API，精準攔截各類錯誤碼
async function callGemini(url: string, payload: unknown): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new APIError(502, "NETWORK_ERROR", "無法連接到 Gemini 服務，請檢查網路狀態。");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as any;
    const errorMsg: string = errorData?.error?.message ?? "Unknown Gemini Error";
    console.error(`[Stage 4 Failed] Gemini API ${response.status}: ${errorMsg}`);

    // 金鑰無效：Gemini 回 400 且訊息含 "API key not valid" / "API_KEY_INVALID"。
    // 這不是圖片或參數問題，必須明確指出是金鑰本身問題，避免誤導排錯。
    const lowerMsg = errorMsg.toLowerCase();
    if (
      response.status === 400 &&
      (lowerMsg.includes("api key not valid") || lowerMsg.includes("api_key_invalid"))
    ) {
      throw new APIError(
        400,
        "GEMINI_API_KEY_INVALID",
        "Gemini 金鑰無效：Supabase 的 GEMINI_API_KEY 與有效金鑰不符（常見原因：貼上時夾帶空白/換行、含引號、金鑰已重新產生或屬於其他專案）。"
      );
    }

    switch (response.status) {
      case 400:
        throw new APIError(400, "GEMINI_BAD_REQUEST", `請求格式被 Gemini 拒絕: ${errorMsg}`);
      case 403:
        throw new APIError(403, "GEMINI_FORBIDDEN", "API 金鑰權限不足或已被停用，請至 Google AI Studio 確認金鑰狀態。");
      case 404:
        throw new APIError(500, "GEMINI_MODEL_NOT_FOUND", `找不到指定模型或 API 版本不匹配，請檢查 GEMINI_MODEL 及 GEMINI_API_VERSION 環境變數。原始錯誤: ${errorMsg}`);
      case 429:
        throw new APIError(429, "GEMINI_QUOTA_EXCEEDED", "Gemini API 請求頻率過高或每日配額耗盡，請稍後再試。");
      case 500:
      case 503:
        throw new APIError(502, "GEMINI_DOWN", "Gemini 伺服器目前異常，請稍後再試。");
      default:
        throw new APIError(response.status, "UPSTREAM_ERROR", `上游服務錯誤 (${response.status}): ${errorMsg}`);
    }
  }

  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonResponse = (body: GeminiVisionResponse, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ─── 排除點一：環境變數 ──────────────────────────────────────────────────────
    const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim().replace(/^["']|["']$/g, "");
    if (!apiKey) {
      console.error("[Stage 1 Failed] Missing GEMINI_API_KEY secret");
      throw new APIError(
        500,
        "AUTH_MISSING_KEY",
        "系統環境變數遺失，無法驗證 API 金鑰。請在 Supabase Dashboard → Edge Functions → Secrets 中設定 GEMINI_API_KEY。"
      );
    }

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
    // 自動判斷 API 版本：可用 GEMINI_API_VERSION 覆寫，否則走 v1beta
    const apiVersion = Deno.env.get("GEMINI_API_VERSION") ?? "v1beta";
    const geminiApiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

    console.log(`[Stage 1] OK — model=${model}, apiVersion=${apiVersion}`);

    // ─── 排除點二：前端 Payload ──────────────────────────────────────────────────
    let body: GeminiVisionRequest;
    try {
      body = await req.json() as GeminiVisionRequest;
    } catch {
      console.error("[Stage 2 Failed] Invalid JSON payload");
      throw new APIError(400, "BAD_REQUEST", "傳入的資料格式錯誤，無法解析 JSON。");
    }

    const { imageBase64, mimeType, prompt, classificationPrompt, fastMode } = body;

    if (!imageBase64) {
      console.error("[Stage 2 Failed] Missing imageBase64");
      throw new APIError(400, "MISSING_IMAGE", "未收到圖片資料，無法進行辨識。");
    }
    if (!prompt) {
      console.error("[Stage 2 Failed] Missing prompt");
      throw new APIError(400, "MISSING_PROMPT", "未收到 prompt，無法進行辨識。");
    }

    const resolvedMimeType = mimeType === "image/png" ? "image/png" : "image/jpeg";

    // ─── 排除點三：呼叫 Gemini ───────────────────────────────────────────────────
    console.log("[Stage 3] Initiating Gemini extraction call...");

    // fastMode：用於儀表掃描等「簡單結構化讀取」。關閉模型 thinking 並縮小 token 上限，
    // 可大幅降低延遲（思考型 flash 模型預設會花數秒思考，對讀數字毫無幫助）。
    const generationConfig: Record<string, unknown> = {
      temperature: 0.1,
      topK: 1,
      topP: 1,
      maxOutputTokens: fastMode ? 1024 : 8192,
    };
    if (fastMode) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const geminiPayload = {
      contents: [{
        parts: [
          {
            text: `${prompt}\n\n請仔細查看圖片中的所有文字和內容，直接返回JSON格式，不要有任何其他文字說明。`,
          },
          {
            inline_data: { mime_type: resolvedMimeType, data: imageBase64 },
          },
        ],
      }],
      generationConfig,
    };

    // ─── 排除點四：精準攔截 Gemini 錯誤碼（在 callGemini 內處理）────────────────
    const geminiData = await callGemini(geminiApiUrl, geminiPayload);

    if (!geminiData.candidates?.[0]?.content?.parts) {
      throw new APIError(
        422,
        "EMPTY_RESPONSE",
        "AI 未能產生有效輸出，圖片可能無法辨識或被安全過濾器攔截。"
      );
    }

    const candidate = geminiData.candidates[0];
    const finishReason: string = candidate.finishReason ?? "";

    if (finishReason === "MAX_TOKENS") {
      throw new APIError(
        413,
        "RESPONSE_TRUNCATED",
        "資料量過大導致 AI 回應被截斷，請嘗試：1) 分批上傳（每次 2–3 張）2) 裁剪圖片去除無關部分。"
      );
    }
    if (finishReason === "SAFETY") {
      throw new APIError(422, "SAFETY_BLOCKED", "圖片內容被 AI 安全過濾器攔截，請確認圖片符合使用規範。");
    }

    let responseText: string = candidate.content.parts[0].text ?? "";
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let extractedData: Record<string, unknown>;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      console.error("[Parse Failed] Raw response:", responseText);
      throw new APIError(
        422,
        "PARSE_ERROR",
        "無法解析 AI 回傳的資料格式，請嘗試修改 prompt 以確保輸出為純 JSON。"
      );
    }

    const confidenceScores: Record<string, number> = {};
    for (const key in extractedData) {
      confidenceScores[key] =
        extractedData[key] != null && extractedData[key] !== "" ? 0.85 : 0.0;
    }

    // ─── 可選：文件分類（第二次呼叫）────────────────────────────────────────────
    let classification: DocumentClassification | undefined;

    if (classificationPrompt) {
      try {
        await new Promise((r) => setTimeout(r, 1000)); // 速率限制緩衝

        const classPrompt = `${classificationPrompt}\n\n已提取的結構化資料：\n${JSON.stringify(extractedData, null, 2)}\n\n請根據以上資訊判斷文件類型，返回 JSON 格式：\n{\n  "type": "vaccination | followup | diagnosis | unknown",\n  "confidence": 0-100的數字,\n  "reasoning": "簡短說明判斷理由"\n}`;

        const classPayload = {
          contents: [{
            parts: [
              { text: classPrompt },
              { inline_data: { mime_type: resolvedMimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 1024 },
        };

        console.log("[Stage 3b] Initiating Gemini classification call...");
        const classData = await callGemini(geminiApiUrl, classPayload);

        if (classData.candidates?.[0]?.content?.parts) {
          let classText: string = classData.candidates[0].content.parts[0].text ?? "";
          classText = classText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          classification = JSON.parse(classText) as DocumentClassification;
        }
      } catch (classErr) {
        // 分類失敗不影響主要提取結果，僅記錄
        console.warn(
          "[Classification] Non-fatal error:",
          classErr instanceof Error ? classErr.message : classErr
        );
      }
    }

    return jsonResponse({ success: true, extractedData, confidenceScores, classification });

  } catch (err) {
    const isAPIError = err instanceof APIError;
    const httpStatus = isAPIError ? err.status : 500;
    const code = isAPIError ? err.code : "INTERNAL_SERVER_ERROR";
    const message = isAPIError ? err.message : "發生未預期的系統錯誤。";

    if (!isAPIError) {
      console.error("[Unexpected Error]", err);
    }

    // 重要：一律以 HTTP 200 回傳，並把漏斗法的結構化錯誤（code + 中文 message）放在 body。
    // supabase-js 對 non-2xx 回應只會丟出通用的 "Edge Function returned a non-2xx status
    // code" 並「不解析 body」，導致前端拿不到明確失敗原因。改回 200 後，前端能直接讀到
    // { success:false, error:{ code, message } } 並顯示確定的中文原因（如 API 金鑰失效）。
    return new Response(
      JSON.stringify({ success: false, error: { code, message, httpStatus } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});