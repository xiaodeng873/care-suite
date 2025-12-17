import { useMemo, useCallback } from 'react';

interface Patient {
  院友id: string | number;
  中文姓名: string;
  床號: string;
  在住狀態: string;
  中文姓氏?: string;
  中文名字?: string;
  is_hospitalized?: boolean;
}

interface HealthTask {
  id: string;
  patient_id: string | number;
  health_record_type: string;
  next_due_at: string;
  last_completed_at?: string;
  notes?: string;
  is_recurring?: boolean;
}

interface Prescription {
  處方id: number;
  patient_id: number;
  status: string;
  medication_name?: string;
}

interface HealthRecord {
  記錄id: string;
  院友id: number;
  記錄日期: string;
  記錄時間: string;
  記錄類型: string;
  體溫?: number;
}

interface MealGuidance {
  id: string;
  patient_id: number;
}

export const useDashboardData = (
  patients: Patient[],
  patientHealthTasks: HealthTask[],
  prescriptions: Prescription[],
  mealGuidances: MealGuidance[],
  healthRecords: HealthRecord[]
) => {
  const activePatients = useMemo(() =>
    patients.filter(p => p.在住狀態 === '在住'),
    [patients]
  );

  const uniquePatientHealthTasks = useMemo(() => {
    const seen = new Map<string, boolean>();
    return patientHealthTasks.filter(task => {
      if (!seen.has(task.id)) {
        seen.set(task.id, true);
        return true;
      }
      return false;
    });
  }, [patientHealthTasks]);

  const missingTasks = useMemo(() => {
    const result: { patient: Patient; missingTaskTypes: string[] }[] = [];

    activePatients.forEach(patient => {
      const patientTasks = uniquePatientHealthTasks.filter(
        task => task.patient_id === patient.院友id
      );
      const missing: string[] = [];

      const hasAnnualCheckup = patientTasks.some(
        task => task.health_record_type === '年度體檢'
      );
      const hasVitalSigns = patientTasks.some(
        task => task.health_record_type === '生命表徵'
      );

      if (!hasAnnualCheckup) missing.push('年度體檢');
      if (!hasVitalSigns) missing.push('生命表徵');

      if (missing.length > 0) {
        result.push({ patient, missingTaskTypes: missing });
      }
    });

    return result;
  }, [activePatients, uniquePatientHealthTasks]);

  const missingMealGuidance = useMemo(() =>
    activePatients.filter(
      patient => !mealGuidances.some(
        guidance => guidance.patient_id === patient.院友id
      )
    ),
    [activePatients, mealGuidances]
  );

  const patientsWithPendingPrescriptions = useMemo(() =>
    activePatients.filter(patient =>
      prescriptions.some(
        prescription =>
          prescription.patient_id === patient.院友id &&
          prescription.status === 'pending_change'
      )
    ),
    [activePatients, prescriptions]
  );

  return {
    activePatients,
    uniquePatientHealthTasks,
    missingTasks,
    missingMealGuidance,
    patientsWithPendingPrescriptions
  };
};

export const useTaskFilters = (
  patients: Patient[],
  tasks: HealthTask[],
  isMonitoringTask: (type: string) => boolean,
  isDocumentTask: (type: string) => boolean,
  isNursingTask: (type: string) => boolean,
  isTaskOverdue: (task: HealthTask) => boolean,
  isTaskPendingToday: (task: HealthTask) => boolean,
  isTaskDueSoon: (task: HealthTask) => boolean
) => {
  const filterTasksByPatientStatus = useCallback(
    (taskList: HealthTask[]) =>
      taskList.filter(task => {
        const patient = patients.find(p => p.院友id === task.patient_id);
        return patient && patient.在住狀態 === '在住';
      }),
    [patients]
  );

  const monitoringTasks = useMemo(
    () => filterTasksByPatientStatus(tasks.filter(task => isMonitoringTask(task.health_record_type))),
    [tasks, filterTasksByPatientStatus, isMonitoringTask]
  );

  const documentTasks = useMemo(
    () => filterTasksByPatientStatus(tasks.filter(task => isDocumentTask(task.health_record_type))),
    [tasks, filterTasksByPatientStatus, isDocumentTask]
  );

  const nursingTasks = useMemo(
    () => filterTasksByPatientStatus(tasks.filter(task => isNursingTask(task.health_record_type))),
    [tasks, filterTasksByPatientStatus, isNursingTask]
  );

  const overdueMonitoringTasks = useMemo(
    () => monitoringTasks.filter(isTaskOverdue),
    [monitoringTasks, isTaskOverdue]
  );

  const pendingMonitoringTasks = useMemo(
    () => monitoringTasks.filter(isTaskPendingToday),
    [monitoringTasks, isTaskPendingToday]
  );

  const urgentMonitoringTasks = useMemo(() => {
    const combined = [...overdueMonitoringTasks, ...pendingMonitoringTasks];
    return combined.sort((a, b) => {
      const timeA = new Date(a.next_due_at).getTime();
      const timeB = new Date(b.next_due_at).getTime();
      if (timeA === timeB) {
        const priority: Record<string, number> = {
          '注射前': 1, '服藥前': 2, '社康': 3, '特別關顧': 4, '定期': 5
        };
        const priorityA = a.notes ? priority[a.notes] || 5 : 5;
        const priorityB = b.notes ? priority[b.notes] || 5 : 5;
        return priorityA - priorityB;
      }
      return timeA - timeB;
    }).slice(0, 100);
  }, [overdueMonitoringTasks, pendingMonitoringTasks]);

  return {
    monitoringTasks,
    documentTasks,
    nursingTasks,
    urgentMonitoringTasks
  };
};
