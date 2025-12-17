import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Plus, Edit3, Trash2, Download, Users, Settings, User, Search, Filter, X, AlertCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { exportCombinedScheduleToExcel } from '../utils/combinedScheduleExcelGenerator';
import ScheduleModal from '../components/ScheduleModal';
import PatientSelectModal from '../components/PatientSelectModal';
import ScheduleDetailModal from '../components/ScheduleDetailModal';
import { getReasonBadgeClass, getReasonIcon } from '../utils/reasonColors';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import { checkAnnualHealthCheckupDue, checkRestraintAssessmentDue, DueItem } from '../utils/scheduleDueChecker';
import { supabase } from '../lib/supabase';

const Scheduling: React.FC = () => {
  const { schedules, deleteSchedule, patients, loading, refreshData } = usePatients();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<db.ScheduleWithDetails | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);

  // 創建院友ID到院友資料的映射
  const patientMap = useMemo(() => {
    const map = new Map<number, db.Patient>();
    if (!patients || patients.length === 0) {
      console.warn('患者資料尚未載入，patientMap 為空');
      return map;
    }
    patients.forEach(patient => {
      if (patient && patient.院友id) {
        map.set(patient.院友id, patient);
      } else {
        console.warn(`無效的患者資料: ${JSON.stringify(patient)}`);
      }
    });
    return map;
  }, [patients]);

  // 載入並計算到期項目
  useEffect(() => {
    if (loading || !patients || patients.length === 0) {
      return;
    }
    loadDueItems();
  }, [patients, schedules, loading]);

  const loadDueItems = async () => {
    try {
      const allDueItems: DueItem[] = [];
      const reminderDays = 14; // 14 天前開始提醒

      // 獲取所有年度體檢記錄
      const { data: checkups } = await supabase
        .from('annual_health_checkups')
        .select('patient_id, checkup_date')
        .order('checkup_date', { ascending: false });

      // 獲取所有約束評估記錄
      const { data: assessments } = await supabase
        .from('patient_restraint_assessments')
        .select('*')
        .order('created_at', { ascending: false });

      // 為每位院友檢查到期項目
      for (const patient of patients) {
        if (patient.在住狀態 !== '在住') {
          continue; // 只檢查在住院友
        }

        // 檢查年度體檢
        const lastCheckup = checkups?.find(c => c.patient_id === patient.院友id);
        const healthCheckupDue = checkAnnualHealthCheckupDue(
          patient,
          lastCheckup?.checkup_date || null,
          schedules,
          reminderDays
        );
        if (healthCheckupDue && !healthCheckupDue.isScheduled) {
          allDueItems.push(healthCheckupDue);
        }

        // 檢查約束評估
        const lastAssessment = assessments?.find(a => a.patient_id === patient.院友id);
        const restraintDue = checkRestraintAssessmentDue(
          patient,
          lastAssessment || null,
          schedules,
          reminderDays
        );
        if (restraintDue && !restraintDue.isScheduled) {
          allDueItems.push(restraintDue);
        }
      }

      // 按到期日排序（最緊急的在前）
      allDueItems.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      setDueItems(allDueItems);
    } catch (error) {
      console.error('載入到期項目失敗:', error);
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

  const handleEdit = (schedule: db.ScheduleWithDetails) => {
    setSelectedSchedule(schedule);
    setShowScheduleModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('確定要刪除此排程嗎？')) {
      deleteSchedule(id);
    }
  };

  const handleAddPatients = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setShowPatientModal(true);
  };

  const handleViewDetails = (schedule: db.ScheduleWithDetails) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const handleDownloadForm = (schedule: db.ScheduleWithDetails) => {
    handleExportScheduleToExcel(schedule);
  };

  const handleExportScheduleToExcel = async (schedule: db.ScheduleWithDetails) => {
    try {
      // 驗證排程資料是否有效
      if (!schedule || !schedule.院友列表 || schedule.院友列表.length === 0) {
        alert('此排程沒有可匯出的院友資料');
        return;
      }

      // 過濾有效的院友資料
      const validPatientItems = schedule.院友列表
        .map(item => {
          const patient = patientMap.get(item.院友id);
          if (!patient || !patient.床號) {
            console.warn(`院友 ID ${item.院友id} 資料不完整或缺少床號，跳過匯出`);
            return null;
          }
          return {
            ...item,
            院友主表: patient,
            patient: patient
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // 檢查是否有有效資料
      if (validPatientItems.length === 0) {
        alert('此排程沒有有效的院友資料可以匯出');
        return;
      }

      // 建構有效的排程物件
      const validSchedule = {
        ...schedule,
        院友列表: validPatientItems
      };

      // 調用匯出函數
      await exportCombinedScheduleToExcel(validSchedule);
    } catch (error) {
      console.error('匯出失敗:', error);
      alert('匯出失敗，請檢查資料是否完整後重試');
    }
  };

  // 進階搜索邏輯
  const filteredSchedules = schedules.filter(schedule => {
    if (dateFilter && schedule.到診日期 !== dateFilter) {
      return false;
    }
    if (reasonFilter && !schedule.院友列表.some(item => 
      item.reasons?.some(reason => reason.原因名稱 === reasonFilter)
    )) {
      return false;
    }
    
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const dateMatch = new Date(schedule.到診日期).toLocaleDateString('zh-TW').includes(searchLower);
      const patientMatch = schedule.院友列表.some(item => {
        const patient = patientMap.get(item.院友id);
        return (
          patient?.中文姓氏?.toLowerCase().includes(searchLower) ||
          patient?.中文名字?.toLowerCase().includes(searchLower) ||
          patient?.床號?.toLowerCase().includes(searchLower) ||
          patient?.英文姓氏?.toLowerCase().includes(searchLower) ||
          patient?.英文名字?.toLowerCase().includes(searchLower) ||
          item.症狀說明?.toLowerCase().includes(searchLower) ||
          item.備註?.toLowerCase().includes(searchLower) ||
          item.reasons?.some(reason => reason.原因名稱.toLowerCase().includes(searchLower))
        );
      });
      matchesSearch = dateMatch || patientMatch;
    }
    return matchesSearch;
  });

  // 獲取所有看診原因選項
  const getAllReasons = () => {
    const reasons = new Set<string>();
    schedules.forEach(schedule => {
      schedule.院友列表.forEach(item => {
        item.reasons?.forEach(reason => {
          reasons.add(reason.原因名稱);
        });
      });
    });
    return Array.from(reasons).sort();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setReasonFilter('');
  };

  const hasActiveFilters = () => {
    return searchTerm || dateFilter || reasonFilter;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">VMO排程</h1>
        <button
          onClick={() => {
            setSelectedSchedule(null);
            setShowScheduleModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>新增排程</span>
        </button>
      </div>

      {/* 搜索和篩選區域 */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索排程日期、院友姓名、床號、症狀說明或看診原因..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="form-input lg:w-40"
              title="按日期篩選"
            />
            
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`btn-secondary flex items-center space-x-2 ${
                showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''
              } ${hasActiveFilters() ? 'border-blue-300' : ''}`}
            >
              <Filter className="h-4 w-4" />
              <span>進階篩選</span>
              {hasActiveFilters() && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  已套用
                </span>
              )}
            </button>
            
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
                <span>清除</span>
              </button>
            )}
          </div>
        </div>
        
        {showAdvancedFilters && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">進階篩選</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">看診原因</label>
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="form-input"
                >
                  <option value="">所有原因</option>
                  {getAllReasons().map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            顯示 {filteredSchedules.length} / {schedules.length} 個排程
            {filteredSchedules.reduce((sum, s) => sum + s.院友列表.length, 0) !== schedules.reduce((sum, s) => sum + s.院友列表.length, 0) && 
              ` (${filteredSchedules.reduce((sum, s) => sum + s.院友列表.length, 0)} / ${schedules.reduce((sum, s) => sum + s.院友列表.length, 0)} 位院友)`
            }
          </span>
          {hasActiveFilters() && (
            <span className="text-blue-600">已套用篩選條件</span>
          )}
        </div>
      </div>

      {/* 到期提醒區域 */}
      {dueItems.length > 0 && (
        <div className="card p-0 overflow-hidden border border-red-200">
          <div className="bg-red-100/80 backdrop-blur-sm">
            <div className="divide-y divide-red-200">
              {dueItems.map((item, index) => {
                // 每行顯示兩個提醒
                if (index % 2 === 0) {
                  const nextItem = dueItems[index + 1];
                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-red-200">
                      <div
                        className="px-4 py-3 hover:bg-red-200/60 cursor-pointer transition-colors text-sm text-red-800"
                        onClick={() => {
                          // TODO: 點擊可快速創建該院友的排程
                          console.log('創建排程:', item);
                        }}
                      >
                        {item.displayText}
                      </div>
                      {nextItem && (
                        <div
                          className="px-4 py-3 hover:bg-red-200/60 cursor-pointer transition-colors text-sm text-red-800"
                          onClick={() => {
                            // TODO: 點擊可快速創建該院友的排程
                            console.log('創建排程:', nextItem);
                          }}
                        >
                          {nextItem.displayText}
                        </div>
                      )}
                      {!nextItem && <div className="hidden md:block"></div>}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {filteredSchedules.length > 0 ? (
          filteredSchedules.map(schedule => (
            <div key={schedule.排程id} className="card p-6">
              <div 
                className="cursor-pointer" 
                onDoubleClick={() => handleEdit(schedule)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {new Date(schedule.到診日期).toLocaleDateString('zh-TW', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long'
                        })}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {schedule.院友列表.length} 位院友預約
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewDetails(schedule)}
                      className="btn-secondary flex items-center space-x-1"
                    >
                      <Settings className="h-4 w-4" />
                      <span>管理院友</span>
                    </button>
                    <button
                      onClick={() => handleDownloadForm(schedule)}
                      className="btn-secondary flex items-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>下載表格</span>
                    </button>
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="btn-secondary flex items-center space-x-1"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>編輯</span>
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.排程id)}
                      className="btn-danger flex items-center space-x-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>刪除</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {schedule.院友列表.map(item => {
                  const patient = patientMap.get(item.院友id);
                  return (
                    <div key={item.細項id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                          {patient?.院友相片 ? (
                            <img 
                              src={patient.院友相片} 
                              alt={`${patient.中文姓氏}${patient.中文名字}`} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium text-gray-900">
                              {patient ? `${patient.中文姓氏}${patient.中文名字}` : '院友資料未找到'}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {patient?.床號 || '床號未知'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {patient ? getFormattedEnglishName(patient) : '英文姓名未知'}
                          </p>
                          {patient && (
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div className="flex items-center space-x-3">
                                <span>{patient.性別}</span>
                                <span>
                                  {patient.出生日期 ? 
                                    `${new Date().getFullYear() - new Date(patient.出生日期).getFullYear()}歲` : 
                                    '年齡未知'
                                  }
                                </span>
                                <span className="text-gray-400">|</span>
                                <span>{patient.出生日期 ? new Date(patient.出生日期).toLocaleDateString('zh-TW') : '出生日期未知'}</span>
                              </div>
                              <div>
                                <span className="font-mono">{patient.身份證號碼 || '身份證號碼未知'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-900 mb-1">
                            {item.reasons && Array.isArray(item.reasons) && item.reasons.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-end">
                                {item.reasons.map((reason: any, index: number) => (
                                  <span key={index} className={getReasonBadgeClass(reason.原因名稱)}>
                                    <span className="mr-1">{getReasonIcon(reason.原因名稱)}</span>
                                    {reason.原因名稱}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">未指定原因</span>
                            )}
                          </p>
                          {item.症狀說明 && (
                            <p className="text-xs text-gray-600 mb-1">症狀: {item.症狀說明}</p>
                          )}
                          {item.備註 && (
                            <p className="text-xs text-gray-500">備註: {item.備註}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : schedules.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無排程</h3>
            <p className="text-gray-600 mb-4">開始新增醫生到診排程</p>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="btn-primary"
            >
              新增排程
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">找不到符合條件的排程</h3>
            <p className="text-gray-600 mb-4">請嘗試調整搜索條件或篩選設定</p>
            <button
              onClick={clearFilters}
              className="btn-secondary"
            >
              清除所有篩選
            </button>
          </div>
        )}
      </div>

      {showScheduleModal && (
        <ScheduleModal
          schedule={selectedSchedule}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedSchedule(null);
          }}
          onUpdate={refreshData}
          onDelete={deleteSchedule}
        />
      )}

      {showDetailModal && selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSchedule(null);
          }}
          onUpdate={async () => {
            await refreshData();
            const updatedSchedules = schedules;
            const updatedSchedule = updatedSchedules.find(s => s.排程id === selectedSchedule.排程id);
            if (updatedSchedule) {
              setSelectedSchedule(updatedSchedule);
            }
          }}
        />
      )}

      {showPatientModal && selectedScheduleId && (
        <PatientSelectModal
          scheduleId={selectedScheduleId}
          onClose={() => {
            setShowPatientModal(false);
            setSelectedScheduleId(null);
          }}
          onUpdate={refreshData}
        />
      )}
    </div>
  );
};

export default Scheduling;