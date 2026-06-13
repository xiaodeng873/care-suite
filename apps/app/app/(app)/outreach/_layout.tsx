import { Stack } from 'expo-router';

export default function OutreachLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '醫院外展' }} />
    </Stack>
  );
}
