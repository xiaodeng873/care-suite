import React, { useState } from 'react';
import { X, MessageSquare, Syringe, Calendar } from 'lucide-react';
import {
  VaccinationMessageSettings,
  saveVaccinationMessageSettings,
  buildVaccinationMessage,
} from '../utils/vaccinationMessageSettings';
import TemplateChipEditor from './TemplateChipEditor';

interface VaccinationMessageSettingsModalProps {
  userId?: string;
  settings: VaccinationMessageSettings;
  facilityNameZh: string;
  onClose: () => void;
}

const VaccinationMessageSettingsModal: React.FC<VaccinationMessageSettingsModalProps> = ({
  userId,
  settings: initialSettings,
  facilityNameZh,
  onClose,
}) => {
  const [settings, setSettings] = useState<VaccinationMessageSettings>(initialSettings);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preview = buildVaccinationMessage(settings, { 院友名稱: 'XXX', 院舍名稱: facilityNameZh });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveVaccinationMessageSettings(userId, settings);
      onClose();
    } catch (error) {
      console.error('儲存對話設定失敗:', error);
      alert('儲存對話設定失敗，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">意向查詢對話設定</h2>
              <p className="text-sm text-gray-500">自訂 WhatsApp 意向查詢訊息內容</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Syringe className="h-4 w-4 text-gray-400" />
                <span>疫苗名稱1</span>
              </label>
              <input
                type="text"
                value={settings.vaccine_name}
                onChange={(e) => setSettings(prev => ({ ...prev, vaccine_name: e.target.value }))}
                className="form-input"
                placeholder="例如：流感疫苗"
              />
            </div>
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Syringe className="h-4 w-4 text-gray-400" />
                <span>疫苗名稱2</span>
              </label>
              <input
                type="text"
                value={settings.vaccine_name_2}
                onChange={(e) => setSettings(prev => ({ ...prev, vaccine_name_2: e.target.value }))}
                className="form-input"
                placeholder="例如：肺炎球菌疫苗（可留空）"
              />
            </div>
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>接種日期</span>
              </label>
              <input
                type="text"
                value={settings.vaccination_date}
                onChange={(e) => setSettings(prev => ({ ...prev, vaccination_date: e.target.value }))}
                className="form-input"
                placeholder="例如：10月15日"
              />
            </div>
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>截止日期</span>
              </label>
              <input
                type="text"
                value={settings.deadline}
                onChange={(e) => setSettings(prev => ({ ...prev, deadline: e.target.value }))}
                className="form-input"
                placeholder="例如：10月10日"
              />
            </div>
          </div>

          <div>
            <label className="form-label">訊息內容</label>
            <TemplateChipEditor
              value={settings.message_template}
              onChange={(template) => setSettings(prev => ({ ...prev, message_template: template }))}
              chipValues={{
                院舍名稱: facilityNameZh,
                疫苗名稱1: settings.vaccine_name,
                疫苗名稱2: settings.vaccine_name_2,
                疫苗名稱: [settings.vaccine_name, settings.vaccine_name_2]
                  .map(name => name.trim())
                  .filter(Boolean)
                  .join('及'),
                接種日期: settings.vaccination_date,
                截止日期: settings.deadline,
                院友名稱: 'XXX',
              }}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">預覽（院友名稱以 XXX 顯示）</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{preview}</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
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
              {isSubmitting ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaccinationMessageSettingsModal;
