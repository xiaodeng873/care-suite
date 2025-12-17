import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  CheckSquare, 
  AlertTriangle, 
  Search, 
  Filter, 
  Calendar,
  User,
  Pill,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

interface TaskFilters {
  searchTerm: string;
  taskType: 'all' | 'preparation' | 'verification' | 'dispensing';
  status: 'all' | 'pending' | 'overdue';
  patientName: string;
  medicationName: string;
}

const StaffWorkPanel: React.FC = () => {
  const { 
    patients, 
    prescriptions, 
    prescriptionWorkflowRecords,
    fetchPrescriptionWorkflowRecords,
    loading 
  } = usePatients();
  const { displayName } = useAuth();

  const [filters, setFilters] = useState<TaskFilters>({
    searchTerm: '',
    taskType: 'all',
    status: 'pending',
    patientName: '',
    medicationName: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 載入今天的所有工作流程記錄
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetchPrescriptionWorkflowRecords(undefined, today);
  }, [fetchPrescriptionWorkflowRecords]);

  // 獲取今天的工作流程記錄
  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return prescriptionWorkflowRecords.filter(r => r.scheduled_date === today);
  }, [prescriptionWorkflowRecords]);

  // 生成待辦任務列表
  const pendingTasks = useMemo(() => {
    const tasks: any[] = [];

    todayRecords.forEach(record => {
      const patient = patients.find(p => p.院友id === record.patient_id);
      const prescription = prescriptions.find(p => p.id === record.prescription_id);

      if (!patient || !prescription) return;

      // 檢查執藥任務
      if (record.preparation_status === 'pending') {
        tasks.push({
          id: `${record.id}-preparation`,
          recordId: record.id,
          type: 'preparation',
          label: '執藥',
          patient,
          prescription,
          scheduledTime: record.scheduled_time,
          priority: 1,
          canExecute: true
        });
      }

      // 檢查核藥任務
      if (record.preparation_status === 'completed' && record.verification_status === 'pending') {
        tasks.push({
          id: `${record.id}-verification`,
          recordId: record.id,
          type: 'verification',
          label: '核藥',
          patient,
          prescription,
          scheduledTime: record.scheduled_time,
          priority: 2,
          canExecute: true
        });
      }

      // 檢查派藥任務
      if (record.verification_status === 'completed' && record.dispensing_status === 'pending') {
        const now = new Date();
        const scheduledDateTime = new Date(`${record.scheduled_date}T${record.scheduled_time}`);
        const isOverdue = scheduledDateTime < now;

        tasks.push({
          id: `${record.id}-dispensing`,
          recordId: record.id,
          type: 'dispensing',
          label: '派藥',
          patient,
          prescription,
          scheduledTime: record.scheduled_time,
          priority: isOverdue ? 0 : 3, // 逾期任務優先級最高
          canExecute: true,
          isOverdue
        });
      }
    });

    return tasks.sort((a, b) => a.priority - b.priority);
  }, [todayRecords, patients, prescriptions]);

  // 篩選任務
  const filteredTasks = useMemo(() => {
    return pendingTasks.filter(task => {
      // 任務類型篩選
      if (filters.taskType !== 'all' && task.type !== filters.taskType) {
        return false;
      }

      // 狀態篩選
      if (filters.status === 'overdue' && !task.isOverdue) {
        return false;
      }
      if (filters.status === 'pending' && task.isOverdue) {
        return false;
      }

      // 院友姓名篩選
      if (filters.patientName && !task.patient.中文姓名.toLowerCase().includes(filters.patientName.toLowerCase())) {
        return false;
      }

      // 藥物名稱篩選
      if (filters.medicationName && !task.prescription.medication_name.toLowerCase().includes(filters.medicationName.toLowerCase())) {
        return false;
      }

      // 搜索條件
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          task.patient.中文姓氏.toLowerCase().includes(searchLower) ||
          task.patient.中文名字.toLowerCase().includes(searchLower) ||
          task.patient.床號.toLowerCase().includes(searchLower) ||
          task.prescription.medication_name.toLowerCase().includes(searchLower) ||
          task.label.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [pendingTasks, filters]);

  // 更新篩選條件
  const updateFilter = (field: keyof TaskFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 清除篩選
  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      taskType: 'all',
      status: 'pending',
      patientName: '',
      medicationName: ''
    });
  };

  // 刷新數據
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await fetchPrescriptionWorkflowRecords(undefined, today);
    } catch (error) {
      console.error('刷新數據失敗:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 獲取任務類型顏色
  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'preparation':
        return 'bg-blue-100 text-blue-800';
      case 'verification':
        return 'bg-yellow-100 text-yellow-800';
      case 'dispensing':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 獲取任務類型圖標
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'preparation':
        return <Pill className="h-4 w-4" />;
      case 'verification':
        return <CheckSquare className="h-4 w-4" />;
      case 'dispensing':
        return <Users className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== '' && value !== 'all' && value !== 'pending');
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

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">職員工作面板</h1>
            <p className="text-sm text-gray-600 mt-1">
              {displayName ? `${displayName} 的工作任務` : '今日待處理的藥物工作任務'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {/* 統計概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">總待辦任務</p>
              <p className="text-2xl font-bold text-gray-900">{filteredTasks.length}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">執藥任務</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredTasks.filter(t => t.type === 'preparation').length}
              </p>
            </div>
            <Pill className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">核藥任務</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filteredTasks.filter(t => t.type === 'verification').length}
              </p>
            </div>
            <CheckSquare className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">派藥任務</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredTasks.filter(t => t.type === 'dispensing').length}
              </p>
              {filteredTasks.filter(t => t.type === 'dispensing' && t.isOverdue).length > 0 && (
                <p className="text-xs text-red-600">
                  {filteredTasks.filter(t => t.type === 'dispensing' && t.isOverdue).length} 個逾期
                </p>
              )}
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* 篩選控制 */}
      <div className="sticky top-16 bg-white z-20 shadow-sm">
        <div className="card p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4 lg:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友姓名、床號、藥物名稱或任務類型..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  className="form-input pl-10"
                />
              </div>

              <div className="flex space-x-2">
                <select
                  value={filters.taskType}
                  onChange={(e) => updateFilter('taskType', e.target.value)}
                  className="form-input"
                >
                  <option value="all">所有任務</option>
                  <option value="preparation">執藥</option>
                  <option value="verification">核藥</option>
                  <option value="dispensing">派藥</option>
                </select>

                <select
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="form-input"
                >
                  <option value="all">所有狀態</option>
                  <option value="pending">待處理</option>
                  <option value="overdue">逾期</option>
                </select>

                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`btn-secondary flex items-center space-x-2 ${
                    showAdvancedFilters ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>進階篩選</span>
                </button>

                {hasActiveFilters() && (
                  <button
                    onClick={clearFilters}
                    className="btn-secondary text-red-600 hover:text-red-700"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">院友姓名</label>
                    <input
                      type="text"
                      value={filters.patientName}
                      onChange={(e) => updateFilter('patientName', e.target.value)}
                      className="form-input"
                      placeholder="搜索院友姓名..."
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">藥物名稱</label>
                    <input
                      type="text"
                      value={filters.medicationName}
                      onChange={(e) => updateFilter('medicationName', e.target.value)}
                      className="form-input"
                      placeholder="搜索藥物名稱..."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>顯示 {filteredTasks.length} 個待辦任務</span>
              {hasActiveFilters() && (
                <span className="text-blue-600">已套用篩選條件</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 任務列表 */}
      <div className="space-y-4">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className={`card p-4 transition-all duration-200 hover:shadow-md ${
                task.isOverdue ? 'border-l-4 border-red-500 bg-red-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* 任務類型標籤 */}
                  <div className={`p-2 rounded-lg ${getTaskTypeColor(task.type)}`}>
                    {getTaskTypeIcon(task.type)}
                  </div>

                  {/* 任務詳情 */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTaskTypeColor(task.type)}`}>
                        {task.label}
                      </span>
                      {task.isOverdue && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          逾期
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1">
                      <div className="font-medium text-gray-900">
                        {task.patient.床號} - {task.patient.中文姓氏}{task.patient.中文名字}
                      </div>
                      <div className="text-sm text-gray-600">
                        {task.prescription.medication_name} | {task.scheduledTime}
                      </div>
                      {task.prescription.dosage_amount && (
                        <div className="text-xs text-gray-500">
                          劑量: {task.prescription.dosage_amount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/medication-workflow?patient=${task.patient.院友id}&date=${new Date().toISOString().split('T')[0]}`}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <span>前往處理</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <CheckSquare className="h-24 w-24 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {hasActiveFilters() ? '找不到符合條件的任務' : '暫無待辦任務'}
            </h3>
            <p className="text-gray-600">
              {hasActiveFilters() ? '請嘗試調整篩選條件' : '所有藥物工作流程任務都已完成'}
            </p>
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="btn-secondary mt-4"
              >
                清除所有篩選
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffWorkPanel;