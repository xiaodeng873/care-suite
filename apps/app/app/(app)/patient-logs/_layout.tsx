import { Stack } from 'expo-router';

export default function PatientLogsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '院友日誌' }} />
    </Stack>
  );
}
