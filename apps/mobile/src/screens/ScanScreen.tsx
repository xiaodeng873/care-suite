import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getBedByQrCodeId, getPatientByBedId } from '../lib/database';

const ScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  const handleQRCodeScan = async (data: string) => {
    setLoading(true);
    try {
      const qrData = JSON.parse(data);
      
      if (qrData.type !== 'bed' || !qrData.qr_code_id) {
        Alert.alert('無效的 QR Code', '請掃描有效的床位 QR Code');
        return;
      }

      const bed = await getBedByQrCodeId(qrData.qr_code_id);
      if (!bed) {
        Alert.alert('找不到床位', '無法找到對應的床位資訊');
        return;
      }

      const patient = await getPatientByBedId(bed.id);
      if (!patient) {
        Alert.alert('床位空置', `床位 ${bed.bed_number} 目前沒有在住院友`);
        return;
      }

      navigation.navigate('CareRecords', { patient });
    } catch (error) {
      console.error('QR Code 解析失敗:', error);
      Alert.alert('掃描失敗', 'QR Code 格式無效');
    } finally {
      setLoading(false);
    }
  };

  // Web 版本介面
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code" size={48} color="#2563eb" />
          </View>
          <Text style={styles.webTitle}>QR Code 掃描</Text>
          <Text style={styles.webSubtitle}>在手機 App 上使用相機掃描床位 QR Code</Text>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.manualTitle}>從院友列表選擇</Text>
          <Pressable
            style={styles.listButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="list" size={24} color="#2563eb" />
            <Text style={styles.listButtonText}>前往院友列表</Text>
          </Pressable>

          <View style={styles.tipBox}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.tipText}>
              提示：在真實手機上使用此 App 可以直接掃描 QR Code
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 原生平台介面 - 簡化版（因為相機需要在真實設備上測試）
  return (
    <View style={styles.container}>
      <View style={styles.nativeContent}>
        <View style={styles.iconCircle}>
          <Ionicons name="qr-code" size={48} color="#2563eb" />
        </View>
        <Text style={styles.webTitle}>掃描床位 QR Code</Text>
        <Text style={styles.webSubtitle}>點擊下方按鈕開始掃描</Text>

        <Pressable
          style={styles.scanButton}
          onPress={() => Alert.alert('提示', '相機掃描功能需要在真實手機上使用')}
        >
          <Ionicons name="camera" size={24} color="#ffffff" />
          <Text style={styles.scanButtonText}>開始掃描</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>或</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.manualTitle}>從院友列表選擇</Text>
        <Pressable
          style={styles.listButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="list" size={24} color="#2563eb" />
          <Text style={styles.listButtonText}>前往院友列表</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  nativeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9ca3af',
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
    marginRight: 12,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    marginLeft: 8,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  listButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ScanScreen;
