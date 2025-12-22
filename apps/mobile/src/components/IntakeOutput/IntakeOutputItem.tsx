import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IntakeOutputItemProps {
  icon: string;
  label: string;
  amount: string;
  onDelete: () => void;
}

/**
 * 出入量項目卡片組件
 * 用於顯示單個攝入或排出項目
 */
const IntakeOutputItem: React.FC<IntakeOutputItemProps> = ({
  icon,
  label,
  amount,
  onDelete,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount}>{amount}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007bff',
    marginRight: 12,
  },
  deleteButton: {
    padding: 4,
  },
});

export default IntakeOutputItem;
