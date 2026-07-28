import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, User, Ruler, Droplets, Thermometer, AlertCircle, Camera, Check, ChevronDown } from 'lucide-react';
import { usePatients, type Wound, type WoundAssessment, type WoundAssessmentStatus } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import WoundPhotoUpload from './WoundPhotoUpload';
import { formatDisplayDate } from '../utils/dateFormat';


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
  prefillFrom?: WoundAssessment | null;
  onClose: () => void;
  onSave?: () => void;
}

const STAGES = ['階段1', '階段2', '階段3', '階段4', '無法評估'];
const ODOR_OPTIONS = ['無', '有', '惡臭'];
const GRANULATION_OPTIONS = ['無', '紅色', '粉紅色'];
const NECROSIS_OPTIONS = ['無', '黑色', '啡色', '黃色'];
// 感染症狀：多選，「無」與其餘互斥
const INFECTION_SIGNS = ['無', '紅', '腫', '熱', '痛'];
const TEMPERATURE_OPTIONS = ['正常', '上升'];
const EXUDATE_AMOUNT_OPTIONS = ['無', '少', '中', '多'];
const EXUDATE_COLOR_OPTIONS = ['紅', '黃', '透明'];
const EXUDATE_TYPE_OPTIONS = ['血', '膜', '血清'];
const SKIN_COLOR_OPTIONS = ['紅', '紅白', '黑'];
const SKIN_TEXTURE_OPTIONS = ['腫脹', '僵硬'];
const CLEANSER_OPTIONS = ['Normal Saline', 'Hibitine', 'Betadine', '其他'];
const DRESSING_OPTIONS = ['Gauze', 'Adhesive Pad', 'Parafin Gauze', 'Alginate', 'HydroGel', 'Duoderm', 'Omifix', 'Tegaderm'];

