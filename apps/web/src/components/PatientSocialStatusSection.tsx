import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface PatientSocialStatusSectionProps {
  formData: any;
  setFormData: (updater: (prev: any) => any) => void;
}

const defaultSocialStatus = {
  education_level: '',
  languages: [] as string[],
  languages_other: '',
  previous_occupation: '',
  religion: [] as string[],
  religion_other: '',
  marital_status: '',
  economic_status: [] as string[],
  cssa_no: '',
  disability_allowance_level: '',
  hobbies: [] as string[],
  hobbies_other: '',
  interests_free_text: '',
  social_networks: [] as string[],
  social_networks_other: '',
  visits: [] as { name: string; relation: string; habit: string }[],
  visits_na: false,
};

const PatientSocialStatusSection: React.FC<PatientSocialStatusSectionProps> = ({
  formData,
  setFormData,
}) => {
  const status = { ...defaultSocialStatus, ...(formData.social_status_json || {}) } as typeof defaultSocialStatus;

  const updateStatus = (updates: Partial<typeof defaultSocialStatus>) => {
    setFormData((prev: any) => ({
      ...prev,
      social_status_json: { ...defaultSocialStatus, ...(prev.social_status_json || {}), ...updates },
    }));
  };

  const toggleArray = (field: keyof typeof defaultSocialStatus, value: string) => {
    const current = (status[field] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateStatus({ [field]: updated } as any);
  };

  const updateVisit = (index: number, field: string, value: string) => {
    const visits = status.visits.map((v, i) => (i === index ? { ...v, [field]: value } : v));
    updateStatus({ visits });
  };

  const addVisit = () => {
    updateStatus({ visits: [...status.visits, { name: '', relation: '', habit: '' }] });
  };

  const removeVisit = (index: number) => {
    updateStatus({ visits: status.visits.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* 教育程度 */}
      <div>
        <label className="form-label">教育程度</label>
        <select
          value={status.education_level}
          onChange={(e) => updateStatus({ education_level: e.target.value })}
          className="form-input"
        >
          <option value="">請選擇</option>
          <option value="未受教育">未受教育</option>
          <option value="未受教育,但可閱報">未受教育,但可閱報</option>
          <option value="小學">小學</option>
          <option value="中學">中學</option>
          <option value="大學">大學</option>
        </select>
      </div>

      {/* 所用語言 */}
      <div>
        <label className="form-label">所用語言</label>
        <div className="flex flex-wrap gap-4">
          {['廣東話', '潮州話', '福建話', '客家話', '上海話', '國語(普通話)'].map((lang) => (
            <label key={lang} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.languages.includes(lang)}
                onChange={() => toggleArray('languages', lang)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{lang}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="checkbox"
              checked={status.languages.includes('其他')}
              onChange={() => toggleArray('languages', '其他')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700 whitespace-nowrap">其他:</span>
            <input
              type="text"
              value={status.languages_other}
              onChange={(e) => updateStatus({ languages_other: e.target.value })}
              className="form-input flex-1"
              placeholder="請說明"
            />
          </label>
        </div>
      </div>

      {/* 從前主要職業 */}
      <div>
        <label className="form-label">從前主要職業</label>
        <input
          type="text"
          value={status.previous_occupation}
          onChange={(e) => updateStatus({ previous_occupation: e.target.value })}
          className="form-input"
          placeholder="輸入從前主要職業"
        />
      </div>

      {/* 宗教信仰 */}
      <div>
        <label className="form-label">宗教信仰</label>
        <div className="flex flex-wrap gap-4">
          {['天主教', '基督教', '佛教', '回教'].map((rel) => (
            <label key={rel} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.religion.includes(rel)}
                onChange={() => toggleArray('religion', rel)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{rel}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="checkbox"
              checked={status.religion.includes('其他')}
              onChange={() => toggleArray('religion', '其他')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700 whitespace-nowrap">其他:</span>
            <input
              type="text"
              value={status.religion_other}
              onChange={(e) => updateStatus({ religion_other: e.target.value })}
              className="form-input flex-1"
              placeholder="請說明"
            />
          </label>
        </div>
      </div>

      {/* 婚姻狀況 */}
      <div>
        <label className="form-label">婚姻狀況</label>
        <select
          value={status.marital_status}
          onChange={(e) => updateStatus({ marital_status: e.target.value })}
          className="form-input"
        >
          <option value="">請選擇</option>
          <option value="單身">單身</option>
          <option value="已婚">已婚</option>
          <option value="分居">分居</option>
          <option value="離婚">離婚</option>
          <option value="鳏寡">鳏寡</option>
        </select>
      </div>

      {/* 經濟狀況 */}
      <div>
        <label className="form-label">經濟狀況</label>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            {['經濟獨立', '家人供養', '高齡津貼(普通/高額)'].map((item) => (
              <label key={item} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={status.economic_status.includes(item)}
                  onChange={() => toggleArray('economic_status', item)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{item}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.economic_status.includes('綜合援助')}
                onChange={() => toggleArray('economic_status', '綜合援助')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">綜合援助</span>
            </label>
            <span className="text-sm text-gray-700">綜援號碼:</span>
            <input
              type="text"
              value={status.cssa_no}
              onChange={(e) => updateStatus({ cssa_no: e.target.value })}
              className="form-input flex-1"
              placeholder="輸入綜援號碼"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.economic_status.includes('傷殘津貼')}
                onChange={() => toggleArray('economic_status', '傷殘津貼')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">傷殘津貼（高/低）</span>
            </label>
            <select
              value={status.disability_allowance_level}
              onChange={(e) => updateStatus({ disability_allowance_level: e.target.value })}
              className="form-input"
            >
              <option value="">請選擇</option>
              <option value="高">高</option>
              <option value="低">低</option>
            </select>
          </div>
        </div>
      </div>

      {/* 嗜好 / 興趣 */}
      <div>
        <label className="form-label">嗜好 / 興趣</label>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            {['吸煙', '嗜酒', '賭博'].map((hobby) => (
              <label key={hobby} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={status.hobbies.includes(hobby)}
                  onChange={() => toggleArray('hobbies', hobby)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{hobby}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="checkbox"
                checked={status.hobbies.includes('其他')}
                onChange={() => toggleArray('hobbies', '其他')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 whitespace-nowrap">其他:</span>
              <input
                type="text"
                value={status.hobbies_other}
                onChange={(e) => updateStatus({ hobbies_other: e.target.value })}
                className="form-input flex-1"
                placeholder="請說明"
              />
            </label>
          </div>
          <input
            type="text"
            value={status.interests_free_text}
            onChange={(e) => updateStatus({ interests_free_text: e.target.value })}
            className="form-input"
            placeholder="興趣/愛好自由文字"
          />
        </div>
      </div>

      {/* 出外參加社交網絡 */}
      <div>
        <label className="form-label">出外參加社交網絡</label>
        <div className="flex flex-wrap gap-4">
          {['社區中心', '教會', '不適用'].map((item) => (
            <label key={item} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.social_networks.includes(item)}
                onChange={() => toggleArray('social_networks', item)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{item}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="checkbox"
              checked={status.social_networks.includes('其他')}
              onChange={() => toggleArray('social_networks', '其他')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700 whitespace-nowrap">其他:</span>
            <input
              type="text"
              value={status.social_networks_other}
              onChange={(e) => updateStatus({ social_networks_other: e.target.value })}
              className="form-input flex-1"
              placeholder="請說明"
            />
          </label>
        </div>
      </div>

      {/* 親友探訪 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <label className="form-label mb-0">親友探訪</label>
          <button
            type="button"
            onClick={addVisit}
            className="btn-secondary text-sm flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>新增項目</span>
          </button>
        </div>
        <div className="space-y-4">
          {status.visits.map((visit, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeVisit(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  value={visit.name}
                  onChange={(e) => updateVisit(index, 'name', e.target.value)}
                  className="form-input"
                  placeholder="姓名"
                />
                <input
                  type="text"
                  value={visit.relation}
                  onChange={(e) => updateVisit(index, 'relation', e.target.value)}
                  className="form-input"
                  placeholder="關係"
                />
                <input
                  type="text"
                  value={visit.habit}
                  onChange={(e) => updateVisit(index, 'habit', e.target.value)}
                  className="form-input"
                  placeholder="探訪習慣"
                />
              </div>
            </div>
          ))}
          {status.visits.length === 0 && (
            <div className="text-sm text-gray-500">暫無親友探訪記錄</div>
          )}
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={status.visits_na}
              onChange={(e) => updateStatus({ visits_na: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">不適用</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default PatientSocialStatusSection;
