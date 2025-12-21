import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, SwitchCamera, X, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (qrCodeId: string) => void;
  onError?: (error: string) => void;
  className?: string;
  autoStart?: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onError, className = '', autoStart = false }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [shouldStartScanning, setShouldStartScanning] = useState(autoStart);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
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
        fps: 30,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0,
        formatsToSupport: [0],
        disableFlip: false,
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: facingMode
        }
      };

      setDebugMessage('🔄 正在啟動掃描器...');

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText) => {
          if (isProcessing) return;
          
          console.log('📷 掃描到原始內容:', decodedText);
          setDebugMessage(`掃描到: ${decodedText.substring(0, 50)}...`);
          
          setIsProcessing(true);
          
          // 觸覺反饋（如果支持）
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          try {
            const qrData = JSON.parse(decodedText);
            console.log('📋 解析後的數據:', qrData);
            setDebugMessage(`解析成功: type=${qrData.type}, qr_code_id=${qrData.qr_code_id}`);
            
            if (qrData.type === 'bed' && qrData.qr_code_id) {
              console.log('✅ 有效的床位二維碼，qr_code_id:', qrData.qr_code_id);
              setDebugMessage(`✅ 有效床位碼: ${qrData.qr_code_id}`);
              
              // 成功振動
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
              
              await stopScanner();
              onScanSuccess(qrData.qr_code_id);
            } else {
              console.log('❌ 無效的床位二維碼，缺少必要字段');
              setDebugMessage('❌ 無效的床位二維碼');
              setError('這不是有效的床位二維碼');
              if (onError) {
                onError('這不是有效的床位二維碼');
              }
              setIsProcessing(false);
            }
          } catch (parseError) {
            console.error('❌ JSON 解析失敗:', parseError);
            setDebugMessage(`❌ JSON解析失敗: ${parseError}`);
            setError('無法解析二維碼資料');
            if (onError) {
              onError('無法解析二維碼資料');
            }
            setIsProcessing(false);
          }
        },
        (errorMessage) => {
          // 掃描錯誤回調（非致命錯誤）
          console.log('⚠️ 掃描錯誤:', errorMessage);
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
    setIsProcessing(false);
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
        {!shouldStartScanning && !isScanning ? (
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
          <div className="flex gap-3">
            {/* 左側：掃描器實時畫面 */}
            <div className="flex-shrink-0">
              <div id={scannerIdRef.current} className="rounded-lg overflow-hidden" style={{ width: '200px', height: '200px' }} />
            </div>

            {/* 右側：控制按鈕 */}
            <div className="flex flex-col justify-center space-y-2 flex-1">
              {debugMessage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                  <p className="text-xs text-blue-800 break-all">{debugMessage}</p>
                </div>
              )}
              
              <button
                onClick={toggleCamera}
                className="flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full"
              >
                <SwitchCamera className="h-4 w-4" />
                <span>{facingMode === 'user' ? '切換到後置' : '切換到前置'}</span>
              </button>

              <button
                onClick={stopScanner}
                className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors w-full"
              >
                停止掃描
              </button>

              {error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
