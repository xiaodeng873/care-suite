import { Stack } from 'expo-router';

export default function FollowUpsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '覆診跟進' }} />
    </Stack>
  );
}
