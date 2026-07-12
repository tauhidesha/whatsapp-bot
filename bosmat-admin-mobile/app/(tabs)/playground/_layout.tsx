import { Stack } from 'expo-router';
import { Colors, FontSize } from '@/lib/theme';

export default function PlaygroundLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontSize: FontSize.sm, fontWeight: '900' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'AI PLAYGROUND', headerShown: false }} />
    </Stack>
  );
}
