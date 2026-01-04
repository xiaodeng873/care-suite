import React, { useState, useEffect, useRef } from 'react';
import { X, Download, RefreshCw, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import type { UserProfile } from '@care-suite/shared';

interface UserQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  canRegenerate: boolean;
  onRegenerate?: (userId: string) => Promise<void>;
}

export const UserQRCodeModal: React.FC<UserQRCodeModalProps> = ({
  isOpen,
  onClose,
  user,
  canRegenerate,
  onRegenerate,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [regenerating, setRegenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (user?.login_qr_code_id) {
      generateQRCode(user.login_qr_code_id);
    }
  }, [user?.login_qr_code_id]);

  const generateQRCode = async (qrCodeId: string) => {
    try {
      // 生成 QR Code 數據（JSON 格式，與床位 QR Code 一致）
      const qrData = JSON.stringify({
        type: 'user_login',
        qr_code_id: qrCodeId,
      });

      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('生成二維碼失敗:', err);
    }
  };

  const handleDownload = () => {
    if (!qrCodeDataUrl || !user) return;

    const link = document.createElement('a');
    link.download = `login_qrcode_${user.username}_${user.name_zh}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  const handleRegenerate = async () => {
    if (!user || !onRegenerate) return;

    const confirmed = window.confirm(
      `確定要重新生成「${user.name_zh}」的登入二維碼嗎？\n\n注意：舊的二維碼將無法再使用！`
    );

    if (!confirmed) return;

    setRegenerating(true);
    try {
      await onRegenerate(user.id);
    } catch (err) {
      console.error('重新生成二維碼失敗:', err);
      alert('重新生成二維碼失敗');
    } finally {
      setRegenerating(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">登入二維碼</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 用戶資訊 */}
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">{user.name_zh}</h3>
            <p className="text-sm text-gray-500">@{user.username}</p>
            <p className="text-sm text-gray-500">{user.department}</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-6">
            {qrCodeDataUrl ? (
              <img 
                src={qrCodeDataUrl} 
                alt="登入二維碼" 
                className="w-64 h-64 border rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                <span className="text-gray-400">載入中...</span>
              </div>
            )}
          </div>

          {/* 操作按鈕 */}
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleDownload}
              disabled={!qrCodeDataUrl}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <span>下載二維碼 (PNG)</span>
            </button>

            {canRegenerate && onRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? '重新生成中...' : '重新生成二維碼'}</span>
              </button>
            )}
          </div>

          {/* 提示訊息 */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              使用此二維碼可以在登入頁面掃描登入系統。
              {canRegenerate && '如需重新生成，舊的二維碼將立即失效。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 生成 QR Code 縮圖的輔助函數
export const generateQRCodeThumbnail = async (qrCodeId: string): Promise<string> => {
  try {
    const qrData = JSON.stringify({
      type: 'user_login',
      qr_code_id: qrCodeId,
    });

    return await QRCode.toDataURL(qrData, {
      width: 48,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('生成二維碼縮圖失敗:', err);
    return '';
  }
};

export default UserQRCodeModal;
