import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as currencyService from '@/services/currencyService';
import { colors } from '@/theme';
import type { Currency } from '@/types';

export function CurrenciesScreen() {
  const isAdmin = useRequireAdmin();
  const actorId = useAuthStore((s) => s.user?.id);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [primaryId, setPrimaryId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<Currency | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, primary] = await Promise.all([
        currencyService.listCurrencies(),
        currencyService.getPrimaryCurrency(),
      ]);
      setCurrencies(rows);
      setPrimaryId(primary.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load currencies');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  const primaryName = useMemo(
    () => currencies.find((c) => c.id === primaryId)?.name ?? 'Primary',
    [currencies, primaryId]
  );

  if (!isAdmin) return null;

  const makePrimary = async (currency: Currency) => {
    if (!actorId) return;
    try {
      await currencyService.setPrimaryCurrency(currency.id, actorId);
      setSnack(`${currency.name} is primary`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set primary');
    }
  };

  const toggleEnabled = async (currency: Currency) => {
    if (!actorId) return;
    try {
      await currencyService.setCurrencyEnabled(
        currency.id,
        currency.enabled !== 1,
        actorId
      );
      setSnack(
        currency.enabled === 1
          ? `${currency.name} disabled`
          : `${currency.name} enabled`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const saveRate = async () => {
    if (!actorId || !rateTarget) return;
    setSaving(true);
    try {
      await currencyService.updateCurrencyRate(
        rateTarget.id,
        Number.parseFloat(rateValue),
        actorId
      );
      setSnack(`Updated ${rateTarget.name} rate`);
      setRateTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rate update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Currencies
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={currencies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isPrimary = item.id === primaryId;
            const enabled = item.enabled === 1;
            return (
              <View style={[styles.card, isPrimary && styles.cardPrimary]}>
                <View style={styles.cardTop}>
                  <View style={styles.symbolWrap}>
                    <Text style={styles.symbol}>{item.symbol}</Text>
                  </View>
                  <View style={styles.cardText}>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {isPrimary
                        ? 'Primary · 1.00'
                        : `1 ${primaryName} = ${item.rate_to_primary} ${item.name}`}
                    </Text>
                  </View>
                  <View style={styles.badges}>
                    {isPrimary ? (
                      <View style={[styles.badge, styles.badgePrimary]}>
                        <Text style={styles.badgePrimaryText}>Primary</Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.badge,
                        enabled ? styles.badgeOn : styles.badgeOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          !enabled && styles.badgeTextOff,
                        ]}
                      >
                        {enabled ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  {!isPrimary ? (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => {
                        setRateValue(String(item.rate_to_primary));
                        setRateTarget(item);
                      }}
                      style={styles.actionBtn}
                    >
                      Rate
                    </Button>
                  ) : null}
                  <Button
                    mode="outlined"
                    compact
                    disabled={isPrimary}
                    onPress={() => void makePrimary(item)}
                    style={styles.actionBtn}
                  >
                    Set primary
                  </Button>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => void toggleEnabled(item)}
                    style={styles.actionBtn}
                  >
                    {enabled ? 'Disable' : 'Enable'}
                  </Button>
                </View>
              </View>
            );
          }}
        />
      )}

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      <BottomSheetModal
        visible={!!rateTarget}
        title={rateTarget ? `Rate · ${rateTarget.name}` : 'Rate'}
        onDismiss={() => setRateTarget(null)}
        primaryLabel="Save"
        onPrimary={() => void saveRate()}
        primaryLoading={saving}
        primaryDisabled={!rateValue.trim()}
      >
        <TextInput
          label="Rate"
          mode="outlined"
          keyboardType="decimal-pad"
          value={rateValue}
          onChangeText={setRateValue}
          style={styles.sheetInput}
        />
      </BottomSheetModal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardPrimary: {
    borderColor: colors.primary,
    backgroundColor: '#F3FAF5',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symbolWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: '700' },
  cardMeta: {
    marginTop: 2,
    opacity: 0.65,
    fontSize: 13,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePrimary: {
    backgroundColor: colors.secondaryContainer,
  },
  badgePrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  badgeOn: { backgroundColor: colors.primaryContainer },
  badgeOff: { backgroundColor: colors.surfaceVariant },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeTextOff: {
    color: colors.onSurface,
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: { borderRadius: 10 },
  error: { marginHorizontal: 16 },
  sheetInput: {
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
});
