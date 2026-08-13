import React, { useState, useRef, useEffect } from 'react';
import type { AiMessage, PrefillData } from '../../hooks/useAiAssistant';
import { usePatientData } from '../../context/PatientContext';
import { MessageBubble } from './MessageBubble';
import { NurseIcon } from './NurseIcon';
import FollowUpModal from '../FollowUpModal';
import PrescriptionModal from '../PrescriptionModal';
import DiagnosisRecordModal from '../DiagnosisRecordModal';
import VaccinationRecordModal from '../VaccinationRecordModal';
import PatientModal from '../PatientModal';
import BatchHealthRecordOCRModal from '../BatchHealthRecordOCRModal';
import ImageSourcePicker from '../ImageSourcePicker';
import { supabase } from '../../lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** 把 base64 圖片壓縮為 JPEG data URL（院友相片慣例：最寬 400px、JPEG 0.85；文件留檔用 maxWidth 1200 保持可讀） */
const compressImageDataUrl = (base64: string, mimeType: string, maxWidth = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('無法獲取 Canvas 上下文'));
        return;
      }
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
};

interface PendingImage {
  preview: string;
  base64: string;
  mimeType: string;
}

const readImageFile = (file: File): Promise<PendingImage | null> => {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    alert('不支援的圖片格式，請使用 JPG、PNG 或 WEBP');
    return Promise.resolve(null);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    alert('圖片檔案過大，請選擇小於 5MB 的圖片');
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ preview: dataUrl, base64: dataUrl.split(',')[1], mimeType: file.type });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

interface AiAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AiMessage[];
  isLoading: boolean;
  sendMessage: (content: string, images?: { base64: string; mimeType: string }[]) => void;
  confirmMutation: (mutationId: string) => void;
  rejectMutation: (mutationId: string) => void;
  clearMessages: () => void;
  addLocalMessage: (content: string) => void;
}

/** 身份證相片存檔狀態：loading=查詢中、none=無存檔、has=已有存檔 */
type IdCardPhotoStatus = 'loading' | 'none' | 'has';

