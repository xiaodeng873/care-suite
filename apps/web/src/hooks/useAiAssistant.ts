import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseUrl } from '../config/supabase.config';

const AI_FUNCTION_URL = `${getSupabaseUrl()}/functions/v1/ai-assistant`;

/** 從 AuthContext 取得可用的 auth token（優先 customToken，其次 Supabase session） */
function useAuthToken() {
  const { customToken, session } = useAuth();
  return customToken || session?.access_token || null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageUrls?: string[];
  pendingMutation?: PendingMutation | null;
  prefillData?: PrefillData | null;
}

export interface PendingMutation {
  mutationId: string;
  explanation: string;
  sqlPreview: string;
  mutationType: string;
  tablesInvolved: string[];
}

export interface PrefillData {
  documentType: 'followup' | 'prescription' | 'diagnosis' | 'vaccination' | 'id_card' | 'health_worksheet' | 'portrait';
  /** 各類型的提取資料；health_worksheet 為多筆記錄陣列，其餘為物件 */
  extractedData: any;
  matchedPatient: {
    院友id: number;
    中文姓名: string;
    床號?: string;
    在住狀態?: string;
  } | null;
  /** portrait 類型專用：原始上傳圖片，用於寫入院友相片 */
  imageBase64?: string;
  imageMimeType?: string;
  /** true = 由 session 內身份證結果假設關聯的 portrait，需人手確認 */
  hypothesis?: boolean;
}

