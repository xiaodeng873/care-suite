import React, { useState, useMemo } from 'react';
import { Syringe, Utensils, Calendar, AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface Patient {
  院友id: string;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
}

interface MissingTask {
  patient: Patient;
  missingTaskTypes: string[];
}

interface MissingDeathDate {
  patient: Patient;
  missingInfo: string;
}

interface MissingVaccination {
  patient: Patient;
  missingInfo: string;
}

interface MissingRequirementsCardProps {
  missingTasks: MissingTask[];
  missingMealGuidance: Patient[];
  missingDeathDate: MissingDeathDate[];
  missingVaccination: MissingVaccination[];
  onCreateTask: (patient: Patient, taskType: '年度體檢' | '生命表徵') => void;
  onAddMealGuidance: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  onAddVaccinationRecord: (patient: Patient) => void;
}

interface MixedItem {
  type: 'task' | 'meal' | 'death' | 'vaccination';
  patient: Patient;
  priority: number;
  color: string;
  icon: any;
  label: string;
  missingTaskTypes?: string[];
  missingInfo?: string;
}

const MissingRequirementsCard: React.FC<MissingRequirementsCardProps> = ({
  missingTasks,
  missingMealGuidance,
  missingDeathDate,
  missingVaccination,
  onCreateTask,
  onAddMealGuidance,
  onEditPatient,
  onAddVaccinationRecord,
}) => {
  const [showAll, setShowAll] = useState(false);

  // 混合所有欠缺項目
  const allMissingItems = useMemo<MixedItem[]>(() => {
    const items: MixedItem[] = [
      ...missingTasks.map(item => ({
        type: 'task' as const,
        patient: item.patient,
        priority: 1,
        color: 'red',
        icon: AlertTriangle,
        label: `欠缺${item.missingTaskTypes.join('、')}`,
        missingTaskTypes: item.missingTaskTypes
      })),
      ...missingMealGuidance.map(patient => ({
        type: 'meal' as const,
        patient,
        priority: 2,
        color: 'orange',
        icon: Utensils,
        label: '欠缺餐膳指引'
      })),
      ...missingDeathDate.map(item => ({
        type: 'death' as const,
        patient: item.patient,
        priority: 3,
        color: 'purple',
        icon: Calendar,
        label: item.missingInfo,
        missingInfo: item.missingInfo
      })),
      ...missingVaccination.map(item => ({
        type: 'vaccination' as const,
        patient: item.patient,
        priority: 4,
        color: 'teal',
        icon: Syringe,
        label: '欠缺疫苗記錄',
        missingInfo: item.missingInfo
      }))
    ];

    return items.sort((a, b) => a.priority - b.priority);
  }, [missingTasks, missingMealGuidance, missingDeathDate, missingVaccination]);

  const totalMissing = allMissingItems.length;
  const displayItems = showAll ? allMissingItems : allMissingItems.slice(0, 2);

  if (totalMissing === 0) return null;

  const getColorClasses = (color: string) => {
    const classes = {
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        btn: 'bg-red-600 hover:bg-red-700',
        hover: 'hover:bg-red-50'
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        btn: 'bg-orange-600 hover:bg-orange-700',
        hover: 'hover:bg-orange-50'
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-800',
        btn: 'bg-purple-600 hover:bg-purple-700',
        hover: 'hover:bg-purple-50'
      },
      teal: {
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        text: 'text-teal-800',
        btn: 'bg-teal-600 hover:bg-teal-700',
        hover: 'hover:bg-teal-50'
      }
    };
    return classes[color as keyof typeof classes] || classes.red;
  };

  const renderAction = (item: MixedItem) => {
    const colorClass = getColorClasses(item.color);

    if (item.type === 'task' && item.missingTaskTypes) {
      return (
        <div className="flex space-x-1">
          {item.missingTaskTypes.map(taskType => (
            <button
              key={taskType}
              onClick={() => onCreateTask(item.patient, taskType as '年度體檢' | '生命表徵')}
              className={`text-xs text-white px-2 py-1 rounded transition-colors ${colorClass.btn}`}
              title={`新增${taskType}任務`}
            >
              +{taskType}
            </button>
          ))}
        </div>
      );
    }

    if (item.type === 'meal') {
      return (
        <button
          onClick={() => onAddMealGuidance(item.patient)}
          className={`text-xs text-white px-2 py-1 rounded transition-colors ${colorClass.btn}`}
          title="新增餐膳指引"
        >
          +餐膳指引
        </button>
      );
    }

    if (item.type === 'death') {
      return (
        <button
          onClick={() => onEditPatient(item.patient)}
          className={`text-xs text-white px-2 py-1 rounded transition-colors flex items-center space-x-1 ${colorClass.btn}`}
          title="補充死亡日期"
        >
          <span>補充資料</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      );
    }

    if (item.type === 'vaccination') {
      return (
        <button
          onClick={() => onAddVaccinationRecord(item.patient)}
          className={`text-xs text-white px-2 py-1 rounded transition-colors ${colorClass.btn}`}
          title="新增疫苗記錄"
        >
          +疫苗記錄
        </button>
      );
    }

    return null;
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">欠缺必要項目</h2>
            <p className="text-sm text-gray-600">
              共 {totalMissing} 項 ·
              任務{missingTasks.length} ·
              餐膳{missingMealGuidance.length} ·
              死亡{missingDeathDate.length} ·
              疫苗{missingVaccination.length}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {displayItems.map((item, index) => {
          const colorClass = getColorClasses(item.color);
          const Icon = item.icon;

          return (
            <div
              key={`${item.type}-${item.patient.院友id}-${index}`}
              className={`p-3 rounded-lg border ${colorClass.bg} ${colorClass.border} ${colorClass.hover} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <Icon className={`h-4 w-4 ${colorClass.text}`} />
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${colorClass.text}`}>
                      {item.patient.床號} {item.patient.中文姓氏}{item.patient.中文名字}
                    </span>
                    <span className="text-sm text-gray-600">- {item.label}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {renderAction(item)}
                </div>
              </div>
            </div>
          );
        })}

        {totalMissing > 2 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>收起 (顯示前 2 項)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>展開查看另外 {totalMissing - 2} 項</span>
              </>
            )}
          </button>
        )}
      </div>

      {totalMissing === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>所有院友資料完整</p>
        </div>
      )}
    </div>
  );
};

export default MissingRequirementsCard;
