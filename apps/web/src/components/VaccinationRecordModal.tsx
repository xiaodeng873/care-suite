import React, { useState } from 'react';
import { X, Syringe, Calendar, Building2, Plus, Trash2 } from 'lucide-react';
import { usePatients, type VaccinationRecord } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import OCRDocumentBlock from './OCRDocumentBlock';

interface VaccinationRecordModalProps {
  patientId?: number;
  existingRecords?: VaccinationRecord[];
  prefilledData?: any;
  onClose: () => void;
}

interface VaccinationItem {
  id: string;
  vaccination_date: string;
  vaccine_item: string;
  vaccination_unit: string;
}

const VaccinationRecordModal: React.FC<VaccinationRecordModalProps> = ({
  patientId,
  existingRecords = [],
  prefilledData,
  onClose
}) => {
  const { patients, addVaccinationRecord } = usePatients();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>(
    prefilledData?.patient_id || patientId
  );
  const [vaccinationItems, setVaccinationItems] = useState<VaccinationItem[]>([
    {
      id: Date.now().toString(),
      vaccination_date: prefilledData?.vaccination_date || getHongKongDate(),
      vaccine_item: prefilledData?.vaccine_item || '',
      vaccination_unit: prefilledData?.vaccination_unit || ''
    }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');

  const handleOCRComplete = (extractedData: any) => {
    setOcrError('');

    if (extractedData.patient_id) {
      setSelectedPatientId(extractedData.patient_id);
    }

    if (extractedData.records && Array.isArray(extractedData.records)) {
      const newItems = extractedData.records.map((record: any) => ({
        id: Date.now().toString() + Math.random(),
        vaccination_date: record.vaccination_date || getHongKongDate(),
        vaccine_item: record.vaccine_item || '',
        vaccination_unit: record.vaccination_unit || ''
      }));
      setVaccinationItems(newItems);
    } else {
      setVaccinationItems([{
        id: Date.now().toString(),
        vaccination_date: extractedData.vaccination_date || getHongKongDate(),
        vaccine_item: extractedData.vaccine_item || '',
        vaccination_unit: extractedData.vaccination_unit || ''
      }]);
    }
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  const addVaccinationItem = () => {
    setVaccinationItems([
      ...vaccinationItems,
      {
        id: Date.now().toString(),
        vaccination_date: getHongKongDate(),
        vaccine_item: '',
        vaccination_unit: ''
      }
    ]);
  };

  const removeVaccinationItem = (id: string) => {
    if (vaccinationItems.length > 1) {
      setVaccinationItems(vaccinationItems.filter(item => item.id !== id));
    }
  };

  const updateVaccinationItem = (id: string, field: keyof VaccinationItem, value: string) => {
    setVaccinationItems(vaccinationItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedPatientId) {
      newErrors.patient_id = '請選擇院友';
    }

    vaccinationItems.forEach((item, index) => {
      if (!item.vaccination_date) {
        newErrors[`vaccination_date_${index}`] = '請選擇注射日期';
      }
      if (!item.vaccine_item.trim()) {
        newErrors[`vaccine_item_${index}`] = '請輸入疫苗項目';
      }
      if (!item.vaccination_unit.trim()) {
        newErrors[`vaccination_unit_${index}`] = '請輸入注射單位';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      for (const item of vaccinationItems) {
        const recordData = {
          patient_id: selectedPatientId!,
          vaccination_date: item.vaccination_date,
          vaccine_item: item.vaccine_item.trim(),
          vaccination_unit: item.vaccination_unit.trim(),
          remarks: ''
        };

        await addVaccinationRecord(recordData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving vaccination records:', error);
      alert('儲存疫苗記錄失敗，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPatient = patients.find(p => p.院友id === selectedPatientId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Syringe className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">疫苗記錄</h2>
              {selectedPatient && (
                <p className="text-sm text-gray-500">
                  {selectedPatient.中文姓名} - 床號: {selectedPatient.床號}
                </p>
              )}
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
          <OCRDocumentBlock
            documentType="vaccination"
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
              <span className="text-red-600 text-sm">{ocrError}</span>
            </div>
          )}

          <div>
            <label className="form-label flex items-center space-x-2">
              <span className="text-red-500">*</span>
              <span>院友</span>
            </label>
            <PatientAutocomplete
              value={selectedPatientId?.toString() || ''}
              onChange={(patientIdStr) => {
                setSelectedPatientId(parseInt(patientIdStr));
                setErrors(prev => ({ ...prev, patient_id: '' }));
              }}
              placeholder="搜索院友姓名或床號..."
              showResidencyFilter={true}
              defaultResidencyStatus="在住"
              className={!!patientId ? 'pointer-events-none opacity-60' : ''}
            />
            {errors.patient_id && (
              <p className="mt-1 text-sm text-red-600">{errors.patient_id}</p>
            )}
          </div>

          {existingRecords.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">現有疫苗記錄</h3>
              <div className="space-y-2">
                {existingRecords.map((record, index) => (
                  <div key={index} className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      {new Date(record.vaccination_date).toLocaleDateString('zh-TW')}
                    </span>
                    <span className="text-gray-900 font-medium">{record.vaccine_item}</span>
                    <span className="text-gray-600">{record.vaccination_unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="form-label mb-0">
                <span className="text-red-500">*</span> 疫苗記錄項目
              </label>
              <button
                type="button"
                onClick={addVaccinationItem}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>新增項目</span>
              </button>
            </div>

            {vaccinationItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                  {vaccinationItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVaccinationItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>注射日期</span>
                    </label>
                    <input
                      type="date"
                      value={item.vaccination_date}
                      onChange={(e) => {
                        updateVaccinationItem(item.id, 'vaccination_date', e.target.value);
                        setErrors(prev => ({ ...prev, [`vaccination_date_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`vaccination_date_${index}`] ? 'border-red-500' : ''}`}
                    />
                    {errors[`vaccination_date_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`vaccination_date_${index}`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label flex items-center space-x-2">
                      <Syringe className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>疫苗項目 / 名稱</span>
                    </label>
                    <input
                      type="text"
                      value={item.vaccine_item}
                      onChange={(e) => {
                        updateVaccinationItem(item.id, 'vaccine_item', e.target.value);
                        setErrors(prev => ({ ...prev, [`vaccine_item_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`vaccine_item_${index}`] ? 'border-red-500' : ''}`}
                      placeholder="例如：流感疫苗"
                    />
                    {errors[`vaccine_item_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`vaccine_item_${index}`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>注射單位 / 醫院</span>
                    </label>
                    <input
                      type="text"
                      value={item.vaccination_unit}
                      onChange={(e) => {
                        updateVaccinationItem(item.id, 'vaccination_unit', e.target.value);
                        setErrors(prev => ({ ...prev, [`vaccination_unit_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`vaccination_unit_${index}`] ? 'border-red-500' : ''}`}
                      placeholder="例如：衛生署"
                    />
                    {errors[`vaccination_unit_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`vaccination_unit_${index}`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
              {isSubmitting ? '儲存中...' : `新增 ${vaccinationItems.length} 項記錄`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaccinationRecordModal;
