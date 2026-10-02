import React, { useState, useEffect, useMemo } from 'react';
import { X, CalendarCheck, Clock, MapPin, User, Car, UserCheck, MessageSquare, Copy, Save, ExternalLink } from 'lucide-react';
import { usePatientData, type FollowUpAppointment } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import OCRDocumentBlock from './OCRDocumentBlock';
import FollowUpMultiModal from './FollowUpMultiModal';
import InstitutionAutocomplete from './InstitutionAutocomplete';
import { getMedicationSettings, getMedicationSettingsFromDB, type MedicationSettingsData } from '../utils/medicationSettings';
import { getFacilitySettings } from '../utils/facilitySettings';
import { openWhatsApp, isWhatsAppAvailable } from '../utils/whatsapp';
import {
  DEFAULT_FOLLOWUP_MESSAGE_TEMPLATES,
  buildFollowUpMessage,
  loadFollowUpMessageTemplates,
  saveFollowUpMessageTemplates,
  type FollowUpMessageTemplates,
  type FollowUpMessageVars,
} from '../utils/followUpMessageSettings';
import { getPatientContacts, type PatientContact } from '../lib/database';
import { isDuplicateFollowUp } from '../utils/followUpDuplicate';
import { toast } from '../utils/toast';
import DateInput from './DateInput';
import TemplateChipEditor, { FOLLOWUP_TOKENS } from './TemplateChipEditor';
import { useStation } from '../context/facility/StationContext';


interface FollowUpModalProps {
  appointment?: Partial<FollowUpAppointment> | FollowUpAppointment;
  onClose: () => void;
}

const getInitialStatus = (appointment?: Partial<FollowUpAppointment> | FollowUpAppointment) => {
  if (appointment?.狀態) return appointment.狀態;
  const transport = appointment?.交通安排?.trim();
  const companion = appointment?.陪診人員?.trim();
  return transport && companion ? '已安排' : '尚未安排';
};

