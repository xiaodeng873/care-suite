import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Pill, Calendar, Clock, User, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WorkflowDuplicateGroup {
  key: string;
  prescription_id: string;
  scheduled_date: string;
  scheduled_time: string;
  records: WorkflowRecord[];
}

interface WorkflowRecord {
  id: string;
  patient_id: number;
  prescription_id: string;
  scheduled_date: string;
  scheduled_time: string;
  preparation_status: string;
  verification_status: string;
  dispensing_status: string;
  created_at: string;
  updated_at: string;
}

interface Patient {
  院友id: number;
  中文姓氏: string;
  中文名字: string;
  床號: string;
}

interface Prescription {
  id: string;
  medication_name: string;
}

interface WorkflowDeduplicateModalProps {
  onClose: () => void;
  patients: Patient[];
  prescriptions: Prescription[];
  onSuccess: () => void;
}

const WorkflowDeduplicateModal: React.FC<WorkflowDeduplicateModalProps> = ({
  onClose,
  patients,
  prescriptions,
  onSuccess
}) => {
  const [duplicateGroups, setDuplicateGroups] = useState<WorkflowDuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    findDuplicates();
  }, []);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const { data: records, error } = await supabase
        .from('medication_workflow_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      if (!records || records.length === 0) {
        setDuplicateGroups([]);
        setLoading(false);
        return;
      }

      const groupMap = new Map<string, WorkflowRecord[]>();

      records.forEach((record) => {
        const key = `${record.prescription_id}_${record.scheduled_date}_${record.scheduled_time}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(record);
      });

      const duplicates: WorkflowDuplicateGroup[] = [];
      groupMap.forEach((records, key) => {
        if (records.length > 1) {
          records.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );

          duplicates.push({
            key,
            prescription_id: records[0].prescription_id,
            scheduled_date: records[0].scheduled_date,
            scheduled_time: records[0].scheduled_time,
            records
          });
        }
      });

      duplicates.sort((a, b) =>
        new Date(b.records[0].updated_at).getTime() - new Date(a.records[0].updated_at).getTime()
      );

      setDuplicateGroups(duplicates);
      setSelectedGroups(new Set(duplicates.map(g => g.key)));
    } catch (error) {
      console.error('查詢重複記錄失敗:', error);
      alert('查詢重複記錄失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedGroups.size === 0) {
      alert('請至少選擇一組重複記錄');
      return;
    }

    if (!confirm(`確定要刪除 ${getTotalDuplicatesCount()} 筆重複記錄嗎？\n\n每組將保留最後更新的記錄，刪除其他重複項。`)) {
      return;
    }

    setDeleting(true);
    try {
      const idsToDelete: string[] = [];

      duplicateGroups.forEach(group => {
        if (selectedGroups.has(group.key)) {
          group.records.slice(1).forEach(record => {
            idsToDelete.push(record.id);
          });
        }
      });

      if (idsToDelete.length === 0) {
        alert('沒有需要刪除的記錄');
        setDeleting(false);
        return;
      }

      const { error } = await supabase
        .from('medication_workflow_records')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      alert(`成功刪除 ${idsToDelete.length} 筆重複記錄！`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('刪除重複記錄失敗:', error);
      alert('刪除重複記錄失敗，請重試');
    } finally {
      setDeleting(false);
    }
  };

  const toggleGroup = (groupKey: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupKey)) {
      newSelected.delete(groupKey);
    } else {
      newSelected.add(groupKey);
    }
    setSelectedGroups(newSelected);
  };

  const selectAll = () => {
    setSelectedGroups(new Set(duplicateGroups.map(g => g.key)));
  };

  const deselectAll = () => {
    setSelectedGroups(new Set());
  };

  const getTotalDuplicatesCount = () => {
    return duplicateGroups
      .filter(g => selectedGroups.has(g.key))
      .reduce((sum, g) => sum + (g.records.length - 1), 0);
  };

  const getPatientName = (patientId: number) => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient ? `${patient.中文姓氏}${patient.中文名字}` : '未知';
  };

  const getPatientBed = (patientId: number) => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient?.床號 || '-';
  };

  const getMedicationName = (prescriptionId: string) => {
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    return prescription?.medication_name || '未知藥物';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; className: string } } = {
      pending: { label: '待處理', className: 'bg-gray-100 text-gray-800' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
      failed: { label: '失敗', className: 'bg-red-100 text-red-800' }
    };
    const config = statusMap[status] || statusMap.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="text-lg">正在檢測重複記錄...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  藥物工作流程重複記錄檢測
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {duplicateGroups.length === 0
                    ? '未檢測到重複記錄'
                    : `檢測到 ${duplicateGroups.length} 組重複記錄，共 ${duplicateGroups.reduce((sum, g) => sum + (g.records.length - 1), 0)} 筆需要清理`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {duplicateGroups.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  全選
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  取消全選
                </button>
                <span className="text-sm text-gray-600 ml-4">
                  已選擇 {selectedGroups.size} / {duplicateGroups.length} 組
                  （將刪除 {getTotalDuplicatesCount()} 筆重複記錄）
                </span>
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting || selectedGroups.size === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deleting ? '刪除中...' : '刪除重複記錄'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Pill className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">沒有重複記錄</h3>
              <p className="text-gray-600">
                藥物工作流程記錄中沒有檢測到重複項目
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => (
                <div
                  key={group.key}
                  className={`border rounded-lg p-4 ${
                    selectedGroups.has(group.key)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  } transition-all`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(group.key)}
                        onChange={() => toggleGroup(group.key)}
                        className="mt-1 h-4 w-4 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Pill className="h-5 w-5 text-blue-600" />
                          <span className="font-semibold text-gray-900">
                            {getMedicationName(group.prescription_id)}
                          </span>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>{group.scheduled_date}</span>
                            <Clock className="h-4 w-4 ml-2" />
                            <span>{group.scheduled_time}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <User className="h-4 w-4" />
                          <span>
                            {getPatientName(group.records[0].patient_id)} (床號: {getPatientBed(group.records[0].patient_id)})
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      {group.records.length} 筆重複
                    </div>
                  </div>

                  <div className="ml-7 space-y-2">
                    {group.records.map((record, index) => (
                      <div
                        key={record.id}
                        className={`p-3 rounded-lg border ${
                          index === 0
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {index === 0 ? (
                              <span className="text-xs font-semibold text-green-700 bg-green-200 px-2 py-1 rounded">
                                保留此筆
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-red-700 bg-red-200 px-2 py-1 rounded">
                                將刪除
                              </span>
                            )}
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(record.preparation_status)}
                              {getStatusBadge(record.verification_status)}
                              {getStatusBadge(record.dispensing_status)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            更新: {new Date(record.updated_at).toLocaleString('zh-TW')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDeduplicateModal;
