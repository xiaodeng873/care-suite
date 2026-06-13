import { Stack } from 'expo-router';
export default function BedsLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '床位管理' }} /></Stack>;
}
