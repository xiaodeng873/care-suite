import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bed,
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Users,
  User,
  ArrowRightLeft,
  MoveRight,
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  Download,
  QrCode
} from 'lucide-react';
import * as QRCode from 'qrcode';
import { usePatients } from '../context/PatientContext';
import StationModal from '../components/StationModal';
import BedModal from '../components/BedModal';
import BedAssignmentModal from '../components/BedAssignmentModal';
import BedSwapModal from '../components/BedSwapModal';
import PatientTooltip from '../components/PatientTooltip';
import StationManagementModal from '../components/StationManagementModal';
import { exportBedLayoutToExcel } from '../utils/bedLayoutExcelGenerator';

const StationBedManagement: React.FC = () => {
  const { 
    stations, 
    beds, 
    patients, 
    loading, 
    deleteStation, 
    deleteBed,
    moveBedToStation 
  } = usePatients();
  
  const [showStationModal, setShowStationModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showStationManagementModal, setShowStationManagementModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState('all');
  const [selectedStationsForExport, setSelectedStationsForExport] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Map<string, string>>(new Map());

  // 生成床位 QR Code（縮圖）
  useEffect(() => {
    const generateQRCodes = async () => {
      const newQrCodes = new Map<string, string>();

      for (const bed of beds) {
        const qrData = {
          type: 'bed',
          qr_code_id: bed.qr_code_id,
          bed_number: bed.bed_number
        };

        try {
          const dataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
            width: 80,
            margin: 1
          });
          newQrCodes.set(bed.id, dataUrl);
        } catch (error) {
          console.error(`生成床位 ${bed.bed_number} QR Code 失敗:`, error);
        }
      }

      setQrCodeDataUrls(newQrCodes);
    };

    if (beds.length > 0) {
      generateQRCodes();
    }
  }, [beds]);

  // 下載床位 QR Code
  const downloadBedQRCode = async (bed: any) => {
    const qrData = {
      type: 'bed',
      qr_code_id: bed.qr_code_id,
      bed_number: bed.bed_number
    };

    try {
      // 生成大尺寸 QR Code（3cm x 3cm @ 300 DPI = 354px）
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 354,
        margin: 2
      });

      // 創建 canvas 繪製床位編號和 QR Code
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 450;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // 繪製白色背景
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 繪製床位編號文字
      ctx.fillStyle = 'black';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`床位: ${bed.bed_number}`, canvas.width / 2, 40);

      // 載入並繪製 QR Code
      const qrImage = new Image();
      qrImage.onload = () => {
        ctx.drawImage(qrImage, (canvas.width - 354) / 2, 60, 354, 354);

        // 轉換為 Blob 並下載
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `床位QR_${bed.bed_number}.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      };
      qrImage.src = qrDataUrl;
    } catch (error) {
      console.error('下載 QR Code 失敗:', error);
      alert('下載失敗，請重試');
    }
  };

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
    
    // 計算實際佔用的床位數量 - 只計算有在住院友的床位
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
    
    // 驗證計算正確性
    console.log(`站點 ${stationId} 床位統計:`, {
      totalBeds: stationBeds.length,
      occupiedCount,
      availableCount,
      sum: occupiedCount + availableCount
    });
    
    return {
      totalBeds: stationBeds.length,
      occupiedBeds: occupiedCount,
      availableBeds: availableCount,
      occupancyRate: stationBeds.length > 0 ? (occupiedCount / stationBeds.length * 100).toFixed(1) : '0'
    };
  };

  // 獲取床位上的院友
  const getPatientInBed = (bedId: string) => {
    return patients.find(patient => 
      patient.bed_id === bedId && patient.在住狀態 === '在住'
    );
  };

  // 篩選床位
  const filteredBeds = beds.filter(bed => {
    // 站點篩選
    if (selectedStationFilter && bed.station_id !== selectedStationFilter) {
      return false;
    }
    
    // 佔用狀態篩選
    const patient = getPatientInBed(bed.id);
    if (occupancyFilter === 'occupied' && !patient) {
      return false;
    }
    if (occupancyFilter === 'available' && patient) {
      return false;
    }
    
    // 搜索條件
    if (searchTerm) {
      const station = stations.find(s => s.id === bed.station_id);
      
      const searchLower = searchTerm.toLowerCase();
      return (
        bed.bed_number.toLowerCase().includes(searchLower) ||
        bed.bed_name?.toLowerCase().includes(searchLower) ||
        station?.name.toLowerCase().includes(searchLower) ||
        patient?.中文姓氏.toLowerCase().includes(searchLower) ||
        patient?.中文名字.toLowerCase().includes(searchLower) ||
        patient?.床號.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
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
      alert(`無法刪除站點「${station?.name}」，因為以下床位仍有院友：\n\n${occupiedBedsList}\n\n請先將所有院友遷移到其他床位，然後刪除或遷移所有床位。`);
      return;
    }
    
    if (stationBeds.length > 0) {
      const emptyBedsList = stationBeds.map(bed => bed.bed_number).join('、');
      alert(`無法刪除站點「${station?.name}」，因為該站點下還有以下空置床位：\n\n${emptyBedsList}\n\n請先刪除或遷移所有床位到其他站點。`);
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

  const handleAssignBed = (bed: any) => {
    const patient = getPatientInBed(bed.id);
    if (patient) {
      alert(`此床位已被院友「${patient.中文姓名}」佔用`);
      return;
    }
    setSelectedBed(bed);
    setShowAssignmentModal(true);
  };

  const handleMoveBed = async (bedId: string, newStationId: string) => {
    const bed = beds.find(b => b.id === bedId);
    const newStation = stations.find(s => s.id === newStationId);
    
    if (confirm(`確定要將床位「${bed?.bed_number}」遷移到「${newStation?.name}」嗎？`)) {
      try {
        await moveBedToStation(bedId, newStationId);
      } catch (error) {
        alert('床位遷移失敗，請重試');
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStationFilter('');
    setOccupancyFilter('all');
  };

  const hasActiveFilters = () => {
    return searchTerm || selectedStationFilter || occupancyFilter !== 'all';
  };

  const handleExportBedLayout = () => {
    setShowExportModal(true);
  };

  const handleStationSelectionForExport = (stationId: string, checked: boolean) => {
    const newSelection = new Set(selectedStationsForExport);
    if (checked) {
      newSelection.add(stationId);
    } else {
      newSelection.delete(stationId);
    }
    setSelectedStationsForExport(newSelection);
  };

  const handleConfirmExport = async () => {
    if (selectedStationsForExport.size === 0) {
      alert('請至少選擇一個站點');
      return;
    }

    try {
      setIsExporting(true);
      const selectedStationsList = Array.from(selectedStationsForExport).map(stationId =>
        stations.find(s => s.id === stationId)
      ).filter(Boolean);
      
      await exportBedLayoutToExcel(selectedStationsList, beds, patients);
      setShowExportModal(false);
      setSelectedStationsForExport(new Set());
    } catch (error) {
      console.error('匯出床位表失敗:', error);
      alert('匯出床位表失敗，請重試');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">床位管理</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowStationManagementModal(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>站點管理</span>
          </button>
          <button
            onClick={() => setShowSwapModal(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>床位互換</span>
          </button>
                    <button
            onClick={handleExportBedLayout}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>匯出床位表</span>
          </button>
        </div>
      </div>

      {/* 站點概覽 */}
      <div className="space-y-4">
        {stations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無站點</h3>
            <p className="text-gray-600 mb-4">開始建立您的第一個站點</p>
            <button
              onClick={() => setShowStationModal(true)}
              className="btn-primary"
            >
              新增站點
            </button>
          </div>
        ) : (
          stations.map(station => {
            const stats = getStationStats(station.id);
            const stationPatients = patients.filter(p => p.station_id === station.id && p.在住狀態 === '在住');
            
            // 性別統計
            const maleCount = stationPatients.filter(p => p.性別 === '男').length;
            const femaleCount = stationPatients.filter(p => p.性別 === '女').length;
            
            // 護理等級統計
            const maleFullCare = stationPatients.filter(p => p.性別 === '男' && p.護理等級 === '全護理').length;
            const femaleFullCare = stationPatients.filter(p => p.性別 === '女' && p.護理等級 === '全護理').length;
            const totalFullCare = maleFullCare + femaleFullCare;
            
            const maleHalfCare = stationPatients.filter(p => p.性別 === '男' && p.護理等級 === '半護理').length;
            const femaleHalfCare = stationPatients.filter(p => p.性別 === '女' && p.護理等級 === '半護理').length;
            const totalHalfCare = maleHalfCare + femaleHalfCare;
            
            const maleSelfCare = stationPatients.filter(p => p.性別 === '男' && p.護理等級 === '自理').length;
            const femaleSelfCare = stationPatients.filter(p => p.性別 === '女' && p.護理等級 === '自理').length;
            const totalSelfCare = maleSelfCare + femaleSelfCare;
            
            return (
              <div className="p-4"> 
              </div>
            );
          })
        )}
      </div>

      {/* 搜索和篩選 */}
      <div className="card p-4 mt-4">
        <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索床位號碼、床位名稱、站點名稱或院友姓名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <select
              value={selectedStationFilter}
              onChange={(e) => setSelectedStationFilter(e.target.value)}
              className="form-input lg:w-40"
            >
              <option value="">所有站點</option>
              {stations.map(station => (
                <option key={station.id} value={station.id}>{station.name}</option>
              ))}
            </select>
            
            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value)}
              className="form-input lg:w-32"
            >
              <option value="all">所有床位</option>
              <option value="occupied">已佔用</option>
              <option value="available">可用床位</option>
            </select>
            
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
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
          <span>顯示 {filteredBeds.length} / {beds.length} 個床位</span>
          {hasActiveFilters() && (
            <span className="text-blue-600">已套用篩選條件</span>
          )}
        </div>
      </div>

      {/* 床位列表 */}
      <div className="space-y-6 mt-6">
        {stations.map(station => {
          const stationBeds = filteredBeds.filter(bed => bed.station_id === station.id);
          
          return (stationBeds.length === 0 && hasActiveFilters()) ? null : (
            <div key={station.id} className="card">
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">{station.name}</h2>
                  {station.description && (
                    <p className="text-sm text-gray-600">{station.description}</p>
                  )}
                </div>
                
                {stationBeds.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {stationBeds.map(bed => {
                      const patient = getPatientInBed(bed.id);
                      
                      return (
                        <div
                          key={bed.id}
                          className={`border-2 rounded-lg p-4 transition-all duration-200 ${
                            patient
                              ? 'border-green-200 bg-green-50 hover:bg-green-100'
                              : 'border-red-200 bg-red-50 hover:bg-red-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Bed className={`h-5 w-5 ${bed.is_occupied ? 'text-green-600' : 'text-blue-600'}`} />
                              <div>
                                <h3 className="font-medium text-gray-900">{bed.bed_number}</h3>
                                {bed.bed_name && bed.bed_name !== bed.bed_number && (
                                  <p className="text-sm text-gray-600">{bed.bed_name}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              {bed.is_occupied ? (
                                <CheckCircle className="h-4 w-4 text-green-500" title="已佔用" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" title="可用" />
                              )}
                              
                              <div className="relative group">
                                <button className="p-1 text-gray-400 hover:text-gray-600">
                                  <Settings className="h-4 w-4" />
                                </button>
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                  <button
                                    onClick={() => handleEditBed(bed)}
                                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    <span>編輯床位</span>
                                  </button>
                                  {!bed.is_occupied && (
                                    <button
                                      onClick={() => handleAssignBed(bed)}
                                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                    >
                                      <User className="h-4 w-4" />
                                      <span>指派院友</span>
                                    </button>
                                  )}
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <div className="px-4 py-2 text-xs text-gray-500">遷移到其他站點</div>
                                  {stations.filter(s => s.id !== station.id).map(targetStation => (
                                    <button
                                      key={targetStation.id}
                                      onClick={() => handleMoveBed(bed.id, targetStation.id)}
                                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                    >
                                      <MoveRight className="h-4 w-4" />
                                      <span>遷移到 {targetStation.name}</span>
                                    </button>
                                  ))}
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <button
                                    onClick={() => handleDeleteBed(bed.id)}
                                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>刪除床位</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-[1fr_auto] gap-3">
                            {/* 左欄：院友資訊 */}
                            {patient ? (
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                                  {patient.院友相片 ? (
                                    <img
                                      src={patient.院友相片}
                                      alt={patient.中文姓名}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <PatientTooltip patient={patient}>
                                    <p className="font-medium text-gray-900 cursor-help hover:text-blue-600 transition-colors">
                                      {patient.中文姓氏}{patient.中文名字}
                                    </p>
                                  </PatientTooltip>
                                  <p className="text-sm text-gray-600">{patient.性別} | {patient.入住類型 || '未設定'}</p>
                                  {patient.感染控制 && Array.isArray(patient.感染控制) && patient.感染控制.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {patient.感染控制.map((item: string, index: number) => (
                                        <span key={index} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-300">
                                          🔴 {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-dashed border-blue-300 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">空置床位</p>
                                  <button
                                    onClick={() => handleAssignBed(bed)}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    指派院友
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 右欄：QR Code */}
                            <div className="flex items-center justify-center">
                              {qrCodeDataUrls.get(bed.id) ? (
                                <div
                                  onClick={() => downloadBedQRCode(bed)}
                                  className="cursor-pointer hover:opacity-75 transition-opacity group relative"
                                  title="點擊下載列印用 QR Code"
                                >
                                  <img
                                    src={qrCodeDataUrls.get(bed.id)}
                                    alt={`${bed.bed_number} QR Code`}
                                    className="w-20 h-20 rounded-lg border-2 border-gray-300"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-lg">
                                    <Download className="h-6 w-6 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-20 h-20 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                  <QrCode className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bed className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">此站點暫無床位</h3>
                    <p className="text-gray-600 mb-4">為此站點新增床位</p>
                    <button
                      onClick={() => {
                        setSelectedStation(station);
                        setSelectedBed(null);
                        setShowBedModal(true);
                      }}
                      className="btn-primary"
                    >
                      新增床位
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 模態框 */}
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
          preselectedStation={selectedStation}
          onClose={() => {
            setShowBedModal(false);
            setSelectedBed(null);
            setSelectedStation(null);
          }}
        />
      )}

      {showAssignmentModal && selectedBed && (
        <BedAssignmentModal
          bed={selectedBed}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedBed(null);
          }}
        />
      )}

      {showSwapModal && (
        <BedSwapModal
          onClose={() => setShowSwapModal(false)}
        />
      )}

      {showStationManagementModal && (
        <StationManagementModal
          onClose={() => setShowStationManagementModal(false)}
        />
      )}

      {/* 匯出床位表模態框 */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">匯出床位表</h3>
              </div>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedStationsForExport(new Set());
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                請選擇要匯出床位表的站點，每個站點將生成獨立的工作表：
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stations.map(station => {
                  const stats = getStationStats(station.id);
                  return (
                    <label
                      key={station.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStationsForExport.has(station.id)}
                        onChange={(e) => handleStationSelectionForExport(station.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <span className="font-medium text-gray-900">{station.name}</span>
                          <div className="text-sm text-gray-500">
                            {stats.totalBeds} 床位 ({stats.occupiedBeds} 已佔用, {stats.availableBeds} 可用)
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              
              {stations.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">暫無站點可匯出</p>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>注意：</strong>系統將使用範本管理中的「床位表」範本來生成床位表。
                  如果沒有上傳範本，將使用預設格式。
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleConfirmExport}
                disabled={selectedStationsForExport.size === 0 || isExporting}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>匯出中...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>匯出 ({selectedStationsForExport.size})</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedStationsForExport(new Set());
                }}
                className="btn-secondary flex-1"
                disabled={isExporting}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StationBedManagement;