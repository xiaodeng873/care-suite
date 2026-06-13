import { Stack } from 'expo-router';

export default function CareRecordsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '護理記錄 - 選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '護理記錄' }} />
    </Stack>
  );
}
