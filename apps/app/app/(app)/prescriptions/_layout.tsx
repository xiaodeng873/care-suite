import { Stack } from 'expo-router';

export default function PrescriptionsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '處方管理' }} />
    </Stack>
  );
}
