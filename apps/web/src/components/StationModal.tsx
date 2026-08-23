import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';

/** 色輪：色相 0–359°（HSL 100% 飽和、50% 明度的純色）→ hex */
function hueToHex(h: number): string {
  const x = 1 - Math.abs(((h / 60) % 2) - 1);
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [1, x, 0];
  else if (h < 120) [r, g, b] = [x, 1, 0];
  else if (h < 180) [r, g, b] = [0, 1, x];
  else if (h < 240) [r, g, b] = [0, x, 1];
  else if (h < 300) [r, g, b] = [x, 0, 1];
  else [r, g, b] = [1, 0, x];
  const to2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** hex → 色輪位置（任何顏色都可推出色相，供滑桿定位） */
function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return Math.round((h + 360) % 360);
}

interface StationModalProps {
  station?: any;
  onClose: () => void;
}

const StationModal: React.FC<StationModalProps> = ({ station, onClose }) => {
  const { addStation, updateStation } = usePatientData();

  const [formData, setFormData] = useState({
    name: station?.name || '',
    code: station?.code || '',
    description: station?.description || '',
    color: station?.color || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('請輸入居住區名稱');
      return;
    }

    try {
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase() || undefined,
        color: formData.color.trim() || undefined,
      };
      if (station) {
        await updateStation({
          ...station,
          ...payload
        });
      } else {
        await addStation(payload);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存居住區失敗:', error);
      alert('儲存居住區失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {station ? '編輯居住區' : '新增居住區'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">居住區名稱 *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-input"
              placeholder="例如：A站、B站、C站"
              required
            />
          </div>

          <div>
            <label className="form-label">居住區代號</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              className="form-input uppercase"
              placeholder="例如：A、B、C（用於合成床號顯示，如 C202-1）"
              maxLength={4}
            />
            <p className="text-xs text-gray-500 mt-1">床號顯示會以「代號＋房號－床號」合成，例如 C202-1。修改代號會自動更新該區所有床位顯示。</p>
          </div>

          <div>
            <label className="form-label">居住區描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="居住區的詳細描述或備註..."
            />
          </div>

          <div>
            <label className="form-label">代表顏色</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color: '' }))}
                className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center ${formData.color ? 'border-gray-300 text-gray-400 hover:border-gray-400' : 'border-blue-500 text-blue-500'}`}
                title="無顏色"
              >
                <X className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={formData.color ? hexToHue(formData.color) : 0}
                onChange={(e) => setFormData(prev => ({ ...prev, color: hueToHex(Number(e.target.value)) }))}
                className="hue-slider flex-1"
                title="色輪（0–359°）"
              />
              <span
                className={`w-8 h-8 shrink-0 rounded-full border-2 ${formData.color ? 'border-gray-900' : 'border-dashed border-gray-300'}`}
                style={{ backgroundColor: formData.color || 'transparent' }}
                title={formData.color || '無顏色'}
              />
              <span className="text-xs text-gray-600 w-16 shrink-0 tabular-nums">
                {formData.color ? `${hexToHue(formData.color)}° ${formData.color}` : '無顏色'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {station ? '更新居住區' : '建立居住區'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StationModal;