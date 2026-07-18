import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, FileText, Activity, Brain, Eye, MessageSquare, Utensils, Heart } from 'lucide-react';
import { usePatients, type HealthAssessment } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';

/** Parse a TEXT column that may contain a JSON array, '、'-delimited string, or already be an array */
function parseTextToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch { /* fall through */ }
    }
    return trimmed.split('、').filter(Boolean);
  }
  return [];
}

interface HealthAssessmentModalProps {
  assessment?: HealthAssessment | null;
  onClose: () => void;
  defaultPatientId?: number;
}

const HealthAssessmentModal: React.FC<HealthAssessmentModalProps> = ({
  assessment,
  onClose,
  defaultPatientId
}) => {
  const { patients, addHealthAssessment, updateHealthAssessment, healthAssessments } = usePatients();
  const { displayName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    assessment?.patient_id || defaultPatientId || null
  );
  
  // 計算預設評估日期
  const getDefaultAssessmentDate = (healthAssessments: any[], selectedPatientId: number | null): string => {
    if (assessment) {
      // 編輯模式：使用現有評估日期
      return assessment.assessment_date;
    }
    
    if (selectedPatientId) {
      // 新增模式：查找該院友的最後一次評估
      const patientAssessments = healthAssessments
        .filter(a => a.patient_id === selectedPatientId)
        .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
      
      if (patientAssessments.length > 0) {
        // 如果有上次評估，計算6個月後作為預設日期
        const lastAssessment = patientAssessments[0];
        const nextDate = new Date(lastAssessment.assessment_date);
        nextDate.setMonth(nextDate.getMonth() + 6);
        return nextDate.toISOString().split('T')[0];
      }
    }
    
    // 預設為今天
    return new Date().toISOString().split('T')[0];
  };
  
  // 獲取上次評估日期
  const getLastAssessmentDate = (healthAssessments: any[], selectedPatientId: number | null): string | null => {
    if (!selectedPatientId) return null;
    
    const patientAssessments = healthAssessments
      .filter(a => a.patient_id === selectedPatientId && (!assessment || a.id !== assessment.id))
      .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());
    
    return patientAssessments.length > 0 ? patientAssessments[0].assessment_date : null;
  };
  
  const [formData, setFormData] = useState({
    // smoking_habit: '',
    // smoking_quantity: '', // 每天吸煙支數
    // drinking_habit: '',
    // drinking_quantity: '', // 每天飲酒罐數
    daily_activities: {
      // max_activity: '',
      is_bedridden: false, // 長期臥床
      limb_movement_left: [], // 改為陣列支援複選
      limb_movement_right: [], // 改為陣列支援複選
      eating: '',
      eating_aid: '',
      dressing: '',
      dressing_aid: '',
      grooming: '',
      grooming_aid: '',
      walking: '',
      walking_aid: '',
      bed_transfer: '',
      bed_transfer_aid: '',
      bathing: '',
      bathing_aid: '',
      toileting: '',
      toileting_aid: ''
    },
    nutrition_diet: {
      condition: '',
      meal_type: '',
      special_diet: ''
    },
    vision_hearing: {
      left_eye: '',
      left_eye_aid: '',
      left_eye_other: '',
      right_eye: '',
      right_eye_aid: '',
      right_eye_other: '',
      left_ear: '',
      left_ear_other: '',
      right_ear: '',
      right_ear_other: ''
    },
    communication_ability: '',
    communication_other: '',
    consciousness_cognition: [],
    consciousness_other: '',
    bowel_bladder_control: {
      bowel: '',
      bowel_aid: '',
      bladder: '',
      bladder_aid: '',
      toilet_training: false
    },
    treatment_items: [],
    emotional_expression: [],
    behavior_expression: [],
    emotional_other: '',
    // remarks: '',
    assessment_date: getDefaultAssessmentDate(healthAssessments, selectedPatientId),
    assessor: '',
    next_due_date: ''
  });

  // 當評估日期改變時，自動計算下次評估日期
  useEffect(() => {
    if (formData.assessment_date) {
      const assessmentDate = new Date(formData.assessment_date);
      assessmentDate.setMonth(assessmentDate.getMonth() + 6);
      const nextDueDate = assessmentDate.toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        next_due_date: nextDueDate
      }));
    }
  }, [formData.assessment_date]);

  useEffect(() => {
    if (assessment) {
      setSelectedPatientId(assessment.patient_id);
      setFormData({
        smoking_habit: assessment.smoking_habit || '',
        smoking_quantity: assessment.smoking_quantity || '',
        drinking_habit: assessment.drinking_habit || '',
        drinking_quantity: assessment.drinking_quantity || '',
        daily_activities: assessment.daily_activities || {
          max_activity: '',
          is_bedridden: false,
          limb_movement_left: [],
          limb_movement_right: [],
          eating: '',
          eating_aid: '',
          dressing: '',
          dressing_aid: '',
          grooming: '',
          grooming_aid: '',
          walking: '',
          walking_aid: '',
          bed_transfer: '',
          bed_transfer_aid: '',
          bathing: '',
          bathing_aid: '',
          toileting: '',
          toileting_aid: ''
        },
        nutrition_diet: assessment.nutrition_diet || {
          condition: '',
          meal_type: '',
          special_diet: ''
        },
        vision_hearing: assessment.vision_hearing || {
          left_eye: '',
          left_eye_aid: '',
          left_eye_other: '',
          right_eye: '',
          right_eye_aid: '',
          right_eye_other: '',
          left_ear: '',
          left_ear_other: '',
          right_ear: '',
          right_ear_other: ''
        },
        communication_ability: assessment.communication_ability || '',
        communication_other: assessment.communication_other || '',
        consciousness_cognition: Array.isArray(assessment.consciousness_cognition) ? assessment.consciousness_cognition : [],
        consciousness_other: assessment.consciousness_other || '',
        bowel_bladder_control: assessment.bowel_bladder_control || {
          bowel: '',
          bowel_aid: '',
          bladder: '',
          bladder_aid: '',
          toilet_training: false
        },
        treatment_items: Array.isArray(assessment.treatment_items) ? assessment.treatment_items : [],
        emotional_expression: parseTextToArray(assessment.emotional_expression),
        behavior_expression: parseTextToArray(assessment.behavior_expression),
        emotional_other: assessment.emotional_other || '',
        remarks: assessment.remarks || '',
        assessment_date: assessment.assessment_date || getDefaultAssessmentDate(healthAssessments, selectedPatientId),
        assessor: assessment.assessor || displayName || '',
        next_due_date: assessment.next_due_date || ''
      });
    } else if (defaultPatientId) {
      // 新增模式且有預設院友ID時，設定評估日期
      setFormData(prev => ({
        ...prev,
        assessment_date: getDefaultAssessmentDate(healthAssessments, defaultPatientId)
      }));
    }
  }, [assessment, healthAssessments, selectedPatientId, defaultPatientId]);

  const updateLimbMovement = (side: 'left' | 'right', value: string, checked: boolean) => {
    const field = side === 'left' ? 'limb_movement_left' : 'limb_movement_right';
    setFormData(prev => ({
      ...prev,
      daily_activities: {
        ...prev.daily_activities,
        [field]: checked
          ? [...prev.daily_activities[field], value]
          : prev.daily_activities[field].filter(item => item !== value)
      }
    }));
  };

  const updateBedridden = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      daily_activities: {
        ...prev.daily_activities,
        is_bedridden: checked
      }
    }));
  };

  const updateConsciousnessCognition = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      consciousness_cognition: (() => {
        const currentCognition = Array.isArray(prev.consciousness_cognition) ? prev.consciousness_cognition : [];
        let newCognition = checked
          ? [...currentCognition, value]
          : currentCognition.filter(item => item !== value);
        
        // 互斥邏輯：如果選擇了「無認知能力」，清除其他認知選項
        if (value === '無認知能力' && checked) {
          newCognition = ['無認知能力'];
        }
        // 如果選擇了其他認知能力，移除「無認知能力」
        else if (value !== '無認知能力' && checked && newCognition.includes('無認知能力')) {
          newCognition = newCognition.filter(item => item !== '無認知能力');
        }
        
        return newCognition;
      })()
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatientId) {
      alert('請選擇院友');
      return;
    }

    // 檢查肢體活動是否至少選擇一項
    const missingFields = [];
    if (formData.daily_activities.limb_movement_left.length === 0) {
      missingFields.push('左側肢體活動（至少選擇一項）');
    }
    if (formData.daily_activities.limb_movement_right.length === 0) {
      missingFields.push('右側肢體活動（至少選擇一項）');
    }

    setLoading(true);
    try {
      const assessmentData = {
        patient_id: selectedPatientId,
        ...formData,
        emotional_expression: Array.isArray(formData.emotional_expression)
          ? (formData.emotional_expression.length > 0 ? formData.emotional_expression.join('、') : '')
          : (formData.emotional_expression || ''),
        behavior_expression: Array.isArray(formData.behavior_expression)
          ? (formData.behavior_expression.length > 0 ? formData.behavior_expression.join('、') : '')
          : (formData.behavior_expression || ''),
        // 將空字串的日期欄位轉換為 null
        next_due_date: formData.next_due_date || null
      };

      if (assessment?.id) {
        await updateHealthAssessment({
          ...assessment,
          ...assessmentData
        });
      } else {
        await addHealthAssessment(assessmentData);
      }
      
      onClose();
    } catch (error) {
      console.error('保存健康評估失敗:', error);
      alert('保存健康評估失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const updateDailyActivities = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      daily_activities: {
        ...prev.daily_activities,
        [field]: value
      }
    }));
  };

  const updateNutritionDiet = (field: string, value: string) => {
    setFormData(prev => {
      const newNutritionDiet = {
        ...prev.nutrition_diet,
        [field]: value
      };

      // 如果選擇鼻胃管,清空飯餐相關欄位
      if (field === 'condition' && value === '鼻胃管') {
        newNutritionDiet.meal_type = '';
        newNutritionDiet.special_diet = '';
      }

      return {
        ...prev,
        nutrition_diet: newNutritionDiet
      };
    });
  };

  const updateVisionHearing = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      vision_hearing: {
        ...prev.vision_hearing,
        [field]: value
      }
    }));
  };

  const updateBowelBladderControl = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      bowel_bladder_control: {
        ...prev.bowel_bladder_control,
        [field]: value
      }
    }));
  };

  const updateTreatmentItems = (item: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      treatment_items: checked
        ? [...prev.treatment_items, item]
        : prev.treatment_items.filter(i => i !== item)
    }));
  };

  const updateEmotionalExpression = (item: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      emotional_expression: checked
        ? [...prev.emotional_expression, item]
        : prev.emotional_expression.filter(i => i !== item)
    }));
  };

  const updateBehaviorExpression = (item: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      behavior_expression: checked
        ? [...prev.behavior_expression, item]
        : prev.behavior_expression.filter(i => i !== item)
    }));
  };

  // 檢查是否選擇了鼻胃管，如果是則禁用飯餐欄位
  const isNasogastricTubeSelected = formData.nutrition_diet.condition === '鼻胃管';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              {assessment ? '編輯健康評估' : '新增健康評估'}
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
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* 基本資訊 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  院友 *
                </label>
                <PatientAutocomplete
                  value={selectedPatientId?.toString() || defaultPatientId?.toString() || ''}
                  onChange={(patientId) => {
                    const newPatientId = patientId ? parseInt(patientId) : null;
                    setSelectedPatientId(newPatientId);
                    // 當院友改變時，重新計算評估日期
                    if (newPatientId && !assessment) {
                      setFormData(prev => ({
                        ...prev,
                        assessment_date: getDefaultAssessmentDate(healthAssessments, newPatientId)
                      }));
                    }
                  }}
                  placeholder="搜尋院友姓名或床號"
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
                
                {/* 顯示上次評估日期 */}
                {selectedPatientId && getLastAssessmentDate(healthAssessments, selectedPatientId) && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <Activity className="h-3 w-3 inline mr-1" />
                      上次評估：{new Date(getLastAssessmentDate(healthAssessments, selectedPatientId)!).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  評估日期 *
                </label>
                <input
                  type="date"
                  value={formData.assessment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, assessment_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                
                {/* 顯示計算說明 */}
                {selectedPatientId && getLastAssessmentDate(healthAssessments, selectedPatientId) && !assessment && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-500">
                      💡 系統已自動計算建議評估日期（上次評估 + 6個月）
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  評估人員
                </label>
                <input
                  type="text"
                  value={formData.assessor}
                  onChange={(e) => setFormData(prev => ({ ...prev, assessor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="輸入評估人員姓名"
                />
              </div>
            </div>

            {/* 下次評估日期 */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    下次評估到期日期
                  </label>
                  <input
                    type="date"
                    value={formData.next_due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                </div>
                <div className="flex items-center">
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">💡 智能計算說明</p>
                    <p className="text-xs">自動計算下次評估日期為6個月後</p>
                    {formData.assessment_date && formData.next_due_date && (
                      <p className="text-xs mt-1">
                        📅 {new Date(formData.assessment_date).toLocaleDateString('zh-TW')} → {new Date(formData.next_due_date).toLocaleDateString('zh-TW')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 吸煙習慣已移除 */}

            {/* 飲酒習慣已移除 */}

            {/* 3. 日常活動及自理能力 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Activity className="w-5 h-5 inline mr-2" />
                3. 日常活動及自理能力
              </h3>
              
              {/* 最高活動能力已移除 */}

              {/* a. 肢體活動 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">a. 肢體活動</label>
                <label className="flex flex-wrap items-center gap-2 p-2 border rounded cursor-pointer hover:bg-white transition-colors mb-3 w-fit">
                  <input
                    type="checkbox"
                    checked={!!formData.daily_activities.is_bedridden}
                    onChange={(e) => updateBedridden(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">長期臥床</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">左側</label>
                    <div className="space-y-2">
                      {['完全正常', '手有障礙', '腳有障礙'].map(option => (
                        <label key={option} className="flex flex-wrap items-center gap-2 p-2 border rounded cursor-pointer hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.daily_activities.limb_movement_left.includes(option)}
                            onChange={(e) => updateLimbMovement('left', option, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">右側</label>
                    <div className="space-y-2">
                      {['完全正常', '手有障礙', '腳有障礙'].map(option => (
                        <label key={option} className="flex flex-wrap items-center gap-2 p-2 border rounded cursor-pointer hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.daily_activities.limb_movement_right.includes(option)}
                            onChange={(e) => updateLimbMovement('right', option, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* b-h. 各項自理能力 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'eating', label: 'b. 飲食' },
                  { key: 'dressing', label: 'c. 穿衣' },
                  { key: 'grooming', label: 'd. 梳洗' },
                  { key: 'walking', label: 'e. 步行' },
                  { key: 'bed_transfer', label: 'f. 上落床' },
                  { key: 'bathing', label: 'g. 沐浴' },
                  { key: 'toileting', label: 'h. 如廁' }
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{label}</label>
                    <select
                      value={formData.daily_activities[key as keyof typeof formData.daily_activities]}
                      onChange={(e) => updateDailyActivities(key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">請選擇</option>
                      <option value="獨立">獨立</option>
                      <option value="需要幫助">需要幫助</option>
                      <option value="完全依賴">完全依賴</option>
                    </select>
                    {(formData.daily_activities[key as keyof typeof formData.daily_activities] === '需要幫助' || 
                      formData.daily_activities[key as keyof typeof formData.daily_activities] === '完全依賴') && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">需要輔助器種類</label>
                        <input
                          type="text"
                          value={formData.daily_activities[`${key}_aid` as keyof typeof formData.daily_activities]}
                          onChange={(e) => updateDailyActivities(`${key}_aid`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="輸入輔助器種類"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 飲食營養 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Utensils className="w-5 h-5 inline mr-2" />
                4. 飲食營養
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">a. 狀況</label>
                  <select
                    value={formData.nutrition_diet.condition}
                    onChange={(e) => updateNutritionDiet('condition', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">請選擇</option>
                    <option value="正常">正常</option>
                    <option value="厭食">厭食</option>
                    <option value="吞嚥困難">吞嚥困難</option>
                    <option value="鼻胃管">鼻胃管</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    b. 飯餐
                    {isNasogastricTubeSelected && (
                      <span className="text-xs text-gray-500 ml-2">（選擇鼻胃管時不可選）</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.nutrition_diet.meal_type}
                      onChange={(e) => updateNutritionDiet('meal_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={isNasogastricTubeSelected}
                    >
                      <option value="">請選擇</option>
                      <option value="普通">普通</option>
                      <option value="特別">特別</option>
                    </select>

                    {formData.nutrition_diet.meal_type === '特別' && !isNasogastricTubeSelected && (
                      <select
                        value={formData.nutrition_diet.special_diet}
                        onChange={(e) => updateNutritionDiet('special_diet', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">請選擇特別餐膳</option>
                        <option value="痛風餐">痛風餐</option>
                        <option value="糖尿餐">糖尿餐</option>
                        <option value="低鹽餐">低鹽餐</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 視聽能力 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Eye className="w-5 h-5 inline mr-2" />
                5. 視聽能力
              </h3>
              
              {/* 視力 */}
              <div className="mb-4">
                <h4 className="text-md font-medium text-gray-800 mb-3">視力</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">a. 左眼視力</label>
                    <select
                      value={formData.vision_hearing.left_eye}
                      onChange={(e) => updateVisionHearing('left_eye', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">請選擇</option>
                      <option value="清楚">清楚</option>
                      <option value="視力模糊">視力模糊</option>
                      <option value="失明">失明</option>
                      <option value="需要輔助器">需要輔助器</option>
                      <option value="其他">其他</option>
                    </select>
                    
                    {formData.vision_hearing.left_eye === '需要輔助器' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.left_eye_aid}
                          onChange={(e) => updateVisionHearing('left_eye_aid', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="輸入輔助器種類"
                        />
                      </div>
                    )}
                    
                    {formData.vision_hearing.left_eye === '其他' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.left_eye_other}
                          onChange={(e) => updateVisionHearing('left_eye_other', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="請說明其他情況"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">b. 右眼視力</label>
                    <select
                      value={formData.vision_hearing.right_eye}
                      onChange={(e) => updateVisionHearing('right_eye', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">請選擇</option>
                      <option value="清楚">清楚</option>
                      <option value="視力模糊">視力模糊</option>
                      <option value="失明">失明</option>
                      <option value="需要輔助器">需要輔助器</option>
                      <option value="其他">其他</option>
                    </select>
                    
                    {formData.vision_hearing.right_eye === '需要輔助器' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.right_eye_aid}
                          onChange={(e) => updateVisionHearing('right_eye_aid', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="輸入輔助器種類"
                        />
                      </div>
                    )}
                    
                    {formData.vision_hearing.right_eye === '其他' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.right_eye_other}
                          onChange={(e) => updateVisionHearing('right_eye_other', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="請說明其他情況"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 聽力 */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">聽力</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">c. 左耳聽力</label>
                    <select
                      value={formData.vision_hearing.left_ear}
                      onChange={(e) => updateVisionHearing('left_ear', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">請選擇</option>
                      <option value="清楚">清楚</option>
                      <option value="聽力衰退">聽力衰退</option>
                      <option value="嚴重失聰">嚴重失聰</option>
                      <option value="需要助聽器">需要助聽器</option>
                      <option value="其他">其他</option>
                    </select>
                    
                    {formData.vision_hearing.left_ear === '其他' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.left_ear_other}
                          onChange={(e) => updateVisionHearing('left_ear_other', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="請說明其他情況"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">d. 右耳聽力</label>
                    <select
                      value={formData.vision_hearing.right_ear}
                      onChange={(e) => updateVisionHearing('right_ear', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">請選擇</option>
                      <option value="清楚">清楚</option>
                      <option value="聽力衰退">聽力衰退</option>
                      <option value="嚴重失聰">嚴重失聰</option>
                      <option value="需要助聽器">需要助聽器</option>
                      <option value="其他">其他</option>
                    </select>
                    
                    {formData.vision_hearing.right_ear === '其他' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.vision_hearing.right_ear_other}
                          onChange={(e) => updateVisionHearing('right_ear_other', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="請說明其他情況"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. 語言溝通能力 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <MessageSquare className="w-5 h-5 inline mr-2" />
                6. 語言溝通能力
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <select
                    value={formData.communication_ability}
                    onChange={(e) => setFormData(prev => ({ ...prev, communication_ability: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">請選擇</option>
                    <option value="清楚">清楚</option>
                    <option value="含糊">含糊</option>
                    <option value="無反應">無反應</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                
                {formData.communication_ability === '其他' && (
                  <div>
                    <input
                      type="text"
                      value={formData.communication_other}
                      onChange={(e) => setFormData(prev => ({ ...prev, communication_other: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="請說明其他情況"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 7. 意識認知 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Brain className="w-5 h-5 inline mr-2" />
                7. 意識認知 * (可複選，至少選擇一項)
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-800">
                    <strong>注意：</strong>若勾選時間認知、人物認知、地方認知任何一個，都不能勾選無認知能力
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {['時間認知', '人物認知', '地方認知', '無認知能力'].map(option => (
                    <label key={option} className={`flex flex-wrap items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors ${
                      formData.consciousness_cognition.includes(option) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formData.consciousness_cognition.includes(option)}
                        onChange={(e) => updateConsciousnessCognition(option, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`text-sm font-medium ${
                        formData.consciousness_cognition.includes(option) ? 'text-blue-800' : 'text-gray-700'
                      }`}>{option}</span>
                    </label>
                  ))}
                </div>
                
                <label className="flex flex-wrap items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.consciousness_cognition.includes('其他')}
                    onChange={(e) => updateConsciousnessCognition('其他', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">其他</span>
                </label>
                
                {formData.consciousness_cognition.includes('其他') && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">其他情況說明 *</label>
                    <input
                      type="text"
                      value={formData.consciousness_other}
                      onChange={(e) => setFormData(prev => ({ ...prev, consciousness_other: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="請說明其他情況"
                      required
                    />
                  </div>
                )}
                
                {/* 顯示已選擇的認知能力 */}
                {formData.consciousness_cognition.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">已選擇的認知能力：</label>
                    <div className="flex flex-wrap gap-2">
                      {formData.consciousness_cognition.map(cognition => (
                        <span key={cognition} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-200">
                          {cognition}
                          {cognition === '其他' && formData.consciousness_other && `: ${formData.consciousness_other}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 8. 大小便自制能力 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">8. 大小便自制能力</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">a. 大便</label>
                  <select
                    value={formData.bowel_bladder_control.bowel}
                    onChange={(e) => updateBowelBladderControl('bowel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">請選擇</option>
                    <option value="正常">正常</option>
                    <option value="便秘">便秘</option>
                    <option value="失禁">失禁</option>
                    <option value="腸造口">腸造口</option>
                    <option value="需要輔助器">需要輔助器</option>
                  </select>

                  {formData.bowel_bladder_control.bowel === '需要輔助器' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.bowel_bladder_control.bowel_aid}
                        onChange={(e) => updateBowelBladderControl('bowel_aid', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="輸入輔助器種類"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">b. 小便</label>
                  <select
                    value={formData.bowel_bladder_control.bladder}
                    onChange={(e) => updateBowelBladderControl('bladder', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">請選擇</option>
                    <option value="正常">正常</option>
                    <option value="間歇性失禁">間歇性失禁</option>
                    <option value="完全失禁">完全失禁</option>
                    <option value="小便造口">小便造口</option>
                    <option value="導尿管">導尿管</option>
                    <option value="需要輔助器">需要輔助器</option>
                  </select>

                  {formData.bowel_bladder_control.bladder === '需要輔助器' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.bowel_bladder_control.bladder_aid}
                        onChange={(e) => updateBowelBladderControl('bladder_aid', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="輸入輔助器種類"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 如廁訓練 Checkbox */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.bowel_bladder_control.toilet_training}
                    onChange={(e) => updateBowelBladderControl('toilet_training', e.target.checked)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-blue-900">如廁訓練</span>
                </label>
              </div>
            </div>

            {/* 9. 治療項目 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">9. 治療項目</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  '腹膜/血液透析',
                  '氧氣治療',
                  '皮下注射',
                  '呼吸器',
                  '化療',
                  '放射治療'
                ].map(item => (
                  <label
                    key={item}
                    className={`flex flex-wrap items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors ${
                      formData.treatment_items.includes(item)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.treatment_items.includes(item)}
                      onChange={(e) => updateTreatmentItems(item, e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span
                      className={`text-sm font-medium ${
                        formData.treatment_items.includes(item)
                          ? 'text-green-800'
                          : 'text-gray-700'
                      }`}
                    >
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 10. 情緒/行為表現 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">10. 情緒/行為表現</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 情緒 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">情緒 (可複選)</label>
                  <div className="space-y-2">
                    {['喜樂', '平靜', '冷漠', '抑鬱', '激動', '其他'].map(item => (
                      <label
                        key={item}
                        className={`flex flex-wrap items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-white transition-colors ${
                          formData.emotional_expression.includes(item)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.emotional_expression.includes(item)}
                          onChange={(e) => updateEmotionalExpression(item, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span
                          className={`text-sm font-medium ${
                            formData.emotional_expression.includes(item)
                              ? 'text-blue-800'
                              : 'text-gray-700'
                          }`}
                        >
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>

                  {formData.emotional_expression.includes('其他') && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.emotional_other}
                        onChange={(e) => setFormData(prev => ({ ...prev, emotional_other: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="請說明其他情況"
                      />
                    </div>
                  )}
                </div>

                {/* 行為 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">行為 (可複選)</label>
                  <div className="space-y-2">
                    {['遊走', '逃跑', '暴力', '偷竊', '夢遊', '囤積'].map(item => (
                      <label
                        key={item}
                        className={`flex flex-wrap items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-white transition-colors ${
                          formData.behavior_expression.includes(item)
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.behavior_expression.includes(item)}
                          onChange={(e) => updateBehaviorExpression(item, e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span
                          className={`text-sm font-medium ${
                            formData.behavior_expression.includes(item)
                              ? 'text-purple-800'
                              : 'text-gray-700'
                          }`}
                        >
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 11. 備註 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">11. 備註</h3>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="其他需要記錄的健康評估資訊"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedPatientId && !defaultPatientId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-wrap items-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{loading ? '保存中...' : '保存'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HealthAssessmentModal;