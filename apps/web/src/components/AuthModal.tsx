import React, { useState, useEffect, useRef } from 'react';
import { X, User, Lock, UserCircle, QrCode, Camera, SwitchCamera, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';

type LoginMode = 'password' | 'qrcode';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // QR 掃描狀態
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef('auth-qr-scanner-' + Math.random().toString(36).substr(2, 9));
  
  const { customLogin, qrLogin, signIn } = useAuth();

  // 清理掃描器
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
    setIsScanning(false);
  };

  // Modal 關閉時清理
  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setLoginMode('password');
      setUsername('');
      setPassword('');
      setError('');
      setDebugMessage('');
    }
  }, [isOpen]);

  // 切換到二維碼模式時自動啟動掃描器
  useEffect(() => {
    if (isOpen && loginMode === 'qrcode' && !isScanning) {
      startScanner();
    }
  }, [loginMode, isOpen]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 檢查是否為 email 格式（開發者登入）
      const isEmail = username.includes('@');
      
      if (isEmail) {
        // 開發者使用 Supabase Auth (Email)
        const { error } = await signIn(username, password);
        if (error) {
          setError(error.message || '登入失敗');
        } else {
          onClose();
          setUsername('');
          setPassword('');
        }
      } else {
        // 員工/管理者使用自訂認證
        const { error } = await customLogin(username, password);
        if (error) {
          setError(typeof error === 'string' ? error : '登入失敗');
        } else {
          onClose();
          setUsername('');
          setPassword('');
        }
      }
    } catch (err) {
      setError('發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleQRCodeScanned = async (qrCodeId: string) => {
    setLoading(true);
    setError('');
    setDebugMessage('正在驗證登入...');

    try {
      const { error } = await qrLogin(qrCodeId);

      if (error) {
        const errorMsg = typeof error === 'string' ? error : JSON.stringify(error);
        setError(errorMsg);
        setDebugMessage('');
        // 登入失敗後重新啟動掃描器
        setTimeout(() => {
          startScanner();
        }, 1000);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('handleQRCodeScanned error:', err);
      const errMsg = err?.message || String(err);
      setError(`發生錯誤: ${errMsg}`);
      setDebugMessage('');
      // 錯誤後重新啟動掃描器
      setTimeout(() => {
        startScanner();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setError('');
    setPermissionDenied(false);
    setDebugMessage('');

    try {
      await cleanupScanner();

      // 先設置 isScanning 為 true，讓容器元素渲染出來
      setIsScanning(true);

      // 等待 DOM 元素渲染
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let element = null;
      let attempts = 0;
      const maxAttempts = 20;
      while (!element && attempts < maxAttempts) {
        element = document.getElementById(scannerIdRef.current);
        if (!element) {
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
        }
      }

      if (!element) {
        setIsScanning(false);
        throw new Error('找不到掃描器容器元素');
      }

      const html5QrCode = new Html5Qrcode(scannerIdRef.current);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        disableFlip: false,
      };

      setDebugMessage('🔄 正在啟動掃描器...');

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText) => {
          setDebugMessage(`掃描到數據...`);

          let qrData: any;
          try {
            qrData = JSON.parse(decodedText);
          } catch {
            // 純文本格式
            qrData = { type: 'user_login', qr_code_id: decodedText };
          }

          if (qrData.type === 'user_login' && qrData.qr_code_id) {
            await cleanupScanner();
            handleQRCodeScanned(qrData.qr_code_id);
          } else {
            setError('這不是有效的用戶登入二維碼');
          }
        },
        () => {
          // 掃描錯誤回調（非致命錯誤）
        }
      );

      setDebugMessage('✅ 請將二維碼對準鏡頭');
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
      setIsScanning(false);
    }
  };

  const toggleCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    if (isScanning) {
      await cleanupScanner();
      setTimeout(() => {
        startScanner();
      }, 200);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setError('');
    setDebugMessage('');
    cleanupScanner();
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 半透明遮罩層 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl w-full max-w-md mx-4 relative z-10">
        {/* 歡迎標題區塊 */}
        <div className="p-6 pb-4 text-center border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">SeniorCare</h1>
          <p className="text-gray-600">請登入以繼續使用系統</p>
        </div>
        
        {/* 登入模式切換 */}
        <div className="px-6 pt-4">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode('password');
                resetForm();
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                loginMode === 'password'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCircle className="w-4 h-4 inline mr-1" />
              帳號密碼
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('qrcode');
                resetForm();
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                loginMode === 'qrcode'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <QrCode className="w-4 h-4 inline mr-1" />
              掃描二維碼
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loginMode === 'password' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <UserCircle className="w-4 h-4 inline mr-1" />
                  帳號
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="請輸入帳號"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  密碼
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="請輸入密碼"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '處理中...' : '登入'}
              </button>

              <div className="text-center text-sm text-gray-600">
                <p>忘記密碼或需要新帳號？</p>
                <p className="mt-1">請聯絡主管申請密碼重置</p>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {!isScanning ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
                      <p className="text-sm text-gray-500">正在啟動鏡頭...</p>
                    </div>
                  </div>
                  
                  {permissionDenied && (
                    <div className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-800">
                          <p className="font-medium">啟用鏡頭權限步驟：</p>
                          <ol className="list-decimal list-inside mt-1 space-y-0.5">
                            <li>點擊網址列左側的鎖頭圖示</li>
                            <li>找到「鏡頭」選項</li>
                            <li>選擇「允許」</li>
                            <li>重新整理頁面</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  {/* 掃描器視窗 */}
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '280px', height: '280px' }}>
                    <div 
                      id={scannerIdRef.current} 
                      className="w-full h-full [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover [&_*]:!leading-[0]"
                      style={{ lineHeight: 0, fontSize: 0 }}
                    />
                    {/* 二維碼指引框 */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-40 h-40 border-2 border-green-400 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500"></div>
                      </div>
                    </div>
                  </div>

                  {debugMessage && (
                    <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <p className="text-xs text-blue-800 text-center">{debugMessage}</p>
                    </div>
                  )}

                  <div className="flex justify-center w-full">
                    <button
                      onClick={toggleCamera}
                      className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <SwitchCamera className="h-4 w-4" />
                      <span>{facingMode === 'user' ? '後置' : '前置'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center text-sm text-gray-600 border-t pt-4">
                <p>請掃描您的用戶登入二維碼</p>
                <p className="mt-1 text-xs text-gray-500">二維碼可在用戶管理頁面查看及下載</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};