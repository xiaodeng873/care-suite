import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn, customLogin } from '@/lib/auth/auth';

const isEmail = (value: string) => value.includes('@');

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const id = identifier.trim();
    const pw = password.trim();

    if (!id || !pw) {
      Alert.alert('請輸入帳號和密碼');
      return;
    }

    setLoading(true);
    try {
      const { error } = isEmail(id)
        ? await signIn(id, pw)
        : await customLogin(id, pw);

      if (error) {
        Alert.alert('登入失敗', typeof error === 'string' ? error : error.message);
      } else {
        router.replace('/(app)');
      }
    } catch {
      Alert.alert('登入時發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo / Title */}
        <View className="mb-10 items-center">
          <Text className="text-3xl font-bold text-primary-600">SeniorCare</Text>
          <Text className="mt-1 text-sm text-gray-500">院舍管理系統</Text>
        </View>

        {/* Identifier */}
        <View className="mb-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">帳號 / Email</Text>
          <TextInput
            className="h-12 rounded-lg border border-gray-300 px-4 text-base"
            placeholder="輸入用戶名或 Email"
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
          />
        </View>

        {/* Password */}
        <View className="mb-6">
          <Text className="mb-1 text-sm font-medium text-gray-700">密碼</Text>
          <View className="flex-row items-center rounded-lg border border-gray-300">
            <TextInput
              className="h-12 flex-1 px-4 text-base"
              placeholder="輸入密碼"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              className="px-4"
              onPress={() => setShowPassword(v => !v)}
              hitSlop={8}
            >
              <Text className="text-sm text-gray-400">{showPassword ? '隱藏' : '顯示'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          className="h-12 items-center justify-center rounded-lg bg-primary-600 active:bg-primary-700"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-base font-semibold text-white">登入</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
