import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Ruler, Droplets, Thermometer, AlertCircle, Camera, Check } from 'lucide-react';
import { usePatients, type Wound, type WoundAssessment, type WoundAssessmentStatus } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import WoundPhotoUpload from './WoundPhotoUpload';

interface WoundPhoto {
  id: string;
  base64: string;
  filename: string;
  uploadDate: string;
  description?: string;
}

interface SingleWoundAssessmentModalProps {
  wound: Wound;
  assessment?: WoundAssessment | null;
  onClose: () => void;
  onSave?: () => void;
}

const STAGES = ['階段1', '階段2', '階段3', '階段4', '無法評估'];
const ODOR_OPTIONS = ['無', '有', '惡臭'];
const GRANULATION_OPTIONS = ['無', '紅色', '粉紅色'];
const NECROSIS_OPTIONS = ['無', '黑色', '啡色', '黃色'];
const INFECTION_OPTIONS = ['無', '懷疑', '有'];
const TEMPERATURE_OPTIONS = ['正常', '上升'];
const EXUDATE_AMOUNT_OPTIONS = ['無', '少', '中', '多'];
const EXUDATE_COLOR_OPTIONS = ['紅色', '黃色', '綠色', '透明'];
const EXUDATE_TYPE_OPTIONS = ['血', '膿', '血清'];
const SKIN_CONDITION_OPTIONS = ['健康及柔軟', '腫脹', '僵硬'];
const SKIN_COLOR_OPTIONS = ['紅色', '紅白色', '黑色'];
const CLEANSER_OPTIONS = ['Normal Saline', 'Hibitine', 'Betadine', '其他'];
const DRESSING_OPTIONS = ['Gauze', 'Adhesive Pad', 'Parafin Gauze', 'Alginate', 'HydroGel', 'Duoderm', 'Omifix', 'Tegaderm'];

