import React, { useState } from 'react';
import { X, DoorOpen, Building2 } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface RoomModalProps {
  room?: any;
  preselectedStation?: any;
  onClose: () => void;
}

const RoomModal: React.FC<RoomModalProps> = ({ room, preselectedStation, onClose }) => {
  const { stations, addRoom, updateRoom } = usePatients();

  const [formData, setFormData] = useState({
    station_id: room?.station_id || preselectedStation?.id || '',
    room_number: room?.room_number || '',
    description: room?.description || ''
  });
  const [saving, setSaving] = useState(false);

  const station = stations.find((s: any) => s.id === formData.station_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!formData.station_id) {
      alert('請選擇居住區');
      return;
    }
    if (!formData.room_number.trim()) {
      alert('請輸入房號');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        station_id: formData.station_id,
        room_number: formData.room_number.trim(),
        description: formData.description.trim() || undefined
      };
      if (room) {
        await updateRoom({ id: room.id, ...payload });
      } else {
        await addRoom(payload as any);
      }
      onClose();
    } catch (error) {
      console.error('儲存房間失敗:', error);
      if (error instanceof Error &&
          (error.message.includes('duplicate key') || error.message.includes('23505'))) {
        alert('此房號在該居住區已存在，請使用不同的房號。');
      } else {
        alert('儲存房間失敗，請重試');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <DoorOpen className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {room ? '編輯房間' : '新增房間'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <Building2 className="h-4 w-4 inline mr-1" />
              所屬居住區 *
            </label>
            <select
              name="station_id"
              value={formData.station_id}
              onChange={handleChange}
              className="form-input"
              required
              disabled={!!preselectedStation || !!room}
            >
              <option value="">請選擇居住區</option>
              {stations.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.code ? `（${s.code}）` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">房號 *</label>
            <input
              type="text"
              name="room_number"
              value={formData.room_number}
              onChange={handleChange}
              className="form-input"
              placeholder="例如：202"
              required
            />
            {station?.code && formData.room_number.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                合成床號將以「{station.code}{formData.room_number.trim()}-床號」顯示
              </p>
            )}
          </div>

          <div>
            <label className="form-label">房間描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-input"
              rows={2}
              placeholder="房間備註（可選）"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? '儲存中…' : (room ? '更新房間' : '建立房間')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoomModal;
