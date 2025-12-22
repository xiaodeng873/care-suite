import React, { useState, useEffect } from 'react';
import { X, Plus, MapPin, Calendar, User, AlertCircle } from 'lucide-react';
import { usePatients, type Wound, type WoundType, type WoundOrigin } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import HumanBodyDiagram from './HumanBodyDiagram';

interface WoundModalProps {
  wound?: Wound | null;
  patientId?: number;
  onClose: () => void;
  onSave?: (wound: Wound) => void;
}

const WOUND_TYPES: { value: WoundType; label: string }[] = [
  { value: 'pressure_ulcer', label: '壓瘡' },
  { value: 'trauma', label: '創傷' },
  { value: 'surgical', label: '手術傷口' },
  { value: 'diabetic', label: '糖尿病傷口' },
  { value: 'venous', label: '靜脈性潰瘍' },
  { value: 'arterial', label: '動脈性潰瘍' },
  { value: 'other', label: '其他' }
];

const WOUND_ORIGINS: { value: WoundOrigin; label: string }[] = [
  { value: 'facility', label: '本院發現' },
  { value: 'admission', label: '入院時已有' },
  { value: 'hospital_referral', label: '醫院轉介' }
];

const WoundModal: React.FC<WoundModalProps> = ({ wound, patientId, onClose, onSave }) => {
  const { addWound, updateWound, generateWoundCode, patients } = usePatients();
  const { displayName } = useAuth();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: wound?.patient_id || patientId || '',
    wound_code: wound?.wound_code || '',
    wound_name: wound?.wound_name || '',
    discovery_date: wound?.discovery_date || getHongKongDate(),
    wound_location: wound?.wound_location || { x: 0, y: 0, side: 'front' as 'front' | 'back' },
    wound_type: wound?.wound_type || ('pressure_ulcer' as WoundType),
    wound_type_other: wound?.wound_type_other || '',
    wound_origin: wound?.wound_origin || ('facility' as WoundOrigin),
    remarks: wound?.remarks || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自動生成傷口編號
  useEffect(() => {
    const fetchWoundCode = async () => {
      if (!wound && formData.patient_id) {
        try {
          const code = await generateWoundCode(Number(formData.patient_id));
          setFormData(prev => ({ ...prev, wound_code: code }));
        } catch (err) {
          console.error('Error generating wound code:', err);
        }
      }
    };
    fetchWoundCode();
  }, [formData.patient_id, wound, generateWoundCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = (location: { x: number; y: number; side: 'front' | 'back' }) => {
    setFormData(prev => ({ ...prev, wound_location: location }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.patient_id) {
      setError('請選擇院友');
      return;
    }

    if (!formData.discovery_date) {
      setError('請填寫發現日期');
      return;
    }

    setIsLoading(true);

    try {
      const woundData = {
        patient_id: Number(formData.patient_id),
        wound_code: formData.wound_code,
        wound_name: formData.wound_name || undefined,
        discovery_date: formData.discovery_date,
        wound_location: formData.wound_location,
        wound_type: formData.wound_type,
        wound_type_other: formData.wound_type === 'other' ? formData.wound_type_other : undefined,
        wound_origin: formData.wound_origin,
        remarks: formData.remarks || undefined,
        status: 'active' as const
      };

      let savedWound: Wound | null = null;
      if (wound?.id) {
        savedWound = await updateWound({ id: wound.id, ...woundData });
      } else {
        savedWound = await addWound(woundData);
      }

      if (!savedWound) {
        throw new Error('傷口表尚未創建，請先執行數據庫遷移');
      }

      onSave?.(savedWound);
      onClose();
    } catch (err) {
      console.error('Error saving wound:', err);
      setError(err instanceof Error ? err.message : '儲存傷口失敗，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.院友id === Number(formData.patient_id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Plus className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {wound ? '編輯傷口' : '新增傷口'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* 院友選擇 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                院友 <span className="text-red-500">*</span>
              </label>
              {wound ? (
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">
                    {selectedPatient?.床號} - {selectedPatient?.中文姓名}
                  </span>
                </div>
              ) : (
                <PatientAutocomplete
                  value={formData.patient_id ? String(formData.patient_id) : ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, patient_id: value }))}
                  placeholder="選擇院友..."
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                傷口編號
              </label>
              <input
                type="text"
                name="wound_code"
                value={formData.wound_code}
                onChange={handleChange}
                className="form-input w-full bg-gray-50"
                placeholder="自動生成"
                readOnly
              />
              <p className="mt-1 text-xs text-gray-500">系統自動生成</p>
            </div>
          </div>

          {/* 發現日期和傷口名稱 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                發現日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="discovery_date"
                value={formData.discovery_date}
                onChange={handleChange}
                className="form-input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                傷口名稱/描述
              </label>
              <input
                type="text"
                name="wound_name"
                value={formData.wound_name}
                onChange={handleChange}
                className="form-input w-full"
                placeholder="例如：左腳踝壓瘡"
              />
            </div>
          </div>

          {/* 傷口類型和來源 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                傷口類型 <span className="text-red-500">*</span>
              </label>
              <select
                name="wound_type"
                value={formData.wound_type}
                onChange={handleChange}
                className="form-input w-full"
              >
                {WOUND_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {formData.wound_type === 'other' && (
                <input
                  type="text"
                  name="wound_type_other"
                  value={formData.wound_type_other}
                  onChange={handleChange}
                  className="form-input w-full mt-2"
                  placeholder="請說明傷口類型..."
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                傷口來源 <span className="text-red-500">*</span>
              </label>
              <select
                name="wound_origin"
                value={formData.wound_origin}
                onChange={handleChange}
                className="form-input w-full"
              >
                {WOUND_ORIGINS.map(origin => (
                  <option key={origin.value} value={origin.value}>{origin.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 傷口位置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <MapPin className="inline h-4 w-4 mr-1" />
              傷口位置
            </label>
            <div className="border rounded-lg p-4">
              <HumanBodyDiagram
                selectedLocation={formData.wound_location}
                onLocationChange={handleLocationChange}
              />
              <div className="mt-4 flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    wound_location: { ...prev.wound_location, side: 'front' } 
                  }))}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    formData.wound_location.side === 'front'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  前面
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    wound_location: { ...prev.wound_location, side: 'back' } 
                  }))}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    formData.wound_location.side === 'back'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  後面
                </button>
              </div>
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備註
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="form-input w-full"
              rows={3}
              placeholder="其他補充說明..."
            />
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>提示：</strong>新增傷口後，系統會自動設定下次評估日期為發現日期 + 7 天。
              您可以在傷口詳情頁面進行首次評估。
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? '儲存中...' : (wound ? '更新傷口' : '新增傷口')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WoundModal;