const WOUND_STATUS_OPTIONS: { value: WoundAssessmentStatus; label: string; color: string }[] = [
  { value: 'untreated', label: '未處理', color: 'bg-gray-100 text-gray-800' },
  { value: 'treating', label: '治療中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'improving', label: '改善中', color: 'bg-blue-100 text-blue-800' },
  { value: 'healed', label: '已痊癒', color: 'bg-green-100 text-green-800' }
];

const SingleWoundAssessmentModal: React.FC<SingleWoundAssessmentModalProps> = ({
  wound,
  assessment,
  onClose,
  onSave
}) => {
  const { addWoundAssessmentForWound, updateWoundAssessment, patients, healWound } = usePatients();
  const { displayName } = useAuth();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    assessment_date: assessment?.assessment_date || getHongKongDate(),
    assessor: assessment?.assessor || displayName || '',
    area_length: assessment?.area_length || undefined as number | undefined,
    area_width: assessment?.area_width || undefined as number | undefined,
    area_depth: assessment?.area_depth || undefined as number | undefined,
    stage: assessment?.stage || '',
    wound_status: (assessment?.wound_status || 'treating') as WoundAssessmentStatus,
    exudate_present: assessment?.exudate_present || false,
    exudate_amount: assessment?.exudate_amount || '',
    exudate_color: assessment?.exudate_color || '',
    exudate_type: assessment?.exudate_type || '',
    odor: assessment?.odor || '無',
    granulation: assessment?.granulation || '無',
    necrosis: assessment?.necrosis || '無',
    infection: assessment?.infection || '無',
    temperature: assessment?.temperature || '正常',
    surrounding_skin_condition: assessment?.surrounding_skin_condition || '',
    surrounding_skin_color: assessment?.surrounding_skin_color || '',
    cleanser: assessment?.cleanser || 'Normal Saline',
    cleanser_other: assessment?.cleanser_other || '',
    dressings: assessment?.dressings || [] as string[],
    dressing_other: assessment?.dressing_other || '',
    wound_photos: (assessment?.wound_photos || []) as unknown as WoundPhoto[],
    remarks: assessment?.remarks || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patient = patients.find(p => p.院友id === wound.patient_id);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value ? parseFloat(value) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDressingChange = (dressing: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      dressings: checked
        ? [...prev.dressings, dressing]
        : prev.dressings.filter(d => d !== dressing)
    }));
  };

  const handlePhotosChange = (photos: WoundPhoto[]) => {
    setFormData(prev => ({ ...prev, wound_photos: photos }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.assessment_date) {
      setError('請填寫評估日期');
      return;
    }

    setIsLoading(true);

    try {
      const assessmentData = {
        wound_id: wound.id,
        patient_id: wound.patient_id,
        assessment_date: formData.assessment_date,
        assessor: formData.assessor || undefined,
        area_length: formData.area_length,
        area_width: formData.area_width,
        area_depth: formData.area_depth,
        stage: formData.stage || undefined,
        wound_status: formData.wound_status,
        exudate_present: formData.exudate_present,
        exudate_amount: formData.exudate_present ? formData.exudate_amount : undefined,
        exudate_color: formData.exudate_present ? formData.exudate_color : undefined,
        exudate_type: formData.exudate_present ? formData.exudate_type : undefined,
        odor: formData.odor,
        granulation: formData.granulation,
        necrosis: formData.necrosis,
        infection: formData.infection,
        temperature: formData.temperature,
        surrounding_skin_condition: formData.surrounding_skin_condition || undefined,
        surrounding_skin_color: formData.surrounding_skin_color || undefined,
        cleanser: formData.cleanser,
        cleanser_other: formData.cleanser === '其他' ? formData.cleanser_other : undefined,
        dressings: formData.dressings,
        dressing_other: formData.dressing_other || undefined,
        wound_photos: formData.wound_photos as unknown as string[],
        remarks: formData.remarks || undefined
      };

      if (assessment?.id) {
        await updateWoundAssessment({
          ...assessment,
          ...assessmentData
        } as unknown as WoundAssessment);
      } else {
        await addWoundAssessmentForWound(assessmentData as any);
      }

      // 如果評估狀態為痊癒，同時更新傷口狀態
      if (formData.wound_status === 'healed') {
        await healWound(wound.id, formData.assessment_date);
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error saving wound assessment:', err);
      setError('儲存評估失敗，請重試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                傷口評估 - {wound.wound_code}
              </h2>
              <div className="mt-1 text-sm text-gray-600">
                {patient?.床號} - {patient?.中文姓名} | 
                發現日期: {new Date(wound.discovery_date).toLocaleDateString('zh-TW')} | 
                位置: {wound.wound_location.side === 'front' ? '前側' : '後側'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                評估日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="assessment_date"
                value={formData.assessment_date}
                onChange={handleChange}
                className="form-input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline h-4 w-4 mr-1" />
                評估者
              </label>
              <input
                type="text"
                name="assessor"
                value={formData.assessor}
                onChange={handleChange}
                className="form-input w-full"
                placeholder="評估者姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                傷口狀態 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {WOUND_STATUS_OPTIONS.map(status => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, wound_status: status.value }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      formData.wound_status === status.value
                        ? `${status.color} ring-2 ring-offset-1 ring-blue-500`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {formData.wound_status === status.value && (
                      <Check className="inline h-3 w-3 mr-1" />
                    )}
                    {status.label}
                  </button>
                ))}
              </div>
              {formData.wound_status === 'healed' && (
                <p className="mt-2 text-sm text-green-600">
                  ⚠️ 選擇「已痊癒」後，此傷口將不再產生評估提醒
                </p>
              )}
            </div>
          </div>

          {/* 傷口尺寸 */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Ruler className="h-4 w-4 mr-2" />
              傷口尺寸 (cm)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">長度</label>
                <input
                  type="number"
                  name="area_length"
                  value={formData.area_length ?? ''}
                  onChange={handleChange}
                  className="form-input w-full"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">闊度</label>
                <input
                  type="number"
                  name="area_width"
                  value={formData.area_width ?? ''}
                  onChange={handleChange}
                  className="form-input w-full"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">深度</label>
                <input
                  type="number"
                  name="area_depth"
                  value={formData.area_depth ?? ''}
                  onChange={handleChange}
                  className="form-input w-full"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          {/* 評估選項 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">階段</label>
              <select
                name="stage"
                value={formData.stage}
                onChange={handleChange}
                className="form-input w-full"
              >
                <option value="">選擇...</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">氣味</label>
              <select
                name="odor"
                value={formData.odor}
                onChange={handleChange}
                className="form-input w-full"
              >
                {ODOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">肉芽</label>
              <select
                name="granulation"
                value={formData.granulation}
                onChange={handleChange}
                className="form-input w-full"
              >
                {GRANULATION_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">壞死</label>
              <select
                name="necrosis"
                value={formData.necrosis}
                onChange={handleChange}
                className="form-input w-full"
              >
                {NECROSIS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">感染</label>
              <select
                name="infection"
                value={formData.infection}
                onChange={handleChange}
                className="form-input w-full"
              >
                {INFECTION_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Thermometer className="inline h-4 w-4 mr-1" />
                體溫
              </label>
              <select
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                className="form-input w-full"
              >
                {TEMPERATURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">周邊皮膚狀況</label>
              <select
                name="surrounding_skin_condition"
                value={formData.surrounding_skin_condition}
                onChange={handleChange}
                className="form-input w-full"
              >
                <option value="">選擇...</option>
                {SKIN_CONDITION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">周邊皮膚顏色</label>
              <select
                name="surrounding_skin_color"
                value={formData.surrounding_skin_color}
                onChange={handleChange}
                className="form-input w-full"
              >
                <option value="">選擇...</option>
                {SKIN_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 滲出物 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Droplets className="h-4 w-4 text-gray-600" />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="exudate_present"
                  checked={formData.exudate_present}
                  onChange={handleChange}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">有滲出物</span>
              </label>
            </div>

            {formData.exudate_present && (
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">量</label>
                  <select
                    name="exudate_amount"
                    value={formData.exudate_amount}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    <option value="">選擇...</option>
                    {EXUDATE_AMOUNT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">顏色</label>
                  <select
                    name="exudate_color"
                    value={formData.exudate_color}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    <option value="">選擇...</option>
                    {EXUDATE_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">種類</label>
                  <select
                    name="exudate_type"
                    value={formData.exudate_type}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    <option value="">選擇...</option>
                    {EXUDATE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 治療 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">洗劑</label>
              <select
                name="cleanser"
                value={formData.cleanser}
                onChange={handleChange}
                className="form-input w-full"
              >
                {CLEANSER_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {formData.cleanser === '其他' && (
                <input
                  type="text"
                  name="cleanser_other"
                  value={formData.cleanser_other}
                  onChange={handleChange}
                  className="form-input w-full mt-2"
                  placeholder="請說明..."
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">敷料</label>
              <div className="grid grid-cols-2 gap-2">
                {DRESSING_OPTIONS.map(d => (
                  <label key={d} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.dressings.includes(d)}
                      onChange={(e) => handleDressingChange(d, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{d}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="dressing_other"
                value={formData.dressing_other}
                onChange={handleChange}
                className="form-input w-full mt-2"
                placeholder="其他敷料..."
              />
            </div>
          </div>

          {/* 照片 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Camera className="inline h-4 w-4 mr-1" />
              傷口照片
            </label>
            <WoundPhotoUpload
              photos={formData.wound_photos}
              onPhotosChange={handlePhotosChange}
            />
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="form-input w-full"
              rows={2}
              placeholder="其他觀察或注意事項..."
            />
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
              {isLoading ? '儲存中...' : (assessment ? '更新評估' : '儲存評估')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SingleWoundAssessmentModal;
