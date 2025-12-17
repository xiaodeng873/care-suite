import React, { useState } from 'react';
import { X, Utensils, Calendar, FileText, Droplets } from 'lucide-react';
import { usePatients, type Patient, type MealGuidance, type MealCombinationType, type SpecialDietType } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface MealGuidanceModalProps {
  guidance?: MealGuidance;
  onClose: () => void;
}

const MealGuidanceModal: React.FC<MealGuidanceModalProps> = ({ guidance, onClose }) => {
  const { patients, mealGuidances, addMealGuidance, updateMealGuidance } = usePatients();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    patient_id: guidance?.patient_id || '',
    meal_combination: guidance?.meal_combination || '正飯+正餸' as MealCombinationType,
    special_diets: guidance?.special_diets || [] as SpecialDietType[],
    needs_thickener: guidance?.needs_thickener || false,
    thickener_amount: guidance?.thickener_amount || '',
    egg_quantity: guidance?.egg_quantity?.toString() || '',
    remarks: guidance?.remarks || '',
    guidance_date: guidance?.guidance_date || '',
    guidance_source: guidance?.guidance_source || ''
  });

  const mealCombinations: MealCombinationType[] = [
    '正飯+正餸',
    '正飯+碎餸', 
    '正飯+糊餸',
    '軟飯+正餸',
    '軟飯+碎餸',
    '軟飯+糊餸',
    '糊飯+糊餸'
  ];

  const specialDietOptions: SpecialDietType[] = [
    '糖尿餐',
    '痛風餐', 
    '低鹽餐',
    '雞蛋',
    '素食'
  ];

  const guidanceSourceOptions = [
    '言語治療師',
    '病房出院指示',
    '營養師建議',
    '醫生指示',
    '護理評估',
    '其他'
  ];

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

  const handleSpecialDietChange = (diet: SpecialDietType, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      special_diets: checked
        ? [...prev.special_diets, diet]
        : prev.special_diets.filter(d => d !== diet)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    // Check for existing meal guidance for this patient (only when creating new)
    if (!guidance) {
      const existingGuidance = mealGuidances.find(mg => mg.patient_id === parseInt(formData.patient_id));
      if (existingGuidance) {
        // Transition to edit mode for existing record
        const patient = patients.find(p => p.院友id === parseInt(formData.patient_id));
        const patientName = patient ? `${patient.床號} ${patient.中文姓名}` : `院友ID ${formData.patient_id}`;
        
        if (confirm(`${patientName} 已有餐膳指引記錄。\n\n將切換為編輯現有記錄模式。`)) {
          // Update form data with existing guidance
          setFormData({
            patient_id: existingGuidance.patient_id.toString(),
            meal_combination: existingGuidance.meal_combination,
            special_diets: existingGuidance.special_diets || [],
            needs_thickener: existingGuidance.needs_thickener || false,
            thickener_amount: existingGuidance.thickener_amount || '',
            egg_quantity: existingGuidance.egg_quantity?.toString() || '',
            remarks: existingGuidance.remarks || '',
            guidance_date: existingGuidance.guidance_date || '',
            guidance_source: existingGuidance.guidance_source || ''
          });
          
          // Set the guidance prop to existing guidance for update mode
          guidance = existingGuidance;
        } else {
          return; // Stay in form
        }
      }
    }

    if (formData.needs_thickener && !formData.thickener_amount.trim()) {
      alert('使用凝固粉時請輸入分量');
      return;
    }

    if (formData.special_diets.includes('雞蛋') && (!formData.egg_quantity || parseInt(formData.egg_quantity) < 1)) {
      alert('選擇雞蛋時請輸入有效的隻數');
      return;
    }

    try {
      const guidanceData = {
        patient_id: parseInt(formData.patient_id),
        meal_combination: formData.meal_combination,
        special_diets: formData.special_diets,
        needs_thickener: formData.needs_thickener,
        thickener_amount: formData.needs_thickener ? formData.thickener_amount : null,
        egg_quantity: formData.special_diets.includes('雞蛋') ? parseInt(formData.egg_quantity) : null,
        remarks: formData.remarks || null,
        guidance_date: formData.guidance_date || null,
        guidance_source: formData.guidance_source || null
      };

      // Check if we're editing an existing guidance with a valid ID
      if (guidance && guidance.id && guidance.id !== 'undefined' && guidance.id.length > 0) {
        await updateMealGuidance({
          ...guidance,
          ...guidanceData
        });
      } else {
        // Create new guidance
        await addMealGuidance(guidanceData);
      }
      
      onClose();
    } catch (error) {
      console.error('儲存餐膳指引失敗:', error);
      
      // Handle specific duplicate error
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        const patient = patients.find(p => p.院友id === parseInt(formData.patient_id));
        const patientName = patient ? `${patient.床號} ${patient.中文姓名}` : `院友ID ${formData.patient_id}`;
        alert(`${patientName} 已有餐膳指引記錄，每名院友只能有一個餐膳指引。\n\n請先刪除現有記錄或編輯現有記錄。`);
      } else {
        alert('儲存餐膳指引失敗，請重試');
      }
    }
  };

  const getMealCombinationColor = (combination: MealCombinationType) => {
    if (combination.includes('正飯')) return 'text-green-600';
    if (combination.includes('軟飯')) return 'text-yellow-600';
    if (combination.includes('糊飯')) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getSpecialDietColor = (diet: SpecialDietType) => {
    switch (diet) {
      case '糖尿餐': return 'bg-blue-100 text-blue-800 border-blue-200';
      case '痛風餐': return 'bg-purple-100 text-purple-800 border-purple-200';
      case '低鹽餐': return 'bg-green-100 text-green-800 border-green-200';
      case '雞蛋': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case '素食': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Utensils className="h-6 w-6 text-orange-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {guidance ? '編輯餐膳指引' : '新增餐膳指引'}
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
          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Utensils className="h-4 w-4 inline mr-1" />
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
              <label className="form-label">餐膳組合 *</label>
              <select
                name="meal_combination"
                value={formData.meal_combination}
                onChange={handleChange}
                className="form-input"
                required
              >
                {mealCombinations.map(combination => (
                  <option key={combination} value={combination}>
                    {combination}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                選擇適合院友的餐膳組合
              </p>
            </div>
          </div>

          {/* 特殊餐膳 */}
          <div>
            <label className="form-label">特殊餐膳 (可多選)</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {specialDietOptions.map(diet => (
                <label 
                  key={diet} 
                  className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    formData.special_diets.includes(diet)
                      ? getSpecialDietColor(diet)
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.special_diets.includes(diet)}
                    onChange={(e) => handleSpecialDietChange(diet, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium">{diet}</span>
                </label>
              ))}
            </div>
            
            {/* 雞蛋數量輸入 */}
            {formData.special_diets.includes('雞蛋') && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <label className="form-label">雞蛋數目 *</label>
                <input
                  type="number"
                  name="egg_quantity"
                  value={formData.egg_quantity}
                  onChange={handleChange}
                  className="form-input w-32"
                  placeholder="輸入數目"
                  min="1"
                  max="10"
                  required={formData.special_diets.includes('雞蛋')}
                />
                <p className="text-xs text-yellow-700 mt-1">
                  請輸入所需的雞蛋數目
                </p>
              </div>
            )}
            
            {formData.special_diets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.special_diets.map(diet => (
                  <span key={diet} className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${getSpecialDietColor(diet)}`}>
                    {diet}{diet === '雞蛋' && formData.egg_quantity ? ` ${formData.egg_quantity}隻` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 凝固粉設定 */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="needs_thickener"
                name="needs_thickener"
                checked={formData.needs_thickener}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="needs_thickener" className="text-sm font-medium text-gray-700 flex items-center">
                <Droplets className="h-4 w-4 mr-1" />
                需要使用凝固粉
              </label>
            </div>

            {formData.needs_thickener && (
              <div className="ml-7">
                <label className="form-label">凝固粉分量 *</label>
                <input
                  type="text"
                  name="thickener_amount"
                  value={formData.thickener_amount}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="例如：1茶匙、2包、適量"
                  required={formData.needs_thickener}
                />
                <p className="text-xs text-gray-500 mt-1">
                  請輸入具體的凝固粉使用分量
                </p>
              </div>
            )}
          </div>

          {/* 指引資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Calendar className="h-4 w-4 inline mr-1" />
                指引日期
              </label>
              <input
                type="date"
                name="guidance_date"
                value={formData.guidance_date}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                <FileText className="h-4 w-4 inline mr-1" />
                指引出處
              </label>
              <textarea
                name="guidance_source"
                value={formData.guidance_source}
                onChange={handleChange}
                className="form-input"
                rows={1}
                placeholder="請輸入指引出處..."
              />
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">備註</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="其他備註或特殊要求..."
            />
          </div>

          {/* 預覽區域 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">餐膳指引預覽</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">餐膳組合:</span>
                <span className={`font-medium ${getMealCombinationColor(formData.meal_combination)}`}>
                  {formData.meal_combination}
                </span>
              </div>
              
              {formData.special_diets.length > 0 && (
                <div className="flex items-start space-x-2">
                  <span className="text-gray-600">特殊餐膳:</span>
                  <div className="flex flex-wrap gap-1">
                    {formData.special_diets.map(diet => (
                      <span key={diet} className={`inline-flex items-center px-2 py-1 rounded text-xs border ${getSpecialDietColor(diet)}`}>
                        {diet}{diet === '雞蛋' && formData.egg_quantity ? ` ${formData.egg_quantity}隻` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {formData.needs_thickener && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">凝固粉:</span>
                  <span className="font-medium text-blue-600">
                    {formData.thickener_amount || '待填寫分量'}
                  </span>
                </div>
              )}
              
              {formData.remarks && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">備註:</span>
                  <span className="font-medium">{formData.remarks}</span>
                </div>
              )}
              
              {formData.guidance_date && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">指引日期:</span>
                  <span className="font-medium">
                    {new Date(formData.guidance_date).toLocaleDateString('zh-TW')}
                  </span>
                </div>
              )}
              
              {formData.guidance_source && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">指引出處:</span>
                  <span className="font-medium">{formData.guidance_source}</span>
                </div>
              )}
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {guidance ? '更新餐膳指引' : '新增餐膳指引'}
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

export default MealGuidanceModal;