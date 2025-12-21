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
  HygieneRecord,
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
  updatePositionChangeRecord,
  deletePositionChangeRecord,
  createHygieneRecord,
  updateHygieneRecord,
  deleteHygieneRecord,
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { addRandomOffset, getPositionSequence, STATUS_OPTIONS, isStatusNote } from '../utils/careRecordHelper';
import { eventBus } from '../lib/eventBus';
import { useTranslation, usePatientName } from '../lib/i18n';

type RecordType = 'patrol' | 'diaper' | 'restraint' | 'position' | 'hygiene';

// Helper function to translate option values
const translateOption = (opt: string, t: (key: any) => string): string => {
  const optionMap: { [key: string]: string } = {
    '多': t('large'),
    '中': t('medium'),
    '少': t('small'),
    '黃': t('yellowStool'),
    '啡': t('brownStool'),
    '綠': t('greenStool'),
    '黑': t('blackStool'),
    '紅': t('redStool'),
    '硬': t('constipation'),
    '軟': t('softStool'),
    '稀': t('looseStool'),
    '水狀': t('diarrhea'),
    '左': t('leftPosition'),
    '平': t('centerPosition'),
    '右': t('rightPosition'),
    '床欄': t('bedRail'),
    '輪椅安全帶': t('wheelchairBelt'),
    '輪椅餐桌板': t('wheelchairTable'),
    '約束背心': t('vest'),
    '手部約束帶': t('wristRestraint'),
    '腳部約束帶': t('ankleRestraint'),
    '手套': t('mitt'),
    '入院': t('noteInHospital'),
    '渡假': t('noteOnLeave'),
    '外出': t('noteOutpatient'),
  };
  return optionMap[opt] || opt;
};

const RecordDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { patient, recordType, date, timeSlot, existingRecord, staffName, restraintAssessments } = route.params;
  const getPatientName = usePatientName();
  const patientName = getPatientName(patient);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Patrol Round state
  const [patrolTime, setPatrolTime] = useState('');
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'' | '入院' | '渡假' | '外出'>('');

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

  // Hygiene Record state
  const [hasBath, setHasBath] = useState(false);
  const [hasFaceWash, setHasFaceWash] = useState(false);
  const [hasShave, setHasShave] = useState(false);
  const [hasOralCare, setHasOralCare] = useState(false);
  const [hasDentureCare, setHasDentureCare] = useState(false);
  const [hasNailTrim, setHasNailTrim] = useState(false);
  const [hasBeddingChange, setHasBeddingChange] = useState(false);
  const [hasSheetPillowChange, setHasSheetPillowChange] = useState(false);
  const [hasCupWash, setHasCupWash] = useState(false);
  const [hasBedsideCabinet, setHasBedsideCabinet] = useState(false);
  const [hasWardrobe, setHasWardrobe] = useState(false);
  const [bowelCount, setBowelCount] = useState<string>('');
  const [bowelAmount, setBowelAmount] = useState('');
  const [bowelConsistency, setBowelConsistency] = useState('');

  const clearPatrolFields = () => {
    setNotes('');
  };

  const handlePatrolStatusSelect = (opt: '' | '入院' | '渡假' | '外出') => {
    const next = status === opt ? '' : opt;
    setStatus(next);
    if (next) {
      clearPatrolFields();
    }
  };

  const clearDiaperFields = () => {
    setHasUrine(false);
    setHasStool(false);
    setHasNone(false);
    setUrineAmount('');
    setStoolColor('');
    setStoolTexture('');
    setStoolAmount('');
  };

  const handleDiaperStatusSelect = (opt: '' | '入院' | '渡假' | '外出') => {
    const next = status === opt ? '' : opt;
    setStatus(next);
    if (next) {
      clearDiaperFields();
    }
  };

  const clearRestraintFields = () => {
    setObservationTime('');
    setObservationStatus('N');
    setSelectedRestraints([]);
  };

  const handleRestraintStatusSelect = (opt: '' | '入院' | '渡假' | '外出') => {
    const next = status === opt ? '' : opt;
    setStatus(next);
    if (next) {
      clearRestraintFields();
    }
  };

  const clearPositionFields = () => {
    setPosition('左');
  };

  const handlePositionStatusSelect = (opt: '' | '入院' | '渡假' | '外出') => {
    const next = status === opt ? '' : opt;
    setStatus(next);
    if (next) {
      clearPositionFields();
    }
  };

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
      
      switch (recordType) {
        case 'patrol':
          // normalize to HH:MM (strip seconds if present)
          setPatrolTime(existingRecord.patrol_time ? String(existingRecord.patrol_time).slice(0,5) : '');
          break;
        case 'diaper':
        case 'restraint':
        case 'position':
          setNotes(existingRecord.notes || '');
          setStatus(isStatusNote(existingRecord.notes) ? existingRecord.notes as any : '');
          break;
      }

      switch (recordType) {
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
          // normalize to HH:MM
          setObservationTime(existingRecord.observation_time ? String(existingRecord.observation_time).slice(0,5) : '');
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
        // do not auto-select suggested restraints by default
        setSelectedRestraints([]);
      } else if (recordType === 'position') {
        setPosition(getPositionSequence(timeSlot));
      }
    }
  }, [existingRecord, recordType, timeSlot, staffName]);

  const handleSave = async () => {
    if (!recorder.trim()) {
      Alert.alert(t('error'), t('pleaseEnterRecorderName'));
      return;
    }

    if (!patient || !patient.院友id) {
      console.error('Missing patient object or patient.院友id when saving');
      Alert.alert(t('error'), t('patientDataNotFound'));
      return;
    }

    setLoading(true);
    
    // Emit optimistic update before saving
    let savedRecord: any = null;
    
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
            patrol_time: String(patrolTime).slice(0,5),
            recorder: recorder.trim(),
          };
          console.log('Saving patrolData:', patrolData);
          console.log('Current user session:', (await supabase.auth.getSession()).data.session?.user?.email);
          
          // Emit optimistic update
          const optimisticPatrol = existingRecord ? { ...existingRecord, ...patrolData } : { 
            ...patrolData, 
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          eventBus.emit('recordSaved', { 
            patientId: patient.院友id, 
            recordType, 
            record: optimisticPatrol,
            isOptimistic: true 
          });
          
          if (existingRecord) {
            savedRecord = await updatePatrolRound({ ...existingRecord, ...patrolData });
            console.log('✓ Patrol round updated in Supabase:', savedRecord.id);
          } else {
            savedRecord = await createPatrolRound(patrolData);
            console.log('✓ Patrol round created in Supabase:', savedRecord.id);
            console.log('✓ Full saved record:', JSON.stringify(savedRecord, null, 2));
          }
          break;

        case 'diaper':
          if (!hasUrine && !hasStool && !hasNone && !status) {
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
            notes: status ? status : (notes.trim() || undefined),
            recorder: recorder.trim(),
          };
          console.log('Saving diaperData:', diaperData);
          
          // Emit optimistic update
          const optimisticDiaper = existingRecord ? { ...existingRecord, ...diaperData } : { 
            ...diaperData, 
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          eventBus.emit('recordSaved', { 
            patientId: patient.院友id, 
            recordType, 
            record: optimisticDiaper,
            isOptimistic: true 
          });
          
          if (existingRecord) {
            savedRecord = await updateDiaperChangeRecord({ ...existingRecord, ...diaperData });
          } else {
            savedRecord = await createDiaperChangeRecord(diaperData);
          }
          break;

        case 'restraint':
          if (!observationTime && !status) {
            Alert.alert('錯誤', '請選擇狀態或輸入實際觀察時間');
            setLoading(false);
            return;
          }
          const usedRestraintsObj: Record<string, boolean> = {};
          selectedRestraints.forEach(item => { usedRestraintsObj[item] = true; });
          const restraintData: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            observation_date: date,
            observation_time: observationTime ? String(observationTime).slice(0,5) : '00:00',
            scheduled_time: timeSlot,
            observation_status: observationStatus,
            recorder: recorder.trim(),
            notes: status ? status : (notes.trim() || undefined),
            used_restraints: selectedRestraints.length > 0 ? usedRestraintsObj : undefined,
          };
          console.log('Saving restraintData:', restraintData);
          
          // Emit optimistic update
          const optimisticRestraint = existingRecord ? { ...existingRecord, ...restraintData } : { 
            ...restraintData, 
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          eventBus.emit('recordSaved', { 
            patientId: patient.院友id, 
            recordType, 
            record: optimisticRestraint,
            isOptimistic: true 
          });
          
          if (existingRecord) {
            savedRecord = await updateRestraintObservationRecord({ ...existingRecord, ...restraintData });
          } else {
            savedRecord = await createRestraintObservationRecord(restraintData);
          }
          break;

        case 'position':
          if (!status && !position) {
            Alert.alert('錯誤', '請選擇轉身位置或狀態');
            setLoading(false);
            return;
          }
          const positionData: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
            patient_id: patient.院友id,
            change_date: date,
            scheduled_time: timeSlot,
            position: status ? '左' : position, // 当有状态时使用默认值
            notes: status ? status : (notes.trim() || undefined),
            recorder: recorder.trim(),
          };
          console.log('Saving positionData:', positionData);
          
          // Emit optimistic update
          const optimisticPosition = existingRecord ? { ...existingRecord, ...positionData } : { 
            ...positionData, 
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          eventBus.emit('recordSaved', { 
            patientId: patient.院友id, 
            recordType, 
            record: optimisticPosition,
            isOptimistic: true 
          });
          
          if (existingRecord) {
            savedRecord = await updatePositionChangeRecord({ ...existingRecord, ...positionData });
          } else {
            savedRecord = await createPositionChangeRecord(positionData);
          }
          break;
      }

      // Confirm successful save with actual record
      if (savedRecord) {
        console.log('✓ Record confirmed saved to database');
        console.log('  - Record ID:', savedRecord.id);
        console.log('  - Record Type:', recordType);
        console.log('  - Patient ID:', patient.院友id);
        
        eventBus.emit('recordSaved', { 
          patientId: patient.院友id, 
          recordType,
          record: savedRecord,
          isOptimistic: false 
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('❌ 保存記錄失敗:', error);
      console.error('  - Error type:', error.constructor.name);
      console.error('  - Error message:', error.message);
      console.error('  - Full error:', JSON.stringify(error, null, 2));
      
      // Emit rollback event on error
      eventBus.emit('recordSaveFailed', { 
        patientId: patient.院友id, 
        recordType,
        error 
      });
      
      Alert.alert(t('error'), t('saveRecordFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!existingRecord) return;

    Alert.alert(t('confirmDelete'), t('confirmDeleteMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          
          // Emit optimistic delete
          eventBus.emit('recordDeleted', { 
            patientId: patient.院友id, 
            recordType,
            recordId: existingRecord.id,
            isOptimistic: true 
          });
          
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
            
            // Confirm successful delete
            eventBus.emit('recordDeleted', { 
              patientId: patient.院友id, 
              recordType,
              recordId: existingRecord.id,
              isOptimistic: false 
            });
            
            navigation.goBack();
          } catch (error) {
            console.error('刪除記錄失敗:', error);
            
            // Emit rollback event on error
            eventBus.emit('recordDeleteFailed', { 
              patientId: patient.院友id, 
              recordType,
              record: existingRecord
            });
            
            Alert.alert(t('error'), t('deleteRecordFailed'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const getTitle = () => {
    const titles: Record<RecordType, string> = {
      patrol: t('patrolRecord'),
      diaper: t('diaperChange'),
      restraint: t('restraintObservation'),
      position: t('positionChange'),
    };
    return `${existingRecord ? t('editRecord') : t('addRecord')}${titles[recordType as RecordType]}`;
  };

  const renderPatrolForm = () => (
    <>
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('actualPatrolTime')} *</Text>
        <TextInput
          style={styles.input}
          value={patrolTime}
          onChangeText={setPatrolTime}
          placeholder="HH:MM"
        />
      </View>
    </>
  );

  const renderDiaperForm = () => (
    <>
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('excretionStatus')} {!status && '*'}</Text>
        <View style={styles.checkboxGroup}>
          <TouchableOpacity
            style={[styles.checkbox, hasUrine && styles.checkboxActive, status && styles.disabledCheckbox]}
            onPress={() => {
              if (status) return;
              setHasUrine(!hasUrine);
              if (!hasUrine) setHasNone(false);
            }}
          >
            <Ionicons
              name={hasUrine ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasUrine ? '#2563eb' : '#6b7280'}
            />
            <Text style={styles.checkboxText}>{t('hasUrine').replace('有', '')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkbox, hasStool && styles.checkboxActive, status && styles.disabledCheckbox]}
            onPress={() => {
              if (status) return;
              setHasStool(!hasStool);
              if (!hasStool) setHasNone(false);
            }}
          >
            <Ionicons
              name={hasStool ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasStool ? '#2563eb' : '#6b7280'}
            />
            <Text style={styles.checkboxText}>{t('hasStool').replace('有', '')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkbox, hasNone && styles.checkboxActive, status && styles.disabledCheckbox]}
            onPress={() => {
              if (status) return;
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
            <Text style={styles.checkboxText}>{t('noExcretion')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {hasUrine && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('urineVolume')}</Text>
          <View style={styles.optionGroup}>
            {['多', '中', '少'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionButton, urineAmount === opt && styles.optionButtonActive, status && styles.disabledCheckbox]}
                onPress={() => { if (status) return; setUrineAmount(opt); }}
              >
                <Text style={[styles.optionText, urineAmount === opt && styles.optionTextActive]}>{translateOption(opt, t)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {hasStool && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('stoolColor')}</Text>
            <View style={styles.optionGroup}>
              {['黃', '啡', '綠', '黑', '紅'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolColor === opt && styles.optionButtonActive, status && styles.disabledCheckbox]}
                  onPress={() => { if (status) return; setStoolColor(opt); }}
                >
                  <Text style={[styles.optionText, stoolColor === opt && styles.optionTextActive]}>{translateOption(opt, t)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('stoolTexture')}</Text>
            <View style={styles.optionGroup}>
              {['硬', '軟', '稀', '水狀'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolTexture === opt && styles.optionButtonActive, status && styles.disabledCheckbox]}
                  onPress={() => { if (status) return; setStoolTexture(opt); }}
                >
                  <Text style={[styles.optionText, stoolTexture === opt && styles.optionTextActive]}>{translateOption(opt, t)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('stoolAmount')}</Text>
            <View style={styles.optionGroup}>
              {['少', '中', '多'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionButton, stoolAmount === opt && styles.optionButtonActive, status && styles.disabledCheckbox]}
                  onPress={() => { if (status) return; setStoolAmount(opt); }}
                >
                  <Text style={[styles.optionText, stoolAmount === opt && styles.optionTextActive]}>{translateOption(opt, t)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('noteOrStatus')}</Text>
        <View style={styles.statusOptionsRow}>
          {Array.from(STATUS_OPTIONS).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.statusOptionButton, status === opt && styles.statusOptionButtonActive]}
              onPress={() => handleDiaperStatusSelect(opt)}
            >
              <Text style={status === opt ? styles.statusOptionTextActive : styles.statusOptionText}>{translateOption(opt, t)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderRestraintForm = () => (
    <>
      {suggestedRestraints.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('restraintItems')}</Text>
          <View style={styles.restraintGrid}>
            {suggestedRestraints.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.restraintItem, selectedRestraints.includes(item) && styles.restraintItemActive, status && styles.disabledCheckbox]}
                onPress={() => {
                  if (status) return;
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
                <Text style={styles.restraintText}>{translateOption(item, t)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('actualObservationTime')} {!status && '*'}</Text>
        <TextInput
          style={[styles.input, status && styles.disabledInput]}
          value={observationTime}
          onChangeText={setObservationTime}
          placeholder="HH:MM"
          editable={!status}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('observationStatus')} {!status && '*'}</Text>
        <View style={styles.statusGroup}>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusNormal, observationStatus === 'N' && styles.statusButtonActive, status && styles.disabledCheckbox]}
            onPress={() => { if (status) return; setObservationStatus('N'); }}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'N' && styles.statusButtonTextActive]}>
              🟢 {t('normalStatus')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusProblem, observationStatus === 'P' && styles.statusButtonActiveRed, status && styles.disabledCheckbox]}
            onPress={() => { if (status) return; setObservationStatus('P'); }}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'P' && styles.statusButtonTextActive]}>
              🔴 {t('problemStatus')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, styles.statusPaused, observationStatus === 'S' && styles.statusButtonActiveOrange, status && styles.disabledCheckbox]}
            onPress={() => { if (status) return; setObservationStatus('S'); }}
          >
            <Text style={[styles.statusButtonText, observationStatus === 'S' && styles.statusButtonTextActive]}>
              🟠 {t('suspendedStatus')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('noteOrStatus')}</Text>
        <View style={styles.statusOptionsRow}>
            {Array.from(STATUS_OPTIONS).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.statusOptionButton, status === opt && styles.statusOptionButtonActive]}
              onPress={() => handleRestraintStatusSelect(opt)}
            >
              <Text style={status === opt ? styles.statusOptionTextActive : styles.statusOptionText}>{translateOption(opt, t)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderPositionForm = () => (
    <>
      <View style={styles.infoBox}>
        <Ionicons name="refresh" size={20} color="#2563eb" />
        <View style={styles.infoBoxContent}>
          <Text style={styles.infoBoxTitle}>{t('autoPositionHint')}</Text>
          <Text style={styles.infoBoxText}>{t('leftPosition')} → {t('centerPosition')} → {t('rightPosition')} → {t('leftPosition')}</Text>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('turnPosition')} {!status && '*'}</Text>
        <View style={styles.positionGroup}>
          {(['左', '平', '右'] as const).map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[styles.positionButton, position === pos && styles.positionButtonActive, status && styles.disabledCheckbox]}
              onPress={() => { if (status) return; setPosition(pos); }}
            >
              <Text style={[styles.positionButtonText, position === pos && styles.positionButtonTextActive]}>
                {translateOption(pos, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!existingRecord && (
          <Text style={styles.hintText}>{t('suggestedPosition')}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('noteOrStatus')}</Text>
        <View style={styles.statusOptionsRow}>
          {Array.from(STATUS_OPTIONS).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.statusOptionButton, status === opt && styles.statusOptionButtonActive]}
              onPress={() => handlePositionStatusSelect(opt)}
            >
              <Text style={status === opt ? styles.statusOptionTextActive : styles.statusOptionText}>{translateOption(opt, t)}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('patientName')}</Text>
            <Text style={styles.infoValue}>{patientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('date')}</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('timeSlotLabel')}</Text>
            <Text style={styles.infoValue}>{timeSlot}</Text>
          </View>
        </View>

        {renderForm()}

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('recorder')} *</Text>
          <TextInput
            style={styles.input}
            value={recorder}
            onChangeText={setRecorder}
            placeholder={t('pleaseEnterRecorder')}
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
                <Text style={styles.deleteButtonText}>{t('deleteButton')}</Text>
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
            <Text style={styles.saveButtonText}>{t('saveButton')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backFooterButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backFooterText}>{t('backButton')}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 4,
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
  statusOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  statusOptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 8,
  },
  statusOptionButtonActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusOptionText: {
    color: '#374151',
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  disabledCheckbox: {
    opacity: 0.4,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    opacity: 0.8,
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
  backFooterButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backFooterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

export default RecordDetailScreen;
