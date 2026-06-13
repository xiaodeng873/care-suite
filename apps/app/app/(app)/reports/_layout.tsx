import { Stack } from 'expo-router';
export default function ReportsLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '報表查詢' }} /></Stack>;
}
