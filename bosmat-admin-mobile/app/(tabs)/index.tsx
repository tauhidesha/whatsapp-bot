import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Colors, Spacing, FontSize } from '@/lib/theme';

interface DashboardStats {
  activeToday: number;
  total: number;
  aiHandover: number;
  handoverList: any[];
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ activeToday: 0, total: 0, aiHandover: 0, handoverList: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getConversations(50);
      if (res.success) {
        const convos = res.data;
        const now = Date.now();
        let activeToday = 0;
        let aiHandover = 0;
        const handoverList: any[] = [];

        convos.forEach((c: any) => {
          const lastMsgTime = new Date(c.lastMessageAt).getTime();
          if (now - lastMsgTime < 24 * 60 * 60 * 1000) activeToday++;
          if (c.aiPaused) {
            aiHandover++;
            handoverList.push(c);
          }
        });

        setStats({
          activeToday,
          total: convos.length,
          aiHandover,
          handoverList: handoverList.slice(0, 5),
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins}m lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}j lalu`;
    return `${Math.floor(hrs / 24)}h lalu`;
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Stats Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AKTIF 24 JAM</Text>
          <Text style={styles.statValue}>{stats.activeToday}</Text>
          <Text style={styles.statSub}>Total: {stats.total}</Text>
        </View>
        <View style={[styles.statCard, stats.aiHandover > 0 && styles.statCardDanger]}>
          <Text style={styles.statLabel}>HANDOVER</Text>
          <Text style={styles.statValue}>{stats.aiHandover}</Text>
          {stats.aiHandover > 0 && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>ZOYA AI</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>STABLE</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SISTEM</Text>
          <Text style={[styles.statValue, { fontSize: FontSize.xl }]}>ONLINE</Text>
        </View>
      </View>

      {/* Handover List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚠️ BUTUH HANDOVER</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/conversations')}>
            <Text style={styles.seeAll}>LIHAT SEMUA</Text>
          </TouchableOpacity>
        </View>

        {stats.handoverList.length > 0 ? (
          stats.handoverList.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={styles.handoverItem}
              onPress={() => router.push({ pathname: '/(tabs)/conversations/[id]', params: { id: c.id, phone: c.phone, name: c.name } })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(c.name || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.handoverName}>{c.name || c.phone}</Text>
                <Text style={styles.handoverMsg} numberOfLines={1}>{c.lastMessage || 'No message'}</Text>
              </View>
              <Text style={styles.handoverTime}>{formatTime(c.lastMessageAt)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>SEMUA AMAN</Text>
            <Text style={styles.emptyDesc}>Tidak ada antrian handover</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: Spacing.lg }]}>⚡ PINTASAN CEPAT</Text>
        {[
          { label: 'Buka Kotak Masuk', emoji: '💬', route: '/(tabs)/conversations' as const },
          { label: 'Atur Jadwal Bengkel', emoji: '📅', route: '/(tabs)/bookings' as const },
          { label: 'Lihat Keuangan', emoji: '💰', route: '/(tabs)/finance' as const },
        ].map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickAction}
            onPress={() => router.push(action.route)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>{action.emoji}</Text>
            <Text style={styles.quickActionText}>{action.label}</Text>
            <Text style={styles.quickActionArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>KELUAR</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 2,
  },
  statCardDanger: { borderColor: Colors.errorBg },
  statLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2, marginBottom: Spacing.sm },
  statValue: { fontSize: FontSize.xxxl, fontWeight: '900', color: Colors.textPrimary },
  statSub: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginTop: Spacing.xs },
  urgentBadge: { backgroundColor: Colors.errorBg, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 2, alignSelf: 'flex-start', marginTop: Spacing.sm },
  urgentText: { fontSize: 8, fontWeight: '900', color: Colors.error, letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  statusText: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 3 },

  section: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 2, marginTop: Spacing.lg, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2 },
  seeAll: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.accent, letterSpacing: 2 },

  handoverItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 4, backgroundColor: Colors.bgInput, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textMuted },
  handoverName: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  handoverMsg: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  handoverTime: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },

  emptyState: { padding: Spacing.xxxl, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textMuted, letterSpacing: 3 },
  emptyDesc: { fontSize: FontSize.xs, color: Colors.textDimmed, letterSpacing: 1, marginTop: Spacing.xs },

  quickAction: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md,
  },
  quickActionText: { flex: 1, fontSize: FontSize.sm, fontWeight: '800', color: Colors.accent, letterSpacing: 1.5 },
  quickActionArrow: { fontSize: FontSize.lg, color: Colors.textMuted },

  logoutBtn: { alignItems: 'center', padding: Spacing.lg, marginTop: Spacing.xxxl, marginBottom: 40 },
  logoutText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDimmed, letterSpacing: 3 },
});
