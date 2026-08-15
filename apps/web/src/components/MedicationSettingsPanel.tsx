import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripVertical, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import {
  getMedicationSettings,
  getMedicationSettingsFromDB,
  saveMedicationSettingsToDB,
  resetMedicationSettings,
  DEFAULT_MEDICATION_SETTINGS,
  INSTITUTION_GROUPS,
  type MedicationSettingsData,
} from '../utils/medicationSettings';

type StringKey = Exclude<keyof MedicationSettingsData, '每日次數' | '機構簡稱' | '專科簡稱'>;
type AbbrKey = '機構簡稱' | '專科簡稱';

// 邊啲清單要有「英文簡稱」欄：醫管局三個機構組 + 專科
const ABBR_KEY_MAP: Partial<Record<StringKey, AbbrKey>> = {
  機構_醫管局醫院: '機構簡稱',
  機構_醫管局門診: '機構簡稱',
  機構_醫管局精神科: '機構簡稱',
  專科: '專科簡稱',
};

const STRING_FIELDS: { key: StringKey; label: string }[] = [
  { key: '劑型', label: '劑型' },
  { key: '服用途徑', label: '服用途徑' },
  { key: '服用單位', label: '服用單位（份量）' },
  { key: '特殊用法', label: '特殊用法' },
  { key: '服用時段', label: '服用時段' },
];

const SOURCE_FIELDS: { key: StringKey; label: string }[] = [
  ...INSTITUTION_GROUPS.map(g => ({ key: g.key as StringKey, label: g.label })),
  { key: '專科' as StringKey, label: '醫管局專科' },
];

const MedicationSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<MedicationSettingsData>(getMedicationSettings);
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [newFreq, setNewFreq] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dragKey = useRef<string | null>(null);
  const dragIdx = useRef<number>(-1);

  useEffect(() => {
    getMedicationSettingsFromDB().then(s => setSettings(s)).catch(() => {});
  }, []);

  // 用戶操作（新增/刪除/重設/排序）後主動儲存，不在每次 state 變更自動儲存
  const persistSettings = useCallback(async (nextSettings: MedicationSettingsData, successText = '藥物設定已儲存至資料庫') => {
    setSettings(nextSettings);
    setSaving(true);
    setMessage(null);
    try {
      await saveMedicationSettingsToDB(nextSettings);
      console.log('[MedicationSettingsPanel] saved to DB:', successText);
      setMessage({ type: 'success', text: successText });
    } catch (e: any) {
      console.error('[MedicationSettingsPanel] save failed:', e);
      setMessage({ type: 'error', text: e?.message ?? '儲存失敗' });
    } finally {
      setSaving(false);
    }
  }, []);

  const handleReset = () => {
    if (!confirm('確定要重設所有藥物設定為預設值嗎？')) return;
    const defaults = resetMedicationSettings();
    persistSettings(defaults, '已重設為預設值並儲存至資料庫');
  };

  // ── drag helpers ─────────────────────────────────────────────────────────
  const dragSettingsRef = useRef<MedicationSettingsData | null>(null);
  const onDragStart = (key: string, idx: number) => {
    dragKey.current = key;
    dragIdx.current = idx;
  };
  const onDragOver = (e: React.DragEvent, key: string, idx: number) => {
    e.preventDefault();
    if (dragKey.current !== key || dragIdx.current === idx) return;
    const from = dragIdx.current;
    let nextSettings: MedicationSettingsData | null = null;
    setSettings(prev => {
      const arr = [...(prev[key as StringKey] as string[])];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      nextSettings = { ...prev, [key]: arr };
      return nextSettings;
    });
    if (nextSettings) dragSettingsRef.current = nextSettings;
    dragIdx.current = idx;
  };
  const onDragEnd = () => {
    if (dragSettingsRef.current) {
      persistSettings(dragSettingsRef.current, '排序已儲存至資料庫');
      dragSettingsRef.current = null;
    }
    dragKey.current = null;
    dragIdx.current = -1;
  };

  // ── string list helpers ───────────────────────────────────────────────────
  const removeStringItem = (key: StringKey, idx: number) => {
    const nextSettings = { ...settings, [key]: (settings[key] as string[]).filter((_, i) => i !== idx) };
    persistSettings(nextSettings, '藥物設定已儲存至資料庫');
  };
  const addStringItem = (key: StringKey) => {
    const raw = (newValues[key] ?? '').trim();
    if (!raw) return;
    const list = settings[key] as string[];
    const toAdd = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const dupes = toAdd.filter(v => list.includes(v));
    if (dupes.length) { setMessage({ type: 'error', text: `已存在：${dupes.join('、')}` }); return; }
    const nextSettings = { ...settings, [key]: [...list, ...toAdd] };
    setNewValues(prev => ({ ...prev, [key]: '' }));
    persistSettings(nextSettings, '藥物設定已儲存至資料庫');
  };

  // ── number list helpers ───────────────────────────────────────────────────
  const removeFreqItem = (val: number) => {
    const nextSettings = { ...settings, 每日次數: settings.每日次數.filter(n => n !== val) };
    persistSettings(nextSettings, '藥物設定已儲存至資料庫');
  };
  const addFreqItem = () => {
    const n = parseInt(newFreq);
    if (isNaN(n) || n < 1 || n > 24) { setMessage({ type: 'error', text: '請輸入 1–24 的整數' }); return; }
    if (settings.每日次數.includes(n)) { setMessage({ type: 'error', text: `「${n}」已存在` }); return; }
    const nextSettings = { ...settings, 每日次數: [...settings.每日次數, n].sort((a, b) => a - b) };
    setNewFreq('');
    persistSettings(nextSettings, '藥物設定已儲存至資料庫');
  };

  const freqLabel = (n: number) => {
    const labels: Record<number, string> = { 1: 'QD', 2: 'BD', 3: 'TDS', 4: 'QID' };
    return labels[n] ? `${labels[n]} (每日${n}次)` : `每日${n}次`;
  };

  // ── 英文簡稱 helpers ──────────────────────────────────────────────────────
  // 輸入時只改本地 state，onBlur 先儲存，避免逐個字打 DB
  const latestSettings = useRef<MedicationSettingsData>(settings);
  useEffect(() => { latestSettings.current = settings; }, [settings]);

  const setAbbr = (abbrKey: AbbrKey, item: string, abbr: string) => {
    setSettings(prev => {
      const map = { ...(prev[abbrKey] as Record<string, string>) };
      if (abbr.trim()) map[item] = abbr.trim();
      else delete map[item];
      return { ...prev, [abbrKey]: map };
    });
  };
  const persistAbbr = () => {
    persistSettings(latestSettings.current, '英文簡稱已儲存至資料庫');
  };

  // ── draggable list renderer ───────────────────────────────────────────────
  const renderDraggableList = (key: StringKey, label: string, abbrKey?: AbbrKey) => {
    const list = settings[key] as string[];
    const abbrMap = abbrKey ? (settings[abbrKey] as Record<string, string>) : null;
    return (
      <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">
          {label}
          {abbrKey && <span className="ml-2 text-xs font-normal text-gray-400">（附英文簡稱欄，用於處方矩陣）</span>}
        </h4>

        {/* 新增 textarea 在列表最頂 */}
        <div className="mb-3">
          <textarea
            rows={2}
            value={newValues[key] ?? ''}
            onChange={e => setNewValues(prev => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addStringItem(key); } }}
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={`新增${label}（支援多行，每行一項；Enter 新增）`}
          />
          <button
            type="button"
            onClick={() => addStringItem(key)}
            className="mt-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            新增
          </button>
        </div>

        {/* 項目列表（可拖曳排序） */}
        {list.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-2">（清單為空）</div>
        ) : (
          <ul className="space-y-1">
            {list.map((item, idx) => (
              <li
                key={idx}
                draggable
                onDragStart={() => onDragStart(key, idx)}
                onDragOver={e => onDragOver(e, key, idx)}
                onDragEnd={onDragEnd}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors cursor-grab active:cursor-grabbing group"
              >
                <GripVertical className="h-4 w-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 select-none">{item}</span>
                {abbrKey && abbrMap && (
                  <input
                    type="text"
                    value={abbrMap[item] ?? ''}
                    onChange={e => setAbbr(abbrKey, item, e.target.value)}
                    onBlur={persistAbbr}
                    placeholder="英文簡稱"
                    className="w-24 px-2 py-0.5 border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeStringItem(key, idx)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="刪除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 標題 + 操作按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">藥物設定</h3>
          <p className="text-sm text-gray-500 mt-0.5">管理處方管理中各下拉選單的可選項目。變更後會自動儲存到資料庫。</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="inline-flex items-center gap-1 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" /> 儲存中...
            </span>
          )}
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <RotateCcw className="h-4 w-4" />重設預設值
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-sm ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>{message.text}</div>
      )}

      {/* 服用資訊 */}
      <div>
        <h3 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />服用資訊
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {STRING_FIELDS.map(({ key, label }) => renderDraggableList(key, label))}
        </div>
      </div>

      {/* 藥物來源（機構 + 專科） */}
      <div>
        <h3 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />藥物來源
        </h3>
        <p className="text-xs text-gray-400 mb-3">機構依「醫管局 / 衛生署 / 其他」分組；系統以此判定是否須輸入藥物數量。專科為選填。</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {SOURCE_FIELDS.map(({ key, label }) => renderDraggableList(key, label, ABBR_KEY_MAP[key]))}
        </div>
      </div>

      {/* 服用頻率 */}
      <div>
        <h3 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />服用頻率
        </h3>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">每日服用次數</h4>
          <p className="text-xs text-gray-400 mb-3">QD / BD / TDS / QID 等標籤由系統自動對應</p>
          <div className="mb-3 flex gap-2 max-w-xs">
            <input type="number" min={1} max={24} value={newFreq}
              onChange={e => setNewFreq(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFreqItem(); } }}
              className="w-24 px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="次數" />
            <button type="button" onClick={addFreqItem}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
              新增
            </button>
          </div>
          <ul className="space-y-1">
            {settings.每日次數.sort((a, b) => a - b).map(n => (
              <li key={n} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100 hover:bg-gray-100 group">
                <span className="flex-1 text-sm text-gray-700">{freqLabel(n)}</span>
                <button type="button" onClick={() => removeFreqItem(n)}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="刪除">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {settings.每日次數.length === 0 && <li className="text-xs text-gray-400 italic py-1">（清單為空）</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MedicationSettingsPanel;
