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
  getPatrolRoundsInDateRange,
  getDiaperChangeRecordsInDateRange,
  getRestraintObservationRecordsInDateRange,
  getPositionChangeRecordsInDateRange,
  getRestraintAssessments,
  getPatientAdmissionRecords,
} from '../lib/database';
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  generateWeekDates,
  getWeekStartDate,
  formatDate,
  isInHospital,
} from '../utils/careRecordHelper';

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
  const patient: Patient = route.params?.patient;

  const [activeTab, setActiveTab] = useState<TabType>('patrol');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperChangeRecords, setDiaperChangeRecords] = useState<DiaperChangeRecord[]>([]);
  const [restraintObservationRecords, setRestraintObservationRecords] = useState<RestraintObservationRecord[]>([]);
  const [positionChangeRecords, setPositionChangeRecords] = useState<PositionChangeRecord[]>([]);
  const [restraintAssessments, setRestraintAssessments] = useState<PatientRestraintAssessment[]>([]);
  const [admissionRecords, setAdmissionRecords] = useState<PatientAdmissionRecord[]>([]);

  const selectedDateString = useMemo(() => formatDate(selectedDate), [selectedDate]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const dateStr = selectedDateString;

      const [patrol, diaper, restraint, position, assessments, admissions] = await Promise.all([
        getPatrolRoundsInDateRange(dateStr, dateStr),
        getDiaperChangeRecordsInDateRange(dateStr, dateStr),
        getRestraintObservationRecordsInDateRange(dateStr, dateStr),
        getPositionChangeRecordsInDateRange(dateStr, dateStr),
        getRestraintAssessments(),
        getPatientAdmissionRecords(),
      ]);

      setPatrolRounds(patrol.filter(r => r.patient_id === patient.院友id));
      setDiaperChangeRecords(diaper.filter(r => r.patient_id === patient.院友id));
      setRestraintObservationRecords(restraint.filter(r => r.patient_id === patient.院友id));
      setPositionChangeRecords(position.filter(r => r.patient_id === patient.院友id));
      setRestraintAssessments(assessments);
      setAdmissionRecords(admissions);
    } catch (error) {
      console.error('載入護理記錄失敗:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDateString, patient.院友id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handlePreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = () => {
    const today = new Date();
    return formatDate(today) === formatDate(selectedDate);
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
          <Text style={styles.patientName}>{patient.中文姓名}</Text>
          <Text style={styles.patientMeta}>
            床號: {patient.床號} | {patient.性別}
            {calculateAge(patient.出生日期) && ` | ${calculateAge(patient.出生日期)}歲`}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
        <Pressable
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Ionicons
            name={TAB_CONFIG[tab].icon}
            size={18}
            color={activeTab === tab ? '#2563eb' : '#6b7280'}
          />
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {TAB_CONFIG[tab].label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderDateNavigation = () => {
    const formatDisplayDate = () => {
      const d = selectedDate;
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
    };

    return (
      <View style={styles.dateNavigation}>
        <Pressable style={styles.navButton} onPress={handlePreviousDay}>
          <Ionicons name="chevron-back" size={24} color="#374151" />
          <Text style={styles.navButtonText}>昨天</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.currentDayButton, isToday() && styles.currentDayButtonActive]} 
          onPress={handleToday}
        >
          <Text style={[styles.currentDayButtonText, isToday() && styles.currentDayButtonTextActive]}>
            {isToday() ? '今天' : formatDisplayDate()}
          </Text>
        </Pressable>
        
        <Pressable style={styles.navButton} onPress={handleNextDay}>
          <Text style={styles.navButtonText}>明天</Text>
          <Ionicons name="chevron-forward" size={24} color="#374151" />
        </Pressable>
      </View>
    );
  };

  const renderDateHeader = () => {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const d = selectedDate;
    return (
      <View style={styles.dateHeader}>
        <View style={styles.timeSlotHeader}>
          <Text style={styles.timeSlotHeaderText}>時段</Text>
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
        const inHospital = isInHospital(patient, dateString, timeSlot, admissionRecords);

        return (
          <View key={timeSlot} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{timeSlot}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                inHospital && styles.hospitalCell,
                record && !inHospital && styles.completedCell,
              ]}
              onPress={() => !inHospital && handleCellPress(dateString, timeSlot, record)}
              disabled={inHospital}
            >
              {inHospital ? (
                <Text style={styles.hospitalText}>入院</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>待巡</Text>
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
        const timeStr = slot.time.split('-')[0];
        const inHospital = isInHospital(patient, dateString, timeStr, admissionRecords);

        return (
          <View key={slot.time} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{slot.label}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                inHospital && styles.hospitalCell,
                record && !inHospital && styles.completedCellBlue,
              ]}
              onPress={() => !inHospital && handleCellPress(dateString, slot.time, record)}
              disabled={inHospital}
            >
              {inHospital ? (
                <Text style={styles.hospitalText}>入院</Text>
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
                <Text style={styles.pendingText}>待記錄</Text>
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
        const inHospital = isInHospital(patient, dateString, timeSlot, admissionRecords);

        const getCellStyle = () => {
          if (inHospital) return styles.hospitalCell;
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
              onPress={() => !inHospital && handleCellPress(dateString, timeSlot, record)}
              disabled={inHospital}
            >
              {inHospital ? (
                <Text style={styles.hospitalText}>入院</Text>
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
                <Text style={styles.pendingText}>待觀察</Text>
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
        const inHospital = isInHospital(patient, dateString, timeSlot, admissionRecords);

        return (
          <View key={timeSlot} style={styles.tableRow}>
            <View style={styles.timeSlotCell}>
              <Text style={styles.timeSlotText}>{timeSlot}</Text>
            </View>
            <Pressable
              style={[
                styles.singleDataCell,
                inHospital && styles.hospitalCell,
                record && !inHospital && styles.completedCellPurple,
              ]}
              onPress={() => !inHospital && handleCellPress(dateString, timeSlot, record)}
              disabled={inHospital}
            >
              {inHospital ? (
                <Text style={styles.hospitalText}>入院</Text>
              ) : record ? (
                <View style={styles.completedContent}>
                  <Text style={styles.positionText}>{record.position}</Text>
                  <Text style={styles.recorderText}>{record.recorder}</Text>
                </View>
              ) : (
                <Text style={styles.pendingText}>[{expectedPosition}]</Text>
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
      <Text style={styles.placeholderSubtitle}>敬請期待</Text>
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
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderPatientHeader()}
      {renderTabs()}
      {renderDateNavigation()}
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
    paddingVertical: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  patientMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
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
  navButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    marginHorizontal: 4,
  },
  currentDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  currentDayButtonActive: {
    backgroundColor: '#2563eb',
  },
  currentDayButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  currentDayButtonTextActive: {
    color: '#ffffff',
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
    width: 70,
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
    width: 70,
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
  },
  hospitalCell: {
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
});

export default CareRecordsScreen;
