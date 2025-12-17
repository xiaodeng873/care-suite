import React, { useState, useMemo } from 'react';
import { BarChart3, Download, Calendar, Users, FileText, Activity, Utensils, Stethoscope, AlertCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

type ReportTab = 'daily' | 'monthly' | 'infection' | 'meal' | 'tube' | 'special';
type TimeFilter = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth';
type StationFilter = 'all' | string;

const Reports: React.FC = () => {
  const { patients, stations, healthAssessments, woundAssessments, incidentReports, patientHealthTasks, restraintAssessments, prescriptions, loading } = usePatients();
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [stationFilter, setStationFilter] = useState<StationFilter>('all');

  // 日期計算輔助函數
  const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return { today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd };
  };

  const { today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd } = getDateRanges();

  // 過濾院友(按站點)
  const filteredPatients = useMemo(() => {
    if (stationFilter === 'all') return patients;
    return patients.filter(p => p.station_id === stationFilter);
  }, [patients, stationFilter]);

  // 每日報表數據
  const dailyReportData = useMemo(() => {
    const targetDate = timeFilter === 'today' ? today : yesterday;
    const activePatients = filteredPatients.filter(p => p.在住狀態 === '在住');

    // 社會福利分類統計
    const socialWelfareStats = {
      買位: activePatients.filter(p => p.社會福利?.type === '買位').length,
      私位: activePatients.filter(p => p.社會福利?.type === '私位').length,
      院舍劵: activePatients.filter(p => p.社會福利?.type === '院舍劵').length,
      暫住: activePatients.filter(p => p.社會福利?.type === '暫住').length,
    };

    // 在住狀態統計(按性別)
    const residenceStats = {
      住在本站男: activePatients.filter(p => p.性別 === '男' && !p.is_hospitalized).length,
      住在本站女: activePatients.filter(p => p.性別 === '女' && !p.is_hospitalized).length,
      入住醫院男: activePatients.filter(p => p.性別 === '男' && p.is_hospitalized).length,
      入住醫院女: activePatients.filter(p => p.性別 === '女' && p.is_hospitalized).length,
      暫時回家男: 0, // 需要額外欄位標記
      暫時回家女: 0,
    };
    residenceStats['本站總人數'] = residenceStats.住在本站男 + residenceStats.住在本站女;

    // 過去24小時新入住
    const newAdmissions = filteredPatients.filter(p => {
      if (!p.入住日期) return false;
      const admissionDate = new Date(p.入住日期);
      return admissionDate >= targetDate && admissionDate < new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    }).length;

    // 當日退住
    const discharges = filteredPatients.filter(p => {
      if (!p.退住日期) return false;
      const dischargeDate = new Date(p.退住日期);
      return dischargeDate.toDateString() === targetDate.toDateString();
    });
    const discharge男 = discharges.filter(p => p.性別 === '男').length;
    const discharge女 = discharges.filter(p => p.性別 === '女').length;

    // 過去24小時死亡人數
    const deaths = filteredPatients.filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      const deathDate = new Date(p.death_date);
      return deathDate >= targetDate && deathDate < new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    });
    const death男 = deaths.filter(p => p.性別 === '男').length;
    const death女 = deaths.filter(p => p.性別 === '女').length;

    // 當月累積死亡人數
    const monthStart = timeFilter === 'today' ? thisMonthStart : lastMonthStart;
    const monthEnd = timeFilter === 'today' ? thisMonthEnd : lastMonthEnd;
    const monthlyDeaths = patients.filter(p => {
      if (!p.death_date || p.discharge_reason !== '死亡') return false;
      const deathDate = new Date(p.death_date);
      return deathDate >= monthStart && deathDate <= monthEnd;
    }).length;

    // 傷口和壓瘡統計
    const woundPatients = new Set<number>();
    const pressureUlcerPatients = new Set<number>();
    (woundAssessments || []).forEach(assessment => {
      const patient = activePatients.find(p => p.院友id === assessment.patient_id);
      if (!patient) return;

      assessment.wound_details?.forEach(detail => {
        if (detail.wound_status === '未處理' || detail.wound_status === '治療中') {
          woundPatients.add(assessment.patient_id);
          if (detail.wound_type === '壓力性') {
            pressureUlcerPatients.add(assessment.patient_id);
          }
        }
      });
    });

    // 健康評估相關統計
    const ngTubeCount = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.飲食營養?.狀況 === '鼻胃管';
    }).length;

    const catheterCount = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.日常活動及自理能力?.大小便?.includes('導尿管');
    }).length;

    const dialysisCount = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.治療項目?.腹膜透析 || assessment?.治療項目?.血液透析;
    }).length;

    const oxygenCount = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.治療項目?.氧氣治療;
    }).length;

    const stomaCount = activePatients.filter(p => {
      const assessment = (healthAssessments || []).find(a => a.patient_id === p.院友id);
      return assessment?.治療項目?.腸造口 || assessment?.治療項目?.小便造口;
    }).length;

    const infectionControlCount = activePatients.filter(p =>
      p.感染控制 && p.感染控制.length > 0
    ).length;

    const restraintCount = restraintAssessments?.filter(r => {
      return activePatients.some(p => p.院友id === r.patient_id);
    }).length || 0;

    // 意外統計
    const todayIncidents = (incidentReports || []).filter(incident => {
      const incidentDate = new Date(incident.incident_date);
      return incidentDate.toDateString() === targetDate.toDateString();
    });

    const medicationIncidents = todayIncidents.filter(i => i.incident_type === '藥物').length;
    const fallIncidents = todayIncidents.filter(i => i.incident_nature === '跌倒').length;
    const deathIncidents = deaths.length;

    // 護理等級統計(按性別)
    const fullCare男 = activePatients.filter(p => p.護理等級 === '全護理' && p.性別 === '男').length;
    const fullCare女 = activePatients.filter(p => p.護理等級 === '全護理' && p.性別 === '女').length;
    const semiCare男 = activePatients.filter(p => p.護理等級 === '半護理' && p.性別 === '男').length;
    const semiCare女 = activePatients.filter(p => p.護理等級 === '半護理' && p.性別 === '女').length;
    const convalescent男 = activePatients.filter(p => p.護理等級 === '療養級' && p.性別 === '男').length;
    const convalescent女 = activePatients.filter(p => p.護理等級 === '療養級' && p.性別 === '女').length;

    return {
      socialWelfareStats,
      residenceStats,
      newAdmissions,
      discharge: { 男: discharge男, 女: discharge女, total: discharge男 + discharge女 },
      death: { 男: death男, 女: death女, total: death男 + death女 },
      monthlyDeaths,
      medical: {
        鼻胃飼: ngTubeCount,
        導尿管: catheterCount,
        傷口: woundPatients.size,
        壓瘡: pressureUlcerPatients.size,
        腹膜血液透析: dialysisCount,
        氧氣治療: oxygenCount,
        造口: stomaCount,
        感染控制: infectionControlCount,
        使用約束物品: restraintCount,
      },
      incidents: {
        藥物: medicationIncidents,
        跌倒: fallIncidents,
        死亡: deathIncidents,
      },
      careLevel: {
        全護理男: fullCare男,
        全護理女: fullCare女,
        全護理總: fullCare男 + fullCare女,
        半護理男: semiCare男,
        半護理女: semiCare女,
        半護理總: semiCare男 + semiCare女,
        療養級男: convalescent男,
        療養級女: convalescent女,
        療養級總: convalescent男 + convalescent女,
      },
    };
  }, [filteredPatients, timeFilter, healthAssessments, woundAssessments, incidentReports, restraintAssessments, today, yesterday, thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd]);

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

  const renderDailyReport = () => (
    <div className="space-y-6">
      {/* 時間和站點篩選 */}
      <div className="flex space-x-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-4 py-2 rounded-lg ${timeFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            當日
          </button>
          <button
            onClick={() => setTimeFilter('yesterday')}
            className={`px-4 py-2 rounded-lg ${timeFilter === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            昨日
          </button>
        </div>
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="form-input"
        >
          <option value="all">全部站點</option>
          {stations.map(station => (
            <option key={station.id} value={station.id}>{station.name}</option>
          ))}
        </select>
      </div>

      {/* 社會福利統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">社會福利分類</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">買位</p>
            <p className="text-2xl font-bold text-blue-600">{dailyReportData.socialWelfareStats.買位}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">私位</p>
            <p className="text-2xl font-bold text-green-600">{dailyReportData.socialWelfareStats.私位}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">院舍劵</p>
            <p className="text-2xl font-bold text-purple-600">{dailyReportData.socialWelfareStats.院舍劵}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">暫住</p>
            <p className="text-2xl font-bold text-orange-600">{dailyReportData.socialWelfareStats.暫住}</p>
          </div>
        </div>
      </div>

      {/* 在住狀態統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">在住狀態</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">住在本站</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.residenceStats.住在本站男} | 女: {dailyReportData.residenceStats.住在本站女}</p>
            <p className="text-2xl font-bold text-green-600">{dailyReportData.residenceStats.本站總人數}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">入住醫院</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.residenceStats.入住醫院男} | 女: {dailyReportData.residenceStats.入住醫院女}</p>
            <p className="text-2xl font-bold text-red-600">{dailyReportData.residenceStats.入住醫院男 + dailyReportData.residenceStats.入住醫院女}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">暫時回家</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.residenceStats.暫時回家男} | 女: {dailyReportData.residenceStats.暫時回家女}</p>
            <p className="text-2xl font-bold text-yellow-600">{dailyReportData.residenceStats.暫時回家男 + dailyReportData.residenceStats.暫時回家女}</p>
          </div>
        </div>
      </div>

      {/* 入住退住統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">入住/退住/死亡</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">過去24小時新入住</p>
            <p className="text-2xl font-bold text-blue-600">{dailyReportData.newAdmissions}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">當日退住</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.discharge.男} | 女: {dailyReportData.discharge.女}</p>
            <p className="text-2xl font-bold text-orange-600">{dailyReportData.discharge.total}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">過去24小時死亡</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.death.男} | 女: {dailyReportData.death.女}</p>
            <p className="text-2xl font-bold text-red-600">{dailyReportData.death.total}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">當月累積死亡</p>
            <p className="text-2xl font-bold text-gray-600">{dailyReportData.monthlyDeaths}</p>
          </div>
        </div>
      </div>

      {/* 醫療項目統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">醫療項目</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(dailyReportData.medical).map(([key, value]) => (
            <div key={key} className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{key}</p>
              <p className="text-2xl font-bold text-indigo-600">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 意外統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">意外事件</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">藥物</p>
            <p className="text-2xl font-bold text-yellow-600">{dailyReportData.incidents.藥物}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">跌倒</p>
            <p className="text-2xl font-bold text-orange-600">{dailyReportData.incidents.跌倒}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">死亡</p>
            <p className="text-2xl font-bold text-red-600">{dailyReportData.incidents.死亡}</p>
          </div>
        </div>
      </div>

      {/* 護理等級統計 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">護理等級</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">全護理</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.careLevel.全護理男} | 女: {dailyReportData.careLevel.全護理女}</p>
            <p className="text-2xl font-bold text-red-600">{dailyReportData.careLevel.全護理總}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">半護理</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.careLevel.半護理男} | 女: {dailyReportData.careLevel.半護理女}</p>
            <p className="text-2xl font-bold text-yellow-600">{dailyReportData.careLevel.半護理總}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">療養級</p>
            <p className="text-xs text-gray-500">男: {dailyReportData.careLevel.療養級男} | 女: {dailyReportData.careLevel.療養級女}</p>
            <p className="text-2xl font-bold text-green-600">{dailyReportData.careLevel.療養級總}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">統計報表</h1>
          </div>
        </div>
      </div>

      {/* 報表類型標籤 */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 font-medium ${activeTab === 'daily' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Calendar className="h-4 w-4 inline mr-1" />
            每日報表
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 font-medium ${activeTab === 'monthly' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <FileText className="h-4 w-4 inline mr-1" />
            每月報表
          </button>
          <button
            onClick={() => setActiveTab('infection')}
            className={`px-4 py-2 font-medium ${activeTab === 'infection' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <AlertCircle className="h-4 w-4 inline mr-1" />
            感染控制報表
          </button>
          <button
            onClick={() => setActiveTab('meal')}
            className={`px-4 py-2 font-medium ${activeTab === 'meal' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Utensils className="h-4 w-4 inline mr-1" />
            餐膳報表
          </button>
          <button
            onClick={() => setActiveTab('tube')}
            className={`px-4 py-2 font-medium ${activeTab === 'tube' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Stethoscope className="h-4 w-4 inline mr-1" />
            喉管相關報表
          </button>
          <button
            onClick={() => setActiveTab('special')}
            className={`px-4 py-2 font-medium ${activeTab === 'special' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            <Activity className="h-4 w-4 inline mr-1" />
            特別關顧名單
          </button>
        </div>
      </div>

      {/* 報表內容 */}
      <div>
        {activeTab === 'daily' && renderDailyReport()}
        {activeTab === 'monthly' && <div className="text-center text-gray-500 py-12">每月報表開發中...</div>}
        {activeTab === 'infection' && <div className="text-center text-gray-500 py-12">感染控制報表開發中...</div>}
        {activeTab === 'meal' && <div className="text-center text-gray-500 py-12">餐膳報表開發中...</div>}
        {activeTab === 'tube' && <div className="text-center text-gray-500 py-12">喉管相關報表開發中...</div>}
        {activeTab === 'special' && <div className="text-center text-gray-500 py-12">特別關顧名單開發中...</div>}
      </div>
    </div>
  );
};

export default Reports;
