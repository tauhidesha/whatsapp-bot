import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function FinanceScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFinance = useCallback(async () => {
    try {
      const res = await api.getFinanceData('all');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Fetch finance error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFinance(); }, [fetchFinance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFinance();
    setRefreshing(false);
  }, [fetchFinance]);

  const formatCurrency = (val: number) => {
    return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  };

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  const summary = data?.summary || { totalIncome: 0, totalExpense: 0, netProfit: 0, pendingIncome: 0 };
  const transactions = data?.transactions || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
      {/* Overview Cards */}
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PEMASUKAN</Text>
          <Text style={[styles.cardValue, { color: Colors.success }]}>{formatCurrency(summary.totalIncome)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PENGELUARAN</Text>
          <Text style={[styles.cardValue, { color: Colors.error }]}>{formatCurrency(summary.totalExpense)}</Text>
        </View>
        <View style={styles.cardFull}>
          <Text style={styles.cardLabel}>PROFIT BERSIH</Text>
          <Text style={[styles.cardValue, { fontSize: 32, color: summary.netProfit >= 0 ? Colors.accent : Colors.error }]}>
            {formatCurrency(summary.netProfit)}
          </Text>
        </View>
      </View>

      {/* Transaction List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>TRANSAKSI TERAKHIR</Text>
        
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada transaksi</Text>
        ) : (
          transactions.map((t: any) => (
            <View key={t.id} style={styles.transactionItem}>
              <View style={styles.txIcon}>
                <Text>{t.type === 'income' ? '📈' : '📉'}</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
                <Text style={styles.txCategory}>{t.category} • {format(new Date(t.date), 'dd MMM', { locale: idLocale })}</Text>
              </View>
              <Text style={[
                styles.txAmount, 
                { color: t.type === 'income' ? Colors.success : Colors.error }
              ]}>
                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  
  grid: { padding: Spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: { 
    flex: 1, minWidth: '45%', backgroundColor: Colors.bgCard, 
    padding: Spacing.lg, borderRadius: 4, borderWidth: 1, borderColor: Colors.border 
  },
  cardFull: { 
    width: '100%', backgroundColor: Colors.bgElevated, 
    padding: Spacing.xl, borderRadius: 4, borderWidth: 1, borderColor: Colors.accentBorder 
  },
  cardLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2, marginBottom: Spacing.sm },
  cardValue: { fontSize: FontSize.xl, fontWeight: '900', letterSpacing: 1 },

  listSection: { padding: Spacing.lg },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2, marginBottom: Spacing.lg },
  emptyText: { color: Colors.textMuted, textAlign: 'center', marginVertical: Spacing.xxl },
  
  transactionItem: { 
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight 
  },
  txIcon: { 
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md 
  },
  txDetails: { flex: 1, paddingRight: Spacing.sm },
  txDesc: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  txCategory: { fontSize: FontSize.xs, color: Colors.textMuted },
  txAmount: { fontSize: FontSize.md, fontWeight: '900' }
});
