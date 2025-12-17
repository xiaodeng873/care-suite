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
      alert('請輸入站點名稱');
      return;
    }

    try {
      if (station) {
        await updateStation({
          ...station,
          ...formData
        });
      } else {
        await addStation(formData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存站點失敗:', error);
      alert('儲存站點失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {station ? '編輯站點' : '新增站點'}
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
            <label className="form-label">站點名稱 *</label>
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
            <label className="form-label">站點描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="站點的詳細描述或備註..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {station ? '更新站點' : '建立站點'}
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