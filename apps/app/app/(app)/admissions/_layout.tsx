import { Stack } from 'expo-router';
export default function AdmissionsLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '缺席管理' }} /></Stack>;
}
