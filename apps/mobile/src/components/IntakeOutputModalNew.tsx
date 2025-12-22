import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
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
  createIntakeItems,
  createOutputItems,
  deleteIntakeItem,
  deleteOutputItem,
} from '../lib/database';
import {
  INTAKE_CATEGORIES,
  OUTPUT_CATEGORIES,
  formatIntakeSummary,
  formatOutputSummary,
} from '../utils/intakeOutputConfig';
import AddIntakeOutputItemModal from '../components/AddIntakeOutputItemModal';
import { useTranslation } from '../lib/i18n';

interface IntakeOutputModalNewProps {
  visible: boolean;
  onClose: () => void;
  patient: any;
  date: string;
  timeSlot: string;
  existingRecord?: IntakeOutputRecord;
  onSave: (record: IntakeOutputRecord) => void;
  staffName: string;
}

const IntakeOutputModalNew: React.FC<IntakeOutputModalNewProps> = ({
  visible,
  onClose,
  patient,
  date,
  timeSlot,
  existingRecord,
  onSave,
  staffName,
}) => {
  const { t } = useTranslation();

  // 基本資料
  const [recorder, setRecorder] = useState(staffName);
  const [notes, setNotes] = useState('');

  // 項目列表
  const [intakeItems, setIntakeItems] = useState<Partial<IntakeItem>[]>([]);
  const [outputItems, setOutputItems] = useState<Partial<OutputItem>[]>([]);

  // 新增項目模態框
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemType, setAddItemType] = useState<'intake' | 'output'>('intake');
  const [addItemCategory, setAddItemCategory] = useState<IntakeCategory | OutputCategory>('meal');

  // 載入已有記錄
  useEffect(() => {
    if (existingRecord) {
      setRecorder(existingRecord.recorder);
      setNotes(existingRecord.notes || '');
      setIntakeItems(existingRecord.intake_items || []);
      setOutputItems(existingRecord.output_items || []);
    } else {
      setRecorder(staffName);
      setNotes('');
      setIntakeItems([]);
      setOutputItems([]);
    }
  }, [existingRecord, staffName]);

  // 重置表單
  const resetForm = () => {
    setRecorder(staffName);
    setNotes('');
    setIntakeItems([]);
    setOutputItems([]);
  };

  // 處理關閉
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 處理儲存
  const handleSave = async () => {
    if (!recorder.trim()) {
      Alert.alert('錯誤', '請輸入記錄者姓名');
      return;
    }

    try {
      let record: IntakeOutputRecord;

      if (existingRecord) {
        // 更新現有記錄
        const updated = await updateIntakeOutputRecord(existingRecord.id, {
          recorder: recorder.trim(),
          notes: notes.trim() || undefined,
        });

        if (!updated) throw new Error('更新記錄失敗');

        // 刪除舊的項目並創建新的
        // TODO: 優化為只更新變更的項目
        record = updated;
      } else {
        // 創建新記錄
        record = await createIntakeOutputRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: timeSlot,
          recorder: recorder.trim(),
          notes: notes.trim() || undefined,
        });
      }

      // 創建攝入項目
      if (intakeItems.length > 0) {
        const itemsToCreate = intakeItems.map(item => ({
          record_id: record.id,
          category: item.category!,
          item_type: item.item_type!,
          amount: item.amount!,
          amount_numeric: item.amount_numeric!,
          unit: item.unit!,
        }));
        const createdIntakeItems = await createIntakeItems(itemsToCreate);
        record.intake_items = createdIntakeItems;
      }

      // 創建排出項目
      if (outputItems.length > 0) {
        const itemsToCreate = outputItems.map(item => ({
          record_id: record.id,
          category: item.category!,
          color: item.color,
          ph_value: item.ph_value,
          amount_ml: item.amount_ml!,
        }));
        const createdOutputItems = await createOutputItems(itemsToCreate);
        record.output_items = createdOutputItems;
      }

      onSave(record);
      handleClose();
    } catch (error) {
      console.error('保存出入量記錄失敗:', error);
      Alert.alert('錯誤', '保存記錄失敗，請重試');
    }
  };

  // 打開新增項目模態框
  const openAddItemModal = (type: 'intake' | 'output', category: IntakeCategory | OutputCategory) => {
    setAddItemType(type);
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
  };

  // 處理刪除項目
  const handleDeleteItem = (type: 'intake' | 'output', index: number) => {
    if (type === 'intake') {
      setIntakeItems(prev => prev.filter((_, i) => i !== index));
    } else {
      setOutputItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 渲染攝入類別區塊
  const renderIntakeCategory = (category: IntakeCategory) => {
    const config = INTAKE_CATEGORIES[category];
    const categoryItems = intakeItems.filter(item => item.category === category);

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryTitleRow}>
            <Text style={styles.categoryIcon}>{config.icon}</Text>
            <Text style={styles.categoryTitle}>{config.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openAddItemModal('intake', category)}
          >
            <Ionicons name="add-circle" size={20} color="#10b981" />
            <Text style={styles.addButtonText}>新增</Text>
          </TouchableOpacity>
        </View>

        {categoryItems.length > 0 ? (
          <View style={styles.itemsList}>
            {categoryItems.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemType}>{item.item_type}</Text>
                  <Text style={styles.itemAmount}>{item.amount}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const globalIndex = intakeItems.findIndex(
                      i => i.category === category && i.item_type === item.item_type && i.amount === item.amount
                    );
                    handleDeleteItem('intake', globalIndex);
                  }}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>尚無項目</Text>
        )}
      </View>
    );
  };

  // 渲染排出類別區塊
  const renderOutputCategory = (category: OutputCategory) => {
    const config = OUTPUT_CATEGORIES[category];
    const categoryItems = outputItems.filter(item => item.category === category);

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryTitleRow}>
            <Text style={styles.categoryIcon}>{config.icon}</Text>
            <Text style={styles.categoryTitle}>{config.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openAddItemModal('output', category)}
          >
            <Ionicons name="add-circle" size={20} color="#3b82f6" />
            <Text style={[styles.addButtonText, { color: '#3b82f6' }]}>新增</Text>
          </TouchableOpacity>
        </View>

        {categoryItems.length > 0 ? (
          <View style={styles.itemsList}>
            {categoryItems.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemType}>
                    {item.color}
                    {item.ph_value !== undefined && ` pH:${item.ph_value}`}
                  </Text>
                  <Text style={styles.itemAmount}>{item.amount_ml}ml</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const globalIndex = outputItems.findIndex(
                      i => i.category === category && i.color === item.color && i.amount_ml === item.amount_ml
                    );
                    handleDeleteItem('output', globalIndex);
                  }}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>尚無項目</Text>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
            {/* 標題欄 */}
            <View style={styles.header}>
              <Text style={styles.title}>
                出入量記錄 - {date} {timeSlot}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* 滾動內容 */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* 基本資料 */}
              <View style={styles.basicInfo}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>院友姓名</Text>
                  <Text style={styles.patientName}>{patient.中文姓名}</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>記錄者 *</Text>
                  <TextInput
                    style={styles.input}
                    value={recorder}
                    onChangeText={setRecorder}
                    placeholder="請輸入記錄者姓名"
                  />
                </View>
              </View>

              {/* 攝入區塊 */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="arrow-up-circle" size={24} color="#059669" />
                  <Text style={styles.sectionTitle}>攝入 (Intake)</Text>
                </View>

                {(Object.keys(INTAKE_CATEGORIES) as IntakeCategory[]).map(category =>
                  renderIntakeCategory(category)
                )}

                {/* 攝入小計 */}
                {intakeItems.length > 0 && (
                  <View style={styles.subtotalBox}>
                    <Text style={styles.subtotalLabel}>攝入小計:</Text>
                    <Text style={styles.subtotalValue}>
                      {formatIntakeSummary(intakeItems as any)}
                    </Text>
                  </View>
                )}
              </View>

              {/* 排出區塊 */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="arrow-down-circle" size={24} color="#3b82f6" />
                  <Text style={[styles.sectionTitle, { color: '#3b82f6' }]}>
                    排出 (Output)
                  </Text>
                </View>

                {(Object.keys(OUTPUT_CATEGORIES) as OutputCategory[]).map(category =>
                  renderOutputCategory(category)
                )}

                {/* 排出小計 */}
                {outputItems.length > 0 && (
                  <View style={[styles.subtotalBox, { backgroundColor: '#dbeafe' }]}>
                    <Text style={styles.subtotalLabel}>排出小計:</Text>
                    <Text style={styles.subtotalValue}>
                      {formatOutputSummary(outputItems as any)}
                    </Text>
                  </View>
                )}
              </View>

              {/* 備註 */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>備註</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="輸入備註..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            {/* 操作按鈕 */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>儲存記錄</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 新增項目子模態框 */}
      <AddIntakeOutputItemModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        type={addItemType}
        category={addItemCategory}
        onAddItem={handleAddItem}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  basicInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  sectionBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 8,
  },
  categorySection: {
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10b981',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 8,
  },
  itemType: {
    fontSize: 14,
    color: '#374151',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deleteButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  subtotalBox: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#065f46',
  },
  subtotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default IntakeOutputModalNew;
