import React, { useState } from 'react';
import { X, Users, Plus, Search, User } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { getReasonBadgeClass, getReasonIcon } from '../utils/reasonColors';
import { getFormattedEnglishName } from '../utils/nameFormatter';

interface PatientSelectModalProps {
  scheduleId: number;
  onClose: () => void;
}

const PatientSelectModal: React.FC<PatientSelectModalProps> = ({ scheduleId, onClose }) => {
  const { patients, schedules, updateSchedule, serviceReasons } = usePatients();
  const [selectedPatients, setSelectedPatients] = useState<{[key: number]: any}>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentSchedule = schedules.find(s => s.排程id === scheduleId);
  const existingPatientIds = currentSchedule?.院友列表.map(p => p.院友id) || [];

  const handlePatientSelect = (patient: any) => {
    const isSelected = selectedPatients[patient.院友id];
    
    if (isSelected) {
      const { [patient.院友id]: _, ...rest } = selectedPatients;
      setSelectedPatients(rest);
    } else {
      setSelectedPatients(prev => ({
        ...prev,
        [patient.院友id]: {
          院友id: patient.院友id,
          院友: patient,
          症狀說明: '',
          備註: '',
          看診原因: []
        }
      }));
    }
  };

  const handleReasonChange = (patientId: number, reasons: string[]) => {
    setSelectedPatients(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        看診原因: reasons
      }
    }));
  };

  const handleFieldChange = (patientId: number, field: string, value: string) => {
    setSelectedPatients(prev => ({
      ...prev,
      [patientId]: {
        ...prev[patientId],
        [field]: value
      }
    }));
  };

  // Filter patients based on search term
  const filteredPatients = patients
    .filter(p => !existingPatientIds.includes(p.院友id))
    .filter(p => p.在住狀態 !== '已退住') // 隱藏已退住的院友
    .filter(patient => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        patient.中文姓氏.toLowerCase().includes(searchLower) ||
        patient.中文名字.toLowerCase().includes(searchLower) ||
        patient.床號.toLowerCase().includes(searchLower) ||
        (patient.英文姓氏?.toLowerCase().includes(searchLower) || false) ||
        (patient.英文名字?.toLowerCase().includes(searchLower) || false) ||
        (patient.英文姓名?.toLowerCase().includes(searchLower) || false) ||
        patient.身份證號碼.toLowerCase().includes(searchLower)
      );
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentSchedule) {
      const newPatients = Object.values(selectedPatients).map((patient: any, index) => ({
        ...patient,
        細項id: Math.max(...(currentSchedule.院友列表.map(p => p.細項id) || [0]), 0) + index + 1
      }));

      updateSchedule({
        ...currentSchedule,
        院友列表: [...currentSchedule.院友列表, ...newPatients]
      });
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">選擇院友</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索院友姓名、床號、英文姓名或身份證號碼..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-600 mt-2">
                找到 {filteredPatients.length} 位符合條件的院友
              </p>
            )}
          </div>

          <div className="space-y-4">
            {filteredPatients.length > 0 ? (
              filteredPatients.map(patient => (
              <div
                key={patient.院友id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedPatients[patient.院友id] ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => handlePatientSelect(patient)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                      {patient.院友相片 ? (
                        <img 
                          src={patient.院友相片} 
                          alt={patient.中文姓名} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-blue-600 font-medium">{patient.床號}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{patient.中文姓氏}{patient.中文名字}</p>
                      <p className="text-sm text-gray-600">
                        {getFormattedEnglishName(patient.英文姓氏, patient.英文名字) || patient.英文姓名}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!selectedPatients[patient.院友id]}
                    onChange={() => handlePatientSelect(patient)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {selectedPatients[patient.院友id] && (
                  <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="form-label">看診原因</label>
                      <div className="flex flex-wrap gap-2">
                        {serviceReasons.map(reason => (
                          <label 
                            key={reason.原因id} 
                            className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPatients[patient.院友id].看診原因.includes(reason.原因名稱)
                                ? getReasonBadgeClass(reason.原因名稱).replace('reason-badge ', 'border-current bg-opacity-50 ')
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPatients[patient.院友id].看診原因.includes(reason.原因名稱)}
                              onChange={(e) => {
                                const currentReasons = selectedPatients[patient.院友id].看診原因;
                                const newReasons = e.target.checked
                                  ? [...currentReasons, reason.原因名稱]
                                  : currentReasons.filter((r: string) => r !== reason.原因名稱);
                                handleReasonChange(patient.院友id, newReasons);
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium">
                              <span className="mr-1">{getReasonIcon(reason.原因名稱)}</span>
                              {reason.原因名稱}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 只有勾選申訴不適時才顯示症狀說明 */}
                    {selectedPatients[patient.院友id].看診原因.includes('申訴不適') && (
                      <div>
                        <label className="form-label">症狀說明</label>
                        <textarea
                          value={selectedPatients[patient.院友id].症狀說明}
                          onChange={(e) => handleFieldChange(patient.院友id, '症狀說明', e.target.value)}
                          className="form-input"
                          rows={2}
                          placeholder="請描述症狀..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="form-label">備註</label>
                      <textarea
                        value={selectedPatients[patient.院友id].備註}
                        onChange={(e) => handleFieldChange(patient.院友id, '備註', e.target.value)}
                        className="form-input"
                        rows={2}
                        placeholder="其他備註..."
                      />
                    </div>
                  </div>
                )}
              </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? '找不到符合條件的院友' : '所有院友都已加入此排程'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm ? '請嘗試調整搜索條件' : '沒有可新增的院友'}
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-6 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={Object.keys(selectedPatients).length === 0}
            >
              <Plus className="h-4 w-4" />
              <span>新增 {Object.keys(selectedPatients).length} 位院友</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientSelectModal;