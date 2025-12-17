import React, { useState } from 'react';
import { X, ChevronFirst as FirstAid, Calendar, User, MapPin, Ruler, Droplets, Thermometer, Eye, Palette, Plus, Trash2 } from 'lucide-react';
import { usePatients, type WoundAssessment } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import HumanBodyDiagram from './HumanBodyDiagram';
import WoundPhotoUpload from './WoundPhotoUpload';

interface WoundAssessmentModalProps {
  assessment?: WoundAssessment | null;
  onClose: () => void;
}

const WoundAssessmentModal: React.FC<WoundAssessmentModalProps> = ({ assessment, onClose }) => {
  const { addWoundAssessment, updateWoundAssessment } = usePatients();
  const { displayName } = useAuth();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: assessment?.patient_id || '',
    assessment_date: assessment?.assessment_date || getHongKongDate(),
    next_assessment_date: assessment?.next_assessment_date || '',
    assessor: assessment?.assessor || displayName || ''
  });

  // 傷口詳細資料狀態
  const [wounds, setWounds] = useState(() => {
    if (assessment?.wound_details && assessment.wound_details.length > 0) {
      return assessment.wound_details.map(detail => ({
        wound_location: detail.wound_location || { x: 0, y: 0, side: 'front' as 'front' | 'back' },
        area_length: detail.area_length,
        area_width: detail.area_width,
        area_depth: detail.area_depth,
        stage: detail.stage || '',
        wound_type: detail.wound_type || '',
        wound_status: detail.wound_status || '未處理',
        responsible_unit: detail.responsible_unit || '本院',
        wound_photos: detail.wound_photos || [],
        exudate_present: detail.exudate_present || false,
        exudate_amount: detail.exudate_amount || '',
        exudate_color: detail.exudate_color || '',
        exudate_type: detail.exudate_type || '',
        odor: detail.odor || '無',
        granulation: detail.granulation || '無',
        necrosis: detail.necrosis || '無',
        infection: detail.infection || '無',
        temperature: detail.temperature || '正常',
        surrounding_skin_condition: detail.surrounding_skin_condition || '',
        surrounding_skin_color: detail.surrounding_skin_color || '',
        cleanser: detail.cleanser || 'Normal Saline',
        cleanser_other: detail.cleanser_other || '',
        dressings: detail.dressings || [],
        dressing_other: detail.dressing_other || '',
        remarks: detail.remarks || ''
      }));
    } else {
      // 預設一個空的傷口記錄
      return [{
        wound_location: { x: 0, y: 0, side: 'front' as 'front' | 'back' },
        area_length: undefined,
        area_width: undefined,
        area_depth: undefined,
        stage: '',
        wound_type: '',
        wound_status: '未處理',
        responsible_unit: '本院',
        wound_photos: [],
        exudate_present: false,
        exudate_amount: '',
        exudate_color: '',
        exudate_type: '',
        odor: '無',
        granulation: '無',
        necrosis: '無',
        infection: '無',
        temperature: '正常',
        surrounding_skin_condition: '',
        surrounding_skin_color: '',
        cleanser: 'Normal Saline',
        cleanser_other: '',
        dressings: [],
        dressing_other: '',
        remarks: ''
      }];
    }
  });
  // 計算下次評估日期（每週一次）
  React.useEffect(() => {
    if (formData.assessment_date) {
      const nextDate = new Date(formData.assessment_date);
      nextDate.setDate(nextDate.getDate() + 7);
      setFormData(prev => ({
        ...prev,
        next_assessment_date: nextDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.assessment_date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 傷口管理函數
  const addWound = () => {
    setWounds(prev => [...prev, {
      wound_location: { x: 0, y: 0, side: 'front' as 'front' | 'back' },
      area_length: undefined,
      area_width: undefined,
      area_depth: undefined,
      stage: '',
      wound_type: '',
      wound_status: '未處理',
      responsible_unit: '本院',
      wound_photos: [],
      exudate_present: false,
      exudate_amount: '',
      exudate_color: '',
      exudate_type: '',
      odor: '無',
      granulation: '無',
      necrosis: '無',
      infection: '無',
      temperature: '正常',
      surrounding_skin_condition: '',
      surrounding_skin_color: '',
      cleanser: 'Normal Saline',
      cleanser_other: '',
      dressings: [],
      dressing_other: '',
      remarks: ''
    }]);
  };

  const removeWound = (index: number) => {
    if (wounds.length > 1) {
      setWounds(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateWound = (index: number, field: string, value: any) => {
    setWounds(prev => prev.map((wound, i) => 
      i === index ? { ...wound, [field]: value } : wound
    ));
  };

  const handleWoundLocationChange = (index: number, location: { x: number; y: number; side: 'front' | 'back' }) => {
    updateWound(index, 'wound_location', location);
  };

  const handleDressingChange = (index: number, dressing: string, checked: boolean) => {
    const currentDressings = wounds[index].dressings;
    const newDressings = checked
      ? [...currentDressings, dressing]
      : currentDressings.filter(d => d !== dressing);
    updateWound(index, 'dressings', newDressings);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    try {
      const assessmentData = {
        patient_id: parseInt(formData.patient_id),
        assessment_date: formData.assessment_date,
        next_assessment_date: formData.next_assessment_date || null,
        assessor: formData.assessor || null,
        wound_details: wounds.map(wound => ({
          wound_location: wound.wound_location,
          wound_photos: wound.wound_photos,
          area_length: wound.area_length || null,
          area_width: wound.area_width || null,
          area_depth: wound.area_depth || null,
          stage: wound.stage || null,
          wound_type: wound.wound_type || null,
          wound_status: wound.wound_status || '未處理',
          responsible_unit: wound.responsible_unit || '本院',
          exudate_present: wound.exudate_present,
          exudate_amount: wound.exudate_present ? wound.exudate_amount || null : null,
          exudate_color: wound.exudate_present ? wound.exudate_color || null : null,
          exudate_type: wound.exudate_present ? wound.exudate_type || null : null,
          odor: wound.odor,
          granulation: wound.granulation,
          necrosis: wound.necrosis,
          infection: wound.infection,
          temperature: wound.temperature,
          surrounding_skin_condition: wound.surrounding_skin_condition || null,
          surrounding_skin_color: wound.surrounding_skin_color || null,
          cleanser: wound.cleanser,
          cleanser_other: wound.cleanser === '其他' ? wound.cleanser_other || null : null,
          dressings: wound.dressings,
          dressing_other: wound.dressing_other || null,
          remarks: wound.remarks || null
        }))
      };

      if (assessment?.id) {
        await updateWoundAssessment({
          id: assessment.id,
          ...assessmentData
        });
      } else {
        await addWoundAssessment(assessmentData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存傷口評估失敗:', error);
      alert('儲存傷口評估失敗，請重試');
    }
  };

  const dressingOptions = [
    'Gauze',
    'Adhesive Pad',
    'Parafin Gauze',
    'Alginate',
    'HydroGel',
    'Duoderm',
    'Omifix',
    'Tegaderm'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-red-100">
                <FirstAid className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {assessment ? '編輯傷口評估' : '新增傷口評估'}
              </h2>
              {assessment && (
                <span className={`px-3 py-1 text-sm rounded-full ${
                  assessment.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {assessment.status === 'active' ? '生效中' : '已歸檔'}
                </span>
              )}
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
          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, patient_id: patientId }))}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>

            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                評估日期 *
              </label>
              <input
                type="date"
                name="assessment_date"
                value={formData.assessment_date}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                下次評估日期
              </label>
              <input
                type="date"
                name="next_assessment_date"
                value={formData.next_assessment_date}
                onChange={handleChange}
                className="form-input bg-gray-50"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">
                自動計算：評估日期 + 7天
              </p>
            </div>
          </div>

          <div>
            <label className="form-label">評估者</label>
            <input
              type="text"
              name="assessor"
              value={formData.assessor}
              onChange={handleChange}
              className="form-input"
              placeholder="輸入評估者姓名"
            />
          </div>

          {/* 傷口詳細資料 */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">傷口詳細資料</h3>
              <button
                type="button"
                onClick={addWound}
                className="btn-secondary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>新增傷口</span>
              </button>
            </div>

            {wounds.map((wound, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-800">
                    傷口 #{index + 1}
                  </h4>
                  {wounds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeWound(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* 傷口位置 - 人形圖 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                    傷口位置
                  </h5>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <HumanBodyDiagram
                      selectedLocation={wound.wound_location}
                      onLocationChange={(location) => handleWoundLocationChange(index, location)}
                    />
                  </div>
                </div>

                {/* 傷口相片 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <Eye className="h-5 w-5 mr-2 text-purple-600" />
                    傷口相片
                  </h5>
                  <WoundPhotoUpload
                    photos={wound.wound_photos}
                    onPhotosChange={(photos) => updateWound(index, 'wound_photos', photos)}
                    maxPhotos={3}
                  />
                </div>

                {/* 面積測量 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <Ruler className="h-5 w-5 mr-2 text-green-600" />
                    面積測量 (cm)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">長度</label>
                      <input
                        type="number"
                        value={wound.area_length || ''}
                        onChange={(e) => updateWound(index, 'area_length', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="form-input"
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="form-label">闊度</label>
                      <input
                        type="number"
                        value={wound.area_width || ''}
                        onChange={(e) => updateWound(index, 'area_width', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="form-input"
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="form-label">深度</label>
                      <input
                        type="number"
                        value={wound.area_depth || ''}
                        onChange={(e) => updateWound(index, 'area_depth', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="form-input"
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* 階段評估 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">階段</label>
                    <select
                      value={wound.stage}
                      onChange={(e) => updateWound(index, 'stage', e.target.value)}
                      className="form-input"
                    >
                      <option value="">請選擇階段</option>
                      <option value="階段1">階段1</option>
                      <option value="階段2">階段2</option>
                      <option value="階段3">階段3</option>
                      <option value="階段4">階段4</option>
                      <option value="無法評估">無法評估</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">傷口狀態</label>
                    <select
                      value={wound.wound_status}
                      onChange={(e) => updateWound(index, 'wound_status', e.target.value)}
                      className="form-input"
                    >
                      <option value="未處理">未處理</option>
                      <option value="治療中">治療中</option>
                      <option value="已痊癒">已痊癒</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">負責單位</label>
                    <select
                      value={wound.responsible_unit}
                      onChange={(e) => updateWound(index, 'responsible_unit', e.target.value)}
                      className="form-input"
                    >
                      <option value="本院">本院</option>
                      <option value="社康">社康</option>
                    </select>
                  </div>
                </div>

                {/* 傷口評估 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <Droplets className="h-5 w-5 mr-2 text-blue-600" />
                    傷口評估
                  </h5>

                  {/* 傷口類型 */}
                  <div className="ml-4">
                    <label className="form-label">傷口類型</label>
                    <select
                      value={wound.wound_type || ''}
                      onChange={(e) => updateWound(index, 'wound_type', e.target.value)}
                      className="form-input"
                    >
                      <option value="">請選擇</option>
                      <option value="壓力性">壓力性</option>
                      <option value="手術性">手術性</option>
                      <option value="撕裂">撕裂</option>
                      <option value="擦損">擦損</option>
                      <option value="割傷">割傷</option>
                      <option value="挫傷">挫傷</option>
                    </select>
                  </div>

                  {/* 滲出物評估子區塊 */}
                  <div className="ml-4 space-y-3">
                    <h6 className="text-sm font-medium text-gray-800">滲出物評估</h6>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`exudate_present_${index}`}
                        checked={wound.exudate_present}
                        onChange={(e) => updateWound(index, 'exudate_present', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`exudate_present_${index}`} className="text-sm font-medium text-gray-700">
                        有滲出物
                      </label>
                    </div>

                    {wound.exudate_present && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-7">
                        <div>
                          <label className="form-label">量</label>
                          <select
                            value={wound.exudate_amount}
                            onChange={(e) => updateWound(index, 'exudate_amount', e.target.value)}
                            className="form-input"
                          >
                            <option value="">請選擇</option>
                            <option value="無">無</option>
                            <option value="少">少</option>
                            <option value="中">中</option>
                            <option value="多">多</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">顏色</label>
                          <select
                            value={wound.exudate_color}
                            onChange={(e) => updateWound(index, 'exudate_color', e.target.value)}
                            className="form-input"
                          >
                            <option value="">請選擇</option>
                            <option value="紅色">紅色</option>
                            <option value="黃色">黃色</option>
                            <option value="綠色">綠色</option>
                            <option value="透明">透明</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">種類</label>
                          <select
                            value={wound.exudate_type}
                            onChange={(e) => updateWound(index, 'exudate_type', e.target.value)}
                            className="form-input"
                          >
                            <option value="">請選擇</option>
                            <option value="血">血</option>
                            <option value="膿">膿</option>
                            <option value="血清">血清</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 傷口特徵 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <Eye className="h-5 w-5 mr-2 text-purple-600" />
                    傷口特徵
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">氣味</label>
                      <select
                        value={wound.odor}
                        onChange={(e) => updateWound(index, 'odor', e.target.value)}
                        className="form-input"
                      >
                        <option value="無">無</option>
                        <option value="有">有</option>
                        <option value="惡臭">惡臭</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">肉芽</label>
                      <select
                        value={wound.granulation}
                        onChange={(e) => updateWound(index, 'granulation', e.target.value)}
                        className="form-input"
                      >
                        <option value="無">無</option>
                        <option value="紅色">紅色</option>
                        <option value="粉紅色">粉紅色</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">壞死</label>
                      <select
                        value={wound.necrosis}
                        onChange={(e) => updateWound(index, 'necrosis', e.target.value)}
                        className="form-input"
                      >
                        <option value="無">無</option>
                        <option value="黑色">黑色</option>
                        <option value="啡色">啡色</option>
                        <option value="黃色">黃色</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">感染</label>
                      <select
                        value={wound.infection}
                        onChange={(e) => updateWound(index, 'infection', e.target.value)}
                        className="form-input"
                      >
                        <option value="無">無</option>
                        <option value="懷疑">懷疑</option>
                        <option value="有">有</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">
                        <Thermometer className="h-4 w-4 inline mr-1" />
                        體溫
                      </label>
                      <select
                        value={wound.temperature}
                        onChange={(e) => updateWound(index, 'temperature', e.target.value)}
                        className="form-input"
                      >
                        <option value="正常">正常</option>
                        <option value="上升">上升</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 周邊皮膚 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900 flex items-center">
                    <Palette className="h-5 w-5 mr-2 text-orange-600" />
                    周邊皮膚
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">周邊皮膚狀況</label>
                      <select
                        value={wound.surrounding_skin_condition}
                        onChange={(e) => updateWound(index, 'surrounding_skin_condition', e.target.value)}
                        className="form-input"
                      >
                        <option value="">請選擇</option>
                        <option value="健康及柔軟">健康及柔軟</option>
                        <option value="腫脹">腫脹</option>
                        <option value="僵硬">僵硬</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">周邊皮膚顏色</label>
                      <select
                        value={wound.surrounding_skin_color}
                        onChange={(e) => updateWound(index, 'surrounding_skin_color', e.target.value)}
                        className="form-input"
                      >
                        <option value="">請選擇</option>
                        <option value="紅色">紅色</option>
                        <option value="紅白色">紅白色</option>
                        <option value="黑色">黑色</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 護理處理 */}
                <div className="space-y-4">
                  <h5 className="text-md font-medium text-gray-900">護理處理</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">洗劑</label>
                      <select
                        value={wound.cleanser}
                        onChange={(e) => updateWound(index, 'cleanser', e.target.value)}
                        className="form-input"
                      >
                        <option value="Normal Saline">Normal Saline</option>
                        <option value="Hibitine">Hibitine</option>
                        <option value="Betadine">Betadine</option>
                        <option value="其他">其他</option>
                      </select>
                      
                      {wound.cleanser === '其他' && (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={wound.cleanser_other}
                            onChange={(e) => updateWound(index, 'cleanser_other', e.target.value)}
                            className="form-input"
                            placeholder="請輸入其他洗劑..."
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="form-label">敷料 (可複選)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {dressingOptions.map(dressing => (
                          <label key={dressing} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={wound.dressings.includes(dressing)}
                              onChange={(e) => handleDressingChange(index, dressing, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{dressing}</span>
                          </label>
                        ))}
                      </div>
                      
                      <div className="mt-2">
                        <input
                          type="text"
                          value={wound.dressing_other}
                          onChange={(e) => updateWound(index, 'dressing_other', e.target.value)}
                          className="form-input"
                          placeholder="其他敷料..."
                        />
                      </div>
                      
                      {wound.dressings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {wound.dressings.map(dressing => (
                            <span key={dressing} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {dressing}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 備註 */}
                <div>
                  <label className="form-label">備註</label>
                  <textarea
                    value={wound.remarks}
                    onChange={(e) => updateWound(index, 'remarks', e.target.value)}
                    className="form-input"
                    rows={1}
                    placeholder="其他觀察或注意事項..."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {assessment ? '更新傷口評估' : '新增傷口評估'}
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

export default WoundAssessmentModal;