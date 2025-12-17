import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Patient,
  PatrolRound,
  DiaperChangeRecord,
  RestraintObservationRecord,
  PositionChangeRecord,
  PatientRestraintAssessment,
  createPatrolRound,
  updatePatrolRound,
  deletePatrolRound,
  createDiaperChangeRecord,
  updateDiaperChangeRecord,
  deleteDiaperChangeRecord,
  createRestraintObservationRecord,
  updateRestraintObservationRecord,
  deleteRestraintObservationRecord,
  createPositionChangeRecord,
  deletePositionChangeRecord,
} from '../lib/database';
import { addRandomOffset, getPositionSequence } from '../utils/careRecordHelper';

type RecordType = 'patrol' | 'diaper' | 'restraint' | 'position';

const RecordDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { patient, recordType, date, timeSlot, existingRecord, staffName, restraintAssessments } = route.params;

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Patrol Round state
  const [patrolTime, setPatrolTime] = useState('');
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');

  // Diaper Change state
  const [hasUrine, setHasUrine] = useState(false);
  const [hasStool, setHasStool] = useState(false);
  const [hasNone, setHasNone] = useState(false);
  const [urineAmount, setUrineAmount] = useState('');
  const [stoolColor, setStoolColor] = useState('');
  const [stoolTexture, setStoolTexture] = useState('');
  const [stoolAmount, setStoolAmount] = useState('');

  // Restraint Observation state
  const [observationTime, setObservationTime] = useState('');
  const [observationStatus, setObservationStatus] = useState<'N' | 'P' | 'S'>('N');
  const [selectedRestraints, setSelectedRestraints] = useState<string[]>([]);

  // Position Change state
  const [position, setPosition] = useState<'左' | '平' | '右'>('左');

  // Get suggested restraints from assessment
  const getSuggestedRestraints = (): string[] => {
    if (!restraintAssessments) return [];
    const latestAssessment = restraintAssessments
      .filter((a: PatientRestraintAssessment) => a.patient_id === patient.院友id)
      .sort((a: PatientRestraintAssessment, b: PatientRestraintAssessment) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

    if (!latestAssessment || !latestAssessment.suggested_restraints) return [];

    const restraints = latestAssessment.suggested_restraints;
    const items: string[] = [];

    if (typeof restraints === 'object') {
      Object.entries(restraints).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object' && value !== null && value.checked === true) {
          items.push(key);
        } else if (typeof value === 'boolean' && value === true) {
          const nameMap: Record<string, string> = {
            'bed_rail': '床欄',
            'wheelchair_belt': '輪椅安全帶',
            'wheelchair_table': '輪椅餐桌板',
            'vest': '約束背心',
            'wrist_restraint': '手部約束帶',
            'ankle_restraint': '腳部約束帶',
            'mitt': '手套'
          };
          items.push(nameMap[key] || key);
        }
      });
    }

    return items;
  };

  const suggestedRestraints = getSuggestedRestraints();

  useEffect(() => {
    if (existingRecord) {
      setRecorder(existingRecord.recorder || staffName);
      setNotes(existingRecord.notes || '');

      switch (recordType) {
        case 'patrol':
          setPatrolTime(existingRecord.patrol_time || '');
          break;
        case 'diaper':
          setHasUrine(existingRecord.has_urine || false);
          setHasStool(existingRecord.has_stool || false);
          setHasNone(existingRecord.has_none || false);
          setUrineAmount(existingRecord.urine_amount || '');
          setStoolColor(existingRecord.stool_color || '');
          setStoolTexture(existingRecord.stool_texture || '');
          setStoolAmount(existingRecord.stool_amount || '');
          break;
        case 'restraint':
          setObservationTime(existingRecord.observation_time || '');
          setObservationStatus(existingRecord.observation_status || 'N');
          if (existingRecord.used_restraints) {
            setSelectedRestraints(Object.keys(existingRecord.used_restraints).filter(k => existingRecord.used_restraints[k]));
          }
          break;
        case 'position':
          setPosition(existingRecord.position || '左');
          break;
      }
    } else {
      setRecorder(staffName);
      if (recordType === 'patrol') {
        setPatrolTime(addRandomOffset(timeSlot));
      } else if (recordType === 'restraint') {
        setObservationTime(addRandomOffset(timeSlot));
        setSelectedRestraints(suggestedRestraints);
      } else if (recordType === 'position') {
        setPosition(getPositionSequence(timeSlot));
      }
    }
  }, [existingRecord, recordType, timeSlot, staffName]);

  const handleSave = async () => {
    if (!recorder.trim()) {
      Alert.alert('錯誤', '請輸入記錄者姓名');
      return;
    }

    setLoading(true);
    try {
      switch (recordType) {
        case 'patrol':
          if (!patrolTime) {
            Alert.alert('錯誤', '請輸入實際巡房時間');
            setLoading(false);
            return;
          }
          const patrolData: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            patrol_date: date,
            scheduled_time: timeSlot,
            patrol_time: patrolTime,
            recorder: recorder.trim(),
            notes: notes.trim() || undefined,
          };
          if (existingRecord) {
            await updatePatrolRound({ ...existingRecord, ...patrolData });
          } else {
            await createPatrolRound(patrolData);
          }
          break;

        case 'diaper':
          if (!hasUrine && !hasStool && !hasNone) {
            Alert.alert('錯誤', '請選擇排泄情況');
            setLoading(false);
            return;
          }
          const diaperData: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            change_date: date,
            time_slot: timeSlot,
            has_urine: hasUrine,
            has_stool: hasStool,
            has_none: hasNone,
            urine_amount: urineAmount || undefined,
            stool_color: stoolColor || undefined,
            stool_texture: stoolTexture || undefined,
            stool_amount: stoolAmount || undefined,
            recorder: recorder.trim(),
          };
          if (existingRecord) {
            await updateDiaperChangeRecord({ ...existingRecord, ...diaperData });
          } else {
            await createDiaperChangeRecord(diaperData);
          }
          break;

        case 'restraint':
          if (!observationTime) {
            Alert.alert('錯誤', '請輸入實際觀察時間');
            setLoading(false);
            return;
          }
          const usedRestraintsObj: Record<string, boolean> = {};
          selectedRestraints.forEach(item => { usedRestraintsObj[item] = true; });
          const restraintData: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            observation_date: date,
            observation_time: observationTime,
            scheduled_time: timeSlot,
            observation_status: observationStatus,
            recorder: recorder.trim(),
            notes: notes.trim() || undefined,
            used_restraints: selectedRestraints.length > 0 ? usedRestraintsObj : undefined,
          };
          if (existingRecord) {
            await updateRestraintObservationRecord({ ...existingRecord, ...restraintData });
          } else {
            await createRestraintObservationRecord(restraintData);
          }
          break;

        case 'position':
          const positionData: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            change_date: date,
            scheduled_time: timeSlot,
            position,
            recorder: recorder.trim(),
          };
          // Position records can only be created, not updated (per Web App design)
          if (!existingRecord) {
            await createPositionChangeRecord(positionData);
          }
          break;
      }

      navigation.goBack();
    } catch (error) {
      console.error('保存記錄失敗:', error);
      Alert.alert('錯誤', '保存記錄失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!existingRecord) return;

    Alert.alert('確認刪除', '您確定要刪除此記錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            switch (recordType) {
              case 'patrol':
                await deletePatrolRound(existingRecord.id);
                break;
              case 'diaper':
                await deleteDiaperChangeRecord(existingRecord.id);
                break;
              case 'restraint':
                await deleteRestraintObservationRecord(existingRecord.id);
                break;
              case 'position':
                await deletePositionChangeRecord(existingRecord.id);
                break;
            }
            navigation.goBack();
          } catch (error) {
            console.error('刪除記錄失敗:', error);
            Alert.alert('錯誤', '刪除記錄失敗，請重試');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const getTitle = () => {
    const titles: Record<RecordType, string> = {
      patrol: '巡房記錄',
      diaper: '換片記錄',
      restraint: '約束觀察記錄',
      position: '轉身記錄',
    };
    return `${existingRecord ? '編輯' : '新增'}${titles[recordType as RecordType]}`;
  };

  const renderPatrolForm = () => (
    <>
      <View style={styles.formGroup}>
        <Text style={styles.label}>實際巡房時間 *</Text>
        <TextInput
          style={styles.input}
          value={patrolTime}
          onChangeText={setPatrolTime}
          placeholder="HH:MM"
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>備註</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="選填，如有特殊情況請記錄"
          multiline
          numberOfLines={3}
        />
      </View>
    </>
  );

  const renderDiaperForm = () => (
    <>
      <View style={styles.formGroup}>
        <Text style={styles.label}>排泄情況 *</Text>
        <View style={styles.checkboxGroup}>
          <TouchableOpacity
            style={[styles.checkbox, hasUrine && styles.checkboxActive]}
            onPress={() => {
              setHasUrine(!hasUrine);
              if (!hasUrine) setHasNone(false);
            }}
          >
            <Ionicons
              name={hasUrine ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasUrine ? '#2563eb' : '#6b7280'}
            />
            <Text style={styles.checkboxText}>小便</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkbox, hasStool && styles.checkboxActive]}
            onPress={() => {
              setHasStool(!hasStool);
              if (!hasStool) setHasNone(false);
            }}
          >
            <Ionicons
              name={hasStool ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasStool ? '#2563eb' : '#6b7280'}
            />
            <Text style={styles.checkboxText}>大便</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkbox, hasNone && styles.checkboxActive]}
            onPress={() => {
              setHasNone(!hasNone);
              if (!hasNone) {
                setHasUrine(false);
                setHasStool(false);
              }
            }}
          >
            <Ionicons
              name={hasNone ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasNone ? '#2563eb' : '#6b7280'}
            />
            <Text style={styles.checkboxText}>無</Text>
          </TouchableOpacity>
        </View>
      </View>

      {hasUrine && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>小便量</Text>
          <View style={styles.optionGroup}>
            {['少', '中', '多'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionButton, urineAmount === opt && styles.optionButtonActive]}
                onPress={() => setUrineAmount(opt)}
              >
                <Text style={[styles.optionText, urineAmount === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {hasStool && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>大便顏色</Text>
            <View style={styles.optionGroup}>
              {['黃', '啡', '綠', '黑', '紅'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolColor === opt && styles.optionButtonActive]}
                  onPress={() => setStoolColor(opt)}
                >
                  <Text style={[styles.optionText, stoolColor === opt && styles.optionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>大便質地</Text>
            <View style={styles.optionGroup}>
              {['硬', '軟', '稀', '水狀'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolTexture === opt && styles.optionButtonActive]}
                  onPress={() => setStoolTexture(opt)}
                >
                  <Text style={[styles.optionText, stoolTexture === opt && styles.optionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>大便量</Text>
            <View style={styles.optionGroup}>
              {['少', '中', '多'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolAmount === opt && styles.optionButtonActive]}
                  onPress={() => setStoolAmount(opt)}
                >
                  <Text style={[styles.optionText, stoolAmount === opt && styles.optionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </>
  );

  const renderRestraintForm = () => (
    <>
      {suggestedRestraints.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>約束物品</Text>
          <View style={styles.restraintGrid}>
            {suggestedRestraints.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.restraintItem, selectedRestraints.includes(item) && styles.restraintItemActive]}
                onPress={() => {
                  if (selectedRestraints.includes(item)) {
                    setSelectedRestraints(selectedRestraints.filter(r => r !== item));
                  } else {
                    setSelectedRestraints([...selectedRestraints, item]);
                  }
                }}
              >
                <Ionicons
                  name={selectedRestraints.includes(item) ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={selectedRestraints.includes(item) ? '#2563eb' : '#6b7280'}
                />
                <Text style={styles.restraintText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>實際觀察時間 *</Text>
        <TextInput
          style={styles.input}
          value={observationTime}
          onChangeText={setObservationTime}
          placeholder="HH:MM"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>觀察狀態 *</Text>
        <View style={styles.statusGroup}>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusNormal, observationStatus === 'N' && styles.statusButtonActive]}
            onPress={() => setObservationStatus('N')}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'N' && styles.statusButtonTextActive]}>
              🟢 正常 (N)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusProblem, observationStatus === 'P' && styles.statusButtonActiveRed]}
            onPress={() => setObservationStatus('P')}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'P' && styles.statusButtonTextActive]}>
              🔴 異常 (P)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusPaused, observationStatus === 'S' && styles.statusButtonActiveOrange]}
            onPress={() => setObservationStatus('S')}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'S' && styles.statusButtonTextActive]}>
              🟠 暫停 (S)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>備註</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="選填，如有特殊情況請記錄"
          multiline
          numberOfLines={3}
        />
      </View>
    </>
  );

  const renderPositionForm = () => (
    <>
      <View style={styles.infoBox}>
        <Ionicons name="refresh" size={20} color="#2563eb" />
        <View style={styles.infoBoxContent}>
          <Text style={styles.infoBoxTitle}>轉身順序提示</Text>
          <Text style={styles.infoBoxText}>左 → 平 → 右 → 左（循環）</Text>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>轉身位置 *</Text>
        <View style={styles.positionGroup}>
          {(['左', '平', '右'] as const).map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[styles.positionButton, position === pos && styles.positionButtonActive]}
              onPress={() => setPosition(pos)}
            >
              <Text style={[styles.positionButtonText, position === pos && styles.positionButtonTextActive]}>
                {pos}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!existingRecord && (
          <Text style={styles.hintText}>系統已根據時段自動選擇建議位置，您可以手動調整</Text>
        )}
      </View>
    </>
  );

  const renderForm = () => {
    switch (recordType) {
      case 'patrol': return renderPatrolForm();
      case 'diaper': return renderDiaperForm();
      case 'restraint': return renderRestraintForm();
      case 'position': return renderPositionForm();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>院友姓名</Text>
            <Text style={styles.infoValue}>{patient.中文姓名}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>日期</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>時段</Text>
            <Text style={styles.infoValue}>{timeSlot}</Text>
          </View>
        </View>

        {renderForm()}

        <View style={styles.formGroup}>
          <Text style={styles.label}>記錄者 *</Text>
          <TextInput
            style={styles.input}
            value={recorder}
            onChangeText={setRecorder}
            placeholder="請輸入記錄者姓名"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {existingRecord && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleting || loading}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                <Text style={styles.deleteButtonText}>刪除</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || deleting}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>{existingRecord ? '更新記錄' : '確認記錄'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  formGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginRight: 12,
    marginBottom: 8,
  },
  checkboxActive: {
    backgroundColor: '#dbeafe',
  },
  checkboxText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: '#2563eb',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  restraintGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  restraintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  restraintItemActive: {
    backgroundColor: '#dbeafe',
  },
  restraintText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 6,
  },
  statusGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statusNormal: {
    backgroundColor: '#f0fdf4',
  },
  statusProblem: {
    backgroundColor: '#fef2f2',
  },
  statusPaused: {
    backgroundColor: '#fffbeb',
  },
  statusButtonActive: {
    backgroundColor: '#16a34a',
  },
  statusButtonActiveRed: {
    backgroundColor: '#dc2626',
  },
  statusButtonActiveOrange: {
    backgroundColor: '#d97706',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#3b82f6',
  },
  positionGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionButton: {
    flex: 1,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  positionButtonActive: {
    backgroundColor: '#2563eb',
  },
  positionButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
  },
  positionButtonTextActive: {
    color: '#ffffff',
  },
  hintText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    marginRight: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 6,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#2563eb',
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default RecordDetailScreen;
