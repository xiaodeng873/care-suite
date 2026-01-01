import React, { useState } from 'react';
import { X, User, Lock, Mail, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type LoginMode = 'developer' | 'staff';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('staff');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn, signUp, customLogin } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (loginMode === 'developer') {
        // 開發者使用 Supabase Auth (Email)
        const { error } = isSignUp 
          ? await signUp(email, password)
          : await signIn(email, password);

        if (error) {
          setError(error.message);
        } else {
          onClose();
          setEmail('');
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

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            {isSignUp ? '註冊帳號' : '登入系統'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 登入模式切換 */}
        {!isSignUp && (
          <div className="px-6 pt-4">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('staff');
                  resetForm();
                }}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  loginMode === 'staff'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserCircle className="w-4 h-4 inline mr-1" />
                員工登入
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('developer');
                  resetForm();
                }}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  loginMode === 'developer'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Mail className="w-4 h-4 inline mr-1" />
                開發者登入
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loginMode === 'developer' || isSignUp ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                電子郵件
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入電子郵件"
                required
              />
            </div>
          ) : (
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
          )}

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
            {loading ? '處理中...' : (isSignUp ? '註冊' : '登入')}
          </button>

          {loginMode === 'developer' && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                {isSignUp ? '已有帳號？點此登入' : '沒有帳號？點此註冊'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};