import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface ImageSourcePickerProps {
  /** 使用者選完圖片後回呼（拍照固定單張；相簿是否多選由 albumMultiple 決定） */
  onSelect: (files: File[]) => void;
  /** 相簿是否允许多選（拍照永遠單張） */
  albumMultiple?: boolean;
  /** input accept，預設 image/* */
  accept?: string;
  /** mount 後自動彈出選擇器（例如相機掃描流程進場即選來源） */
  autoOpen?: boolean;
  /** render-prop：回傳觸發區域，點擊時呼叫 openPicker() 彈出來源選擇 */
  children: (openPicker: () => void) => React.ReactNode;
}

/**
 * 統一的圖片來源選擇器：點擊觸發區後先彈出「拍照 / 相簿 / 取消」action sheet，
 * 選定來源才開對應的 hidden file input（camera 帶 capture="environment"）。
 * 所有智能識別（OCR/AI）上傳點共用此元件。
 */
const ImageSourcePicker: React.FC<ImageSourcePickerProps> = ({
  onSelect,
  albumMultiple = false,
  accept = 'image/*',
  autoOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => setOpen(true);
  const closePicker = () => setOpen(false);

  // autoOpen：mount 後自動彈出一次
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 允許重複選同一張
    setOpen(false);
    if (files.length > 0) onSelect(files);
  };

  return (
    <>
      {children(openPicker)}

      {/* 拍照（單張，原生相機） */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {/* 相簿 */}
      <input
        ref={albumInputRef}
        type="file"
        accept={accept}
        multiple={albumMultiple}
        className="hidden"
        onChange={handleChange}
      />

      {open && (
        <div
          className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-end sm:items-center justify-center"
          onClick={closePicker}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xs p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-medium text-gray-700">選擇圖片來源</span>
              <button
                type="button"
                onClick={closePicker}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                aria-label="取消"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Camera className="h-5 w-5" />
                拍照
              </button>
              <button
                type="button"
                onClick={() => albumInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
              >
                <ImageIcon className="h-5 w-5 text-gray-500" />
                相簿
              </button>
              <button
                type="button"
                onClick={closePicker}
                className="w-full px-4 py-2.5 rounded-lg text-center text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageSourcePicker;
