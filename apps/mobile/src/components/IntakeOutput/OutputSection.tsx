import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OutputItem } from '../../lib/database';
import { OUTPUT_CATEGORIES, formatOutputSummary } from '../../utils/intakeOutputConfig';
import IntakeOutputItem from './IntakeOutputItem';

interface OutputSectionProps {
  items: Partial<OutputItem>[];
  onAddItem: (category: 'urine' | 'gastric') => void;
  onDeleteItem: (index: number) => void;
  disabled?: boolean;
}

/**
 * 排出區塊組件
 * 包含所有排出分類（尿液、胃液）
 */
const OutputSection: React.FC<OutputSectionProps> = ({
  items,
  onAddItem,
  onDeleteItem,
  disabled = false,
}) => {
  // 過濾尿液和胃液
  const urineItems = items.filter(item => item.category === 'urine');
  const gastricItems = items.filter(item => item.category === 'gastric');

  // 計算小計
  const summary = formatOutputSummary(items as OutputItem[]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>排出 (Output)</Text>
      
      {/* 尿液分類 */}
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryTitle}>{OUTPUT_CATEGORIES.urine.label}</Text>
        
        <TouchableOpacity
          style={[styles.addButton, disabled && styles.addButtonDisabled]}
          onPress={() => onAddItem('urine')}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={20} color={disabled ? '#9ca3af' : '#007bff'} />
          <Text style={[styles.addButtonText, disabled && styles.addButtonTextDisabled]}>新增尿液記錄</Text>
        </TouchableOpacity>

        {urineItems.length > 0 && (
          <View style={styles.itemsList}>
            {urineItems.map((item, index) => {
              const originalIndex = items.findIndex(i => 
                i.category === 'urine' && 
                i.color === item.color && 
                i.amount_ml === item.amount_ml
              );
              const label = `${item.color || ''}`;
              const amount = `${item.amount_ml}ml`;
              
              return (
                <IntakeOutputItem
                  key={`urine-${index}`}
                  icon={OUTPUT_CATEGORIES.urine.icon}
                  label={label}
                  amount={amount}
                  onDelete={() => onDeleteItem(originalIndex)}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* 胃液分類 */}
      <View style={styles.categoryContainer}>
        <Text style={styles.categoryTitle}>{OUTPUT_CATEGORIES.gastric.label}</Text>
        
        <TouchableOpacity
          style={[styles.addButton, disabled && styles.addButtonDisabled]}
          onPress={() => onAddItem('gastric')}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={20} color={disabled ? '#9ca3af' : '#007bff'} />
          <Text style={[styles.addButtonText, disabled && styles.addButtonTextDisabled]}>新增胃液記錄</Text>
        </TouchableOpacity>

        {gastricItems.length > 0 && (
          <View style={styles.itemsList}>
            {gastricItems.map((item, index) => {
              const originalIndex = items.findIndex(i => 
                i.category === 'gastric' && 
                i.color === item.color && 
                i.ph_value === item.ph_value &&
                i.amount_ml === item.amount_ml
              );
              const label = `${item.color || ''} pH:${item.ph_value || '-'}`;
              const amount = `${item.amount_ml}ml`;
              
              return (
                <IntakeOutputItem
                  key={`gastric-${index}`}
                  icon={OUTPUT_CATEGORIES.gastric.icon}
                  label={label}
                  amount={amount}
                  onDelete={() => onDeleteItem(originalIndex)}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* 小計 */}
      {items.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryLabel}>小計:</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#dc3545',
    paddingBottom: 8,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007bff',
    borderStyle: 'dashed',
  },
  addButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#007bff',
  },
  addButtonTextDisabled: {
    color: '#9ca3af',
  },
  itemsList: {
    marginTop: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#dc3545',
    fontWeight: '600',
    flex: 1,
  },
});

export default OutputSection;
