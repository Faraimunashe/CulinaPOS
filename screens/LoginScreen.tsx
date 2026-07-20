import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Text, TextInput, HelperText, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

export function LoginScreen() {
  const router = useRouter();
  const { useSplitPosLayout, width } = useResponsiveLayout();
  const restaurantName = useSettingsStore((s) => s.restaurantName);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const formWidth = useSplitPosLayout ? Math.min(440, width * 0.45) : '100%';

  const handleLogin = async () => {
    clearError();
    if (!username.trim() || !password) {
      return;
    }

    try {
      await login(username, password);
      router.replace('/(app)');
    } catch {
      // handled via authStore.error
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.brandPanel, useSplitPosLayout && styles.brandPanelWide]}>
          <Text variant="displaySmall" style={styles.brand}>
            {restaurantName}
          </Text>
          <Text variant="titleMedium" style={styles.tagline}>
            Offline Restaurant POS
          </Text>
        </View>

        <Surface style={[styles.card, { width: formWidth }]} elevation={2}>
          <Text variant="headlineSmall" style={styles.cardTitle}>
            Sign in
          </Text>

          <TextInput
            label="Username"
            mode="outlined"
            value={username}
            onChangeText={(value) => {
              clearError();
              setUsername(value);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
            disabled={isLoading}
          />

          <TextInput
            label="Password"
            mode="outlined"
            value={password}
            onChangeText={(value) => {
              clearError();
              setPassword(value);
            }}
            secureTextEntry={!showPassword}
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
            disabled={isLoading}
            onSubmitEditing={handleLogin}
          />

          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading || !username.trim() || !password}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Login
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 28,
  },
  brandPanel: {
    alignItems: 'center',
  },
  brandPanelWide: {
    marginBottom: 8,
  },
  brand: {
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  tagline: {
    marginTop: 8,
    color: colors.onBackground,
    textAlign: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    maxWidth: 480,
  },
  cardTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
