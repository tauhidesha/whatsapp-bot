import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import { format } from 'date-fns';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { id, phone, name } = params;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const initialAiPaused = params.aiPaused === '1';
  const [isAiPaused, setIsAiPaused] = useState(initialAiPaused);

  useEffect(() => {
    setIsAiPaused(initialAiPaused);
  }, [initialAiPaused]);

  const [togglingAi, setTogglingAi] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.getConversationHistory(phone as string);
      if (res.success) {
        // Reverse because FlatList inverted=true requires newest at index 0
        setMessages(res.data.reverse());
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel(`chat_${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'DirectMessage',
        filter: `customerId=eq.${id}`
      }, (payload) => {
        // Add new message to the top of the inverted list
        setMessages(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phone, fetchHistory]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    try {
      await api.sendMessage({
        number: phone as string,
        message: msg,
        channel: 'whatsapp'
      });
      // The new message will come in via Supabase realtime
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal mengirim pesan');
      setInput(msg); // restore input
    } finally {
      setSending(false);
    }
  };

  const handleToggleAi = async () => {
    console.log(`[AI Toggle] Tombol ditekan. Status awal isAiPaused: ${isAiPaused}, untuk phone: ${phone}`);
    setTogglingAi(true);
    try {
      const newState = !isAiPaused;
      console.log(`[AI Toggle] Mengirim request ke API untuk mengubah status AI ke: ${newState ? 'OFF (Snooze)' : 'ON (Active)'}`);
      const res = await api.toggleAiState(phone as string, !newState, newState ? 'Manual override by admin via Mobile App' : undefined);
      console.log(`[AI Toggle] Response API sukses:`, res);
      setIsAiPaused(newState);
      console.log(`[AI Toggle] Status UI berhasil diupdate menjadi: isAiPaused = ${newState}`);
    } catch (err: any) {
      console.error(`[AI Toggle] ERROR saat menghubungi API:`, err);
      Alert.alert('Error', err.message || 'Gagal mengubah status AI');
    } finally {
      setTogglingAi(false);
    }
  };

  const isBase64 = (str: string) => {
    if (!str) return false;
    if (str.startsWith('data:image')) return true;
    return str.length > 200 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.replace(/\s/g, ''));
  };

  const renderMessage = ({ item }: { item: any }) => {
    const text = item.text || item.content || '';
    const dateValue = item.timestamp || item.createdAt || item.created_at;
    const sender = item.sender || item.role;
    const isBot = sender === 'ai' || sender === 'admin' || sender === 'assistant' || sender === 'system' || sender === 'bot';
    
    let timeString = '';
    if (dateValue) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        timeString = format(date, 'HH:mm');
      }
    }

    let isImage = false;
    let imageUrl = '';
    const mediaUrl = item.mediaUrl || item.media_url;
    let caption = text;
    
    if (mediaUrl) {
      isImage = true;
      imageUrl = mediaUrl;
      // caption remains text
    } else if (text && isBase64(text)) {
      isImage = true;
      const cleanBase64 = text.replace(/\s/g, '');
      imageUrl = cleanBase64.startsWith('data:') ? cleanBase64 : `data:image/jpeg;base64,${cleanBase64}`;
      caption = ''; // The text itself is the image
    }
    
    return (
      <View style={[styles.msgContainer, isBot ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.msgBubble, isBot ? styles.msgBubbleRight : styles.msgBubbleLeft]}>
          {isImage && (
            <Image 
              source={{ uri: imageUrl }} 
              style={{ width: 200, height: 200, borderRadius: 8, marginBottom: caption ? 8 : 4 }} 
              resizeMode="cover" 
            />
          )}
          {!!caption && (
            <Text style={[styles.msgText, isBot && styles.msgTextRight]}>{caption}</Text>
          )}
          <Text style={[styles.msgTime, isBot && styles.msgTimeRight]}>
            {timeString}
            {isBot && (timeString ? ' • AI' : 'AI')}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{'< KEMBALI'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{name || phone}</Text>
          <Text style={styles.headerPhone}>{phone}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.aiToggleBtn, isAiPaused ? styles.aiOffBtn : styles.aiOnBtn]}
          onPress={handleToggleAi}
          disabled={togglingAi}
        >
          {togglingAi ? (
            <ActivityIndicator size="small" color={isAiPaused ? Colors.textPrimary : Colors.bg} />
          ) : (
            <Text style={[styles.aiToggleText, !isAiPaused && { color: Colors.bg }]}>
              {isAiPaused ? 'AI OFF' : 'AI ON'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        inverted // Newest messages at bottom automatically
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ketik pesan..."
          placeholderTextColor={Colors.textDimmed}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.accentDark} />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, paddingTop: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard 
  },
  backBtn: { marginRight: Spacing.md, paddingVertical: Spacing.sm },
  backBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '900', letterSpacing: 1 },
  headerInfo: { flex: 1, marginRight: Spacing.md },
  headerName: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textPrimary },
  headerPhone: { fontSize: FontSize.xs, color: Colors.textMuted },
  
  aiToggleBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 2, borderWidth: 1 },
  aiOnBtn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  aiOffBtn: { backgroundColor: Colors.bgInput, borderColor: Colors.error },
  aiToggleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: Colors.error },

  listContent: { padding: Spacing.md, gap: Spacing.md },
  
  msgContainer: { flexDirection: 'row', marginBottom: Spacing.sm, width: '100%' },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: 8 },
  msgBubbleLeft: { backgroundColor: Colors.bgElevated, borderBottomLeftRadius: 2 },
  msgBubbleRight: { backgroundColor: Colors.accentMuted, borderWidth: 1, borderColor: Colors.accentBorder, borderBottomRightRadius: 2 },
  msgText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  msgTextRight: { color: Colors.accent },
  msgTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-start' },
  msgTimeRight: { color: Colors.accent, opacity: 0.6, alignSelf: 'flex-end' },

  inputContainer: { 
    flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end'
  },
  input: {
    flex: 1, backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: 20, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 12,
    fontSize: FontSize.md, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: Colors.border
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm, marginBottom: 2
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { fontSize: 18, color: Colors.accentDark },
});
