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
    // ─── 排除點一：環境變數 ────────────────────────────────────────────────────
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("[Stage 1 Failed] Missing GEMINI_API_KEY secret");
      throw new APIError(
        500,
        "AUTH_MISSING_KEY",
        "系統環境變數遺失，無法驗證 API 金鑰。請在 Supabase Dashboard → Edge Functions → Secrets 中設定 GEMINI_API_KEY。"
      );
    }

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash";
    // 自動判斷 API 版本：gemini-2.x 需要 v1beta
    const apiVersion = model.startsWith("gemini-2")
      ? "v1beta"
      : (Deno.env.get("GEMINI_API_VERSION") ?? "v1");
    const geminiApiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

    console.log(`[Stage 1] OK — model=${model}, apiVersion=${apiVersion}`);

    // ─── 排除點二：前端 Payload ────────────────────────────────────────────────
    let body: GeminiVisionRequest;
    try {
      body = await req.json() as GeminiVisionRequest;
    } catch {
      console.error("[Stage 2 Failed] Invalid JSON payload");
      throw new APIError(400, "BAD_REQUEST", "傳入的資料格式錯誤，無法解析 JSON。");
    }

    const { imageBase64, mimeType, prompt, classificationPrompt } = body;

    if (!imageBase64) {
      console.error("[Stage 2 Failed] Missing imageBase64");
      throw new APIError(400, "MISSING_IMAGE", "未收到圖片資料，無法進行辨識。");
    }
    if (!prompt) {
      console.error("[Stage 2 Failed] Missing prompt");
      throw new APIError(400, "MISSING_PROMPT", "未收到 prompt，無法進行辨識。");
    }

    const resolvedMimeType = mimeType === "image/png" ? "image/png" : "image/jpeg";

    // ─── 排除點三：呼叫 Gemini ────────────────────────────────────────────────
    console.log("[Stage 3] Initiating Gemini extraction call...");

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
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
      },
    };

    // ─── 排除點四：精準攔截 Gemini 錯誤碼（在 callGemini 內處理）──────────────
    const geminiData = await callGemini(geminiApiUrl, geminiPayload);

    if (!geminiData.candidates?.[0]?.content?.parts) {
      throw new APIError(422, "EMPTY_RESPONSE", "AI 未能產生有效輸出，圖片可能無法辨識或被安全過濾器攔截。");
    }

    const candidate = geminiData.candidates[0];
    const finishReason: string = candidate.finishReason ?? "";

    if (finishReason === "MAX_TOKENS") {
      throw new APIError(413, "RESPONSE_TRUNCATED", "資料量過大導致 AI 回應被截斷，請嘗試：1) 分批上傳（每次 2–3 張）2) 裁剪圖片去除無關部分。");
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
      throw new APIError(422, "PARSE_ERROR", "無法解析 AI 回傳的資料格式，請嘗試修改 prompt 以確保輸出為純 JSON。");
    }

    const confidenceScores: Record<string, number> = {};
    for (const key in extractedData) {
      confidenceScores[key] = extractedData[key] != null && extractedData[key] !== "" ? 0.85 : 0.0;
    }

    // ─── 可選：文件分類（第二次呼叫）─────────────────────────────────────────
    let classification: DocumentClassification | undefined;

    if (classificationPrompt) {
      try {
        await new Promise((r) => setTimeout(r, 1000));

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
        console.warn("[Classification] Non-fatal error:", classErr instanceof Error ? classErr.message : classErr);
      }
    }

    return jsonResponse({ success: true, extractedData, confidenceScores, classification });

  } catch (err) {
    const isAPIError = err instanceof APIError;
    const status = isAPIError ? err.status : 500;
    const code = isAPIError ? err.code : "INTERNAL_SERVER_ERROR";
    const message = isAPIError ? err.message : "發生未預期的系統錯誤。";

    if (!isAPIError) {
      console.error("[Unexpected Error]", err);
    }

    return new Response(
      JSON.stringify({ success: false, error: { code, message } }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
      },
    };

    // 使用重試機制發送第一次請求（提取資料）
    const geminiResponse = await fetchWithRetry(geminiApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Google Gemini API 錯誤: ${geminiResponse.status}`
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const geminiData = await geminiResponse.json();

    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts) {
      const candidate = geminiData.candidates[0];
      let responseText = candidate.content.parts[0].text;

      // 檢查是否因為長度限制而被截斷
      const finishReason = candidate.finishReason;
      if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY') {
        console.error("Response truncated, finish reason:", finishReason);
        return new Response(
          JSON.stringify({
            success: false,
            error: "資料量過大導致AI回應被截斷，請嘗試：1) 分批上傳圖片（建議每次2-3張）2) 優化圖片（裁剪不必要的部分）3) 調整Prompt以減少輸出內容"
          }),
          {
            status: 413,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const extractedData = JSON.parse(responseText);

        const confidenceScores: Record<string, number> = {};
        for (const key in extractedData) {
          if (extractedData[key] && extractedData[key] !== '') {
            confidenceScores[key] = 0.85;
          } else {
            confidenceScores[key] = 0.0;
          }
        }

        let classification: DocumentClassification | undefined;

        if (classificationPrompt) {
          try {

            // 在兩次請求之間加入 1 秒延遲，避免觸發速率限制
            await new Promise(r => setTimeout(r, 1000));

            const classificationFullPrompt = `${classificationPrompt}\n\n已提取的結構化資料：\n${JSON.stringify(extractedData, null, 2)}\n\n請根據以上資訊判斷文件類型，返回 JSON 格式：\n{\n  \"type\": \"vaccination | followup | diagnosis | unknown\",\n  \"confidence\": 0-100的數字,\n  \"reasoning\": \"簡短說明判斷理由\"\n}`;

            const classificationPayload = {
              contents: [
                {
                  parts: [
                    {
                      text: classificationFullPrompt,
                    },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 1024,
              },
            };

            const classificationApiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

            // 使用重試機制發送第二次請求（分類文件）
            const classificationResponse = await fetchWithRetry(classificationApiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(classificationPayload),
            });

            if (classificationResponse.ok) {
              const classificationData = await classificationResponse.json();
              if (classificationData.candidates && classificationData.candidates[0]?.content?.parts) {
                let classificationText = classificationData.candidates[0].content.parts[0].text;
                classificationText = classificationText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                try {
                  classification = JSON.parse(classificationText);
                } catch (e) {
                  console.error("Failed to parse classification:", e);
                }
              }
            }
          } catch (classError) {
            console.error("Classification error:", classError);
          }
        }

        const result: GeminiVisionResponse = {
          extractedData,
          confidenceScores,
          classification,
          success: true,
        };

        return new Response(JSON.stringify(result), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "\nResponse:", responseText);
        return new Response(
          JSON.stringify({
            success: false,
            error: "無法解析AI返回的資料，請嘗試修改prompt"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AI無法生成有效的輸出"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error in gemini-vision-extract function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "未知錯誤"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});