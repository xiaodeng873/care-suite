import React from 'react';
import type { AiMessage, PrefillData } from '../../hooks/useAiAssistant';
import { ConfirmMutationCard } from './ConfirmMutationCard';
import { OpenFormCard } from './OpenFormCard';

interface MessageBubbleProps {
  message: AiMessage;
  onConfirm: (mutationId: string) => void;
  onReject: (mutationId: string) => void;
  onOpenForm: (prefillData: PrefillData) => void;
  /** id_card 動作卡專用：該院友「身份證相片」存檔狀態（loading/none/has） */
  idCardPhotoStatus?: 'loading' | 'none' | 'has';
  onRetry?: (message: AiMessage) => void;
  isLoading?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onConfirm, onReject, onOpenForm, idCardPhotoStatus, onRetry, isLoading }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`mb-2 ${message.imageUrls.length > 1 ? 'flex flex-wrap gap-1.5' : ''}`}>
            {message.imageUrls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`上傳圖片 ${idx + 1}`}
                className={`${message.imageUrls!.length > 1 ? 'w-20 h-20 object-cover' : 'max-w-full max-h-48'} rounded-lg cursor-pointer`}
                onClick={() => window.open(url, '_blank')}
              />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {isUser && onRetry && (
          <button
            onClick={() => onRetry(message)}
            disabled={isLoading}
            className="mt-1 text-xs text-white/80 hover:text-white underline disabled:opacity-50 text-left"
          >
            重試
          </button>
        )}
        {message.pendingMutation && (
          <ConfirmMutationCard
            mutation={message.pendingMutation}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}
        {message.prefillData && (
          <OpenFormCard
            prefillData={message.prefillData}
            onOpenForm={onOpenForm}
            idCardPhotoStatus={idCardPhotoStatus}
          />
        )}
      </div>
    </div>
  );
};
