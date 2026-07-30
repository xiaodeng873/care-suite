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
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  Download,
  QrCode,
  Printer,
  DoorOpen,
  History,
  RotateCcw,
  Home,
} from 'lucide-react';
import * as QRCode from 'qrcode';
import { usePatients } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import StationModal from '../components/StationModal';
import BedModal from '../components/BedModal';
import RoomModal from '../components/RoomModal';
import BedAssignmentModal from '../components/BedAssignmentModal';
import BedSwapModal from '../components/BedSwapModal';
import PatientTooltip from '../components/PatientTooltip';
import BedNumberImprint from '../components/BedNumberImprint';
import BedTransferLogModal from '../components/BedTransferLogModal';
import ChangeOriginalBedModal from '../components/ChangeOriginalBedModal';
import StationManagementModal from '../components/StationManagementModal';
import { isTemporaryTransfer, getRootBedNumber } from '../utils/bedTransferUtils';
import { printBedList } from '../utils/bedListHtmlGenerator';
import { getFacilitySettings, DEFAULT_FACILITY_SETTINGS } from '../utils/facilitySettings';
import { supabase } from '../lib/supabase';
import { fuzzyMatch, matchChineseName , matchBedNumber } from '../utils/searchUtils';
const StationBedManagement: React.FC = () => {
  const { 
    stations, 
    rooms,
    beds, 
    allPatients: patients, 
    infectionControlRecords,
    loading, 
    deleteStation, 
    deleteBed,
    cancelTemporaryTransfer,
    cancelTemporarySwapPair,
  } = usePatients();
  const [showStationModal, setShowStationModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showStationManagementModal, setShowStationManagementModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [showPrintStationModal, setShowPrintStationModal] = useState(false);
  const [selectedStationForPrint, setSelectedStationForPrint] = useState<string>('');
  
  const [showAllBedLogModal, setShowAllBedLogModal] = useState(false);
  const [showPatientTransferLogModal, setShowPatientTransferLogModal] = useState(false);
  const [patientTransferLogTarget, setPatientTransferLogTarget] = useState<any>(null);
  const [showChangeOriginalBedModal, setShowChangeOriginalBedModal] = useState(false);
  const [changeOriginalBedTarget, setChangeOriginalBedTarget] = useState<any>(null);

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
    return <LoadingScreen pageName="床位管理" />;
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
    // 居住區篩選
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
      return (
        fuzzyMatch(bed.bed_number, searchTerm) ||
        fuzzyMatch(bed.bed_name, searchTerm) ||
        fuzzyMatch(station?.name, searchTerm) ||
        matchChineseName(patient?.中文姓氏, patient?.中文名字, patient?.中文姓名, searchTerm) ||
        matchBedNumber(patient?.床號, searchTerm)
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
      alert(`無法刪除居住區「${station?.name}」，因為以下床位仍有院友：\n\n${occupiedBedsList}\n\n請先將所有院友遷移到其他床位，然後刪除或遷移所有床位。`);
      return;
    }
    if (stationBeds.length > 0) {
      const emptyBedsList = stationBeds.map(bed => bed.bed_number).join('、');
      alert(`無法刪除居住區「${station?.name}」，因為該居住區下還有以下空置床位：\n\n${emptyBedsList}\n\n請先刪除或遷移所有床位到其他居住區。`);
      return;
    }
    if (confirm(`確定要刪除居住區「${station?.name}」嗎？`)) {
      try {
        await deleteStation(stationId);
      } catch (error) {
        alert('刪除居住區失敗，請重試');
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
  const handleCancelTemporaryTransfer = async (patient: any) => {
    if (!window.confirm(`確定要取消「${patient.中文姓名}」的暫時性調動並嘗試返回原床嗎？\n\n若原床已被佔用，院友將困在現床。`)) {
      return;
    }
    try {
      const result = await cancelTemporaryTransfer(patient.院友id);
      if (result.success) {
        alert('已取消暫時性調動並返回原床');
      } else if (result.reason === 'mutual_swap_detected' && result.partner_patient_id) {
        const partner = patients.find((p: any) => p.院友id === result.partner_patient_id);
        if (!partner) {
          alert('偵測到互相暫換，但找不到對方院友資料，請刷新頁面後重試。');
          return;
        }
        const message =
          `「${patient.中文姓名}」與「${partner.中文姓名}」正處於暫時性互換，單獨取消會互相困住對方。\n\n` +
          `是否同時取消兩人的暫時性調動，讓 ${patient.中文姓名} 返回 ${patient.original_bed_number || '原床'}，` +
          `${partner.中文姓名} 返回 ${partner.original_bed_number || '原床'}？`;
        if (window.confirm(message)) {
          const pairResult = await cancelTemporarySwapPair(patient.院友id, partner.院友id);
          if (pairResult.success) {
            alert('已同時取消兩人的暫時性調動並返回原床');
          } else {
            alert(`成對取消失敗：${pairResult.reason || '請重試'}`);
          }
        }
      } else if (result.reason === 'root_bed_occupied') {
        alert('原床位已被佔用，院友仍留在現床。請先騰出原床位或更改原床位。');
      } else {
        alert('取消暫時性調動失敗，請重試');
      }
    } catch (error) {
      console.error('取消暫時性調動失敗:', error);
      alert(error instanceof Error ? error.message : '取消暫時性調動失敗，請重試');
    }
  };

  const handleOpenPatientTransferLog = (patient: any) => {
    setPatientTransferLogTarget(patient);
    setShowPatientTransferLogModal(true);
  };

  const handleOpenChangeOriginalBed = (patient: any) => {
    setChangeOriginalBedTarget(patient);
    setShowChangeOriginalBedModal(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStationFilter('');
    setOccupancyFilter('all');
  };
  const hasActiveFilters = () => {
    return searchTerm || selectedStationFilter || occupancyFilter !== 'all';
  };
  const handlePrintBedList = async (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStr = todayStart.toISOString().split('T')[0];

    const stationBeds = beds.filter(b => b.station_id === stationId)
      .sort((a, b) => a.bed_number.localeCompare(b.bed_number, 'zh-Hant', { numeric: true }));

    const stationPatients = (patients || []).filter(p =>
      p.在住狀態 === '在住' && stationBeds.some(b => b.id === p.bed_id)
    );
    const stationPatientIds = stationPatients.map(p => p.院友id);

    const bedList = stationBeds.map(bed => {
      const patient = patients.find(p => p.bed_id === bed.id && p.在住狀態 === '在住');
      const patientInfections = patient
        ? infectionControlRecords
            .filter(r => r.patient_id === patient.院友id && !r.recovery_date)
            .map(r => r.infection_type)
        : null;
      // 列印床位表以原床為主；暫時性調動者小字顯示現床
      const isTemporary = patient && patient.bed_transfer_type === 'temporary' && !!patient.original_bed_number;
      const bedNumber = patient ? (patient.original_bed_number || patient.床號) : bed.bed_number;
      const currentBedNumber = isTemporary ? patient.床號 : undefined;
      return {
        bed_number: bedNumber,
        current_bed_number: currentBedNumber,
        patient: patient
          ? {
              name: `${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}`.trim() || patient.中文姓名 || '',
              gender: patient.性別,
              admissionType: patient.入住類型,
              careLevel: patient.護理等級,
              infectionControl: patientInfections && patientInfections.length > 0 ? patientInfections : null,
            }
          : null,
      };
    });

    if (stationPatientIds.length === 0) {
      const facilitySettings = await getFacilitySettings().catch(() => null);
      await printBedList({
        stationName: station.name,
        facilityName: facilitySettings?.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
        beds: bedList,
      });
      return;
    }

    const [
      facilitySettings,
      taskResult,
      episodeResult,
      healthResult,
      woundResult,
      incidentResult,
      restraintResult,
    ] = await Promise.all([
      getFacilitySettings().catch(() => null),
      supabase.from('patient_health_tasks').select('patient_id, health_record_type, notes').in('patient_id', stationPatientIds),
      supabase.from('hospital_episodes').select('patient_id, episode_events(event_type, event_date)').in('patient_id', stationPatientIds),
      supabase.from('health_assessments').select('patient_id, treatment_items, bowel_bladder_control').in('patient_id', stationPatientIds),
      supabase.from('wound_assessments').select('patient_id, wound_details').in('patient_id', stationPatientIds),
      supabase.from('incident_reports').select('patient_id, incident_type, incident_nature, incident_date').in('patient_id', stationPatientIds).gte('incident_date', todayStr),
      supabase.from('patient_restraint_assessments').select('patient_id').in('patient_id', stationPatientIds),
    ]);

    const taskRows: any[] = taskResult.data ?? [];
    const episodeRows: any[] = episodeResult.data ?? [];
    const healthRows: any[] = healthResult.data ?? [];
    const woundRows: any[] = woundResult.data ?? [];
    const incidentRows: any[] = incidentResult.data ?? [];
    const restraintRows: any[] = restraintResult.data ?? [];

    // ── 特別關顧（男/女）──
    const specialIds = new Set(taskRows.filter(r => r.notes === '特別關顧').map(r => r.patient_id));
    const specialCare = {
      男: stationPatients.filter(p => specialIds.has(p.院友id) && p.性別 === '男').length,
      女: stationPatients.filter(p => specialIds.has(p.院友id) && p.性別 === '女').length,
    };

    // ── 入住醫院 / 暫時回家（男/女）──
    const parseDateOnly = (s: string) => {
      const d = new Date(s);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };
    const checkEpisodeStatus = (patientId: number, startType: string | string[], endType: string): boolean => {
      const startTypes = Array.isArray(startType) ? startType : [startType];
      const eps = episodeRows.filter(e => e.patient_id === patientId);
      for (const ep of eps) {
        const events = [...(ep.episode_events || [])].sort(
          (a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );
        for (let i = 0; i < events.length; i++) {
          if (startTypes.includes(events[i].event_type)) {
            const start = parseDateOnly(events[i].event_date);
            if (start.getTime() <= todayStart.getTime()) {
              const end = events.slice(i + 1).find((e: any) => e.event_type === endType);
              if (!end) return true;
              if (parseDateOnly(end.event_date).getTime() > todayStart.getTime()) return true;
            }
          }
        }
      }
      return false;
    };

    const hospitalized = {
      男: stationPatients.filter(p => checkEpisodeStatus(p.院友id, ['admission', 'transfer'], 'discharge') && p.性別 === '男').length,
      女: stationPatients.filter(p => checkEpisodeStatus(p.院友id, ['admission', 'transfer'], 'discharge') && p.性別 === '女').length,
    };
    const vacation = {
      男: stationPatients.filter(p => checkEpisodeStatus(p.院友id, 'vacation_start', 'vacation_end') && p.性別 === '男').length,
      女: stationPatients.filter(p => checkEpisodeStatus(p.院友id, 'vacation_start', 'vacation_end') && p.性別 === '女').length,
    };

    // ── 過去 24 小時 ──
    const allStationPats = (patients || []).filter(p =>
      p.station_id === stationId || stationBeds.some(b => b.id === p.bed_id)
    );
    const newAdmissions = allStationPats.filter(p => {
      if (!p.入住日期) return false;
      return parseDateOnly(p.入住日期).getTime() === todayStart.getTime();
    }).length;
    const discharges = allStationPats.filter(p => {
      if (!p.退住日期) return false;
      return parseDateOnly(p.退住日期).getTime() === todayStart.getTime();
    }).length;
    const deaths24h = allStationPats.filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      return parseDateOnly(p.death_date).getTime() === todayStart.getTime();
    }).length;
    const monthlyDeaths = (patients || []).filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      return parseDateOnly(p.death_date) >= monthStart;
    }).length;

    // ── 醫療項目 ──
    const ngTubeIds = new Set(taskRows.filter(r => r.health_record_type === '鼻胃飼更換').map(r => r.patient_id));
    const catheterIds = new Set(taskRows.filter(r => r.health_record_type === '導尿管更換').map(r => r.patient_id));
    const woundPids = new Set<number>();
    const pressurePids = new Set<number>();
    woundRows.forEach(wa => {
      (wa.wound_details || []).forEach((wd: any) => {
        if (wd.wound_status === '未處理' || wd.wound_status === '治療中') {
          woundPids.add(wa.patient_id);
          if (wd.wound_type === '壓力性') pressurePids.add(wa.patient_id);
        }
      });
    });
    const dialysisPids = new Set(healthRows.filter(h => (h.treatment_items || []).includes('腹膜/血液透析')).map(h => h.patient_id));
    const oxygenPids = new Set(healthRows.filter(h => (h.treatment_items || []).includes('氧氣治療')).map(h => h.patient_id));
    const stomaPids = new Set(healthRows.filter(h =>
      h.bowel_bladder_control?.bowel === '腸造口' || h.bowel_bladder_control?.bladder === '小便造口'
    ).map(h => h.patient_id));
    const infPids = new Set(
      infectionControlRecords
        .filter(r => !r.recovery_date && stationPatientIds.includes(r.patient_id))
        .map(r => r.patient_id)
    );
    const restraintPids = new Set(restraintRows.map(r => r.patient_id));
    const cnt = (ids: Set<number>) => stationPatients.filter(p => ids.has(p.院友id)).length;
    const medical = {
      鼻胃飼: cnt(ngTubeIds),
      尿管: cnt(catheterIds),
      傷口: cnt(woundPids),
      壓瘡: cnt(pressurePids),
      腹膜透析: cnt(dialysisPids),
      吸氧: cnt(oxygenPids),
      造口: cnt(stomaPids),
      傳染病隔離: cnt(infPids),
      使用約束物品: cnt(restraintPids),
    };

    // ── 意外事件 ──
    const todayInc = incidentRows.filter(i =>
      parseDateOnly(i.incident_date).getTime() === todayStart.getTime()
    );
    const incidents = {
      藥物: todayInc.filter(i => i.incident_type === '藥物').length,
      跌倒: todayInc.filter(i => i.incident_nature === '跌倒').length,
      死亡: deaths24h,
    };

    await printBedList({
      stationName: station.name,
      facilityName: facilitySettings?.facilityNameZh || DEFAULT_FACILITY_SETTINGS.facilityNameZh,
      beds: bedList,
      specialCare,
      hospitalized,
      vacation,
      over24h: { 新收: newAdmissions, 退住: discharges, 死亡: deaths24h, 當月累積死亡: monthlyDeaths },
      medical,
      incidents,
    });
  };


  return (
    <div className="space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">床位管理</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowStationManagementModal(true)}
            className="btn-secondary flex flex-wrap items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            <span>居住區管理</span>
          </button>
          <button
            onClick={() => setShowSwapModal(true)}
            className="btn-secondary flex flex-wrap items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>床位互換</span>
          </button>
          <button
            onClick={() => setShowAllBedLogModal(true)}
            className="btn-secondary flex flex-wrap items-center gap-2"
          >
            <History className="h-4 w-4" />
            <span>床位調動日誌</span>
          </button>
          <button
            onClick={() => setShowPrintStationModal(true)}
            className="btn-secondary flex flex-wrap items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>列印床位表</span>
          </button>
        </div>
      </div>
      {/* 居住區概覽 */}
      <div className="space-y-4">
        {stations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無居住區</h3>
            <p className="text-gray-600 mb-4">開始建立您的第一個居住區</p>
            <button
              onClick={() => setShowStationModal(true)}
              className="btn-primary"
            >
              新增居住區
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
              <div key={station.id} className="p-4"> 
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
              placeholder="搜索床位號碼、床位名稱、居住區名稱或院友姓名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedStationFilter}
              onChange={(e) => setSelectedStationFilter(e.target.value)}
              className="form-input lg:w-40"
            >
              <option value="">所有居住區</option>
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
                className="btn-secondary flex flex-wrap items-center gap-2"
              >
                <X className="h-4 w-4" />
                <span>清除</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600 mt-2">
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
          // 依房間分組（房號自然排序；房內床位依床號自然排序）
          const stationRooms = rooms
            .filter((r: any) => r.station_id === station.id)
            .sort((a: any, b: any) => a.room_number.localeCompare(b.room_number, 'zh-Hant', { numeric: true }));
          const roomGroups = stationRooms
            .map((room: any) => ({
              room,
              roomBeds: stationBeds
                .filter(b => b.room_id === room.id)
                .sort((a, b) => (a.bed_no || a.bed_number).localeCompare(b.bed_no || b.bed_number, 'zh-Hant', { numeric: true })),
            }))
            .filter((g: any) => g.roomBeds.length > 0 || !hasActiveFilters());
          return (stationBeds.length === 0 && hasActiveFilters()) ? null : (
            <div key={station.id} className="card">
              <div className="p-6">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{station.name}</h2>
                      <span className="text-xs text-gray-500">{stationRooms.length} 房 · {stationBeds.length} 床</span>
                    </div>
                    {station.description && (
                      <p className="text-sm text-gray-600 mt-1">{station.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedStation(station); setSelectedRoom(null); setShowRoomModal(true); }}
                    className="btn-secondary flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" /> 新增房間
                  </button>
                </div>
                {roomGroups.length > 0 ? (
                  <div className="space-y-4">
                    {roomGroups.map(({ room, roomBeds }: any) => (
                      <div key={room.id} className="border border-gray-200 rounded-xl bg-gray-50 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <DoorOpen className="h-5 w-5 text-indigo-600" />
                            <h3 className="font-semibold text-gray-900">{room.room_number} 房</h3>
                            <span className="text-xs text-gray-500">({roomBeds.length} 床)</span>
                          </div>
                          <button
                            onClick={() => { setSelectedStation(station); setSelectedRoom(room); setSelectedBed(null); setShowBedModal(true); }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> 新增床位
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {roomBeds.map((bed: any) => {
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
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Bed className={`h-5 w-5 ${bed.is_occupied ? 'text-green-600' : 'text-blue-600'}`} />
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {patient ? (
                                    <BedNumberImprint patient={patient} beds={beds} size="md" />
                                  ) : (
                                    `${room.room_number}-${bed.bed_no || bed.bed_number}`
                                  )}
                                </h3>
                                {bed.bed_name && bed.bed_name !== bed.bed_number && (
                                  <p className="text-sm text-gray-600">{bed.bed_name}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              {bed.is_occupied ? (
                                <CheckCircle className="h-4 w-4 text-green-500" aria-label="已佔用" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" title="可用" />
                              )}
                              <div className="relative group">
                                <button className="p-1 text-gray-400 hover:text-gray-600">
                                  <Settings className="h-4 w-4" />
                                </button>
                                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                  <button
                                    onClick={() => handleEditBed(bed)}
                                    className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    <span>編輯床位</span>
                                  </button>
                                  {!bed.is_occupied && (
                                    <button
                                      onClick={() => handleAssignBed(bed)}
                                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                                    >
                                      <User className="h-4 w-4" />
                                      <span>指派院友</span>
                                    </button>
                                  )}
                                  {patient && isTemporaryTransfer(patient) && (
                                    <>
                                      <div className="border-t border-gray-100 my-1"></div>
                                      <div className="px-4 py-2 text-xs text-gray-500">暫時性調動</div>
                                      <button
                                        onClick={() => handleCancelTemporaryTransfer(patient)}
                                        className="w-full px-4 py-2 text-left text-amber-700 hover:bg-amber-50 flex flex-wrap items-center gap-2"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        <span>取消暫時性調動</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenChangeOriginalBed(patient)}
                                        className="w-full px-4 py-2 text-left text-indigo-700 hover:bg-indigo-50 flex flex-wrap items-center gap-2"
                                      >
                                        <Home className="h-4 w-4" />
                                        <span>更改原床位</span>
                                      </button>
                                    </>
                                  )}
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <div className="px-4 py-2 text-xs text-gray-500">日誌</div>
                                  {patient && (
                                    <button
                                      onClick={() => handleOpenPatientTransferLog(patient)}
                                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex flex-wrap items-center gap-2"
                                    >
                                      <User className="h-4 w-4" />
                                      <span>院友調動日誌</span>
                                    </button>
                                  )}
                                  <div className="border-t border-gray-100 my-1"></div>
                                  <button
                                    onClick={() => handleDeleteBed(bed.id)}
                                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex flex-wrap items-center gap-2"
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
                              <div className="flex flex-wrap items-center gap-3">
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
                                  {(() => {
                                    const activeInfections = infectionControlRecords.filter(
                                      r => r.patient_id === patient.院友id && !r.recovery_date
                                    );
                                    if (activeInfections.length === 0) return null;
                                    return (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {activeInfections.map((infection) => (
                                          <span key={infection.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-300">
                                            🔴 {infection.infection_type}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-3">
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
                            <div className="flex flex-col items-center justify-center gap-2">
                              <button
                                onClick={() => downloadBedQRCode(bed)}
                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                                title="點擊下載列印用 QR Code"
                              >
                                <QrCode className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bed className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">此居住區暫無床位</h3>
                    <p className="text-gray-600 mb-4">先為此居住區新增房間，再於房間內新增床位</p>
                    <button
                      onClick={() => {
                        setSelectedStation(station);
                        setSelectedRoom(null);
                        setShowRoomModal(true);
                      }}
                      className="btn-primary"
                    >
                      新增房間
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
          preselectedRoom={selectedRoom}
          onClose={() => {
            setShowBedModal(false);
            setSelectedBed(null);
            setSelectedStation(null);
            setSelectedRoom(null);
          }}
        />
      )}
      {showRoomModal && (
        <RoomModal
          room={selectedRoom}
          preselectedStation={selectedStation}
          onClose={() => {
            setShowRoomModal(false);
            setSelectedRoom(null);
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

      {showChangeOriginalBedModal && changeOriginalBedTarget && (
        <ChangeOriginalBedModal
          patient={changeOriginalBedTarget}
          onClose={() => {
            setShowChangeOriginalBedModal(false);
            setChangeOriginalBedTarget(null);
          }}
        />
      )}
      {showPatientTransferLogModal && patientTransferLogTarget && (
        <BedTransferLogModal
          patient={patientTransferLogTarget}
          onClose={() => {
            setShowPatientTransferLogModal(false);
            setPatientTransferLogTarget(null);
          }}
        />
      )}
      {showAllBedLogModal && (
        <BedTransferLogModal
          title="床位調動日誌"
          onClose={() => setShowAllBedLogModal(false)}
        />
      )}

      {/* 列印床位表：選擇居住區 */}
      {showPrintStationModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPrintStationModal(false); }}
        >
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Printer className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">列印床位表</h3>
              </div>
              <button onClick={() => setShowPrintStationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">選擇要列印的居住區：</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {stations.map(station => {
                const stats = getStationStats(station.id);
                return (
                  <button
                    key={station.id}
                    onClick={() => {
                      setShowPrintStationModal(false);
                      handlePrintBedList(station.id);
                    }}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-left transition-colors"
                  >
                    <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-900">{station.name}</span>
                      <div className="text-xs text-gray-500">
                        {stats.totalBeds} 床位 · {stats.occupiedBeds} 已佔用 · {stats.availableBeds} 空置
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowPrintStationModal(false)} className="btn-secondary w-full">取消</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default StationBedManagement;