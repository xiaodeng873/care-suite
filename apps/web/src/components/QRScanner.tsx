import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, SwitchCamera, X, AlertCircle } from 'lucide-react';

type QRType = 'bed' | 'patient' | 'any';

interface QRScannerProps {
  onScanSuccess: (qrCodeId: string, qrType?: 'bed' | 'patient') => void;
  onError?: (error: string) => void;
  className?: string;
  autoStart?: boolean;
  acceptType?: QRType; // 接受的二維碼類型，默認為 'any' 表示接受 bed 或 patient
  hideCameraSwitch?: boolean; // 隱藏切換鏡頭按鈕
}
const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onError, className = '', autoStart = false, acceptType = 'any', hideCameraSwitch = false }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [shouldStartScanning, setShouldStartScanning] = useState(autoStart);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef('qr-scanner-' + Math.random().toString(36).substr(2, 9));
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
      // 等待 DOM 元素渲染，最多嘗試 10 次
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
          // 靈活解析：支援 JSON 或純文本格式（與移動端一致）
          let qrData: any;
          try {
            qrData = JSON.parse(decodedText);
            setDebugMessage(`解析成功: type=${qrData.type}, qr_code_id=${qrData.qr_code_id}`);
          } catch (parseError) {
            // 如果不是 JSON，假設為直接的 QR Code ID（純文本，向後兼容床位碼）
            qrData = { type: 'bed', qr_code_id: decodedText };
            setDebugMessage(`使用純文本模式: ${decodedText}`);
          }
          
          // 檢查是否為有效的 bed 或 patient 類型二維碼
          const isValidBed = qrData.type === 'bed' && qrData.qr_code_id;
          const isValidPatient = qrData.type === 'patient' && qrData.qr_code_id;
          
          // 根據 acceptType 決定是否接受
          const shouldAccept = 
            (acceptType === 'any' && (isValidBed || isValidPatient)) ||
            (acceptType === 'bed' && isValidBed) ||
            (acceptType === 'patient' && isValidPatient);
          
          if (shouldAccept) {
            setDebugMessage(`✅ 有效${qrData.type === 'patient' ? '院友' : '床位'}碼: ${qrData.qr_code_id}`);
            await stopScanner();
            onScanSuccess(qrData.qr_code_id, qrData.type);
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
          // 掃描錯誤回調（非致命錯誤）
          // 不顯示這些錯誤，因為它們是正常的「未檢測到二維碼」消息
        }
      );
      setIsScanning(true);
      setShouldStartScanning(false);
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
      setShouldStartScanning(false);
      setIsScanning(false);
    }
  };
  const startScanner = () => {
    setShouldStartScanning(true);
  };
  const stopScanner = async () => {
    await cleanupScanner();
    setIsScanning(false);
    setShouldStartScanning(false);
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
  // 當 shouldStartScanning 變為 true 時，啟動掃描器
  useEffect(() => {
    if (shouldStartScanning && !isScanning) {
      initializeScanner();
    }
  }, [shouldStartScanning, facingMode]);
  // 清理掃描器
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <Camera className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">院友二維碼掃描</span>
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
        {!shouldStartScanning && !isScanning ? (
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={startScanner}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex flex-wrap items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              <span>啟動掃描器</span>
            </button>
            {error && (
              <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
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
          <div className="flex flex-col gap-2">
            {/* 掃描器實時畫面 */}
            <div className="relative">
              <div id={scannerIdRef.current} className="rounded-lg overflow-hidden" style={{ width: '240px', height: '427px', aspectRatio: '9/16' }} />
              {/* 二維碼指引框 */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-32 border-2 border-green-400 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500"></div>
                </div>
              </div>
            </div>
            {debugMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <p className="text-xs text-blue-800 break-all">{debugMessage}</p>
              </div>
            )}
            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <div className="flex items-start gap-2">
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
