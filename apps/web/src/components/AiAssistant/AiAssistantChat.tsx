import React, { useState, useRef, useEffect } from 'react';
import type { AiMessage, PrefillData } from '../../hooks/useAiAssistant';
import { MessageBubble } from './MessageBubble';
import { NurseIcon } from './NurseIcon';
import FollowUpModal from '../FollowUpModal';
import PrescriptionModal from '../PrescriptionModal';
import DiagnosisRecordModal from '../DiagnosisRecordModal';
import VaccinationRecordModal from '../VaccinationRecordModal';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface AiAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AiMessage[];
  isLoading: boolean;
  sendMessage: (content: string, image?: { base64: string; mimeType: string }) => void;
  confirmMutation: (mutationId: string) => void;
  rejectMutation: (mutationId: string) => void;
  clearMessages: () => void;
}

export const AiAssistantChat: React.FC<AiAssistantChatProps> = ({
  isOpen,
  onClose,
  messages,
  isLoading,
  sendMessage,
  confirmMutation,
  rejectMutation,
  clearMessages,
}) => {
  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [activeModal, setActiveModal] = useState<PrefillData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自動滾動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // 打開時聚焦輸入框
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imageData) || isLoading) return;
    sendMessage(input, imageData || undefined);
    setInput('');
    setImagePreview(null);
    setImageData(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      alert('不支援的圖片格式，請使用 JPG、PNG 或 WEBP');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert('圖片檔案過大，請選擇小於 5MB 的圖片');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Extract base64 portion (remove data:image/...;base64, prefix)
      const base64 = dataUrl.split(',')[1];
      setImageData({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageData(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > MAX_IMAGE_SIZE) {
          alert('圖片檔案過大，請選擇小於 5MB 的圖片');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setImagePreview(dataUrl);
          const base64 = dataUrl.split(',')[1];
          setImageData({ base64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleOpenForm = (prefill: PrefillData) => {
    setActiveModal(prefill);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  /** Build modal-specific props from extracted data */
  const buildFollowUpAppointment = (prefill: PrefillData) => {
    const ed = prefill.extractedData;
    const pid = prefill.matchedPatient?.院友id;
    return {
      院友id: pid,
      覆診日期: ed.覆診日期 || '',
      出發時間: ed.出發時間 || '',
      覆診時間: ed.覆診時間 || '',
      覆診地點: ed.覆診地點 || '',
      覆診專科: ed.覆診專科 || '',
      備註: ed.備註 || '',
    };
  };

  const buildPrescription = (prefill: PrefillData) => {
    const ed = prefill.extractedData;
    const pid = prefill.matchedPatient?.院友id;
    return {
      patient_id: pid,
      medication_name: ed.藥物名稱 || ed.medication_name || '',
      medication_source: ed.藥物來源 || '',
      dosage_form: ed.劑型 || '',
      administration_route: ed.服用途徑 || '',
      dosage_amount: ed.服用份量 || '',
      dosage_unit: ed.服用單位 || '',
      daily_frequency: parseInt(ed.服用次數) || 1,
      duration_days: parseInt(ed.服用日數) || undefined,
      is_prn: ed.需要時 === true || ed.需要時 === '是' || ed.PRN === true,
      notes: ed.備註 || '',
    };
  };

  const buildDiagnosisPrefill = (prefill: PrefillData) => {
    const ed = prefill.extractedData;
    return {
      patient_id: prefill.matchedPatient?.院友id,
      diagnosis_date: ed.診斷日期 || '',
      diagnosis_item: ed.診斷項目 || '',
      diagnosis_unit: ed.診斷單位 || '',
    };
  };

  const buildVaccinationPrefill = (prefill: PrefillData) => {
    const ed = prefill.extractedData;
    return {
      patient_id: prefill.matchedPatient?.院友id,
      vaccination_date: ed.疫苗接種日期 || ed.vaccination_date || '',
      vaccine_item: ed.疫苗項目 || ed.vaccine_item || '',
      vaccination_unit: ed.接種單位 || ed.vaccination_unit || '',
    };
  };

  return (
    <>
    <div
      className={`fixed bottom-20 right-6 z-[9999] w-96 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-150 origin-bottom-right ${
        isOpen
          ? 'scale-100 opacity-100 pointer-events-auto'
          : 'scale-95 opacity-0 pointer-events-none'
      }`}
      style={{ fontFamily: 'inherit' }}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <NurseIcon size={28} />
            <span className="font-semibold text-sm">AI 助護</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearMessages}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-xs"
              title="清除對話"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-xs"
              title="關閉"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-8">
              <div className="mb-3 flex justify-center"><NurseIcon size={56} /></div>
              <p className="text-sm font-medium">你好，我是 AI 助護</p>
              <p className="text-xs mt-1">可以幫你查詢資料、新增或修改記錄</p>
              <div className="mt-4 space-y-2 text-left">
                {[
                  '今天有哪些院友需要覆診？',
                  '幫我查陳先生的最新血壓記錄',
                  '📷 上傳FU紙、處方標籤自動識別',
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (q.startsWith('📷')) {
                        fileInputRef.current?.click();
                      } else {
                        setInput(q);
                        inputRef.current?.focus();
                      }
                    }}
                    className="block w-full text-left text-xs bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg px-3 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onConfirm={confirmMutation}
              onReject={rejectMutation}
              onOpenForm={handleOpenForm}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-200 px-3 py-2 bg-gray-50">
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative inline-block mb-2">
              <img
                src={imagePreview}
                alt="上傳預覽"
                className="h-20 max-w-[160px] object-cover rounded-lg border border-gray-300"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="shrink-0 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-300 rounded-lg transition-colors"
              title="上傳圖片"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={imageData ? '描述圖片內容或直接傳送...' : '輸入問題或指令...'}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
              style={{ minHeight: '38px' }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !imageData) || isLoading}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              傳送
            </button>
          </div>
        </form>
      </div>

      {/* Modal rendering based on prefill data */}
      {activeModal?.documentType === 'followup' && (
        <FollowUpModal
          appointment={buildFollowUpAppointment(activeModal) as any}
          onClose={handleCloseModal}
        />
      )}
      {activeModal?.documentType === 'prescription' && (
        <PrescriptionModal
          prescription={buildPrescription(activeModal)}
          onClose={handleCloseModal}
        />
      )}
      {activeModal?.documentType === 'diagnosis' && (
        <DiagnosisRecordModal
          patientId={activeModal.matchedPatient?.院友id}
          prefilledData={buildDiagnosisPrefill(activeModal)}
          onClose={handleCloseModal}
        />
      )}
      {activeModal?.documentType === 'vaccination' && (
        <VaccinationRecordModal
          patientId={activeModal.matchedPatient?.院友id}
          prefilledData={buildVaccinationPrefill(activeModal)}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};
