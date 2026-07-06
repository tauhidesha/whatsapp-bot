import { Stack } from 'expo-router';
import { Colors, FontSize } from '@/lib/theme';

export default function ConversationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontSize: FontSize.sm, fontWeight: '900', letterSpacing: 3 },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'INBOX CONTROL' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
