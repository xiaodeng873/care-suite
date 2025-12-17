import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen: React.FC = () => {
  const { user, displayName, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('確認登出', '您確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#2563eb" />
        </View>
        <Text style={styles.displayName}>{displayName || '未設定姓名'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>帳戶資訊</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>電子郵件</Text>
            </View>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>顯示名稱</Text>
            </View>
            <Text style={styles.infoValue}>{displayName || '未設定'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>關於</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>版本</Text>
            </View>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="business-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>系統</Text>
            </View>
            <Text style={styles.infoValue}>Station C 護理記錄</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.signOutText}>登出</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Station C 護理記錄系統</Text>
        <Text style={styles.footerCopyright}>© 2025 All Rights Reserved</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabelText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 15,
    color: '#6b7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginLeft: 48,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  footerCopyright: {
    fontSize: 12,
    color: '#d1d5db',
  },
});

export default SettingsScreen;