const WOUND_STATUS_OPTIONS: { value: WoundAssessmentStatus; label: string; color: string }[] = [
  { value: 'untreated', label: '未處理', color: 'bg-gray-100 text-gray-800' },
  { value: 'treating',  label: '治療中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'healed',    label: '已痊癒', color: 'bg-green-100 text-green-800' }
];

/** 可多選下拉選單 */
const MultiSelectDropdown: React.FC<{
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  exclusiveOption?: string;
  placeholder?: string;
}> = ({ options, selected, onChange, exclusiveOption, placeholder = '選擇...' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const toggle = (opt: string) => {
    if (exclusiveOption && opt === exclusiveOption) {
      onChange(selected.includes(opt) ? [] : [opt]);
    } else {
      const next = selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected.filter(s => s !== exclusiveOption), opt];
      onChange(next);
    }
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-input w-full text-left flex items-center justify-between gap-2"
      >
        <span className={`truncate ${selected.length ? '' : 'text-gray-400'}`}>
          {selected.length ? selected.join('、') : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const SingleWoundAssessmentModal: React.FC<SingleWoundAssessmentModalProps> = ({
  wound,
  assessment,
  prefillFrom,
  onClose,
  onSave
}) => {
  const { addWoundAssessmentForWound, updateWoundAssessment, patients, updateWound } = usePatients();
  const { displayName } = useAuth();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  // 編輯用 assessment；新增時可用 prefillFrom 預填上次評估（相片與日期除外）
  const source = assessment ?? prefillFrom ?? null;

  const [formData, setFormData] = useState({
    assessment_date: assessment?.assessment_date || getHongKongDate(),
    assessor: source?.assessor || displayName || '',
    area_length: source?.area_length || undefined as number | undefined,
    area_width: source?.area_width || undefined as number | undefined,
    area_depth: source?.area_depth || undefined as number | undefined,
    stage: source?.stage || '',
    wound_status: (source?.wound_status || 'treating') as WoundAssessmentStatus,
    exudate_present: source?.exudate_present || false,
    exudate_amount: source?.exudate_amount || '',
    exudate_color: source?.exudate_color || '',
    exudate_type: source?.exudate_type || '',
    odor: source?.odor || '無',
    granulation: source?.granulation || '無',
    necrosis: source?.necrosis || '無',
    infection_signs: (source?.infection_signs?.length ? source.infection_signs : (source?.infection ? [source.infection] : ['無'])) as string[],
    temperature: source?.temperature || '正常',
    surrounding_skin_health: source?.surrounding_skin_condition === 'healthy',
    surrounding_skin_color: source?.surrounding_skin_color || '',
    surrounding_skin_texture: source?.surrounding_skin_texture || '',
    cleanser: source?.cleanser || 'Normal Saline',
    cleanser_other: source?.cleanser_other || '',
    dressings: source?.dressings || [] as string[],
    dressing_other: source?.dressing_other || '',
    wound_photos: (assessment?.wound_photos || []) as unknown as WoundPhoto[],
    remarks: source?.remarks || ''
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
        infection_signs: formData.infection_signs,
        infection: formData.infection_signs.join(','), // 舊字串尌容
        temperature: formData.temperature,
        surrounding_skin_condition: formData.surrounding_skin_health ? 'healthy' : '',
        surrounding_skin_color: formData.surrounding_skin_color || undefined,
        surrounding_skin_texture: formData.surrounding_skin_texture || undefined,
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

      // 根據更新後的最新評估狀態同步傷口主表
      const existingAssessments: Array<{ id?: string; wound_status?: string; assessment_date: string }> =
        (wound as any).assessments ?? [];
      // 建立「儲存後」的評估列表：編輯則替换、新增則前置
      const updatedList = assessment?.id
        ? existingAssessments.map(a => a.id === assessment!.id
            ? { ...a, wound_status: formData.wound_status, assessment_date: formData.assessment_date }
            : a)
        : [{ wound_status: formData.wound_status, assessment_date: formData.assessment_date }, ...existingAssessments];
      // 不依賴插入順序，導出正確的最新評估
      const sorted = [...updatedList].sort((a, b) =>
        new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
      );
      const latestStatus = sorted[0]?.wound_status;
      const newWoundStatus: 'healed' | 'active' = latestStatus === 'healed' ? 'healed' : 'active';
      // 計算下次評估日期（沿用任務管理頻率模型）
      let nextAssessmentDue: string | null = null;
      if (newWoundStatus === 'active') {
        const castWound = wound as any;
        const baseDate = formData.assessment_date;
        const unit = castWound.assessment_frequency_unit ?? 'daily';
        const value = castWound.assessment_frequency_value ?? 7;
        if (unit === 'weekly' && castWound.assessment_specific_days_of_week?.length > 0) {
          // 同 taskScheduler: 7=週日→ JS getDay() 0
          const targetDays = (castWound.assessment_specific_days_of_week as number[]).map(d => d === 7 ? 0 : d);
          for (let i = 1; i <= 7; i++) {
            const check = new Date(baseDate);
            check.setDate(check.getDate() + i);
            if (targetDays.includes(check.getDay())) {
              nextAssessmentDue = check.toISOString().split('T')[0];
              break;
            }
          }
        }
        if (!nextAssessmentDue) {
          const next = new Date(baseDate);
          next.setDate(next.getDate() + value);
          nextAssessmentDue = next.toISOString().split('T')[0];
        }
      }
      await updateWound({
        id: wound.id,
        status: newWoundStatus,
        healed_date: newWoundStatus === 'healed'
          ? (formData.wound_status === 'healed' ? formData.assessment_date : wound.healed_date ?? null as any)
          : null as any,
        next_assessment_due: nextAssessmentDue as any,
      });

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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                傷口評估 - {wound.wound_code}
              </h2>
              <div className="mt-1 text-sm text-gray-600">
                {patient?.床號} - {patient?.中文姓名} | 
                發現日期: {formatDisplayDate(wound.discovery_date)} | 
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
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
                    onClick={() => {
                      if (status.value === 'healed' && formData.wound_status !== 'healed') {
                        if (!window.confirm('確定將此評估標記為「已痊癒」？\n傷口狀態將同步更新為已痊癒（可在列表中新增「未處理」或「治療中」評估來還原）。')) return;
                      }
                      setFormData(prev => ({ ...prev, wound_status: status.value }));
                    }}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div className="col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">感染症狀（可多選）</label>
                <MultiSelectDropdown
                  options={INFECTION_SIGNS}
                  selected={formData.infection_signs}
                  exclusiveOption="無"
                  onChange={(vals) => setFormData(prev => ({ ...prev, infection_signs: vals }))}
                />
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
            </div>

            <div className="col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">周邊皮膚健康柔軟</label>
                <select
                  value={formData.surrounding_skin_health ? 'yes' : 'no'}
                  onChange={(e) => setFormData(prev => ({ ...prev, surrounding_skin_health: e.target.value === 'yes' }))}
                  className="form-input w-full"
                >
                  <option value="no">否</option>
                  <option value="yes">是</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">周邊皮膚質感</label>
                <select
                  name="surrounding_skin_texture"
                  value={formData.surrounding_skin_texture}
                  onChange={handleChange}
                  className="form-input w-full"
                >
                  <option value="">選擇...</option>
                  {SKIN_TEXTURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 滲出物 */}
          <div className="border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Droplets className="h-4 w-4 text-gray-600" />
              <label className="flex flex-wrap items-center gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">敷料（可多選）</label>
              <MultiSelectDropdown
                options={DRESSING_OPTIONS}
                selected={formData.dressings}
                onChange={(vals) => setFormData(prev => ({ ...prev, dressings: vals }))}
              />
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
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
