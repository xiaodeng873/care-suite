import React from 'react';
import { BicepsFlexed } from 'lucide-react';

const Rehabilitation: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <BicepsFlexed className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">復康服務</h1>
        </div>
        <p className="text-gray-600">管理院友的復康服務計劃和記錄</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <BicepsFlexed className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">復康服務</h3>
          <p className="text-gray-500">復康服務功能開發中...</p>
        </div>
      </div>
    </div>
  );
};

export default Rehabilitation;
