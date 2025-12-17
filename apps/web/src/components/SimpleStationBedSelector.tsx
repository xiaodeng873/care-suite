import React from 'react';
import { Building2, Bed, User, AlertTriangle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface SimpleStationBedSelectorProps {
  selectedStationId: string;
  selectedBedId: string;
  onSelectionChange: (stationId: string, bedId: string, bedNumber: string) => void;
}

const SimpleStationBedSelector: React.FC<SimpleStationBedSelectorProps> = ({
  selectedStationId,
  selectedBedId,
  onSelectionChange
}) => {
  const { stations, beds, patients } = usePatients();

  // 獲取選中站點的可用床位
  const availableBeds = beds.filter(bed => 
    bed.station_id === selectedStationId && 
    !patients.some(patient => 
      patient.bed_id === bed.id && 
      patient.在住狀態 === '在住'
    )
  );

  const handleStationChange = (stationId: string) => {
    onSelectionChange(stationId, '', '');
  };

  const handleBedChange = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    if (bed) {
      onSelectionChange(selectedStationId, bedId, bed.bed_number);
    }
  };

  return (
    <div className="space-y-3">
      {/* 站點選擇 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Building2 className="h-4 w-4 inline mr-1" />
            站點
          </label>
          <select
            value={selectedStationId}
            onChange={(e) => handleStationChange(e.target.value)}
            className="form-input"
          >
            <option value="">不指派床位</option>
            {stations.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        {/* 床位選擇 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Bed className="h-4 w-4 inline mr-1" />
            床位
          </label>
          <select
            value={selectedBedId}
            onChange={(e) => handleBedChange(e.target.value)}
            className="form-input"
            disabled={!selectedStationId}
          >
            <option value="">請選擇床位</option>
            {availableBeds.map(bed => (
              <option key={bed.id} value={bed.id}>{bed.bed_number}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 選擇摘要 */}
      {selectedStationId && selectedBedId && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              已選擇：{stations.find(s => s.id === selectedStationId)?.name} - {beds.find(b => b.id === selectedBedId)?.bed_number}
            </span>
          </div>
        </div>
      )}

      {selectedStationId && !selectedBedId && availableBeds.length === 0 && (
        <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              此站點暫無可用床位
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleStationBedSelector;