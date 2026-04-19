import React, { useState } from 'react';
import type { PendingMutation } from '../../hooks/useAiAssistant';

interface ConfirmMutationCardProps {
  mutation: PendingMutation;
  onConfirm: (mutationId: string) => void;
  onReject: (mutationId: string) => void;
}

const typeLabels: Record<string, string> = {
  insert: '新增',
  update: '更新',
  delete: '刪除',
};

export const ConfirmMutationCard: React.FC<ConfirmMutationCardProps> = ({
  mutation,
  onConfirm,
  onReject,
}) => {
  const [showSql, setShowSql] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600 text-base">⚠️</span>
        <span className="font-medium text-sm">
          需要您確認以下{typeLabels[mutation.mutationType] || '操作'}操作
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{mutation.explanation}</p>

      <div className="text-xs text-gray-500 mb-2">
        涉及資料表：{mutation.tablesInvolved.join('、')}
      </div>

      <button
        onClick={() => setShowSql(prev => !prev)}
        className="text-xs text-blue-600 hover:text-blue-800 underline mb-2"
      >
        {showSql ? '隱藏 SQL' : '查看 SQL'}
      </button>

      {showSql && (
        <pre className="bg-gray-800 text-green-300 text-xs rounded p-2 mb-2 overflow-x-auto whitespace-pre-wrap">
          {mutation.sqlPreview}
        </pre>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(mutation.mutationId)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-3 rounded-lg transition-colors"
        >
          確認執行
        </button>
        <button
          onClick={() => onReject(mutation.mutationId)}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium py-1.5 px-3 rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
};
