import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#6366f1', '#84cc16', '#f97316',
];

interface StationModalProps {
  station?: any;
  onClose: () => void;
}

const StationModal: React.FC<StationModalProps> = ({ station, onClose }) => {
  const { addStation, updateStation } = usePatientData();

  const [formData, setFormData] = useState({
    name: station?.name || '',
    code: station?.code || '',
    description: station?.description || '',
    color: station?.color || ''
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
        color: formData.color.trim() || undefined,
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

          <div>
            <label className="form-label">代表顏色</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color: '' }))}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${formData.color ? 'border-gray-300 text-gray-400 hover:border-gray-400' : 'border-blue-500 text-blue-500'}`}
                title="無顏色"
              >
                <X className="h-4 w-4" />
              </button>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-300' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="color"
                  value={formData.color || PRESET_COLORS[0]}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-8 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                  title="自訂顏色"
                />
                {formData.color && !PRESET_COLORS.includes(formData.color) && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: '' }))}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
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