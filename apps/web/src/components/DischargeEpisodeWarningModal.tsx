import React from 'react';
import { X, AlertTriangle, Ambulance } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDisplayDate } from '../utils/dateFormat';

interface DischargeEpisodeWarningModalProps {
  patient: any;
  episodes: any[];
  dischargeReason?: string;
  onClose: () => void;
  onProceed: () => void;
}

const DischargeEpisodeWarningModal: React.FC<DischargeEpisodeWarningModalProps> = ({
  patient,
  episodes,
  dischargeReason,
  onClose,
  onProceed
}) => {
  const navigate = useNavigate();
  const canProceed = dischargeReason === '留醫';

  const handleGoToAdmissionRecords = () => {
    navigate('/admission-records');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">未閉合缺席事件</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <p className="text-gray-700 mb-4">
          院友 <strong>{patient.中文姓氏}{patient.中文名字}</strong> 有以下未閉合的缺席事件。
          {canProceed ? (
            '建議先到「缺席管理」處理，並以該處的死亡日期為準。'
          ) : (
            '請先前往「缺席管理」處理，完成後才可進行退住。'
          )}
        </p>

        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">開始日期</th>
                <th className="px-3 py-2 text-left">主要醫院</th>
                <th className="px-3 py-2 text-left">狀態</th>
                <th className="px-3 py-2 text-left">已有事件</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr key={ep.id} className="border-t border-gray-200">
                  <td className="px-3 py-2">{formatDisplayDate(ep.episode_start_date)}</td>
                  <td className="px-3 py-2">{ep.primary_hospital || '-'}</td>
                  <td className="px-3 py-2">{ep.status}</td>
                  <td className="px-3 py-2">
                    {ep.episode_events?.map((e: any) => e.event_type).join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <button
            type="button"
            onClick={handleGoToAdmissionRecords}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Ambulance className="h-4 w-4" />
            前往缺席管理
          </button>
          {canProceed && (
            <button
              type="button"
              onClick={onProceed}
              className="btn-danger flex-1"
            >
              仍要退住
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={canProceed ? 'btn-secondary flex-1' : 'btn-secondary flex-[2]'}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default DischargeEpisodeWarningModal;
