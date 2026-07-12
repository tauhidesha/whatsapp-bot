import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Colors, Spacing, FontSize } from '@/lib/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email dan password harus diisi');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password.trim());
    } catch (err: any) {
      const message = err?.code === 'auth/invalid-credential'
        ? 'Email atau password salah'
        : err?.message || 'Login gagal';
      Alert.alert('Login Gagal', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        {/* Branding */}
        <View style={styles.branding}>
          <Text style={styles.logo}>BOSMAT</Text>
          <Text style={styles.subtitle}>STUDIO ADMIN</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@bosmatstudio.com"
            placeholderTextColor={Colors.textDimmed}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: Spacing.lg }]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textDimmed}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.accentDark} />
            ) : (
              <Text style={styles.buttonText}>MASUK</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Powered by Zoya AI
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.accent,
    letterSpacing: 8,
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 6,
    marginTop: Spacing.sm,
  },
  form: {
    backgroundColor: Colors.bgCard,
    borderRadius: 4,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 3,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.bgInput,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: 2,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    borderRadius: 2,
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.accentDark,
    fontSize: FontSize.sm,
    fontWeight: '900',
    letterSpacing: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textDimmed,
    marginTop: Spacing.xxxl,
    letterSpacing: 2,
  },
});
