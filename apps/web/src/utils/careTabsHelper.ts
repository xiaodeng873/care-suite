import { supabase } from '../lib/supabase';
import type { Patient, HealthAssessment, PatientRestraintAssessment, PatientHealthTask, PatientCareTab } from '../lib/database';

export async function loadPatientCareTabs(patientId: number): Promise<PatientCareTab[]> {
  const { data, error } = await supabase
    .from('patient_care_tabs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_hidden', false);

  if (error) {
    console.error('載入院友床頭記錄選項卡失敗:', error);
    return [];
  }

  return data || [];
}

export async function initializePatientCareTabs(
  patient: Patient,
  healthAssessments: HealthAssessment[],
  restraintAssessments: PatientRestraintAssessment[],
  healthTasks: PatientHealthTask[]
): Promise<PatientCareTab[]> {
  const existingTabs = await loadPatientCareTabs(patient.院友id);
  if (existingTabs.length > 0) {
    return existingTabs;
  }

  const tabsToCreate: Omit<PatientCareTab, 'id' | 'created_at' | 'updated_at'>[] = [
    { patient_id: patient.院友id, tab_type: 'patrol', is_manually_added: false, is_hidden: false }
  ];

  if (patient.護理等級 === '全護理') {
    tabsToCreate.push({
      patient_id: patient.院友id,
      tab_type: 'diaper',
      is_manually_added: false,
      is_hidden: false
    });
  }

  const hasRestraint = restraintAssessments.some(a => a.patient_id === patient.院友id);
  if (hasRestraint) {
    tabsToCreate.push({
      patient_id: patient.院友id,
      tab_type: 'restraint',
      is_manually_added: false,
      is_hidden: false
    });
  }

  const latestHealthAssessment = healthAssessments
    .filter(a => a.patient_id === patient.院友id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (latestHealthAssessment?.daily_activities?.最高活動能力 === '臥床') {
    tabsToCreate.push({
      patient_id: patient.院友id,
      tab_type: 'position',
      is_manually_added: false,
      is_hidden: false
    });
  }

  const hasTube = healthTasks.some(
    t => t.patient_id === patient.院友id &&
    (t.health_record_type === '鼻胃飼管更換' || t.health_record_type === '導尿管更換')
  ) || latestHealthAssessment?.treatment_items?.some(
    (item: string) => item === '導尿管' || item === '鼻胃喉'
  );

  if (hasTube) {
    tabsToCreate.push({
      patient_id: patient.院友id,
      tab_type: 'intake_output',
      is_manually_added: false,
      is_hidden: false
    });
  }

  if (latestHealthAssessment?.toilet_training === true) {
    tabsToCreate.push({
      patient_id: patient.院友id,
      tab_type: 'toilet_training',
      is_manually_added: false,
      is_hidden: false
    });
  }

  const { data, error } = await supabase
    .from('patient_care_tabs')
    .insert(tabsToCreate)
    .select();

  if (error) {
    console.error('初始化院友床頭記錄選項卡失敗:', error);
    return [];
  }

  return data || [];
}

export async function addPatientCareTab(
  patientId: number,
  tabType: 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene'
): Promise<PatientCareTab | null> {
  const existingTab = await supabase
    .from('patient_care_tabs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('tab_type', tabType)
    .maybeSingle();

  if (existingTab.data) {
    if (existingTab.data.is_hidden) {
      const { data, error } = await supabase
        .from('patient_care_tabs')
        .update({ is_hidden: false })
        .eq('id', existingTab.data.id)
        .select()
        .single();

      if (error) {
        console.error('恢復隱藏選項卡失敗:', error);
        return null;
      }
      return data;
    }
    return existingTab.data;
  }

  const { data, error } = await supabase
    .from('patient_care_tabs')
    .insert({
      patient_id: patientId,
      tab_type: tabType,
      is_manually_added: true,
      is_hidden: false
    })
    .select()
    .single();

  if (error) {
    console.error('添加選項卡失敗:', error);
    return null;
  }

  return data;
}

export async function hidePatientCareTab(tabId: string): Promise<boolean> {
  const { error } = await supabase
    .from('patient_care_tabs')
    .update({ is_hidden: true })
    .eq('id', tabId);

  if (error) {
    console.error('隱藏選項卡失敗:', error);
    return false;
  }

  return true;
}

export function getVisibleTabTypes(
  patientId: number,
  patientCareTabs: PatientCareTab[],
  patrolRounds: any[],
  diaperChangeRecords: any[],
  restraintObservationRecords: any[],
  positionChangeRecords: any[],
  hygieneRecords?: any[],
  restraintAssessments?: any[]
): ('patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene')[] {
  const visibleTabs = new Set<'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene'>();

  const configuredTabs = patientCareTabs.filter(t => t.patient_id === patientId && !t.is_hidden);
  configuredTabs.forEach(t => {
    // 約束觀察tab由restraintAssessments控制，先跳過在此處理
    if (t.tab_type !== 'restraint') {
      visibleTabs.add(t.tab_type);
    }
  });

  // 添加其他基於記錄存在性的tabs
  if (patrolRounds.some(r => r.patient_id === patientId)) {
    visibleTabs.add('patrol');
  }
  if (diaperChangeRecords.some(r => r.patient_id === patientId)) {
    visibleTabs.add('diaper');
  }
  if (positionChangeRecords.some(r => r.patient_id === patientId)) {
    visibleTabs.add('position');
  }
  if (hygieneRecords && hygieneRecords.some(r => r.patient_id === patientId)) {
    visibleTabs.add('hygiene');
  }

  // 約束觀察tab：只在有約束評估時才自動顯示
  if (restraintAssessments && restraintAssessments.some(a => a.patient_id === patientId)) {
    visibleTabs.add('restraint');
  }

  // 預設所有院友都有「巡房記錄」和「衛生記錄」選項卡
  if (!visibleTabs.has('patrol')) {
    visibleTabs.add('patrol');
  }
  if (!visibleTabs.has('hygiene')) {
    visibleTabs.add('hygiene');
  }

  return Array.from(visibleTabs);
}
