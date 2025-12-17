import React, { useState } from 'react';
import { X, Building2, Bed, Plus, Edit3, Trash2, Search, User } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import StationModal from './StationModal';
import BedModal from './BedModal';

interface StationManagementModalProps {
  onClose: () => void;
}

const StationManagementModal: React.FC<StationManagementModalProps> = ({ onClose }) => {
  const { stations, beds, patients, deleteStation, deleteBed } = usePatients();
  const [showStationModal, setShowStationModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'stations' | 'beds'>('stations');

  // 獲取床位上的院友
  const getPatientInBed = (bedId: string) => {
    return patients.find(patient => patient.bed_id === bedId && patient.在住狀態 === '在住');
  };

  // 獲取站點統計資訊
  const getStationStats = (stationId: string) => {
    const stationBeds = beds.filter(bed => bed.station_id === stationId);
    
    let occupiedCount = 0;
    let availableCount = 0;
    
    stationBeds.forEach(bed => {
      // 檢查此床位是否有在住院友
      const hasResidentPatient = patients.some(patient => 
        patient.bed_id === bed.id && patient.在住狀態 === '在住'
      );
      
      if (hasResidentPatient) {
        occupiedCount++;
      } else {
        availableCount++;
      }
    });
    
    return {
      totalBeds: stationBeds.length,
      occupiedBeds: occupiedCount,
      availableBeds: availableCount,
      occupancyRate: stationBeds.length > 0 ? (occupiedCount / stationBeds.length * 100).toFixed(1) : '0'
    };
  };

  // 篩選站點
  const filteredStations = stations.filter(station => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      station.name.toLowerCase().includes(searchLower) ||
      station.description?.toLowerCase().includes(searchLower)
    );
  });

  // 篩選床位
  const filteredBeds = beds.filter(bed => {
    if (!searchTerm) return true;
    const station = stations.find(s => s.id === bed.station_id);
    const patient = getPatientInBed(bed.id);
    
    const searchLower = searchTerm.toLowerCase();
    return (
      bed.bed_number.toLowerCase().includes(searchLower) ||
      bed.bed_name?.toLowerCase().includes(searchLower) ||
      station?.name.toLowerCase().includes(searchLower) ||
      patient?.中文姓氏.toLowerCase().includes(searchLower) ||
      patient?.中文名字.toLowerCase().includes(searchLower)
    );
  });

  const handleEditStation = (station: any) => {
    setSelectedStation(station);
    setShowStationModal(true);
  };

  const handleDeleteStation = async (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    const stats = getStationStats(stationId);
    
    if (stats.occupiedBeds > 0) {
      const occupiedBeds = beds.filter(bed => bed.station_id === stationId && getPatientInBed(bed.id));
      const occupiedBedsList = occupiedBeds.map(bed => {
        const patient = getPatientInBed(bed.id);
        return `${bed.bed_number}(${patient?.中文姓名 || '未知院友'})`;
      }).join('、');
      alert(`無法刪除站點「${station?.name}」，因為以下床位仍有院友：\n\n${occupiedBedsList}\n\n請先將所有院友遷移到其他床位。`);
      return;
    }
    
    if (stats.totalBeds > 0) {
      const allBeds = beds.filter(bed => bed.station_id === stationId);
      const bedsList = allBeds.map(bed => bed.bed_number).join('、');
      alert(`無法刪除站點「${station?.name}」，因為該站點下還有以下床位：\n\n${bedsList}\n\n請先將所有床位遷移到其他站點或刪除這些床位。`);
      return;
    }
    
    if (confirm(`確定要刪除站點「${station?.name}」嗎？`)) {
      try {
        await deleteStation(stationId);
      } catch (error) {
        alert('刪除站點失敗，請重試');
      }
    }
  };

  const handleEditBed = (bed: any) => {
    setSelectedBed(bed);
    setShowBedModal(true);
  };

  const handleDeleteBed = async (bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    const patient = getPatientInBed(bedId);
    
    if (patient) {
      alert(`無法刪除床位「${bed?.bed_number}」，因為該床位上有院友「${patient.中文姓名}」。請先將院友遷移到其他床位。`);
      return;
    }
    
    if (confirm(`確定要刪除床位「${bed?.bed_number}」嗎？`)) {
      try {
        await deleteBed(bedId);
      } catch (error) {
        alert('刪除床位失敗，請重試');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">站點管理</h2>
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
          {/* 標籤切換 */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('stations')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'stations'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="h-4 w-4 inline mr-2" />
              站點管理
            </button>
            <button
              onClick={() => setActiveTab('beds')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'beds'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bed className="h-4 w-4 inline mr-2" />
              床位管理
            </button>
          </div>

          {/* 搜索欄 */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'stations' ? "搜索站點名稱或描述..." : "搜索床位號碼、床位名稱、站點名稱或院友姓名..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
          </div>

          {/* 站點管理標籤 */}
          {activeTab === 'stations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">站點列表</h3>
                <button
                  onClick={() => {
                    setSelectedStation(null);
                    setShowStationModal(true);
                  }}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增站點</span>
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredStations.length > 0 ? (
                  filteredStations.map(station => {
                    const stats = getStationStats(station.id);
                    
                    return (
                      <div key={station.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{station.name}</h4>
                              {station.description && (
                                <p className="text-sm text-gray-600">{station.description}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-xs text-gray-500">
                                  床位：{stats.totalBeds} ({stats.occupiedBeds} 已佔用, {stats.availableBeds} 可用)
                                </span>
                                <span className="text-xs text-gray-500">
                                  建立：{new Date(station.created_at).toLocaleDateString('zh-TW')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditStation(station)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50"
                              title="編輯站點"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStation(station.id)}
                              className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                              title="刪除站點"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">
                      {searchTerm ? '找不到符合條件的站點' : '暫無站點'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 床位管理標籤 */}
          {activeTab === 'beds' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">床位列表</h3>
                <button
                  onClick={() => {
                    setSelectedBed(null);
                    setShowBedModal(true);
                  }}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增床位</span>
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredBeds.length > 0 ? (
                  filteredBeds.map(bed => {
                    const station = stations.find(s => s.id === bed.station_id);
                    const patient = getPatientInBed(bed.id);
                    
                    return (
                      <div key={bed.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${bed.is_occupied ? 'bg-green-100' : 'bg-blue-100'}`}>
                              <Bed className={`h-5 w-5 ${bed.is_occupied ? 'text-green-600' : 'text-blue-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium text-gray-900">{bed.bed_number}</h4>
                                <span className="text-sm text-gray-500">({station?.name})</span>
                              </div>
                              {bed.bed_name && bed.bed_name !== bed.bed_number && (
                                <p className="text-sm text-gray-600">{bed.bed_name}</p>
                              )}
                              {patient ? (
                                <div className="flex items-center space-x-2 mt-1">
                                  <div className="w-6 h-6 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                                    {patient.院友相片 ? (
                                      <img 
                                        src={patient.院友相片} 
                                        alt={patient.中文姓名} 
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User className="h-3 w-3 text-blue-600" />
                                    )}
                                  </div>
                                  <span className="text-sm text-green-600 font-medium">
                                    {patient.中文姓氏}{patient.中文名字}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-blue-600">空置</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditBed(bed)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50"
                              title="編輯床位"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBed(bed.id)}
                              className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                              title="刪除床位"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Bed className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">
                      {searchTerm ? '找不到符合條件的床位' : '暫無床位'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 子模態框 */}
        {showStationModal && (
          <StationModal
            station={selectedStation}
            onClose={() => {
              setShowStationModal(false);
              setSelectedStation(null);
            }}
          />
        )}

        {showBedModal && (
          <BedModal
            bed={selectedBed}
            onClose={() => {
              setShowBedModal(false);
              setSelectedBed(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default StationManagementModal;