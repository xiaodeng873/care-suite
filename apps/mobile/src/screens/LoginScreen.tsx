import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../lib/i18n';

const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState(''); // 用戶名或 Email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, customLogin } = useAuth();

  // 自動判斷是 Email（開發者）還是用戶名（員工）
  const isEmail = (value: string) => value.includes('@');

  const handleLogin = async () => {
    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      Alert.alert(t('loginError'), '請輸入帳號和密碼');
      return;
    }

    setLoading(true);
    try {
      // 自動判斷：包含 @ 為開發者（Email），否則為員工（用戶名）
      if (isEmail(trimmedIdentifier)) {
        // 開發者登入 - Supabase Auth
        const { error } = await signIn(trimmedIdentifier, trimmedPassword);
        if (error) {
          Alert.alert(t('loginFailed'), error.message || t('loginFailedMessage'));
        }
      } else {
        // 員工登入 - 自訂認證
        const { error } = await customLogin(trimmedIdentifier, trimmedPassword);
        if (error) {
          Alert.alert('登入失敗', error);
        }
      }
    } catch (err) {
      console.error('登入異常:', err);
      Alert.alert(t('loginError'), t('unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="clipboard-outline" size={48} color="#2563eb" />
          </View>
          <Text style={styles.title}>{t('loginTitle')}</Text>
          <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          {/* 帳號輸入（自動判斷員工用戶名或開發者 Email）*/}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="用戶名 或 Email"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6b7280"
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              loading && styles.loginButtonDisabled,
              pressed && !loading && styles.loginButtonPressed
            ]}
            onPress={handleLogin}
            disabled={loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('loginButtonLabel')}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>{t('loginButton')}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('footer')}</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  loginButtonPressed: {
    backgroundColor: '#1d4ed8',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});

export default LoginScreen;
