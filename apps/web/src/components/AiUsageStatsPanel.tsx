import React from 'react';
import { useAiUsageStats } from '../hooks/useAiUsageStats';
import { LoadingScreen } from './PageLoadingScreen';
import { Bot, RefreshCw } from 'lucide-react';

import { formatDisplayDate, formatDisplayDateTime } from '../utils/dateFormat';
interface AiUsageStatsPanelProps {
  days?: number;
}

const RESPONSE_LABELS: Record<string, string> = {
  query: '查詢',
  mutation: '寫入操作',
  answer: '純回答',
  error: '錯誤',
  refused: '非醫療拒絕',
  image_analysis: '圖片分析',
  mutation_success: '操作成功',
};

const REQUEST_LABELS: Record<string, string> = {
  chat: '文字對話',
  image: '圖片分析',
  'confirm-mutation': '確認操作',
  stats: '統計查詢',
};

const ROLE_LABELS: Record<string, string> = {
  developer: '開發者',
  admin: '管理者',
  staff: '職員',
};

const AUTH_LABELS: Record<string, string> = {
  developer: '開發者帳戶',
  project_user: '專案用戶帳戶',
};

export const AiUsageStatsPanel: React.FC<AiUsageStatsPanelProps> = ({ days = 30 }) => {
  const { stats, loading, error, refetch } = useAiUsageStats(days);

  if (loading) return <LoadingScreen pageName="AI 使用統計" />;
  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        <p>載入統計失敗：{error}</p>
        <button onClick={refetch} className="mt-2 px-3 py-1 bg-red-100 rounded hover:bg-red-200 text-sm">
          重試
        </button>
      </div>
    );
  }
  if (!stats) return null;

  const maxCount = Math.max(
    ...stats.dailyTrend.map(d => d.count),
    1
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return formatDisplayDate(d);
  };

  const renderBar = (count: number, max: number) => {
    const width = max > 0 ? `${(count / max) * 100}%` : '0%';
    return (
      <div className="w-24 h-4 bg-gray-200 rounded overflow-hidden">
        <div className="h-full bg-blue-500 rounded" style={{ width }} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" />
          AI 助護使用統計
        </h2>
        <button
          onClick={refetch}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">總使用次數（近 {days} 天）</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">日期範圍</p>
          <p className="text-lg font-medium">{formatDate(stats.dateRange.startDate)} 起</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">最近記錄</p>
          <p className="text-lg font-medium">{stats.recentLogs.length} 筆</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="font-semibold mb-3">按登入類型</h3>
          <table className="w-full text-sm">
            <tbody>
              {stats.byAuthType.map(row => (
                <tr key={row.auth_type} className="border-b last:border-0">
                  <td className="py-2">{AUTH_LABELS[row.auth_type] || row.auth_type}</td>
                  <td className="py-2 text-right font-medium">{row.count}</td>
                  <td className="py-2 pl-2">{renderBar(row.count, stats.totalCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="font-semibold mb-3">按角色</h3>
          <table className="w-full text-sm">
            <tbody>
              {stats.byRole.map(row => (
                <tr key={row.user_role} className="border-b last:border-0">
                  <td className="py-2">{ROLE_LABELS[row.user_role] || row.user_role}</td>
                  <td className="py-2 text-right font-medium">{row.count}</td>
                  <td className="py-2 pl-2">{renderBar(row.count, stats.totalCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="font-semibold mb-3">按回應類型</h3>
          <table className="w-full text-sm">
            <tbody>
              {stats.byResponseType.map(row => (
                <tr key={row.response_type} className="border-b last:border-0">
                  <td className="py-2">{RESPONSE_LABELS[row.response_type] || row.response_type || '未分類'}</td>
                  <td className="py-2 text-right font-medium">{row.count}</td>
                  <td className="py-2 pl-2">{renderBar(row.count, stats.totalCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border">
        <h3 className="font-semibold mb-3">每日趨勢</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">日期</th>
                <th className="text-left p-2">登入類型</th>
                <th className="text-left p-2">回應類型</th>
                <th className="text-right p-2">次數</th>
              </tr>
            </thead>
            <tbody>
              {stats.dailyTrend.map((row, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="p-2">{formatDate(row.day)}</td>
                  <td className="p-2">{AUTH_LABELS[row.auth_type] || row.auth_type}</td>
                  <td className="p-2">{RESPONSE_LABELS[row.response_type] || row.response_type || '未分類'}</td>
                  <td className="p-2 text-right font-medium">{row.count}</td>
                </tr>
              ))}
              {stats.dailyTrend.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">暫無資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border">
        <h3 className="font-semibold mb-3">最近使用記錄</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">時間</th>
                <th className="text-left p-2">用戶</th>
                <th className="text-left p-2">登入類型</th>
                <th className="text-left p-2">角色</th>
                <th className="text-left p-2">請求類型</th>
                <th className="text-left p-2">回應類型</th>
                <th className="text-right p-2">耗時(ms)</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map(log => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="p-2">{formatDisplayDateTime(log.created_at)}</td>
                  <td className="p-2">{log.user_name || log.user_id}</td>
                  <td className="p-2">{AUTH_LABELS[log.auth_type] || log.auth_type}</td>
                  <td className="p-2">{ROLE_LABELS[log.user_role] || log.user_role}</td>
                  <td className="p-2">{REQUEST_LABELS[log.request_type] || log.request_type}</td>
                  <td className="p-2">{RESPONSE_LABELS[log.response_type] || log.response_type || '未分類'}</td>
                  <td className="p-2 text-right">{log.duration_ms ?? '-'}</td>
                </tr>
              ))}
              {stats.recentLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">暫無資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
