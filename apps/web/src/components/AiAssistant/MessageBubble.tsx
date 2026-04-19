import React from 'react';
import type { AiMessage, PrefillData } from '../../hooks/useAiAssistant';
import { ConfirmMutationCard } from './ConfirmMutationCard';
import { OpenFormCard } from './OpenFormCard';

interface MessageBubbleProps {
  message: AiMessage;
  onConfirm: (mutationId: string) => void;
  onReject: (mutationId: string) => void;
  onOpenForm: (prefillData: PrefillData) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onConfirm, onReject, onOpenForm }) => {
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
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="上傳圖片"
            className="max-w-full max-h-48 rounded-lg mb-2 cursor-pointer"
            onClick={() => window.open(message.imageUrl, '_blank')}
          />
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
          />
        )}
      </div>
    </div>
  );
};
