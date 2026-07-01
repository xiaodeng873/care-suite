import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import {
  getMedicationSettings,
  saveMedicationSettings,
  resetMedicationSettings,
  DEFAULT_MEDICATION_SETTINGS,
  type MedicationSettingsData,
} from '../utils/medicationSettings';

type StringKey = Exclude<keyof MedicationSettingsData, '每日次數'>;

const STRING_FIELDS: { key: StringKey; label: string; section: '服用資訊' | '服用資訊' }[] = [
  { key: '劑型', label: '劑型', section: '服用資訊' },
  { key: '服用途徑', label: '服用途徑', section: '服用資訊' },
  { key: '服用單位', label: '服用單位（份量）', section: '服用資訊' },
  { key: '特殊用法', label: '特殊用法', section: '服用資訊' },
  { key: '服用時段', label: '服用時段', section: '服用資訊' },
];

const MedicationSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<MedicationSettingsData>(getMedicationSettings);
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [newFreq, setNewFreq] = useState('');
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // reload from storage on mount
  useEffect(() => {
    setSettings(getMedicationSettings());
  }, []);

  const handleSave = () => {
    try {
      saveMedicationSettings(settings);
      setMessage({ type: 'success', text: '藥物設定已儲存' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setMessage({ type: 'error', text: '儲存失敗' });
    }
  };

  const handleReset = () => {
    if (!confirm('確定要重設所有藥物設定為預設值嗎？')) return;
    const defaults = resetMedicationSettings();
    setSettings(defaults);
    setMessage({ type: 'success', text: '已重設為預設值（尚未儲存）' });
  };

  // ── String list helpers ──────────────────────────────────────────────────
  const removeStringItem = (key: StringKey, idx: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== idx),
    }));
  };

  const addStringItem = (key: StringKey) => {
    const val = (newValues[key] ?? '').trim();
    if (!val) return;
    if (settings[key].includes(val)) {
      setMessage({ type: 'error', text: `「${val}」已存在` });
      return;
    }
    setSettings(prev => ({ ...prev, [key]: [...prev[key], val] }));
    setNewValues(prev => ({ ...prev, [key]: '' }));
    setMessage(null);
  };

  // ── Number list helpers ──────────────────────────────────────────────────
  const removeFreqItem = (val: number) => {
    setSettings(prev => ({ ...prev, 每日次數: prev.每日次數.filter(n => n !== val) }));
  };

  const addFreqItem = () => {
    const n = parseInt(newFreq);
    if (isNaN(n) || n < 1 || n > 24) {
      setMessage({ type: 'error', text: '請輸入 1–24 的整數' });
      return;
    }
    if (settings.每日次數.includes(n)) {
      setMessage({ type: 'error', text: `「${n}」已存在` });
      return;
    }
    setSettings(prev => ({
      ...prev,
      每日次數: [...prev.每日次數, n].sort((a, b) => a - b),
    }));
    setNewFreq('');
    setMessage(null);
  };

  const freqLabel = (n: number) => {
    const labels: Record<number, string> = { 1: 'QD', 2: 'BD', 3: 'TDS', 4: 'QID' };
    return labels[n] ? `${labels[n]} (每日${n}次)` : `每日${n}次`;
  };

  const renderStringList = (key: StringKey, label: string) => (
    <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">{label}</h4>
      <div className="flex flex-wrap gap-2 mb-3">
        {settings[key].map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
          >
            {item}
            <button
              type="button"
              onClick={() => removeStringItem(key, idx)}
              className="text-gray-400 hover:text-red-500 transition-colors ml-1"
              title="刪除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        {settings[key].length === 0 && (
          <span className="text-xs text-gray-400 italic">（清單為空）</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newValues[key] ?? ''}
          onChange={e => setNewValues(prev => ({ ...prev, [key]: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStringItem(key); } }}
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`新增${label}項目`}
        />
        <button
          type="button"
          onClick={() => addStringItem(key)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          新增
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 標題 + 操作按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">藥物設定</h3>
          <p className="text-sm text-gray-500 mt-0.5">管理處方管理中各下拉選單的可選項目</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            重設預設值
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            儲存設定
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-sm ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* 服用資訊 */}
      <div>
        <h3 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          服用資訊
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STRING_FIELDS.map(({ key, label }) => renderStringList(key, label))}
        </div>
      </div>

      {/* 服用頻率 */}
      <div>
        <h3 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          服用頻率
        </h3>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">每日服用次數</h4>
          <p className="text-xs text-gray-400 mb-3">QD / BD / TDS / QID 等標籤由系統自動對應，不影響業務邏輯</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.每日次數.sort((a, b) => a - b).map(n => (
              <span
                key={n}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
              >
                {freqLabel(n)}
                <button
                  type="button"
                  onClick={() => removeFreqItem(n)}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                  title="刪除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            {settings.每日次數.length === 0 && (
              <span className="text-xs text-gray-400 italic">（清單為空）</span>
            )}
          </div>
          <div className="flex gap-2 max-w-xs">
            <input
              type="number"
              min={1}
              max={24}
              value={newFreq}
              onChange={e => setNewFreq(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFreqItem(); } }}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="次數"
            />
            <button
              type="button"
              onClick={addFreqItem}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              新增
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        ※ 設定儲存於本機瀏覽器（localStorage）。更改後需點擊「儲存設定」才會生效，並於重新開啟處方視窗時套用。
      </p>
    </div>
  );
};

export default MedicationSettingsPanel;
