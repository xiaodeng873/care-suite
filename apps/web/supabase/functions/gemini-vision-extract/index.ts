import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 帶有重試機制的 fetch 函數
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);

    // 如果成功，或者不是 429 錯誤，直接回傳
    if (response.ok || response.status !== 429) {
      return response;
    }

    // 如果是 429，打印日誌並等待
    console.warn(`遇到 429 錯誤，正在進行第 ${i + 1} 次重試...`);

    // 如果還有重試機會，就等待後再試
    if (i < retries - 1) {
      const waitTime = backoff * (i + 1); // 指數退避：1秒, 2秒, 3秒...
      console.log(`等待 ${waitTime}ms 後重試...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  // 所有重試都失敗了，回傳最後一次的 response
  throw new Error("重試次數過多，請求失敗 (429 Rate Limit)");
}

interface GeminiVisionRequest {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  classificationPrompt?: string;
}

interface DocumentClassification {
  type: 'vaccination' | 'followup' | 'diagnosis' | 'unknown';
  confidence: number;
  reasoning?: string;
}

interface GeminiVisionResponse {
  extractedData: any;
  confidenceScores: Record<string, number>;
  classification?: DocumentClassification;
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // 安全地獲取 API Key
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("未設定 GEMINI_API_KEY 環境變量");
      return new Response(
        JSON.stringify({ success: false, error: "伺服器配置錯誤：未設定 API Key" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { imageBase64, mimeType, prompt, classificationPrompt }: GeminiVisionRequest = await req.json();

    if (!imageBase64 || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少圖片或prompt" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 使用支援視覺的 Gemini 1.5 Flash 穩定版模型
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${apiKey}`;

    const fullPrompt = `${prompt}\n\n請仔細查看圖片中的所有文字和內容，直接返回JSON格式，不要有任何其他文字說明。`;

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
    console.log("正在發送 OCR 請求...");
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
            console.log("⚠️ 警告：即將發送第二次分類請求，請確保不會觸發速率限制");

            // 在兩次請求之間加入 1 秒延遲，避免觸發速率限制
            console.log("等待 1 秒後發送分類請求...");
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

            const classificationApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${apiKey}`;

            // 使用重試機制發送第二次請求（分類文件）
            console.log("正在發送文件分類請求...");
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