import { Stack } from 'expo-router';

export default function RehabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '復康服務' }} />
    </Stack>
  );
}
