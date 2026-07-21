import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface PatientMedicalHistorySectionProps {
  formData: any;
  setFormData: (updater: (prev: any) => any) => void;
  newAllergy: string;
  setNewAllergy: (value: string) => void;
  addAllergy: () => void;
  removeAllergy: (index: number) => void;
  newAdverseReaction: string;
  setNewAdverseReaction: (value: string) => void;
  addAdverseReaction: () => void;
  removeAdverseReaction: (index: number) => void;
}

const defaultMedicalHistory = {
  diseases: [] as string[],
  diseases_other: '',
  mental_illness_type: '',
  cataract_left: false,
  cataract_right: false,
  cataract_surgery_left: false,
  cataract_surgery_right: false,
  glaucoma_left: false,
  glaucoma_right: false,
  fractures: [] as { date: string; location: string }[],
  surgeries: [] as { date: string; location: string }[],
  allergy_history: '',
};

const diseases = [
  '高血壓',
  '糖尿病',
  '中風',
  '肺結核',
  '冠心病',
  '慢性支氣管炎/肺氣腫',
  '認知障礙症',
  '前列腺肥大',
  '心律不齊',
  '哮喘',
  '柏金遜病',
  '抑鬱症',
  '心臟衰竭',
  '痛風症',
  '精神病',
  '腎臟衰竭',
  '退化性關節炎',
];

