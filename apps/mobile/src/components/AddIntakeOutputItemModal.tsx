import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IntakeCategory,
  OutputCategory,
  IntakeItem,
  OutputItem,
} from '../lib/database';
import {
  INTAKE_CATEGORIES,
  OUTPUT_CATEGORIES,
  portionToNumber,
} from '../utils/intakeOutputConfig';
import { useTranslation } from '../lib/i18n';

type AddItemType = 'intake' | 'output';

interface AddIntakeOutputItemModalProps {
  visible: boolean;
  onClose: () => void;
  type: AddItemType;
  category: IntakeCategory | OutputCategory;
  onAdd: (item: Partial<IntakeItem> | Partial<OutputItem>) => void;
}

const AddIntakeOutputItemModal: React.FC<AddIntakeOutputItemModalProps> = ({
  visible,
  onClose,
  type,
  category,
  onAdd,
}) => {
  const { t } = useTranslation();

  // Intake 狀態
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<string>('');
  const [mlAmount, setMlAmount] = useState<string>('');
  const [pieceAmount, setPieceAmount] = useState<string>('');
  const [pieceUnit, setPieceUnit] = useState<string>('塊');

  // Output 狀態
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [phValue, setPhValue] = useState<string>('');
  const [outputMl, setOutputMl] = useState<string>('');

  // 選單顯示狀態
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showAmountMenu, setShowAmountMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);

  // 重置表單
  const resetForm = () => {
    setSelectedType('');
    setSelectedAmount('');
    setMlAmount('');
    setPieceAmount('');
    setPieceUnit('塊');
    setSelectedColor('');
    setPhValue('');
    setOutputMl('');
    setShowTypeMenu(false);
    setShowAmountMenu(false);
    setShowColorMenu(false);
    setShowUnitMenu(false);
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  const getTitle = () => {
    if (type === 'intake') {
      const config = INTAKE_CATEGORIES[category as IntakeCategory];
      return `新增 - ${config.label}`;
    } else {
      const config = OUTPUT_CATEGORIES[category as OutputCategory];
      return `新增 - ${config.label}`;
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleAdd = () => {
    if (type === 'intake') {
      const intakeCategory = category as IntakeCategory;
      const config = INTAKE_CATEGORIES[intakeCategory];

      if (!selectedType) {
        Alert.alert('錯誤', '請選擇類型');
        return;
      }

      let amount = '';
      let amountNumeric = 0;
      let unit = config.unit;

      if (intakeCategory === 'meal') {
        if (!selectedAmount) {
          Alert.alert('錯誤', '請選擇份量');
          return;
        }
        amount = selectedAmount;
        amountNumeric = portionToNumber(selectedAmount);
      } else if (intakeCategory === 'other') {
        if (!pieceAmount || parseInt(pieceAmount) <= 0) {
          Alert.alert('錯誤', '請輸入數量');
          return;
        }
        amount = `${pieceAmount}${pieceUnit}`;
        amountNumeric = parseInt(pieceAmount);
        unit = 'piece';
      } else {
        if (!mlAmount || parseInt(mlAmount) <= 0) {
          Alert.alert('錯誤', '請輸入容量');
          return;
        }
        amount = `${mlAmount}ml`;
        amountNumeric = parseInt(mlAmount);
      }

      const item: Partial<IntakeItem> = {
        category: intakeCategory,
        item_type: selectedType,
        amount,
        amount_numeric: amountNumeric,
        unit,
      };

      onAdd(item);
      resetForm();
      onClose();
    } else {
      const outputCategory = category as OutputCategory;
      const config = OUTPUT_CATEGORIES[outputCategory];

      if (!selectedColor) {
        Alert.alert('錯誤', '請選擇顏色');
        return;
      }

      if (!outputMl || parseInt(outputMl) <= 0) {
        Alert.alert('錯誤', '請輸入容量');
        return;
      }

      const item: Partial<OutputItem> = {
        category: outputCategory,
        color: selectedColor,
        amount_ml: parseInt(outputMl),
      };

      if (config.hasPH && phValue) {
        const ph = parseFloat(phValue);
        if (ph >= 0 && ph <= 14) {
          item.ph_value = ph;
        }
      }

      onAdd(item);
      resetForm();
      onClose();
    }
  };

  // 渲染選單按鈕
  const renderMenuButton = (
    label: string,
    value: string,
    onPress: () => void,
    placeholder: string = '請選擇...'
  ) => (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <Text style={value ? styles.menuButtonTextSelected : styles.menuButtonTextPlaceholder}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  // 渲染選項列表
  const renderOptionsList = (
    options: string[],
    onSelect: (value: string) => void,
    onClose: () => void
  ) => (
    <View style={styles.optionsContainer}>
      <FlatList
        data={options}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onSelect(item);
              onClose();
            }}
          >
            <Text style={styles.optionText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // 渲染攝入表單
  const renderIntakeForm = () => {
    const intakeCategory = category as IntakeCategory;
    const config = INTAKE_CATEGORIES[intakeCategory];

    return (
      <>
        {/* 類型選擇 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>類型</Text>
          {showTypeMenu ? (
            renderOptionsList(
              config.types || [],
              setSelectedType,
              () => setShowTypeMenu(false)
            )
          ) : (
            renderMenuButton('類型', selectedType, () => setShowTypeMenu(true))
          )}
        </View>

        {/* 數量輸入 - 根據類別不同 */}
        {intakeCategory === 'meal' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>份量</Text>
            {showAmountMenu ? (
              renderOptionsList(
                config.amounts || [],
                setSelectedAmount,
                () => setShowAmountMenu(false)
              )
            ) : (
              renderMenuButton('份量', selectedAmount, () => setShowAmountMenu(true))
            )}
          </View>
        )}

        {(intakeCategory === 'beverage' || intakeCategory === 'tube_feeding') && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>容量 (ml)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="請輸入容量"
              value={mlAmount}
              onChangeText={setMlAmount}
            />
          </View>
        )}

        {intakeCategory === 'other' && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>數量</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="請輸入數量"
                value={pieceAmount}
                onChangeText={setPieceAmount}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>單位</Text>
              {showUnitMenu ? (
                renderOptionsList(
                  config.units || [],
                  setPieceUnit,
                  () => setShowUnitMenu(false)
                )
              ) : (
                renderMenuButton('單位', pieceUnit, () => setShowUnitMenu(true))
              )}
            </View>
          </>
        )}
      </>
    );
  };

  // 渲染排出表單
  const renderOutputForm = () => {
    const outputCategory = category as OutputCategory;
    const config = OUTPUT_CATEGORIES[outputCategory];

    return (
      <>
        {/* 顏色選擇 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>顏色</Text>
          {showColorMenu ? (
            renderOptionsList(
              config.colors || [],
              setSelectedColor,
              () => setShowColorMenu(false)
            )
          ) : (
            renderMenuButton('顏色', selectedColor, () => setShowColorMenu(true))
          )}
        </View>

        {/* pH值 (僅胃液) */}
        {config.hasPH && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>pH值 (選填)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="請輸入pH值 (0-14)"
              value={phValue}
              onChangeText={setPhValue}
            />
          </View>
        )}

        {/* 容量 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>容量 (ml)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="請輸入容量"
            value={outputMl}
            onChangeText={setOutputMl}
          />
        </View>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 標題欄 */}
          <View style={styles.header}>
            <Text style={styles.title}>{getTitle()}</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* 表單內容 */}
          <View style={styles.content}>
            {type === 'intake' ? renderIntakeForm() : renderOutputForm()}
          </View>

          {/* 操作按鈕 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={handleAdd}
            >
              <Text style={styles.addButtonText}>新增</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '80%',
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  menuButtonTextSelected: {
    fontSize: 16,
    color: '#111827',
  },
  menuButtonTextPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  optionsContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  optionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
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
  addButton: {
    backgroundColor: '#2563eb',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AddIntakeOutputItemModal;
