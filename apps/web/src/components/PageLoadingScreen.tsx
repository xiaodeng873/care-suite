import React, { useEffect, useState } from 'react';
import {
  getFacilitySettings,
  type FacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
} from '../utils/facilitySettings';

interface PageLoadingScreenProps {
  /** 頁面名稱，顯示在加載畫面中 */
  pageName?: string;
  /** 是否顯示加載畫面 */
  isLoading: boolean;
  /** 加載完成後要顯示的內容 */
  children: React.ReactNode;
  /** 最短顯示時間（毫秒），確保加載畫面不會閃現 */
  minDisplayTime?: number;
  /** 廣告內容（預留位置，目前顯示佔位符） */
  adContent?: React.ReactNode;
}

// 導出獨立的加載畫面組件供簡單使用
export interface LoadingScreenProps {
  pageName?: string;
  progress?: number;
  adContent?: React.ReactNode;
}

// 廣告佔位符組件 - 未來可以替換為真實廣告
const AdPlaceholder: React.FC = () => {
  const [currentTip, setCurrentTip] = useState(0);
  
  // 健康小貼士輪播（作為廣告佔位內容）
  const healthTips = [
    {
      title: '健康提示',
      content: '定期運動可以提高免疫力，建議每天進行30分鐘的輕度運動。',
      icon: '💪'
    },
    {
      title: '營養建議',
      content: '每日攝取足夠的蔬果，有助於維持身體健康。',
      icon: '🥗'
    },
    {
      title: '護理知識',
      content: '保持良好的睡眠習慣，每晚7-8小時的睡眠對健康至關重要。',
      icon: '😴'
    },
    {
      title: '預防提醒',
      content: '勤洗手是預防感染的最有效方法之一。',
      icon: '🧼'
    },
    {
      title: '心理健康',
      content: '保持積極的心態，適當的社交活動有助於心理健康。',
      icon: '😊'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % healthTips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const tip = healthTips[currentTip];

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-100 max-w-md mx-auto">
      <div className="flex items-center gap-4">
        <div className="text-4xl">{tip.icon}</div>
        <div>
          <h3 className="font-semibold text-blue-700 text-lg mb-1">{tip.title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{tip.content}</p>
        </div>
      </div>
      {/* 廣告標記 */}
      <div className="mt-4 pt-3 border-t border-blue-100">
        <p className="text-xs text-gray-400 text-center">廣告位置 (Ad Space)</p>
      </div>
    </div>
  );
};

// 院舍品牌區塊：從 facility_settings 讀取院舍名稱與 logo
const BrandBlock: React.FC<{ pageName?: string }> = ({ pageName = '頁面' }) => {
  const [settings, setSettings] = useState<FacilitySettings>(DEFAULT_FACILITY_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    getFacilitySettings()
      .then(s => { if (!cancelled) setSettings(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4 overflow-hidden">
        {settings.logoDataUri ? (
          <img src={settings.logoDataUri} alt="院舍logo" className="w-full h-full object-contain" />
        ) : (
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        )}
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        {settings.facilityNameZh || settings.facilityNameEn || DEFAULT_FACILITY_SETTINGS.facilityNameZh}
      </h1>
      <p className="text-gray-500">正在載入 {pageName}...</p>
    </div>
  );
};

// 進度條組件
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-center text-sm text-gray-500 mt-2">{Math.round(progress)}%</p>
    </div>
  );
};

const PageLoadingScreen: React.FC<PageLoadingScreenProps> = ({
  pageName = '頁面',
  isLoading,
  children,
  minDisplayTime = 800,
  adContent
}) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const [progress, setProgress] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!isLoading);

  // 當開始加載時記錄時間
  useEffect(() => {
    if (isLoading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
      setShowLoading(true);
      setProgress(0);
      setDataLoaded(false);
    }
  }, [isLoading, loadingStartTime]);

  // 模擬進度條增長
  useEffect(() => {
    if (!showLoading) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        // 如果數據還沒加載完，進度最多到85%
        if (!dataLoaded) {
          return Math.min(prev + Math.random() * 15, 85);
        }
        // 數據加載完後快速完成
        return Math.min(prev + 10, 100);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [showLoading, dataLoaded]);

  // 當數據加載完成時
  useEffect(() => {
    if (!isLoading && loadingStartTime) {
      setDataLoaded(true);
      setProgress(100);
      
      const elapsed = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);
      
      // 確保最短顯示時間
      const timer = setTimeout(() => {
        setShowLoading(false);
        setLoadingStartTime(null);
      }, remainingTime + 300); // 額外300ms讓進度條完成動畫
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStartTime, minDisplayTime]);

  // 初始狀態：如果不是加載中，直接顯示內容
  useEffect(() => {
    if (!isLoading && !loadingStartTime) {
      setShowLoading(false);
      setDataLoaded(true);
    }
  }, [isLoading, loadingStartTime]);

  if (showLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="w-full max-w-lg px-6">
          {/* Logo/品牌區域 */}
          <BrandBlock pageName={pageName} />

          {/* 廣告區域 */}
          <div className="mb-8">
            {adContent || <AdPlaceholder />}
          </div>

          {/* 進度條 */}
          <ProgressBar progress={progress} />

          {/* 載入動畫 */}
          <div className="flex justify-center mt-6">
            <div className="flex flex-wrap gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// 獨立的加載畫面組件 - 用於替換現有的簡單 loading 狀態
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  pageName = '頁面',
  progress: externalProgress,
  adContent
}) => {
  const [internalProgress, setInternalProgress] = useState(0);
  const progress = externalProgress ?? internalProgress;

  // 如果沒有外部進度，自動模擬進度
  useEffect(() => {
    if (externalProgress !== undefined) return;
    
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 85) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [externalProgress]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-lg px-6">
        {/* Logo/品牌區域 */}
        <BrandBlock pageName={pageName} />

        {/* 廣告區域 */}
        <div className="mb-8">
          {adContent || <AdPlaceholder />}
        </div>

        {/* 進度條 */}
        <ProgressBar progress={progress} />

        {/* 載入動畫 */}
        <div className="flex justify-center mt-6">
          <div className="flex flex-wrap gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageLoadingScreen;
