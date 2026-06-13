import { Stack } from 'expo-router';

export default function ResidentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '院友名單' }} />
      <Stack.Screen name="[id]" options={{ title: '院友詳情' }} />
    </Stack>
  );
}
