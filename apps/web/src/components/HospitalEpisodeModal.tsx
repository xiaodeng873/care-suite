import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Guitar as Hospital, MapPin, Bed, User, AlertTriangle, Heart, Building2, FileText, Activity } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface EpisodeEvent {
  id: string;
  event_type: 'admission' | 'transfer' | 'discharge' | 'vacation_start' | 'vacation_end';
  event_date: string;
  event_time: string;
  hospital_name?: string;
  hospital_ward?: string;
  hospital_bed_number?: string;
  remarks?: string;
  vacation_end_type?: string;
}

interface HospitalEpisodeModalProps {
  episode?: any;
  onClose: () => void;
  defaultPatientId?: string;
  defaultEventType?: 'admission' | 'transfer' | 'discharge' | 'vacation_start' | 'vacation_end';
}

const HospitalEpisodeModal: React.FC<HospitalEpisodeModalProps> = ({
  episode,
  onClose,
  defaultPatientId,
  defaultEventType = 'admission'
}) => {
  const { patients, addHospitalEpisode, updateHospitalEpisode, loading } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const getHongKongTime = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[1].slice(0, 5);
  };

  const [formData, setFormData] = useState(() => {

    return {
      patient_id: episode?.patient_id?.toString() || defaultPatientId || '',
      episode_start_date: episode?.episode_start_date || getHongKongDate(),
      episode_end_date: episode?.episode_end_date || '',
      status: episode?.status || 'active',
      primary_hospital: episode?.primary_hospital || '',
      primary_ward: episode?.primary_ward || '',
      primary_bed_number: episode?.primary_bed_number || '',
      discharge_type: episode?.discharge_type || '',
      discharge_destination: episode?.discharge_destination || '',
      vacation_end_type: episode?.vacation_end_type || '',
      date_of_death: episode?.date_of_death || '',
      time_of_death: episode?.time_of_death || '',
      remarks: episode?.remarks || ''
    };
  });

  const [events, setEvents] = useState<EpisodeEvent[]>(() => {

    
    if (episode?.episode_events && Array.isArray(episode.episode_events) && episode.episode_events.length > 0) {
      const processedEvents = episode.episode_events
        .sort((a: any, b: any) => (a.event_order || 0) - (b.event_order || 0))
        .map((event: any, index: number) => {

          return {
            id: event.id || `temp-${Date.now()}-${Math.random()}`,
            event_type: event.event_type,
            event_date: event.event_date,
            event_time: event.event_time || '',
            hospital_name: event.hospital_name || '',
            hospital_ward: event.hospital_ward || '',
            hospital_bed_number: event.hospital_bed_number || '',
            remarks: event.remarks || '',
            vacation_end_type: event.vacation_end_type || ''
          };
        });

      return processedEvents;
    } else {
      // 新建缺席事件時，不預設任何事件，讓用戶自行選擇添加
      return [];
    }
  });

  // 當 episode 資料變更時，重新載入表單資料
  useEffect(() => {
    if (episode) {

      setFormData({
        patient_id: episode.patient_id?.toString() || '',
        episode_start_date: episode.episode_start_date || getHongKongDate(),
        episode_end_date: episode.episode_end_date || '',
        status: episode.status || 'active',
        primary_hospital: episode.primary_hospital || '',
        primary_ward: episode.primary_ward || '',
        primary_bed_number: episode.primary_bed_number || '',
        discharge_type: episode.discharge_type || '',
        discharge_destination: episode.discharge_destination || '',
        vacation_end_type: episode.vacation_end_type || '',
        date_of_death: episode.date_of_death || '',
        time_of_death: episode.time_of_death || '',
        remarks: episode.remarks || ''
      });

      // 重新載入事件資料
      if (episode.episode_events && Array.isArray(episode.episode_events) && episode.episode_events.length > 0) {
        const processedEvents = episode.episode_events
          .sort((a: any, b: any) => (a.event_order || 0) - (b.event_order || 0))
          .map((event: any) => ({
            id: event.id || `temp-${Date.now()}-${Math.random()}`,
            event_type: event.event_type,
            event_date: event.event_date,
            event_time: event.event_time || '',
            hospital_name: event.hospital_name || '',
            hospital_ward: event.hospital_ward || '',
            hospital_bed_number: event.hospital_bed_number || '',
            remarks: event.remarks || '',
            vacation_end_type: event.vacation_end_type || ''
          }));

        setEvents(processedEvents);
      }
    }
  }, [episode]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 等待資料載入完成
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">載入中...</span>
        </div>
      </div>
    );
  }

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

  // 出院類型選項
  const dischargeTypes = [
    { value: 'return_to_facility', label: '返回院舍', description: '院友康復後返回院舍', icon: <Building2 className="h-5 w-5" /> },
    { value: 'home', label: '回家', description: '院友康復後回到原居住地', icon: <Building2 className="h-5 w-5" /> },
    { value: 'transfer_out', label: '轉至其他機構', description: '轉移至其他醫療或照護機構', icon: <MapPin className="h-5 w-5" /> },
    { value: 'deceased', label: '離世', description: '院友在醫院離世', icon: <Heart className="h-5 w-5" /> }
  ];

  // 渡假結束類型選項
  const vacationEndTypes = [
    { value: 'return_to_facility', label: '返回院舍', description: '渡假後返回院舍繼續照護', icon: <Building2 className="h-5 w-5" /> },
    { value: 'home', label: '回到原居住地', description: '渡假後回到原居住地生活', icon: <Building2 className="h-5 w-5" /> },
    { value: 'transfer_out', label: '轉至其他機構', description: '渡假後轉移至其他照護機構', icon: <MapPin className="h-5 w-5" /> },
    { value: 'deceased', label: '渡假期間離世', description: '院友在渡假期間離世', icon: <Heart className="h-5 w-5" /> }
  ];

  // 添加事件
  const addEvent = (eventType: 'admission' | 'transfer' | 'discharge' | 'vacation_start' | 'vacation_end') => {
    const newEvent: EpisodeEvent = {
      id: `temp-${Date.now()}-${Math.random()}`,
      event_type: eventType,
      event_date: getHongKongDate(),
      event_time: getHongKongTime(),
      hospital_name: eventType.startsWith('vacation') ? undefined : '',
      hospital_ward: '',
      hospital_bed_number: '',
      remarks: ''
    };
    setEvents([...events, newEvent]);
  };

  // 刪除事件
  const removeEvent = (id: string) => {
    const eventToRemove = events.find(e => e.id === id);

    // 如果要刪除入院事件，檢查是否有轉院或出院事件依賴它
    if (eventToRemove?.event_type === 'admission') {
      const hasTransferOrDischarge = events.some(e => e.event_type === 'transfer' || e.event_type === 'discharge');
      if (hasTransferOrDischarge) {
        alert('有轉院或出院事件時，不能刪除入院事件');
        return;
      }
    }

    // 如果刪除的是出院事件，重置出院相關資料
    if (eventToRemove?.event_type === 'discharge') {
      setFormData(prev => ({
        ...prev,
        discharge_type: '',
        discharge_destination: '',
        date_of_death: '',
        time_of_death: ''
      }));
    }

    // 如果刪除的是渡假結束事件，重置渡假結束相關資料
    if (eventToRemove?.event_type === 'vacation_end') {
      setFormData(prev => ({
        ...prev,
        vacation_end_type: ''
      }));
    }

    setEvents(events.filter(e => e.id !== id));
  };

  // 更新事件
  const updateEvent = (id: string, field: keyof EpisodeEvent, value: string) => {
    setEvents(events.map(event => 
      event.id === id ? { ...event, [field]: value } : event
    ));
  };

  // 自動更新主要醫院資訊
  useEffect(() => {
    const admissionEvent = events.find(e => e.event_type === 'admission');
    if (admissionEvent) {
      setFormData(prev => ({
        ...prev,
        episode_start_date: admissionEvent.event_date,
        primary_hospital: admissionEvent.hospital_name,
        primary_ward: admissionEvent.hospital_ward || '',
        primary_bed_number: admissionEvent.hospital_bed_number || ''
      }));
    }
  }, [events]);

  // 自動設定住院結束日期
  useEffect(() => {
    const dischargeEvent = events.find(e => e.event_type === 'discharge');
    if (dischargeEvent) {
      setFormData(prev => ({
        ...prev,
        episode_end_date: dischargeEvent.event_date,
        status: 'completed'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        episode_end_date: '',
        status: 'active'
      }));
    }
  }, [events]);

  // 驗證表單
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // 基本必填欄位
    if (!formData.patient_id) {
      newErrors.patient_id = '請選擇院友';
    }

    // 檢查是否至少有一個事件
    if (events.length === 0) {
      newErrors.no_events = '請至少添加一個事件（入院或渡假開始）';
    }

    // 檢查是否有入院事件 - 只有當存在轉院或出院事件時才需要入院事件
    const admissionEvent = events.find(e => e.event_type === 'admission');
    const hasTransferOrDischarge = events.some(e => e.event_type === 'transfer' || e.event_type === 'discharge');

    if (hasTransferOrDischarge && !admissionEvent) {
      newErrors.admission_event = '有轉院或出院事件時，必須先有入院事件';
    }

    // 檢查是否有渡假開始事件 - 只有當存在渡假結束事件時才需要渡假開始事件
    const vacationStartEvent = events.find(e => e.event_type === 'vacation_start');
    const vacationEndEvent = events.find(e => e.event_type === 'vacation_end');

    if (vacationEndEvent && !vacationStartEvent) {
      newErrors.vacation_start_event = '有渡假結束事件時，必須先有渡假開始事件';
    }

    // 驗證事件
    events.forEach((event, index) => {
      if (!event.event_date) {
        newErrors[`event_date_${index}`] = '請選擇事件日期';
      }

      // 驗證醫院名稱（只在非渡假事件時需要）
      if (!event.event_type.startsWith('vacation') && !event.hospital_name) {
        newErrors[`hospital_name_${index}`] = '請輸入醫院名稱';
      }
    });

    // 如果有出院事件，驗證相關資訊
    const dischargeEvent = events.find(e => e.event_type === 'discharge');
    if (dischargeEvent) {
      if (!formData.discharge_type) {
        newErrors.discharge_type = '請選擇出院類型';
      }
      if (formData.discharge_type === 'deceased') {
        if (!formData.date_of_death) {
          newErrors.date_of_death = '請選擇離世日期';
        }
      } else if (formData.discharge_type === 'transfer_out') {
        if (!formData.discharge_destination) {
          newErrors.discharge_destination = '請輸入轉入機構名稱';
        }
      }
    }

    // 如果有渡假結束事件，驗證相關資訊
    if (vacationEndEvent) {
      if (!formData.vacation_end_type) {
        newErrors.vacation_end_type = '請選擇渡假結束類型';
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
      // 將空字符串轉換為 null（日期和時間欄位）
      const cleanFormData = {
        ...formData,
        patient_id: parseInt(formData.patient_id),
        episode_end_date: formData.episode_end_date || null,
        date_of_death: formData.date_of_death || null,
        time_of_death: formData.time_of_death || null,
        discharge_destination: formData.discharge_destination || null,
        discharge_type: formData.discharge_type || null,
        vacation_end_type: formData.vacation_end_type || null
      };

      const submitData = {
        ...cleanFormData,
        events: events.map(event => {
          const { id, ...eventData } = event;
          return {
            ...eventData,
            // 只有編輯現有事件時才包含 id
            ...(id && !id.startsWith('temp-') ? { id } : {}),
            event_time: eventData.event_time || null,
            vacation_end_type: eventData.vacation_end_type || null,
            vacation_destination: eventData.vacation_destination || null,
            vacation_contact: eventData.vacation_contact || null
          };
        })
      };



      if (episode) {
        await updateHospitalEpisode({ ...submitData, id: episode.id });
      } else {
        await addHospitalEpisode(submitData);
      }

      onClose();
    } catch (error: any) {
      console.error('提交住院事件失敗:', error);
      console.error('錯誤類型:', typeof error);
      console.error('錯誤物件:', JSON.stringify(error, null, 2));

      let errorMessage = '提交失敗，請重試';
      if (error?.message) {
        errorMessage = `提交失敗：${error.message}`;
      }
      if (error?.details) {
        errorMessage += `\n詳情：${error.details}`;
      }

      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 獲取事件類型資訊
  const getEventTypeInfo = (type: string) => {
    switch (type) {
      case 'admission':
        return { label: '入院', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
      case 'transfer':
        return { label: '轉院', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
      case 'discharge':
        return { label: '出院', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
      case 'vacation_start':
        return { label: '渡假開始', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' };
      case 'vacation_end':
        return { label: '渡假結束', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
      default:
        return { label: type, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    }
  };

  // 計算住院天數
  const calculateDays = () => {
    if (formData.episode_start_date && formData.episode_end_date) {
      const start = new Date(formData.episode_start_date);
      const end = new Date(formData.episode_end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return null;
  };

  const totalDays = calculateDays();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* 模態框標題 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <Hospital className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {episode ? '編輯缺席事件' : '新增缺席事件'}
              </h2>
              <p className="text-sm text-gray-600">完整記錄從入院到出院的整個過程</p>
            </div>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 院友選擇 */}
              <div>
                <label className="form-label">
                  院友 <span className="text-red-500">*</span>
                </label>
                <PatientAutocomplete
                  value={formData.patient_id}
                  onChange={(patientId) => setFormData({ ...formData, patient_id: patientId })}
                  placeholder="搜索院友..."
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
                {patients.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    沒有可選擇的院友，請先在院友記錄中新增院友
                  </p>
                )}
                {errors.patient_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.patient_id}</p>
                )}
              </div>

              {/* 住院日期資訊顯示 */}
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">住院日期資訊</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-blue-700">住院開始：</span>
                      <span className="font-medium text-blue-900">
                        {(() => {
                          const admissionEvent = events.find(e => e.event_type === 'admission');
                          return admissionEvent 
                            ? `${new Date(admissionEvent.event_date).toLocaleDateString('zh-TW')} ${admissionEvent.event_time || ''}`
                            : '待設定入院事件';
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700">住院結束：</span>
                      <span className="font-medium text-blue-900">
                        {(() => {
                          const dischargeEvent = events.find(e => e.event_type === 'discharge');
                          return dischargeEvent 
                            ? `${new Date(dischargeEvent.event_date).toLocaleDateString('zh-TW')} ${dischargeEvent.event_time || ''}`
                            : '入院中';
                        })()}
                      </span>
                    </div>
                    {totalDays && (
                      <div className="md:col-span-2">
                        <span className="text-blue-700">缺席天數：</span>
                        <span className="font-medium text-blue-900">{totalDays} 天</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    💡 住院日期自動從入院和出院事件計算
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 事件時間軸 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-blue-600" />
                事件時間軸
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addEvent('admission')}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                  disabled={events.some(e => e.event_type === 'admission')}
                >
                  <Plus className="h-4 w-4" />
                  <span>新增入院</span>
                </button>
                <button
                  type="button"
                  onClick={() => addEvent('transfer')}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增轉院</span>
                </button>
                <button
                  type="button"
                  onClick={() => addEvent('discharge')}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                  disabled={events.some(e => e.event_type === 'discharge')}
                >
                  <Plus className="h-4 w-4" />
                  <span>新增出院</span>
                </button>
                 <button
                  type="button"
                  onClick={() => addEvent('vacation_start')}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                  disabled={events.some(e => e.event_type === 'vacation_start')}
                >
                  <Plus className="h-4 w-4" />
                  <span>渡假開始</span>
                </button>
                <button
                  type="button"
                  onClick={() => addEvent('vacation_end')}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                  disabled={
                    events.some(e => e.event_type === 'vacation_end') ||
                    !events.some(e => e.event_type === 'vacation_start')
                  }
                  title={!events.some(e => e.event_type === 'vacation_start') ? '必須先新增渡假開始事件' : ''}
                >
                  <Plus className="h-4 w-4" />
                  <span>渡假結束</span>
                </button>
              </div>
            </div>

            {/* 全局錯誤提示 */}
            {(errors.no_events || errors.admission_event || errors.vacation_start_event) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {errors.no_events && <p className="text-red-700 text-sm">{errors.no_events}</p>}
                    {errors.admission_event && <p className="text-red-700 text-sm">{errors.admission_event}</p>}
                    {errors.vacation_start_event && <p className="text-red-700 text-sm">{errors.vacation_start_event}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {events.map((event, index) => {
                const eventInfo = getEventTypeInfo(event.event_type);
                
                return (
                  <div key={event.id} className={`${eventInfo.bgColor} ${eventInfo.borderColor} border rounded-lg p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${eventInfo.color} ${eventInfo.bgColor} border ${eventInfo.borderColor}`}>
                          {index + 1}. {eventInfo.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvent(event.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* 事件日期 */}
                      <div>
                        <label className="form-label">
                          事件日期 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="date"
                            value={event.event_date}
                            onChange={(e) => updateEvent(event.id, 'event_date', e.target.value)}
                            className={`form-input pl-10 ${errors[`event_date_${index}`] ? 'border-red-300' : ''}`}
                            required
                          />
                        </div>
                        {errors[`event_date_${index}`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`event_date_${index}`]}</p>
                        )}
                      </div>

                      {/* 事件時間 */}
                      {event.event_type !== 'transfer' && (
                        <div>
                          <label className="form-label">事件時間</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="time"
                              value={event.event_time}
                              onChange={(e) => updateEvent(event.id, 'event_time', e.target.value)}
                              className="form-input pl-10"
                            />
                          </div>
                        </div>
                      )}

                      {/* 醫院相關欄位 - 只在非渡假事件時顯示 */}
                      {!event.event_type.startsWith('vacation') && (
                        <>
                          {/* 醫院名稱 - 調整 grid 佈局 */}
                          <div className={event.event_type === 'transfer' ? 'md:col-span-2' : ''}>
                            <label className="form-label">
                              醫院名稱 <span className="text-red-500">*</span>
                            </label>
                            <input
                              list="hospital-list"
                              value={event.hospital_name || ''}
                              onChange={(e) => updateEvent(event.id, 'hospital_name', e.target.value)}
                              className={`form-input ${errors[`hospital_name_${index}`] ? 'border-red-300' : ''}`}
                              placeholder="選擇或輸入醫院名稱"
                              required
                            />
                            <datalist id="hospital-list">
                              {commonHospitals.map(hospital => (
                                <option key={hospital} value={hospital} />
                              ))}
                            </datalist>
                            {errors[`hospital_name_${index}`] && (
                              <p className="text-red-500 text-sm mt-1">{errors[`hospital_name_${index}`]}</p>
                            )}
                          </div>

                          {/* 病房 */}
                          <div>
                            <label className="form-label">病房</label>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                value={event.hospital_ward || ''}
                                onChange={(e) => updateEvent(event.id, 'hospital_ward', e.target.value)}
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
                                value={event.hospital_bed_number || ''}
                                onChange={(e) => updateEvent(event.id, 'hospital_bed_number', e.target.value)}
                                className="form-input pl-10"
                                placeholder="例：A01"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* 事件備註 */}
                      <div className="md:col-span-3">
                        <label className="form-label">事件備註</label>
                        <textarea
                          value={event.remarks || ''}
                          onChange={(e) => updateEvent(event.id, 'remarks', e.target.value)}
                          className="form-input"
                          rows={1}
                          placeholder="此事件的相關備註..."
                        />
                      </div>

                      {/* 出院類型選擇 - 只在出院事件中顯示 */}
                      {event.event_type === 'discharge' && (
                        <div className="md:col-span-3 lg:col-span-4">
                          <label className="form-label">
                            出院類型 <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                            {dischargeTypes.map(type => (
                              <label
                                key={type.value}
                                className={`relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                  formData.discharge_type === type.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center space-x-2 mb-1">
                                  <input
                                    type="radio"
                                    name="discharge_type"
                                    value={type.value}
                                    checked={formData.discharge_type === type.value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, discharge_type: e.target.value as any }))}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex items-center space-x-1">
                                    {type.icon}
                                    <span className="font-medium text-gray-900 text-sm">{type.label}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 ml-6">{type.description}</p>
                              </label>
                            ))}
                          </div>

                          {/* 離世資訊 */}
                          {formData.discharge_type === 'deceased' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="md:col-span-2">
                                <h5 className="text-sm font-medium text-red-900 mb-2">離世資訊</h5>
                              </div>
                              <div>
                                <label className="form-label">
                                  離世日期 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={formData.date_of_death}
                                  onChange={(e) => setFormData({ ...formData, date_of_death: e.target.value })}
                                  className={`form-input ${errors.date_of_death ? 'border-red-300' : ''}`}
                                  required
                                />
                                {errors.date_of_death && (
                                  <p className="text-red-500 text-sm mt-1">{errors.date_of_death}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 轉入機構資訊 */}
                          {formData.discharge_type === 'transfer_out' && (
                            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <h5 className="text-sm font-medium text-purple-900 mb-2">轉入機構資訊</h5>
                              <div>
                                <label className="form-label">
                                  轉入機構名稱 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={formData.discharge_destination}
                                  onChange={(e) => setFormData({ ...formData, discharge_destination: e.target.value })}
                                  className={`form-input ${errors.discharge_destination ? 'border-red-300' : ''}`}
                                  placeholder="輸入轉入機構名稱"
                                  required
                                />
                                {errors.discharge_destination && (
                                  <p className="text-red-500 text-sm mt-1">{errors.discharge_destination}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 渡假結束類型選擇 - 只在渡假結束事件中顯示 */}
                      {event.event_type === 'vacation_end' && (
                        <div className="md:col-span-3 lg:col-span-4">
                          <label className="form-label">
                            渡假結束類型 <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                            {vacationEndTypes.map(type => (
                              <label
                                key={type.value}
                                className={`relative flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                  formData.vacation_end_type === type.value
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center space-x-2 mb-1">
                                  <input
                                    type="radio"
                                    name="vacation_end_type"
                                    value={type.value}
                                    checked={formData.vacation_end_type === type.value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, vacation_end_type: e.target.value as any }))}
                                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                                  />
                                  <div className="flex items-center space-x-1">
                                    {type.icon}
                                    <span className="font-medium text-gray-900 text-sm">{type.label}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 ml-6">{type.description}</p>
                              </label>
                            ))}
                          </div>
                          {errors.vacation_end_type && (
                            <p className="text-red-500 text-sm mt-1">{errors.vacation_end_type}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {events.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">請點擊上方按鈕添加第一個事件</p>
                  <p className="text-xs mt-1">您可以選擇「新增入院」或「新增渡假開始」作為起始事件</p>
                </div>
              )}
            </div>
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
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>處理中...</span>
                </div>
              ) : (
                episode ? '更新缺席事件' : '新增缺席事件'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HospitalEpisodeModal;