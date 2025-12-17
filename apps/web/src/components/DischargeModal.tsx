import React, { useState } from 'react';
import { X, LogOut, Calendar, Heart, Home, Hospital, Building2 } from 'lucide-react';

interface DischargeModalProps {
  patient: any;
  onClose: () => void;
  onConfirm: (patient: any, dischargeDate: string) => void;
}

const DischargeModal: React.FC<DischargeModalProps> = ({ patient, onClose, onConfirm }) => {
  const [dischargeDate, setDischargeDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dischargeReason, setDischargeReason] = useState<'死亡' | '回家' | '留醫' | '轉往其他機構'>('回家');
  const [deathDate, setDeathDate] = useState('');
  const [transferFacility, setTransferFacility] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeDate) {
      alert('請選擇退住日期');
      return;
    }
    if (dischargeReason === '死亡' && !deathDate) {
      alert('請輸入死亡日期');
      return;
    }
    if (dischargeReason === '轉往其他機構' && !transferFacility) {
      alert('請輸入轉往機構名稱');
      return;
    }
    // 退住時清除床位資訊
    const updatedPatient = {
      ...patient,
      退住日期: dischargeDate,
      在住狀態: '已退住',
      station_id: null,
      bed_id: null,
      discharge_reason: dischargeReason,
      death_date: dischargeReason === '死亡' ? deathDate : null,
      transfer_facility_name: dischargeReason === '轉往其他機構' ? transferFacility : null
    };
    onConfirm(updatedPatient, dischargeDate);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <LogOut className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">院友退住</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
              {patient.院友相片 ? (
                <img 
                  src={patient.院友相片} 
                  alt={patient.中文姓名} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-blue-600 font-medium">{patient.床號}</span>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{patient.中文姓氏}{patient.中文名字}</p>
              <p className="text-sm text-gray-600">床號: {patient.床號}</p>
              {patient.入住日期 && (
                <p className="text-sm text-gray-600">
                  入住日期: {new Date(patient.入住日期).toLocaleDateString('zh-TW')}
                </p>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              退住日期 *
            </label>
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="form-label">退住原因 *</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                dischargeReason === '死亡' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="discharge_reason"
                  value="死亡"
                  checked={dischargeReason === '死亡'}
                  onChange={(e) => setDischargeReason(e.target.value as any)}
                  className="mr-2"
                />
                <Heart className="h-4 w-4 mr-2 text-red-600" />
                <span className="text-sm font-medium">死亡</span>
              </label>
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                dischargeReason === '回家' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="discharge_reason"
                  value="回家"
                  checked={dischargeReason === '回家'}
                  onChange={(e) => setDischargeReason(e.target.value as any)}
                  className="mr-2"
                />
                <Home className="h-4 w-4 mr-2 text-green-600" />
                <span className="text-sm font-medium">回家</span>
              </label>
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                dischargeReason === '留醫' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="discharge_reason"
                  value="留醫"
                  checked={dischargeReason === '留醫'}
                  onChange={(e) => setDischargeReason(e.target.value as any)}
                  className="mr-2"
                />
                <Hospital className="h-4 w-4 mr-2 text-blue-600" />
                <span className="text-sm font-medium">留醫</span>
              </label>
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                dischargeReason === '轉往其他機構' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="discharge_reason"
                  value="轉往其他機構"
                  checked={dischargeReason === '轉往其他機構'}
                  onChange={(e) => setDischargeReason(e.target.value as any)}
                  className="mr-2"
                />
                <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                <span className="text-sm font-medium">轉往其他機構</span>
              </label>
            </div>
          </div>

          {dischargeReason === '死亡' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                死亡日期 *
              </label>
              <input
                type="date"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                className="form-input"
                required
              />
            </div>
          )}

          {dischargeReason === '轉往其他機構' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <label className="form-label">
                <Building2 className="h-4 w-4 inline mr-1" />
                轉往機構名稱 *
              </label>
              <input
                type="text"
                value={transferFacility}
                onChange={(e) => setTransferFacility(e.target.value)}
                className="form-input"
                placeholder="輸入轉往機構名稱"
                required
              />
            </div>
          )}

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800">
              <strong>注意：</strong>退住後，此院友的狀態將變更為「已退住」，
              相關的任務和記錄將不會在預設檢視中顯示。
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-danger flex-1"
            >
              確認退住
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

export default DischargeModal;