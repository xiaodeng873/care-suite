import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_GEMINI_API_KEY = "AIzaSyDz_Rcu5Vm_D__-bkIKAvfGVUOlhcy855o";

interface GeminiRequest {
  ocrText: string;
  prompt: string;
  classificationPrompt?: string;
}

interface DocumentClassification {
  type: 'vaccination' | 'followup' | 'diagnosis' | 'unknown';
  confidence: number;
  reasoning?: string;
}

interface GeminiResponse {
  extractedData: any;
  confidenceScores: Record<string, number>;
  classification?: DocumentClassification;
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ocrText, prompt, classificationPrompt }: GeminiRequest = await req.json();

    if (!ocrText || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少OCR文字或prompt" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 使用 Gemini 1.5 Flash 穩定版模型
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${GOOGLE_GEMINI_API_KEY}`;

    const fullPrompt = `${prompt}\n\n以下是OCR識別的文字：\n${ocrText}\n\n請直接返回JSON格式，不要有任何其他文字說明。`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt,
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

    const geminiResponse = await fetch(geminiApiUrl, {
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
            const classificationFullPrompt = `${classificationPrompt}\n\nOCR 原始文字：\n${ocrText}\n\n已提取的結構化資料：\n${JSON.stringify(extractedData, null, 2)}\n\n請根據以上資訊判斷文件類型，返回 JSON 格式：\n{\n  \"type\": \"vaccination | followup | diagnosis | unknown\",\n  \"confidence\": 0-100的數字,\n  \"reasoning\": \"簡短說明判斷理由\"\n}`;

            const classificationPayload = {
              contents: [
                {
                  parts: [
                    {
                      text: classificationFullPrompt,
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

            const classificationResponse = await fetch(geminiApiUrl, {
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

        const result: GeminiResponse = {
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
    console.error("Error in gemini-extract function:", error);
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