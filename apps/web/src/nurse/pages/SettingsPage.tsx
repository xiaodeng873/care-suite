import React, { useState } from 'react';
import { LogOut, User, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t2s } from '../utils/chinese';

const LOOKBACK_KEY = 'missingLookbackDays';
const DEFAULT_LOOKBACK = 7;

const SettingsPage: React.FC = () => {
  const { displayName, userProfile, customLogout } = useAuth();
  const [lookback, setLookback] = useState<number>(() => {
    const stored = localStorage.getItem(LOOKBACK_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_LOOKBACK;
  });

  const updateLookback = (val: number) => {
    const clamped = Math.max(1, Math.min(30, val));
    setLookback(clamped);
    localStorage.setItem(LOOKBACK_KEY, String(clamped));
  };

  const positionDisplay = t2s(
    userProfile?.nursing_position ||
    userProfile?.allied_health_position ||
    userProfile?.hygiene_position ||
    userProfile?.other_position ||
    userProfile?.department ||
    ''
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* 用户信息 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{t2s(displayName || '')}</p>
              {positionDisplay && (
                <p className="text-sm text-gray-500 mt-0.5">{positionDisplay}</p>
              )}
            </div>
          </div>
        </div>

        {/* 补录天数 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">补录天数</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            允许向前补录记录的最大天数（1–30 天）
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateLookback(lookback - 1)}
              disabled={lookback <= 1}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-blue-600">{lookback}</span>
              <span className="text-sm text-gray-500 ml-1">天</span>
            </div>
            <button
              onClick={() => updateLookback(lookback + 1)}
              disabled={lookback >= 30}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 登出 */}
        <button
          onClick={() => customLogout()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-100 active:bg-red-200 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          退出登录
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
