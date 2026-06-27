import React, { useState, useEffect, useRef } from 'react';
import { Building2, Upload, Check, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  getFacilitySettings,
  saveFacilitySettings,
  DEFAULT_FACILITY_SETTINGS,
  type FacilitySettings,
} from '../utils/facilitySettings';

// 標誌檔案大小上限（以 base64 儲存於資料庫，故限制原始檔大小）
const MAX_LOGO_BYTES = 500 * 1024; // 500KB

const FacilitySettingsPanel: React.FC = () => {
  const [facilityNameZh, setFacilityNameZh] = useState('');
  const [facilityNameEn, setFacilityNameEn] = useState('');
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const settings = await getFacilitySettings(true);
      if (!active) return;
      setFacilityNameZh(settings.facilityNameZh);
      setFacilityNameEn(settings.facilityNameEn);
      setLogoDataUri(settings.logoDataUri);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '請選擇圖片檔案' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMessage({ type: 'error', text: '標誌檔案不可超過 500KB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUri(typeof reader.result === 'string' ? reader.result : null);
      setMessage(null);
    };
    reader.onerror = () => setMessage({ type: 'error', text: '讀取圖片失敗' });
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!facilityNameZh.trim()) {
      setMessage({ type: 'error', text: '院舍名稱為必填' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveFacilitySettings({
        facilityNameZh: facilityNameZh.trim(),
        facilityNameEn: facilityNameEn.trim(),
        logoDataUri,
      });
      setMessage({ type: 'success', text: '院舍設定已儲存' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-500">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* 工具列 */}
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">院舍設定</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          院舍名稱與標誌會套用至列印匯出（例如「個人備藥及給藥記錄」）的頁首。
        </p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        {/* 院舍中文名稱 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            院舍名稱（中文）<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={facilityNameZh}
            onChange={(e) => setFacilityNameZh(e.target.value)}
            placeholder={DEFAULT_FACILITY_SETTINGS.facilityNameZh}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 院舍英文名稱 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            院舍名稱（英文，選填）
          </label>
          <input
            type="text"
            value={facilityNameEn}
            onChange={(e) => setFacilityNameEn(e.target.value)}
            placeholder={DEFAULT_FACILITY_SETTINGS.facilityNameEn}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 院舍標誌 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">院舍標誌</label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
              {logoDataUri ? (
                <img src={logoDataUri} alt="院舍標誌預覽" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center text-gray-300">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs mt-1">無標誌</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                上傳標誌
              </button>
              {logoDataUri && (
                <button
                  type="button"
                  onClick={() => setLogoDataUri(null)}
                  className="inline-flex items-center px-4 py-2 text-sm text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  移除標誌
                </button>
              )}
              <p className="text-xs text-gray-400">建議使用 PNG，檔案不超過 500KB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>
        </div>

        {message && (
          <div
            className={`text-sm rounded-lg px-4 py-2 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4 mr-2" />
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacilitySettingsPanel;
