import React from 'react';
import { QrCode, Users, Settings } from 'lucide-react';

type TabName = 'scan' | 'patients' | 'settings';

interface BottomTabBarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const TABS: { name: TabName; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { name: 'scan', label: '扫描', Icon: QrCode },
  { name: 'patients', label: '院友', Icon: Users },
  { name: 'settings', label: '设置', Icon: Settings },
];

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => (
  <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 flex z-40 safe-area-bottom">
    {TABS.map(({ name, label, Icon }) => {
      const active = activeTab === name;
      return (
        <button
          key={name}
          onClick={() => onTabChange(name)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon className="w-6 h-6" />
          <span className="text-[11px] font-medium">{label}</span>
        </button>
      );
    })}
  </div>
);

export default BottomTabBar;
export type { TabName };
