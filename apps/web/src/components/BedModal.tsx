import React, { useState, useMemo } from 'react';
import { X, Bed, Building2, DoorOpen } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface BedModalProps {
  bed?: any;
  preselectedStation?: any;
  preselectedRoom?: any;
  onClose: () => void;
}

const NEW_ROOM = '__new_room__';

const BedModal: React.FC<BedModalProps> = ({ bed, preselectedStation, preselectedRoom, onClose }) => {
  const { stations, rooms, addBed, updateBed, addRoom } = usePatients();

  const [formData, setFormData] = useState({
    station_id: bed?.station_id || preselectedRoom?.station_id || preselectedStation?.id || '',
    room_id: bed?.room_id || preselectedRoom?.id || '',
    new_room_number: '',
    bed_no: bed?.bed_no || '',
    bed_name: bed?.bed_name && bed?.bed_name !== bed?.bed_number ? bed.bed_name : ''
  });
  const [saving, setSaving] = useState(false);

  const station = stations.find((s: any) => s.id === formData.station_id);
  // 目前所選居住區的房間（依房號自然排序）
  const stationRooms = useMemo(
    () => rooms
      .filter((r: any) => r.station_id === formData.station_id)
      .sort((a: any, b: any) => a.room_number.localeCompare(b.room_number, 'zh-Hant', { numeric: true })),
    [rooms, formData.station_id]
  );

  const isNewRoom = formData.room_id === NEW_ROOM;
  const selectedRoom = rooms.find((r: any) => r.id === formData.room_id);
  const effectiveRoomNumber = isNewRoom ? formData.new_room_number.trim() : (selectedRoom?.room_number || '');

  // 合成預覽（代號+房號+-+床號）
  const composedPreview = station?.code && effectiveRoomNumber && formData.bed_no.trim()
    ? `${station.code}${effectiveRoomNumber}-${formData.bed_no.trim()}`
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // 切換居住區時清空房間選擇
      ...(name === 'station_id' ? { room_id: '', new_room_number: '' } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!formData.station_id) {
      alert('請選擇居住區');
      return;
    }
    if (!formData.room_id) {
      alert('請選擇或新增房間');
      return;
    }
    if (isNewRoom && !formData.new_room_number.trim()) {
      alert('請輸入新房間的房號');
      return;
    }
    if (!formData.bed_no.trim()) {
      alert('請輸入床號');
      return;
    }

    setSaving(true);
    try {
      // 若為新房間，先建立（同區房號已存在則沿用）
      let roomId = formData.room_id;
      const roomNumber = effectiveRoomNumber;
      if (isNewRoom) {
        const existing = stationRooms.find((r: any) => r.room_number === roomNumber);
        if (existing) {
          roomId = existing.id;
        } else {
          const created = await addRoom({ station_id: formData.station_id, room_number: roomNumber } as any);
          roomId = created.id;
        }
      }

      // 合成 bed_number 供 NOT NULL 約束；DB 觸發器會以權威值覆寫
      const composed = station?.code
        ? `${station.code}${roomNumber}-${formData.bed_no.trim()}`
        : `${roomNumber}-${formData.bed_no.trim()}`;

      const bedData: any = {
        station_id: formData.station_id,
        room_id: roomId,
        bed_no: formData.bed_no.trim(),
        bed_number: composed,
        bed_name: formData.bed_name.trim() || composed,
        is_occupied: bed?.is_occupied || false
      };

      if (bed) {
        await updateBed({ ...bed, ...bedData });
      } else {
        await addBed(bedData);
      }
      onClose();
    } catch (error) {
      console.error('儲存床位失敗:', error);
      if (error instanceof Error &&
          (error.message.includes('duplicate key') || error.message.includes('23505'))) {
        alert('此床位（房間 + 床號）已存在，請使用不同的床號。');
      } else {
        alert('儲存床位失敗，請重試');
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
            <div className="p-2 rounded-lg bg-green-100">
              <Bed className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {bed ? '編輯床位' : '新增床位'}
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
              disabled={!!preselectedStation || !!preselectedRoom}
            >
              <option value="">請選擇居住區</option>
              {stations.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.code ? `（${s.code}）` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">
              <DoorOpen className="h-4 w-4 inline mr-1" />
              房間 *
            </label>
            <select
              name="room_id"
              value={formData.room_id}
              onChange={handleChange}
              className="form-input"
              required
              disabled={!formData.station_id || !!preselectedRoom}
            >
              <option value="">請選擇房間</option>
              {stationRooms.map((r: any) => (
                <option key={r.id} value={r.id}>{r.room_number} 房</option>
              ))}
              <option value={NEW_ROOM}>➕ 新增房間…</option>
            </select>
          </div>

          {isNewRoom && (
            <div>
              <label className="form-label">新房間房號 *</label>
              <input
                type="text"
                name="new_room_number"
                value={formData.new_room_number}
                onChange={handleChange}
                className="form-input"
                placeholder="例如：202"
                required
              />
            </div>
          )}

          <div>
            <label className="form-label">床號 *</label>
            <input
              type="text"
              name="bed_no"
              value={formData.bed_no}
              onChange={handleChange}
              className="form-input"
              placeholder="例如：1、2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              同一房間內床號不可重複
            </p>
          </div>

          {composedPreview && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
              <span className="text-xs text-gray-500">合成床號顯示：</span>
              <span className="ml-1 font-semibold text-blue-700">{composedPreview}</span>
            </div>
          )}

          <div>
            <label className="form-label">床位名稱</label>
            <input
              type="text"
              name="bed_name"
              value={formData.bed_name}
              onChange={handleChange}
              className="form-input"
              placeholder="床位的顯示名稱（可選）"
            />
            <p className="text-xs text-gray-500 mt-1">
              如果不填寫，將使用合成床號作為名稱
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? '儲存中…' : (bed ? '更新床位' : '建立床位')}
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

export default BedModal;