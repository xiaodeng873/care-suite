import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Pill, Upload, Camera, Trash2 } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import { getMedicationSettings } from '../utils/medicationSettings';

interface DrugModalProps {
  drug?: any;
  onClose: () => void;
  onSave?: (savedDrug: any) => void;  // 可選的保存回調，返回保存後的藥物數據
}

const DrugModal: React.FC<DrugModalProps> = ({ drug, onClose, onSave }) => {
  const { addDrug, updateDrug } = usePatientData();

  const [formData, setFormData] = useState({
    drug_name: drug?.drug_name || '',
    drug_code: drug?.drug_code || '',
    drug_type: drug?.drug_type || '',
    administration_route: drug?.administration_route || '',
    unit: drug?.unit || '',
    photo_url: drug?.photo_url || '',
    notes: drug?.notes || '',
    cannot_crush: drug?.cannot_crush || false,
    no_antacid: drug?.no_antacid || false
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(drug?.photo_url || null);
  const [isUploading, setIsUploading] = useState(false);

  // 藥物設定：使用途徑 / 藥物單位選項與「藥物設定」頁同步
  const medSettings = useMemo(() => getMedicationSettings(), []);
  const routeOptions = useMemo(() => {
    const routes: string[] = [...medSettings.服用途徑];
    if (formData.administration_route && !routes.includes(formData.administration_route)) {
      routes.push(formData.administration_route);
    }
    return routes;
  }, [medSettings, formData.administration_route]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
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
        notes: formData.notes.trim() || null,
        cannot_crush: formData.cannot_crush,
        no_antacid: formData.no_antacid
      };

      if (drug?.id) {
        await updateDrug({
          ...drug,
          ...drugData
        });
        onSave?.({ ...drug, ...drugData });
      } else {
        await addDrug(drugData);
        onSave?.(drugData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存藥物失敗:', error);
      alert('儲存藥物失敗，請重試');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-4">
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
                <label className="btn-secondary cursor-pointer flex flex-wrap items-center gap-2">
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
                    className="btn-danger flex flex-wrap items-center gap-2"
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
                {routeOptions.map((route) => (
                  <option key={route} value={route}>{route}</option>
                ))}
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
                list="drug-unit-options"
              />
              <datalist id="drug-unit-options">
                {medSettings.服用單位.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 不可碎藥 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="cannot_crush"
              checked={formData.cannot_crush}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-300 text-blue-600"
            />
            <label className="flex-1 cursor-pointer">
              <span className="font-medium text-gray-900">不可碎藥</span>
              <p className="text-sm text-gray-500 mt-1">若勾選，表示此藥物不可碎藥，須完整服用</p>
            </label>
          </div>

          {/* 不可與中和胃酸藥同服 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="no_antacid"
              checked={formData.no_antacid}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-300 text-blue-600"
            />
            <label className="flex-1 cursor-pointer">
              <span className="font-medium text-gray-900">不可與中和胃酸藥同服</span>
              <p className="text-sm text-gray-500 mt-1">若勾選，eMAR 及藥紙的藥物名稱欄會顯示提示標籤</p>
            </label>
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
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
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
    </div>,
    document.body
  );
};

export default DrugModal;