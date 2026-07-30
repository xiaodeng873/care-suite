import React, { useMemo, useState } from 'react';
import { X, Home, Bed, AlertCircle, CheckCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import BedNumberImprint from './BedNumberImprint';

interface ChangeOriginalBedModalProps {
  patient: any; // 院友主表 record，須含 院友id, 中文姓名, bed_id, original_bed_id, 床號, bed_transfer_type
  onClose: () => void;
}

const ChangeOriginalBedModal: React.FC<ChangeOriginalBedModalProps> = ({ patient, onClose }) => {
  const { beds, rooms, stations, changeOriginalBed } = usePatients();
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patientId = patient?.院友id;
  const currentBedId = patient?.bed_id;
  const originalBedId = patient?.original_bed_id;

  const availableBeds = useMemo(() => {
    return beds
      .filter(bed => bed.id !== currentBedId && bed.id !== originalBedId && !bed.is_occupied)
      .map(bed => {
        const room = rooms.find(r => r.id === bed.room_id);
        const station = stations.find(s => s.id === bed.station_id);
        return {
          ...bed,
          roomNumber: room?.room_number || '',
          stationName: station?.name || '',
          displayLabel: `${room?.room_number || ''}-${bed.bed_no || bed.bed_number}${station ? ` (${station.name})` : ''}`,
        };
      })
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel, 'zh-Hant', { numeric: true }));
  }, [beds, rooms, stations, currentBedId, originalBedId]);

  const selectedBed = useMemo(
    () => availableBeds.find(b => b.id === selectedBedId),
    [availableBeds, selectedBedId]
  );

  const handleConfirm = async () => {
    if (!selectedBedId) {
      alert('請先選擇新的原床位');
      return;
    }
    if (!window.confirm(`確定要將「${patient.中文姓名}」的原床位更改為 ${selectedBed?.displayLabel} 嗎？\n\n更改後，取消暫時性調動時將返回此新原床位。`)) {
      return;
    }
    setSaving(true);
    try {
      await changeOriginalBed(patientId, selectedBedId);
      alert('原床位已更新');
      onClose();
    } catch (error) {
      console.error('更改原床位失敗:', error);
      alert(error instanceof Error ? error.message : '更改原床位失敗，請重試');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Home className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">更改原床位</h2>
                <p className="text-sm text-gray-600">
                  {patient.中文姓名} · 現床 <BedNumberImprint patient={patient} beds={beds} size="sm" />
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800 flex gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>
              此操作只更改「原床位」標記。院友表面上仍停留在暫時性調動床位；取消暫時性調動時將返回此處選擇的新原床位。
            </p>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-2">選擇新原床位（僅顯示空置床位）</h3>
          {availableBeds.length === 0 ? (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
              <Bed className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">暫無可用空置床位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {availableBeds.map(bed => {
                const selected = selectedBedId === bed.id;
                return (
                  <button
                    key={bed.id}
                    onClick={() => setSelectedBedId(bed.id)}
                    className={`text-left border rounded-lg p-3 transition-colors ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{bed.displayLabel}</span>
                      {selected && <CheckCircle className="h-5 w-5 text-indigo-600" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{bed.bed_name && bed.bed_name !== bed.bed_number ? bed.bed_name : ''}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleConfirm}
            disabled={!selectedBedId || saving || availableBeds.length === 0}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Home className="h-4 w-4" />
            {saving ? '儲存中…' : '確認更改原床位'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeOriginalBedModal;
