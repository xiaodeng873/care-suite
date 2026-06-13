import { Stack } from 'expo-router';

export default function RestraintsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '約束物品' }} />
    </Stack>
  );
}
