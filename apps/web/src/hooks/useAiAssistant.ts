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
  imageUrl?: string;
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
  documentType: 'followup' | 'prescription' | 'diagnosis' | 'vaccination';
  extractedData: Record<string, any>;
  matchedPatient: {
    院友id: number;
    中文姓名: string;
    床號?: string;
    在住狀態?: string;
  } | null;
}

export function useAiAssistant() {
  const authToken = useAuthToken();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, image?: { base64: string; mimeType: string }) => {
    if (!content.trim() && !image) return;

    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim() || (image ? '（已上傳圖片）' : ''),
      timestamp: Date.now(),
      imageUrl: image ? `data:${image.mimeType};base64,${image.base64}` : undefined,
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

    try {
      const res = await fetch(`${AI_FUNCTION_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: content.trim() || (image ? '請分析這張圖片' : ''),
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
        }
      }

      const assistantMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        pendingMutation: mutation,
        prefillData: prefill,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const errorMsg: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `抱歉，請求失敗：${err.message}`,
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
    setMessages([]);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    confirmMutation,
    rejectMutation,
    clearMessages,
  };
}
