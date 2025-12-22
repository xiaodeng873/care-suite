import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IntakeItem } from '../../lib/database';
import { INTAKE_CATEGORIES, formatIntakeSummary } from '../../utils/intakeOutputConfig';
import CategorySection from './CategorySection';

interface IntakeSectionProps {
  items: Partial<IntakeItem>[];
  onAddItem: (category: 'meal' | 'beverage' | 'other' | 'tube_feeding') => void;
  onDeleteItem: (index: number) => void;
  disabled?: boolean;
}

/**
 * 攝入區塊組件
 * 包含所有攝入分類（餐膳、飲料、其他、鼻胃飼）
 */
const IntakeSection: React.FC<IntakeSectionProps> = ({
  items,
  onAddItem,
  onDeleteItem,
  disabled = false,
}) => {
  // 計算小計
  const summary = formatIntakeSummary(items as IntakeItem[]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>攝入 (Intake)</Text>
      
      {/* 餐膳分類 */}
      <CategorySection
        title={INTAKE_CATEGORIES.meal.label}
        icon={INTAKE_CATEGORIES.meal.icon}
        category="meal"
        items={items}
        onAddPress={() => onAddItem('meal')}
        onDeleteItem={onDeleteItem}
        disabled={disabled}
      />

      {/* 飲料分類 */}
      <CategorySection
        title={INTAKE_CATEGORIES.beverage.label}
        icon={INTAKE_CATEGORIES.beverage.icon}
        category="beverage"
        items={items}
        onAddPress={() => onAddItem('beverage')}
        onDeleteItem={onDeleteItem}
        disabled={disabled}
      />

      {/* 其他分類 */}
      <CategorySection
        title={INTAKE_CATEGORIES.other.label}
        icon={INTAKE_CATEGORIES.other.icon}
        category="other"
        items={items}
        onAddPress={() => onAddItem('other')}
        onDeleteItem={onDeleteItem}
        disabled={disabled}
      />

      {/* 鼻胃飼分類 */}
      <CategorySection
        title={INTAKE_CATEGORIES.tube_feeding.label}
        icon={INTAKE_CATEGORIES.tube_feeding.icon}
        category="tube_feeding"
        items={items}
        onAddPress={() => onAddItem('tube_feeding')}
        onDeleteItem={onDeleteItem}
        disabled={disabled}
      />

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
    borderBottomColor: '#007bff',
    paddingBottom: 8,
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
    color: '#28a745',
    fontWeight: '600',
    flex: 1,
  },
});

export default IntakeSection;
