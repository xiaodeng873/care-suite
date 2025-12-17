import React, { useState, useEffect } from 'react';
import { X, CalendarCheck, Clock, MapPin, User, Car, UserCheck, MessageSquare, Copy } from 'lucide-react';
import { usePatients, type FollowUpAppointment } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import OCRDocumentBlock from './OCRDocumentBlock';

interface FollowUpModalProps {
  appointment?: FollowUpAppointment;
  onClose: () => void;
}

export default function FollowUpModal({ appointment, onClose }: FollowUpModalProps) {
  const { patients, addFollowUpAppointment, updateFollowUpAppointment } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    院友id: appointment?.院友id || '',
    覆診日期: appointment?.覆診日期 || getHongKongDate(),
    出發時間: appointment?.出發時間 || '',
    覆診時間: appointment?.覆診時間 || '',
    覆診地點: appointment?.覆診地點 || '',
    覆診專科: appointment?.覆診專科 || '',
    交通安排: appointment?.交通安排 || '',
    陪診人員: appointment?.陪診人員 || '',
    備註: appointment?.備註 || '',
    狀態: appointment?.狀態 || '' as '' | '已安排' | '已完成' | '改期' | '取消'
  });

  const [notificationMessage, setNotificationMessage] = useState('');
  const [ocrError, setOcrError] = useState<string>('');

  const handleOCRComplete = (extractedData: any) => {
    setOcrError('');

    const updates: any = {};

    if (extractedData.院友id || extractedData.patient_id) {
      updates.院友id = String(extractedData.院友id || extractedData.patient_id);
    }
    if (extractedData.覆診日期 || extractedData.followup_date) {
      updates.覆診日期 = extractedData.覆診日期 || extractedData.followup_date;
    }
    if (extractedData.覆診時間 || extractedData.followup_time) {
      updates.覆診時間 = extractedData.覆診時間 || extractedData.followup_time;
    }
    if (extractedData.覆診地點 || extractedData.followup_location) {
      updates.覆診地點 = extractedData.覆診地點 || extractedData.followup_location;
    }
    if (extractedData.覆診專科 || extractedData.specialty) {
      updates.覆診專科 = extractedData.覆診專科 || extractedData.specialty;
    }
    if (extractedData.出發時間 || extractedData.departure_time) {
      updates.出發時間 = extractedData.出發時間 || extractedData.departure_time;
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  // 醫院名稱選項
  const hospitalOptions = [
    '廣華醫院',
    '伊利沙伯醫院',
    '九龍醫院',
    '葵涌醫院',
    '瑪嘉烈醫院',
    '威爾斯醫院',
    '聯合醫院',
    '明愛醫院'
  ];

  // 交通安排選項
  const transportOptions = [
    '',
    '輪椅的士',
    '普通的士',
    '非緊急車',
    '無需安排'
  ];

  // 陪診人員選項
  const companionOptions = [
    '',
    '家人',
    '陪診員',
    '無需陪診'
  ];

  // 更新通知訊息
  useEffect(() => {
    if (formData.院友id && formData.覆診日期 && formData.覆診時間 && formData.覆診地點 && formData.覆診專科) {
      const patient = patients.find(p => p.院友id === parseInt(formData.院友id));
      if (patient) {
        const message = `您好！這是善頤福群護老院C站的信息：${patient.中文姓氏}${patient.中文名字}將於${new Date(formData.覆診日期).toLocaleDateString('zh-TW')}的${formData.覆診時間.slice(0, 5)}，於${formData.覆診地點}有${formData.覆診專科}的醫療安排。請問需要輪椅的士代步/陪診員嗎？請盡快告知您的安排，謝謝！`;
        setNotificationMessage(message);
      }
    } else {
      setNotificationMessage('');
    }
  }, [formData.院友id, formData.覆診日期, formData.覆診時間, formData.覆診地點, formData.覆診專科, patients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 驗證必填欄位 - 新增覆診地點和覆診專科的驗證
    if (!formData.院友id) {
      alert('請選擇院友');
      return;
    }
    
    if (!formData.覆診日期) {
      alert('請填寫覆診日期');
      return;
    }
    
    if (!formData.覆診地點 || formData.覆診地點.trim() === '') {
      alert('請填寫覆診地點');
      return;
    }
    
    if (!formData.覆診專科 || formData.覆診專科.trim() === '') {
      alert('請填寫覆診專科');
      return;
    }

    // 如果狀態是改期或取消，檢查是否有備註
    if ((formData.狀態 === '改期' || formData.狀態 === '取消') && !formData.備註.trim()) {
      alert(`${formData.狀態}狀態需要填寫備註說明原因`);
      return;
    }

    try {
      const appointmentData = {
        院友id: parseInt(formData.院友id),
        覆診日期: formData.覆診日期,
        出發時間: formData.出發時間 || null,
        覆診時間: formData.覆診時間 || null,
        覆診地點: formData.覆診地點 || null,
        覆診專科: formData.覆診專科 || null,
        交通安排: formData.交通安排 || null,
        陪診人員: formData.陪診人員 || null,
        備註: formData.備註 || null,
        狀態: formData.狀態 || null
      };

      if (appointment) {
        await updateFollowUpAppointment({
          覆診id: appointment.覆診id,
          創建時間: appointment.創建時間,
          更新時間: appointment.更新時間,
          ...appointmentData
        });
      } else {
        await addFollowUpAppointment(appointmentData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存覆診安排失敗:', error);
      alert('儲存覆診安排失敗，請重試');
    }
  };

  const copyNotificationMessage = () => {
    if (notificationMessage) {
      navigator.clipboard.writeText(notificationMessage);
      alert('通知訊息已複製到剪貼簿');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '尚未安排': return 'text-red-600';
      case '已安排': return 'text-blue-600';
      case '已完成': return 'text-green-600';
      case '改期': return 'text-orange-600';
      case '取消': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CalendarCheck className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {appointment ? '編輯覆診安排' : '新增覆診安排'}
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
          <OCRDocumentBlock
            documentType="followup"
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
              <span className="text-red-600 text-sm">{ocrError}</span>
            </div>
          )}

          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.院友id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, 院友id: patientId }))}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>

            <div>
              <label className="form-label">
                <CalendarCheck className="h-4 w-4 inline mr-1" />
                覆診日期 *
              </label>
              <input
                type="date"
                name="覆診日期"
                value={formData.覆診日期}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* 時間安排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Clock className="h-4 w-4 inline mr-1" />
                出發時間
              </label>
              <input
                type="time"
                name="出發時間"
                value={formData.出發時間}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                <Clock className="h-4 w-4 inline mr-1" />
                覆診時間
              </label>
              <input
                type="time"
                name="覆診時間"
                value={formData.覆診時間}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* 地點和專科 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <MapPin className="h-4 w-4 inline mr-1" />
                覆診地點 *
              </label>
              <input
                list="hospital-options"
                name="覆診地點"
                value={formData.覆診地點}
                onChange={handleChange}
                className="form-input"
                placeholder="選擇或輸入醫院名稱"
                required
              />
              <datalist id="hospital-options">
                {hospitalOptions.map(hospital => (
                  <option key={hospital} value={hospital} className={hospital === '尚未安排' ? 'text-red-600' : ''} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">覆診專科 *</label>
              <input
                type="text"
                name="覆診專科"
                value={formData.覆診專科}
                onChange={handleChange}
                className="form-input"
                placeholder="如：內科、眼科、骨科等"
                required
              />
            </div>
          </div>

          {/* 交通和陪診安排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Car className="h-4 w-4 inline mr-1" />
                交通安排
              </label>
              <input
                list="transport-options"
                name="交通安排"
                value={formData.交通安排}
                onChange={handleChange}
                className="form-input"
              />
              <datalist id="transport-options">
                {transportOptions.map(option => (
                  <option key={option} value={option} className={option === '尚未安排' ? 'text-red-600' : ''} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">
                <UserCheck className="h-4 w-4 inline mr-1" />
                陪診人員
              </label>
              <input
                list="companion-options"
                name="陪診人員"
                value={formData.陪診人員}
                onChange={handleChange}
                className="form-input"
              />
              <datalist id="companion-options">
                {companionOptions.map(option => (
                  <option key={option} value={option} className={option === '尚未安排' ? 'text-red-600' : ''} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 狀態 */}
          <div>
            <label className="form-label">狀態</label>
            <select
              name="狀態"
              value={formData.狀態}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">請選擇狀態</option>
              <option value="尚未安排" className="text-red-600">尚未安排</option>
              <option value="已安排">已安排</option>
              <option value="已完成">已完成</option>
              <option value="改期">改期</option>
              <option value="取消">取消</option>
            </select>
            {(formData.狀態 === '改期' || formData.狀態 === '取消') && (
              <p className="text-sm text-orange-600 mt-1">
                此狀態需要在備註中說明原因
              </p>
            )}
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              備註
            </label>
            <textarea
              name="備註"
              value={formData.備註}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="補充說明、注意事項等..."
            />
          </div>

          {/* 通知訊息 */}
          {notificationMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-blue-900">覆診安排通知訊息</h3>
                <button
                  type="button"
                  onClick={copyNotificationMessage}
                  className="text-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                >
                  <Copy className="h-4 w-4" />
                  <span>複製</span>
                </button>
              </div>
              <div className="bg-white border border-blue-200 rounded p-3 text-sm text-gray-700">
                {notificationMessage}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                此訊息可複製到 WhatsApp 發送給家屬確認安排
              </p>
            </div>
          )}

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {appointment ? '更新覆診安排' : '新增覆診安排'}
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
}