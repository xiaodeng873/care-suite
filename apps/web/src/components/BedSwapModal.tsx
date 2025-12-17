import React, { useState } from 'react';
import { X, ArrowRightLeft, User, Bed, Search } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientTooltip from './PatientTooltip';

interface BedSwapModalProps {
  onClose: () => void;
}

const BedSwapModal: React.FC<BedSwapModalProps> = ({ onClose }) => {
  const { patients, stations, beds, swapPatientBeds } = usePatients();
  const [selectedPatient1, setSelectedPatient1] = useState<any>(null);
  const [selectedPatient2, setSelectedPatient2] = useState<any>(null);
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');

  // 只顯示有床位的在住院友
  const patientsWithBeds = patients.filter(patient => 
    patient.bed_id && patient.在住狀態 === '在住'
  );

  const filteredPatients1 = patientsWithBeds.filter(patient => {
    if (!searchTerm1) return true;
    const searchLower = searchTerm1.toLowerCase();
    return (
      patient.中文姓氏.toLowerCase().includes(searchLower) ||
      patient.中文名字.toLowerCase().includes(searchLower) ||
      patient.床號.toLowerCase().includes(searchLower) ||
      patient.身份證號碼.toLowerCase().includes(searchLower)
    );
  });

  const filteredPatients2 = patientsWithBeds.filter(patient => {
    // 排除已選擇的第一位院友
    if (selectedPatient1 && patient.院友id === selectedPatient1.院友id) {
      return false;
    }
    
    if (!searchTerm2) return true;
    const searchLower = searchTerm2.toLowerCase();
    return (
      patient.中文姓氏.toLowerCase().includes(searchLower) ||
      patient.中文名字.toLowerCase().includes(searchLower) ||
      patient.床號.toLowerCase().includes(searchLower) ||
      patient.身份證號碼.toLowerCase().includes(searchLower)
    );
  });

  const getPatientBedInfo = (patient: any) => {
    const bed = beds.find(b => b.id === patient.bed_id);
    const station = stations.find(s => s.id === patient.station_id);
    return {
      bed,
      station
    };
  };

  const handleSwap = async () => {
    if (!selectedPatient1 || !selectedPatient2) {
      alert('請選擇兩位要互換床位的院友');
      return;
    }

    const patient1BedInfo = getPatientBedInfo(selectedPatient1);
    const patient2BedInfo = getPatientBedInfo(selectedPatient2);

    const confirmMessage = `確定要互換以下兩位院友的床位嗎？\n\n` +
      `${selectedPatient1.中文姓名} (${patient1BedInfo.station?.name} - ${patient1BedInfo.bed?.bed_number})\n` +
      `↕\n` +
      `${selectedPatient2.中文姓名} (${patient2BedInfo.station?.name} - ${patient2BedInfo.bed?.bed_number})`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await swapPatientBeds(selectedPatient1.院友id, selectedPatient2.院友id);
      alert('床位互換成功！');
      onClose();
    } catch (error) {
      console.error('床位互換失敗:', error);
      alert(error instanceof Error ? error.message : '床位互換失敗，請重試');
    }
  };

  const PatientCard: React.FC<{ 
    patient: any; 
    isSelected: boolean; 
    onSelect: (patient: any) => void;
    title: string;
  }> = ({ patient, isSelected, onSelect, title }) => {
    const bedInfo = getPatientBedInfo(patient);
    
    return (
      <div
        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => onSelect(patient)}
      >
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
          <div className="flex-1">
            <PatientTooltip patient={patient}>
              <p className="font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">
                {patient.中文姓氏}{patient.中文名字}
              </p>
            </PatientTooltip>
            <p className="text-sm text-gray-600">
              {patient.性別} | {patient.護理等級 || '未設定'}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <Bed className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {bedInfo.station?.name} - {bedInfo.bed?.bed_number}
              </span>
            </div>
          </div>
          <input
            type="radio"
            checked={isSelected}
            onChange={() => onSelect(patient)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <ArrowRightLeft className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">床位互換</h2>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 第一位院友選擇 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">選擇第一位院友</h3>
              
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索院友..."
                    value={searchTerm1}
                    onChange={(e) => setSearchTerm1(e.target.value)}
                    className="form-input pl-10 w-full"
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredPatients1.map(patient => (
                  <PatientCard
                    key={patient.院友id}
                    patient={patient}
                    isSelected={selectedPatient1?.院友id === patient.院友id}
                    onSelect={setSelectedPatient1}
                    title="第一位院友"
                  />
                ))}
                
                {filteredPatients1.length === 0 && (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">
                      {searchTerm1 ? '找不到符合條件的院友' : '暫無可選擇的院友'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 第二位院友選擇 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">選擇第二位院友</h3>
              
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索院友..."
                    value={searchTerm2}
                    onChange={(e) => setSearchTerm2(e.target.value)}
                    className="form-input pl-10 w-full"
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredPatients2.map(patient => (
                  <PatientCard
                    key={patient.院友id}
                    patient={patient}
                    isSelected={selectedPatient2?.院友id === patient.院友id}
                    onSelect={setSelectedPatient2}
                    title="第二位院友"
                  />
                ))}
                
                {filteredPatients2.length === 0 && (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">
                      {searchTerm2 ? '找不到符合條件的院友' : 
                       selectedPatient1 ? '請選擇另一位院友' : '請先選擇第一位院友'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 互換預覽 */}
          {selectedPatient1 && selectedPatient2 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-3">床位互換預覽</h4>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <div className="font-medium text-gray-900">{selectedPatient1.中文姓名}</div>
                  <div className="text-sm text-gray-600">
                    {getPatientBedInfo(selectedPatient1).station?.name} - {getPatientBedInfo(selectedPatient1).bed?.bed_number}
                  </div>
                </div>
                
                <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                
                <div className="text-center">
                  <div className="font-medium text-gray-900">{selectedPatient2.中文姓名}</div>
                  <div className="text-sm text-gray-600">
                    {getPatientBedInfo(selectedPatient2).station?.name} - {getPatientBedInfo(selectedPatient2).bed?.bed_number}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 確認按鈕 */}
          <div className="flex space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={handleSwap}
              disabled={!selectedPatient1 || !selectedPatient2}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>確認互換床位</span>
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

export default BedSwapModal;