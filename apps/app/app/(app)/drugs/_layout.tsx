import { Stack } from 'expo-router';
export default function DrugsLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '藥物資料庫' }} /></Stack>;
}
