import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IntakeItem, IntakeCategory } from '../../lib/database';
import IntakeOutputItem from './IntakeOutputItem';

interface CategorySectionProps {
  title: string;
  icon: string;
  category: IntakeCategory;
  items: Partial<IntakeItem>[];
  onAddPress: () => void;
  onDeleteItem: (index: number) => void;
  disabled?: boolean;
}

/**
 * 分類區塊組件
 * 用於顯示單個攝入分類（餐膳/飲料/其他/鼻胃飼）
 */
const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  icon,
  category,
  items,
  onAddPress,
  onDeleteItem,
  disabled = false,
}) => {
  // 過濾出當前分類的項目
  const categoryItems = items.filter(item => item.category === category);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* 新增按鈕 */}
      <TouchableOpacity
        style={[styles.addButton, disabled && styles.addButtonDisabled]}
        onPress={onAddPress}
        disabled={disabled}
      >
        <Ionicons name="add-circle-outline" size={20} color={disabled ? '#9ca3af' : '#007bff'} />
        <Text style={[styles.addButtonText, disabled && styles.addButtonTextDisabled]}>新增{title}項目</Text>
      </TouchableOpacity>

      {/* 項目列表 */}
      {categoryItems.length > 0 && (
        <View style={styles.itemsList}>
          {categoryItems.map((item, index) => {
            // 找到原始索引
            const originalIndex = items.findIndex(
              i => i.category === category && 
                   i.item_type === item.item_type && 
                   i.amount === item.amount
            );
            
            return (
              <IntakeOutputItem
                key={`${item.item_type}-${index}`}
                icon={icon}
                label={item.item_type || ''}
                amount={item.amount || ''}
                onDelete={() => onDeleteItem(originalIndex)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
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
});

export default CategorySection;
