import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import * as backupService from '@/services/backupService';
import * as settingsService from '@/services/settingsService';
import { colors } from '@/theme';
import type { PaymentMethod } from '@/types';

export function SettingsScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const setRestaurantName = useSettingsStore((s) => s.setRestaurantName);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, methods] = await Promise.all([
        settingsService.getRestaurantSettings(),
        settingsService.listPaymentMethodSettings(),
      ]);
      setName(settings.restaurantName);
      setAddress(settings.restaurantAddress);
      setPhone(settings.restaurantPhone);
      setPayments(methods);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
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

  const handleSave = async () => {
    if (!actorId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await settingsService.saveRestaurantSettings(
        {
          restaurantName: name,
          restaurantAddress: address,
          restaurantPhone: phone,
        },
        actorId
      );
      setRestaurantName(saved.restaurantName);
      setSnack('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePayment = async (method: PaymentMethod) => {
    if (!actorId) return;
    try {
      await settingsService.setPaymentMethodEnabled(
        method.id,
        method.enabled !== 1,
        actorId
      );
      setSnack(
        method.enabled === 1
          ? `${method.name} disabled`
          : `${method.name} enabled`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleBackup = async () => {
    if (!actorId) return;
    setBackingUp(true);
    setError(null);
    try {
      const result = await backupService.exportDatabaseBackup(actorId);
      setSnack(`Backup ready · ${result.fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!actorId) return;
    setRestoring(true);
    setError(null);
    try {
      await backupService.restoreDatabaseBackup(actorId);
      await load();
      setRestaurantName(
        (await settingsService.getRestaurantSettings()).restaurantName
      );
      setSnack('Database restored');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed';
      if (message !== 'Restore cancelled') setError(message);
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootLabel}>Loading settings…</Text>
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
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>System</Text>
        </View>
        <Text variant="headlineMedium" style={styles.title}>
          Settings
        </Text>
        <Text style={styles.subtitle}>
          Restaurant details, payments, and database backups.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Restaurant</Text>
        <TextInput
          label="Name"
          mode="outlined"
          value={name}
          onChangeText={setName}
          style={styles.input}
          outlineStyle={styles.inputOutline}
        />
        <TextInput
          label="Address"
          mode="outlined"
          value={address}
          onChangeText={setAddress}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          multiline
        />
        <TextInput
          label="Phone"
          mode="outlined"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          keyboardType="phone-pad"
        />
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || restoring || backingUp}
          style={styles.saveBtn}
          contentStyle={styles.saveContent}
        >
          {saving ? 'Saving…' : 'Save details'}
        </Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Payment methods</Text>
        <Text style={styles.hint}>
          Disabled methods are hidden on the POS checkout.
        </Text>
        {payments.map((method) => (
          <View key={method.id} style={styles.switchRow}>
            <Text style={styles.switchTitle}>{method.name}</Text>
            <Switch
              value={method.enabled === 1}
              onValueChange={() => void togglePayment(method)}
              color={colors.primary}
              disabled={saving || restoring || backingUp}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Shortcuts</Text>
        <Pressable
          onPress={() => router.push('/(app)/printer' as Href)}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="printer-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={styles.linkText}>Printer</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.outline}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/currencies' as Href)}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="cash-multiple"
            size={22}
            color={colors.primary}
          />
          <Text style={styles.linkText}>Currencies & rates</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.outline}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/reports' as Href)}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && styles.linkRowPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="chart-box-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={styles.linkText}>Reports</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.outline}
          />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Database</Text>
        <Text style={styles.hint}>
          Backups save under {backupService.getBackupsFolderLabel()} and can be
          shared to another location.
        </Text>
        <Button
          mode="contained-tonal"
          icon="database-export"
          onPress={() => void handleBackup()}
          loading={backingUp}
          disabled={saving || restoring || backingUp}
          style={styles.dbBtn}
        >
          {backingUp ? 'Exporting…' : 'Export backup'}
        </Button>
        <Button
          mode="outlined"
          icon="database-import"
          onPress={() => void handleRestore()}
          loading={restoring}
          disabled={saving || restoring || backingUp}
          style={styles.dbBtn}
          textColor={colors.secondary}
        >
          {restoring ? 'Restoring…' : 'Restore from file'}
        </Button>
      </View>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2800}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  bootLabel: { opacity: 0.7 },
  hero: { marginBottom: 16 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    color: colors.onBackground,
    opacity: 0.65,
    lineHeight: 22,
    fontSize: 15,
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
    marginBottom: 12,
  },
  hint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  inputOutline: { borderRadius: 12 },
  saveBtn: { borderRadius: 12, marginTop: 4 },
  saveContent: { paddingVertical: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  switchTitle: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  linkRowPressed: { opacity: 0.7 },
  linkText: {
    flex: 1,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 15,
  },
  dbBtn: { borderRadius: 12, marginBottom: 10 },
});
