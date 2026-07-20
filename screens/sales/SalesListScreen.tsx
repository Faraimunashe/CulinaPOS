import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  HelperText,
  Searchbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as currencyService from '@/services/currencyService';
import * as orderService from '@/services/orderService';
import * as userService from '@/services/userService';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { Currency, Order, SafeUser } from '@/types';

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return orderService.localOrderDate(d);
}

type DatePreset = 'today' | '7d' | '30d' | 'custom';

function FilterChipRow<T extends { id: number }>({
  label,
  items,
  selectedId,
  onSelect,
  getLabel,
}: {
  label: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  getLabel: (item: T) => string;
}) {
  return (
    <View>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          onPress={() => onSelect(null)}
          style={[styles.filterChip, selectedId == null && styles.filterChipOn]}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedId == null && styles.filterChipTextOn,
            ]}
          >
            All
          </Text>
        </Pressable>
        {items.map((item) => {
          const on = selectedId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[styles.filterChip, on && styles.filterChipOn]}
            >
              <Text
                style={[styles.filterChipText, on && styles.filterChipTextOn]}
                numberOfLines={1}
              >
                {getLabel(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SalesListScreen() {
  const router = useRouter();
  const today = useMemo(() => orderService.localOrderDate(), []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [cashiers, setCashiers] = useState<SafeUser[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<DatePreset>('30d');
  const [dateFrom, setDateFrom] = useState(daysAgoDate(30));
  const [dateTo, setDateTo] = useState(today);
  const [draftFrom, setDraftFrom] = useState(daysAgoDate(30));
  const [draftTo, setDraftTo] = useState(today);
  const [cashierId, setCashierId] = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [appliedReference, setAppliedReference] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const totals = useMemo(
    () => orderService.summarizeSalesTotals(orders),
    [orders]
  );
  const completedCount = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED').length,
    [orders]
  );

  const currentFilters = useCallback(
    (overrides?: {
      dateFrom?: string;
      dateTo?: string;
      saleReference?: string;
      cashierId?: number | null;
      currencyId?: number | null;
    }) => ({
      dateFrom: (overrides?.dateFrom ?? dateFrom).trim() || null,
      dateTo: (overrides?.dateTo ?? dateTo).trim() || null,
      cashierId:
        overrides && 'cashierId' in overrides
          ? overrides.cashierId
          : cashierId,
      currencyId:
        overrides && 'currencyId' in overrides
          ? overrides.currencyId
          : currencyId,
      saleReference: overrides?.saleReference ?? appliedReference,
    }),
    [appliedReference, cashierId, currencyId, dateFrom, dateTo]
  );

  const fetchSales = useCallback(
    async (filters = currentFilters()) => {
      const [rows, users, currencyRows] = await Promise.all([
        orderService.listOrders(filters),
        userService.listUsers(),
        currencyService.listCurrencies({ enabledOnly: true }),
      ]);
      setOrders(rows);
      setCashiers(users);
      setCurrencies(currencyRows);
      setError(null);
    },
    [currentFilters]
  );

  const applyPreset = (next: DatePreset) => {
    setPreset(next);
    if (next === 'today') {
      setDateFrom(today);
      setDateTo(today);
      setDraftFrom(today);
      setDraftTo(today);
    } else if (next === '7d') {
      const from = daysAgoDate(7);
      setDateFrom(from);
      setDateTo(today);
      setDraftFrom(from);
      setDraftTo(today);
    } else if (next === '30d') {
      const from = daysAgoDate(30);
      setDateFrom(from);
      setDateTo(today);
      setDraftFrom(from);
      setDraftTo(today);
    } else {
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
    }
  };

  const load = useCallback(async () => {
    try {
      await fetchSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchSales]);

  const applyFilters = () => {
    const nextFrom = (preset === 'custom' ? draftFrom : dateFrom).trim();
    const nextTo = (preset === 'custom' ? draftTo : dateTo).trim();
    const nextRef = reference.trim();
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setAppliedReference(nextRef);
    setLoading(true);
    void (async () => {
      try {
        await fetchSales(
          currentFilters({
            dateFrom: nextFrom,
            dateTo: nextTo,
            saleReference: nextRef,
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sales');
      } finally {
        setLoading(false);
      }
    })();
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const activeFilterCount =
    (cashierId != null ? 1 : 0) +
    (currencyId != null ? 1 : 0) +
    (appliedReference ? 1 : 0) +
    (preset === 'custom' ? 1 : 0);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Sales
        </Text>
        <Text style={styles.heroSub}>
          Browse completed orders, open a sale, or reprint a receipt.
        </Text>
      </View>

      <Searchbar
        placeholder="Sale reference (order #)…"
        value={reference}
        onChangeText={setReference}
        style={styles.search}
        onSubmitEditing={applyFilters}
      />

      <View style={styles.presetRow}>
        {(
          [
            { key: 'today' as const, label: 'Today' },
            { key: '7d' as const, label: '7 days' },
            { key: '30d' as const, label: '30 days' },
            { key: 'custom' as const, label: 'Custom' },
          ] as const
        ).map((item) => {
          const on = preset === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => applyPreset(item.key)}
              style={[styles.presetChip, on && styles.presetChipOn]}
            >
              <Text style={[styles.presetText, on && styles.presetTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setFiltersOpen((v) => !v)}
          style={[styles.presetChip, filtersOpen && styles.presetChipOn]}
          accessibilityRole="button"
          accessibilityLabel="More filters"
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={16}
            color={filtersOpen ? colors.onPrimary : colors.primary}
          />
          {activeFilterCount > 0 ? (
            <Text style={[styles.presetText, filtersOpen && styles.presetTextOn]}>
              {activeFilterCount}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filtersPanel}>
          {preset === 'custom' ? (
            <View style={styles.dateRow}>
              <TextInput
                label="Start date"
                value={draftFrom}
                onChangeText={setDraftFrom}
                mode="outlined"
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
                dense
              />
              <TextInput
                label="End date"
                value={draftTo}
                onChangeText={setDraftTo}
                mode="outlined"
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
                dense
              />
            </View>
          ) : null}

          <FilterChipRow
            label="Cashier"
            items={cashiers}
            selectedId={cashierId}
            onSelect={setCashierId}
            getLabel={(u) => u.full_name}
          />
          <FilterChipRow
            label="Currency"
            items={currencies}
            selectedId={currencyId}
            onSelect={setCurrencyId}
            getLabel={(c) => `${c.symbol} ${c.name}`}
          />

          <Pressable
            onPress={applyFilters}
            style={({ pressed }) => [
              styles.applyBtn,
              pressed && styles.applyBtnPressed,
            ]}
          >
            <Text style={styles.applyBtnText}>Apply filters</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error ? (
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <Text style={styles.totalLabel}>Total (completed)</Text>
            <Text style={styles.totalCount}>
              {completedCount} sale{completedCount === 1 ? '' : 's'}
            </Text>
          </View>
          {totals.length === 0 ? (
            <Text style={styles.totalEmpty}>—</Text>
          ) : (
            totals.map((row) => (
              <View key={String(row.currency_id ?? 'none')} style={styles.totalRow}>
                <Text style={styles.totalCurrency}>
                  {row.currency_name}
                  <Text style={styles.totalCurrencyCount}>
                    {' '}
                    · {row.order_count}
                  </Text>
                </Text>
                <Text style={styles.totalAmount}>
                  {formatMoney(row.total, row.currency_symbol)}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={40}
                color={colors.outline}
              />
              <Text style={styles.emptyTitle}>No sales found</Text>
              <Text style={styles.emptyBody}>
                Try a wider date range or clear filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(app)/sales/${item.id}` as Href)
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNum}>#{item.order_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'REVERSED'
                      ? styles.statusReversed
                      : styles.statusCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === 'REVERSED'
                        ? styles.statusTextReversed
                        : styles.statusTextCompleted,
                    ]}
                  >
                    {item.status === 'REVERSED' ? 'Reversed' : 'Completed'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.order_date}
                {item.cashier_name ? ` · ${item.cashier_name}` : ''}
                {item.currency_symbol ? ` · ${item.currency_symbol}` : ''}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.cardTotal}>
                  {formatMoney(
                    item.total,
                    item.currency_symbol ?? '$'
                  )}
                </Text>
                <Text style={styles.cardPay}>
                  {item.payment_method_name ?? '—'}
                  {item.item_count != null
                    ? ` · ${item.item_count} item${item.item_count === 1 ? '' : 's'}`
                    : ''}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={colors.outline}
                />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
  },
  heroSub: {
    marginTop: 4,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 14,
    lineHeight: 20,
  },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  presetChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  presetTextOn: {
    color: colors.onPrimary,
  },
  filtersPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateInput: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  filterLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.45,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    maxWidth: 180,
  },
  filterChipOn: {
    backgroundColor: colors.primaryContainer,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  filterChipTextOn: {
    color: colors.primary,
    fontWeight: '800',
  },
  applyBtn: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  applyBtnPressed: {
    opacity: 0.9,
  },
  applyBtnText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  totalCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.primary,
    opacity: 0.75,
  },
  totalCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    opacity: 0.65,
  },
  totalEmpty: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  totalCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  totalCurrencyCount: {
    fontWeight: '600',
    opacity: 0.55,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  error: {
    marginHorizontal: 16,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyBody: {
    textAlign: 'center',
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.92,
    backgroundColor: colors.primaryContainer,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: colors.primaryContainer,
  },
  statusReversed: {
    backgroundColor: '#FCE8EC',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusTextCompleted: {
    color: colors.success,
  },
  statusTextReversed: {
    color: colors.error,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.55,
    fontWeight: '600',
  },
  cardBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurface,
  },
  cardPay: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.5,
    fontWeight: '600',
  },
});
