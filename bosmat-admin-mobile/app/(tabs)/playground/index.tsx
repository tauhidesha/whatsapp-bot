import { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';

export default function PlaygroundScreen() {
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      { role: 'assistant', content: 'Halo! Saya Zoya, asisten AI BosMat Studio. Mari uji kemampuan saya di sini.' }
    ]);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await api.testAI({
        message: userMsg,
        history: newHistory.slice(0, -1) // Send previous context
      });
      
      setMessages([...newHistory, { role: 'assistant', content: res.response || 'Zoya tidak merespon.' }]);
    } catch (err: any) {
      setMessages([...newHistory, { role: 'assistant', content: `[ERROR]: ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleClearMemory = async () => {
    Alert.alert('Hapus Memori', 'Yakin ingin mereset memori percakapan AI?', [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Reset', 
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.clearTestAI();
            setMessages([
              { role: 'assistant', content: 'Halo! Memori telah direset. Mari mulai percakapan baru.' }
            ]);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isBot = item.role === 'assistant';
    
    return (
      <View style={[styles.msgContainer, isBot ? styles.msgLeft : styles.msgRight]}>
        <View style={[styles.msgBubble, isBot ? styles.msgBubbleLeft : styles.msgBubbleRight]}>
          <Text style={[styles.msgText, isBot && styles.msgTextLeft]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>🧪</Text>
        <Text style={styles.bannerText}>
          Mode uji coba terisolasi. Pesan tidak akan dikirim ke customer nyata.
        </Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearMemory}>
          <Text style={styles.clearBtnText}>CLEAR</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Tanya Zoya..."
          placeholderTextColor={Colors.textDimmed}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.accentDark} />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  
  banner: { 
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.accentMuted, borderBottomWidth: 1, borderBottomColor: Colors.accentBorder
  },
  bannerIcon: { fontSize: 20, marginRight: Spacing.sm },
  bannerText: { flex: 1, fontSize: 11, color: Colors.accent, fontWeight: '800' },
  clearBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearBtnText: { color: Colors.bg, fontSize: 10, fontWeight: 'bold' },

  listContent: { padding: Spacing.md, gap: Spacing.md },
  
  msgContainer: { flexDirection: 'row', marginBottom: Spacing.sm, width: '100%' },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '85%', padding: Spacing.md, borderRadius: 8 },
  msgBubbleLeft: { backgroundColor: Colors.bgElevated, borderBottomLeftRadius: 2, borderWidth: 1, borderColor: Colors.border },
  msgBubbleRight: { backgroundColor: Colors.accentMuted, borderWidth: 1, borderColor: Colors.accentBorder, borderBottomRightRadius: 2 },
  msgText: { fontSize: FontSize.md, color: Colors.accent, lineHeight: 22 },
  msgTextLeft: { color: Colors.textPrimary },

  inputContainer: { 
    flexDirection: 'row', padding: Spacing.md, backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end'
  },
  input: {
    flex: 1, backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: 20, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    fontSize: FontSize.md, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: Colors.border
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent,
    justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm, marginBottom: 2
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { fontSize: 18, color: Colors.accentDark },
});
