import { Stack } from 'expo-router';

export default function VmoVisitsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '醫生到診排程' }} />
    </Stack>
  );
}
