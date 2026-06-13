import { Stack } from 'expo-router';
export default function TasksLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '任務管理' }} /></Stack>;
}
