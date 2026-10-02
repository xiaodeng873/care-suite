import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';

/** 色輪：HSL → hex（飽和固定 78%，明度可調；黑字在各色上都清晰） */
function hslToHex(h: number, sPct: number, lPct: number): string {
  const s = sPct / 100, l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to2 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

const SWATCH_SAT = 78;
const DEFAULT_LIGHTNESS = 62;
/** 快速色票：色相全譜 16 色 × 明度 3 階 = 48 色 */
const SWATCH_HUES = Array.from({ length: 16 }, (_, i) => Math.round(i * (359 / 15)));
const SWATCH_LIGHTNESS = [70, 62, 54];

/** hex → HSL 分量（任何顏色都可推出色相/明度，供滑桿定位） */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: SWATCH_SAT, l: DEFAULT_LIGHTNESS };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
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

  // 飽和度 / 明度維度：色票/滑桿共用，改色相時沿用目前數值
  const [saturation, setSaturation] = useState(() =>
    station?.color ? hexToHsl(station.color).s : SWATCH_SAT
  );
  const [lightness, setLightness] = useState(() =>
    station?.color ? hexToHsl(station.color).l : DEFAULT_LIGHTNESS
  );

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
                value={formData.color ? hexToHsl(formData.color).h : 0}
                onChange={(e) => setFormData(prev => ({ ...prev, color: hslToHex(Number(e.target.value), saturation, lightness) }))}
                className="hue-slider flex-1"
                title="色相（0–359°）"
              />
              <span
                className={`w-8 h-8 shrink-0 rounded-full border-2 ${formData.color ? 'border-gray-900' : 'border-dashed border-gray-300'}`}
                style={{ backgroundColor: formData.color || 'transparent' }}
                title={formData.color || '無顏色'}
              />
              <span className="text-xs text-gray-600 w-16 shrink-0 tabular-nums">
                {formData.color ? `${hexToHsl(formData.color).h}° ${formData.color}` : '無顏色'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="w-8 shrink-0" />
              <input
                type="range"
                min={30}
                max={100}
                step={1}
                value={formData.color ? hexToHsl(formData.color).s : saturation}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setSaturation(s);
                  const hsl = formData.color ? hexToHsl(formData.color) : { h: 0, s, l: lightness };
                  setFormData(prev => ({ ...prev, color: hslToHex(hsl.h, s, hsl.l) }));
                }}
                className="flex-1"
                style={{ background: `linear-gradient(to right, ${hslToHex(formData.color ? hexToHsl(formData.color).h : 0, 30, formData.color ? hexToHsl(formData.color).l : lightness)}, ${hslToHex(formData.color ? hexToHsl(formData.color).h : 0, 100, formData.color ? hexToHsl(formData.color).l : lightness)})` }}
                title="飽和度（30–100%）"
              />
              <span className="w-8 shrink-0" />
              <span className="text-xs text-gray-600 w-16 shrink-0 tabular-nums">
                飽和 {formData.color ? hexToHsl(formData.color).s : saturation}%
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="w-8 shrink-0" />
              <input
                type="range"
                min={50}
                max={76}
                step={1}
                value={formData.color ? hexToHsl(formData.color).l : lightness}
                onChange={(e) => {
                  const l = Number(e.target.value);
                  setLightness(l);
                  const h = formData.color ? hexToHsl(formData.color).h : 0;
                  setFormData(prev => ({ ...prev, color: hslToHex(h, saturation, l) }));
                }}
                className="flex-1"
                style={{ background: 'linear-gradient(to right, #8a8a8a, #f5f5f5)' }}
                title="明度（50–76%）"
              />
              <span className="w-8 shrink-0" />
              <span className="text-xs text-gray-600 w-16 shrink-0 tabular-nums">
                明度 {formData.color ? hexToHsl(formData.color).l : lightness}%
              </span>
            </div>
            <div className="mt-2 pl-11 space-y-1.5">
              {SWATCH_LIGHTNESS.map(l => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500 w-6 shrink-0">{l === 70 ? '淺' : l === 62 ? '中' : '深'}</span>
                  {SWATCH_HUES.map(hue => {
                    const hex = hslToHex(hue, saturation, l);
                    const selected = formData.color?.toLowerCase() === hex;
                    return (
                      <button
                        key={hue}
                        type="button"
                        onClick={() => {
                          setLightness(l);
                          setFormData(prev => ({ ...prev, color: selected ? '' : hex }));
                        }}
                        className={`w-6 h-6 rounded-full border-2 ${selected ? 'border-gray-900' : 'border-gray-300 hover:border-gray-500'}`}
                        style={{ backgroundColor: hex }}
                        title={`${hue}° 飽和${saturation}% 明度${l}% ${hex}`}
                      />
                    );
                  })}
                </div>
              ))}
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