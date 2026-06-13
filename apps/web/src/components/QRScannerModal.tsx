import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, SwitchCamera, AlertCircle } from 'lucide-react';

type QRType = 'bed' | 'patient' | 'any';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (qrCodeId: string, qrType?: 'bed' | 'patient') => void;
  onError?: (error: string) => void;
  acceptType?: QRType;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onError,
  acceptType = 'any'
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef('qr-scanner-modal-' + Math.random().toString(36).substr(2, 9));

  const cleanupScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('清理掃描器失敗:', err);
      }
      html5QrCodeRef.current = null;
    }
  };

  const initializeScanner = async () => {
    setError(null);
    setPermissionDenied(false);

    try {
      await cleanupScanner();

      // 等待 DOM 元素渲染
      let element = null;
      let attempts = 0;
      const maxAttempts = 10;
      while (!element && attempts < maxAttempts) {
        element = document.getElementById(scannerIdRef.current);
        if (!element) {
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
        }
      }

      if (!element) {
        throw new Error(`找不到掃描器容器元素: ${scannerIdRef.current}`);
      }

      const html5QrCode = new Html5Qrcode(scannerIdRef.current);
      html5QrCodeRef.current = html5QrCode;

      // 添加樣式確保視頻填充容器
      const style = document.createElement('style');
      style.textContent = `
        #${scannerIdRef.current} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #${scannerIdRef.current} {
          line-height: 0 !important;
        }
      `;
      document.head.appendChild(style);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      setDebugMessage('🔄 正在啟動掃描器...');

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText) => {
          setDebugMessage(`掃描到: ${decodedText.substring(0, 50)}...`);

          let qrData: any;
          try {
            qrData = JSON.parse(decodedText);
            setDebugMessage(`解析成功: type=${qrData.type}, qr_code_id=${qrData.qr_code_id}`);
          } catch (parseError) {
            qrData = { type: 'bed', qr_code_id: decodedText };
            setDebugMessage(`使用純文本模式: ${decodedText}`);
          }

          const isValidBed = qrData.type === 'bed' && qrData.qr_code_id;
          const isValidPatient = qrData.type === 'patient' && qrData.qr_code_id;

          const shouldAccept = 
            (acceptType === 'any' && (isValidBed || isValidPatient)) ||
            (acceptType === 'bed' && isValidBed) ||
            (acceptType === 'patient' && isValidPatient);

          if (shouldAccept) {
            setDebugMessage(`✅ 有效${qrData.type === 'patient' ? '院友' : '床位'}碼: ${qrData.qr_code_id}`);
            await cleanupScanner();
            setIsScanning(false);
            onScanSuccess(qrData.qr_code_id, qrData.type);
            onClose();
          } else {
            const expectedType = acceptType === 'any' ? '床位或院友' : (acceptType === 'patient' ? '院友' : '床位');
            setDebugMessage(`❌ 無效的${expectedType}二維碼`);
            setError(`這不是有效的${expectedType}二維碼`);
            if (onError) {
              onError(`這不是有效的${expectedType}二維碼`);
            }
          }
        },
        (errorMessage) => {
          // 非致命錯誤，不顯示
        }
      );

      setIsScanning(true);
      setDebugMessage('✅ 掃描器已啟動，請對準二維碼');
    } catch (err: any) {
      console.error('啟動掃描器失敗:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setPermissionDenied(true);
        setError('鏡頭權限被拒絕。請在瀏覽器設定中允許使用鏡頭。');
      } else if (err.name === 'NotFoundError') {
        setError('找不到可用的鏡頭');
      } else {
        setError('無法啟動鏡頭：' + (err.message || '未知錯誤'));
      }
      if (onError) {
        onError(err.message || '無法啟動鏡頭');
      }
      setIsScanning(false);
    }
  };

  const toggleCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    if (isScanning) {
      await cleanupScanner();
      setIsScanning(false);
      setTimeout(() => {
        initializeScanner();
      }, 200);
    }
  };

  // 當模態框開啟時自動啟動掃描器
  useEffect(() => {
    if (isOpen) {
      // 延遲一下確保 DOM 已渲染
      const timer = setTimeout(() => {
        initializeScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      cleanupScanner();
      setIsScanning(false);
      setError(null);
      setDebugMessage('');
    }
  }, [isOpen, facingMode]);

  // 清理
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* 標題 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-medium text-gray-900">掃描院友二維碼</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 掃描區域 */}
        <div className="p-4">
          <div className="relative mb-4">
            <div 
              id={scannerIdRef.current} 
              className="rounded-lg overflow-hidden bg-gray-900" 
              style={{ width: '100%', height: '300px' }} 
            />
            {/* 二維碼指引框 */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-green-400 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500"></div>
                </div>
              </div>
            )}
          </div>

          {/* 控制按鈕與狀態 */}
          <div className="space-y-3">
            {debugMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <p className="text-sm text-blue-800">{debugMessage}</p>
              </div>
            )}

            <button
              onClick={toggleCamera}
              className="w-full flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <SwitchCamera className="h-4 w-4" />
              <span>{facingMode === 'user' ? '切換到後置鏡頭' : '切換到前置鏡頭'}</span>
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{error}</p>
                    {permissionDenied && (
                      <div className="mt-2 space-y-1 text-xs text-red-700">
                        <p className="font-medium">啟用鏡頭權限步驟：</p>
                        <ol className="list-decimal list-inside space-y-0.5 pl-2">
                          <li>點擊網址列左側的鎖頭圖示</li>
                          <li>找到「鏡頭」或「Camera」選項</li>
                          <li>選擇「允許」</li>
                          <li>重新整理頁面</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
