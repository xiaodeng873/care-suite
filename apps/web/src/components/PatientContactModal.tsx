import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { PatientContact } from '../lib/database';
import { getPatientContacts, createPatientContact, updatePatientContact } from '../lib/database';
import PatientAutocomplete from './PatientAutocomplete';
import { usePatients } from '../context/PatientContext';

interface PatientContactModalProps {
  contact?: PatientContact | null;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: number;
}

const PatientContactModal: React.FC<PatientContactModalProps> = ({ contact, onClose, onSaved, defaultPatientId }) => {
  const { patients } = usePatients();
  const [form, setForm] = useState<Partial<PatientContact>>({
    ...contact,
    院友id: contact?.院友id ?? defaultPatientId,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      ...contact,
      院友id: contact?.院友id ?? defaultPatientId,
    });
  }, [contact, defaultPatientId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handlePatientChange = (patientId: string | number) => {
    setForm(f => ({ ...f, 院友id: typeof patientId === 'string' ? Number(patientId) : patientId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (contact && contact.id) {
        // 只傳送可更新欄位，避免PATCH 400
        const updateData: PatientContact = {
          ...contact,
          ...form,
          id: contact.id,
          is_primary: form.is_primary ?? false,
          created_at: contact.created_at,
          updated_at: contact.updated_at,
        };
        // 移除多餘屬性
        delete (updateData as any).patient;
        await updatePatientContact(updateData);
      } else {
        await createPatientContact({ ...form, is_primary: form.is_primary ?? false } as any);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
          <div
            className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {contact ? '編輯聯絡人' : '新增聯絡人'}
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="關閉">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">院友 <span className="text-red-500">*</span></label>
                  <PatientAutocomplete
                    value={form.院友id || ''}
                    onChange={handlePatientChange}
                    placeholder="搜索院友..."
                    showResidencyFilter={true}
                    defaultResidencyStatus="在住"
                  />
                </div>
                <div>
                  <label className="form-label">聯絡人姓名 <span className="text-red-500">*</span></label>
                  <input name="聯絡人姓名" className="form-input w-full" value={form.聯絡人姓名 || ''} onChange={handleChange} required />
                </div>
                <div>
                  <label className="form-label">關係</label>
                  <input name="關係" className="form-input w-full" value={form.關係 || ''} onChange={handleChange} />
                </div>
                <div>
                  <label className="form-label">聯絡電話</label>
                  <input name="聯絡電話" className="form-input w-full" value={form.聯絡電話 || ''} onChange={handleChange} />
                </div>
                <div>
                  <label className="form-label">電郵</label>
                  <input name="電郵" className="form-input w-full" value={form.電郵 || ''} onChange={handleChange} />
                </div>
                <div>
                  <label className="form-label">地址</label>
                  <input name="地址" className="form-input w-full" value={form.地址 || ''} onChange={handleChange} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">備註</label>
                  <input name="備註" className="form-input w-full" value={form.備註 || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
                <button type="button" onClick={onClose} className="btn-secondary flex-1">取消</button>
              </div>
            </form>
          </div>
        </div>
      );
};

export default PatientContactModal;
