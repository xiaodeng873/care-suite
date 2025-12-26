import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, X } from 'lucide-react';
import { getPatientContacts, createPatientContact, updatePatientContact, deletePatientContact, setPrimaryContact, PatientContact } from '../lib/database';

interface PatientContactsTabProps {
  patientId: number;
}

const PatientContactsTab: React.FC<PatientContactsTabProps> = ({ patientId }) => {
  const [contacts, setContacts] = useState<PatientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    聯絡人姓名: '',
    關係: '',
    聯絡電話: '',
    電郵: '',
    地址: '',
    備註: '',
  });

  useEffect(() => {
    loadContacts();
  }, [patientId]);

  const loadContacts = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.聯絡人姓名.trim()) {
      alert('請輸入聯絡人姓名');
      return;
    }

    try {
      if (editingId) {
        const contactToUpdate = contacts.find(c => c.id === editingId);
        if (contactToUpdate) {
          await updatePatientContact({
            ...contactToUpdate,
            ...formData,
          });
        }
      } else {
        await createPatientContact({
          院友id: patientId,
          ...formData,
          is_primary: contacts.length === 0, // 第一個聯絡人自動設為第一
        });
      }
      
      resetForm();
      await loadContacts();
      setShowModal(false);
    } catch (error) {
      console.error('儲存聯絡人失敗:', error);
      alert('儲存聯絡人失敗');
    }
  };

  const handleEdit = (contact: PatientContact) => {
    setEditingId(contact.id);
    setFormData({
      聯絡人姓名: contact.聯絡人姓名,
      關係: contact.關係 || '',
      聯絡電話: contact.聯絡電話 || '',
      電郵: contact.電郵 || '',
      地址: contact.地址 || '',
      備註: contact.備註 || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此聯絡人嗎？')) return;

    try {
      await deletePatientContact(id);
      await loadContacts();
    } catch (error) {
      console.error('刪除聯絡人失敗:', error);
      alert('刪除聯絡人失敗');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryContact(patientId, id);
      await loadContacts();
    } catch (error) {
      console.error('設定第一聯絡人失敗:', error);
      alert('設定第一聯絡人失敗');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      聯絡人姓名: '',
      關係: '',
      聯絡電話: '',
      電郵: '',
      地址: '',
      備註: '',
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">聯絡人列表</h3>
        <button
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
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{contact.聯絡人姓名}</h4>
                      {contact.is_primary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          第一聯絡人
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
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
                        onClick={() => handleSetPrimary(contact.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="設為第一聯絡人"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(contact)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      編輯
                    </button>
                    <button
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingId ? '編輯聯絡人' : '新增聯絡人'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="form-label">關係</label>
                  <input
                    type="text"
                    value={formData.關係}
                    onChange={(e) => setFormData({ ...formData, 關係: e.target.value })}
                    className="form-input"
                    placeholder="如：子女、配偶、親友"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">聯絡電話</label>
                  <input
                    type="tel"
                    value={formData.聯絡電話}
                    onChange={(e) => setFormData({ ...formData, 聯絡電話: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">電郵</label>
                  <input
                    type="email"
                    value={formData.電郵}
                    onChange={(e) => setFormData({ ...formData, 電郵: e.target.value })}
                    className="form-input"
                  />
                </div>
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

              <div>
                <label className="form-label">備註</label>
                <textarea
                  value={formData.備註}
                  onChange={(e) => setFormData({ ...formData, 備註: e.target.value })}
                  className="form-input"
                  rows={2}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientContactsTab;
