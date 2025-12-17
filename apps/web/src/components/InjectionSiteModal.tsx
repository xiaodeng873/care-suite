import React, { useState } from 'react';
import { X, MapPin, User, Calendar, Clock, Syringe } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface InjectionSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowRecord?: any;
  onSiteSelected?: (site: string, notes?: string) => void;
}

const InjectionSiteModal: React.FC<InjectionSiteModalProps> = ({
  isOpen,
  onClose,
  workflowRecord,
  onSiteSelected
}) => {
  const { patients, prescriptions } = usePatients();
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const patient = patients.find(p => p.院友id === workflowRecord?.patient_id);
  const prescription = prescriptions.find(p => p.id === workflowRecord?.prescription_id);

  // 注射區域定義 - 使用內聯樣式避免 Tailwind 動態類名問題
  const injectionAreas = [
    { value: 'left_arm', label: '左上臂區', prefix: 'A', bgColor: '#3b82f6' },
    { value: 'right_arm', label: '右上臂區', prefix: 'B', bgColor: '#10b981' },
    { value: 'abdomen_left', label: '腹部左區', prefix: 'C', bgColor: '#eab308' },
    { value: 'abdomen_right', label: '腹部右區', prefix: 'D', bgColor: '#f97316' },
    { value: 'left_thigh', label: '左大腿區', prefix: 'E', bgColor: '#a855f7' },
    { value: 'right_thigh', label: '右大腿區', prefix: 'F', bgColor: '#ec4899' }
  ];

  // 生成位置編號（1-8）
  const positions = Array.from({ length: 8 }, (_, i) => i + 1);

  // 取得當前選擇區域的資訊
  const selectedAreaInfo = injectionAreas.find(area => area.value === selectedArea);

  // 組合完整的注射部位名稱（只顯示字母和數字）
  const getFullSiteName = () => {
    if (!selectedArea || !selectedPosition) return '';
    return `${selectedAreaInfo?.prefix}${selectedPosition}`;
  };

  const handleConfirm = () => {
    if (!selectedArea) {
      alert('請選擇注射區域');
      return;
    }
    if (!selectedPosition) {
      alert('請選擇注射位置');
      return;
    }

    const fullSiteName = getFullSiteName();
    if (onSiteSelected) {
      onSiteSelected(fullSiteName, notes);
    }

    // 重置狀態
    setSelectedArea('');
    setSelectedPosition('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-md w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Syringe className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">選擇注射部位</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 院友和藥物資訊 */}
        {workflowRecord && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm">
              <div className="font-medium text-gray-900 mb-1">
                {patient?.中文姓氏}{patient?.中文名字} ({patient?.床號})
              </div>
              <div className="text-gray-600 mb-1">
                藥物: {prescription?.medication_name}
              </div>
              <div className="text-gray-600 mb-1">
                日期: {new Date(workflowRecord.scheduled_date).toLocaleDateString('zh-TW')}
              </div>
              <div className="text-gray-600">
                時間: {workflowRecord.scheduled_time}
              </div>
            </div>
          </div>
        )}

        {/* 步驟1：選擇注射區域 */}
        <div className="space-y-3 mb-6">
          <label className="form-label">步驟 1：選擇注射區域</label>
          <div className="grid grid-cols-2 gap-3">
            {injectionAreas.map(area => (
              <button
                key={area.value}
                onClick={() => {
                  setSelectedArea(area.value);
                  setSelectedPosition('');
                }}
                className={`p-4 border-2 rounded-lg transition-all text-left ${
                  selectedArea === area.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{area.label}</div>
                    <div className="text-sm text-gray-500">{area.prefix}1 ~ {area.prefix}8</div>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: area.bgColor }}
                  >
                    {area.prefix}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 步驟2：選擇具體位置 */}
        {selectedArea && (
          <div className="space-y-3 mb-6">
            <label className="form-label">
              步驟 2：選擇具體位置（{selectedAreaInfo?.label}）
            </label>
            <div className="grid grid-cols-4 gap-2">
              {positions.map(pos => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(String(pos))}
                  className={`p-3 border-2 rounded-lg transition-all ${
                    selectedPosition === String(pos)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-bold text-lg text-gray-900">
                      {selectedAreaInfo?.prefix}{pos}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 已選擇的注射部位顯示 */}
        {selectedArea && selectedPosition && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm text-gray-600">已選擇注射部位：</div>
                <div className="text-lg font-bold text-green-900">{getFullSiteName()}</div>
              </div>
            </div>
          </div>
        )}

        {/* 備註 */}
        <div className="mb-6">
          <label className="form-label">備註（可選）：</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
            rows={2}
            placeholder="注射相關備註或注意事項..."
          />
        </div>

        {/* 確認按鈕 */}
        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={!selectedArea || !selectedPosition}
            className="btn-primary flex-1 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Syringe className="h-4 w-4" />
            <span>確認注射部位</span>
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

export default InjectionSiteModal;
