import React, { useState, useMemo } from 'react';
import { Syringe, Utensils, Calendar, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, Stethoscope, ClipboardList, User } from 'lucide-react';

interface Patient {
  院友id: number;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
  院友相片?: string;
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

interface MissingHealthAssessment {
  patient: Patient;
  missingInfo: string;
}

interface MissingCarePlan {
  patient: Patient;
  missingInfo: string;
}

interface MissingRequirementsCardProps {
  missingTasks: MissingTask[];
  missingMealGuidance: Patient[];
  missingDeathDate: MissingDeathDate[];
  missingVaccination: MissingVaccination[];
  missingHealthAssessment: MissingHealthAssessment[];
  missingCarePlan: MissingCarePlan[];
  onCreateTask: (patient: Patient, taskType: '年度體檢' | '生命表徵') => void;
  onAddMealGuidance: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  onAddVaccinationRecord: (patient: Patient) => void;
  onAddHealthAssessment: (patient: Patient) => void;
  onAddCarePlan: (patient: Patient) => void;
}

interface MissingItem {
  type: 'task' | 'meal' | 'death' | 'vaccination' | 'health-assessment' | 'care-plan';
  label: string;
  icon: any;
  missingTaskTypes?: string[];
}

interface PatientMissing {
  patient: Patient;
  items: MissingItem[];
}

const MissingRequirementsCard: React.FC<MissingRequirementsCardProps> = ({
  missingTasks,
  missingMealGuidance,
  missingDeathDate,
  missingVaccination,
  missingHealthAssessment,
  missingCarePlan,
  onCreateTask,
  onAddMealGuidance,
  onEditPatient,
  onAddVaccinationRecord,
  onAddHealthAssessment,
  onAddCarePlan,
}) => {
  const [showAll, setShowAll] = useState(false);

  // 按院友分組所有欠缺項目
  const groupedByPatient = useMemo<PatientMissing[]>(() => {
    const patientMap = new Map<number, { patient: Patient; items: MissingItem[] }>();

    // 健康評估
    missingHealthAssessment.forEach(item => {
      if (!patientMap.has(item.patient.院友id)) {
        patientMap.set(item.patient.院友id, { patient: item.patient, items: [] });
      }
      patientMap.get(item.patient.院友id)!.items.push({
        type: 'health-assessment',
        label: '健康評估',
        icon: Stethoscope
      });
    });

    // 個人護理計劃
    missingCarePlan.forEach(item => {
      if (!patientMap.has(item.patient.院友id)) {
        patientMap.set(item.patient.院友id, { patient: item.patient, items: [] });
      }
      patientMap.get(item.patient.院友id)!.items.push({
        type: 'care-plan',
        label: '個人護理計劃',
        icon: ClipboardList
      });
    });

    // 任務 (年度體檢、生命表徵)
    missingTasks.forEach(item => {
      if (!patientMap.has(item.patient.院友id)) {
        patientMap.set(item.patient.院友id, { patient: item.patient, items: [] });
      }
      patientMap.get(item.patient.院友id)!.items.push({
        type: 'task',
        label: item.missingTaskTypes.join('、'),
        icon: AlertTriangle,
        missingTaskTypes: item.missingTaskTypes
      });
    });

    // 餐膳指引
    missingMealGuidance.forEach(patient => {
      if (!patientMap.has(patient.院友id)) {
        patientMap.set(patient.院友id, { patient, items: [] });
      }
      patientMap.get(patient.院友id)!.items.push({
        type: 'meal',
        label: '餐膳指引',
        icon: Utensils
      });
    });

    // 死亡日期
    missingDeathDate.forEach(item => {
      if (!patientMap.has(item.patient.院友id)) {
        patientMap.set(item.patient.院友id, { patient: item.patient, items: [] });
      }
      patientMap.get(item.patient.院友id)!.items.push({
        type: 'death',
        label: '死亡日期',
        icon: Calendar
      });
    });

    // 疫苗記錄
    missingVaccination.forEach(item => {
      if (!patientMap.has(item.patient.院友id)) {
        patientMap.set(item.patient.院友id, { patient: item.patient, items: [] });
      }
      patientMap.get(item.patient.院友id)!.items.push({
        type: 'vaccination',
        label: '疫苗記錄',
        icon: Syringe
      });
    });

    // 轉換為陣列並按欠缺項目數量排序（從多到少），相同數量則按床號排序
    return Array.from(patientMap.values()).sort((a, b) => {
      // 先按欠缺項目數量排序（降序）
      const itemsDiff = b.items.length - a.items.length;
      if (itemsDiff !== 0) return itemsDiff;
      // 數量相同則按床號排序
      return a.patient.床號.localeCompare(b.patient.床號, 'zh-Hant', { numeric: true });
    });
  }, [missingTasks, missingMealGuidance, missingDeathDate, missingVaccination, missingHealthAssessment, missingCarePlan]);

  const totalMissing = groupedByPatient.length;
  const displayPatients = showAll ? groupedByPatient : groupedByPatient.slice(0, 3);

  if (totalMissing === 0) return null;

  const renderActionButton = (patient: Patient, item: MissingItem) => {
    if (item.type === 'task' && item.missingTaskTypes) {
      return item.missingTaskTypes.map(taskType => (
        <button
          key={taskType}
          onClick={(e) => { e.stopPropagation(); onCreateTask(patient, taskType as '年度體檢' | '生命表徵'); }}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded transition-colors"
          title={`新增${taskType}`}
        >
          +{taskType}
        </button>
      ));
    }

    const buttonConfig: Record<string, { onClick: () => void; label: string }> = {
      'meal': { onClick: () => onAddMealGuidance(patient), label: '+餐膳指引' },
      'death': { onClick: () => onEditPatient(patient), label: '補充資料' },
      'vaccination': { onClick: () => onAddVaccinationRecord(patient), label: '+疫苗記錄' },
      'health-assessment': { onClick: () => onAddHealthAssessment(patient), label: '+健康評估' },
      'care-plan': { onClick: () => onAddCarePlan(patient), label: '+個人照顧計劃' },
    };

    const config = buttonConfig[item.type];
    if (!config) return null;

    return (
      <button
        onClick={(e) => { e.stopPropagation(); config.onClick(); }}
        className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded transition-colors"
        title={config.label}
      >
        {config.label}
      </button>
    );
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
              共 {totalMissing} 位院友欠缺必要項目
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {displayPatients.map((group) => (
          <div
            key={group.patient.院友id}
            className="p-3 rounded-lg border bg-red-50 border-red-200 hover:bg-red-100 transition-colors"
          >
            {/* 院友信息行 */}
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {group.patient.院友相片 ? (
                  <img src={group.patient.院友相片} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <span className="font-medium text-red-800">
                  {group.patient.床號} {group.patient.中文姓氏}{group.patient.中文名字}
                </span>
                <span className="ml-2 text-xs text-red-600">
                  ({group.items.length} 項欠缺)
                </span>
              </div>
            </div>

            {/* 欠缺項目列表 */}
            <div className="flex flex-wrap gap-1.5 pl-11">
              {group.items.map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="flex space-x-1">
                  {renderActionButton(group.patient, item)}
                </div>
              ))}
            </div>
          </div>
        ))}

        {totalMissing > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full p-3 border-2 border-dashed border-red-200 rounded-lg text-sm text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>收起 (顯示前 3 位)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>展開查看另外 {totalMissing - 3} 位院友</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default MissingRequirementsCard;
