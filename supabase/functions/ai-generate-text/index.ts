import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// AI 純文字生成 Edge Function（冇圖片）：意外報告詳情、摘要等場景
// 用法：POST { prompt: string, systemInstruction?: string, fastMode?: boolean }
// 回傳：{ success: true, text } 或 { success: false, error: { code, message } }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

class APIError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "APIError";
  }
}

interface GenerateTextRequest {
  prompt: string;
  systemInstruction?: string;
  fastMode?: boolean;
}

// 呼叫 Gemini API，精準攔截各類錯誤碼（與 vision-extract 同一套映射）
async function callGemini(url: string, payload: unknown): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new APIError(502, "NETWORK_ERROR", "無法連接到 AI 服務，請檢查網路狀態後再試。");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as any;
    const errorMsg: string = errorData?.error?.message ?? "Unknown Gemini Error";
    console.error(`[Gemini] ${response.status}: ${errorMsg}`);
    const lowerMsg = errorMsg.toLowerCase();
    if (
      response.status === 400 &&
      (lowerMsg.includes("api key not valid") || lowerMsg.includes("api_key_invalid"))
    ) {
      throw new APIError(400, "GEMINI_API_KEY_INVALID", "AI 服務金鑰無效，請聯絡系統管理員。");
    }
    switch (response.status) {
      case 400:
        throw new APIError(400, "GEMINI_BAD_REQUEST", "請求格式被 AI 服務拒絕，請重試。");
      case 403:
        throw new APIError(403, "GEMINI_FORBIDDEN", "API 金鑰權限不足或已被停用，請聯絡系統管理員。");
      case 404:
        throw new APIError(500, "GEMINI_MODEL_NOT_FOUND", "找不到指定的 AI 模型，請聯絡系統管理員檢查模型設定。");
      case 429:
        throw new APIError(429, "GEMINI_QUOTA_EXCEEDED", "AI 服務請求頻率過高或配額耗盡，請稍後再試。");
      case 500:
      case 503:
        throw new APIError(502, "GEMINI_DOWN", "AI 伺服器目前異常，請稍後再試。");
      default:
        throw new APIError(response.status, "UPSTREAM_ERROR", `AI 服務回傳錯誤 (${response.status})，請稍後再試。`);
    }
  }
  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim().replace(/^["']|["']$/g, "");
    if (!apiKey) {
      throw new APIError(500, "AUTH_MISSING_KEY", "系統服務設定遺失 AI 服務金鑰，請聯絡系統管理員。");
    }
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
    const apiVersion = Deno.env.get("GEMINI_API_VERSION") ?? "v1beta";
    const geminiApiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

    let body: GenerateTextRequest;
    try {
      body = await req.json() as GenerateTextRequest;
    } catch {
      throw new APIError(400, "BAD_REQUEST", "傳入的資料格式錯誤，無法解析 JSON。");
    }
    if (!body.prompt || !body.prompt.trim()) {
      throw new APIError(400, "MISSING_PROMPT", "未收到 prompt，無法生成內容。");
    }

    const generationConfig: Record<string, unknown> = {
      temperature: 0.3,
      topK: 1,
      topP: 1,
      maxOutputTokens: 4096,
    };
    if (body.fastMode) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const geminiPayload: Record<string, unknown> = {
      contents: [{ parts: [{ text: body.prompt }] }],
      generationConfig,
    };
    if (body.systemInstruction) {
      geminiPayload.systemInstruction = { parts: [{ text: body.systemInstruction }] };
    }

    const geminiData = await callGemini(geminiApiUrl, geminiPayload);

    if (!geminiData.candidates?.[0]?.content?.parts) {
      throw new APIError(422, "EMPTY_RESPONSE", "AI 未能產生有效輸出，請稍後再試。");
    }
    const candidate = geminiData.candidates[0];
    const finishReason: string = candidate.finishReason ?? "";
    if (finishReason === "MAX_TOKENS") {
      throw new APIError(413, "RESPONSE_TRUNCATED", "AI 回應被截斷，請再試一次。");
    }
    if (finishReason === "SAFETY") {
      throw new APIError(422, "SAFETY_BLOCKED", "內容被 AI 安全過濾器攔截，請調整欄位內容後再試。");
    }

    const text = (candidate.content.parts[0].text ?? "").trim();
    if (!text) {
      throw new APIError(422, "EMPTY_RESPONSE", "AI 回應為空，請稍後再試。");
    }

    return jsonResponse({ success: true, text });
  } catch (err) {
    if (err instanceof APIError) {
      return jsonResponse({ success: false, error: { code: err.code, message: err.message } }, 200);
    }
    console.error("[ai-generate-text] unexpected:", err);
    return jsonResponse(
      { success: false, error: { code: "INTERNAL_ERROR", message: "系統內部錯誤，請稍後再試。" } },
      200,
    );
  }
});
