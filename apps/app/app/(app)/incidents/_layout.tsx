import { Stack } from 'expo-router';

export default function IncidentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '事故報告' }} />
    </Stack>
  );
}
