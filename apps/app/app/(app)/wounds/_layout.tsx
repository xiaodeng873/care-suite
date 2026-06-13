import { Stack } from 'expo-router';

export default function WoundsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '傷口管理' }} />
    </Stack>
  );
}
