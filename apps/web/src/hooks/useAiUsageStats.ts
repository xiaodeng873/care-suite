import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseUrl } from '../config/supabase.config';

const AI_FUNCTION_URL = `${getSupabaseUrl()}/functions/v1/ai-assistant`;

export interface AiUsageStats {
  totalCount: number;
  dateRange: {
    days: number;
    startDate: string;
  };
  byAuthType: { auth_type: string; count: number }[];
  byRole: { user_role: string; count: number }[];
  byResponseType: { response_type: string; count: number }[];
  dailyTrend: { day: string; auth_type: string; response_type: string; count: number }[];
  recentLogs: {
    id: string;
    user_id: string;
    auth_type: string;
    user_role: string;
    user_name: string | null;
    request_type: string;
    response_type: string;
    model: string | null;
    duration_ms: number | null;
    created_at: string;
  }[];
}

export function useAiUsageStats(days = 30) {
  const { customToken, session } = useAuth();
  const authToken = customToken || session?.access_token || null;

  const [stats, setStats] = useState<AiUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!authToken) {
      setError('尚未登入');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AI_FUNCTION_URL}/stats?days=${days}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStats(data.data);
    } catch (err: any) {
      setError(err.message || '載入統計失敗');
    } finally {
      setLoading(false);
    }
  }, [authToken, days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