export default function FollowUpModal({ appointment, onClose }: FollowUpModalProps) {
  const { patients, followUpAppointments, addFollowUpAppointment, updateFollowUpAppointment } = usePatientData();

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
    return hongKongTime.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    院友id: appointment?.院友id || '',
    覆診日期: appointment?.覆診日期 || getHongKongDate(),
    出發時間: appointment?.出發時間 || '',
    覆診時間: appointment?.覆診時間 || '',
    覆診地點: appointment?.覆診地點 || '',
    覆診專科: appointment?.覆診專科 || '',
    交通安排: appointment?.交通安排 || '',
    陪診人員: appointment?.陪診人員 || '',
    備註: appointment?.備註 || '',
    狀態: getInitialStatus(appointment)
  });

  const [ocrError, setOcrError] = useState<string>('');
  const [multiOcr, setMultiOcr] = useState<{
    records: Record<string, unknown>[];
    patientId: number | null;
    imagePreviews?: string[];
  } | null>(null);

  // 通知訊息模板（陪診員／輪椅的士／問家人）：佔位符模板，可修改儲存，做法同疫苗接種訊息
  const { userProfile } = useAuth();
  const userId = userProfile?.id;
  const [templates, setTemplates] = useState<FollowUpMessageTemplates>(DEFAULT_FOLLOWUP_MESSAGE_TEMPLATES);
  const [drafts, setDrafts] = useState<FollowUpMessageTemplates>(DEFAULT_FOLLOWUP_MESSAGE_TEMPLATES);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [contacts, setContacts] = useState<PatientContact[]>([]);
  const [familyContactId, setFamilyContactId] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const { stations } = useStation();

  useEffect(() => {
    loadFollowUpMessageTemplates(userId)
      .then((t) => { setTemplates(t); setDrafts(t); })
      .catch(() => {})
      .finally(() => setTemplateLoaded(true));
  }, [userId]);

  useEffect(() => {
    getFacilitySettings()
      .then((s) => setFacilityName(s.facilityNameZh || ''))
      .catch(() => {});
  }, []);

  // 問家人訊息：電話由院友聯絡人頁資料做下拉清單
  useEffect(() => {
    const pid = parseInt(String(formData.院友id));
    if (!formData.院友id || Number.isNaN(pid)) { setContacts([]); setFamilyContactId(''); return; }
    getPatientContacts(pid)
      .then((list) => {
        setContacts(list);
        setFamilyContactId((prev) => (prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? '')));
      })
      .catch(() => setContacts([]));
  }, [formData.院友id]);

  const handleOCRComplete = (extractedData: any) => {
    setOcrError('');

    if (Array.isArray(extractedData.records) && extractedData.records.length > 1) {
      setMultiOcr({
        records: extractedData.records,
        patientId: extractedData.patient_id ?? extractedData.院友id ?? null,
        imagePreviews: Array.isArray(extractedData.imagePreviews) ? extractedData.imagePreviews : undefined,
      });
      return;
    }

    const updates: any = {};

    if (extractedData.院友id || extractedData.patient_id) {
      updates.院友id = String(extractedData.院友id || extractedData.patient_id);
    }
    if (extractedData.覆診日期 || extractedData.followup_date) {
      updates.覆診日期 = extractedData.覆診日期 || extractedData.followup_date;
    }
    if (extractedData.覆診時間 || extractedData.followup_time) {
      updates.覆診時間 = extractedData.覆診時間 || extractedData.followup_time;
    }
    if (extractedData.覆診地點 || extractedData.followup_location) {
      updates.覆診地點 = extractedData.覆診地點 || extractedData.followup_location;
    }
    if (extractedData.覆診專科 || extractedData.specialty) {
      updates.覆診專科 = extractedData.覆診專科 || extractedData.specialty;
    }
    if (extractedData.出發時間 || extractedData.departure_time) {
      updates.出發時間 = extractedData.出發時間 || extractedData.departure_time;
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  // 醫院／機構選項：重用藥物來源機構清單（藥物設定），可輸入中文名或英文簡稱搜索（開啟時拉 DB 最新）
  const [medSettings, setMedSettings] = useState<MedicationSettingsData>(() => getMedicationSettings());
  useEffect(() => { getMedicationSettingsFromDB().then(setMedSettings).catch(() => {}); }, []);

  // 交通安排選項
  const transportOptions = [
    '',
    '輪椅的士',
    '普通的士',
    '非緊急車',
    '無需安排'
  ];

  // 陪診人員選項
  const companionOptions = [
    '',
    '家人',
    '陪診員',
    '無需陪診'
  ];

  // 交通安排與陪診人員皆有內容時，預設狀態為「已安排」
  useEffect(() => {
    const transport = formData.交通安排?.trim();
    const companion = formData.陪診人員?.trim();
    setFormData(prev => {
      if (prev.狀態 === '已完成' || prev.狀態 === '改期' || prev.狀態 === '取消') return prev;
      const nextStatus = transport && companion ? '已安排' : '尚未安排';
      if (prev.狀態 === nextStatus) return prev;
      return { ...prev, 狀態: nextStatus };
    });
  }, [formData.交通安排, formData.陪診人員]);

  // 模板佔位符變數（由表單即時取值）
  // 覆診日期顯示「M月D日」、覆診星期顯示「星期一」等（通知訊息用中文日期格式）
  const messageVars = useMemo<FollowUpMessageVars>(() => {
    const patient = patients.find(p => p.院友id === parseInt(String(formData.院友id)));
    // 居住區：station_id 直接對應；舊資料冇 station_id 時以床號首碼對應 station.code
    let stationLabel = '';
    if (patient) {
      const st = stations.find(s => s.id === patient.station_id)
        ?? stations.find(s => (s.code || '').toUpperCase() === (patient.床號 || '').trim().charAt(0).toUpperCase());
      stationLabel = st?.name ?? '';
    }
    let dateLabel = '';
    let weekdayLabel = '';
    const dm = String(formData.覆診日期 || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dm) {
      dateLabel = `${parseInt(dm[2], 10)}月${parseInt(dm[3], 10)}日`;
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      weekdayLabel = weekdays[new Date(parseInt(dm[1], 10), parseInt(dm[2], 10) - 1, parseInt(dm[3], 10)).getDay()];
    }
    return {
      院友名稱: patient ? `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}` : '',
      居住區: stationLabel,
      院舍名稱: facilityName,
      覆診日期: dateLabel,
      覆診星期: weekdayLabel,
      覆診時間: (formData.覆診時間 || '').slice(0, 5),
      出發時間: (formData.出發時間 || '').slice(0, 5),
      覆診地點: formData.覆診地點,
      覆診專科: formData.覆診專科,
    };
  }, [patients, stations, facilityName, formData.院友id, formData.覆診日期, formData.覆診時間, formData.出發時間, formData.覆診地點, formData.覆診專科]);

  // 基本資料齊全先顯示「問家人」訊息
  const familyMessageReady = Boolean(
    formData.院友id && formData.覆診日期 && formData.覆診時間 && formData.覆診地點 && formData.覆診專科
  );

  const familyContact = contacts.find((c) => c.id === familyContactId) ?? null;

  const updateDraft = (key: keyof FollowUpMessageTemplates, field: 'template' | 'phone', value: string) => {
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSaveTemplate = async (key: keyof FollowUpMessageTemplates) => {
    try {
      const next = { ...templates, [key]: drafts[key] };
      await saveFollowUpMessageTemplates(userId, next);
      setTemplates(next);
      toast.success('模板已儲存，下次自動使用');
    } catch {
      alert('儲存模板失敗，請重試');
    }
  };

  const copyMessage = (message: string) => {
    if (message) {
      navigator.clipboard.writeText(message);
      toast.success('通知訊息已複製到剪貼簿');
    }
  };

  // 陪診員／輪椅的士：模板 + 電話（跟模板一齊儲存）＋WhatsApp 直達
  const renderTemplateBlock = (key: 'companion' | 'taxi', title: string) => {
    const draft = drafts[key];
    const message = buildFollowUpMessage(draft.template, messageVars);
    const dirty = JSON.stringify(draft) !== JSON.stringify(templates[key]);
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-blue-900">{title}</h3>
          <button
            type="button"
            onClick={() => handleSaveTemplate(key)}
            disabled={!templateLoaded}
            className="text-sm flex items-center gap-1 text-blue-700 hover:text-blue-900 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{dirty ? '儲存模板 *' : '儲存模板'}</span>
          </button>
        </div>
        {templateLoaded ? (
          <TemplateChipEditor
            value={draft.template}
            onChange={(template) => updateDraft(key, 'template', template)}
            chipValues={{ ...messageVars }}
            tokens={FOLLOWUP_TOKENS}
          />
        ) : (
          <div className="form-input text-sm text-gray-400 min-h-[7rem]">模板載入中...</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700">電話</label>
          <input
            value={draft.phone}
            onChange={(e) => updateDraft(key, 'phone', e.target.value)}
            className="form-input w-44"
            placeholder="接收方電話號碼"
          />
        </div>
        <div className="bg-white border border-blue-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openWhatsApp(draft.phone, message)}
            disabled={!isWhatsAppAvailable(draft.phone)}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            <span>WhatsApp 直達</span>
          </button>
          <button
            type="button"
            onClick={() => copyMessage(message)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Copy className="h-4 w-4" />
            <span>複製</span>
          </button>
        </div>
        <p className="text-xs text-blue-600">
          接收方如為 WhatsApp 群組：群組冇電話號碼，直達連結用唔到，請用「複製」後喺 WhatsApp 群組內貼上
        </p>
      </div>
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證必填欄位 - 新增覆診地點和覆診專科的驗證
    if (!formData.院友id) {
      alert('請選擇院友');
      return;
    }

    if (!formData.覆診日期) {
      alert('請填寫覆診日期');
      return;
    }

    if (!formData.覆診地點 || formData.覆診地點.trim() === '') {
      alert('請填寫覆診地點');
      return;
    }

    if (!formData.覆診專科 || formData.覆診專科.trim() === '') {
      alert('請填寫覆診專科');
      return;
    }

    // 如果狀態是改期或取消，檢查是否有備註
    if ((formData.狀態 === '改期' || formData.狀態 === '取消') && !formData.備註.trim()) {
      alert(`${formData.狀態}狀態需要填寫備註說明原因`);
      return;
    }

    const dupRaw = appointment as any;
    const dupExcludeId = dupRaw?.覆診id || dupRaw?.id;
    if (isDuplicateFollowUp(followUpAppointments, {
      院友id: parseInt(String(formData.院友id)),
      覆診日期: formData.覆診日期,
      覆診時間: formData.覆診時間,
      覆診地點: formData.覆診地點,
    }, dupExcludeId ? String(dupExcludeId) : undefined)) {
      const confirmed = window.confirm(`此覆診已存在（${formData.覆診日期}${formData.覆診時間 ? ` ${formData.覆診時間.slice(0, 5)}` : ''} · ${formData.覆診地點}），仍要新增嗎？`);
      if (!confirmed) return;
    }

    try {
      const finalStatus = formData.狀態 || (
        (formData.交通安排?.trim() && formData.陪診人員?.trim()) ? '已安排' : '尚未安排'
      );
      const appointmentData = {
        院友id: parseInt(String(formData.院友id)),
        覆診日期: formData.覆診日期,
        出發時間: formData.出發時間 || null,
        覆診時間: formData.覆診時間 || null,
        覆診地點: formData.覆診地點 || null,
        覆診專科: formData.覆診專科 || null,
        交通安排: formData.交通安排 || null,
        陪診人員: formData.陪診人員 || null,
        備註: formData.備註 || null,
        狀態: finalStatus
      } as Omit<FollowUpAppointment, '覆診id' | '創建時間' | '更新時間'>;

      const raw = appointment as any;
      const existingId = raw?.覆診id || raw?.id;

      if (existingId) {
        // 編輯現有覆診
        await updateFollowUpAppointment({
          覆診id: existingId,
          創建時間: raw.創建時間,
          更新時間: raw.更新時間,
          ...appointmentData
        } as FollowUpAppointment, true); // 使用樂觀更新
      } else {
        // 新增覆診（包括 AI 助護 OCR 預填）
        await addFollowUpAppointment(appointmentData);
      }

      onClose();
    } catch (error) {
      console.error('儲存覆診安排失敗:', error);
      alert('儲存覆診安排失敗，請重試');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '尚未安排': return 'text-red-600';
      case '已安排': return 'text-blue-600';
      case '已完成': return 'text-green-600';
      case '改期': return 'text-orange-600';
      case '取消': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CalendarCheck className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {appointment ? '編輯覆診安排' : '新增覆診安排'}
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
          <OCRDocumentBlock
            documentType="followup"
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
              <span className="text-red-600 text-sm">{ocrError}</span>
            </div>
          )}

          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              <PatientAutocomplete
                value={formData.院友id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, 院友id: patientId }))}
                placeholder="搜索院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            </div>

            <div>
              <label className="form-label">
                <CalendarCheck className="h-4 w-4 inline mr-1" />
                覆診日期 *
              </label>
              <DateInput
                value={formData.覆診日期}
                onChange={(value) => setFormData(prev => ({ ...prev, 覆診日期: value }))}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* 時間安排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Clock className="h-4 w-4 inline mr-1" />
                出發時間
              </label>
              <input
                type="time"
                name="出發時間"
                value={formData.出發時間}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                <Clock className="h-4 w-4 inline mr-1" />
                覆診時間
              </label>
              <input
                type="time"
                name="覆診時間"
                value={formData.覆診時間}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* 地點和專科 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <MapPin className="h-4 w-4 inline mr-1" />
                覆診地點 *
              </label>
              <InstitutionAutocomplete
                value={formData.覆診地點}
                onChange={(v) => setFormData(prev => ({ ...prev, 覆診地點: v }))}
                medSettings={medSettings}
                className="form-input"
                placeholder="輸入中文名或英文簡稱搜索…"
                emptyHint="清單以外的地點可直接輸入任意名稱"
                required
              />
            </div>

            <div>
              <label className="form-label">覆診專科 *</label>
              <input
                type="text"
                name="覆診專科"
                value={formData.覆診專科}
                onChange={handleChange}
                className="form-input"
                placeholder="如：內科、眼科、骨科等"
                required
              />
            </div>
          </div>

          {/* 交通和陪診安排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <Car className="h-4 w-4 inline mr-1" />
                交通安排
              </label>
              <select
                name="交通安排"
                value={formData.交通安排}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇</option>
                {transportOptions.filter(Boolean).map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                {formData.交通安排 && !transportOptions.includes(formData.交通安排) && (
                  <option value={formData.交通安排}>{formData.交通安排}</option>
                )}
              </select>
            </div>

            <div>
              <label className="form-label">
                <UserCheck className="h-4 w-4 inline mr-1" />
                陪診人員
              </label>
              <select
                name="陪診人員"
                value={formData.陪診人員}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇</option>
                {companionOptions.filter(Boolean).map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
                {formData.陪診人員 && !companionOptions.includes(formData.陪診人員) && (
                  <option value={formData.陪診人員}>{formData.陪診人員}</option>
                )}
              </select>
            </div>
          </div>

          {/* 狀態 */}
          <div>
            <label className="form-label">狀態</label>
            <select
              name="狀態"
              value={formData.狀態}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">請選擇狀態</option>
              <option value="尚未安排" className="text-red-600">尚未安排</option>
              <option value="已安排">已安排</option>
              <option value="已完成">已完成</option>
              <option value="改期">改期</option>
              <option value="取消">取消</option>
            </select>
            {(formData.狀態 === '改期' || formData.狀態 === '取消') && (
              <p className="text-sm text-orange-600 mt-1">
                此狀態需要在備註中說明原因
              </p>
            )}
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              備註
            </label>
            <textarea
              name="備註"
              value={formData.備註}
              onChange={handleChange}
              className="form-input"
              rows={3}
              placeholder="補充說明、注意事項等..."
            />
          </div>

          {/* 覆診安排通知訊息（問家人）：電話由院友聯絡人資料做下拉清單 */}
          {familyMessageReady && (() => {
            const key = 'family' as const;
            const draft = drafts.family;
            const message = buildFollowUpMessage(draft.template, messageVars);
            const dirty = JSON.stringify(draft) !== JSON.stringify(templates.family);
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-blue-900">覆診安排通知訊息</h3>
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(key)}
                    disabled={!templateLoaded}
                    className="text-sm flex items-center gap-1 text-blue-700 hover:text-blue-900 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{dirty ? '儲存模板 *' : '儲存模板'}</span>
                  </button>
                </div>
                {templateLoaded ? (
                  <TemplateChipEditor
                    value={draft.template}
                    onChange={(template) => updateDraft(key, 'template', template)}
                    chipValues={{ ...messageVars }}
                    tokens={FOLLOWUP_TOKENS}
                  />
                ) : (
                  <div className="form-input text-sm text-gray-400 min-h-[7rem]">模板載入中...</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-gray-700">聯絡人</label>
                  <select
                    value={familyContactId}
                    onChange={(e) => setFamilyContactId(e.target.value)}
                    className="form-input flex-1 min-w-44"
                  >
                    {contacts.length === 0 && <option value="">（此院友未有聯絡人資料）</option>}
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.聯絡人姓名}{c.關係 ? `（${c.關係}）` : ''}{c.聯絡電話 ? ` — ${c.聯絡電話}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openWhatsApp(familyContact?.聯絡電話 ?? '', message)}
                    disabled={!isWhatsAppAvailable(familyContact?.聯絡電話)}
                    className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>WhatsApp 直達</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyMessage(message)}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    <span>複製</span>
                  </button>
                </div>
                <p className="text-xs text-blue-600">
                  此訊息經 WhatsApp 發送給家屬確認安排
                </p>
              </div>
            );
          })()}

          {/* 輪椅的士安排通知訊息（喺覆診安排通知訊息之後） */}
          {formData.交通安排 === '輪椅的士' && renderTemplateBlock('taxi', '輪椅的士安排通知訊息')}

          {/* 陪診員安排通知訊息（喺覆診安排通知訊息之後） */}
          {formData.陪診人員 === '陪診員' && renderTemplateBlock('companion', '陪診員安排通知訊息')}

          {/* 提交按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {appointment ? '更新覆診安排' : '新增覆診安排'}
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

    {multiOcr && (
      <FollowUpMultiModal
        initialEntries={multiOcr.records}
        matchedPatientId={multiOcr.patientId}
        sourceImagePreviews={multiOcr.imagePreviews}
        onClose={() => setMultiOcr(null)}
      />
    )}
    </>
  );
}
