import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { UserProfile } from '@care-suite/shared';
import { supabase } from '../context/AuthContext';

interface RosterAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  date: string;
  existingReason: string;
  onSaved: () => void;
}

export const RosterAbsenceModal: React.FC<RosterAbsenceModalProps> = ({
  isOpen,
  onClose,
  user,
  date,
  existingReason,
  onSaved,
}) => {
  const [reason, setReason] = useState(existingReason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason(existingReason || '');
      setError(null);
    }
  }, [isOpen, existingReason]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const { error: upsertError } = await supabase
        .from('user_absence_records')
        .upsert(
          {
            user_id: user.id,
            absence_date: date,
            reason: reason.trim(),
          },
          { onConflict: 'user_id,absence_date' },
        );
      if (upsertError) throw upsertError;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('user_absence_records')
        .delete()
        .eq('user_id', user.id)
        .eq('absence_date', date);
      if (deleteError) throw deleteError;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            未上班原因：{user.name_zh} ({date})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="請輸入未上班原因..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-between px-5 py-3 border-t">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || !existingReason}
            className="px-4 py-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            刪除
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RosterAbsenceModal;
