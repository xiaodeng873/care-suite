import React, { useState, useEffect } from 'react';
import { X, Trash2, RotateCcw, Search, Calendar, User, Activity, AlertTriangle } from 'lucide-react';
import { usePatients, DeletedHealthRecord, Patient } from '../context/PatientContext';

interface RecycleBinModalProps {
  onClose: () => void;
}

const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ onClose }) => {
  const { deletedHealthRecords, fetchDeletedHealthRecords, restoreHealthRecord, permanentlyDeleteHealthRecord, patients } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      try {
        await fetchDeletedHealthRecords();
      } catch (error) {
        console.error('Error loading deleted records:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, []);

  const getPatientInfo = (patientId: number) => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient
      ? { name: `${patient.中文姓氏}${patient.中文名字}`, bed: patient.床號 }
      : { name: '未知', bed: '-' };
  };

  const formatRecordValues = (record: DeletedHealthRecord) => {
    const values: string[] = [];
    if (record.血壓收縮壓 && record.血壓舒張壓) {
      values.push(`血壓: ${record.血壓收縮壓}/${record.血壓舒張壓} mmHg`);
    }
    if (record.脈搏) values.push(`脈搏: ${record.脈搏} /min`);
    if (record.體溫) values.push(`體溫: ${record.體溫}°C`);
    if (record.呼吸頻率) values.push(`呼吸: ${record.呼吸頻率} /min`);
    if (record.血含氧量) values.push(`血氧: ${record.血含氧量}%`);
    if (record.血糖值) values.push(`血糖: ${record.血糖值} mmol/L`);
    if (record.體重) values.push(`體重: ${record.體重} kg`);
    return values.length > 0 ? values.join(', ') : '无数值';
  };

  const filteredRecords = deletedHealthRecords.filter(record => {
    if (!searchTerm) return true;
    const patientInfo = getPatientInfo(record.院友id);
    return (
      patientInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patientInfo.bed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.記錄類型.includes(searchTerm) ||
      record.deletion_reason?.includes(searchTerm)
    );
  });

  const handleSelectRecord = (id: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecords(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleRestore = async (recordId: string) => {
    setIsRestoring(true);
    try {
      await restoreHealthRecord(recordId);
      setSelectedRecords(new Set()); // 清空选择
      alert('恢复成功！');
    } catch (error) {
      console.error('Error restoring record:', error);
      alert('恢复失败，请重试');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedRecords.size === 0) return;

    if (!confirm(`确定要恢复选中的 ${selectedRecords.size} 条记录吗？`)) {
      return;
    }

    setIsRestoring(true);
    try {
      for (const recordId of Array.from(selectedRecords)) {
        await restoreHealthRecord(recordId);
      }
      setSelectedRecords(new Set());
      alert(`成功恢复 ${selectedRecords.size} 条记录！`);
    } catch (error) {
      console.error('Error batch restoring records:', error);
      alert('批量恢复失败，请重试');
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async (recordId: string) => {
    if (!confirm('确定要永久删除这条记录吗？此操作无法撤销！')) {
      return;
    }

    setIsDeleting(true);
    try {
      await permanentlyDeleteHealthRecord(recordId);
      setSelectedRecords(new Set()); // 清空选择
      alert('永久删除成功！');
    } catch (error) {
      console.error('Error permanently deleting record:', error);
      alert('永久删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedRecords.size === 0) return;

    if (
      !confirm(
        `确定要永久删除选中的 ${selectedRecords.size} 条记录吗？\n\n此操作无法撤销！`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      for (const recordId of Array.from(selectedRecords)) {
        await permanentlyDeleteHealthRecord(recordId);
      }
      setSelectedRecords(new Set());
      alert(`成功永久删除 ${selectedRecords.size} 条记录！`);
    } catch (error) {
      console.error('Error batch permanently deleting records:', error);
      alert('批量永久删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Trash2 className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">回收筒</h2>
                <p className="text-sm text-gray-600 mt-1">
                  共 {deletedHealthRecords.length} 条已删除记录
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索院友姓名、床号、记录类型或删除原因..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
              >
                {selectedRecords.size === filteredRecords.length ? '取消全选' : '全选'}
              </button>
              {selectedRecords.size > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleBatchRestore}
                    disabled={isRestoring}
                    className="text-sm text-green-600 hover:text-green-700 font-medium whitespace-nowrap flex items-center space-x-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>批量恢复 ({selectedRecords.size})</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleBatchPermanentDelete}
                    disabled={isDeleting}
                    className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap flex items-center space-x-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>批量永久删除 ({selectedRecords.size})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">加载中...</p>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Trash2 className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-600 text-lg">
                {searchTerm ? '没有找到匹配的记录' : '回收筒为空'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
                >
                  清除搜索
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => {
                const patientInfo = getPatientInfo(record.院友id);
                const isSelected = selectedRecords.has(record.id);

                return (
                  <div
                    key={record.id}
                    className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRecord(record.id)}
                        className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3 flex-wrap">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{patientInfo.name}</span>
                              <span className="text-sm text-gray-500">({patientInfo.bed})</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              record.記錄類型 === '生命表徵'
                                ? 'bg-blue-100 text-blue-800'
                                : record.記錄類型 === '血糖控制'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {record.記錄類型}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRestore(record.id)}
                              disabled={isRestoring}
                              className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"
                              title="恢复"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(record.id)}
                              disabled={isDeleting}
                              className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50"
                              title="永久删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span>记录日期: {new Date(record.記錄日期).toLocaleDateString('zh-TW')}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Activity className="h-3 w-3 text-gray-400" />
                            <span>记录时间: {record.記錄時間}</span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">数值: </span>
                          {formatRecordValues(record)}
                        </div>

                        <div className="text-xs text-gray-500 space-y-1">
                          <div>删除原因: {record.deletion_reason}</div>
                          <div>
                            删除时间: {new Date(record.deleted_at).toLocaleString('zh-TW')}
                          </div>
                          {record.deleted_by && <div>删除人: {record.deleted_by}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
              <AlertTriangle className="h-4 w-4" />
              <span>永久删除的记录无法恢复，请谨慎操作</span>
            </div>
            <button onClick={onClose} className="btn-secondary">
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecycleBinModal;