export function useAiAssistant() {
  const authToken = useAuthToken();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // session 內最近一次身份證分析結果（供後續人像相片做假設關聯）
  const lastIdCardRef = useRef<{
    matchedPatient: PrefillData['matchedPatient'];
    extractedData: Record<string, unknown>;
    imageBase64?: string;
    imageMimeType?: string;
  } | null>(null);

  const sendMessage = useCallback(async (content: string, images?: { base64: string; mimeType: string }[]) => {
    const imageList = images && images.length > 0 ? images : undefined;
    if (!content.trim() && !imageList) return;

    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim() || (imageList ? `（已上傳 ${imageList.length} 張圖片）` : ''),
      timestamp: Date.now(),
      imageUrls: imageList?.map(img => `data:${img.mimeType};base64,${img.base64}`),
    };
    setMessages(prev => [...prev, userMsg]);

    // 未登入時仍顯示用戶訊息，但立即回覆錯誤
    if (!authToken) {
      const noAuthMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '尚未登入或登入已過期，請重新登入後再試。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, noAuthMsg]);
      return;
    }

    setIsLoading(true);

    // 只傳最近 20 條給 API（控制 token 開銷）
    const recentHistory = [...messages, userMsg]
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    // 多圖時逐張送出，每張獨立分析並回覆（後端一次處理一張）
    const targets: ({ base64: string; mimeType: string } | undefined)[] = imageList ?? [undefined];
    const total = targets.length;

    try {
      for (let i = 0; i < total; i++) {
        const image = targets[i];
        const messageText = content.trim()
          || (image ? (total > 1 ? `請分析這張圖片（第 ${i + 1}/${total} 張）` : '請分析這張圖片') : '');

        const res = await fetch(`${AI_FUNCTION_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message: messageText,
            conversationHistory: recentHistory,
            ...(image ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {}),
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const resp = data.response;

        // 解析後端回應類型
        let replyText = resp?.explanation || '（無回應）';
        let mutation: PendingMutation | null = null;
        let prefill: PrefillData | null = null;

        if (resp?.type === 'query_result' && resp.data) {
          // 查詢結果：顯示摘要 + 行數
          replyText = resp.explanation || `查詢完成，共 ${resp.rowCount ?? 0} 筆結果。`;
        } else if (resp?.type === 'mutation_preview' && resp.mutationId) {
          // 寫入操作需確認
          mutation = {
            mutationId: resp.mutationId,
            explanation: resp.explanation,
            sqlPreview: resp.sql || '',
            mutationType: resp.sqlType || 'unknown',
            tablesInvolved: resp.tablesInvolved || [],
          };
          replyText = resp.explanation;
        } else if (resp?.type === 'image_analysis_result') {
          // 圖片分析結果 — 使用 prefillData 開啟表單
          replyText = resp.explanation || '圖片分析完成。';
          const insertableTypes = ['followup', 'prescription', 'diagnosis', 'vaccination'];
          if (resp.documentType && insertableTypes.includes(resp.documentType) && resp.matchedPatient) {
            prefill = {
              documentType: resp.documentType,
              extractedData: resp.extractedData || {},
              matchedPatient: resp.matchedPatient,
            };
          } else if (resp.documentType === 'id_card') {
            // 記錄 session 內最近一次身份證分析，供後續人像相片做假設關聯
            lastIdCardRef.current = {
              matchedPatient: resp.matchedPatient || null,
              extractedData: resp.extractedData || {},
              imageBase64: image?.base64,
              imageMimeType: image?.mimeType,
            };
            // 有匹配院友 → 「身份證圖留檔」動作卡；無匹配 → 開新增院友表單（身份證圖隨新增一併留檔）
            prefill = {
              documentType: 'id_card',
              extractedData: resp.extractedData || {},
              matchedPatient: resp.matchedPatient || null,
              imageBase64: image?.base64,
              imageMimeType: image?.mimeType,
            };
          } else if (resp.documentType === 'health_worksheet') {
            // 監測工作紙：多院友多筆記錄 → 開批量核對表單
            prefill = {
              documentType: 'health_worksheet',
              extractedData: Array.isArray(resp.extractedData) ? resp.extractedData : [],
              matchedPatient: null,
            };
          } else if (resp.documentType === 'portrait' && image) {
            if (resp.matchedPatient) {
              // 人像相片：已匹配院友 → 提供「設為院友相片」動作（帶上原圖 base64）
              prefill = {
                documentType: 'portrait',
                extractedData: resp.extractedData || {},
                matchedPatient: resp.matchedPatient,
                imageBase64: image.base64,
                imageMimeType: image.mimeType,
              };
            } else if (lastIdCardRef.current?.matchedPatient) {
              // 訊息無姓名/床號線索，但 session 內有已配對的身份證 → 假設關聯（需人手確認）
              prefill = {
                documentType: 'portrait',
                extractedData: resp.extractedData || {},
                matchedPatient: lastIdCardRef.current.matchedPatient,
                imageBase64: image.base64,
                imageMimeType: image.mimeType,
                hypothesis: true,
              };
            }
          }
        }

        const assistantMsg: AiMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: (total > 1 ? `【第 ${i + 1}/${total} 張】` : '') + replyText,
          timestamp: Date.now(),
          pendingMutation: mutation,
          prefillData: prefill,
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      let errorText = err.message || String(err);
      if (errorText === 'Failed to fetch' || errorText.includes('NetworkError')) {
        errorText = '無法連線到 AI 助護服務（Failed to fetch）。可能原因：網路中斷、Supabase Edge Function 未部署，或瀏覽器阻擋跨域請求。請檢查網路連線及 console 錯誤。';
      }
      const errorMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `抱歉，請求失敗：${errorText}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [authToken, messages]);

  const confirmMutation = useCallback(async (mutationId: string) => {
    if (!authToken) return;
    setIsLoading(true);

    try {
      const res = await fetch(`${AI_FUNCTION_URL}/confirm-mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ mutationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const resp = data.response;
      const resultMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `✅ ${resp?.explanation || '操作已成功執行。'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => {
        // 移除對應操作卡的 pendingMutation
        const updated = prev.map(m =>
          m.pendingMutation?.mutationId === mutationId
            ? { ...m, pendingMutation: undefined }
            : m
        );
        return [...updated, resultMsg];
      });
    } catch (err: any) {
      const errorMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ 執行失敗：${err.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  const rejectMutation = useCallback((mutationId: string) => {
    setMessages(prev => {
      const updated = prev.map(m =>
        m.pendingMutation?.mutationId === mutationId
          ? { ...m, pendingMutation: undefined }
          : m
      );
      const rejectMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '已取消此操作。',
        timestamp: Date.now(),
      };
      return [...updated, rejectMsg];
    });
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    lastIdCardRef.current = null;
    setMessages([]);
    setIsLoading(false);
  }, []);

  /** 追加一則本地 assistant 訊息（不經 API，用於操作結果回報，例如設置院友相片） */
  const addLocalMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
    }]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    confirmMutation,
    rejectMutation,
    clearMessages,
    addLocalMessage,
  };
}
