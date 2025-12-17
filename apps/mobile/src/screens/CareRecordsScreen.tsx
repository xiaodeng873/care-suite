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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  Patient,
  PatrolRound,
  DiaperChangeRecord,
  RestraintObservationRecord,
  PositionChangeRecord,
  PatientRestraintAssessment,
  PatientAdmissionRecord,
  PatientCareTab,
  HealthAssessment,
  getPatrolRoundsInDateRange,
  getDiaperChangeRecordsInDateRange,
  getRestraintObservationRecordsInDateRange,
  getPositionChangeRecordsInDateRange,
  getRestraintAssessments,
  getPatientAdmissionRecords,
  getPatientCareTabs,
  getHealthAssessments,
} from '../lib/database';
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  generateWeekDates,
  getWeekStartDate,
  formatDate,
  isInHospital,
  isPastSlot,
  parseSlotStartTime,
} from '../utils/careRecordHelper';
import { eventBus } from '../lib/eventBus';
import { getMissingLookbackDays } from '../lib/settings';
import { useTranslation, usePatientName } from '../lib/i18n';

type TabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';

const TAB_CONFIG = {
  patrol: { label: '巡房記錄', icon: 'clipboard-outline' as const },
  diaper: { label: '換片記錄', icon: 'water-outline' as const },
  intake_output: { label: '出入量', icon: 'analytics-outline' as const },
  restraint: { label: '約束觀察', icon: 'shield-outline' as const },
  position: { label: '轉身記錄', icon: 'refresh-outline' as const },
  toilet_training: { label: '如廁訓練', icon: 'school-outline' as const },
};

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
  const [restraintAssessments, setRestraintAssessments] = useState<PatientRestraintAssessment[]>([]);
  const [admissionRecords, setAdmissionRecords] = useState<PatientAdmissionRecord[]>([]);
  const [healthAssessments, setHealthAssessments] = useState<HealthAssessment[]>([]);
  const [missingLookbackDays, setMissingLookbackDays] = useState(30);

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

      const [patrol, diaper, restraint, position] = await Promise.all([
        getPatrolRoundsInDateRange(startDate, endDate),
        getDiaperChangeRecordsInDateRange(startDate, endDate),
        getRestraintObservationRecordsInDateRange(startDate, endDate),
        getPositionChangeRecordsInDateRange(startDate, endDate),
      ]);

      setPatrolRounds(patrol.filter(r => r.patient_id === patient.院友id));
      setDiaperChangeRecords(diaper.filter(r => r.patient_id === patient.院友id));
      setRestraintObservationRecords(restraint.filter(r => r.patient_id === patient.院友id));
      setPositionChangeRecords(position.filter(r => r.patient_id === patient.院友id));
    } catch (error) {
      console.error('载入月份数据失败:', error);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const dateStr = selectedDateString;

      const [patrol, diaper, restraint, position, assessments, admissions, healthAssess, careTabs] = await Promise.all([
        getPatrolRoundsInDateRange(dateStr, dateStr),
        getDiaperChangeRecordsInDateRange(dateStr, dateStr),
        getRestraintObservationRecordsInDateRange(dateStr, dateStr),
        getPositionChangeRecordsInDateRange(dateStr, dateStr),
        getRestraintAssessments(),
        getPatientAdmissionRecords(),
        getHealthAssessments(),
        getPatientCareTabs(patient.院友id),
      ]);

      setPatrolRounds(patrol.filter(r => r.patient_id === patient.院友id));
      setDiaperChangeRecords(diaper.filter(r => r.patient_id === patient.院友id));
      setRestraintObservationRecords(restraint.filter(r => r.patient_id === patient.院友id));
      setPositionChangeRecords(position.filter(r => r.patient_id === patient.院友id));
      setRestraintAssessments(assessments);
      setAdmissionRecords(admissions);
      setHealthAssessments(healthAssess);
      
      // 使用 patient_care_tabs 表来确定显示哪些选项卡
      console.log('=== 从 patient_care_tabs 表读取选项卡配置 ===');
      console.log('当前患者 ID:', patient?.院友id);
      console.log('patient_care_tabs 数据:', careTabs);
      
      // 只显示 is_hidden=false 的选项卡（数据库查询已经过滤）
      const tabs: TabType[] = careTabs.map(tab => tab.tab_type);
      
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

  // 当打开日历时加载当前月份的数据
  useEffect(() => {
    if (showDatePicker) {
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
      default:
        return false;
    }
  };

  const renderTabs = () => (
    <View
      style={styles.tabsContainer}
    >
      {availableTabs.map((tab) => {
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
                    {record.has_urine && '小'}
                    {record.has_urine && record.has_stool && '/'}
                    {record.has_stool && '大'}
                    {record.has_none && '無'}
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

  const renderContent = () => {
    switch (activeTab) {
      case 'patrol':
        return renderPatrolTable();
      case 'diaper':
        return renderDiaperTable();
      case 'intake_output':
        return renderDevelopingPlaceholder('出入量記錄');
      case 'restraint':
        return renderRestraintTable();
      case 'position':
        return renderPositionTable();
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
      
      // 未来日期不检查
      if (dateObj > now) return false;
      
      // 检查是否超出回溯天数限制
      const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > missingLookbackDays) return false;
      
      // 检查所有可用选项卡
      for (const tab of availableTabs) {
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
            if (hasMissing) return true;
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
            if (hasMissing) return true;
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
            if (hasMissing) return true;
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
            if (hasMissing) return true;
            break;
          }
        }
      }
      
      return false;
    };

    const handlePrevMonth = () => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setSelectedDate(newDate);
      loadMonthData(newDate);
    };

    const handleNextMonth = () => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + 1);
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

  return (
    <View style={styles.container}>
      {renderPatientHeader()}
      {renderTabs()}
      {renderDateNavigation()}
      {renderDatePicker()}
      <ScrollView
        style={styles.tableContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {renderContent()}
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
});

export default CareRecordsScreen;
