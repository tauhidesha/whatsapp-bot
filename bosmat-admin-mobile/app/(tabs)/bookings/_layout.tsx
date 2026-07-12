import { Stack } from 'expo-router';
import { Colors, FontSize } from '@/lib/theme';

export default function BookingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontSize: FontSize.sm, fontWeight: '900' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'MANAJEMEN BOOKING', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'DETAIL BOOKING' }} />
    </Stack>
  );
}
