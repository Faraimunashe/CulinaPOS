import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as smsSettingsService from '@/services/smsSettingsService';
import { SMS_INSTALL_DEFAULTS } from '@/config/smsInstallDefaults';
import { colors } from '@/theme';

export function SmsSettingsScreen() {
  const isAdmin = useRequireAdmin();
  const actorId = useAuthStore((s) => s.user?.id);

  const [apiUrl, setApiUrl] = useState<string>(SMS_INSTALL_DEFAULTS.apiUrl);
  const [sender, setSender] = useState<string>(SMS_INSTALL_DEFAULTS.sender);
  const [recipient1, setRecipient1] = useState('');
  const [recipient2, setRecipient2] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await smsSettingsService.getSmsSettings();
      setApiUrl(settings.apiUrl);
      setSender(settings.sender);
      setRecipient1(settings.recipient1);
      setRecipient2(settings.recipient2);
      setHasApiKey(settings.hasApiKey);
      setApiKey('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  if (!isAdmin) return null;

  const save = async () => {
    if (!actorId) return;
    setSaving(true);
    try {
      await smsSettingsService.saveSmsSettings(
        {
          apiUrl,
          sender,
          recipient1,
          recipient2,
          apiKey: apiKey.trim() || undefined,
        },
        actorId
      );
      setApiKey('');
      setSnack('SMS settings saved');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!actorId) return;
    setSaving(true);
    try {
      await smsSettingsService.saveSmsSettings(
        {
          apiUrl,
          sender,
          recipient1,
          recipient2,
          clearApiKey: true,
        },
        actorId
      );
      setSnack('API key cleared');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.title}>
          SMS
        </Text>
        <Text style={styles.subtitle}>
          Sends items sold (split into parts if long) then a sales summary.
          Uses sms.localhost.co.zw.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>API</Text>
        <TextInput
          label="API URL"
          value={apiUrl}
          onChangeText={setApiUrl}
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          label="Sender ID"
          value={sender}
          onChangeText={setSender}
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          label={
            hasApiKey ? 'API key (leave blank to keep current)' : 'API key'
          }
          value={apiKey}
          onChangeText={setApiKey}
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        {hasApiKey ? (
          <Text style={styles.tokenOk}>API key is saved on this device.</Text>
        ) : (
          <Text style={styles.tokenMissing}>No API key saved yet.</Text>
        )}
        {hasApiKey ? (
          <Button
            mode="text"
            textColor={colors.error}
            onPress={() => void clearKey()}
            disabled={saving}
          >
            Clear API key
          </Button>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Recipients (2)</Text>
        <Text style={styles.hint}>
          Include country code, e.g. +263783540959
        </Text>
        <TextInput
          label="Recipient 1"
          value={recipient1}
          onChangeText={setRecipient1}
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          keyboardType="phone-pad"
        />
        <TextInput
          label="Recipient 2"
          value={recipient2}
          onChangeText={setRecipient2}
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          keyboardType="phone-pad"
        />
      </View>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={() => void save()}
        loading={saving}
        disabled={saving}
        style={styles.saveBtn}
        contentStyle={styles.saveContent}
      >
        {saving ? 'Saving…' : 'Save SMS settings'}
      </Button>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2800}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  hero: { marginBottom: 14 },
  title: { color: colors.primary, fontWeight: '800' },
  subtitle: {
    marginTop: 6,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardHeading: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
  },
  hint: {
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: { marginBottom: 10, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  tokenOk: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    marginBottom: 4,
  },
  tokenMissing: {
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.5,
    marginBottom: 4,
  },
  saveBtn: { borderRadius: 14, marginTop: 4 },
  saveContent: { paddingVertical: 6 },
});
