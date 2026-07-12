import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '@/lib/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '📊',
    bookings: '📅',
    conversations: '💬',
    finance: '💰',
    playground: '🤖',
  };

  return (
    <View style={[styles.iconWrap, focused && styles.iconFocused]}>
      <Text style={styles.iconEmoji}>{icons[name] || '📱'}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: Colors.bg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        },
        headerTitleStyle: {
          fontSize: FontSize.sm,
          fontWeight: '900',
          letterSpacing: 3,
          color: Colors.textPrimary,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'BOSMAT ADMIN',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Booking',
          headerTitle: 'MANAJEMEN BOOKING',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="bookings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Inbox',
          headerTitle: 'INBOX CONTROL',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="conversations" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          headerTitle: 'FINANCE',
          tabBarIcon: ({ focused }) => <TabIcon name="finance" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="playground"
        options={{
          title: 'AI',
          headerTitle: 'AI PLAYGROUND',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="playground" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  iconFocused: {
    backgroundColor: Colors.accentMuted,
  },
  iconEmoji: {
    fontSize: 18,
  },
});
