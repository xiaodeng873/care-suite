import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Loader } from 'lucide-react';
import { getPromptTemplates, getUserActivePrompt, saveUserPrompt, getDefaultPrompt, type PromptTemplate } from '../utils/promptManager';

/**
 * 智能識別 Prompt 設定（系統設定 → 輔助工具）。
 * 原為處方管理「智能識別」區塊內嘅編輯器，依要求搬到系統設定統一管理。
 * 儲存後即時生效：所有智能識別（處方標籤、身份證等）都用呢個 prompt。
 */
const OcrPromptSettingsPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPromptData();
  }, []);

  const loadPromptData = async () => {
    setLoading(true);
    const templates = await getPromptTemplates();
    setPromptTemplates(templates);

    if (templates.length > 0) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
    }

    const userPrompt = await getUserActivePrompt();
    if (userPrompt) {
      setPrompt(userPrompt);
    } else {
      const defaultPrompt = await getDefaultPrompt();
      setPrompt(defaultPrompt);
    }
    setLoading(false);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
      setPrompt(template.prompt_content);
    }
  };

  const handleSavePrompt = async () => {
    if (!prompt.trim()) {
      setMessage({ type: 'error', text: 'Prompt 不能為空' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const success = await saveUserPrompt(prompt);
    setSaving(false);
    if (success) {
      setMessage({ type: 'success', text: 'Prompt 已儲存，所有智能識別即時生效' });
    } else {
      setMessage({ type: 'error', text: '儲存 Prompt 失敗，請重試' });
    }
  };

  const handleRestoreDefault = async () => {
    const defaultPrompt = await getDefaultPrompt();
    setPrompt(defaultPrompt);
    const defaultTemplate = promptTemplates.find(t => t.is_default);
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader className="h-4 w-4 animate-spin" />
        <span>載入 Prompt 設定...</span>
      </div>
    );
  }

  return (
    <div className="py-4 border-b border-gray-100 dark:border-slate-700">
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">智能識別指令 (Prompt)</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">
        自訂所有智能識別（處方標籤、身份證等）用嘅 AI 指令；儲存後即時生效
      </p>

      {message && (
        <div
          className={`text-sm rounded-lg px-3 py-2 mb-3 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="form-label">Prompt 模板</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="form-input"
          >
            <option value="">選擇模板...</option>
            {promptTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} {template.is_default ? '(預設)' : ''}
              </option>
            ))}
          </select>
          {promptTemplates.find(t => t.id === selectedTemplateId)?.description && (
            <p className="text-xs text-gray-600 mt-1">
              {promptTemplates.find(t => t.id === selectedTemplateId)?.description}
            </p>
          )}
        </div>

        <div>
          <label className="form-label">AI 識別指令 (Prompt)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="form-input font-mono text-sm"
            rows={10}
            placeholder="輸入 AI 識別指令..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSavePrompt}
            className="btn-primary text-sm flex items-center gap-1"
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            <span>{saving ? '儲存中...' : '儲存為預設'}</span>
          </button>
          <button
            type="button"
            onClick={handleRestoreDefault}
            className="btn-secondary text-sm flex items-center gap-1"
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4" />
            <span>恢復預設</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcrPromptSettingsPanel;
