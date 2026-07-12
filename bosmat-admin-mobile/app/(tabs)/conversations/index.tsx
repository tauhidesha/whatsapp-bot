import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import { format } from 'date-fns';

export default function ConversationsListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.getConversations(100);
      if (res.success) {
        setConversations(res.data);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  useEffect(() => { 
    // Subscribe to realtime updates for conversations
    const channel = supabase
      .channel('conversations_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Customer' }, (payload) => {
        // Optimistically update list without full refresh
        if (payload.eventType === 'UPDATE') {
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === payload.new.id);
            if (idx === -1) return [payload.new, ...prev];
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...payload.new };
            return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const filtered = useMemo(() => {
    let result = conversations;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, search]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'HH:mm');
    }
    return format(date, 'dd/MM/yy');
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.convoCard}
        onPress={() => router.push({
          pathname: '/(tabs)/conversations/[id]',
          params: { id: item.id, phone: item.phone, name: item.name, aiPaused: item.aiPaused ? '1' : '0' }
        })}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.convoContent}>
          <View style={styles.convoHeader}>
            <Text style={styles.convoName}>{item.name || item.phone}</Text>
            <Text style={styles.convoTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.convoFooter}>
            <Text style={styles.convoMsg} numberOfLines={1}>
              {item.lastMessage || 'Tidak ada pesan'}
            </Text>
            {item.aiPaused && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI OFF</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
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
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama atau nomor..."
          placeholderTextColor={Colors.textDimmed}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        // Optimizations for huge lists
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  
  searchWrap: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSize.md, borderRadius: 2,
  },

  separator: { height: 1, backgroundColor: Colors.borderLight },
  
  convoCard: {
    flexDirection: 'row', padding: Spacing.lg,
    backgroundColor: Colors.bg, alignItems: 'center',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textMuted },
  convoContent: { flex: 1, justifyContent: 'center' },
  convoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convoName: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textPrimary },
  convoTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  convoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoMsg: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  
  aiBadge: {
    backgroundColor: Colors.errorBg,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2,
  },
  aiBadgeText: { fontSize: 8, fontWeight: '900', color: Colors.error, letterSpacing: 1 },
});
