import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setSaving(false);
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: 'error', text: '請輸入現有密碼' });
      return;
    }
    if (!newPassword) {
      setMessage({ type: 'error', text: '請輸入新密碼' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '新密碼長度至少需要 6 個字元' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '兩次輸入的新密碼不一致' });
      return;
    }

    setSaving(true);
    const { error } = await changePassword(currentPassword, newPassword);
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: typeof error === 'string' ? error : '密碼重設失敗' });
      return;
    }

    setMessage({ type: 'success', text: '密碼已成功更新' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const renderPasswordInput = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    setVisible: (value: boolean) => void,
    placeholder?: string
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">重設密碼</h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {message && (
            <div
              className={`text-sm px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {renderPasswordInput(
            'current-password',
            '現有密碼',
            currentPassword,
            setCurrentPassword,
            showCurrent,
            setShowCurrent,
            '請輸入現有密碼'
          )}

          {renderPasswordInput(
            'new-password',
            '新密碼',
            newPassword,
            setNewPassword,
            showNew,
            setShowNew,
            '至少 6 個字元'
          )}

          {renderPasswordInput(
            'confirm-password',
            '確認新密碼',
            confirmPassword,
            setConfirmPassword,
            showConfirm,
            setShowConfirm,
            '再次輸入新密碼'
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '確認重設'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
