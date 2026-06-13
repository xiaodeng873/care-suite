import { Stack } from 'expo-router';

export default function MedicationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '藥物管理 - 選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '藥物記錄' }} />
    </Stack>
  );
}