const PatientMedicalHistorySection: React.FC<PatientMedicalHistorySectionProps> = ({
  formData,
  setFormData,
  newAllergy,
  setNewAllergy,
  addAllergy,
  removeAllergy,
  newAdverseReaction,
  setNewAdverseReaction,
  addAdverseReaction,
  removeAdverseReaction,
}) => {
  const history = { ...defaultMedicalHistory, ...(formData.medical_history_json || {}) };

  const updateHistory = (updates: Partial<typeof defaultMedicalHistory>) => {
    setFormData((prev: any) => ({
      ...prev,
      medical_history_json: { ...defaultMedicalHistory, ...(prev.medical_history_json || {}), ...updates },
    }));
  };

  const toggleDisease = (disease: string) => {
    const current = history.diseases || [];
    const updated = current.includes(disease)
      ? current.filter((d) => d !== disease)
      : [...current, disease];
    updateHistory({ diseases: updated });
  };

  const updateFracture = (index: number, field: string, value: string) => {
    const fractures = history.fractures.map((f, i) => (i === index ? { ...f, [field]: value } : f));
    updateHistory({ fractures });
  };

  const updateSurgery = (index: number, field: string, value: string) => {
    const surgeries = history.surgeries.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    updateHistory({ surgeries });
  };

  const addFracture = () => {
    updateHistory({ fractures: [...history.fractures, { date: '', location: '' }] });
  };

  const removeFracture = (index: number) => {
    updateHistory({ fractures: history.fractures.filter((_, i) => i !== index) });
  };

  const addSurgery = () => {
    updateHistory({ surgeries: [...history.surgeries, { date: '', location: '' }] });
  };

  const removeSurgery = (index: number) => {
    updateHistory({ surgeries: history.surgeries.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* 疾病 */}
      <div>
        <label className="form-label">病歷</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {diseases.map((disease) => (
            <label key={disease} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.diseases.includes(disease)}
                onChange={() => toggleDisease(disease)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{disease}</span>
            </label>
          ))}
        </div>
        {history.diseases.includes('精神病') && (
          <div className="mt-2">
            <label className="form-label">精神病種類</label>
            <input
              type="text"
              value={history.mental_illness_type}
              onChange={(e) => updateHistory({ mental_illness_type: e.target.value })}
              className="form-input"
              placeholder="輸入精神病種類"
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={history.diseases.includes('其他病症')}
            onChange={() => toggleDisease('其他病症')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-700">其他病症:</span>
          <input
            type="text"
            value={history.diseases_other}
            onChange={(e) => updateHistory({ diseases_other: e.target.value })}
            className="form-input flex-1"
            placeholder="輸入其他病症"
          />
        </div>
      </div>

      {/* 白內障 / 青光眼 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="form-label">白內障</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.cataract_left}
                onChange={(e) => updateHistory({ cataract_left: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">左</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.cataract_right}
                onChange={(e) => updateHistory({ cataract_right: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">右</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.cataract_surgery_left}
                onChange={(e) => updateHistory({ cataract_surgery_left: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">左(術後)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.cataract_surgery_right}
                onChange={(e) => updateHistory({ cataract_surgery_right: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">右(術後)</span>
            </label>
          </div>
        </div>
        <div>
          <label className="form-label">青光眼</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.glaucoma_left}
                onChange={(e) => updateHistory({ glaucoma_left: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">左</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={history.glaucoma_right}
                onChange={(e) => updateHistory({ glaucoma_right: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">右</span>
            </label>
          </div>
        </div>
      </div>

      {/* 骨折歷史 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <label className="form-label mb-0">骨折歷史</label>
          <button
            type="button"
            onClick={addFracture}
            className="btn-secondary text-sm flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>新增項目</span>
          </button>
        </div>
        <div className="space-y-4">
          {history.fractures.map((fracture, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeFracture(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={fracture.date}
                  onChange={(e) => updateFracture(index, 'date', e.target.value)}
                  className="form-input"
                  placeholder="受傷日期"
                />
                <input
                  type="text"
                  value={fracture.location}
                  onChange={(e) => updateFracture(index, 'location', e.target.value)}
                  className="form-input"
                  placeholder="位置"
                />
              </div>
            </div>
          ))}
          {history.fractures.length === 0 && (
            <div className="text-sm text-gray-500">暫無骨折歷史</div>
          )}
        </div>
      </div>

      {/* 外科手術歷史 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <label className="form-label mb-0">外科手術歷史</label>
          <button
            type="button"
            onClick={addSurgery}
            className="btn-secondary text-sm flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>新增項目</span>
          </button>
        </div>
        <div className="space-y-4">
          {history.surgeries.map((surgery, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSurgery(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={surgery.date}
                  onChange={(e) => updateSurgery(index, 'date', e.target.value)}
                  className="form-input"
                  placeholder="手術日期"
                />
                <input
                  type="text"
                  value={surgery.location}
                  onChange={(e) => updateSurgery(index, 'location', e.target.value)}
                  className="form-input"
                  placeholder="位置"
                />
              </div>
            </div>
          ))}
          {history.surgeries.length === 0 && (
            <div className="text-sm text-gray-500">暫無外科手術歷史</div>
          )}
        </div>
      </div>

      {/* 敏感歷史和不良反應 */}
      <div>
        <label className="form-label">敏感歷史和不良反應（包括物件、食品、藥物）</label>
        <div className="space-y-4">
          {/* 藥物敏感 */}
          <div>
            <label className="form-label text-sm text-gray-600">藥物敏感</label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  className="form-input flex-1"
                  placeholder="輸入藥物敏感項目"
                  onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.藥物敏感.map((allergy: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(index)}
                      className="ml-2 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.藥物敏感.length === 0 && (
                  <span className="text-sm text-gray-500">無藥物敏感</span>
                )}
              </div>
            </div>
          </div>

          {/* 不良藥物反應 */}
          <div>
            <label className="form-label text-sm text-gray-600">不良藥物反應</label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newAdverseReaction}
                  onChange={(e) => setNewAdverseReaction(e.target.value)}
                  className="form-input flex-1"
                  placeholder="輸入不良藥物反應項目"
                  onKeyPress={(e) => e.key === 'Enter' && addAdverseReaction()}
                />
                <button
                  type="button"
                  onClick={addAdverseReaction}
                  className="btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.不良藥物反應.map((reaction: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                  >
                    {reaction}
                    <button
                      type="button"
                      onClick={() => removeAdverseReaction(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.不良藥物反應.length === 0 && (
                  <span className="text-sm text-gray-500">無不良藥物反應</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientMedicalHistorySection;
