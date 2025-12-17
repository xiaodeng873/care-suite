import React, { useState } from 'react';
import { X, StickyNote } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';

interface NoteModalProps {
  onClose: () => void;
  note?: any;
}

const NoteModal: React.FC<NoteModalProps> = ({ onClose, note }) => {
  const { patients, addPatientNote, updatePatientNote } = usePatients();

  const isEditMode = !!note;

  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const [selectedPatientId, setSelectedPatientId] = useState<string>(note?.patient_id?.toString() || '');
  const [noteDate, setNoteDate] = useState(note?.note_date || getHongKongDate());
  const [content, setContent] = useState(note?.content || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPatient = patients.find(p => p.院友id.toString() === selectedPatientId);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!noteDate) {
      newErrors.note_date = '請選擇日期';
    }

    if (!content.trim()) {
      newErrors.content = '請輸入便條內容';
    } else if (content.length > 500) {
      newErrors.content = '便條內容不得超過 500 字';
    }

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
      if (isEditMode) {
        await updatePatientNote({
          ...note,
          patient_id: selectedPatientId ? parseInt(selectedPatientId) : undefined,
          note_date: noteDate,
          content: content.trim()
        });
      } else {
        await addPatientNote({
          patient_id: selectedPatientId ? parseInt(selectedPatientId) : undefined,
          note_date: noteDate,
          content: content.trim(),
          is_completed: false
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving note:', error);
      setErrors({ submit: '儲存便條失敗，請重試' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <StickyNote className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{isEditMode ? '編輯便條' : '新增便條'}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label className="form-label">院友選擇 (選填)</label>
              <PatientAutocomplete
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                placeholder="搜索院友或留空..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
              {selectedPatient && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    已選擇: {selectedPatient.床號} - {selectedPatient.中文姓氏}{selectedPatient.中文名字}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPatientId('')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    ✕ 清除
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="form-label">指定日期 *</label>
              <input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className={`form-input ${errors.note_date ? 'border-red-500' : ''}`}
                required
              />
              {errors.note_date && (
                <p className="text-sm text-red-600 mt-1">{errors.note_date}</p>
              )}
            </div>

            <div>
              <label className="form-label">便條內容 *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={500}
                rows={6}
                placeholder="輸入便條內容..."
                className={`form-input ${errors.content ? 'border-red-500' : ''}`}
                required
              />
              <div className="flex items-center justify-between mt-1">
                {errors.content && (
                  <p className="text-sm text-red-600">{errors.content}</p>
                )}
                <p className="text-sm text-gray-500 ml-auto">
                  已輸入: {content.length} / 500 字
                </p>
              </div>
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? '儲存中...' : (isEditMode ? '更新便條' : '儲存便條')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
