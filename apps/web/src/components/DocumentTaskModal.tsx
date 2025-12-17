import React, { useState } from 'react';
import { X, FileText, Calendar, User, CheckCircle } from 'lucide-react';

interface HealthTask {
  id: string;
  patient_id: string;
  health_record_type: string;
  notes?: string;
  next_due_at: string;
  last_completed_at?: string;
}

interface Patient {
  院友id: string;
  中文姓名: string;
  床號: string;
  院友相片?: string;
}

interface DocumentTaskModalProps {
  task: HealthTask;
  patient: Patient;
  onClose: () => void;
  onTaskCompleted: (taskId: string, completionDate: string, nextDueDate: string, tubeType?: string, tubeSize?: string) => void;
}

const DocumentTaskModal: React.FC<DocumentTaskModalProps> = ({
  task,
  patient,
  onClose,
  onTaskCompleted
}) => {
  const [signatureDate, setSignatureDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [tubeType, setTubeType] = useState(task.tube_type || '');
  const [tubeSize, setTubeSize] = useState(task.tube_size || '');
  const [nextDueDate, setNextDueDate] = useState('');

  // 計算下次到期日期
  const calculateNextDueDate = (completionDate: string, tubeType: string): string => {
    if (!completionDate || !tubeType) return '';
    
    const date = new Date(completionDate);
    
    if (tubeType === 'Latex') {
      // Latex 每2週更換一次
      date.setDate(date.getDate() + 14);
    } else if (tubeType === 'Silicon') {
      // Silicon 每4週更換一次
      date.setDate(date.getDate() + 28);
    }
    
    return date.toISOString().split('T')[0];
  };

  // 當簽署日期或喉管類型改變時，自動計算下次到期日期
  React.useEffect(() => {
    if (needsTubeSettings(task.health_record_type) && signatureDate && tubeType) {
      const calculatedDate = calculateNextDueDate(signatureDate, tubeType);
      setNextDueDate(calculatedDate);
    } else if (!needsTubeSettings(task.health_record_type) && signatureDate) {
      // 對於其他護理任務或文件任務，根據任務頻率計算
      const date = new Date(signatureDate);
      if (task.health_record_type === '年度體檢') {
        date.setFullYear(date.getFullYear() + 1);
      } else if (task.health_record_type === '約束物品同意書') {
        date.setMonth(date.getMonth() + 6);
      } else if (task.health_record_type === '晚晴計劃') {
        date.setFullYear(date.getFullYear() + 1);
      } else if (task.health_record_type === '傷口換症') {
        date.setDate(date.getDate() + 7); // 預設每週
      }
      setNextDueDate(date.toISOString().split('T')[0]);
    }
  }, [signatureDate, tubeType, task.health_record_type]);

  // 判斷是否為護理任務
  const isNursingTask = (taskType: string): boolean => {
    return taskType === '尿導管更換' || taskType === '鼻胃飼管更換' || taskType === '傷口換症';
  };

  // 獲取任務標題
  const getTaskTitle = (taskType: string): string => {
    if (isNursingTask(taskType)) {
      return '完成護理任務';
    }
    return '完成文件任務';
  };

  // 獲取日期標籤
  const getDateLabel = (taskType: string): string => {
    switch (taskType) {
      case '尿導管更換':
        return '尿導管更換日期';
      case '鼻胃飼管更換':
        return '鼻胃飼管更換日期';
      case '傷口換症':
        return '傷口換症日期';
      case '藥物自存同意書':
        return '簽署日期';
      case '晚晴計劃':
        return '醫生簽署日期';
      default:
        return '醫生簽署日期';
    }
  };

  // 判斷是否需要喉管設定
  const needsTubeSettings = (taskType: string): boolean => {
    return taskType === '尿導管更換' || taskType === '鼻胃飼管更換';
  };

  // 驗證表單
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!signatureDate) {
      errors.push(`請選擇${getDateLabel(task.health_record_type)}`);
    }
    
    if (needsTubeSettings(task.health_record_type)) {
      if (!tubeType) {
        errors.push('請選擇喉管類型');
      }
      if (!tubeSize) {
        errors.push('請選擇管徑');
      }
    }
    
    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    // 傳遞完成資訊，包括喉管設定
    const completionData = {
      taskId: task.id,
      completionDate: signatureDate,
      nextDueDate: nextDueDate,
      tubeType: needsTubeSettings(task.health_record_type) ? tubeType : undefined,
      tubeSize: needsTubeSettings(task.health_record_type) ? tubeSize : undefined
    };
    
    onTaskCompleted(task.id, signatureDate, nextDueDate, 
      needsTubeSettings(task.health_record_type) ? tubeType : undefined,
      needsTubeSettings(task.health_record_type) ? tubeSize : undefined
    );
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case '年度體檢': return 'text-yellow-600';
      case '尿導管更換': return 'text-blue-600';
      case '鼻胃飼管更換': return 'text-green-600';
      case '傷口換症': return 'text-red-600';
      case '晚晴計劃': return 'text-pink-600';
      default: return 'text-purple-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getTaskTypeColor(task.health_record_type)} bg-opacity-10`}>
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{getTaskTitle(task.health_record_type)}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
              {patient.院友相片 ? (
                <img 
                  src={patient.院友相片} 
                  alt={patient.中文姓名} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{patient.中文姓名}</p>
              <p className="text-sm text-gray-600">床號: {patient.床號}</p>
              <p className="text-sm text-gray-600">任務: {task.health_record_type}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              {getDateLabel(task.health_record_type)} *
            </label>
            <input
              type="date"
              value={signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* 喉管設定 - 僅針對導尿管和鼻胃飼管更換 */}
          {needsTubeSettings(task.health_record_type) && (
            <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900">喉管設定</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">喉管類型 *</label>
                  <select
                    value={tubeType}
                    onChange={(e) => setTubeType(e.target.value)}
                    className="form-input"
                    required
                  >
                    <option value="">請選擇</option>
                    <option value="Latex">Latex</option>
                    <option value="Silicon">Silicon</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">管徑 *</label>
                  <select
                    value={tubeSize}
                    onChange={(e) => setTubeSize(e.target.value)}
                    className="form-input"
                    required
                  >
                    <option value="">請選擇</option>
                    <option value="Fr. 8">Fr. 8</option>
                    <option value="Fr. 10">Fr. 10</option>
                    <option value="Fr. 12">Fr. 12</option>
                    <option value="Fr. 14">Fr. 14</option>
                    <option value="Fr. 16">Fr. 16</option>
                    <option value="Fr. 18">Fr. 18</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-white border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-800">
                  <strong>重要：</strong>不同的喉管類型有不同的更換週期：
                </p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• <strong>Latex：</strong>每2週更換一次</li>
                  <li>• <strong>Silicon：</strong>每4週更換一次</li>
                </ul>
              </div>
            </div>
          )}

          {/* 下次到期日期顯示 */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              下次到期日期
            </label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="form-input"
              readOnly={needsTubeSettings(task.health_record_type)}
            />
            {needsTubeSettings(task.health_record_type) ? (
              <p className="text-xs text-gray-500 mt-1">
                根據喉管類型自動計算：
                {tubeType === 'Latex' && '完成日期 + 2週'}
                {tubeType === 'Silicon' && '完成日期 + 4週'}
                {!tubeType && '請先選擇喉管類型'}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                可手動調整下次到期日期
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>注意：</strong>完成此任務後，系統將根據任務頻率自動計算下次{isNursingTask(task.health_record_type) ? '護理' : '簽署'}日期。
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>完成任務</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentTaskModal;