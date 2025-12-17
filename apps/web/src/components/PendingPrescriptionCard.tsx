import React, { useState } from 'react';
import { Pill, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Patient {
  院友id: number;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
}

interface PendingPrescription {
  patient: Patient;
  count: number;
}

interface PendingPrescriptionCardProps {
  pendingPrescriptions: PendingPrescription[];
}

const PendingPrescriptionCard: React.FC<PendingPrescriptionCardProps> = ({
  pendingPrescriptions
}) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const displayItems = showAll ? pendingPrescriptions : pendingPrescriptions.slice(0, 2);

  if (pendingPrescriptions.length === 0) return null;

  const handleViewDetails = (patientId: number) => {
    navigate(`/prescriptions?patient=${patientId}&tab=pending_change`);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Pill className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">待變更處方提醒</h2>
            <p className="text-sm text-gray-600">
              {pendingPrescriptions.length} 位院友需要處理
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {displayItems.map((item) => (
          <div
            key={item.patient.院友id}
            className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            onClick={() => handleViewDetails(item.patient.院友id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <Pill className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">
                    {item.patient.床號} {item.patient.中文姓氏}{item.patient.中文名字}
                  </div>
                  <div className="text-sm text-blue-700">
                    {item.count} 個待變更處方
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(item.patient.院友id);
                }}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
              >
                <span>查看詳情</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        {pendingPrescriptions.length > 2 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>收起 (顯示前 2 位)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>展開查看另外 {pendingPrescriptions.length - 2} 位</span>
              </>
            )}
          </button>
        )}
      </div>

      {pendingPrescriptions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Pill className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>目前沒有待變更的處方</p>
        </div>
      )}
    </div>
  );
};

export default PendingPrescriptionCard;
