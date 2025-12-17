import React, { useState } from 'react';
import { X, Bed, User, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientTooltip from './PatientTooltip';

interface BedAssignmentModalProps {
  bed: any;
  onClose: () => void;
}

const BedAssignmentModal: React.FC<BedAssignmentModalProps> = ({ bed, onClose }) => {
  const { patients, stations, assignPatientToBed } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const station = stations.find(s => s.id === bed.station_id);

  // 篩選可指派的院友（沒有床位或在住狀態為在住的院友）
  const availablePatients = patients.filter(patient => {
    // 顯示在住和待入住的院友，排除已退住的院友
    if (patient.在住狀態 === '已退住') {
      return false;
    }
    
    // 搜索條件
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        patient.中文姓氏.toLowerCase().includes(searchLower) ||
        patient.中文名字.toLowerCase().includes(searchLower) ||
        patient.床號.toLowerCase().includes(searchLower) ||
        patient.身份證號碼.toLowerCase().includes(searchLower) ||
        (patient.英文姓氏?.toLowerCase().includes(searchLower) || false) ||
        (patient.英文名字?.toLowerCase().includes(searchLower) || false) ||
        (patient.英文姓名?.toLowerCase().includes(searchLower) || false)
      );
      
      // 只返回符合搜索條件且狀態為在住或待入住的院友
      return matchesSearch && (patient.在住狀態 === '在住' || patient.在住狀態 === '待入住');
    }
    
    // 沒有搜索條件時，顯示所有在住和待入住的院友
    return patient.在住狀態 === '在住' || patient.在住狀態 === '待入住';
  });

  const handleAssign = async () => {
    if (!selectedPatient) {
      alert('請選擇要指派的院友');
      return;
    }

    try {
      await assignPatientToBed(selectedPatient.院友id, bed.id);
      onClose();
    } catch (error) {
      console.error('指派院友到床位失敗:', error);
      alert(error instanceof Error ? error.message : '指派失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Bed className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">指派院友到床位</h2>
                <p className="text-sm text-gray-600">
                  {station?.name} - {bed.bed_number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 搜索欄 */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索院友中文姓名、英文姓名、床號或身份證號碼..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
              <p className="text-sm text-gray-600 mt-2">
                {searchTerm ? 
                  `找到 ${availablePatients.length} 位符合條件的院友` : 
                  `顯示 ${availablePatients.length} 位可指派的院友`
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  清除搜索
                </button>
              )}
            </div>
          </div>

          {/* 院友列表 */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availablePatients.length > 0 ? (
              availablePatients.map(patient => (
                <div
                  key={patient.院友id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPatient?.院友id === patient.院友id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                        {patient.院友相片 ? (
                          <img 
                            src={patient.院友相片} 
                            alt={patient.中文姓名} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <PatientTooltip patient={patient}>
                          <p className="font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">
                            {patient.中文姓氏}{patient.中文名字}
                          </p>
                        </PatientTooltip>
                        <p className="text-sm text-gray-600">
                          目前床號: {patient.床號 || '未指派'} | {patient.性別} | {patient.護理等級 || '未設定'} | {patient.在住狀態}
                        </p>
                        <p className="text-xs text-gray-500">
                          身份證: {patient.身份證號碼}
                        </p>
                        {(patient.英文姓氏 || patient.英文名字 || patient.英文姓名) && (
                          <p className="text-xs text-gray-500">
                            英文: {patient.英文姓氏&& patient.英文名字 ? 
                              `${patient.英文姓氏.toUpperCase()}, ${patient.英文名字}` : 
                              patient.英文姓名 || ''}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      {patient.bed_id && patient.在住狀態 === '在住' && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full mr-2">
                          需要遷移
                        </span>
                      )}
                      {patient.在住狀態 === '待入住' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                          待入住
                        </span>
                      )}
                      <input
                        type="radio"
                        checked={selectedPatient?.院友id === patient.院友id}
                        onChange={() => setSelectedPatient(patient)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                    </div>
                  </div>
                  
                  {patient.bed_id && patient.在住狀態 === '在住' && selectedPatient?.院友id === patient.院友id && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>注意：</strong>此院友目前已有床位「{patient.床號}」，
                        指派到新床位後將自動釋放原床位。
                      </p>
                    </div>
                  )}
                  
                  {patient.在住狀態 === '待入住' && selectedPatient?.院友id === patient.院友id && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>提示：</strong>此院友目前為待入住狀態，指派床位後將自動更新為在住狀態。
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? '找不到符合條件的院友' : '暫無可指派的院友'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm ? '請嘗試調整搜索條件或清除搜索' : '所有在住和待入住的院友都已有床位指派'}
                </p>
              </div>
            )}
          </div>

          {/* 確認按鈕 */}
          <div className="flex space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={handleAssign}
              disabled={!selectedPatient}
              className="btn-primary flex-1"
            >
              確認指派
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BedAssignmentModal;