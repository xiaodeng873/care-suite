import React, { useState, useEffect } from 'react';
import { X, Shield, User, Calendar } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { type InfectionControlRecord } from '../lib/database';
import PatientAutocomplete from './PatientAutocomplete';

interface InfectionControlModalProps {
  record?: InfectionControlRecord | null;
  prefilledPatientId?: number | null;
  onClose: () => void;
  onSave: () => void;
}

const InfectionControlModal: React.FC<InfectionControlModalProps> = ({
  record,
  prefilledPatientId,
  onClose,
  onSave,
}) => {
  const { patients, infectionControlRecords, addInfectionControlRecord, updateInfectionControlRecord } = usePatients();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    patient_id: number | null;
    infection_type: string;
    diagnosis_date: string;
    recovery_date: string;
    notes: string;
  }>({
    patient_id: record?.patient_id ?? prefilledPatientId ?? null,
    infection_type: record?.infection_type || '',
    diagnosis_date: record?.diagnosis_date || '',
    recovery_date: record?.recovery_date || '',
    notes: record?.notes || '',
  });

  const selectedPatient = patients.find(p => p.院友id === formData.patient_id);

  const existingInfectionTypes = React.useMemo(() => {
    const types = new Set(infectionControlRecords.map(r => r.infection_type?.trim()).filter(Boolean) as string[]);
    return Array.from(types).sort();
  }, [infectionControlRecords]);

  const handleChange = (field: keyof typeof formData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }
    if (!formData.infection_type.trim()) {
      alert('請輸入感染性質');
      return;
    }
    if (!formData.diagnosis_date) {
      alert('請選擇確診日期');
      return;
    }

    setLoading(true);
    try {
      const recordData = {
        patient_id: formData.patient_id,
        infection_type: formData.infection_type.trim(),
        diagnosis_date: formData.diagnosis_date,
        recovery_date: formData.recovery_date || null,
        notes: formData.notes.trim() || null,
      };

      if (record) {
        await updateInfectionControlRecord({ ...record, ...recordData });
      } else {
        await addInfectionControlRecord(recordData);
      }
      onSave();
    } catch (error) {
      console.error('儲存感染控制記錄失敗:', error);
      alert('儲存失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {record ? '編輯感染控制記錄' : '新增感染控制記錄'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="form-label flex flex-wrap items-center gap-2">
              <span className="text-red-500">*</span>
              <span>院友</span>
            </label>
            {selectedPatient ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900">
                  {selectedPatient.中文姓氏}{selectedPatient.中文名字} ({selectedPatient.床號})
                </span>
                {!record && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, patient_id: null }))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    更改
                  </button>
                )}
              </div>
            ) : (
              <PatientAutocomplete
                value=""
                onChange={(patientIdStr) => handleChange('patient_id', parseInt(patientIdStr, 10) || null)}
                placeholder="搜索院友姓名或床號..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            )}
          </div>

          <div>
            <label className="form-label flex flex-wrap items-center gap-2">
              <span className="text-red-500">*</span>
              <span>感染性質</span>
            </label>
            <input
              type="text"
              value={formData.infection_type}
              onChange={(e) => handleChange('infection_type', e.target.value)}
              className="form-input"
              placeholder="例如：MRSA、CPE、VRE"
            />
            {existingInfectionTypes.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1.5">現存品種（點擊快速選擇）：</p>
                <div className="flex flex-wrap gap-2">
                  {existingInfectionTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleChange('infection_type', type)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        formData.infection_type === type
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-red-500">*</span>
                <span>確診日期</span>
              </label>
              <input
                type="date"
                value={formData.diagnosis_date}
                onChange={(e) => handleChange('diagnosis_date', e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>康復日期</span>
              </label>
              <input
                type="date"
                value={formData.recovery_date}
                onChange={(e) => handleChange('recovery_date', e.target.value)}
                className="form-input"
              />
              <p className="text-xs text-gray-500 mt-1">如未康復可留空</p>
            </div>
          </div>

          <div>
            <label className="form-label">備註</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="form-input"
              rows={3}
              placeholder="輸入備註..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '儲存中...' : (record ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InfectionControlModal;
