import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Guitar as Hospital, MapPin, Bed, User, AlertTriangle, Heart, Building2, FileText } from 'lucide-react';
import { usePatients, type PatientAdmissionRecord, type AdmissionEventType } from '../context/PatientContext';

interface TransferPath {
  id: string;
  transfer_location: string;
  transfer_date: string;
  transfer_time: string;
  remarks?: string;
}

interface DischargeType {
  value: 'home' | 'transfer_out' | 'deceased';
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface EnhancedAdmissionRecordModalProps {
  record?: PatientAdmissionRecord | null;
  onClose: () => void;
}

const EnhancedAdmissionRecordModal: React.FC<EnhancedAdmissionRecordModalProps> = ({
  record,
  onClose
}) => {
  const { 
    patients, 
    addPatientAdmissionRecord, 
    updatePatientAdmissionRecord,
    patientAdmissionRecords 
  } = usePatients();

  // 表單狀態
  const [formData, setFormData] = useState({
    patient_id: record?.patient_id || 0,
    event_type: record?.event_type || 'hospital_admission' as AdmissionEventType,
    event_date: record?.event_date || new Date().toISOString().split('T')[0],
    event_time: record?.event_time || new Date().toTimeString().slice(0, 5),
    hospital_name: record?.hospital_name || '',
    hospital_ward: record?.hospital_ward || '',
    hospital_bed_number: record?.hospital_bed_number || '',
    discharge_type: (record as any)?.discharge_type || 'home',
    date_of_death: (record as any)?.date_of_death || '',
    time_of_death: (record as any)?.time_of_death || '',
    transfer_to_facility_name: (record as any)?.transfer_to_facility_name || '',
    transfer_to_facility_address: (record as any)?.transfer_to_facility_address || '',
    remarks: record?.remarks || ''
  });

  const [transferPaths, setTransferPaths] = useState<TransferPath[]>(
    (record as any)?.transfer_paths?.map((path: any) => ({
      id: path.id || `temp-${Date.now()}-${Math.random()}`,
      transfer_location: path.transfer_location || '',
      transfer_date: path.transfer_date || new Date().toISOString().split('T')[0],
      transfer_time: path.transfer_time || new Date().toTimeString().slice(0, 5),
      remarks: path.remarks || ''
    })) || []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 出院安排選項
  const dischargeTypes: DischargeType[] = [
    {
      value: 'return_to_facility',
      label: '返回院舍',
      description: '院友康復後返回院舍',
      icon: <Building2 className="h-5 w-5" />
    },
    {
      value: 'home',
      label: '回家',
      description: '院友康復後回到原居住地',
      icon: <Building2 className="h-5 w-5" />
    },
    {
      value: 'transfer_out',
      label: '轉院至其他機構',
      description: '轉移至其他醫療或照護機構',
      icon: <Hospital className="h-5 w-5" />
    },
    {
      value: 'deceased',
      label: '離世',
      description: '院友在醫院內離世',
      icon: <Heart className="h-5 w-5" />
    }
  ];

  // 常用醫院列表
  const commonHospitals = [
    '瑪麗醫院',
    '伊利沙伯醫院',
    '廣華醫院',
    '東華醫院',
    '律敦治醫院',
    '聯合醫院',
    '威爾斯親王醫院',
    '沙田醫院',
    '屯門醫院',
    '天水圍醫院'
  ];

  // 驗證表單
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // 基本必填欄位
    if (!formData.patient_id) {
      newErrors.patient_id = '請選擇院友';
    }
    if (!formData.event_date) {
      newErrors.event_date = '請選擇事件日期';
    }
    if (!formData.event_time) {
      newErrors.event_time = '請選擇事件時間';
    }

    // 根據事件類型驗證
    if (formData.event_type === 'hospital_admission' || formData.event_type === 'hospital_discharge') {
      if (!formData.hospital_name) {
        newErrors.hospital_name = '請輸入醫院名稱';
      }
    }

    // 出院安排相關驗證
    if (formData.event_type === 'hospital_discharge') {
      if (formData.discharge_type === 'deceased') {
        if (!formData.date_of_death) {
          newErrors.date_of_death = '請選擇離世日期';
        }
        if (!formData.time_of_death) {
          newErrors.time_of_death = '請選擇離世時間';
        }
      } else if (formData.discharge_type === 'transfer_out') {
        if (!formData.transfer_to_facility_name) {
          newErrors.transfer_to_facility_name = '請輸入轉入機構名稱';
        }
      }
    }

    // 轉院路徑驗證
    if (formData.event_type === 'transfer_out') {
      if (transferPaths.length === 0) {
        newErrors.transfer_paths = '轉院事件至少需要一個轉院路徑';
      } else {
        transferPaths.forEach((path, index) => {
          if (!path.transfer_location) {
            newErrors[`transfer_location_${index}`] = '請輸入轉院地點';
          }
          if (!path.transfer_date) {
            newErrors[`transfer_date_${index}`] = '請選擇轉院日期';
          }
          if (!path.transfer_time) {
            newErrors[`transfer_time_${index}`] = '請選擇轉院時間';
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submitData = {
        ...formData,
       event_time: formData.event_time || null,
        // 將空字串轉換為 null 以避免資料庫錯誤
        date_of_death: formData.date_of_death || null,
       time_of_death: formData.time_of_death || null,
        transfer_paths: formData.event_type === 'transfer_out' 
          ? transferPaths.map(path => ({
              ...path,
             transfer_date: path.transfer_date || null,
             transfer_time: path.transfer_time || null
            }))
          : []
      };

      if (record) {
        await updatePatientAdmissionRecord({ ...submitData, id: record.id });
      } else {
        await addPatientAdmissionRecord(submitData);
      }
      
      onClose();
    } catch (error) {
      console.error('提交出入院記錄失敗:', error);
      alert('提交失敗，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 新增轉院路徑
  const addTransferPath = () => {
    const newPath: TransferPath = {
      id: `temp-${Date.now()}-${Math.random()}`,
      transfer_location: '',
      transfer_date: new Date().toISOString().split('T')[0],
      transfer_time: new Date().toTimeString().slice(0, 5),
      remarks: ''
    };
    setTransferPaths([...transferPaths, newPath]);
  };

  // 刪除轉院路徑
  const removeTransferPath = (id: string) => {
    setTransferPaths(transferPaths.filter(path => path.id !== id));
  };

  // 更新轉院路徑
  const updateTransferPath = (id: string, field: keyof TransferPath, value: string) => {
    setTransferPaths(transferPaths.map(path => 
      path.id === id ? { ...path, [field]: value } : path
    ));
  };

  // 獲取事件類型標籤和顏色
  const getEventTypeInfo = (type: AdmissionEventType) => {
    switch (type) {
      case 'hospital_admission':
        return { label: '入院', color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'hospital_discharge':
        return { label: '出院', color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'transfer_out':
        return { label: '轉院', color: 'text-blue-600', bgColor: 'bg-blue-50' };
      default:
        return { label: type, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  const currentEventInfo = getEventTypeInfo(formData.event_type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 模態框標題 */}
        <div className={`sticky top-0 ${currentEventInfo.bgColor} border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10`}>
          <div className="flex items-center space-x-3">
            <Hospital className={`h-6 w-6 ${currentEventInfo.color}`} />
            <h2 className="text-xl font-semibold text-gray-900">
              {record ? '編輯' : '新增'}出入院記錄
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentEventInfo.color} ${currentEventInfo.bgColor} border`}>
              {currentEventInfo.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本資訊區塊 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-600" />
              基本資訊
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 院友選擇 */}
              <div>
                <label className="form-label">
                  院友 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: parseInt(e.target.value) })}
                  className={`form-input ${errors.patient_id ? 'border-red-300' : ''}`}
                  required
                >
                  <option value={0}>請選擇院友</option>
                  {patients
                    .filter(p => p.在住狀態 === '在住')
                    .map(patient => (
                      <option key={patient.院友id} value={patient.院友id}>
                        {patient.床號} - {patient.中文姓氏}{patient.中文名字}
                      </option>
                    ))}
                </select>
                {errors.patient_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.patient_id}</p>
                )}
              </div>

              {/* 事件類型 */}
              <div>
                <label className="form-label">
                  事件類型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.event_type}
                  onChange={(e) => {
                    const newEventType = e.target.value as AdmissionEventType;
                    setFormData({ 
                      ...formData, 
                      event_type: newEventType,
                      // 重置相關欄位
                      discharge_type: '',
                      date_of_death: '',
                      time_of_death: '',
                      transfer_to_facility_name: '',
                      transfer_to_facility_address: ''
                    });
                    // 如果不是轉院，清空轉院路徑
                    if (newEventType !== 'transfer_out') {
                      setTransferPaths([]);
                    }
                  }}
                  className="form-input"
                  required
                >
                  <option value="hospital_admission">入院</option>
                  <option value="hospital_discharge">出院</option>
                  <option value="transfer_out">轉院</option>
                </select>
              </div>

              {/* 事件日期 */}
              <div>
                <label className="form-label">
                  事件日期 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    className={`form-input pl-10 ${errors.event_date ? 'border-red-300' : ''}`}
                    required
                  />
                </div>
                {errors.event_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.event_date}</p>
                )}
              </div>

              {/* 事件時間 */}
              <div>
                <label className="form-label">
                  事件時間 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                    className={`form-input pl-10 ${errors.event_time ? 'border-red-300' : ''}`}
                    required
                  />
                </div>
                {errors.event_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.event_time}</p>
                )}
              </div>
            </div>
          </div>

          {/* 醫院資訊區塊 */}
          {(formData.event_type === 'hospital_admission' || formData.event_type === 'hospital_discharge') && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Hospital className="h-5 w-5 mr-2 text-blue-600" />
                醫院資訊
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 醫院名稱 */}
                <div className="md:col-span-2">
                  <label className="form-label">
                    {formData.event_type === 'hospital_discharge' && formData.discharge_type === 'transfer_out' 
                      ? '轉出醫院名稱' 
                      : '醫院名稱'} 
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    list="hospital-list"
                    value={formData.hospital_name}
                    onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                    className={`form-input ${errors.hospital_name ? 'border-red-300' : ''}`}
                    placeholder="選擇或輸入醫院名稱"
                    required
                  />
                  <datalist id="hospital-list">
                    {commonHospitals.map(hospital => (
                      <option key={hospital} value={hospital} />
                    ))}
                  </datalist>
                  {errors.hospital_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.hospital_name}</p>
                  )}
                </div>

                {/* 病房 */}
                <div>
                  <label className="form-label">病房</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.hospital_ward}
                      onChange={(e) => setFormData({ ...formData, hospital_ward: e.target.value })}
                      className="form-input pl-10"
                      placeholder="例：內科病房"
                    />
                  </div>
                </div>

                {/* 醫院床號 */}
                <div>
                  <label className="form-label">醫院床號</label>
                  <div className="relative">
                    <Bed className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.hospital_bed_number}
                      onChange={(e) => setFormData({ ...formData, hospital_bed_number: e.target.value })}
                      className="form-input pl-10"
                      placeholder="例：A01"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 出院安排區塊 */}
          {formData.event_type === 'hospital_discharge' && (
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-green-600" />
                出院安排 <span className="text-red-500 ml-1">*</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dischargeTypes.map(type => (
                  <label
                    key={type.value}
                    className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.discharge_type === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <input
                        type="radio"
                        name="discharge_type"
                        value={type.value}
                        checked={formData.discharge_type === type.value}
                        onChange={(e) => setFormData({ ...formData, discharge_type: e.target.value as any })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center space-x-2">
                        {type.icon}
                        <span className="font-medium text-gray-900">{type.label}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{type.description}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 離世資訊區塊 */}
          {formData.event_type === 'hospital_discharge' && formData.discharge_type === 'deceased' && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Heart className="h-5 w-5 mr-2 text-red-600" />
                離世資訊
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    離世日期 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.date_of_death}
                      onChange={(e) => setFormData({ ...formData, date_of_death: e.target.value })}
                      className={`form-input pl-10 ${errors.date_of_death ? 'border-red-300' : ''}`}
                      required
                    />
                  </div>
                  {errors.date_of_death && (
                    <p className="text-red-500 text-sm mt-1">{errors.date_of_death}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">
                    離世時間 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="time"
                      value={formData.time_of_death}
                      onChange={(e) => setFormData({ ...formData, time_of_death: e.target.value })}
                      className={`form-input pl-10 ${errors.time_of_death ? 'border-red-300' : ''}`}
                      required
                    />
                  </div>
                  {errors.time_of_death && (
                    <p className="text-red-500 text-sm mt-1">{errors.time_of_death}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 轉入機構資訊區塊 */}
          {formData.event_type === 'hospital_discharge' && formData.discharge_type === 'transfer_out' && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-purple-600" />
                轉入機構資訊
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    轉入機構名稱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.transfer_to_facility_name}
                    onChange={(e) => setFormData({ ...formData, transfer_to_facility_name: e.target.value })}
                    className={`form-input ${errors.transfer_to_facility_name ? 'border-red-300' : ''}`}
                    placeholder="輸入轉入機構名稱"
                    required
                  />
                  {errors.transfer_to_facility_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.transfer_to_facility_name}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">轉入機構地址</label>
                  <input
                    type="text"
                    value={formData.transfer_to_facility_address}
                    onChange={(e) => setFormData({ ...formData, transfer_to_facility_address: e.target.value })}
                    className="form-input"
                    placeholder="輸入轉入機構地址"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 轉院路徑區塊 */}
          {formData.event_type === 'transfer_out' && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Hospital className="h-5 w-5 mr-2 text-blue-600" />
                  轉院路徑 <span className="text-red-500 ml-1">*</span>
                </h3>
                <button
                  type="button"
                  onClick={addTransferPath}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增轉院路徑</span>
                </button>
              </div>

              {errors.transfer_paths && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
                  <p className="text-red-700 text-sm">{errors.transfer_paths}</p>
                </div>
              )}

              <div className="space-y-4">
                {transferPaths.map((path, index) => (
                  <div key={path.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">轉院路徑 {index + 1}</h4>
                      {transferPaths.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTransferPath(path.id)}
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">
                          轉院地點 <span className="text-red-500">*</span>
                        </label>
                        <input
                          list="transfer-hospital-list"
                          value={path.transfer_location}
                          onChange={(e) => updateTransferPath(path.id, 'transfer_location', e.target.value)}
                          className={`form-input ${errors[`transfer_location_${index}`] ? 'border-red-300' : ''}`}
                          placeholder="輸入轉院醫院名稱"
                          required
                        />
                        <datalist id="transfer-hospital-list">
                          {commonHospitals.map(hospital => (
                            <option key={hospital} value={hospital} />
                          ))}
                        </datalist>
                        {errors[`transfer_location_${index}`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`transfer_location_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="form-label">
                          轉院日期 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={path.transfer_date}
                          onChange={(e) => updateTransferPath(path.id, 'transfer_date', e.target.value)}
                          className={`form-input ${errors[`transfer_date_${index}`] ? 'border-red-300' : ''}`}
                          required
                        />
                        {errors[`transfer_date_${index}`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`transfer_date_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="form-label">
                          轉院時間 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={path.transfer_time}
                          onChange={(e) => updateTransferPath(path.id, 'transfer_time', e.target.value)}
                          className={`form-input ${errors[`transfer_time_${index}`] ? 'border-red-300' : ''}`}
                          required
                        />
                        {errors[`transfer_time_${index}`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`transfer_time_${index}`]}</p>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <label className="form-label">轉院備註</label>
                        <textarea
                          value={path.remarks}
                          onChange={(e) => updateTransferPath(path.id, 'remarks', e.target.value)}
                          className="form-input"
                          rows={2}
                          placeholder="轉院相關備註..."
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {transferPaths.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Hospital className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>尚未新增轉院路徑</p>
                    <p className="text-sm">點擊上方「新增轉院路徑」按鈕開始記錄</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 備註區塊 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-600" />
              備註
            </h3>
            
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="form-input"
              rows={3}
              placeholder="輸入相關備註或特殊說明..."
            />
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className={`btn-primary ${currentEventInfo.color.replace('text-', 'bg-').replace('-600', '-600')} hover:${currentEventInfo.color.replace('text-', 'bg-').replace('-600', '-700')}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>處理中...</span>
                </div>
              ) : (
                record ? '更新記錄' : '新增記錄'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedAdmissionRecordModal;