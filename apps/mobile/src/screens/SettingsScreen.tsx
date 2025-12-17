import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

import { getMissingLookbackDays, setMissingLookbackDays } from '../lib/settings';
import { eventBus } from '../lib/eventBus';
import { useTranslation, type Language } from '../lib/i18n';

const SettingsScreen: React.FC = () => {
  const { user, displayName, signOut } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const [lookback, setLookback] = React.useState<number | ''>('');
  const [showLookbackControls, setShowLookbackControls] = React.useState(false);
  const [showLanguageModal, setShowLanguageModal] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const d = await getMissingLookbackDays();
        setLookback(d);
      } catch (err) {
        console.warn('讀取補錄回溯天數失敗', err);
        setLookback(30);
      }
    })();
  }, []);

  const handleSignOut = () => {
    Alert.alert(t('confirmSignOut'), t('confirmSignOutMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleLanguageChange = async (newLang: Language) => {
    await setLanguage(newLang);
    setShowLanguageModal(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#2563eb" />
        </View>
        <Text style={styles.displayName}>{displayName || t('notSet')}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('accountInfo')}</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('email')}</Text>
            </View>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('displayName')}</Text>
            </View>
            <Text style={styles.infoValue}>{displayName || t('notSet')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('features')}</Text>
        <View style={styles.card}>
          {/* 語言選擇 */}
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.infoLabel}>
              <Ionicons name="language-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('language')}</Text>
            </View>
            <View style={styles.infoValue}>
              <Text style={styles.infoValueText}>
                {language === 'zh-TW' ? t('languageTraditionalChinese') : 
                 language === 'zh-CN' ? t('languageSimplifiedChinese') : 
                 t('languageEnglish')}
              </Text>
             
            </View>
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          {/* 補錄回溯天數 */}
          <TouchableOpacity 
            style={styles.infoRow} 
            onPress={() => setShowLookbackControls(!showLookbackControls)}
          >
            <View style={styles.infoLabel}>
              <Ionicons name="time-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('missingRecordsLookback')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.infoValue} testID="lookbackValue">
                {lookback === '' ? '-' : `${lookback} ${t('days')}`}
              </Text>
              <Ionicons 
                name={showLookbackControls ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#6b7280" 
              />
            </View>
          </TouchableOpacity>
          
          {showLookbackControls && (
            <>
              <View style={styles.divider} />
              <View style={[styles.infoRow, { paddingVertical: 6 }]}> 
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperButton, lookback === '' || lookback <= 1 ? styles.stepperDisabled : {}]}
                onPress={async () => {
                  const current = lookback === '' ? await getMissingLookbackDays() : Number(lookback);
                  const next = Math.max(1, current - 1);
                  await setMissingLookbackDays(next);
                  setLookback(next);
                  eventBus.emit('settingsChanged', { key: 'missingLookbackDays', days: next });
                }}
                disabled={lookback === '' || lookback <= 1}
              >
                <Ionicons name="remove" size={20} color={lookback === '' || lookback <= 1 ? '#d1d5db' : '#374151'} />
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { width: 84, textAlign: 'center', marginHorizontal: 8 }]}
                keyboardType="number-pad"
                placeholder="30"
                value={lookback === '' ? '' : String(lookback)}
                onChangeText={(t) => setLookback(t === '' ? '' : Number(t))}
                onEndEditing={async (e) => {
                  const raw = e.nativeEvent.text || String(lookback || 30);
                  let val = Number(raw);
                  if (!Number.isFinite(val) || isNaN(val)) {
                    Alert.alert(t('inputError'), t('inputErrorMessage'));
                    setLookback(30);
                    await setMissingLookbackDays(30);
                    eventBus.emit('settingsChanged', { key: 'missingLookbackDays', days: 30 });
                    return;
                  }
                  val = Math.round(val);
                  const clamped = Math.min(365, Math.max(1, val));
                  if (clamped !== val) {
                    Alert.alert(t('corrected'), `${t('correctedMessage')} ${clamped} ${t('days')}`);
                  }
                  await setMissingLookbackDays(clamped);
                  setLookback(clamped);
                  eventBus.emit('settingsChanged', { key: 'missingLookbackDays', days: clamped });
                }}
              />

              <TouchableOpacity
                style={[styles.stepperButton, lookback === '' || lookback >= 365 ? styles.stepperDisabled : {}]}
                onPress={async () => {
                  const current = lookback === '' ? await getMissingLookbackDays() : Number(lookback);
                  const next = Math.min(365, current + 1);
                  await setMissingLookbackDays(next);
                  setLookback(next);
                  eventBus.emit('settingsChanged', { key: 'missingLookbackDays', days: next });
                }}
                disabled={lookback === '' || lookback >= 365}
              >
                <Ionicons name="add" size={20} color={lookback === '' || lookback >= 365 ? '#d1d5db' : '#374151'} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#6b7280' }}>{t('daysUnit')}</Text>
          </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about')}</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('version')}</Text>
            </View>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="business-outline" size={20} color="#6b7280" />
              <Text style={styles.infoLabelText}>{t('system')}</Text>
            </View>
            <Text style={styles.infoValue}>{t('systemName')}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.signOutText}>{t('signOut')}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('footer')}</Text>
        <Text style={styles.footerCopyright}>{t('copyright')}</Text>
      </View>

      {/* 語言選擇模態框 */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.languageOption, language === 'zh-TW' && styles.languageOptionActive]}
              onPress={() => handleLanguageChange('zh-TW')}
            >
              <Text style={[styles.languageOptionText, language === 'zh-TW' && styles.languageOptionTextActive]}>
                {t('languageTraditionalChinese')}
              </Text>
              {language === 'zh-TW' && (
                <Ionicons name="checkmark" size={24} color="#2563eb" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.languageOption, language === 'zh-CN' && styles.languageOptionActive]}
              onPress={() => handleLanguageChange('zh-CN')}
            >
              <Text style={[styles.languageOptionText, language === 'zh-CN' && styles.languageOptionTextActive]}>
                {t('languageSimplifiedChinese')}
              </Text>
              {language === 'zh-CN' && (
                <Ionicons name="checkmark" size={24} color="#2563eb" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageOptionText, language === 'en' && styles.languageOptionTextActive]}>
                {t('languageEnglish')}
              </Text>
              {language === 'en' && (
                <Ionicons name="checkmark" size={24} color="#2563eb" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  languageOptionActive: {
    backgroundColor: '#eff6ff',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  languageOptionTextActive: {
    color: '#2563eb',
    fontWeight: '600',
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
  input: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepperDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#f3f4f6',
  },
});

export default SettingsScreen;
