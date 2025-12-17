import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import PatientTooltip from './PatientTooltip';
import { getReasonBadgeClass } from '../utils/reasonColors';
import { supabase } from '../lib/supabase'; 

interface ScheduleDetailModalProps {
  schedule: db.ScheduleWithDetails;
  onClose: () => void;
  onUpdate?: () => void;
}

const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  schedule,
  onClose,
  onUpdate
}) => {
  const [patientItems, setPatientItems] = useState<db.ScheduleDetail[]>([]);
  const [allReasons, setAllReasons] = useState<db.ServiceReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [newPatientId, setNewPatientId] = useState<string>('');

  const { patients, serviceReasons, addPatientToSchedule, updateScheduleDetail, deleteScheduleDetail } = usePatients();

  useEffect(() => {
    if (schedule?.排程id) {
      loadScheduleData();
    }
  }, [schedule?.排程id]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      setError('');
      setAllReasons(serviceReasons);
      setPatientItems(schedule.院友列表);
    } catch (err) {
      console.error('載入排程資料失敗:', err);
      setError(err instanceof Error ? err.message : '載入資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const reloadScheduleData = async () => {
    try {
      const { data, error } = await supabase
        .from('看診院友細項')
        .select(`
          *,
          院友主表(中文姓名, 床號),
          到診院友_看診原因(
            看診原因選項(原因id, 原因名稱)
          )
        `)
        .eq('排程id', schedule.排程id);
      
      if (error) throw error;
      
      const updatedItems = (data || []).map(item => ({
        ...item,
        reasons: item.到診院友_看診原因?.map(r => r.看診原因選項) || []
      }));
      
      setPatientItems(updatedItems);
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('重新載入排程數據失敗:', error);
    }
  };

  const addPatientToScheduleHandler = async () => {
    if (!newPatientId) {
      alert('請選擇院友');
      return;
    }

    try {
      const existingItem = patientItems.find(item => item.院友id.toString() === newPatientId);
      if (existingItem) {
        alert('此院友已在排程中');
        return;
      }

      await addPatientToSchedule(schedule.排程id, parseInt(newPatientId), '', '', []);
      setNewPatientId('');
      await reloadScheduleData();
      onUpdate?.();
    } catch (err) {
      console.error('新增院友失敗:', err);
      alert(`新增院友失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const removePatientFromSchedule = async (細項id: number) => {
    if (!confirm('確定要移除此院友嗎？')) return;

    try {
      await deleteScheduleDetail(細項id);
      await reloadScheduleData();
      onUpdate?.();
    } catch (err) {
      console.error('移除院友失敗:', err);
      alert(`移除院友失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const updatePatientDetail = async (細項id: number, field: '症狀說明' | '備註', value: string) => {
    try {
      const item = patientItems.find(item => item.細項id === 細項id);
      if (!item) return;
      
      const reasonIds = item.reasons?.map(r => r.原因id) || [];
      await updateScheduleDetail({
        細項id,
        症狀說明: field === '症狀說明' ? value : item.症狀說明 || '',
        備註: field === '備註' ? value : item.備註 || '',
        reasonIds
      });
      
      await reloadScheduleData();
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      console.error(`更新${field}失敗:`, err);
      alert(`更新${field}失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const updatePatientReasons = async (細項id: number, selectedReasonIds: number[]) => {
    try {

      if (!selectedReasonIds || selectedReasonIds.length === 0) {

      }
      const item = patientItems.find(item => item.細項id === 細項id);
      if (!item) {
        console.error('找不到對應的院友細項，細項id:', 細項id);
        return;
      }
      
      const result = await updateScheduleDetail({
        細項id,
        症狀說明: item.症狀說明 || '',
        備註: item.備註 || '',
        reasonIds: selectedReasonIds
      });

      if (result.error) {
        console.error('更新失敗，錯誤:', result.error.message);
        throw new Error(result.error.message);
      }
      
      await reloadScheduleData();
      if (onUpdate) {
        await onUpdate();
      }

    } catch (err) {
      console.error('更新看診原因失敗:', err);
      alert(`更新看診原因失敗: ${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const handleReasonToggle = (細項id: number, reasonId: number) => {
    const item = patientItems.find(item => item.細項id === 細項id);
    if (!item) return;

    const currentReasonIds = item.reasons?.map(r => r.原因id) || [];
    const newReasonIds = currentReasonIds.includes(reasonId)
      ? currentReasonIds.filter(id => id !== reasonId)
      : [...currentReasonIds, reasonId];

    setPatientItems(prev => prev.map(prevItem => 
      prevItem.細項id === 細項id 
        ? { 
            ...prevItem, 
            reasons: newReasonIds.map(id => ({ 原因id: id, 原因名稱: allReasons.find(r => r.原因id === id)?.原因名稱 || '' }))
          }
        : prevItem
    ));
    
    updatePatientReasons(細項id, newReasonIds);
  };

  const submitChanges = async () => {
    try {
      setLoading(true);
      for (const item of patientItems) {
        const reasonIds = item.reasons?.map(r => r.原因id) || [];
        await updateScheduleDetail({
          細項id: item.細項id,
          症狀說明: item.症狀說明 || '',
          備註: item.備註 || '',
          reasonIds
        });
      }
      if (onUpdate) {
        await onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('提交變更失敗:', err);
      setError(err instanceof Error ? err.message : '提交變更失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-700">載入中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              VMO 排程詳情 - {new Date(schedule.到診日期).toLocaleDateString('zh-TW')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="border-t border-gray-200 pt-4 relative z-10">
            <h3 className="text-lg font-medium text-gray-900 mb-3">新增院友到排程</h3>
            <div className="flex space-x-3 relative">
              <div className="flex-1">
                <PatientAutocomplete
                  value={newPatientId}
                  onChange={setNewPatientId}
                  placeholder="搜索院友..."
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
              </div>
              <button
                onClick={addPatientToScheduleHandler}
                disabled={!newPatientId}
                className="btn-primary flex items-center space-x-2 whitespace-nowrap relative z-20 pointer-events-auto"
              >
                <Plus className="h-4 w-4" />
                <span>新增</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              排程院友 ({patientItems.length})
            </h3>

            {patientItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>尚未新增任何院友到此排程</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientItems.map((item) => {
                  const patient = patients.find(p => p.院友id === item.院友id);
                  return (
                    <div key={item.細項id} className="card p-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                          {patient?.院友相片 ? (
                            <img 
                              src={patient.院友相片} 
                              alt={`${patient.中文姓氏}${patient.中文名字}`} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-8 w-8 text-gray-400" />
                          )}
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              {patient ? (
                                <PatientTooltip patient={patient}>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                      {patient.床號}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {patient.中文姓氏}{patient.中文名字}
                                    </span>
                                    {(patient.英文姓氏 || patient.英文名字) && (
                                      <span className="text-sm text-gray-600">
                                        ({patient.英文姓氏} {patient.英文名字})
                                      </span>
                                    )}
                                  </div>
                                </PatientTooltip>
                              ) : (
                                <span className="text-red-600">院友資料載入失敗 (ID: {item.院友id})</span>
                              )}
                            </div>
                            <button
                              onClick={() => removePatientFromSchedule(item.細項id)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="移除院友"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div>
                            <label className="form-label">看診原因</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {allReasons.map((reason) => {
                                const isSelected = item.reasons?.some(r => r.原因id === reason.原因id);
                                return (
                                  <button
                                    key={reason.原因id}
                                    onClick={() => handleReasonToggle(item.細項id, reason.原因id)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                                      isSelected 
                                        ? getReasonBadgeClass(reason.原因名稱)
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {reason.原因名稱}
                                  </button>
                                );
                              })}
                            </div>
                            {item.reasons?.length === 0 && (
                              <p className="text-sm text-gray-500 mt-2">請選擇看診原因</p>
                            )}
                          </div>

                          {item.reasons?.some(r => r.原因名稱 === '申訴不適') && (
                            <div>
                              <label className="form-label">症狀說明</label>
                              <textarea 
                                value={item.症狀說明 || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (item.症狀說明 || '')) {
                                    updatePatientDetail(item.細項id, '症狀說明', e.target.value);
                                  }
                                }}
                                onChange={(e) => {
                                  setPatientItems(prev => prev.map(prevItem => 
                                    prevItem.細項id === item.細項id 
                                      ? { ...prevItem, 症狀說明: e.target.value }
                                      : prevItem
                                  ));
                                }}
                                className="form-input"
                                rows={1}
                                placeholder="請描述院友症狀..."
                              />
                            </div>
                          )}

                          <div>
                            <label className="form-label">備註</label>
                            <textarea
                              value={item.備註 || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (item.備註 || '')) {
                                  updatePatientDetail(item.細項id, '備註', e.target.value);
                                }
                              }}
                              onChange={(e) => {
                                setPatientItems(prev => prev.map(prevItem => 
                                  prevItem.細項id === item.細項id 
                                    ? { ...prevItem, 備註: e.target.value }
                                    : prevItem
                                ));
                              }}
                              className="form-input"
                              rows={1}
                              placeholder="其他備註資訊..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={reloadScheduleData}
            className="btn-secondary"
          >
            重新載入
          </button>
          <button
            type="button"
            onClick={submitChanges}
            className="btn-primary"
          >
            確認
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="btn-secondary"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailModal;