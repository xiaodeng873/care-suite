import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter,
  Users,
  Bed,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import StationModal from '../components/StationModal';

const StationManagement: React.FC = () => {
  const { 
    stations, 
    beds, 
    patients, 
    loading, 
    deleteStation 
  } = usePatients();
  
  const [showStationModal, setShowStationModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 獲取每個站的統計資訊
  const getStationStats = (stationId: string) => {
    const stationBeds = beds.filter(bed => bed.station_id === stationId);
    const occupiedBeds = stationBeds.filter(bed => bed.is_occupied);
    const stationPatients = patients.filter(p => p.station_id === stationId && p.在住狀態 === '在住');
    
    return {
      totalBeds: stationBeds.length,
      occupiedBeds: occupiedBeds.length,
      availableBeds: stationBeds.length - occupiedBeds.length,
      totalPatients: stationPatients.length,
      occupancyRate: stationBeds.length > 0 ? (occupiedBeds.length / stationBeds.length * 100).toFixed(1) : '0'
    };
  };

  // 獲取床位上的院友
  const getPatientInBed = (bedId: string) => {
    return patients.find(patient => patient.bed_id === bedId && patient.在住狀態 === '在住');
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

  const handleEditStation = (station: any) => {
    setSelectedStation(station);
    setShowStationModal(true);
  };

  const handleDeleteStation = async (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    const stationBeds = beds.filter(bed => bed.station_id === stationId);
    const occupiedBeds = stationBeds.filter(bed => bed.is_occupied);
    
    if (occupiedBeds.length > 0) {
      const occupiedBedsList = occupiedBeds.map(bed => {
        const patient = getPatientInBed(bed.id);
        return `${bed.bed_number}(${patient?.中文姓名 || '未知院友'})`;
      }).join('、');
      alert(`無法刪除站點「${station?.name}」，因為以下床位仍有院友：\n\n${occupiedBedsList}\n\n請先將所有院友遷移到其他床位。`);
      return;
    }
    
    if (stationBeds.length > 0) {
      const emptyBedsList = stationBeds.map(bed => bed.bed_number).join('、');
      alert(`無法刪除站點「${station?.name}」，因為該站點下還有以下床位：\n\n${emptyBedsList}\n\n請先將所有床位遷移到其他站點或刪除這些床位。`);
      return;
    }
    
    if (confirm(`確定要刪除站點「${station?.name}」嗎？\n\n此操作無法復原。`)) {
      try {
        await deleteStation(stationId);
      } catch (error) {
        alert('刪除站點失敗，請重試');
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
  };

  const hasActiveFilters = () => {
    return searchTerm;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">站點管理</h1>
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

      {/* 搜索 */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索站點名稱或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              className="btn-secondary flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>清除</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <span>顯示 {filteredStations.length} / {stations.length} 個站點</span>
          {hasActiveFilters() && (
            <span className="text-blue-600">已套用篩選條件</span>
          )}
        </div>
      </div>

      {/* 站點列表 */}
      <div className="space-y-4">
        {filteredStations.length > 0 ? (
          filteredStations.map(station => {
            const stats = getStationStats(station.id);
            const stationBeds = beds.filter(bed => bed.station_id === station.id);
            
            return (
              <div key={station.id} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-lg bg-blue-100">
                      <Building2 className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{station.name}</h3>
                      {station.description && (
                        <p className="text-sm text-gray-600 mt-1">{station.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-sm text-gray-500">
                          建立時間：{new Date(station.created_at).toLocaleDateString('zh-TW')}
                        </span>
                        <span className="text-sm text-gray-500">
                          最後更新：{new Date(station.updated_at).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditStation(station)}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>編輯</span>
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id)}
                      className="btn-danger flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>刪除</span>
                    </button>
                  </div>
                </div>

                {/* 站點統計 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Bed className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalBeds}</div>
                    <div className="text-sm text-gray-600">總床位</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.occupiedBeds}</div>
                    <div className="text-sm text-gray-600">已佔用</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="h-5 w-5 rounded-full border-2 border-gray-400" />
                    </div>
                    <div className="text-2xl font-bold text-gray-600">{stats.availableBeds}</div>
                    <div className="text-sm text-gray-600">可用床位</div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{stats.totalPatients}</div>
                    <div className="text-sm text-gray-600">院友數</div>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="h-5 w-5 rounded-full bg-orange-600" />
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{stats.occupancyRate}%</div>
                    <div className="text-sm text-gray-600">佔用率</div>
                  </div>
                </div>

                {/* 床位預覽 */}
                {stationBeds.length > 0 ? (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">床位一覽 ({stationBeds.length})</h4>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {stationBeds.slice(0, 24).map(bed => {
                        const patient = getPatientInBed(bed.id);
                        return (
                          <div
                            key={bed.id}
                            className={`p-2 rounded border text-center text-xs ${
                              bed.is_occupied
                                ? 'bg-green-100 border-green-300 text-green-800'
                                : 'bg-gray-100 border-gray-300 text-gray-600'
                            }`}
                            title={patient ? `${bed.bed_number} - ${patient.中文姓名}` : `${bed.bed_number} - 空置`}
                          >
                            <div className="font-medium">{bed.bed_number}</div>
                            {patient && (
                              <div className="truncate">{patient.中文姓氏}{patient.中文名字}</div>
                            )}
                          </div>
                        );
                      })}
                      {stationBeds.length > 24 && (
                        <div className="p-2 rounded border border-gray-300 bg-gray-50 text-center text-xs text-gray-500 flex items-center justify-center">
                          +{stationBeds.length - 24}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bed className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">此站點暫無床位</h3>
                    <p className="text-gray-600">請前往「床位管理」頁面為此站點新增床位</p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? '找不到符合條件的站點' : '暫無站點'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? '請嘗試調整搜索條件' : '開始建立您的第一個站點'}
            </p>
            {!searchTerm ? (
              <button
                onClick={() => setShowStationModal(true)}
                className="btn-primary"
              >
                新增站點
              </button>
            ) : (
              <button
                onClick={clearFilters}
                className="btn-secondary"
              >
                清除搜索條件
              </button>
            )}
          </div>
        )}
      </div>

      {showStationModal && (
        <StationModal
          station={selectedStation}
          onClose={() => {
            setShowStationModal(false);
            setSelectedStation(null);
          }}
        />
      )}
    </div>
  );
};

export default StationManagement;