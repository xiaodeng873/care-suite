import React, { useState, useEffect } from 'react';
import { X, Download, QrCode, User } from 'lucide-react';
import QRCode from 'qrcode';
import type { Patient } from '../lib/database';

interface PatientQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const PatientQRCodeModal: React.FC<PatientQRCodeModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (patient?.qr_code_id) {
      generateQRCode(patient.qr_code_id);
    }
  }, [patient?.qr_code_id]);

  const generateQRCode = async (qrCodeId: string) => {
    try {
      // 生成 QR Code 數據（JSON 格式，與床位/用戶 QR Code 一致）
      const qrData = JSON.stringify({
        type: 'patient',
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
    if (!qrCodeDataUrl || !patient) return;

    const link = document.createElement('a');
    link.download = `patient_qrcode_${patient.床號}_${patient.中文姓名}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  if (!isOpen || !patient) return null;

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
            <h2 className="text-lg font-semibold text-gray-900">院友專屬二維碼</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 院友資訊 */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-3">
              {patient.院友相片 ? (
                <img 
                  src={patient.院友相片} 
                  alt={patient.中文姓名} 
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900">{patient.中文姓名}</h3>
            <p className="text-sm text-gray-500">床號: {patient.床號}</p>
            {patient.身份證號碼 && (
              <p className="text-sm text-gray-500">身份證: {patient.身份證號碼}</p>
            )}
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-6">
            {qrCodeDataUrl ? (
              <img 
                src={qrCodeDataUrl} 
                alt="院友二維碼" 
                className="w-64 h-64 border rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                <span className="text-gray-400">
                  {patient.qr_code_id ? '載入中...' : '無二維碼'}
                </span>
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
          </div>

          {/* 提示訊息 */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              此二維碼為院友專屬識別碼，可用於藥物工作流程中快速識別院友身份。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 生成 QR Code 縮圖的輔助函數
export const generatePatientQRCodeThumbnail = async (qrCodeId: string): Promise<string> => {
  try {
    const qrData = JSON.stringify({
      type: 'patient',
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

export default PatientQRCodeModal;
