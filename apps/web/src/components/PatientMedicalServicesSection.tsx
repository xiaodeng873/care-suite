import React from 'react';
import { Plus, Trash2, Calendar, Building2, Syringe } from 'lucide-react';
import { type VaccinationRecord } from '../lib/database';
import DateInput from './DateInput';

interface PatientMedicalServicesSectionProps {
  formData: any;
  setFormData: (updater: (prev: any) => any) => void;
  patientId?: number;
  vaccinationRecords: VaccinationRecord[];
  onVaccinationRecordsChange: (records: VaccinationRecord[]) => void;
}

const defaultMedicalServices = {
  geriatric_hospital: { enabled: false, detail: '' },
  cgat: { enabled: false, detail: '' },
  gopc: { enabled: false, detail: '' },
  cns: false,
  sopc: { enabled: false, detail: '' },
  visiting_doctor: { enabled: false, name: '', phone: '' },
  family_doctor: { enabled: false, name: '', phone: '' }
};

const PatientMedicalServicesSection: React.FC<PatientMedicalServicesSectionProps> = ({
  formData,
  setFormData,
  patientId,
  vaccinationRecords,
  onVaccinationRecordsChange
}) => {
  const services = { ...defaultMedicalServices, ...(formData.medical_services_json || {}) };

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return hongKongTime.toISOString().split('T')[0];
  };

  const addVaccinationItem = () => {
    const newRecord: VaccinationRecord = {
      id: '',
      patient_id: patientId || 0,
      vaccination_date: getHongKongDate(),
      vaccine_item: '',
      vaccination_unit: '',
      remarks: '',
      created_at: '',
      updated_at: '',
      created_by: ''
    };
    onVaccinationRecordsChange([...vaccinationRecords, newRecord]);
  };

  const removeVaccinationItem = (index: number) => {
    onVaccinationRecordsChange(vaccinationRecords.filter((_, i) => i !== index));
  };

  const updateVaccinationItem = (index: number, field: keyof VaccinationRecord, value: string) => {
    onVaccinationRecordsChange(
      vaccinationRecords.map((r, i) => i === index ? { ...r, [field]: value } : r)
    );
  };

  const updateServices = (updates: Partial<typeof defaultMedicalServices>) => {
    setFormData((prev: any) => ({
      ...prev,
      medical_services_json: { ...defaultMedicalServices, ...(prev.medical_services_json || {}), ...updates }
    }));
  };

  const updateService = (key: keyof typeof defaultMedicalServices, value: any) => {
    updateServices({ [key]: value } as any);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* 疫苗注射記錄 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <label className="form-label mb-0">流行性感冒疫苗及肺炎球菌疫苗注射記錄</label>
          <button
            type="button"
            onClick={addVaccinationItem}
            className="btn-secondary text-sm flex items-center space-x-1">
            
            <Plus className="h-4 w-4" />
            <span>新增項目</span>
          </button>
        </div>
        <div className="space-y-4">
          {vaccinationRecords.map((record, index) =>
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                {vaccinationRecords.length > 1 &&
              <button
                type="button"
                onClick={() => removeVaccinationItem(index)}
                className="text-red-600 hover:text-red-700">
                
                    <Trash2 className="h-4 w-4" />
                  </button>
              }
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label flex flex-wrap items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>注射日期</span>
                  </label>
                  <DateInput

                  value={record.vaccination_date}

                  className="form-input" onChange={(value) => updateVaccinationItem(index, 'vaccination_date', value)} />
                
                </div>

                <div>
                  <label className="form-label flex flex-wrap items-center gap-2">
                    <Syringe className="h-4 w-4 text-gray-400" />
                    <span>疫苗項目 / 名稱</span>
                  </label>
                  <input
                  type="text"
                  value={record.vaccine_item}
                  onChange={(e) => updateVaccinationItem(index, 'vaccine_item', e.target.value)}
                  className="form-input"
                  placeholder="例如：流感疫苗" />
                
                </div>

                <div>
                  <label className="form-label flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>注射單位 / 醫院</span>
                  </label>
                  <input
                  type="text"
                  value={record.vaccination_unit}
                  onChange={(e) => updateVaccinationItem(index, 'vaccination_unit', e.target.value)}
                  className="form-input"
                  placeholder="例如：衛生署" />
                
                </div>
              </div>
            </div>
          )}
          {vaccinationRecords.length === 0 &&
          <div className="text-sm text-gray-500">暫無疫苗記錄</div>
          }
        </div>
      </div>

      {/* 現正接受醫療服務及覆診機構 */}
      <div>
        <label className="form-label">現正接受醫療服務及覆診機構</label>
        <div className="space-y-4">
          {/* 老人日間醫院 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={services.geriatric_hospital.enabled}
              onChange={(e) =>
              updateService('geriatric_hospital', { ...services.geriatric_hospital, enabled: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            
            <span className="text-sm text-gray-700">老人日間醫院:</span>
            <input
              type="text"
              value={services.geriatric_hospital.detail}
              onChange={(e) =>
              updateService('geriatric_hospital', { ...services.geriatric_hospital, detail: e.target.value })
              }
              className="form-input flex-1"
              placeholder="詳情" />
            
          </div>

          {/* CGAT */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={services.cgat.enabled}
              onChange={(e) => updateService('cgat', { ...services.cgat, enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            
            <span className="text-sm text-gray-700">社區老人評估小組(CGAT):</span>
            <input
              type="text"
              value={services.cgat.detail}
              onChange={(e) => updateService('cgat', { ...services.cgat, detail: e.target.value })}
              className="form-input flex-1"
              placeholder="詳情" />
            
          </div>

          {/* 普通科門診 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={services.gopc.enabled}
              onChange={(e) => updateService('gopc', { ...services.gopc, enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            
            <span className="text-sm text-gray-700">普通科門診:</span>
            <input
              type="text"
              value={services.gopc.detail}
              onChange={(e) => updateService('gopc', { ...services.gopc, detail: e.target.value })}
              className="form-input flex-1"
              placeholder="詳情" />
            
          </div>

          {/* CNS */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={services.cns}
              onChange={(e) => updateService('cns', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            
            <span className="text-sm text-gray-700">社康護理服務(CNS)</span>
          </div>

          {/* 專科門診 */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={services.sopc.enabled}
                onChange={(e) => updateService('sopc', { ...services.sopc, enabled: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              
              <span className="text-sm text-gray-700">專科門診:</span>
            </div>
            <textarea
              value={services.sopc.detail}
              onChange={(e) => updateService('sopc', { ...services.sopc, detail: e.target.value })}
              className="form-input"
              rows={2}
              placeholder="詳情" />
            
          </div>

          {/* 到診醫生 */}
          <div className="border rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={services.visiting_doctor.enabled}
                onChange={(e) =>
                updateService('visiting_doctor', { ...services.visiting_doctor, enabled: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              
              <span className="text-sm font-medium text-gray-700">到診醫生</span>
            </label>
            {services.visiting_doctor.enabled &&
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                <input
                type="text"
                value={services.visiting_doctor.name}
                onChange={(e) =>
                updateService('visiting_doctor', { ...services.visiting_doctor, name: e.target.value })
                }
                className="form-input"
                placeholder="到診醫生姓名" />
              
                <input
                type="tel"
                value={services.visiting_doctor.phone}
                onChange={(e) =>
                updateService('visiting_doctor', { ...services.visiting_doctor, phone: e.target.value })
                }
                className="form-input"
                placeholder="電話" />
              
              </div>
            }
          </div>

          {/* 家庭醫生 */}
          <div className="border rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={services.family_doctor.enabled}
                onChange={(e) =>
                updateService('family_doctor', { ...services.family_doctor, enabled: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              
              <span className="text-sm font-medium text-gray-700">家庭醫生</span>
            </label>
            {services.family_doctor.enabled &&
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                <input
                type="text"
                value={services.family_doctor.name}
                onChange={(e) =>
                updateService('family_doctor', { ...services.family_doctor, name: e.target.value })
                }
                className="form-input"
                placeholder="家庭醫生姓名" />
              
                <input
                type="tel"
                value={services.family_doctor.phone}
                onChange={(e) =>
                updateService('family_doctor', { ...services.family_doctor, phone: e.target.value })
                }
                className="form-input"
                placeholder="電話" />
              
              </div>
            }
          </div>
        </div>
      </div>

      {/* 首次記錄 */}
      <div>
        <label className="form-label">首次記錄</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            name="首次記錄職員姓名"
            value={formData.首次記錄職員姓名}
            onChange={handleChange}
            className="form-input"
            placeholder="職員姓名" />
          
          <input
            type="text"
            name="首次記錄職級"
            value={formData.首次記錄職級}
            onChange={handleChange}
            className="form-input"
            placeholder="職級" />
          
          <input
            type="text"
            name="首次記錄簽署"
            value={formData.首次記錄簽署}
            onChange={handleChange}
            className="form-input"
            placeholder="簽署" />
          
          <DateInput
            name="首次記錄日期"
            value={formData.首次記錄日期}
            onChange={(value) => setFormData((prev) => ({ ...prev, ['首次記錄日期']: value }))}
            className="form-input" />
        </div>
      </div>
    </div>);

};

export default PatientMedicalServicesSection;