import React, { useState } from 'react';
import { X, Bed, Building2 } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface BedModalProps {
  bed?: any;
  preselectedStation?: any;
  onClose: () => void;
}

const BedModal: React.FC<BedModalProps> = ({ bed, preselectedStation, onClose }) => {
  const { stations, addBed, updateBed } = usePatients();

  const [formData, setFormData] = useState({
    station_id: bed?.station_id || preselectedStation?.id || '',
    bed_number: bed?.bed_number || '',
    bed_name: bed?.bed_name || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.station_id || !formData.bed_number.trim()) {
      alert('請選擇站點並輸入床位號碼');
      return;
    }

    try {
      const bedData = {
        station_id: formData.station_id,
        bed_number: formData.bed_number.trim(),
        bed_name: formData.bed_name.trim() || formData.bed_number.trim(),
        is_occupied: bed?.is_occupied || false
      };

      if (bed) {
        await updateBed({
          ...bed,
          ...bedData
        });
      } else {
        await addBed(bedData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存床位失敗:', error);
      if (error instanceof Error) {
        // 檢查是否為 Supabase 唯一約束違反錯誤
        if (error.message.includes('duplicate key') || 
            error.message.includes('23505') ||
            error.message.includes('beds_station_id_bed_number_key')) {
          alert('此床位號碼與所選站點的現有床位重複，請使用不同的床位號碼。');
        } else {
          alert('儲存床位失敗，請重試');
        }
      } else {
        alert('儲存床位失敗，請重試');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
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
              所屬站點 *
            </label>
            <select
              name="station_id"
              value={formData.station_id}
              onChange={handleChange}
              className="form-input"
              required
              disabled={!!preselectedStation}
            >
              <option value="">請選擇站點</option>
              {stations.map(station => (
                <option key={station.id} value={station.id}>{station.name}</option>
              ))}
            </select>
            {preselectedStation && (
              <p className="text-xs text-gray-500 mt-1">
                已預選站點：{preselectedStation.name}
              </p>
            )}
          </div>

          <div>
            <label className="form-label">床位號碼 *</label>
            <input
              type="text"
              name="bed_number"
              value={formData.bed_number}
              onChange={handleChange}
              className="form-input"
              placeholder="例如：C01、C02、A15"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              床位號碼在同一站點內必須唯一
            </p>
          </div>

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
              如果不填寫，將使用床位號碼作為名稱
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {bed ? '更新床位' : '建立床位'}
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

export default BedModal;