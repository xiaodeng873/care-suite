import { Stack } from 'expo-router';

export default function HealthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '健康記錄 - 選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '健康記錄' }} />
    </Stack>
  );
}
