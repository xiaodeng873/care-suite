import { Stack } from 'expo-router';

export default function DiagnosisLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '診斷記錄' }} />
    </Stack>
  );
}
