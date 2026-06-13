import { Stack } from 'expo-router';

export default function IntakeOutputLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '出入量記錄 - 選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '出入量記錄' }} />
    </Stack>
  );
}
