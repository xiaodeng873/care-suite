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

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-gray-700 hover:bg-gray-800 text-white rotate-0'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
        }`}
        title={isOpen ? '關閉 AI 助護' : '開啟 AI 助護'}
      >
        {isOpen ? '✕' : <NurseIcon size={32} />}
      </button>
    </Portal>
  );
};
