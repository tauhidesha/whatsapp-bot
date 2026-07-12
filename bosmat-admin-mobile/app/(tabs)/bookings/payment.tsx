import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';

const PAYMENT_METHODS = ['Transfer BCA', 'Cash', 'QRIS', 'Mandiri'];

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const booking = params.data ? JSON.parse(params.data as string) : null;

  const subtotal = Number(booking?.totalAmount || booking?.subtotal || 0);
  const dp = Number(booking?.downPayment || 0);
  const remaining = Math.max(0, subtotal - dp);

  // Detect if services include repaint or coating (for HP 4: Auto Warranty)
  const servicesStr = (
    Array.isArray(booking?.services)
      ? booking.services.join(' ')
      : booking?.services || ''
  ).toLowerCase();
  const hasRepaint = servicesStr.includes('repaint') || servicesStr.includes('spot repair');
  const hasCoating =
    servicesStr.includes('coating') ||
    servicesStr.includes('glossy') ||
    servicesStr.includes('nano ceramic');

  const [amountPaid, setAmountPaid] = useState(remaining.toString());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [sendInvoice, setSendInvoice] = useState(true);
  // HP 4: Auto Warranty toggles (default ON if service detected)
  const [sendRepaintWarranty, setSendRepaintWarranty] = useState(hasRepaint);
  const [sendCoatingWarranty, setSendCoatingWarranty] = useState(hasCoating);
  const [loading, setLoading] = useState(false);

  const handlePayment = async (targetStatus: 'COMPLETED' | 'PAID') => {
    if (!amountPaid) {
      Alert.alert('Error', 'Nominal bayar wajib diisi');
      return;
    }

    setLoading(true);
    try {
      // 1. Mark as target status in Database
      await api.payBooking(id, {
        paymentMethod,
        amountPaid: parseInt(amountPaid),
        sendInvoice: false, // Handle invoice separately below
        status: targetStatus,
      });

      // 2. Send Invoice (Bukti Bayar)
      if (sendInvoice) {
        await api.generateInvoice(id, 'invoice').catch(e =>
          console.log('Invoice send error (non-fatal):', e)
        );
      }

      // HP 4: Auto Garansi Repaint
      if (sendRepaintWarranty && hasRepaint) {
        await api.generateInvoice(id, 'garansi_repaint').catch(e =>
          console.error('Failed to generate repaint warranty:', e)
        );
      }

      // HP 4: Auto Garansi Coating
      if (sendCoatingWarranty && hasCoating) {
        await api.generateInvoice(id, 'garansi_coating').catch(e =>
          console.log('Coating warranty error (non-fatal):', e)
        );
      }

      const msgs = ['Pembayaran berhasil disimpan'];
      if (sendInvoice) msgs.push('Invoice WA terkirim');
      if (sendRepaintWarranty && hasRepaint) msgs.push('Garansi Repaint terkirim');
      if (sendCoatingWarranty && hasCoating) msgs.push('Garansi Coating terkirim');

      Alert.alert('Sukses ✅', msgs.join('\n'), [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PELUNASAN BOOKING</Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Tagihan</Text>
          <Text style={styles.summaryValue}>Rp {subtotal.toLocaleString('id-ID')}</Text>
        </View>
        {dp > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sudah Dibayar (DP)</Text>
            <Text style={[styles.summaryValue, { color: Colors.accent }]}>
              - Rp {dp.toLocaleString('id-ID')}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.summaryDivider]}>
          <Text style={styles.summaryLabelTotal}>Sisa Pembayaran</Text>
          <Text style={styles.summaryValueTotal}>Rp {remaining.toLocaleString('id-ID')}</Text>
        </View>
      </View>

      <Text style={styles.label}>Nominal Dibayar (Rp)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amountPaid}
        onChangeText={setAmountPaid}
        placeholder="0"
        placeholderTextColor={Colors.textDimmed}
      />

      <Text style={styles.label}>Metode Pembayaran</Text>
      <View style={styles.methodContainer}>
        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method}
            style={[styles.methodChip, paymentMethod === method && styles.methodChipActive]}
            onPress={() => setPaymentMethod(method)}
          >
            <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
              {method}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Documents Section */}
      <Text style={styles.sectionTitle}>DOKUMEN YANG DIKIRIM</Text>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Invoice / Bukti Bayar</Text>
          <Text style={styles.switchDesc}>Kirim bukti bayar via WhatsApp</Text>
        </View>
        <Switch
          value={sendInvoice}
          onValueChange={setSendInvoice}
          trackColor={{ false: Colors.border, true: Colors.accent }}
        />
      </View>

      {/* HP 4: Auto Garansi Repaint */}
      {hasRepaint && (
        <View style={[styles.switchRow, { borderColor: '#4a4a00' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: Colors.accent }]}>🎨 Garansi Repaint</Text>
            <Text style={styles.switchDesc}>Kartu garansi repaint via WhatsApp</Text>
          </View>
          <Switch
            value={sendRepaintWarranty}
            onValueChange={setSendRepaintWarranty}
            trackColor={{ false: Colors.border, true: Colors.accent }}
          />
        </View>
      )}

      {/* HP 4: Auto Garansi Coating */}
      {hasCoating && (
        <View style={[styles.switchRow, { borderColor: '#004a3a' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: '#4ae8b0' }]}>✨ Garansi Coating</Text>
            <Text style={styles.switchDesc}>Kartu garansi coating via WhatsApp</Text>
          </View>
          <Switch
            value={sendCoatingWarranty}
            onValueChange={setSendCoatingWarranty}
            trackColor={{ false: Colors.border, true: '#4ae8b0' }}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, loading && { opacity: 0.7 }]}
        onPress={() => handlePayment('COMPLETED')}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={styles.saveBtnText}>SELESAI & INVOICE</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.statusPaid, marginTop: Spacing.md }, loading && { opacity: 0.7 }]}
        onPress={() => handlePayment('PAID')}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={Colors.statusPaid} />
          : <Text style={[styles.saveBtnText, { color: Colors.statusPaid }]}>BAYAR & INVOICE SAJA</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 80 },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 2 },

  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted,
    marginTop: Spacing.xl, marginBottom: Spacing.sm, letterSpacing: 3,
  },

  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  summaryDivider: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.md },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSize.md },
  summaryValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  summaryLabelTotal: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '900' },
  summaryValueTotal: { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '900' },

  label: {
    fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted,
    marginBottom: 8, letterSpacing: 1, marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: 4, color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700',
  },

  methodContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  methodChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 4,
    backgroundColor: Colors.bgCard,
  },
  methodChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  methodText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '800' },
  methodTextActive: { color: Colors.bgCard },

  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  switchTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  switchDesc: { fontSize: FontSize.xs, color: Colors.textMuted },

  saveBtn: {
    backgroundColor: Colors.statusPaid, paddingVertical: Spacing.lg,
    borderRadius: 4, alignItems: 'center', marginTop: Spacing.xl,
  },
  saveBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '900', letterSpacing: 2 },
});
