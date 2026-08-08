import React from 'react';
import { X } from 'lucide-react';

interface ConfirmOverrideModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  children: React.ReactNode;
}

export const ConfirmOverrideModal: React.FC<ConfirmOverrideModalProps> = ({
  isOpen,
  title,
  onClose,
  onConfirm,
  confirmLabel = '確認',
  onSecondary,
  secondaryLabel,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-gray-700">{children}</div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            取消
          </button>
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmOverrideModal;
