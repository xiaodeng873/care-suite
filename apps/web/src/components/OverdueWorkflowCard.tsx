import React, { useState, useMemo } from 'react';
import { Clock, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Patient {
  院友id: number;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
}

interface OverdueWorkflow {
  patient: Patient;
  overdueCount: number;
  dates: { [date: string]: number };
}

interface OverdueWorkflowCardProps {
  overdueWorkflows: OverdueWorkflow[];
}

const OverdueWorkflowCard: React.FC<OverdueWorkflowCardProps> = ({
  overdueWorkflows
}) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  const displayItems = showAll ? overdueWorkflows : overdueWorkflows.slice(0, 2);

  if (overdueWorkflows.length === 0) return null;

  const handleViewDetails = (patientId: number) => {
    navigate(`/medication-workflow?patientId=${patientId}`);
  };

  const togglePatientExpand = (patientId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const handleDateClick = (patientId: number, date: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/medication-workflow?patientId=${patientId}&date=${date}`);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">執核派藥逾期提醒</h2>
            <p className="text-sm text-gray-600">
              {overdueWorkflows.length} 位院友有逾期流程
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {displayItems.map((item) => {
          const dateEntries = Object.entries(item.dates).sort();
          const dateCount = dateEntries.length;
          const isExpanded = expandedPatients.has(item.patient.院友id);

          return (
            <div
              key={item.patient.院友id}
              className="bg-amber-50 border border-amber-200 rounded-lg transition-colors"
            >
              <div
                className="p-3 hover:bg-amber-100 cursor-pointer"
                onClick={() => handleViewDetails(item.patient.院友id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-amber-900">
                        {item.patient.床號} {item.patient.中文姓氏}{item.patient.中文名字}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-amber-700">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>{item.overdueCount} 個逾期流程 · {dateCount} 個日期</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => togglePatientExpand(item.patient.院友id, e)}
                      className="p-1 hover:bg-amber-200 rounded transition-colors"
                      title={isExpanded ? "摺疊日期" : "展開日期"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-amber-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-amber-600" />
                      )}
                    </button>
                    <ArrowRight className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  <div className="text-xs text-amber-600 font-medium mb-2">逾期日期列表：</div>
                  <div className="grid grid-cols-2 gap-2">
                    {dateEntries.map(([date, count]) => (
                      <button
                        key={date}
                        onClick={(e) => handleDateClick(item.patient.院友id, date, e)}
                        className="text-left px-3 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-sm text-amber-900 transition-colors"
                      >
                        <div className="font-medium">{date}</div>
                        <div className="text-xs text-amber-700">{count} 個流程</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {overdueWorkflows.length > 2 && (
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
                <span>展開查看另外 {overdueWorkflows.length - 2} 位</span>
              </>
            )}
          </button>
        )}
      </div>

      {overdueWorkflows.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>目前沒有逾期的執核派藥流程</p>
        </div>
      )}
    </div>
  );
};

export default OverdueWorkflowCard;
