import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { PublicHoliday, PublicHolidayType } from '@care-suite/shared';
import DateInput from './DateInput';

interface PublicHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (holiday: PublicHoliday) => void;
  initial: PublicHoliday | null;
  defaultYear: number;
}

const TYPE_LABELS: Record<PublicHolidayType, string> = {
  PH: '銀行假期',
  SH: '勞工假期',
};

const PublicHolidayModal: React.FC<PublicHolidayModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initial,
  defaultYear,
}) => {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(() => {
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    const dd = String(new Date().getDate()).padStart(2, '0');
    return `${defaultYear}-${mm}-${dd}`;
  });
  const [name, setName] = useState('');
  const [type, setType] = useState<PublicHolidayType>('PH');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setDate(initial.holiday_date);
      setName(initial.name);
      setType(initial.type);
    } else {
      const mm = String(new Date().getMonth() + 1).padStart(2, '0');
      const dd = String(new Date().getDate()).padStart(2, '0');
      setDate(`${defaultYear}-${mm}-${dd}`);
      setName('');
      setType('PH');
    }
    setError(null);
  }, [initial, defaultYear, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date.trim() || !name.trim()) {
      setError('請填寫日期與名稱');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      holiday_date: date,
      name: name.trim(),
      type,
      created_by: userProfile?.id || null,
    };

    let result;
    if (initial) {
      result = await supabase.from('public_holidays').update(payload).eq('id', initial.id).select().single();
    } else {
      result = await supabase.from('public_holidays').insert(payload).select().single();
    }

    if (result.error) {
      setError(`儲存失敗：${result.error.message}`);
    } else if (result.data) {
      onSave(result.data as PublicHoliday);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {initial ? '編輯假期' : '新增假期'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
            <div className="flex gap-4">
              {(['PH', 'SH'] as PublicHolidayType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  {TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <DateInput
              value={date}
              onChange={(v) => setDate(v)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：勞動節"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="px-3 py-2 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicHolidayModal;
