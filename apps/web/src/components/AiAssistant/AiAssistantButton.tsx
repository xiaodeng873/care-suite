import React, { useState } from 'react';
import { AiAssistantChat } from './AiAssistantChat';
import { useAiAssistant } from '../../hooks/useAiAssistant';
import { NurseIcon } from './NurseIcon';
import { Portal } from '../Portal';

export const AiAssistantButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const aiAssistant = useAiAssistant();

  return (
    <Portal>
      {/* Chat Window — 始終渲染，用 CSS 切換顯示（避免 mount/unmount 延遲） */}
      <AiAssistantChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        {...aiAssistant}
      />

      {/* Floating Action Button — 對話框打開時隱藏，避免遮住右下角傳送鈕 */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'hidden'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
        }`}
        title="開啟 AI 助護"
      >
        <NurseIcon size={32} />
      </button>
    </Portal>
  );
};
