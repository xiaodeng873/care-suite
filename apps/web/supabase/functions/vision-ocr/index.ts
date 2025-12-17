import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VisionRequest {
  imageContent: string;
}

interface VisionResponse {
  text: string;
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

    const { imageContent }: VisionRequest = await req.json();

    if (!imageContent) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少圖片資料" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const visionPayload = {
      requests: [
        {
          image: {
            content: imageContent,
          },
          features: [
            {
              type: "TEXT_DETECTION",
            },
          ],
        },
      ],
    };

    const visionResponse = await fetch(visionApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(visionPayload),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error("Vision API error:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Google Vision API 錯誤: ${visionResponse.status}` 
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

    const visionData = await visionResponse.json();

    if (visionData.responses && visionData.responses[0]?.textAnnotations) {
      const detectedText = visionData.responses[0].textAnnotations[0]?.description || "";
      
      const result: VisionResponse = {
        text: detectedText,
        success: true,
      };

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "無法從圖片中識別文字" 
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
    console.error("Error in vision-ocr function:", error);
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