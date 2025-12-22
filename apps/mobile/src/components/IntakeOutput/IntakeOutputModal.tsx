import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IntakeOutputRecord,
  IntakeItem,
  OutputItem,
  IntakeCategory,
  OutputCategory,
  createIntakeOutputRecord,
  updateIntakeOutputRecord,
  deleteIntakeOutputRecord,
  createIntakeItems,
  createOutputItems,
  deleteIntakeItem,
  deleteOutputItem,
} from '../../lib/database';
import IntakeSection from './IntakeSection';
import OutputSection from './OutputSection';
import AddIntakeOutputItemModal from '../AddIntakeOutputItemModal';

interface IntakeOutputModalProps {
  visible: boolean;
  onClose: () => void;
  patient: any;
  date: string;
  timeSlot: string;
  existingRecord?: IntakeOutputRecord;
  onSave: (record: IntakeOutputRecord) => void;
  onDelete?: (recordId: string) => void;
  staffName: string;
}

/**
 * 出入量記錄主模態框
 * 按照 INTAKE_OUTPUT_MODAL_REDESIGN.md 設計實現
 */
const IntakeOutputModal: React.FC<IntakeOutputModalProps> = ({
  visible,
  onClose,
  patient,
  date,
  timeSlot,
  existingRecord,
  onSave,
  onDelete,
  staffName,
}) => {
  // 基本資料
  const [recorder, setRecorder] = useState(staffName);
  const [notes, setNotes] = useState('');

  // 項目列表
  const [intakeItems, setIntakeItems] = useState<Partial<IntakeItem>[]>([]);
  const [outputItems, setOutputItems] = useState<Partial<OutputItem>[]>([]);

  // 新增項目模態框狀態
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemType, setAddItemType] = useState<'intake' | 'output'>('intake');
  const [addItemCategory, setAddItemCategory] = useState<IntakeCategory | OutputCategory>('meal');

  // 判斷是否為特殊狀態（入院/渡假/外出）
  const isSpecialStatus = Boolean(notes && ['入院', '渡假', '外出'].includes(notes));

  // 載入已有記錄 - 只在visible变为true时执行一次
  useEffect(() => {
    if (!visible) return; // 关闭时不执行
    
    if (existingRecord) {
      console.log('載入現有記錄:', {
        recorder: existingRecord.recorder,
        notes: existingRecord.notes,
        intakeItemsCount: existingRecord.intake_items?.length || 0,
        outputItemsCount: existingRecord.output_items?.length || 0,
      });
      setRecorder(existingRecord.recorder);
      setNotes(existingRecord.notes || '');
      setIntakeItems(existingRecord.intake_items || []);
      setOutputItems(existingRecord.output_items || []);
    } else {
      console.log('新增記錄，使用默認值');
      setRecorder(staffName);
      setNotes('');
      setIntakeItems([]);
      setOutputItems([]);
    }
  }, [visible]); // 只依赖visible，打开时加载一次

  // 重置表單
  const resetForm = () => {
    setRecorder(staffName);
    setNotes('');
    setIntakeItems([]);
    setOutputItems([]);
  };

  // 處理關閉
  const handleClose = () => {
    onClose();
  };

  // 打開新增攝入項目模態框
  const handleAddIntakeItem = (category: IntakeCategory) => {
    setAddItemType('intake');
    setAddItemCategory(category);
    setShowAddItemModal(true);
  };

  // 打開新增排出項目模態框
  const handleAddOutputItem = (category: OutputCategory) => {
    setAddItemType('output');
    setAddItemCategory(category);
    setShowAddItemModal(true);
  };

  // 處理新增項目
  const handleAddItem = (item: Partial<IntakeItem> | Partial<OutputItem>) => {
    if (addItemType === 'intake') {
      setIntakeItems(prev => [...prev, item as Partial<IntakeItem>]);
    } else {
      setOutputItems(prev => [...prev, item as Partial<OutputItem>]);
    }
    setShowAddItemModal(false);
  };

  // 刪除攝入項目
  const handleDeleteIntakeItem = (index: number) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除這個項目嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: () => {
            setIntakeItems(prev => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  // 刪除排出項目
  const handleDeleteOutputItem = (index: number) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除這個項目嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: () => {
            setOutputItems(prev => prev.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  // 刪除記錄
  const handleDelete = () => {
    if (!existingRecord) return;
    
    Alert.alert(
      '確認刪除',
      '確定要刪除此出入量記錄嗎？此操作無法恢復。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIntakeOutputRecord(existingRecord.id);
              Alert.alert('成功', '記錄已刪除');
              onDelete?.(existingRecord.id);
              resetForm();
              onClose();
            } catch (error) {
              console.error('刪除記錄失敗:', error);
              Alert.alert('錯誤', '刪除記錄失敗，請重試');
            }
          },
        },
      ]
    );
  };

  // 保存記錄
  const handleSave = async () => {
    // 驗證記錄者
    if (!recorder?.trim()) {
      Alert.alert('提示', '請輸入記錄者姓名');
      return;
    }

    // 驗證：非特殊狀態時必須至少有一個項目
    if (!isSpecialStatus && intakeItems.length === 0 && outputItems.length === 0) {
      Alert.alert('提示', '請至少新增一個攝入或排出項目');
      return;
    }

    console.log('準備保存記錄:', {
      intakeItemsCount: intakeItems.length,
      outputItemsCount: outputItems.length,
      intakeItems: intakeItems,
      outputItems: outputItems,
    });

    try {
      let record: IntakeOutputRecord;

      if (existingRecord) {
        // 更新現有記錄
        // 注意：notes 為空時傳送 null，以便清除原有狀態（如取消"入院"）
        const trimmedNotes = notes.trim();
        const updateData = {
          recorder: recorder.trim(),
          notes: trimmedNotes === '' ? null : trimmedNotes, // 空字串改為null以清除資料庫值
        };
        console.log('更新記錄，傳送資料:', updateData);
        const updatedRecord = await updateIntakeOutputRecord(existingRecord.id, updateData);
        if (!updatedRecord) {
          throw new Error('更新記錄失敗');
        }
        record = updatedRecord;
        console.log('更新結果:', record);

        // 刪除現有的項目（將重新創建）
        if (existingRecord.intake_items) {
          for (const item of existingRecord.intake_items) {
            if (item.id) await deleteIntakeItem(item.id);
          }
        }
        if (existingRecord.output_items) {
          for (const item of existingRecord.output_items) {
            if (item.id) await deleteOutputItem(item.id);
          }
        }
      } else {
        // 創建新記錄
        // 从 time_slot 中提取 hour_slot (例如 '08:00' -> 8)
        const hourSlot = parseInt(timeSlot.split(':')[0], 10);
        
        record = await createIntakeOutputRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: timeSlot,
          hour_slot: hourSlot,
          recorder: recorder.trim(),
          notes: notes.trim() || undefined,
        });
      }

      // 創建攝入項目 - 明確排除id和created_at欄位
      if (intakeItems.length > 0) {
        const itemsWithRecordId = intakeItems.map(item => {
          // 解構排除id和created_at
          const { id, created_at, ...rest } = item as IntakeItem;
          return {
            ...rest,
            record_id: record.id,
          };
        }) as Omit<IntakeItem, 'id' | 'created_at'>[];
        
        console.log('準備創建攝入項目:', itemsWithRecordId);
        const createdIntakeItems = await createIntakeItems(itemsWithRecordId);
        console.log('創建攝入項目成功:', createdIntakeItems);
        record.intake_items = createdIntakeItems;
      }

      // 創建排出項目 - 明確排除id和created_at欄位
      if (outputItems.length > 0) {
        const itemsWithRecordId = outputItems.map(item => {
          // 解構排除id和created_at
          const { id, created_at, ...rest } = item as OutputItem;
          return {
            ...rest,
            record_id: record.id,
          };
        }) as Omit<OutputItem, 'id' | 'created_at'>[];
        
        console.log('準備創建排出項目:', itemsWithRecordId);
        const createdOutputItems = await createOutputItems(itemsWithRecordId);
        console.log('創建排出項目成功:', createdOutputItems);
        record.output_items = createdOutputItems;
      }

      Alert.alert('成功', '出入量記錄已保存');
      onSave(record);
      resetForm();
      onClose();
    } catch (error) {
      console.error('保存出入量記錄失敗:', error);
      Alert.alert('錯誤', '保存記錄失敗，請重試');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <>
          {/* 標題欄 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>
              出入量記錄 - {date} {timeSlot}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* 主內容區域 */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16 }}>
            {/* 攝入區塊 */}
            <IntakeSection
            items={intakeItems}
            onAddItem={handleAddIntakeItem}
            onDeleteItem={handleDeleteIntakeItem}
            disabled={isSpecialStatus}
          />

          {/* 排出區塊 */}
          <OutputSection
            items={outputItems}
            onAddItem={handleAddOutputItem}
            onDeleteItem={handleDeleteOutputItem}
            disabled={isSpecialStatus}
          />

          {/* 記錄人和備註 */}
          <View style={styles.infoSection}>
            {/* 記錄者 - 可編輯 */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.infoLabel}>記錄者 *</Text>
              <TextInput
                style={styles.recorderInput}
                value={recorder}
                onChangeText={setRecorder}
                placeholder="請輸入記錄者姓名"
                placeholderTextColor="#999"
              />
            </View>

            {/* 狀態快捷按鈕 */}
            <View>
              <Text style={styles.infoLabel}>狀態</Text>
              <View style={styles.statusButtonContainer}>
                {['入院', '渡假', '外出'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => {
                      if (notes === status) {
                        setNotes(''); // 取消選擇
                      } else {
                        // 清空所有輸入項目，保留記錄者
                        setIntakeItems([]);
                        setOutputItems([]);
                        setNotes(status);
                      }
                    }}
                    style={[
                      styles.statusButton,
                      notes === status && styles.statusButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        notes === status && styles.statusButtonTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          </View>

          {/* 按鈕區域 - 根據是否為編輯模式顯示刪除按鈕 */}
          <View style={styles.modalButtons}>
            {existingRecord && (
              <Pressable
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" style={{ marginRight: 4 }} />
                <Text style={styles.modalButtonTextDelete}>刪除記錄</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.modalButton, styles.modalButtonConfirm, { flex: existingRecord ? 1 : 2 }]}
              onPress={handleSave}
            >
              <Text style={styles.modalButtonTextConfirm}>儲存</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => {
                resetForm();
                onClose();
              }}
            >
              <Text style={styles.modalButtonTextCancel}>返回</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* 新增項目子模態框 */}
        <AddIntakeOutputItemModal
          visible={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          type={addItemType}
          category={addItemCategory}
          onAdd={handleAddItem}
        />
      </>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
  },
  recorderInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  statusButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#2563eb',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  notesContainer: {
    marginTop: 0,
  },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 15,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
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
  modalButtonDelete: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
  },
  modalButtonTextDelete: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});

export default IntakeOutputModal;
