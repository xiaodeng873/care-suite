import { useState, useEffect } from 'react';
import { X, Stethoscope, Download } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import {
  AnnualHealthCheckup,
  calculateNextDueDate,
  getLatestHealthReadings,
  VISION_OPTIONS,
  HEARING_OPTIONS,
  SPEECH_OPTIONS,
  MENTAL_STATE_GROUP_A,
  MENTAL_STATE_GROUP_B,
  MOBILITY_OPTIONS,
  CONTINENCE_OPTIONS,
  ADL_OPTIONS,
  RECOMMENDATION_OPTIONS,
  parseMentalStateAssessment,
  combineMentalStateAssessment,
} from '../utils/annualHealthCheckupHelper';
import * as db from '../lib/database';

interface AnnualHealthCheckupModalProps {
  checkup: AnnualHealthCheckup | null;
  onClose: () => void;
  onSave: () => void;
  prefilledPatientId?: number | null;
}

export default function AnnualHealthCheckupModal({ checkup, onClose, onSave, prefilledPatientId }: AnnualHealthCheckupModalProps) {
  const { patients, annualHealthCheckups } = usePatients();
  const [loading, setLoading] = useState(false);
  const [fetchingReadings, setFetchingReadings] = useState(false);

  const parsedMentalState = parseMentalStateAssessment(checkup?.mental_state_assessment || null);

  const [formData, setFormData] = useState({
    patient_id: checkup?.patient_id || prefilledPatientId || null,
    last_doctor_signature_date: checkup?.last_doctor_signature_date || '',
    next_due_date: checkup?.next_due_date || '',

    has_serious_illness: checkup?.has_serious_illness || false,
    serious_illness_details: checkup?.serious_illness_details || '',
    has_allergy: checkup?.has_allergy || false,
    allergy_details: checkup?.allergy_details || '',
    has_infectious_disease: checkup?.has_infectious_disease || false,
    infectious_disease_details: checkup?.infectious_disease_details || '',
    needs_followup_treatment: checkup?.needs_followup_treatment || false,
    followup_treatment_details: checkup?.followup_treatment_details || '',
    has_swallowing_difficulty: checkup?.has_swallowing_difficulty || false,
    swallowing_difficulty_details: checkup?.swallowing_difficulty_details || '',
    has_special_diet: checkup?.has_special_diet || false,
    special_diet_details: checkup?.special_diet_details || '',
    mental_illness_record: checkup?.mental_illness_record || '',

    blood_pressure_systolic: checkup?.blood_pressure_systolic || null,
    blood_pressure_diastolic: checkup?.blood_pressure_diastolic || null,
    pulse: checkup?.pulse || null,
    body_weight: checkup?.body_weight || null,

    cardiovascular_notes: checkup?.cardiovascular_notes || '',
    respiratory_notes: checkup?.respiratory_notes || '',
    central_nervous_notes: checkup?.central_nervous_notes || '',
    musculo_skeletal_notes: checkup?.musculo_skeletal_notes || '',
    abdomen_urogenital_notes: checkup?.abdomen_urogenital_notes || '',
    lymphatic_notes: checkup?.lymphatic_notes || '',
    thyroid_notes: checkup?.thyroid_notes || '',
    skin_condition_notes: checkup?.skin_condition_notes || '',
    foot_notes: checkup?.foot_notes || '',
    eye_ear_nose_throat_notes: checkup?.eye_ear_nose_throat_notes || '',
    oral_dental_notes: checkup?.oral_dental_notes || '',
    physical_exam_others: checkup?.physical_exam_others || '',

    vision_assessment: checkup?.vision_assessment || '',
    with_visual_corrective_devices: checkup?.with_visual_corrective_devices ?? null,
    hearing_assessment: checkup?.hearing_assessment || '',
    with_hearing_aids: checkup?.with_hearing_aids ?? null,
    speech_assessment: checkup?.speech_assessment || '',
    mental_state: parsedMentalState.mental_state,
    dementia_stage: parsedMentalState.dementia_stage,
    mobility_assessment: checkup?.mobility_assessment || '',
    continence_assessment: checkup?.continence_assessment || '',
    adl_assessment: checkup?.adl_assessment || '',

    recommendation: checkup?.recommendation || '',
  });

  useEffect(() => {
    if (formData.last_doctor_signature_date) {
      const calculatedDate = calculateNextDueDate(formData.last_doctor_signature_date);
      setFormData(prev => ({ ...prev, next_due_date: calculatedDate }));
    }
  }, [formData.last_doctor_signature_date]);

  const handlePatientSelect = (patientId: string) => {
    setFormData(prev => ({ ...prev, patient_id: parseInt(patientId, 10) || null }));
  };

  const handleFetchLatestReadings = async () => {
    if (!formData.patient_id) {
      alert('請先選擇院友');
      return;
    }

    setFetchingReadings(true);
    try {
      const readings = await getLatestHealthReadings(formData.patient_id);

      if (readings.blood_pressure_systolic !== null) {
        setFormData(prev => ({
          ...prev,
          blood_pressure_systolic: readings.blood_pressure_systolic,
          blood_pressure_diastolic: readings.blood_pressure_diastolic,
          pulse: readings.pulse,
          body_weight: readings.body_weight,
        }));
      }
    } catch (error) {
      console.error('Error fetching latest readings:', error);
    } finally {
      setFetchingReadings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    setLoading(true);

    try {
      const existingCheckup = await db.getAnnualHealthCheckupByPatientId(formData.patient_id);

      if (existingCheckup && (!checkup || existingCheckup.id !== checkup.id)) {
        alert('該院友已有年度體檢記錄，請編輯現有記錄');
        setLoading(false);
        return;
      }

      const { mental_state, dementia_stage, ...restFormData } = formData;

      const checkupData = {
        ...restFormData,
        mental_state_assessment: combineMentalStateAssessment(mental_state, dementia_stage),
        blood_pressure_systolic: formData.blood_pressure_systolic ? Number(formData.blood_pressure_systolic) : null,
        blood_pressure_diastolic: formData.blood_pressure_diastolic ? Number(formData.blood_pressure_diastolic) : null,
        pulse: formData.pulse ? Number(formData.pulse) : null,
        body_weight: formData.body_weight ? Number(formData.body_weight) : null,
      };

      if (checkup) {
        await db.updateAnnualHealthCheckup({ id: checkup.id, ...checkupData });
      } else {
        await db.createAnnualHealthCheckup(checkupData);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving annual health checkup:', error);
      alert('儲存失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.院友id === formData.patient_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Stethoscope className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {checkup ? '編輯年度體檢' : '新增年度體檢'}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">院友 *</label>
                {checkup ? (
                  <div className="form-input bg-gray-100 cursor-not-allowed">
                    {selectedPatient ? `${selectedPatient.床號} - ${selectedPatient.中文姓名}` : '未知院友'}
                  </div>
                ) : (
                  <PatientAutocomplete
                    value={formData.patient_id?.toString() || ''}
                    onChange={handlePatientSelect}
                    placeholder="選擇院友"
                    showResidencyFilter={true}
                    defaultResidencyStatus="在住"
                  />
                )}
                {selectedPatient && !checkup && (
                  <p className="text-sm text-gray-600 mt-1">
                    床號: {selectedPatient.床號}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">上次醫生簽署日期</label>
                <input
                  type="date"
                  value={formData.last_doctor_signature_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_doctor_signature_date: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">下次到期日</label>
                <input
                  type="date"
                  value={formData.next_due_date}
                  readOnly
                  className="form-input bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">病歷</h3>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top w-12 text-center">(1)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">曾否患嚴重疾病／接受大型手術？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明診斷結果：</div>
                      <input
                        type="text"
                        value={formData.serious_illness_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, serious_illness_details: e.target.value }))}
                        placeholder="請輸入診斷結果"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300 w-32">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.has_serious_illness}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_serious_illness: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.has_serious_illness}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_serious_illness: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top text-center">(2)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">有否食物或藥物過敏？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明：</div>
                      <input
                        type="text"
                        value={formData.allergy_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, allergy_details: e.target.value }))}
                        placeholder="請輸入過敏詳情"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.has_allergy}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_allergy: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.has_allergy}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_allergy: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top text-center">(3)(a)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">有否傳染病徵狀？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明：</div>
                      <input
                        type="text"
                        value={formData.infectious_disease_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, infectious_disease_details: e.target.value }))}
                        placeholder="請輸入傳染病詳情"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.has_infectious_disease}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_infectious_disease: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.has_infectious_disease}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_infectious_disease: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top text-center">(3)(b)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">是否需要接受跟進檢查或治療？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明並填寫覆診的醫院／診所和檔號。</div>
                      <input
                        type="text"
                        value={formData.followup_treatment_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, followup_treatment_details: e.target.value }))}
                        placeholder="請輸入詳情"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.needs_followup_treatment}
                            onChange={(e) => setFormData(prev => ({ ...prev, needs_followup_treatment: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.needs_followup_treatment}
                            onChange={(e) => setFormData(prev => ({ ...prev, needs_followup_treatment: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top text-center">(4)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">有否吞嚥困難／容易哽塞？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明：</div>
                      <input
                        type="text"
                        value={formData.swallowing_difficulty_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, swallowing_difficulty_details: e.target.value }))}
                        placeholder="請輸入詳情"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.has_swallowing_difficulty}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_swallowing_difficulty: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.has_swallowing_difficulty}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_swallowing_difficulty: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-3 align-top text-center">(5)</td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-1">有否特別膳食需要？</div>
                      <div className="text-sm text-gray-600 mb-2">如有，請註明：</div>
                      <input
                        type="text"
                        value={formData.special_diet_details}
                        onChange={(e) => setFormData(prev => ({ ...prev, special_diet_details: e.target.value }))}
                        placeholder="請輸入詳情"
                        className="form-input w-full"
                      />
                    </td>
                    <td className="p-3 border-l border-gray-300">
                      <div className="flex items-center space-x-4 justify-end">
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">有</span>
                          <input
                            type="checkbox"
                            checked={formData.has_special_diet}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_special_diet: e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                        <label className="flex items-center space-x-1">
                          <span className="text-sm">無</span>
                          <input
                            type="checkbox"
                            checked={!formData.has_special_diet}
                            onChange={(e) => setFormData(prev => ({ ...prev, has_special_diet: !e.target.checked }))}
                            className="form-checkbox"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 align-top text-center">(6)</td>
                    <td colSpan={2} className="p-3 border-l border-gray-300">
                      <div className="font-medium mb-2">如過往有精神病紀錄，請詳述病歷及是否需要定期跟進治療。</div>
                      <input
                        type="text"
                        value={formData.mental_illness_record}
                        onChange={(e) => setFormData(prev => ({ ...prev, mental_illness_record: e.target.value }))}
                        placeholder="請輸入精神病紀錄詳述"
                        className="form-input w-full"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">身體檢查</h3>
              <button
                type="button"
                onClick={handleFetchLatestReadings}
                disabled={fetchingReadings || !formData.patient_id}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>{fetchingReadings ? '載入中...' : '取得最近讀數'}</span>
              </button>
            </div>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <td className="p-3 border-r border-gray-300 font-semibold w-48">血壓</td>
                    <td className="p-3 border-r border-gray-300">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={formData.blood_pressure_systolic || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, blood_pressure_systolic: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="收縮壓"
                          className="form-input w-24"
                        />
                        <span>/</span>
                        <input
                          type="number"
                          value={formData.blood_pressure_diastolic || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, blood_pressure_diastolic: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="舒張壓"
                          className="form-input w-24"
                        />
                        <span className="text-sm text-gray-600">mmHg</span>
                      </div>
                    </td>
                    <td className="p-3 border-r border-gray-300 font-semibold w-32">脈搏</td>
                    <td className="p-3 border-r border-gray-300">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={formData.pulse || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, pulse: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="脈搏"
                          className="form-input w-24"
                        />
                        <span className="text-sm text-gray-600">/min</span>
                      </div>
                    </td>
                    <td className="p-3 border-r border-gray-300 font-semibold w-32">體重</td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.body_weight || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, body_weight: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="體重"
                          className="form-input w-24"
                        />
                        <span className="text-sm text-gray-600">kg</span>
                      </div>
                    </td>
                  </tr>

                  {[
                    { label: '循環系統', key: 'cardiovascular_notes' },
                    { label: '呼吸系統', key: 'respiratory_notes' },
                    { label: '中樞神經系統', key: 'central_nervous_notes' },
                    { label: '肌骨', key: 'musculo_skeletal_notes' },
                    { label: '腹部／泌尿及生殖系統', key: 'abdomen_urogenital_notes' },
                    { label: '淋巴系統', key: 'lymphatic_notes' },
                    { label: '甲狀腺', key: 'thyroid_notes' },
                    { label: '皮膚狀況，如：壓力性損傷（壓瘡）', key: 'skin_condition_notes' },
                    { label: '足部', key: 'foot_notes' },
                    { label: '眼／耳鼻喉', key: 'eye_ear_nose_throat_notes' },
                    { label: '口腔／牙齒狀況', key: 'oral_dental_notes' },
                    { label: '其他', key: 'physical_exam_others' },
                  ].map(({ label, key }) => (
                    <tr key={key} className="border-b border-gray-300">
                      <td className="p-3 bg-gray-50 border-r border-gray-300 font-medium">{label}</td>
                      <td colSpan={5} className="p-3">
                        <input
                          type="text"
                          value={formData[key as keyof typeof formData] as string || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`輸入${label}備註`}
                          className="form-input w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">身體機能評估</h3>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 border-r border-gray-300 w-32">
                      <div className="font-semibold mb-2">視力</div>
                      <div className="text-xs text-gray-600 mb-2">(有/没有配戴视力矯正器)</div>
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={formData.with_visual_corrective_devices === true}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              with_visual_corrective_devices: e.target.checked ? true : null
                            }))}
                            className="form-checkbox"
                          />
                          <span className="text-sm">有</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={formData.with_visual_corrective_devices === false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              with_visual_corrective_devices: e.target.checked ? false : null
                            }))}
                            className="form-checkbox"
                          />
                          <span className="text-sm">没有</span>
                        </label>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="grid grid-cols-4 gap-4">
                        {VISION_OPTIONS.map(option => (
                          <label key={option} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.vision_assessment === option}
                              onChange={(e) => setFormData(prev => ({ ...prev, vision_assessment: e.target.checked ? option : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 border-r border-gray-300">
                      <div className="font-semibold mb-2">聽力</div>
                      <div className="text-xs text-gray-600 mb-2">(有/没有配戴助聽器)</div>
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={formData.with_hearing_aids === true}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              with_hearing_aids: e.target.checked ? true : null
                            }))}
                            className="form-checkbox"
                          />
                          <span className="text-sm">有</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={formData.with_hearing_aids === false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              with_hearing_aids: e.target.checked ? false : null
                            }))}
                            className="form-checkbox"
                          />
                          <span className="text-sm">没有</span>
                        </label>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="grid grid-cols-4 gap-4">
                        {HEARING_OPTIONS.map(option => (
                          <label key={option} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.hearing_assessment === option}
                              onChange={(e) => setFormData(prev => ({ ...prev, hearing_assessment: e.target.checked ? option : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 font-semibold border-r border-gray-300">語言能力</td>
                    <td className="p-3">
                      <div className="grid grid-cols-4 gap-4">
                        {SPEECH_OPTIONS.map(option => (
                          <label key={option} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.speech_assessment === option}
                              onChange={(e) => setFormData(prev => ({ ...prev, speech_assessment: e.target.checked ? option : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 font-semibold border-r border-gray-300">精神狀況</td>
                    <td className="p-3">
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">精神狀態（單選）</div>
                          <div className="grid grid-cols-4 gap-4">
                            {MENTAL_STATE_GROUP_A.map(option => (
                              <label key={option} className="flex items-start space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.mental_state === option}
                                  onChange={(e) => setFormData(prev => ({ ...prev, mental_state: e.target.checked ? option : '' }))}
                                  className="form-checkbox mt-1"
                                />
                                <span className="text-sm">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">認知障礙症階段（單選，可選可不選）</div>
                          <div className="grid grid-cols-3 gap-4">
                            {MENTAL_STATE_GROUP_B.map(option => (
                              <label key={option} className="flex items-start space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.dementia_stage === option}
                                  onChange={(e) => setFormData(prev => ({ ...prev, dementia_stage: e.target.checked ? option : '' }))}
                                  className="form-checkbox mt-1"
                                />
                                <span className="text-sm">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        {(formData.mental_state || formData.dementia_stage) && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
                            <span className="font-medium text-blue-800">已選擇：</span>
                            <span className="text-blue-700">
                              {[formData.mental_state, formData.dementia_stage].filter(Boolean).join(' | ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 font-semibold border-r border-gray-300">活動能力</td>
                    <td className="p-3">
                      <div className="grid grid-cols-4 gap-4">
                        {MOBILITY_OPTIONS.map(option => (
                          <label key={option} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.mobility_assessment === option}
                              onChange={(e) => setFormData(prev => ({ ...prev, mobility_assessment: e.target.checked ? option : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="bg-gray-50 p-3 font-semibold border-r border-gray-300">禁制能力</td>
                    <td className="p-3">
                      <div className="grid grid-cols-4 gap-4">
                        {CONTINENCE_OPTIONS.map(option => (
                          <label key={option} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.continence_assessment === option}
                              onChange={(e) => setFormData(prev => ({ ...prev, continence_assessment: e.target.checked ? option : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="bg-gray-50 p-3 font-semibold border-r border-gray-300">自我照顧能力</td>
                    <td className="p-3">
                      <div className="space-y-3">
                        {ADL_OPTIONS.map(option => (
                          <label key={option.value} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.adl_assessment === option.value}
                              onChange={(e) => setFormData(prev => ({ ...prev, adl_assessment: e.target.checked ? option.value : '' }))}
                              className="form-checkbox mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{option.value}</div>
                              <div className="text-xs text-gray-600 mt-1">{option.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">建議</h3>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 border-b border-gray-300">
                <p className="text-sm font-medium">申請人適合入住以下類別的安老院：</p>
              </div>

              <div className="p-4 space-y-4">
                {RECOMMENDATION_OPTIONS.map((option, index) => (
                  <label key={option.value} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.recommendation === option.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, recommendation: e.target.checked ? option.value : '' }))}
                      className="form-checkbox mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2">
                        <span className="font-semibold text-sm">{index + 1}.</span>
                        <span className="font-semibold text-sm">{option.value}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 ml-5">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? '儲存中...' : (checkup ? '更新' : '儲存')}
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
}
