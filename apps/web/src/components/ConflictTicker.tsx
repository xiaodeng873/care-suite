import React, { useRef, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface TickerItem {
  id: string;
  text: React.ReactNode;
  onClick?: () => void;
}

export interface ConflictTickerProps {
  items: TickerItem[];
}

export const ConflictTicker: React.FC<ConflictTickerProps> = ({ items }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [key, setKey] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKey((k) => k + 1);
  }, [items.length]);

  if (items.length === 0) return null;

  const duration = Math.max(20, items.length * 6);

  return (
    <div
      className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <style>{`
        @keyframes conflict-marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
      <div className="flex-1 overflow-hidden relative h-5">
        <div
          key={key}
          ref={trackRef}
          className="flex gap-8 whitespace-nowrap absolute right-0"
          style={{
            animation: `conflict-marquee ${duration}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {[...items, ...items].map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={item.onClick}
              className="text-sm text-red-700 hover:text-red-900 hover:underline flex-shrink-0"
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConflictTicker;
