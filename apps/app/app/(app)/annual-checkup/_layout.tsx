import { Stack } from 'expo-router';

export default function AnnualCheckupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '年度體檢' }} />
    </Stack>
  );
}
