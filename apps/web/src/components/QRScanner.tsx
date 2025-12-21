import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, SwitchCamera, X, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (qrCodeId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onError, className = '' }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef('qr-scanner-' + Math.random().toString(36).substr(2, 9));
  const [isMounted, setIsMounted] = useState(false);

  // 確保組件已掛載
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      cleanupScanner();
    };
  }, []);

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

  const startScanner = async () => {
    setError(null);
    setPermissionDenied(false);

    // 確保 DOM 元素存在
    if (!isMounted) {
      console.error('組件尚未掛載');
      return;
    }

    // 等待 DOM 更新
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await cleanupScanner();

      // 檢查 DOM 元素是否存在
      const element = document.getElementById(scannerIdRef.current);
      if (!element) {
        throw new Error(`找不到掃描器容器元素: ${scannerIdRef.current}`);
      }

      const html5QrCode = new Html5Qrcode(scannerIdRef.current);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText) => {
          try {
            const qrData = JSON.parse(decodedText);
            
            if (qrData.type === 'bed' && qrData.qr_code_id) {
              await stopScanner();
              onScanSuccess(qrData.qr_code_id);
            } else {
              setError('這不是有效的床位二維碼');
              if (onError) {
                onError('這不是有效的床位二維碼');
              }
            }
          } catch (parseError) {
            setError('無法解析二維碼資料');
            if (onError) {
              onError('無法解析二維碼資料');
            }
          }
        },
        undefined
      );

      setIsScanning(true);
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
    }
  };

  const stopScanner = async () => {
    await cleanupScanner();
    setIsScanning(false);
  };

  const toggleCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    if (isScanning) {
      await stopScanner();
      setTimeout(() => {
        startScanner();
      }, 200);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Camera className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">床位二維碼掃描</span>
        </div>
        {isScanning && (
          <button
            onClick={stopScanner}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="關閉掃描器"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-3">
        {!isScanning ? (
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={startScanner}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Camera className="h-4 w-4" />
              <span>啟動掃描器</span>
            </button>

            {error && (
              <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-red-800">{error}</p>
                    {permissionDenied && (
                      <div className="mt-2 space-y-1 text-xs text-red-700">
                        <p className="font-medium">啟用鏡頭權限步驟：</p>
                        <ol className="list-decimal list-inside space-y-0.5 pl-2">
                          <li>點擊網址列左側的鎖頭圖示</li>
                          <li>找到「鏡頭」或「Camera」選項</li>
                          <li>選擇「允許」</li>
                          <li>重新整理頁面</li>
                        </ol>
                        <p className="mt-2 text-gray-600">或使用上方的院友選擇功能來選擇院友</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div id={scannerIdRef.current} className="rounded-lg overflow-hidden border border-gray-300" />

            <div className="flex items-center justify-between">
              <button
                onClick={toggleCamera}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <SwitchCamera className="h-4 w-4" />
                <span>{facingMode === 'user' ? '切換到後置' : '切換到前置'}</span>
              </button>

              <button
                onClick={stopScanner}
                className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                停止掃描
              </button>
            </div>

            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
