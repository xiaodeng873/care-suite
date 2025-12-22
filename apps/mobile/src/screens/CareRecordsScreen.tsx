import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  Patient,
  PatrolRound,
  DiaperChangeRecord,
  RestraintObservationRecord,
  PositionChangeRecord,
  HygieneRecord,
  IntakeOutputRecord,
  PatientRestraintAssessment,
  PatientAdmissionRecord,
  PatientCareTab,
  HealthAssessment,
  getPatrolRoundsInDateRange,
  getDiaperChangeRecordsInDateRange,
  getRestraintObservationRecordsInDateRange,
  getPositionChangeRecordsInDateRange,
  getHygieneRecordsInDateRange,
  getIntakeOutputRecords,
  getRestraintAssessments,
  getPatientAdmissionRecords,
  getPatientCareTabs,
  getHealthAssessments,
  createHygieneRecord,
  updateHygieneRecord,
  createIntakeOutputRecord,
  updateIntakeOutputRecord,
} from '../lib/database';
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  INTAKE_OUTPUT_SLOTS,
  generateWeekDates,
  getWeekStartDate,
  formatDate,
  isInHospital,
  isPastSlot,
  parseSlotStartTime,
} from '../utils/careRecordHelper';
import IntakeOutputModal from '../components/IntakeOutput/IntakeOutputModal';
import { eventBus } from '../lib/eventBus';
import { getMissingLookbackDays } from '../lib/settings';
import { useTranslation, usePatientName } from '../lib/i18n';

type TabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training' | 'hygiene';

const TAB_CONFIG = {
  patrol: { label: '巡房記錄', icon: 'clipboard-outline' as const },
  diaper: { label: '換片記錄', icon: 'water-outline' as const },
  intake_output: { label: '出入量', icon: 'analytics-outline' as const },
  restraint: { label: '約束觀察', icon: 'shield-outline' as const },
  position: { label: '轉身記錄', icon: 'refresh-outline' as const },
  toilet_training: { label: '如廁訓練', icon: 'school-outline' as const },
  hygiene: { label: '衛生記錄', icon: 'medical-outline' as const },
};

// 衛生記錄項目配置（16項：備註 + 11護理項目 + 4大便項目）
const HYGIENE_ITEMS = [
  { key: 'status_notes', labelKey: 'noteOrStatus', isStatus: true },
  { key: 'has_bath', labelKey: 'bath' },
  { key: 'has_face_wash', labelKey: 'faceWash' },
  { key: 'has_shave', labelKey: 'shave' },
  { key: 'has_oral_care', labelKey: 'oralCare' },
  { key: 'has_denture_care', labelKey: 'dentureCare' },
  { key: 'has_nail_trim', labelKey: 'nailTrim' },
  { key: 'has_bedding_change', labelKey: 'beddingChange' },
  { key: 'has_sheet_pillow_change', labelKey: 'sheetPillowChange' },
  { key: 'has_cup_wash', labelKey: 'cupWash' },
  { key: 'has_bedside_cabinet', labelKey: 'bedsideCabinet' },
  { key: 'has_wardrobe', labelKey: 'wardrobe' },
  { key: 'bowel_count', labelKey: 'bowelCount', isBowelCount: true },
  { key: 'bowel_amount', labelKey: 'bowelAmount', isBowelAmount: true },
  { key: 'bowel_consistency', labelKey: 'bowelConsistency', isBowelConsistency: true },
  { key: 'bowel_medication', labelKey: 'bowelMedication', isBowelMedication: true },
] as const;

const CareRecordsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { displayName } = useAuth();
  const { t, language } = useTranslation();
  const getPatientName = usePatientName();
  const patient: Patient = route.params?.patient;
  
  // 动态翻译选项卡标签
  const getTabLabel = (tab: TabType): string => {
    const labels = {
      'patrol': t('patrolRecord'),
      'diaper': t('diaperChange'),
      'intake_output': t('intakeOutput'),
      'restraint': t('restraintObservation'),
      'position': t('positionChange'),
      'toilet_training': t('toiletTraining'),
      'hygiene': t('hygieneRecord'),
    };
    return labels[tab] || TAB_CONFIG[tab]?.label || tab;
  };

  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<TabType[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperChangeRecords, setDiaperChangeRecords] = useState<DiaperChangeRecord[]>([]);
  const [restraintObservationRecords, setRestraintObservationRecords] = useState<RestraintObservationRecord[]>([]);
  const [positionChangeRecords, setPositionChangeRecords] = useState<PositionChangeRecord[]>([]);
  const [hygieneRecords, setHygieneRecords] = useState<HygieneRecord[]>([]);
  const [intakeOutputRecords, setIntakeOutputRecords] = useState<IntakeOutputRecord[]>([]);
  const [restraintAssessments, setRestraintAssessments] = useState<PatientRestraintAssessment[]>([]);
  const [admissionRecords, setAdmissionRecords] = useState<PatientAdmissionRecord[]>([]);
  const [healthAssessments, setHealthAssessments] = useState<HealthAssessment[]>([]);
  const [careTabs, setCareTabs] = useState<PatientCareTab[]>([]);
  const [missingLookbackDays, setMissingLookbackDays] = useState(30);

  // 衛生記錄選單狀態
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerType, setPickerType] = useState<'status' | 'count' | 'amount' | 'consistency' | 'medication' | null>(null);
  const [pickerDate, setPickerDate] = useState<string>('');
  
  // 出入量記錄狀態
  const [showIntakeOutputModal, setShowIntakeOutputModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [editingIntakeOutput, setEditingIntakeOutput] = useState<Partial<IntakeOutputRecord>>({});

  const selectedDateString = useMemo(() => formatDate(selectedDate), [selectedDate]);

  useEffect(() => {
    // 加载回溯天数设置
    getMissingLookbackDays().then(setMissingLookbackDays);
  }, []);

  // 加载当前月份的所有数据（用于日历红点显示）
  const loadMonthData = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const startDate = formatDate(new Date(year, month, 1));
      const endDate = formatDate(new Date(year, month + 1, 0));

      const [patrol, diaper, restraint, position, hygiene] = await Promise.all([
        getPatrolRoundsInDateRange(startDate, endDate),
        getDiaperChangeRecordsInDateRange(startDate, endDate),
        getRestraintObservationRecordsInDateRange(startDate, endDate),
        getPositionChangeRecordsInDateRange(startDate, endDate),
        getHygieneRecordsInDateRange(startDate, endDate),
      ]);

      setPatrolRounds(patrol.filter(r => r.patient_id === patient.院友id));
      setDiaperChangeRecords(diaper.filter(r => r.patient_id === patient.院友id));
      setRestraintObservationRecords(restraint.filter(r => r.patient_id === patient.院友id));
      setPositionChangeRecords(position.filter(r => r.patient_id === patient.院友id));
      setHygieneRecords(hygiene.filter(r => r.patient_id === patient.院友id));
    } catch (error) {
      console.error('载入月份数据失败:', error);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const dateStr = selectedDateString;

      const [patrol, diaper, restraint, position, hygiene, intakeOutput, assessments, admissions, healthAssess, careTabsData] = await Promise.all([
        getPatrolRoundsInDateRange(dateStr, dateStr),
        getDiaperChangeRecordsInDateRange(dateStr, dateStr),
        getRestraintObservationRecordsInDateRange(dateStr, dateStr),
        getPositionChangeRecordsInDateRange(dateStr, dateStr),
        getHygieneRecordsInDateRange(dateStr, dateStr),
        getIntakeOutputRecords(),
        getRestraintAssessments(),
        getPatientAdmissionRecords(),
        getHealthAssessments(),
        getPatientCareTabs(patient.院友id),
      ]);

      setPatrolRounds(patrol.filter(r => r.patient_id === patient.院友id));
      setDiaperChangeRecords(diaper.filter(r => r.patient_id === patient.院友id));
      setRestraintObservationRecords(restraint.filter(r => r.patient_id === patient.院友id));
      setPositionChangeRecords(position.filter(r => r.patient_id === patient.院友id));
      setHygieneRecords(hygiene.filter(r => r.patient_id === patient.院友id));
      setIntakeOutputRecords(intakeOutput.filter(r => r.patient_id === patient.院友id && r.record_date === dateStr));
      setRestraintAssessments(assessments);
      setAdmissionRecords(admissions);
      setHealthAssessments(healthAssess);
      setCareTabs(careTabsData);
      
      // 使用 patient_care_tabs 表来确定显示哪些选项卡
      console.log('=== 从 patient_care_tabs 表读取选项卡配置 ===');
      console.log('当前患者 ID:', patient?.院友id);
      console.log('patient_care_tabs 数据:', careTabsData);
      
      // 只显示 is_hidden=false 的选项卡（数据库查询已经过滤）
      const tabs: TabType[] = careTabsData.map(tab => tab.tab_type);
      
      console.log('根据 patient_care_tabs 计算出的选项卡:', tabs);
      console.log('===================');
      
      setAvailableTabs(tabs);
      
      // 如果当前 activeTab 不在可用列表中，切换到第一个可用的
      if (tabs.length > 0 && !tabs.includes(activeTab)) {
        setActiveTab(tabs[0]);
      }
    } catch (error) {
      console.error('載入護理記錄失敗:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const { getPatients } = await import('../lib/database');
        const patients = await getPatients();
        // 按床号排序
        const sorted = patients.sort((a, b) => {
          const bedA = a.床號 || '';
          const bedB = b.床號 || '';
          return bedA.localeCompare(bedB, 'zh-Hans-CN', { numeric: true });
        });
        setAllPatients(sorted);
      } catch (error) {
        console.error('加载院友列表失败:', error);
      }
    };
    loadPatients();
    loadData();
  }, [selectedDateString, patient.院友id]);

  // 当日期或选项卡数据改变时，确保当前选项卡在该日期可见
  useEffect(() => {
    const visibleTabs = getVisibleTabs();
    // 如果当前选项卡不在可见列表中，切换到第一个可见的选项卡
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [selectedDate, careTabs, availableTabs]);

  // 当打开日历时加载当前月份的数据
  useEffect(() => {
    if (showDatePicker) {
      console.log('=== 小日曆打開：檢查careTabs數據 ===');
      console.log('careTabs:', JSON.stringify(careTabs, null, 2));
      console.log('availableTabs:', availableTabs);
      console.log('missingLookbackDays:', missingLookbackDays);
      loadMonthData(selectedDate);
    }
  }, [showDatePicker]);

  // listen for recordSaved events emitted from detail screen for optimistic updates
  useEffect(() => {
    const handler = (e: any) => {
      if (!e) return;
      if (e.patientId && e.patientId !== patient.院友id) return;
      
      // Handle optimistic update - update UI immediately with the record data
      if (e.record) {
        const record = e.record;
        const recordType = e.recordType;
        
        switch (recordType) {
          case 'patrol':
            setPatrolRounds(prev => {
              const filtered = prev.filter(r => r.id !== record.id && 
                !(r.patrol_date === record.patrol_date && r.scheduled_time === record.scheduled_time && r.patient_id === record.patient_id));
              return [...filtered, record].sort((a, b) => 
                a.scheduled_time.localeCompare(b.scheduled_time)
              );
            });
            break;
          case 'diaper':
            setDiaperChangeRecords(prev => {
              const filtered = prev.filter(r => r.id !== record.id && 
                !(r.change_date === record.change_date && r.time_slot === record.time_slot && r.patient_id === record.patient_id));
              return [...filtered, record].sort((a, b) => 
                a.time_slot.localeCompare(b.time_slot)
              );
            });
            break;
          case 'restraint':
            setRestraintObservationRecords(prev => {
              const filtered = prev.filter(r => r.id !== record.id && 
                !(r.observation_date === record.observation_date && r.scheduled_time === record.scheduled_time && r.patient_id === record.patient_id));
              return [...filtered, record].sort((a, b) => 
                a.scheduled_time.localeCompare(b.scheduled_time)
              );
            });
            break;
          case 'position':
            setPositionChangeRecords(prev => {
              const filtered = prev.filter(r => r.id !== record.id && 
                !(r.change_date === record.change_date && r.scheduled_time === record.scheduled_time && r.patient_id === record.patient_id));
              return [...filtered, record].sort((a, b) => 
                a.scheduled_time.localeCompare(b.scheduled_time)
              );
            });
            break;
          case 'hygiene':
            setHygieneRecords(prev => {
              const filtered = prev.filter(r => r.id !== record.id && 
                !(r.record_date === record.record_date && r.patient_id === record.patient_id));
              return [...filtered, record];
            });
            break;
        }
      } else {
        // Fallback to full reload if no record data provided
        loadData(true);
      }
    };
    
    const deleteHandler = (e: any) => {
      if (!e) return;
      if (e.patientId && e.patientId !== patient.院友id) return;
      
      const recordType = e.recordType;
      const recordId = e.recordId;
      
      // Remove deleted record from state
      switch (recordType) {
        case 'patrol':
          setPatrolRounds(prev => prev.filter(r => r.id !== recordId));
          break;
        case 'diaper':
          setDiaperChangeRecords(prev => prev.filter(r => r.id !== recordId));
          break;
        case 'restraint':
          setRestraintObservationRecords(prev => prev.filter(r => r.id !== recordId));
          break;
        case 'position':
          setPositionChangeRecords(prev => prev.filter(r => r.id !== recordId));
          break;
        case 'hygiene':
          setHygieneRecords(prev => prev.filter(r => r.id !== recordId));
          break;
      }
    };
    
    const errorHandler = (e: any) => {
      if (!e) return;
      if (e.patientId && e.patientId !== patient.院友id) return;
      // On error, reload data to get correct state
      loadData(true);
    };
    
    const deleteErrorHandler = (e: any) => {
      if (!e) return;
      if (e.patientId && e.patientId !== patient.院友id) return;
      
      // On delete error, restore the record
      if (e.record) {
        const record = e.record;
        const recordType = e.recordType;
        
        switch (recordType) {
          case 'patrol':
            setPatrolRounds(prev => [...prev, record].sort((a, b) => 
              a.scheduled_time.localeCompare(b.scheduled_time)
            ));
            break;
          case 'diaper':
            setDiaperChangeRecords(prev => [...prev, record].sort((a, b) => 
              a.time_slot.localeCompare(b.time_slot)
            ));
            break;
          case 'restraint':
            setRestraintObservationRecords(prev => [...prev, record].sort((a, b) => 
              a.scheduled_time.localeCompare(b.scheduled_time)
            ));
            break;
          case 'position':
            setPositionChangeRecords(prev => [...prev, record].sort((a, b) => 
              a.scheduled_time.localeCompare(b.scheduled_time)
            ));
            break;
          case 'hygiene':
            setHygieneRecords(prev => [...prev, record]);
            break;
        }
      } else {
        // Fallback to reload
        loadData(true);
      }
    };
    
    eventBus.on('recordSaved', handler as any);
    eventBus.on('recordDeleted', deleteHandler as any);
    eventBus.on('recordSaveFailed', errorHandler as any);
    eventBus.on('recordDeleteFailed', deleteErrorHandler as any);
    
    return () => { 
      eventBus.off('recordSaved', handler as any);
      eventBus.off('recordDeleted', deleteHandler as any);
      eventBus.off('recordSaveFailed', errorHandler as any);
      eventBus.off('recordDeleteFailed', deleteErrorHandler as any);
    };
  }, [patient.院友id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handlePreviousPatient = () => {
    const currentIndex = allPatients.findIndex(p => p.院友id === patient.院友id);
    if (currentIndex > 0) {
      const prevPatient = allPatients[currentIndex - 1];
      navigation.replace('CareRecords', { patient: prevPatient });
    }
  };

  const handleNextPatient = () => {
    const currentIndex = allPatients.findIndex(p => p.院友id === patient.院友id);
    if (currentIndex < allPatients.length - 1) {
      const nextPatient = allPatients[currentIndex + 1];
      navigation.replace('CareRecords', { patient: nextPatient });
    }
  };

  const canGoPrevious = () => {
    const currentIndex = allPatients.findIndex(p => p.院友id === patient.院友id);
    return currentIndex > 0;
  };

  const canGoNext = () => {
    const currentIndex = allPatients.findIndex(p => p.院友id === patient.院友id);
    return currentIndex < allPatients.length - 1;
  };

  const handleDateSelect = (date: Date) => {
    // 不允许选择今天之后的日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(date);
    selectedDay.setHours(0, 0, 0, 0);
    
    if (selectedDay <= today) {
      setSelectedDate(date);
      setShowDatePicker(false);
    }
  };

  const handleCellPress = (date: string, timeSlot: string, existingRecord?: any) => {
    navigation.navigate('RecordDetail', {
      patient,
      recordType: activeTab,
      date,
      timeSlot,
      existingRecord,
      staffName: displayName || '未知',
      restraintAssessments: activeTab === 'restraint' ? restraintAssessments : undefined,
      // note: refresh will be handled by 'recordSaved' navigation event
    });
  };

  // 衛生記錄：toggle護理項目（inline編輯）
  const toggleHygieneCareItem = async (date: string, itemKey: string, currentValue: boolean) => {
    if (!patient) return;
    
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === patient.院友id);
      
      if (existingRecord) {
        const updated = await updateHygieneRecord(existingRecord.id, {
          [itemKey]: !currentValue,
        });
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else {
        const newRecord = await createHygieneRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: itemKey === 'has_bath',
          has_face_wash: itemKey === 'has_face_wash',
          has_shave: itemKey === 'has_shave',
          has_oral_care: itemKey === 'has_oral_care',
          has_denture_care: itemKey === 'has_denture_care',
          has_nail_trim: itemKey === 'has_nail_trim',
          has_bedding_change: itemKey === 'has_bedding_change',
          has_sheet_pillow_change: itemKey === 'has_sheet_pillow_change',
          has_cup_wash: itemKey === 'has_cup_wash',
          has_bedside_cabinet: itemKey === 'has_bedside_cabinet',
          has_wardrobe: itemKey === 'has_wardrobe',
          bowel_count: null,
          bowel_amount: null,
          bowel_consistency: null,
          bowel_medication: null,
          recorder: displayName || '未知',
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Toggle hygiene care item failed:', error);
    }
  };

  // 衛生記錄：更新備註狀態（入院/渡假/外出）
  const updateHygieneStatus = async (date: string, status: string) => {
    if (!patient) return;
    
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === patient.院友id);
      
      // 準備更新數據：當選擇入院/渡假/外出時，清空所有其他欄位
      const updates: any = { status_notes: status || null };
      
      if (status) {
        // 選擇了入院/渡假/外出，清空所有護理項目和大便欄位
        updates.has_bath = false;
        updates.has_face_wash = false;
        updates.has_shave = false;
        updates.has_oral_care = false;
        updates.has_denture_care = false;
        updates.has_nail_trim = false;
        updates.has_bedding_change = false;
        updates.has_sheet_pillow_change = false;
        updates.has_cup_wash = false;
        updates.has_bedside_cabinet = false;
        updates.has_wardrobe = false;
        updates.bowel_count = null;
        updates.bowel_amount = null;
        updates.bowel_consistency = null;
        updates.bowel_medication = null;
      }
      
      if (existingRecord) {
        const updated = await updateHygieneRecord(existingRecord.id, updates);
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else if (status) {
        // 只有選擇非空值時才創建新記錄
        const newRecord = await createHygieneRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: false,
          has_face_wash: false,
          has_shave: false,
          has_oral_care: false,
          has_denture_care: false,
          has_nail_trim: false,
          has_bedding_change: false,
          has_sheet_pillow_change: false,
          has_cup_wash: false,
          has_bedside_cabinet: false,
          has_wardrobe: false,
          bowel_count: null,
          bowel_amount: null,
          bowel_consistency: null,
          bowel_medication: null,
          status_notes: status,
          recorder: displayName || '未知',
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Update hygiene status failed:', error);
    }
  };

  // 衛生記錄：更新大便欄位（次數/量/性質/藥）
  const updateHygieneBowel = async (date: string, field: string, value: any) => {
    if (!patient) return;
    
    try {
      const existingRecord = hygieneRecords.find(r => r.record_date === date && r.patient_id === patient.院友id);
      
      if (existingRecord) {
        const updated = await updateHygieneRecord(existingRecord.id, {
          [field]: value,
        });
        if (updated) {
          setHygieneRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else {
        const newRecord = await createHygieneRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: 'daily',
          has_bath: false,
          has_face_wash: false,
          has_shave: false,
          has_oral_care: false,
          has_denture_care: false,
          has_nail_trim: false,
          has_bedding_change: false,
          has_sheet_pillow_change: false,
          has_cup_wash: false,
          has_bedside_cabinet: false,
          has_wardrobe: false,
          bowel_count: null,
          bowel_amount: null,
          bowel_consistency: null,
          bowel_medication: null,
          [field]: value,
          recorder: displayName || '未知',
        });
        if (newRecord) {
          setHygieneRecords(prev => [...prev, newRecord]);
        }
      }
    } catch (error) {
      console.error('Update hygiene bowel failed:', error);
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const renderPatientHeader = () => (
    <View style={styles.patientHeader}>
      <View style={styles.patientInfo}>
        {patient.院友相片 ? (
          <Image source={{ uri: patient.院友相片 }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={32} color="#9ca3af" />
          </View>
        )}
        <View style={styles.patientDetails}>
          <Text style={styles.patientName}>{getPatientName(patient)}</Text>
          <Text style={styles.patientMeta}>
            {t('bed')}: {patient.床號} | {patient.性別}
            {calculateAge(patient.出生日期) && ` | ${calculateAge(patient.出生日期)} ${t('years')}`}
          </Text>
        </View>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </Pressable>
      </View>
    </View>
  );

  // 计算每个选项卡是否有缺失记录（红点）
  // 基于 patient_care_tabs 表显示的选项卡检查缺失记录
  const getTabHasMissing = (tab: TabType): boolean => {
    const dateStr = selectedDateString;
    
    // 查找对应的选项卡配置（包含 last_activated_at）
    const tabConfig = careTabs.find(t => t.tab_type === tab);
    if (!tabConfig) return false;
    
    // 检查日期是否在选项卡启用日期之后
    if (tabConfig.last_activated_at) {
      const tabActivatedDate = new Date(tabConfig.last_activated_at);
      tabActivatedDate.setHours(0, 0, 0, 0);
      const currentDate = new Date(dateStr);
      currentDate.setHours(0, 0, 0, 0);
      
      // 如果当前日期在选项卡启用日期之前，不显示红点
      if (currentDate < tabActivatedDate) {
        return false;
      }
    }
    
    // 检查是否超出回溯天数限制
    const dateObj = new Date(selectedDate);
    dateObj.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > missingLookbackDays) return false;
    
    // 只为 patient_care_tabs 表中显示的选项卡检查缺失记录
    if (!availableTabs.includes(tab)) return false;
    
    switch (tab) {
      case 'patrol': {
        const existing = patrolRounds.filter(r => r.patrol_date === dateStr);
        return TIME_SLOTS.some(slot => {
          const existingRecord = existing.find(r => r.scheduled_time === slot);
          if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
            return false; // 有状态标记，不算缺失
          }
          return !existingRecord && isPastSlot(dateStr, slot);
        });
      }
      case 'diaper': {
        const existing = diaperChangeRecords.filter(r => r.change_date === dateStr);
        return DIAPER_CHANGE_SLOTS.some(slot => {
          const existingRecord = existing.find(r => r.time_slot === slot.time);
          if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
            return false;
          }
          return !existingRecord && isPastSlot(dateStr, slot.time);
        });
      }
      case 'restraint': {
        const existing = restraintObservationRecords.filter(r => r.observation_date === dateStr);
        return TIME_SLOTS.some(slot => {
          const existingRecord = existing.find(r => r.scheduled_time === slot);
          if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
            return false;
          }
          return !existingRecord && isPastSlot(dateStr, slot);
        });
      }
      case 'position': {
        const existing = positionChangeRecords.filter(r => r.change_date === dateStr);
        return TIME_SLOTS.some(slot => {
          const existingRecord = existing.find(r => r.scheduled_time === slot);
          if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
            return false;
          }
          return !existingRecord && isPastSlot(dateStr, slot);
        });
      }
      case 'hygiene': {
        const existing = hygieneRecords.find(r => r.record_date === dateStr);
        if (existing?.status_notes && ['入院', '渡假', '外出'].includes(existing.status_notes)) {
          return false;
        }
        return !existing && isPastSlot(dateStr, 'daily');
      }
      default:
        return false;
    }
  };

  // 根据选择的日期过滤选项卡：只显示在该日期已经启用的选项卡
  const getVisibleTabs = (): TabType[] => {
    // 使用本地日期字符串，避免时区问题
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return availableTabs.filter(tab => {
      const tabConfig = careTabs.find(t => t.tab_type === tab);
      if (!tabConfig?.last_activated_at) return false;
      
      const activationDate = tabConfig.last_activated_at.split('T')[0];
      // 只显示在选择日期当天或之前启用的选项卡
      return dateStr >= activationDate;
    });
  };

  const renderTabs = () => {
    const visibleTabs = getVisibleTabs();
    
    return (
      <View
        style={styles.tabsContainer}
      >
        {visibleTabs.map((tab) => {
          const hasMissing = getTabHasMissing(tab);
          return (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {getTabLabel(tab)}
                </Text>
                {hasMissing && <View style={styles.tabBadge} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderDateNavigation = () => {
    const formatDisplayDate = () => {
      const d = selectedDate;
      const weekdays = [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')];
      return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
    };

    return (
      <View style={styles.dateNavigation}>
        <Pressable 
          style={[styles.navButton, !canGoPrevious() && styles.navButtonDisabled]} 
          onPress={handlePreviousPatient}
          disabled={!canGoPrevious()}
        >
          <Ionicons name="chevron-back" size={24} color={canGoPrevious() ? '#374151' : '#d1d5db'} />
          <Text style={[styles.navButtonText, !canGoPrevious() && styles.navButtonTextDisabled]}>{t('previousPatient')}</Text>
        </Pressable>
        
        <Pressable 
          style={styles.dateSelectButton} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#2563eb" />
          <Text style={styles.dateSelectButtonText}>
            {formatDisplayDate()}
          </Text>
        </Pressable>
        
        <Pressable 
          style={[styles.navButton, !canGoNext() && styles.navButtonDisabled]} 
          onPress={handleNextPatient}
          disabled={!canGoNext()}
        >
          <Text style={[styles.navButtonText, !canGoNext() && styles.navButtonTextDisabled]}>{t('nextPatient')}</Text>
          <Ionicons name="chevron-forward" size={24} color={canGoNext() ? '#374151' : '#d1d5db'} />
        </Pressable>
      </View>
    );
  };

  const renderDateHeader = () => {
    const weekdays = [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')];
    const d = selectedDate;
    return (
      <View style={styles.dateHeader}>
        <View style={styles.timeSlotHeader}>
          <Text style={styles.timeSlotHeaderText}>{t('timeSlot')}</Text>
        </View>
        <View style={styles.singleDateCell}>
          <Text style={styles.dateDayText}>{d.getMonth() + 1}/{d.getDate()}</Text>
          <Text style={styles.dateWeekdayText}>({weekdays[d.getDay()]})</Text>
        </View>
      </View>
    );
  };

  const renderPatrolTable = () => (
    <View>
      {renderDateHeader()}
      {TIME_SLOTS.map((timeSlot) => {
        const dateString = selectedDateString;
        const record = patrolRounds.find(
          (r) => r.patrol_date === dateString && r.scheduled_time === timeSlot
        );
        const statusLabel = record && record.notes && ['入院','渡假','外出'].includes(String(record.notes)) ? String(record.notes) : undefined;

        return (
          <View key={timeSlot} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{timeSlot}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                statusLabel ? styles.statusCell : (record && styles.completedCell),
              ]}
              onPress={() => handleCellPress(dateString, timeSlot, record)}
            >
              {statusLabel ? (
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>{t('pendingPatrol')}</Text>
              )}
              {isPastSlot(dateString, timeSlot) && !record && !statusLabel && (
                <View style={styles.missingDot} />
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderDiaperTable = () => (
    <View>
      {renderDateHeader()}
      {DIAPER_CHANGE_SLOTS.map((slot) => {
        const dateString = selectedDateString;
        const record = diaperChangeRecords.find(
          (r) => r.change_date === dateString && r.time_slot === slot.time
        );
        const slotStart = parseSlotStartTime(slot.time);
        const statusLabel = record && record.notes && ['入院','渡假','外出'].includes(String(record.notes)) ? String(record.notes) : undefined;

        return (
          <View key={slot.time} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{slot.label}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                statusLabel ? styles.statusCell : (record && styles.completedCellBlue),
              ]}
              onPress={() => handleCellPress(dateString, slot.time, record)}
              disabled={false}
            >
              {statusLabel ? (
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Text style={styles.diaperText}>
                    {Boolean(record.has_urine) && '小'}
                    {Boolean(record.has_urine) && Boolean(record.has_stool) && '/'}
                    {Boolean(record.has_stool) && '大'}
                    {Boolean(record.has_none) && '無'}
                  </Text>
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>{t('pendingRecord')}</Text>
              )}
              {isPastSlot(dateString, slot.time) && !record && !statusLabel && (
                <View style={styles.missingDot} />
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderRestraintTable = () => (
    <View>
      {renderDateHeader()}
      {TIME_SLOTS.map((timeSlot) => {
        const dateString = selectedDateString;
        const record = restraintObservationRecords.find(
          (r) => r.observation_date === dateString && r.scheduled_time === timeSlot
        );
        // no longer using isInHospital to gate cells; status is read from record.notes
        const statusLabel = record && record.notes && ['入院','渡假','外出'].includes(String(record.notes)) ? String(record.notes) : undefined;

        const getCellStyle = () => {
          if (statusLabel) return styles.statusCell;
          if (!record) return {};
          switch (record.observation_status) {
            case 'N': return styles.completedCell;
            case 'P': return styles.problemCell;
            case 'S': return styles.pausedCell;
            default: return {};
          }
        };

        return (
          <View key={timeSlot} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{timeSlot}</Text>
            </View>
            <Pressable
              style={[styles.singleDataCell, getCellStyle()]}
              onPress={() => handleCellPress(dateString, timeSlot, record)}
              disabled={false}
            >
              {statusLabel ? (
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Text style={[
                    styles.statusText,
                    record.observation_status === 'N' && styles.statusNormal,
                    record.observation_status === 'P' && styles.statusProblem,
                    record.observation_status === 'S' && styles.statusPaused,
                  ]}>
                    {record.observation_status === 'N' ? '🟢N' :
                     record.observation_status === 'P' ? '🔴P' : '🟠S'}
                  </Text>
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>{t('pendingObservation')}</Text>
              )}
              {isPastSlot(dateString, timeSlot) && !record && !statusLabel && (
                <View style={styles.missingDot} />
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderPositionTable = () => (
    <View>
      {renderDateHeader()}
      {TIME_SLOTS.map((timeSlot, idx) => {
        const positions = ['左', '平', '右'];
        const expectedPosition = positions[idx % 3];
        const dateString = selectedDateString;
        const record = positionChangeRecords.find(
          (r) => r.change_date === dateString && r.scheduled_time === timeSlot
        );
        // no longer using isInHospital to gate cells; status is read from record.notes
        const statusLabel = record && record.notes && ['入院','渡假','外出'].includes(String(record.notes)) ? String(record.notes) : undefined;

        return (
          <View key={timeSlot} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{timeSlot}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                statusLabel ? styles.statusCell : (record && styles.completedCellPurple),
              ]}
              onPress={() => handleCellPress(dateString, timeSlot, record)}
              disabled={false}
            >
              {statusLabel ? (
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Text style={styles.positionText}>{record.position}</Text>
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>[{expectedPosition}]</Text>
              )}
            {isPastSlot(dateString, timeSlot) && !record && !statusLabel && (
              <View style={styles.missingDot} />
            )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderDevelopingPlaceholder = (tabName: string) => (
    <View style={styles.placeholderContainer}>
      <Ionicons name="construct-outline" size={64} color="#d1d5db" />
      <Text style={styles.placeholderTitle}>{tabName}功能開發中</Text>
      <Text style={styles.placeholderSubtitle}>{t('comingSoon')}</Text>
    </View>
  );

  // 出入量記錄相關函數
  const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => i);

  const getHourDisplay = (hour: number) => {
    return `${String(hour).padStart(2, '0')}:00`;
  };

  const handleIntakeOutputPress = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    setShowIntakeOutputModal(true);
  };

  const saveIntakeOutputRecord = async () => {
    if (!selectedTimeSlot) return;
    
    if (!editingIntakeOutput.recorder?.trim()) {
      alert(t('pleaseEnterRecorder') || '請輸入記錄者姓名');
      return;
    }

    // 驗證胃液pH值
    if (editingIntakeOutput.gastric_output) {
      for (const item of editingIntakeOutput.gastric_output) {
        if (item.ph < 0 || item.ph > 14) {
          alert('pH值必須在0-14之間');
          return;
        }
      }
    }

    try {
      const dateString = selectedDateString;
      const existingRecord = intakeOutputRecords.find(
        r => r.record_date === dateString && r.time_slot === selectedTimeSlot
      );

      const data: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: patient.院友id,
        record_date: dateString,
        time_slot: selectedTimeSlot,
        meals: editingIntakeOutput.meals || [],
        beverages: editingIntakeOutput.beverages || [],
        tube_feeding: editingIntakeOutput.tube_feeding || [],
        urine_output: editingIntakeOutput.urine_output || [],
        gastric_output: editingIntakeOutput.gastric_output || [],
        recorder: editingIntakeOutput.recorder.trim(),
        notes: editingIntakeOutput.notes?.trim() || undefined,
      };

      if (existingRecord) {
        // 更新
        const updated = await updateIntakeOutputRecord(existingRecord.id, data);
        if (updated) {
          setIntakeOutputRecords(prev => prev.map(r => r.id === existingRecord.id ? updated : r));
        }
      } else {
        // 创建
        const newRecord = await createIntakeOutputRecord(data);
        setIntakeOutputRecords(prev => [...prev, newRecord]);
      }

      setShowIntakeOutputModal(false);
      setSelectedTimeSlot('');
      setEditingIntakeOutput({});
    } catch (error) {
      console.error('保存出入量記錄失敗:', error);
      alert(t('saveFailed') || '保存失敗，請重試');
    }
  };

  const renderIntakeOutputTable = () => {
    const dateString = selectedDateString;

    return (
      <View>
        {renderDateHeader()}
        {INTAKE_OUTPUT_SLOTS.map(timeSlot => {
          const record = intakeOutputRecords.find(
            r => r.record_date === dateString && r.time_slot === timeSlot
          );
          const statusLabel = record && record.notes && ['入院', '渡假', '外出'].includes(String(record.notes)) ? String(record.notes) : undefined;
          
          // 從 intake_items 構建詳細項目列表
          const intakeDetails: string[] = [];
          const outputDetails: string[] = [];
          
          if (record?.intake_items && record.intake_items.length > 0) {
            record.intake_items.forEach(item => {
              if (item.category === 'meal') {
                // 餐食：早餐1/2、午餐3/4
                intakeDetails.push(`${item.item_type}${item.amount || ''}`);
              } else if (item.category === 'beverage') {
                // 飲料：水200ml、湯150ml
                intakeDetails.push(`${item.item_type}${item.volume || 0}ml`);
              } else if (item.category === 'tube_feeding') {
                // 鼻胃飼：Isocal250ml
                intakeDetails.push(`${item.item_type}${item.volume || 0}ml`);
              } else if (item.category === 'other') {
                // 其他：餅乾3塊
                intakeDetails.push(`${item.item_type}${item.amount || ''}`);
              }
            });
          }
          
          if (record?.output_items && record.output_items.length > 0) {
            record.output_items.forEach(item => {
              if (item.category === 'urine') {
                // 尿液：黃300ml
                outputDetails.push(`尿${item.color || ''}${item.amount_ml}ml`);
              } else if (item.category === 'gastric') {
                // 胃液：啡pH4 100ml
                const phText = item.ph_value ? `pH${item.ph_value}` : '';
                outputDetails.push(`胃${item.color || ''}${phText}${item.amount_ml}ml`);
              }
            });
          }

          return (
            <View key={timeSlot} style={styles.tableRow}>
              <View style={styles.timeSlotCell}>
                <Text style={styles.timeSlotText}>{timeSlot}</Text>
              </View>
              <Pressable
                style={[
                  styles.singleDataCell,
                  statusLabel ? styles.statusCell : (record && styles.completedCellBlue),
                ]}
                onPress={() => handleIntakeOutputPress(timeSlot)}
              >
                {statusLabel ? (
                  <Text style={styles.statusLabel}>{statusLabel}</Text>
                ) : record ? (
                  <View style={styles.completedContent}>
                    <View style={{ gap: 2, flex: 1 }}>
                      {intakeDetails.length > 0 && (
                        <Text style={[styles.diaperText, { fontSize: 11, color: '#059669' }]} numberOfLines={3}>
                          ▲ {intakeDetails.join('、')}
                        </Text>
                      )}
                      {outputDetails.length > 0 && (
                        <Text style={[styles.diaperText, { fontSize: 11, color: '#dc2626' }]} numberOfLines={2}>
                          ▼ {outputDetails.join('、')}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pendingText}>{t('pendingRecord')}</Text>
                )}
                {isPastSlot(dateString, timeSlot) && !record && !statusLabel && (
                  <View style={styles.missingDot} />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderHygieneTable = () => {
    const dateString = selectedDateString;
    const record = hygieneRecords.find(r => r.record_date === dateString);
    const statusNotes = record?.status_notes;
    const hasStatusNotes = statusNotes && ['入院','渡假','外出'].includes(statusNotes);

    return (
      <View>
        {renderDateHeader()}
        {HYGIENE_ITEMS.map((item, index) => {
          const itemLabel = t(item.labelKey);
          let cellContent: React.ReactNode = null;
          let cellStyle = [styles.singleDataCell];
          let isDisabled = false;

          // 當有狀態備註時，除了備註行外，其他所有行都變灰
          if (hasStatusNotes && !item.isStatus) {
            isDisabled = true;
            cellStyle.push(styles.disabledCell);
          }

          if (item.isStatus) {
            // 備註行：顯示狀態（入院/渡假/外出）
            if (hasStatusNotes) {
              cellStyle.push(styles.statusCell);
              cellContent = <Text style={styles.statusLabel}>{statusNotes}</Text>;
            } else if (record) {
              cellStyle.push(styles.completedCell);
              cellContent = (
                <View style={styles.completedContent}>
                  <Text style={styles.statusText}>-</Text>
                </View>
              );
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          } else if (item.isBowelCount) {
            // 大便次數行
            if (isDisabled) {
              cellContent = <Text style={styles.disabledText}>-</Text>;
            } else if (record?.bowel_count !== undefined && record.bowel_count !== null) {
              cellStyle.push(styles.completedCell);
              cellContent = (
                <View style={styles.completedContent}>
                  <Text style={styles.statusText}>{record.bowel_count} 次</Text>
                </View>
              );
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          } else if (item.isBowelAmount) {
            // 大便量行
            if (isDisabled) {
              cellContent = <Text style={styles.disabledText}>-</Text>;
            } else if (record?.bowel_amount) {
              cellStyle.push(styles.completedCell);
              cellContent = (
                <View style={styles.completedContent}>
                  <Text style={styles.statusText}>{record.bowel_amount}</Text>
                </View>
              );
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          } else if (item.isBowelConsistency) {
            // 大便性質行
            if (isDisabled) {
              cellContent = <Text style={styles.disabledText}>-</Text>;
            } else if (record?.bowel_consistency) {
              cellStyle.push(styles.completedCell);
              cellContent = (
                <View style={styles.completedContent}>
                  <Text style={styles.statusText}>{record.bowel_consistency}</Text>
                </View>
              );
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          } else if (item.isBowelMedication) {
            // 大便藥行
            if (isDisabled) {
              cellContent = <Text style={styles.disabledText}>-</Text>;
            } else if (record?.bowel_medication) {
              cellStyle.push(styles.completedCell);
              cellContent = (
                <View style={styles.completedContent}>
                  <Text style={styles.statusText}>{record.bowel_medication}</Text>
                </View>
              );
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          } else {
            // 護理項目行：顯示 ✓ 或 -
            if (isDisabled) {
              cellContent = <Text style={styles.disabledText}>-</Text>;
            } else if (record) {
              const rawValue = (record as any)[item.key];
              const isChecked = rawValue === true || rawValue === 'true';
              if (isChecked) {
                cellStyle.push(styles.completedCell);
                cellContent = (
                  <View style={styles.completedContent}>
                    <Text style={styles.statusText}>✓</Text>
                  </View>
                );
              } else {
                cellContent = <Text style={styles.pendingText}>-</Text>;
              }
            } else {
              cellContent = <Text style={styles.pendingText}>-</Text>;
            }
          }

          // 判斷是否為護理項目（需要inline toggle）
          const isCareItem = !item.isStatus && !item.isBowelCount && !item.isBowelAmount && !item.isBowelConsistency && !item.isBowelMedication;
          const handlePress = () => {
            if (isDisabled) return;
            if (isCareItem) {
              // 護理項目：直接toggle
              // 确保布尔值类型正确，处理可能的字符串值
              const rawValue = record ? (record as any)[item.key] : false;
              const currentValue = rawValue === true || rawValue === 'true';
              toggleHygieneCareItem(dateString, item.key, currentValue);
            } else if (item.isStatus) {
              // 備註：顯示選單
              setPickerDate(dateString);
              setPickerType('status');
              setShowPickerModal(true);
            } else if (item.isBowelCount) {
              // 大便次數：顯示選單
              setPickerDate(dateString);
              setPickerType('count');
              setShowPickerModal(true);
            } else if (item.isBowelAmount) {
              // 大便量：顯示選單
              setPickerDate(dateString);
              setPickerType('amount');
              setShowPickerModal(true);
            } else if (item.isBowelConsistency) {
              // 大便性質：顯示選單
              setPickerDate(dateString);
              setPickerType('consistency');
              setShowPickerModal(true);
            } else if (item.isBowelMedication) {
              // 大便藥：顯示選單
              setPickerDate(dateString);
              setPickerType('medication');
              setShowPickerModal(true);
            }
          };

          return (
            <View key={item.key} style={styles.tableRow}>
              <View style={styles.timeSlotCell}>
                <Text style={styles.timeSlotText}>{itemLabel}</Text>
              </View>
              <Pressable
                style={cellStyle}
                onPress={handlePress}
                disabled={Boolean(isDisabled)}
              >
                {cellContent}
                {/* 紅點顯示邏輯：只在備註行顯示，且沒有任何記錄時才顯示 */}
                {index === 0 && !isDisabled && isPastSlot(dateString, 'daily') && !record && !hasStatusNotes && (
                  <View style={styles.missingDot} />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'patrol':
        return renderPatrolTable();
      case 'diaper':
        return renderDiaperTable();
      case 'intake_output':
        return renderIntakeOutputTable();
      case 'restraint':
        return renderRestraintTable();
      case 'position':
        return renderPositionTable();
      case 'hygiene':
        return renderHygieneTable();
      case 'toilet_training':
        return renderDevelopingPlaceholder('如廁訓練記錄');
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  const renderDatePicker = () => {
    if (!showDatePicker) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    
    // Get month names
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
    
    // 生成当前月份的日期
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    const dates: (Date | null)[] = [];
    // 添加空白填充
    for (let i = 0; i < firstDayOfMonth; i++) {
      dates.push(null);
    }
    // 添加日期
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(new Date(currentYear, currentMonth, i));
    }

    // 检查某个日期是否有缺失记录
    const checkDateHasMissing = (date: Date): boolean => {
      const dateStr = formatDate(date);
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      // 調試：針對特定日期（如12/18）輸出詳細信息
      const isDebugDate = dateStr === '2025-12-18';
      if (isDebugDate) {
        console.log(`\n=== 檢查日期 ${dateStr} 的缺失記錄 ===`);
      }
      
      // 未来日期不检查
      if (dateObj > now) {
        if (isDebugDate) console.log('  ❌ 未來日期，跳過');
        return false;
      }
      
      // 检查是否超出回溯天数限制
      const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > missingLookbackDays) {
        if (isDebugDate) console.log(`  ❌ 超出回溯天數限制：${daysDiff} > ${missingLookbackDays}`);
        return false;
      }
      
      // 如果careTabs沒有加載，不顯示紅點
      if (!careTabs || careTabs.length === 0) {
        if (isDebugDate) console.log('  ❌ careTabs未加載');
        return false;
      }
      
      if (isDebugDate) {
        console.log(`  ✓ 天數差：${daysDiff}天`);
        console.log(`  ✓ 可用選項卡：`, availableTabs);
      }
      
      // 检查所有可用选项卡
      for (const tab of availableTabs) {
        // 检查日期是否在选项卡启用日期之后
        const tabConfig = careTabs.find(t => t.tab_type === tab);
        if (tabConfig && tabConfig.last_activated_at) {
          const tabActivatedDate = new Date(tabConfig.last_activated_at);
          tabActivatedDate.setHours(0, 0, 0, 0);
          
          if (isDebugDate) {
            console.log(`  檢查選項卡 ${tab}:`);
            console.log(`    - last_activated_at: ${tabConfig.last_activated_at}`);
            console.log(`    - 啟用日期: ${formatDate(tabActivatedDate)}`);
            console.log(`    - 當前日期: ${dateStr}`);
          }
          
          // 如果当前日期在选项卡启用日期之前，跳过此选项卡的检查
          if (dateObj < tabActivatedDate) {
            if (isDebugDate) console.log(`    ⏭️  日期在啟用之前，跳過`);
            continue;
          }
        }
        
        if (isDebugDate) console.log(`  檢查選項卡 ${tab} 的缺失記錄...`);
        
        switch (tab) {
          case 'patrol': {
            const existing = patrolRounds.filter(r => r.patrol_date === dateStr);
            const hasMissing = TIME_SLOTS.some(slot => {
              const existingRecord = existing.find(r => r.scheduled_time === slot);
              if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
                return false;
              }
              return !existingRecord && isPastSlot(dateStr, slot);
            });
            if (hasMissing) {
              if (isDebugDate) console.log(`    ✅ 發現缺失記錄 (巡房)`);
              return true;
            }
            break;
          }
          case 'diaper': {
            const existing = diaperChangeRecords.filter(r => r.change_date === dateStr);
            const hasMissing = DIAPER_CHANGE_SLOTS.some(slot => {
              const existingRecord = existing.find(r => r.time_slot === slot.time);
              if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
                return false;
              }
              return !existingRecord && isPastSlot(dateStr, slot.time);
            });
            if (hasMissing) {
              if (isDebugDate) console.log(`    ✅ 發現缺失記錄 (換片)`);
              return true;
            }
            break;
          }
          case 'restraint': {
            const hasActiveRestraint = restraintAssessments.some(
              a => a.patient_id === patient.院友id && a.suggested_restraints && 
                   Object.values(a.suggested_restraints).some(v => v === true)
            );
            if (!hasActiveRestraint) break;
            const existing = restraintObservationRecords.filter(r => r.observation_date === dateStr);
            const hasMissing = TIME_SLOTS.some(slot => {
              const existingRecord = existing.find(r => r.scheduled_time === slot);
              if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
                return false;
              }
              return !existingRecord && isPastSlot(dateStr, slot);
            });
            if (hasMissing) {
              if (isDebugDate) console.log(`    ✅ 發現缺失記錄 (約束)`);
              return true;
            }
            break;
          }
          case 'position': {
            const existing = positionChangeRecords.filter(r => r.change_date === dateStr);
            const hasMissing = TIME_SLOTS.some(slot => {
              const existingRecord = existing.find(r => r.scheduled_time === slot);
              if (existingRecord?.notes && ['入院', '渡假', '外出'].includes(existingRecord.notes)) {
                return false;
              }
              return !existingRecord && isPastSlot(dateStr, slot);
            });
            if (hasMissing) {
              if (isDebugDate) console.log(`    ✅ 發現缺失記錄 (轉身)`);
              return true;
            }
            break;
          }
          case 'hygiene': {
            const existing = hygieneRecords.find(r => r.record_date === dateStr);
            if (existing?.status_notes && ['入院', '渡假', '外出'].includes(existing.status_notes)) {
              break;
            }
            const hasMissing = !existing && isPastSlot(dateStr, 'daily');
            if (hasMissing) {
              if (isDebugDate) console.log(`    ✅ 發現缺失記錄 (衛生)`);
              return true;
            }
            break;
          }
        }
      }
      
      if (isDebugDate) console.log(`  ❌ 沒有發現缺失記錄`);
      return false;
    };

    const handlePrevMonth = () => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      newDate.setDate(1); // 切换到1号
      setSelectedDate(newDate);
      loadMonthData(newDate);
    };

    const handleNextMonth = () => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + 1);
      newDate.setDate(1); // 切换到1号
      // 不能超过当前月份
      if (newDate <= today) {
        setSelectedDate(newDate);
        loadMonthData(newDate);
      }
    };

    const canGoNextMonth = () => {
      const nextMonth = new Date(selectedDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      return nextMonth <= today;
    };

    return (
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.calendarContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={handlePrevMonth}>
                <Ionicons name="chevron-back" size={24} color="#374151" />
              </Pressable>
              <Text style={styles.calendarTitle}>
                {currentYear}     {t(monthNames[currentMonth] as any)}
              </Text>
              <Pressable onPress={handleNextMonth} disabled={!canGoNextMonth()}>
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={canGoNextMonth() ? '#374151' : '#d1d5db'} 
                />
              </Pressable>
            </View>
            
            <View style={styles.calendarWeekdays}>
              {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day, i) => (
                <Text key={i} style={styles.weekdayText}>{t(day as any)}</Text>
              ))}
            </View>
            
            <View style={styles.calendarDays}>
              {dates.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.calendarDay} />;
                }
                
                const dateObj = new Date(date);
                dateObj.setHours(0, 0, 0, 0);
                const isSelected = formatDate(date) === formatDate(selectedDate);
                const isFuture = dateObj > today;
                const isCurrentDay = formatDate(date) === formatDate(new Date());
                
                // 计算该日期是否有缺失记录
                const hasMissing = !isFuture && checkDateHasMissing(date);
                
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isFuture && styles.calendarDayDisabled,
                    ]}
                    onPress={() => !isFuture && handleDateSelect(date)}
                    disabled={isFuture}
                  >
                    <View style={styles.calendarDayContent}>
                      <Text
                        style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                          isFuture && styles.calendarDayTextDisabled,
                          isCurrentDay && !isSelected && styles.calendarDayTextToday,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                      {hasMissing && <View style={styles.calendarDayBadge} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            
            <Pressable 
              style={styles.calendarCloseButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.calendarCloseButtonText}>{t('close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // 渲染選單Modal
  const renderPickerModal = () => {
    if (!pickerType) return null;
    
    const currentRecord = hygieneRecords.find(r => r.record_date === pickerDate);
    let title = '';
    let options: { label: string; value: string }[] = [];
    let currentValue = '';
    
    switch (pickerType) {
      case 'status':
        title = t('noteOrStatus');
        options = [
          { label: '-- 選擇 --', value: '' },
          { label: '入院', value: '入院' },
          { label: '渡假', value: '渡假' },
          { label: '外出', value: '外出' },
        ];
        currentValue = currentRecord?.status_notes || '';
        break;
      case 'count':
        title = t('bowelCount');
        options = [
          { label: '-- 選擇 --', value: '' },
          { label: '0', value: '0' },
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
          { label: '6', value: '6' },
          { label: '7', value: '7' },
          { label: '8', value: '8' },
          { label: '9', value: '9' },
          { label: '10', value: '10' },
        ];
        currentValue = currentRecord?.bowel_count !== null && currentRecord?.bowel_count !== undefined 
          ? String(currentRecord.bowel_count) 
          : '';
        break;
      case 'amount':
        title = t('bowelAmount');
        options = [
          { label: '-- 選擇 --', value: '' },
          { label: '少', value: '少' },
          { label: '中', value: '中' },
          { label: '多', value: '多' },
        ];
        currentValue = currentRecord?.bowel_amount || '';
        break;
      case 'consistency':
        title = t('bowelConsistency');
        options = [
          { label: '-- 選擇 --', value: '' },
          { label: '硬', value: '硬' },
          { label: '軟', value: '軟' },
          { label: '稀', value: '稀' },
          { label: '水狀', value: '水狀' },
        ];
        currentValue = currentRecord?.bowel_consistency || '';
        break;
      case 'medication':
        title = t('bowelMedication');
        options = [
          { label: '-- 選擇 --', value: '' },
          { label: '樂可舒', value: '樂可舒' },
          { label: '氧化鎂', value: '氧化鎂' },
          { label: '軟便劑', value: '軟便劑' },
          { label: '其他', value: '其他' },
        ];
        currentValue = currentRecord?.bowel_medication || '';
        break;
    }
    
    const handleSelect = async (value: string) => {
      setShowPickerModal(false);
      
      if (pickerType === 'status') {
        await updateHygieneStatus(pickerDate, value);
      } else if (pickerType === 'count') {
        const numValue = value ? parseInt(value) : null;
        await updateHygieneBowel(pickerDate, 'bowel_count', numValue);
      } else {
        const field = pickerType === 'amount' ? 'bowel_amount' 
          : pickerType === 'consistency' ? 'bowel_consistency' 
          : 'bowel_medication';
        await updateHygieneBowel(pickerDate, field, value || null);
      }
    };
    
    return (
      <Modal
        visible={showPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPickerModal(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{title}</Text>
              <Pressable 
                onPress={() => setShowPickerModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView style={styles.optionsContainer}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionItem,
                    currentValue === option.value && styles.optionItemSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      currentValue === option.value && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {currentValue === option.value && (
                    <Ionicons name="checkmark" size={20} color="#2563eb" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    );
  };

  const renderIntakeOutputModal = () => {
    if (!showIntakeOutputModal || !selectedTimeSlot) return null;

    const existingRecord = intakeOutputRecords.find(
      r => r.record_date === selectedDateString && r.time_slot === selectedTimeSlot
    );

    const isSpecialStatus = Boolean(editingIntakeOutput.notes && ['入院', '渡假', '外出'].includes(editingIntakeOutput.notes));

    const handleStatusButtonClick = (status: string) => {
      if (editingIntakeOutput.notes === status) {
        setEditingIntakeOutput(prev => ({ ...prev, notes: '' }));
      } else {
        // 清空所有輸入欄位
        setEditingIntakeOutput({
          meals: [],
          beverages: [],
          tube_feeding: [],
          urine_output: [],
          gastric_output: [],
          recorder: editingIntakeOutput.recorder || displayName || '未知',
          notes: status,
        });
      }
    };

    const mealTypes = ['早餐', '午餐', '下午茶', '晚餐'];
    const mealAmounts = ['1', '1/4', '1/2', '3/4'];
    const beverageTypes = ['清水', '湯', '奶', '果汁', '糖水', '茶'];
    const tubeFeedingTypes = ['Isocal', 'Glucerna', 'Compleat'];

    return (
      <Modal
        visible={showIntakeOutputModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowIntakeOutputModal(false);
          setSelectedTimeSlot('');
          setEditingIntakeOutput({});
        }}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => {
            setShowIntakeOutputModal(false);
            setSelectedTimeSlot('');
            setEditingIntakeOutput({});
          }}
        >
          <Pressable 
            style={[styles.modalContent, { maxHeight: '90%', width: '92%' }]} 
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={true}>
              <Text style={styles.modalTitle}>
                {existingRecord ? '查看/編輯出入量記錄' : '新增出入量記錄'}
              </Text>

              {/* 院友姓名 */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>院友姓名</Text>
                <TextInput
                  value={patient.中文姓名}
                  editable={false}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 16,
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                  }}
                />
              </View>

              {/* 記錄日期和時段 */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>記錄日期</Text>
                  <TextInput
                    value={selectedDateString}
                    editable={false}
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 16,
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>時段</Text>
                  <TextInput
                    value={selectedTimeSlot}
                    editable={false}
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 16,
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                    }}
                  />
                </View>
              </View>

              {/* 記錄者 */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>記錄者 *</Text>
                <TextInput
                  value={editingIntakeOutput.recorder || ''}
                  onChangeText={(text) => setEditingIntakeOutput(prev => ({ ...prev, recorder: text }))}
                  editable={!isSpecialStatus}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 16,
                    backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                    color: isSpecialStatus ? '#6b7280' : '#111827',
                  }}
                  placeholder="請輸入記錄者姓名"
                />
              </View>

              {/* 狀態按鈕 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 6 }}>狀態</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['入院', '渡假', '外出'].map(status => (
                    <Pressable
                      key={status}
                      onPress={() => handleStatusButtonClick(status)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: editingIntakeOutput.notes === status ? '#2563eb' : '#f3f4f6',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: editingIntakeOutput.notes === status ? '#fff' : '#374151',
                      }}>
                        {status}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#059669', marginBottom: 10 }}>
                  ▲ 攝入量
                </Text>

                {/* 餐食動態列表 */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>餐食</Text>
                    <Pressable
                      onPress={() => {
                        const newMeals = [...(editingIntakeOutput.meals || []), { meal_type: '早餐', amount: '1' }];
                        setEditingIntakeOutput(prev => ({ ...prev, meals: newMeals }));
                      }}
                      disabled={isSpecialStatus}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isSpecialStatus ? '#f3f4f6' : '#10b981',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: isSpecialStatus ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '500' }}>+ 新增餐食</Text>
                    </Pressable>
                  </View>
                  {(editingIntakeOutput.meals || []).map((meal, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>類型</Text>
                        <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff' }}>
                          <Picker
                            selectedValue={meal.meal_type}
                            onValueChange={(value) => {
                              const newMeals = [...(editingIntakeOutput.meals || [])];
                              newMeals[index].meal_type = value;
                              setEditingIntakeOutput(prev => ({ ...prev, meals: newMeals }));
                            }}
                            enabled={!isSpecialStatus}
                            style={{ height: 40 }}
                          >
                            {mealTypes.map(type => (
                              <Picker.Item key={type} label={type} value={type} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                      <View style={{ width: 100 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>份量</Text>
                        <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff' }}>
                          <Picker
                            selectedValue={meal.amount}
                            onValueChange={(value) => {
                              const newMeals = [...(editingIntakeOutput.meals || [])];
                              newMeals[index].amount = value;
                              setEditingIntakeOutput(prev => ({ ...prev, meals: newMeals }));
                            }}
                            enabled={!isSpecialStatus}
                            style={{ height: 40 }}
                          >
                            {mealAmounts.map(amount => (
                              <Picker.Item key={amount} label={amount} value={amount} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          const newMeals = (editingIntakeOutput.meals || []).filter((_, i) => i !== index);
                          setEditingIntakeOutput(prev => ({ ...prev, meals: newMeals }));
                        }}
                        disabled={isSpecialStatus}
                        style={{
                          width: 40,
                          height: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fee2e2',
                          borderRadius: 6,
                          marginTop: 14,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={isSpecialStatus ? '#9ca3af' : '#dc2626'} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* 飲品動態列表 */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>飲品 (ml)</Text>
                    <Pressable
                      onPress={() => {
                        const newBeverages = [...(editingIntakeOutput.beverages || []), { type: '清水', amount: 0 }];
                        setEditingIntakeOutput(prev => ({ ...prev, beverages: newBeverages }));
                      }}
                      disabled={isSpecialStatus}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isSpecialStatus ? '#f3f4f6' : '#10b981',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: isSpecialStatus ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '500' }}>+ 新增飲品</Text>
                    </Pressable>
                  </View>
                  {(editingIntakeOutput.beverages || []).map((beverage, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>類型</Text>
                        <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff' }}>
                          <Picker
                            selectedValue={beverage.type}
                            onValueChange={(value) => {
                              const newBeverages = [...(editingIntakeOutput.beverages || [])];
                              newBeverages[index].type = value;
                              setEditingIntakeOutput(prev => ({ ...prev, beverages: newBeverages }));
                            }}
                            enabled={!isSpecialStatus}
                            style={{ height: 40 }}
                          >
                            {beverageTypes.map(type => (
                              <Picker.Item key={type} label={type} value={type} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                      <View style={{ width: 100 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>ml</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={String(beverage.amount)}
                          onChangeText={(text) => {
                            const newBeverages = [...(editingIntakeOutput.beverages || [])];
                            newBeverages[index].amount = parseInt(text) || 0;
                            setEditingIntakeOutput(prev => ({ ...prev, beverages: newBeverages }));
                          }}
                          editable={!isSpecialStatus}
                          style={{
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 6,
                            padding: 8,
                            fontSize: 14,
                            backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                          }}
                          placeholder="0"
                        />
                      </View>
                      <Pressable
                        onPress={() => {
                          const newBeverages = (editingIntakeOutput.beverages || []).filter((_, i) => i !== index);
                          setEditingIntakeOutput(prev => ({ ...prev, beverages: newBeverages }));
                        }}
                        disabled={isSpecialStatus}
                        style={{
                          width: 40,
                          height: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fee2e2',
                          borderRadius: 6,
                          marginTop: 14,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={isSpecialStatus ? '#9ca3af' : '#dc2626'} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* 管飼動態列表 */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>管飼 (ml)</Text>
                    <Pressable
                      onPress={() => {
                        const newTubeFeeding = [...(editingIntakeOutput.tube_feeding || []), { type: 'Isocal', amount: 0 }];
                        setEditingIntakeOutput(prev => ({ ...prev, tube_feeding: newTubeFeeding }));
                      }}
                      disabled={isSpecialStatus}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isSpecialStatus ? '#f3f4f6' : '#10b981',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: isSpecialStatus ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '500' }}>+ 新增管飼</Text>
                    </Pressable>
                  </View>
                  {(editingIntakeOutput.tube_feeding || []).map((tube, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>類型</Text>
                        <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff' }}>
                          <Picker
                            selectedValue={tube.type}
                            onValueChange={(value) => {
                              const newTubeFeeding = [...(editingIntakeOutput.tube_feeding || [])];
                              newTubeFeeding[index].type = value;
                              setEditingIntakeOutput(prev => ({ ...prev, tube_feeding: newTubeFeeding }));
                            }}
                            enabled={!isSpecialStatus}
                            style={{ height: 40 }}
                          >
                            {tubeFeedingTypes.map(type => (
                              <Picker.Item key={type} label={type} value={type} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                      <View style={{ width: 100 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>ml</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={String(tube.amount)}
                          onChangeText={(text) => {
                            const newTubeFeeding = [...(editingIntakeOutput.tube_feeding || [])];
                            newTubeFeeding[index].amount = parseInt(text) || 0;
                            setEditingIntakeOutput(prev => ({ ...prev, tube_feeding: newTubeFeeding }));
                          }}
                          editable={!isSpecialStatus}
                          style={{
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 6,
                            padding: 8,
                            fontSize: 14,
                            backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                          }}
                          placeholder="0"
                        />
                      </View>
                      <Pressable
                        onPress={() => {
                          const newTubeFeeding = (editingIntakeOutput.tube_feeding || []).filter((_, i) => i !== index);
                          setEditingIntakeOutput(prev => ({ ...prev, tube_feeding: newTubeFeeding }));
                        }}
                        disabled={isSpecialStatus}
                        style={{
                          width: 40,
                          height: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fee2e2',
                          borderRadius: 6,
                          marginTop: 14,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={isSpecialStatus ? '#9ca3af' : '#dc2626'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#dc2626', marginBottom: 10 }}>
                  ▼ 排出量
                </Text>

                {/* 尿液動態列表 */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>尿液</Text>
                    <Pressable
                      onPress={() => {
                        const newUrineOutput = [...(editingIntakeOutput.urine_output || []), { volume: 0, color: '' }];
                        setEditingIntakeOutput(prev => ({ ...prev, urine_output: newUrineOutput }));
                      }}
                      disabled={isSpecialStatus}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isSpecialStatus ? '#f3f4f6' : '#dc2626',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: isSpecialStatus ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '500' }}>+ 新增尿液記錄</Text>
                    </Pressable>
                  </View>
                  {(editingIntakeOutput.urine_output || []).map((urine, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <View style={{ width: 100 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>容量 (ml)</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={String(urine.volume)}
                          onChangeText={(text) => {
                            const newUrineOutput = [...(editingIntakeOutput.urine_output || [])];
                            newUrineOutput[index].volume = parseInt(text) || 0;
                            setEditingIntakeOutput(prev => ({ ...prev, urine_output: newUrineOutput }));
                          }}
                          editable={!isSpecialStatus}
                          style={{
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 6,
                            padding: 8,
                            fontSize: 14,
                            backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                          }}
                          placeholder="ml"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>顏色</Text>
                        <TextInput
                          value={urine.color}
                          onChangeText={(text) => {
                            const newUrineOutput = [...(editingIntakeOutput.urine_output || [])];
                            newUrineOutput[index].color = text;
                            setEditingIntakeOutput(prev => ({ ...prev, urine_output: newUrineOutput }));
                          }}
                          editable={!isSpecialStatus}
                          style={{
                            borderWidth: 1,
                            borderColor: '#d1d5db',
                            borderRadius: 6,
                            padding: 8,
                            fontSize: 14,
                            backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                          }}
                          placeholder="透明、黃、啡"
                        />
                      </View>
                      <Pressable
                        onPress={() => {
                          const newUrineOutput = (editingIntakeOutput.urine_output || []).filter((_, i) => i !== index);
                          setEditingIntakeOutput(prev => ({ ...prev, urine_output: newUrineOutput }));
                        }}
                        disabled={isSpecialStatus}
                        style={{
                          width: 40,
                          height: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fee2e2',
                          borderRadius: 6,
                          marginTop: 14,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={isSpecialStatus ? '#9ca3af' : '#dc2626'} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* 胃液動態列表 */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>胃液</Text>
                    <Pressable
                      onPress={() => {
                        const newGastricOutput = [...(editingIntakeOutput.gastric_output || []), { volume: 0, ph: 7, color: '' }];
                        setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
                      }}
                      disabled={isSpecialStatus}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isSpecialStatus ? '#f3f4f6' : '#dc2626',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: isSpecialStatus ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '500' }}>+ 新增胃液記錄</Text>
                    </Pressable>
                  </View>
                  {(editingIntakeOutput.gastric_output || []).map((gastric, index) => (
                    <View key={index} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <View style={{ width: 80 }}>
                          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>容量 (ml)</Text>
                          <TextInput
                            keyboardType="numeric"
                            value={String(gastric.volume)}
                            onChangeText={(text) => {
                              const newGastricOutput = [...(editingIntakeOutput.gastric_output || [])];
                              newGastricOutput[index].volume = parseInt(text) || 0;
                              setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
                            }}
                            editable={!isSpecialStatus}
                            style={{
                              borderWidth: 1,
                              borderColor: '#d1d5db',
                              borderRadius: 6,
                              padding: 8,
                              fontSize: 14,
                              backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                            }}
                            placeholder="ml"
                          />
                        </View>
                        <View style={{ width: 80 }}>
                          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>pH (0-14)</Text>
                          <TextInput
                            keyboardType="numeric"
                            value={String(gastric.ph)}
                            onChangeText={(text) => {
                              const newGastricOutput = [...(editingIntakeOutput.gastric_output || [])];
                              const ph = parseFloat(text) || 0;
                              if (ph >= 0 && ph <= 14) {
                                newGastricOutput[index].ph = ph;
                                setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
                              }
                            }}
                            editable={!isSpecialStatus}
                            style={{
                              borderWidth: 1,
                              borderColor: '#d1d5db',
                              borderRadius: 6,
                              padding: 8,
                              fontSize: 14,
                              backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                            }}
                            placeholder="pH"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>顏色</Text>
                          <TextInput
                            value={gastric.color}
                            onChangeText={(text) => {
                              const newGastricOutput = [...(editingIntakeOutput.gastric_output || [])];
                              newGastricOutput[index].color = text;
                              setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
                            }}
                            editable={!isSpecialStatus}
                            style={{
                              borderWidth: 1,
                              borderColor: '#d1d5db',
                              borderRadius: 6,
                              padding: 8,
                              fontSize: 14,
                              backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fff',
                            }}
                            placeholder="顏色"
                          />
                        </View>
                        <Pressable
                          onPress={() => {
                            const newGastricOutput = (editingIntakeOutput.gastric_output || []).filter((_, i) => i !== index);
                            setEditingIntakeOutput(prev => ({ ...prev, gastric_output: newGastricOutput }));
                          }}
                          disabled={isSpecialStatus}
                          style={{
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: isSpecialStatus ? '#f3f4f6' : '#fee2e2',
                            borderRadius: 6,
                            marginTop: 14,
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color={isSpecialStatus ? '#9ca3af' : '#dc2626'} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* 按鈕 */}
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowIntakeOutputModal(false);
                    setSelectedTimeSlot('');
                    setEditingIntakeOutput({});
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>{t('cancel')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={saveIntakeOutputRecord}
                >
                  <Text style={styles.modalButtonTextConfirm}>{t('save')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const visibleTabs = getVisibleTabs();
  const hasVisibleTabs = visibleTabs.length > 0;

  return (
    <View style={styles.container}>
      {renderPatientHeader()}
      {hasVisibleTabs && renderTabs()}
      {renderDateNavigation()}
      {renderDatePicker()}
      {renderPickerModal()}
      <IntakeOutputModal
        visible={showIntakeOutputModal}
        onClose={() => {
          setShowIntakeOutputModal(false);
          setSelectedTimeSlot('');
        }}
        patient={patient}
        date={selectedDateString}
        timeSlot={selectedTimeSlot || ''}
        existingRecord={(() => {
          const record = intakeOutputRecords.find(
            r => r.record_date === selectedDateString && r.time_slot === selectedTimeSlot
          );
          if (record) {
            console.log('找到現有記錄:', {
              id: record.id,
              recorder: record.recorder,
              intakeItemsCount: record.intake_items?.length || 0,
              outputItemsCount: record.output_items?.length || 0,
            });
          } else {
            console.log('未找到現有記錄，將新建');
          }
          return record;
        })()}
        onSave={(record) => {
          console.log('保存記錄成功:', {
            id: record.id,
            intakeItemsCount: record.intake_items?.length || 0,
            outputItemsCount: record.output_items?.length || 0,
          });
          // 更新记录列表
          setIntakeOutputRecords(prev => {
            const existing = prev.find(r => r.id === record.id);
            if (existing) {
              return prev.map(r => r.id === record.id ? record : r);
            } else {
              return [...prev, record];
            }
          });
          setShowIntakeOutputModal(false);
          setSelectedTimeSlot('');
        }}
        onDelete={(recordId) => {
          console.log('刪除記錄成功:', recordId);
          // 從列表中移除記錄
          setIntakeOutputRecords(prev => prev.filter(r => r.id !== recordId));
          setShowIntakeOutputModal(false);
          setSelectedTimeSlot('');
        }}
        staffName={displayName || '未知'}
      />
      <ScrollView
        style={styles.tableContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {hasVisibleTabs ? (
          renderContent()
        ) : (
          <View style={styles.emptyTabsContainer}>
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTabsText}>
              {t('noTabsAvailableForDate')}
            </Text>
            <Text style={styles.emptyTabsSubtext}>
              {t('selectDifferentDate')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyTabsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTabsText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  emptyTabsSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  patientHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  patientMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 6,
    marginHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabBadge: {
    marginLeft: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
  },
  tabActive: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    minWidth: 90,
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    marginHorizontal: 4,
  },
  navButtonTextDisabled: {
    color: '#d1d5db',
  },
  dateSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    minWidth: 120,
    justifyContent: 'center',
    gap: 6,
  },
  dateSelectButtonText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  calendarDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  calendarDayDisabled: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 15,
    color: '#374151',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  calendarDayTextDisabled: {
    color: '#d1d5db',
  },
  calendarDayTextToday: {
    color: '#2563eb',
    fontWeight: '600',
  },
  calendarDayBadge: {
    marginTop: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dc2626',
  },
  calendarCloseButton: {
    marginTop: 20,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calendarCloseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  dateHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timeSlotHeader: {
    width: 90,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  timeSlotHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dateCell: {
    width: 70,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  singleDateCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dateDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  dateWeekdayText: {
    fontSize: 11,
    color: '#6b7280',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timeSlotCell: {
    width: 90,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  dataCell: {
    width: 70,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    minHeight: 60,
  },
  singleDataCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 70,
    position: 'relative',
  },
  hospitalCell: {
    backgroundColor: '#f3f4f6',
  },
  statusCell: {
    backgroundColor: '#f3f4f6',
  },
  completedCell: {
    backgroundColor: '#f0fdf4',
  },
  completedCellBlue: {
    backgroundColor: '#eff6ff',
  },
  completedCellPurple: {
    backgroundColor: '#faf5ff',
  },
  problemCell: {
    backgroundColor: '#fef2f2',
  },
  pausedCell: {
    backgroundColor: '#fffbeb',
  },
  disabledCell: {
    backgroundColor: '#e5e7eb',
  },
  hospitalText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  completedContent: {
    alignItems: 'center',
  },
  recorderText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  pendingText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  disabledText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  diaperText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusNormal: {
    color: '#16a34a',
  },
  statusProblem: {
    color: '#dc2626',
  },
  statusPaused: {
    color: '#d97706',
  },
  positionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  missingDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: '#fff',
  },
  // 選單Modal樣式
  pickerContainer: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionItemSelected: {
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  // 出入量模態框樣式
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '92%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonConfirm: {
    backgroundColor: '#2563eb',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default CareRecordsScreen;
