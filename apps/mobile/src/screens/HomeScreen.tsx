import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPatients, Patient, Station, getStations,
  getPatrolRoundsInDateRange,
  getDiaperChangeRecordsInDateRange,
  getRestraintObservationRecordsInDateRange,
  getPositionChangeRecordsInDateRange,
  getPatientAdmissionRecords,
} from '../lib/database';
import { eventBus } from '../lib/eventBus';
import { useTranslation, usePatientName } from '../lib/i18n';
// settings helper: getMissingLookbackDays
import {
  TIME_SLOTS,
  DIAPER_CHANGE_SLOTS,
  isPastSlot,
  parseSlotStartTime,
  formatDate,
  isInHospital,
} from '../utils/careRecordHelper';
import { getMissingLookbackDays } from '../lib/settings';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const getPatientName = usePatientName();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missingMap, setMissingMap] = useState<Record<number, boolean>>({});
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);

  const loadPatients = async () => {
    try {
      const [patientData, stationData] = await Promise.all([
        getPatients(),
        getStations(),
      ]);
      setPatients(patientData);
      setStations(stationData);
      applyFilters(patientData, searchQuery, selectedStationId);
      computeMissingFlags(patientData);
    } catch (error) {
      console.error('載入院友列表失敗:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (patientList: Patient[], search: string, stationId: string | null) => {
    let filtered = patientList;
    
    // 按 station 筛选
    if (stationId) {
      filtered = filtered.filter(p => p.station_id === stationId);
    }
    
    // 按搜索词筛选
    if (search.trim() !== '') {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.中文姓名.toLowerCase().includes(query) ||
          p.床號.toLowerCase().includes(query) ||
          p.身份證號碼?.toLowerCase().includes(query)
      );
    }
    
    setFilteredPatients(filtered);
  };

  const computeMissingFlags = async (patientList: Patient[]) => {
    if (!patientList || patientList.length === 0) return;
    try {
      const LOOKBACK_DAYS = await getMissingLookbackDays();
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (LOOKBACK_DAYS - 1));

      const startStr = formatDate(start);
      const endStr = formatDate(end);

      const [patrols, diapers, restraints, positions, admissions] = await Promise.all([
        getPatrolRoundsInDateRange(startStr, endStr),
        getDiaperChangeRecordsInDateRange(startStr, endStr),
        getRestraintObservationRecordsInDateRange(startStr, endStr),
        getPositionChangeRecordsInDateRange(startStr, endStr),
        getPatientAdmissionRecords(),
      ]);

      const map: Record<number, boolean> = {};

      const dateStrings: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dateStrings.push(formatDate(new Date(d)));

      for (const p of patientList) {
        let missing = false;
        for (const dateStr of dateStrings) {
          if (missing) break;
          // patrol / restraint / position use TIME_SLOTS
          for (const t of TIME_SLOTS) {
            const hasPatrol = patrols.some(r => r.patient_id === p.院友id && r.patrol_date === dateStr && r.scheduled_time === t);
            const hasRestraint = restraints.some(r => r.patient_id === p.院友id && r.observation_date === dateStr && r.scheduled_time === t);
            const hasPosition = positions.some(r => r.patient_id === p.院友id && r.change_date === dateStr && r.scheduled_time === t);
            const hasAny = hasPatrol || hasRestraint || hasPosition;
            if (isPastSlot(dateStr, t) && !hasAny) {
              missing = true;
              break;
            }
          }
          if (missing) break;
          // diaper slots
          for (const slot of DIAPER_CHANGE_SLOTS) {
            const slotStart = parseSlotStartTime(slot.time);
            if (!slotStart) continue;
            const hasDiaper = diapers.some(r => r.patient_id === p.院友id && r.change_date === dateStr && r.time_slot === slot.time);
            if (isPastSlot(dateStr, slot.time) && !hasDiaper) {
              missing = true;
              break;
            }
          }
        }
        map[p.院友id] = missing;
      }

      setMissingMap(map);
    } catch (error) {
      console.error('計算補錄標記失敗:', error);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      // re-compute missing flags when a record is saved
      computeMissingFlags(patients);
    };
    eventBus.on('recordSaved', handler as any);
    return () => { eventBus.off('recordSaved', handler as any); };
  }, [patients]);

  useEffect(() => {
    const handler = (e: any) => {
      // recompute when settings change
      computeMissingFlags(patients);
    };
    eventBus.on('settingsChanged', handler as any);
    return () => { eventBus.off('settingsChanged', handler as any); };
  }, [patients]);

  useEffect(() => {
    applyFilters(patients, searchQuery, selectedStationId);
  }, [searchQuery, selectedStationId, patients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPatients();
  }, []);

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const renderPatientItem = ({ item }: { item: Patient }) => {
    const age = calculateAge(item.出生日期);

    return (
      <Pressable
        style={styles.patientCard}
        onPress={() => navigation.navigate('CareRecords', { patient: item })}
      >
        {missingMap[item.院友id] && (
          <View style={styles.redDotIndicator} />
        )}
        <View style={styles.patientInfo}>
          {item.院友相片 ? (
            <Image source={{ uri: item.院友相片 }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#9ca3af" />
            </View>
          )}
          <View style={styles.patientDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.patientName}>{getPatientName(item)}</Text>
              <View style={[styles.genderBadge, item.性別 === '男' ? styles.maleBadge : styles.femaleBadge]}>
                <Text style={styles.genderText}>{item.性別}</Text>
              </View>
            </View>
            <Text style={styles.bedNumber}>{t('bed')}: {item.床號}</Text>
            <View style={styles.infoRow}>
              {age !== null && <Text style={styles.infoText}>{age} {t('years')}</Text>}
              {item.護理等級 && (
                <View style={styles.careLevelBadge}>
                  <Text style={styles.careLevelText}>
                    {item.護理等級 === '全護理' ? t('fullCare') : 
                     item.護理等級 === '半護理' ? t('partialCare') : 
                     item.護理等級 === '自理' ? t('selfCare') : item.護理等級}
                  </Text>
                </View>
              )}
            </View>
            {item.感染控制 && item.感染控制.length > 0 && (
              <View style={styles.infectionRow}>
                {item.感染控制.map((item, idx) => (
                  <View key={idx} style={styles.infectionBadge}>
                    <Text style={styles.infectionText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('patientList')}</Text>
          <Text style={styles.headerSubtitle}>{t('patients')}: {filteredPatients.length}</Text>
        </View>
        <Pressable
          style={styles.stationButton}
          onPress={() => setShowStationPicker(!showStationPicker)}
        >
          <Text style={styles.stationButtonText}>
            {selectedStationId 
              ? stations.find(s => s.id === selectedStationId)?.name || t('allStations')
              : t('allStations')}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#374151" />
        </Pressable>
      </View>
      {showStationPicker && (
        <View style={styles.stationPicker}>
          <Pressable
            style={[styles.stationOption, !selectedStationId && styles.stationOptionSelected]}
            onPress={() => {
              setSelectedStationId(null);
              setShowStationPicker(false);
            }}
          >
            <Text style={[styles.stationOptionText, !selectedStationId && styles.stationOptionTextSelected]}>
              {t('allStations')}
            </Text>
            {!selectedStationId && <Ionicons name="checkmark" size={20} color="#2563eb" />}
          </Pressable>
          {stations.map(station => (
            <Pressable
              key={station.id}
              style={[styles.stationOption, selectedStationId === station.id && styles.stationOptionSelected]}
              onPress={() => {
                setSelectedStationId(station.id);
                setShowStationPicker(false);
              }}
            >
              <Text style={[styles.stationOptionText, selectedStationId === station.id && styles.stationOptionTextSelected]}>
                {station.name}
              </Text>
              {selectedStationId === station.id && <Ionicons name="checkmark" size={20} color="#2563eb" />}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredPatients}
        renderItem={renderPatientItem}
        keyExtractor={(item) => item.院友id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {searchQuery ? '找不到符合的院友' : '暫無在住院友'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  stationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  stationButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginRight: 4,
  },
  stationPicker: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  stationOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  stationOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  stationOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  patientInfo: {
    flex: 1,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 8,
  },
  genderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  maleBadge: {
    backgroundColor: '#dbeafe',
  },
  femaleBadge: {
    backgroundColor: '#fce7f3',
  },
  genderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  bedNumber: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 8,
  },
  careLevelBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  careLevelText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '500',
  },
  infectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  infectionBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  infectionText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '500',
  },
  redDotIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
});

export default HomeScreen;
