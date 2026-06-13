import { Stack } from 'expo-router';

export default function HygieneLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '選擇院友' }} />
      <Stack.Screen name="[id]" options={{ title: '個人衛生護理' }} />
    </Stack>
  );
}
