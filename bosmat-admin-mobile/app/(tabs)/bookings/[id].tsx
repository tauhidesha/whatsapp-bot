import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function BookingDetailScreen() {
  const { id, data } = useLocalSearchParams();
  const router = useRouter();
  
  const [booking, setBooking] = useState<any>(data ? JSON.parse(decodeURIComponent(data as string)) : null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchBookingDetail = async () => {
    // If we need fresh data, we can call getBookings and filter, or an endpoint for specific booking.
    // For now we'll rely on the initial data passed, or list refresh.
  };

  const statuses = [
    { value: 'waiting', label: 'WAITING' },
    { value: 'in_progress', label: 'ON GOING' },
    { value: 'done', label: 'SELESAI' },
    { value: 'paid', label: 'LUNAS' },
    { value: 'cancelled', label: 'BATAL' },
  ];

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await api.updateBookingStatus(id as string, newStatus);
      if (res.success) {
        setBooking(res.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Booking',
      'Yakin ingin menghapus booking ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              await api.deleteBooking(id as string);
              Alert.alert('Sukses', 'Booking dihapus');
              router.back();
            } catch (err: any) {
              Alert.alert('Gagal', err.message || 'Gagal menghapus');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: '/(tabs)/bookings/form',
      params: { id, data: encodeURIComponent(JSON.stringify(booking)) }
    });
  };

  const dateStr = booking?.bookingDate
    ? format(new Date(booking.bookingDate), 'EEEE, dd MMM yyyy', { locale: idLocale })
    : '-';

  if (!booking) return null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity onPress={handleEdit} disabled={updating}>
                <Text style={{ color: Colors.accent, fontWeight: '800' }}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} disabled={updating}>
                <Text style={{ color: Colors.statusCancelled, fontWeight: '800' }}>HAPUS</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.customerName}>{booking.customerName}</Text>
            <Text style={styles.phone}>{booking.customerPhone}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>JADWAL</Text>
            <Text style={styles.value}>{dateStr}</Text>
            <Text style={styles.value}>{booking.bookingTime || '09:00'} WIB</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KENDARAAN & SERVIS</Text>
            <Text style={styles.value}>{booking.vehicleInfo || '-'}</Text>
            <Text style={styles.value}>
              {Array.isArray(booking.services) ? booking.services.join('\n') : booking.services || '-'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PEMBAYARAN</Text>
            <Text style={styles.value}>Total: Rp {Number(booking.totalAmount || 0).toLocaleString('id-ID')}</Text>
            <Text style={styles.value}>DP: Rp {Number(booking.downPayment || 0).toLocaleString('id-ID')}</Text>
            <Text style={styles.value}>Dibayar: Rp {Number(booking.amountPaid || 0).toLocaleString('id-ID')}</Text>
            <Text style={[styles.value, { color: booking.paymentStatus === 'PAID' ? Colors.statusPaid : Colors.statusCancelled, fontWeight: 'bold' }]}>
              Status: {booking.paymentStatus || 'UNPAID'}
            </Text>
          </View>

          {booking.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CATATAN</Text>
              <Text style={styles.value}>{booking.notes}</Text>
            </View>
          )}
        </View>

        <Text style={styles.updateTitle}>UPDATE STATUS</Text>
        <View style={styles.statusGrid}>
          {statuses.map((s) => {
            const isActive = booking.status === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[
                  styles.statusBtn,
                  isActive && styles.statusBtnActive,
                  updating && styles.disabled
                ]}
                disabled={updating || isActive}
                onPress={() => handleUpdateStatus(s.value)}
              >
                <Text style={[
                  styles.statusBtnText,
                  isActive && styles.statusBtnTextActive
                ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          style={[styles.payBtn, updating && styles.disabled]}
          onPress={() => router.push({
            pathname: '/(tabs)/bookings/payment',
            params: { id, data: JSON.stringify(booking) }
          })}
          disabled={updating}
        >
          <Text style={styles.payBtnText}>BAYAR & INVOICE</Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.lg },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 4, padding: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  header: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.lg, marginBottom: Spacing.lg },
  customerName: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.accent, letterSpacing: 1 },
  phone: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: 4 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDimmed, letterSpacing: 3, marginBottom: Spacing.sm },
  value: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 24 },
  
  updateTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textMuted, letterSpacing: 3, marginBottom: Spacing.lg, marginLeft: 4 },
  statusGrid: { gap: Spacing.sm, paddingBottom: Spacing.xl },
  statusBtn: {
    paddingVertical: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 2, alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  statusBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  statusBtnText: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textMuted, letterSpacing: 2 },
  statusBtnTextActive: { color: Colors.accentDark },
  disabled: { opacity: 0.5 },

  payBtn: {
    backgroundColor: Colors.statusPaid,
    paddingVertical: Spacing.lg,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  payBtnText: {
    color: Colors.bgCard,
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 2
  }
});
