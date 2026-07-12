import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, TextInput, ScrollView
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import { format, addDays, startOfToday, isSameDay, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  waiting:     { label: 'WAITING',    color: Colors.textMuted,          bg: 'rgba(255,255,255,0.05)' },
  pending:     { label: 'PENDING',    color: Colors.textMuted,          bg: 'rgba(255,255,255,0.05)' },
  in_progress: { label: 'ON GOING',   color: Colors.statusInProgress,  bg: Colors.statusInProgressBg },
  done:        { label: 'SELESAI',    color: Colors.textSecondary,      bg: 'rgba(255,255,255,0.1)' },
  COMPLETED:   { label: 'SELESAI',    color: Colors.textSecondary,      bg: 'rgba(255,255,255,0.1)' },
  completed:   { label: 'SELESAI',    color: Colors.textSecondary,      bg: 'rgba(255,255,255,0.1)' },
  paid:        { label: 'LUNAS',      color: Colors.statusPaid,         bg: Colors.statusPaidBg },
  PAID:        { label: 'LUNAS',      color: Colors.statusPaid,         bg: Colors.statusPaidBg },
  cancelled:   { label: 'BATAL',      color: Colors.statusCancelled,    bg: Colors.statusCancelledBg },
};

export default function BookingsListScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  
  // Date and Status filters
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [filter, setFilter] = useState<string>('all');

  // Generate next 14 days and previous 7 days for calendar strip
  const dates = useMemo(() => {
    const today = startOfToday();
    const result = [];
    for (let i = -7; i <= 14; i++) {
      result.push(addDays(today, i));
    }
    return result;
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.getBookings();
      if (res.success) {
        setBookings(res.data);
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, [fetchBookings]);

  const filtered = useMemo(() => {
    let result = bookings;

    // Filter by selected date
    result = result.filter(b => {
      if (!b.bookingDate) return false;
      return isSameDay(new Date(b.bookingDate), selectedDate);
    });

    if (filter !== 'all') {
      result = result.filter(b => {
        const status = (b.status || '').toLowerCase();
        if (filter === 'done') return status === 'done' || status === 'completed';
        if (filter === 'paid') return status === 'paid';
        return status === filter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.vehicleInfo || '').toLowerCase().includes(q) ||
        (b.services || '').toString().toLowerCase().includes(q)
      );
    }
    return result.sort((a: any, b: any) =>
      new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
    );
  }, [bookings, filter, search, selectedDate]);

  const filters = ['all', 'waiting', 'in_progress', 'done', 'paid', 'cancelled'];

  const renderBooking = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.waiting;
    const dateStr = item.bookingDate
      ? format(new Date(item.bookingDate), 'dd MMM yyyy', { locale: idLocale })
      : '-';

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => router.push({
          pathname: '/(tabs)/bookings/[id]',
          params: { id: item.id, data: encodeURIComponent(JSON.stringify(item)) }
        })}
        activeOpacity={0.7}
      >
        <View style={styles.bookingHeader}>
          <View>
            <Text style={styles.bookingTime}>{item.bookingTime || '09:00'} WIB</Text>
            <Text style={styles.bookingName}>{item.customerName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <Text style={styles.detailText}>🏍️ {item.vehicleInfo || 'Unknown'}</Text>
          <Text style={styles.detailText} numberOfLines={1}>
            🔧 {Array.isArray(item.services) ? item.services.join(' / ') : item.services || '-'}
          </Text>
        </View>

        <View style={styles.bookingFooter}>
          <Text style={styles.dateText}>📅 {dateStr}</Text>
          {item.totalAmount && (
            <Text style={styles.amountText}>
              Rp {Number(item.totalAmount).toLocaleString('id-ID')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Calendar Strip */}
      <View style={styles.calendarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
          {dates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, startOfToday());
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.dateBox, isSelected && styles.dateBoxSelected]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.dateDayName, isSelected && styles.dateDayNameSelected, isToday && !isSelected && styles.dateTextToday]}>
                  {format(date, 'EEE', { locale: idLocale }).toUpperCase()}
                </Text>
                <Text style={[styles.dateDayNumber, isSelected && styles.dateDayNumberSelected, isToday && !isSelected && styles.dateTextToday]}>
                  {format(date, 'd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari customer atau kendaraan..."
          placeholderTextColor={Colors.textDimmed}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View>
        <FlatList
          horizontal
          data={filters}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'SEMUA' : (STATUS_CONFIG[f]?.label || f.toUpperCase())}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
        />
      </View>

      {/* Bookings List */}
      <FlatList
        data={filtered}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: Spacing.md }}>📅</Text>
            <Text style={styles.emptyTitle}>TIDAK ADA BOOKING HARI INI</Text>
          </View>
        }
      />

      {/* FAB - Create Booking */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/(tabs)/bookings/form')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  calendarWrap: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  calendarScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  dateBox: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateBoxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dateDayName: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '800',
    marginBottom: 4,
  },
  dateDayNumber: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    fontWeight: '900',
  },
  dateDayNameSelected: {
    color: Colors.bgCard,
  },
  dateDayNumberSelected: {
    color: Colors.bg,
  },
  dateTextToday: {
    color: Colors.accent,
  },

  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  searchInput: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSize.md, borderRadius: 2,
  },

  filterRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 2,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
  filterTextActive: { color: Colors.accentDark },

  bookingCard: {
    backgroundColor: Colors.bgCard, borderLeftWidth: 2, borderLeftColor: Colors.borderLight,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  bookingTime: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2 },
  bookingName: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 2 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 2 },

  bookingDetails: { gap: 4, marginBottom: Spacing.md },
  detailText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  dateText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  amountText: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.accent },

  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textMuted, letterSpacing: 3 },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.bg,
    marginTop: -2,
  }
});
