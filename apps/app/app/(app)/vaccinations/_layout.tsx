import { Stack } from 'expo-router';

export default function VaccinationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: '疫苗記錄' }} />
    </Stack>
  );
}
