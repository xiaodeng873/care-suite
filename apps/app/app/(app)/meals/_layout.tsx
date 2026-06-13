import { Stack } from 'expo-router';
export default function MealsLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" options={{ title: '餐膳指引' }} /></Stack>;
}
