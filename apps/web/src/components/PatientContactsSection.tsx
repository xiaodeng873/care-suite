import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, X } from 'lucide-react';
import { getPatientContacts, createPatientContact, updatePatientContact, deletePatientContact, setPrimaryContact, PatientContact } from '../lib/database';

interface PatientContactsSectionProps {
  patientId?: number;
  pendingContacts?: PatientContact[];
  onPendingContactsChange?: (contacts: PatientContact[]) => void;
}

const PatientContactsSection: React.FC<PatientContactsSectionProps> = ({
  patientId,
  pendingContacts = [],
  onPendingContactsChange,
}) => {
  const [contacts, setContacts] = useState<PatientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    聯絡人姓名: '',
    身份證號碼: '',
    關係: '',
    聯絡電話: '',
    電郵: '',
    地址: '',
    備註: '',
    is_emergency: false,
  });

  useEffect(() => {
    if (patientId) {
      loadContacts();
    } else {
      setLoading(false);
      setContacts(pendingContacts);
    }
  }, [patientId, pendingContacts]);

  const loadContacts = async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const data = await getPatientContacts(patientId);
      setContacts(data);
    } catch (error) {
      console.error('載入聯絡人失敗:', error);
      alert('載入聯絡人失敗');
    } finally {
      setLoading(false);
    }
  };

  const saveContact = async () => {
    if (!formData.聯絡人姓名.trim()) {
      alert('請輸入聯絡人姓名');
      return;
    }

    const payload = {
      ...formData,
      is_primary: formData.is_emergency,
    };

    try {
      if (patientId) {
        if (editingId) {
          const contactToUpdate = contacts.find(c => c.id === editingId);
          if (contactToUpdate) {
            await updatePatientContact({
              ...contactToUpdate,
              ...payload,
            });
          }
        } else {
          await createPatientContact({
            院友id: patientId,
            ...payload,
            is_primary: contacts.length === 0 ? true : formData.is_emergency,
          });
        }
        resetForm();
        await loadContacts();
        setShowModal(false);
      } else {
        let nextContacts: PatientContact[];
        if (editingId) {
          nextContacts = contacts.map(c =>
            c.id === editingId ? { ...c, ...payload } : c
          );
        } else {
          const newContact: PatientContact = {
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            院友id: 0,
            ...payload,
            is_primary: contacts.length === 0 ? true : formData.is_emergency,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          nextContacts = [...contacts, newContact];
        }
        setContacts(nextContacts);
        onPendingContactsChange?.(nextContacts);
        resetForm();
        setShowModal(false);
      }
    } catch (error) {
      console.error('儲存聯絡人失敗:', error);
      alert('儲存聯絡人失敗');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveContact();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      e.stopPropagation();
      saveContact();
    }
  };

  const handleEdit = (contact: PatientContact) => {
    setEditingId(contact.id);
    setFormData({
      聯絡人姓名: contact.聯絡人姓名,
      身份證號碼: contact.身份證號碼 || '',
      關係: contact.關係 || '',
      聯絡電話: contact.聯絡電話 || '',
      電郵: contact.電郵 || '',
      地址: contact.地址 || '',
      備註: contact.備註 || '',
      is_emergency: contact.is_primary || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此聯絡人嗎？')) return;

    try {
      if (patientId) {
        await deletePatientContact(id);
        await loadContacts();
      } else {
        const nextContacts = contacts.filter(c => c.id !== id);
        setContacts(nextContacts);
        onPendingContactsChange?.(nextContacts);
      }
    } catch (error) {
      console.error('刪除聯絡人失敗:', error);
      alert('刪除聯絡人失敗');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      if (patientId) {
        await setPrimaryContact(patientId, id);
        await loadContacts();
      } else {
        const nextContacts = contacts.map(c => ({
          ...c,
          is_primary: c.id === id,
        }));
        setContacts(nextContacts);
        onPendingContactsChange?.(nextContacts);
      }
    } catch (error) {
      console.error('設定緊急聯絡人失敗:', error);
      alert('設定緊急聯絡人失敗');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      聯絡人姓名: '',
      身份證號碼: '',
      關係: '',
      聯絡電話: '',
      電郵: '',
      地址: '',
      備註: '',
      is_emergency: false,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleOpenNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 新增聯絡人按鈕 */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
        <h3 className="text-lg font-medium text-gray-900">聯絡人列表</h3>
        <button
          type="button"
          onClick={handleOpenNewModal}
          className="btn-primary text-sm px-3 py-1.5 whitespace-nowrap inline-flex items-center"
        >
          <Plus className="h-3 w-3 mr-1" />
          新增聯絡人
        </button>
      </div>

      {/* 聯絡人列表 */}
      <div>
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            尚未新增聯絡人
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`border rounded-lg p-4 ${
                  contact.is_primary ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900">{contact.聯絡人姓名}</h4>
                      {contact.is_primary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          第一聯絡人
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {contact.身份證號碼 && (
                        <div>身份證號碼：{contact.身份證號碼}</div>
                      )}
                      {contact.關係 && (
                        <div className="font-medium text-gray-700">關係：{contact.關係}</div>
                      )}
                      {contact.聯絡電話 && (
                        <div>電話：{contact.聯絡電話}</div>
                      )}
                      {contact.電郵 && (
                        <div>電郵：{contact.電郵}</div>
                      )}
                      {contact.地址 && (
                        <div>地址：{contact.地址}</div>
                      )}
                      {contact.備註 && (
                        <div className="text-gray-500">備註：{contact.備註}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 ml-4">
                    {!contact.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(contact.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="設為第一聯絡人"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEdit(contact)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(contact.id)}
                      className="text-red-600 hover:text-red-800"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增/編輯聯絡人模態框 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingId ? '編輯聯絡人' : '新增聯絡人'}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4" onKeyDown={handleKeyDown}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">聯絡人姓名 *</label>
                  <input
                    type="text"
                    value={formData.聯絡人姓名}
                    onChange={(e) => setFormData({ ...formData, 聯絡人姓名: e.target.value })}
                    className="form-input"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">身份證號碼</label>
                  <input
                    type="text"
                    value={formData.身份證號碼}
                    onChange={(e) => setFormData({ ...formData, 身份證號碼: e.target.value })}
                    className="form-input"
                    placeholder="A123456(7)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">關係</label>
                  <input
                    type="text"
                    value={formData.關係}
                    onChange={(e) => setFormData({ ...formData, 關係: e.target.value })}
                    className="form-input"
                    placeholder="如：子女、配偶、親友"
                  />
                </div>
                <div>
                  <label className="form-label">聯絡電話</label>
                  <input
                    type="tel"
                    value={formData.聯絡電話}
                    onChange={(e) => setFormData({ ...formData, 聯絡電話: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">電郵</label>
                  <input
                    type="email"
                    value={formData.電郵}
                    onChange={(e) => setFormData({ ...formData, 電郵: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">地址</label>
                  <textarea
                    value={formData.地址}
                    onChange={(e) => setFormData({ ...formData, 地址: e.target.value })}
                    className="form-input"
                    rows={2}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">備註</label>
                <textarea
                  value={formData.備註}
                  onChange={(e) => setFormData({ ...formData, 備註: e.target.value })}
                  className="form-input"
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.is_emergency}
                  onChange={(e) => setFormData({ ...formData, is_emergency: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">第一聯絡人</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button type="button" onClick={saveContact} className="btn-primary flex-1">
                  {editingId ? '更新' : '新增'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientContactsSection;