export const AiAssistantChat: React.FC<AiAssistantChatProps> = ({
  isOpen,
  onClose,
  messages,
  isLoading,
  sendMessage,
  confirmMutation,
  rejectMutation,
  clearMessages,
  addLocalMessage,
}) => {
  const { patients, updatePatient } = usePatientData();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [activeModal, setActiveModal] = useState<PrefillData | null>(null);
  const [isSettingPortrait, setIsSettingPortrait] = useState(false);
  const [isArchivingIdCard, setIsArchivingIdCard] = useState(false);
  // 身份證相片存檔狀態（按院友id 即時單行查詢，每位院友只查一次；此欄不在 light 查詢、無背景補載）
  const [idCardPhotoStatus, setIdCardPhotoStatus] = useState<Record<number, IdCardPhotoStatus>>({});
  const idCardPhotoQueriedRef = useRef<Set<number>>(new Set());

  // 對有 matchedPatient 的 id_card prefill，即時查一次該院友「身份證相片」欄；查詢失敗當「無存檔」處理
  useEffect(() => {
    for (const msg of messages) {
      const p = msg.prefillData;
      if (p?.documentType !== 'id_card' || !p.matchedPatient) continue;
      const pid = p.matchedPatient.院友id;
      if (idCardPhotoQueriedRef.current.has(pid)) continue;
      idCardPhotoQueriedRef.current.add(pid);
      setIdCardPhotoStatus(prev => ({ ...prev, [pid]: 'loading' }));
      (async () => {
        try {
          const { data, error } = await supabase
            .from('院友主表')
            .select('身份證相片')
            .eq('院友id', pid)
            .maybeSingle();
          // 型別層的 SQL parser 唔支援中文欄名（database.tsx 既有同款 ParserError），自行斷言
          const row = data as unknown as { 身份證相片?: string | null } | null;
          const has = !error && !!row?.身份證相片;
          setIdCardPhotoStatus(prev => ({ ...prev, [pid]: has ? 'has' : 'none' }));
        } catch {
          setIdCardPhotoStatus(prev => ({ ...prev, [pid]: 'none' }));
        }
      })();
    }
  }, [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if ((!input.trim() && images.length === 0) || isLoading) return;
    sendMessage(input, images.map(img => ({ base64: img.base64, mimeType: img.mimeType })));
    setInput('');
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  /** 把選取的圖片檔案加入待傳送佇列（readImageFile 會做格式/大小檢查） */
  const addImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const loaded = (await Promise.all(files.map(readImageFile))).filter((img): img is PendingImage => img !== null);
    if (loaded.length > 0) setImages(prev => [...prev, ...loaded]);
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    await addImageFiles(files);
  };

  const handleOpenForm = (prefill: PrefillData) => {
    if (prefill.documentType === 'portrait') {
      void handleSetPortrait(prefill);
      return;
    }
    if (prefill.documentType === 'id_card' && prefill.matchedPatient) {
      void handleArchiveIdCard(prefill);
      return;
    }
    if (prefill.documentType === 'id_card') {
      void handleOpenNewPatient(prefill);
      return;
    }
    setActiveModal(prefill);
  };

  /** 人像相片：把已上傳的圖片寫入匹配院友的「院友相片」欄位 */
  const handleSetPortrait = async (prefill: PrefillData) => {
    if (isSettingPortrait) return;
    const pid = prefill.matchedPatient?.院友id;
    const patient = pid != null ? patients.find(p => p.院友id === pid) : undefined;
    if (!patient || !prefill.imageBase64 || !prefill.imageMimeType) {
      addLocalMessage('❌ 找不到對應院友資料或原始圖片，請重新上傳再試。');
      return;
    }
    setIsSettingPortrait(true);
    try {
      const photoDataUrl = await compressImageDataUrl(prefill.imageBase64, prefill.imageMimeType);
      await updatePatient({ ...patient, 院友相片: photoDataUrl });
      addLocalMessage(`✅ 已將該相片設為${patient.中文姓名}院友的院友相片。`);
    } catch (err) {
      addLocalMessage(`❌ 更新院友相片失敗：${err instanceof Error ? err.message : '請稍後再試'}`);
    } finally {
      setIsSettingPortrait(false);
    }
  };

  /** 身份證（院友已存在）：把身份證圖壓縮後寫入該院友的「身份證相片」欄位留檔 */
  const handleArchiveIdCard = async (prefill: PrefillData) => {
    if (isArchivingIdCard) return;
    const pid = prefill.matchedPatient?.院友id;
    const patient = pid != null ? patients.find(p => p.院友id === pid) : undefined;
    if (!patient || !prefill.imageBase64 || !prefill.imageMimeType) {
      addLocalMessage('❌ 找不到對應院友資料或身份證圖片，請重新上傳再試。');
      return;
    }
    setIsArchivingIdCard(true);
    const isReplace = idCardPhotoStatus[pid!] === 'has';
    try {
      const idCardDataUrl = await compressImageDataUrl(prefill.imageBase64, prefill.imageMimeType, 1200);
      await updatePatient({ ...patient, 身份證相片: idCardDataUrl });
      setIdCardPhotoStatus(prev => ({ ...prev, [pid!]: 'has' }));
      addLocalMessage(isReplace
        ? `✅ 已更換${patient.中文姓名}的身份證相片存檔。`
        : `✅ 已將身份證圖留檔到${patient.中文姓名}的記錄。`);
    } catch (err) {
      addLocalMessage(`❌ 身份證圖留檔失敗：${err instanceof Error ? err.message : '請稍後再試'}`);
    } finally {
      setIsArchivingIdCard(false);
    }
  };

  /** 身份證（新院友）：先把身份證圖壓縮（文件用 1200px 保持可讀），再開新增院友表單 */
  const handleOpenNewPatient = async (prefill: PrefillData) => {
    if (!prefill.imageBase64 || !prefill.imageMimeType) {
      setActiveModal(prefill);
      return;
    }
    try {
      const dataUrl = await compressImageDataUrl(prefill.imageBase64, prefill.imageMimeType, 1200);
      setActiveModal({ ...prefill, imageBase64: dataUrl.split(',')[1], imageMimeType: 'image/jpeg' });
    } catch {
      // 壓縮失敗時照常開表單，只是不留檔身份證圖
      setActiveModal({ ...prefill, imageBase64: undefined, imageMimeType: undefined });
    }
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
      className={`fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-20 sm:right-6 z-[9999] sm:w-96 sm:h-[600px] sm:max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-150 origin-bottom-right ${
        isOpen
          ? 'scale-100 opacity-100 pointer-events-auto'
          : 'scale-95 opacity-0 pointer-events-none'
      }`}
      style={{ fontFamily: 'inherit', height: '90dvh', maxHeight: '90dvh', minHeight: '90dvh' }}
    >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-4 pr-12 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
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
          </div>
        </div>

        {/* 對話框右上角關閉鈕 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          title="關閉"
          aria-label="關閉"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-8">
              <div className="mb-3 flex justify-center"><NurseIcon size={56} /></div>
              <p className="text-sm font-medium">你好，我是 AI 助護</p>
              <p className="text-xs mt-1">有什麼需要幫忙？</p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onConfirm={confirmMutation}
              onReject={rejectMutation}
              onOpenForm={handleOpenForm}
              idCardPhotoStatus={
                msg.prefillData?.documentType === 'id_card' && msg.prefillData.matchedPatient
                  ? idCardPhotoStatus[msg.prefillData.matchedPatient.院友id]
                  : undefined
              }
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
          {/* Image Preview（準傳送區，可多張） */}
          {images.length > 0 && (
            <div className="mb-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img
                      src={img.preview}
                      alt={`上傳預覽 ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {images.length > 1 && (
                <p className="text-xs text-blue-600 mt-1">已選 {images.length} 張圖片，傳送後 AI 將逐張自動分類</p>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <ImageSourcePicker
              onSelect={addImageFiles}
              albumMultiple
              accept="image/jpeg,image/png,image/webp"
            >
              {(openPicker) => (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={isLoading}
                  className="shrink-0 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-300 rounded-lg transition-colors"
                  title="上傳圖片（拍照或相簿，相簿可多選）"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
              )}
            </ImageSourcePicker>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={images.length > 0 ? '描述圖片內容或直接傳送...' : '輸入問題或指令...'}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
              style={{ minHeight: '38px' }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && images.length === 0) || isLoading}
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
      {activeModal?.documentType === 'id_card' && (
        <PatientModal
          ocrPrefill={Array.isArray(activeModal.extractedData) ? {} : activeModal.extractedData}
          idCardImage={
            activeModal.imageBase64 && activeModal.imageMimeType
              ? `data:${activeModal.imageMimeType};base64,${activeModal.imageBase64}`
              : undefined
          }
          onClose={handleCloseModal}
        />
      )}
      {activeModal?.documentType === 'health_worksheet' && (
        <BatchHealthRecordOCRModal
          initialRecords={Array.isArray(activeModal.extractedData) ? activeModal.extractedData : []}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};
