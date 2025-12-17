import React, { useState } from 'react';
import { X, FileText, Calendar, Building2, Plus, Trash2 } from 'lucide-react';
import { usePatients, type DiagnosisRecord } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import OCRDocumentBlock from './OCRDocumentBlock';

interface DiagnosisRecordModalProps {
  patientId?: number;
  existingRecords?: DiagnosisRecord[];
  prefilledData?: any;
  onClose: () => void;
}

interface DiagnosisItem {
  id: string;
  diagnosis_date: string;
  diagnosis_item: string;
  diagnosis_unit: string;
}

const DiagnosisRecordModal: React.FC<DiagnosisRecordModalProps> = ({
  patientId,
  existingRecords = [],
  prefilledData,
  onClose
}) => {
  const { patients, addDiagnosisRecord } = usePatients();

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>(
    prefilledData?.patient_id || patientId
  );
  const [diagnosisItems, setDiagnosisItems] = useState<DiagnosisItem[]>([
    {
      id: Date.now().toString(),
      diagnosis_date: prefilledData?.diagnosis_date || getHongKongDate(),
      diagnosis_item: prefilledData?.diagnosis_item || '',
      diagnosis_unit: prefilledData?.diagnosis_unit || ''
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
        diagnosis_date: record.diagnosis_date || getHongKongDate(),
        diagnosis_item: record.diagnosis_item || '',
        diagnosis_unit: record.diagnosis_unit || ''
      }));
      setDiagnosisItems(newItems);
    } else {
      setDiagnosisItems([{
        id: Date.now().toString(),
        diagnosis_date: extractedData.diagnosis_date || getHongKongDate(),
        diagnosis_item: extractedData.diagnosis_item || '',
        diagnosis_unit: extractedData.diagnosis_unit || ''
      }]);
    }
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  const addDiagnosisItem = () => {
    setDiagnosisItems([
      ...diagnosisItems,
      {
        id: Date.now().toString(),
        diagnosis_date: getHongKongDate(),
        diagnosis_item: '',
        diagnosis_unit: ''
      }
    ]);
  };

  const removeDiagnosisItem = (id: string) => {
    if (diagnosisItems.length > 1) {
      setDiagnosisItems(diagnosisItems.filter(item => item.id !== id));
    }
  };

  const updateDiagnosisItem = (id: string, field: keyof DiagnosisItem, value: string) => {
    setDiagnosisItems(diagnosisItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedPatientId) {
      newErrors.patient_id = '請選擇院友';
    }

    diagnosisItems.forEach((item, index) => {
      if (!item.diagnosis_date) {
        newErrors[`diagnosis_date_${index}`] = '請選擇診斷日期';
      }
      if (!item.diagnosis_item.trim()) {
        newErrors[`diagnosis_item_${index}`] = '請輸入診斷項目';
      }
      if (!item.diagnosis_unit.trim()) {
        newErrors[`diagnosis_unit_${index}`] = '請輸入診斷單位';
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
      for (const item of diagnosisItems) {
        const recordData = {
          patient_id: selectedPatientId!,
          diagnosis_date: item.diagnosis_date,
          diagnosis_item: item.diagnosis_item.trim(),
          diagnosis_unit: item.diagnosis_unit.trim(),
          remarks: ''
        };

        await addDiagnosisRecord(recordData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving diagnosis records:', error);
      alert('儲存診斷記錄失敗，請重試');
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">診斷記錄</h2>
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
            documentType="diagnosis"
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
              <h3 className="text-sm font-medium text-gray-900 mb-3">現有診斷記錄</h3>
              <div className="space-y-2">
                {existingRecords.map((record, index) => (
                  <div key={index} className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      {new Date(record.diagnosis_date).toLocaleDateString('zh-TW')}
                    </span>
                    <span className="text-gray-900 font-medium">{record.diagnosis_item}</span>
                    <span className="text-gray-600">{record.diagnosis_unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="form-label mb-0">
                <span className="text-red-500">*</span> 診斷記錄項目
              </label>
              <button
                type="button"
                onClick={addDiagnosisItem}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>新增項目</span>
              </button>
            </div>

            {diagnosisItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">項目 {index + 1}</span>
                  {diagnosisItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDiagnosisItem(item.id)}
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
                      <span>診斷日期</span>
                    </label>
                    <input
                      type="date"
                      value={item.diagnosis_date}
                      onChange={(e) => {
                        updateDiagnosisItem(item.id, 'diagnosis_date', e.target.value);
                        setErrors(prev => ({ ...prev, [`diagnosis_date_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`diagnosis_date_${index}`] ? 'border-red-500' : ''}`}
                    />
                    {errors[`diagnosis_date_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`diagnosis_date_${index}`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>診斷項目 / 病名</span>
                    </label>
                    <input
                      type="text"
                      value={item.diagnosis_item}
                      onChange={(e) => {
                        updateDiagnosisItem(item.id, 'diagnosis_item', e.target.value);
                        setErrors(prev => ({ ...prev, [`diagnosis_item_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`diagnosis_item_${index}`] ? 'border-red-500' : ''}`}
                      placeholder="例如：高血壓、糖尿病"
                    />
                    {errors[`diagnosis_item_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`diagnosis_item_${index}`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-red-500">*</span>
                      <span>診斷單位 / 醫院</span>
                    </label>
                    <input
                      type="text"
                      value={item.diagnosis_unit}
                      onChange={(e) => {
                        updateDiagnosisItem(item.id, 'diagnosis_unit', e.target.value);
                        setErrors(prev => ({ ...prev, [`diagnosis_unit_${index}`]: '' }));
                      }}
                      className={`form-input ${errors[`diagnosis_unit_${index}`] ? 'border-red-500' : ''}`}
                      placeholder="例如：瑪麗醫院"
                    />
                    {errors[`diagnosis_unit_${index}`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`diagnosis_unit_${index}`]}</p>
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
              {isSubmitting ? '儲存中...' : `新增 ${diagnosisItems.length} 項記錄`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiagnosisRecordModal;
