import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
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
import { useFocusEffect } from 'expo-router';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as currencyService from '@/services/currencyService';
import { colors } from '@/theme';
import type { Currency } from '@/types';

type FormMode = 'create' | 'edit' | 'rate';

export function CurrenciesScreen() {
  const isAdmin = useRequireAdmin();
  const actorId = useAuthStore((s) => s.user?.id);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [primaryId, setPrimaryId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formTarget, setFormTarget] = useState<Currency | null>(null);
  const [formName, setFormName] = useState('');
  const [formSymbol, setFormSymbol] = useState('');
  const [formRate, setFormRate] = useState('1');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
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

  const closeForm = () => {
    if (saving) return;
    setFormMode(null);
    setFormTarget(null);
    setFormError(null);
  };

  const openCreate = () => {
    setFormMode('create');
    setFormTarget(null);
    setFormName('');
    setFormSymbol('');
    setFormRate('1');
    setFormEnabled(true);
    setFormError(null);
  };

  const openEdit = (currency: Currency) => {
    setFormMode('edit');
    setFormTarget(currency);
    setFormName(currency.name);
    setFormSymbol(currency.symbol);
    setFormRate(String(currency.rate_to_primary));
    setFormEnabled(currency.enabled === 1);
    setFormError(null);
  };

  const openRate = (currency: Currency) => {
    setFormMode('rate');
    setFormTarget(currency);
    setFormRate(String(currency.rate_to_primary));
    setFormError(null);
  };

  useEffect(() => {
    if (!formMode) return;
    setFormError(null);
  }, [formName, formSymbol, formRate, formEnabled, formMode]);

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

  const saveForm = async () => {
    if (!actorId || !formMode) return;
    setSaving(true);
    setFormError(null);
    try {
      if (formMode === 'rate') {
        if (!formTarget) return;
        await currencyService.updateCurrencyRate(
          formTarget.id,
          Number.parseFloat(formRate),
          actorId
        );
        setSnack(`Updated ${formTarget.name} rate`);
      } else if (formMode === 'create') {
        const created = await currencyService.createCurrency(
          {
            name: formName,
            symbol: formSymbol,
            rate_to_primary: Number.parseFloat(formRate),
            enabled: formEnabled,
          },
          actorId
        );
        setSnack(`Added ${created.name}`);
      } else if (formMode === 'edit' && formTarget) {
        const isPrimary = formTarget.id === primaryId;
        const updated = await currencyService.updateCurrency(
          formTarget.id,
          {
            name: formName,
            symbol: formSymbol,
            rate_to_primary: isPrimary
              ? 1
              : Number.parseFloat(formRate),
            enabled: formEnabled,
          },
          actorId
        );
        setSnack(`Updated ${updated.name}`);
      }
      setFormMode(null);
      setFormTarget(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const formTitle =
    formMode === 'create'
      ? 'New currency'
      : formMode === 'edit'
        ? `Edit · ${formTarget?.name ?? 'Currency'}`
        : formMode === 'rate'
          ? `Rate · ${formTarget?.name ?? ''}`
          : '';

  const primaryLabel =
    formMode === 'create'
      ? saving
        ? 'Creating…'
        : 'Add currency'
      : saving
        ? 'Saving…'
        : 'Save';

  const editingPrimary =
    formMode === 'edit' && formTarget?.id === primaryId;

  const canSave =
    formMode === 'rate'
      ? !!formRate.trim()
      : !!formName.trim() &&
        !!formSymbol.trim() &&
        (editingPrimary || !!formRate.trim());

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text variant="headlineSmall" style={styles.heroTitle}>
              Currencies
            </Text>
            <Text style={styles.heroSubtitle}>
              Prices convert from {primaryName}
            </Text>
          </View>
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && styles.addBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add currency"
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={colors.onPrimary}
            />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={currencies}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No currencies yet</Text>
              <Text style={styles.emptyBody}>
                Add USD, ZiG, or any other currency you accept.
              </Text>
            </View>
          }
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
                        ? 'Primary · rate 1.00'
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
                  <Button
                    mode="contained-tonal"
                    compact
                    icon="pencil"
                    onPress={() => openEdit(item)}
                    style={styles.actionBtn}
                  >
                    Edit
                  </Button>
                  {!isPrimary ? (
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => openRate(item)}
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
                    disabled={isPrimary}
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
        visible={formMode != null}
        title={formTitle}
        onDismiss={closeForm}
        primaryLabel={primaryLabel}
        onPrimary={() => void saveForm()}
        primaryLoading={saving}
        primaryDisabled={!canSave || saving}
      >
        {formMode === 'rate' ? (
          <>
            <Text style={styles.sheetHint}>
              How many {formTarget?.name} equal 1 {primaryName}?
            </Text>
            <TextInput
              label={`Rate to ${primaryName}`}
              mode="outlined"
              keyboardType="decimal-pad"
              value={formRate}
              onChangeText={setFormRate}
              style={styles.sheetInput}
              outlineStyle={styles.sheetOutline}
              disabled={saving}
            />
          </>
        ) : (
          <>
            <Text style={styles.sheetHint}>
              {formMode === 'create'
                ? 'Name and symbol appear on prices and receipts.'
                : 'Update how this currency is labeled and converted.'}
            </Text>
            <TextInput
              label="Name"
              mode="outlined"
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. USD, ZiG, EUR"
              autoCapitalize="characters"
              style={styles.sheetInput}
              outlineStyle={styles.sheetOutline}
              disabled={saving}
            />
            <TextInput
              label="Symbol"
              mode="outlined"
              value={formSymbol}
              onChangeText={setFormSymbol}
              placeholder="e.g. $, ZiG, €"
              style={styles.sheetInput}
              outlineStyle={styles.sheetOutline}
              disabled={saving}
            />
            {!editingPrimary ? (
              <TextInput
                label={`Rate to ${primaryName}`}
                mode="outlined"
                keyboardType="decimal-pad"
                value={formRate}
                onChangeText={setFormRate}
                style={styles.sheetInput}
                outlineStyle={styles.sheetOutline}
                disabled={saving}
              />
            ) : (
              <View style={styles.primaryNote}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.primaryNoteText}>
                  Primary currency rate is always 1. Convert other currencies
                  against this one.
                </Text>
              </View>
            )}
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Enabled</Text>
                <Text style={styles.switchHint}>
                  Disabled currencies stay off the POS and product prices.
                </Text>
              </View>
              <Switch
                value={formEnabled}
                onValueChange={setFormEnabled}
                color={colors.primary}
                disabled={saving || editingPrimary}
              />
            </View>
          </>
        )}

        {formError ? (
          <HelperText type="error" visible>
            {formError}
          </HelperText>
        ) : null}
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 4,
    color: colors.onBackground,
    opacity: 0.6,
    fontSize: 13,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnPressed: {
    opacity: 0.88,
  },
  addBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  loader: { marginTop: 40 },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  emptyBody: {
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
  },
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
  sheetHint: {
    color: colors.onSurface,
    opacity: 0.6,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  sheetInput: {
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  sheetOutline: {
    borderRadius: 12,
  },
  primaryNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  primaryNoteText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 14,
  },
  switchHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.55,
    lineHeight: 16,
  },
});
