import React from 'react';

interface HumanBodyDiagramProps {
  selectedLocation: { x: number; y: number; side: 'front' | 'back' };
  onLocationChange: (location: { x: number; y: number; side: 'front' | 'back' }) => void;
}

const HumanBodyDiagram: React.FC<HumanBodyDiagramProps> = ({
  selectedLocation,
  onLocationChange
}) => {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    
    // 固定使用 'front' 作為 side，因為只有一面
    onLocationChange({ x, y, side: 'front' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          點擊人體圖選擇傷口位置
        </h4>
      </div>

      <div className="relative bg-gray-50 rounded-lg p-6 flex justify-center">
        <div
          className="relative cursor-crosshair border border-gray-300 rounded-lg bg-white shadow-sm"
          style={{ width: '600px', height: '600px' }}
          onClick={handleClick}
        >
          {/* Background image - 放大1倍 */}
          <img
            src="/human-body-diagram.png"
            alt="人體圖"
            className="w-full h-full object-contain rounded-lg"
            style={{
              filter: 'brightness(1.1) contrast(1.1)'
            }}
          />
          
          {/* Selected location marker */}
          {selectedLocation && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${selectedLocation.x}%`,
                top: `${selectedLocation.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* Outer ring - 縮小版本 */}
              <div
                className="absolute rounded-full border-4 border-red-500 animate-pulse"
                style={{
                  width: '32px',
                  height: '32px',
                  left: '-16px',
                  top: '-16px'
                }}
              />
              {/* Inner dot - 縮小版本 */}
              <div
                className="absolute rounded-full bg-red-600"
                style={{
                  width: '8px',
                  height: '8px',
                  left: '-4px',
                  top: '-4px'
                }}
              />
              {/* Crosshair - 縮小版本 */}
              <div
                className="absolute bg-red-600"
                style={{
                  width: '24px',
                  height: '3px',
                  left: '-12px',
                  top: '-1.5px'
                }}
              />
              <div
                className="absolute bg-red-600"
                style={{
                  width: '3px',
                  height: '24px',
                  left: '-1.5px',
                  top: '-12px'
                }}
              />
            </div>
          )}
          
          {/* Grid overlay - 標準網格 */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg width="100%" height="100%" className="absolute inset-0">
              <defs>
                <pattern id="grid" width="5%" height="5%" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#9ca3af" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Location info */}
      {selectedLocation && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            <strong>已選擇傷口位置：</strong>
            座標 ({selectedLocation.x}, {selectedLocation.y})
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <p><strong>使用說明：</strong></p>
        <p>• 點擊人體圖上的任意位置來標記傷口位置</p>
        <p>• 紅色十字標記表示已選擇的傷口位置</p>
        <p>• 網格線輔助精確定位</p>
      </div>
    </div>
  );
};

export default HumanBodyDiagram;