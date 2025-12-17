import React, { useState } from 'react';
import { X, Pill, Upload, Camera, Trash2 } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface DrugModalProps {
  drug?: any;
  onClose: () => void;
}

const DrugModal: React.FC<DrugModalProps> = ({ drug, onClose }) => {
  const { addDrug, updateDrug } = usePatients();

  const [formData, setFormData] = useState({
    drug_name: drug?.drug_name || '',
    drug_code: drug?.drug_code || '',
    drug_type: drug?.drug_type || '',
    administration_route: drug?.administration_route || '',
    unit: drug?.unit || '',
    photo_url: drug?.photo_url || '',
    notes: drug?.notes || ''
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(drug?.photo_url || null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('圖片大小不能超過 5MB');
      return;
    }

    setIsUploading(true);
    
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setPhotoPreview(base64String);
        setFormData(prev => ({
          ...prev,
          photo_url: base64String
        }));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('上傳照片失敗:', error);
      alert('上傳照片失敗，請重試');
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoUpload(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setFormData(prev => ({
      ...prev,
      photo_url: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.drug_name.trim()) {
      alert('請輸入藥物名稱');
      return;
    }

    try {
      const drugData = {
        ...formData,
        drug_name: formData.drug_name.trim(),
        drug_code: formData.drug_code.trim() || null,
        drug_type: formData.drug_type || null,
        administration_route: formData.administration_route || null,
        unit: formData.unit.trim() || null,
        photo_url: formData.photo_url || null,
        notes: formData.notes.trim() || null
      };

      if (drug) {
        await updateDrug({
          ...drug,
          ...drugData
        });
      } else {
        await addDrug(drugData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存藥物失敗:', error);
      alert('儲存藥物失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {drug ? '編輯藥物' : '新增藥物'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 藥物相片 */}
          <div>
            <label className="form-label">藥物相片</label>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img 
                    src={photoPreview} 
                    alt="藥物相片" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Pill className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <label className="btn-secondary cursor-pointer flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>上傳相片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>移除相片</span>
                  </button>
                )}
              </div>
            </div>
            {isUploading && (
              <p className="text-sm text-blue-600 mt-2">上傳中...</p>
            )}
          </div>

          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">藥物名稱 *</label>
              <input
                type="text"
                name="drug_name"
                value={formData.drug_name}
                onChange={handleChange}
                className="form-input"
                placeholder="輸入藥物名稱"
                required
              />
            </div>

            <div>
              <label className="form-label">藥物編號</label>
              <input
                type="text"
                name="drug_code"
                value={formData.drug_code}
                onChange={handleChange}
                className="form-input"
                placeholder="輸入藥物編號"
              />
            </div>

            <div>
              <label className="form-label">藥物類型</label>
              <select
                name="drug_type"
                value={formData.drug_type}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇類型</option>
                <option value="西藥">西藥</option>
                <option value="中藥">中藥</option>
                <option value="保健品">保健品</option>
                <option value="外用藥">外用藥</option>
              </select>
            </div>

            <div>
              <label className="form-label">使用途徑</label>
              <select
                name="administration_route"
                value={formData.administration_route}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇途徑</option>
                <option value="口服">口服</option>
                <option value="注射">注射</option>
                <option value="外用">外用</option>
                <option value="滴眼">滴眼</option>
                <option value="滴耳">滴耳</option>
                <option value="鼻胃管">鼻胃管</option>
                <option value="吸入">吸入</option>
              </select>
            </div>

            <div>
              <label className="form-label">藥物單位</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="form-input"
                placeholder="例如：mg、ml、片、滴"
              />
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">藥物備註</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="輸入藥物相關備註、注意事項等..."
            />
          </div>

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {drug ? '更新藥物' : '新增藥物'}
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

export default DrugModal;