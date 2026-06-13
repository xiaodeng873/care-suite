import { Stack } from 'expo-router';

export default function CarePlansLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '照護計劃' }} />
    </Stack>
  );
}
