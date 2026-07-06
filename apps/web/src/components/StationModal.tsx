import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface StationModalProps {
  station?: any;
  onClose: () => void;
}

const StationModal: React.FC<StationModalProps> = ({ station, onClose }) => {
  const { addStation, updateStation } = usePatients();

  const [formData, setFormData] = useState({
    name: station?.name || '',
    code: station?.code || '',
    description: station?.description || ''
  });

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