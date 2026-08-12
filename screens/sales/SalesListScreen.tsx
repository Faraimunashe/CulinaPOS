import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
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
  Snackbar,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as currencyService from '@/services/currencyService';
import * as orderService from '@/services/orderService';
import * as printService from '@/services/printService';
import * as userService from '@/services/userService';
import * as smsService from '@/services/smsService';
import { useAuthStore } from '@/stores/authStore';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { Currency, Order, SafeUser } from '@/types';

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return orderService.localOrderDate(d);
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDisplayDate(value: string): string {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type DatePreset = 'today' | '7d' | '30d' | 'custom';
type PickerTarget = 'from' | 'to' | null;

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

function DatePickerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateField,
        pressed && styles.dateFieldPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.dateFieldLabel}>{label}</Text>
      <View style={styles.dateFieldValueRow}>
        <MaterialCommunityIcons
          name="calendar"
          size={18}
          color={colors.primary}
        />
        <Text style={styles.dateFieldValue}>{formatDisplayDate(value)}</Text>
      </View>
    </Pressable>
  );
}

export function SalesListScreen() {
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const today = useMemo(() => orderService.localOrderDate(), []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [cashiers, setCashiers] = useState<SafeUser[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [printingSummary, setPrintingSummary] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  const [preset, setPreset] = useState<DatePreset>('today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [draftFrom, setDraftFrom] = useState(today);
  const [draftTo, setDraftTo] = useState(today);
  const [cashierId, setCashierId] = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [appliedReference, setAppliedReference] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const paymentTotals = useMemo(
    () => orderService.summarizeSalesByPayment(orders),
    [orders]
  );
  const grandTotal = useMemo(() => {
    const amount = paymentTotals.reduce((sum, row) => sum + row.total, 0);
    const symbol = paymentTotals[0]?.currency_symbol ?? '$';
    return {
      amount: Math.round(amount * 100) / 100,
      symbol,
    };
  }, [paymentTotals]);
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
    setPickerTarget(null);
    if (next === 'today') {
      setDateFrom(today);
      setDateTo(today);
      setDraftFrom(today);
      setDraftTo(today);
      setFiltersOpen(false);
    } else if (next === '7d') {
      const from = daysAgoDate(7);
      setDateFrom(from);
      setDateTo(today);
      setDraftFrom(from);
      setDraftTo(today);
      setFiltersOpen(false);
    } else if (next === '30d') {
      const from = daysAgoDate(30);
      setDateFrom(from);
      setDateTo(today);
      setDraftFrom(from);
      setDraftTo(today);
      setFiltersOpen(false);
    } else {
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
      setFiltersOpen(true);
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
    setFiltersOpen(false);
    setPickerTarget(null);
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

  const applyPickedDate = (selected: Date) => {
    const next = orderService.localOrderDate(selected);
    setPreset('custom');
    if (pickerTarget === 'from') {
      setDraftFrom(next);
      if (next > draftTo) setDraftTo(next);
    } else if (pickerTarget === 'to') {
      setDraftTo(next);
      if (next < draftFrom) setDraftFrom(next);
    }
  };

  const onAndroidDatePicked = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    setPickerTarget(null);
    if (event.type === 'dismissed' || !selected) return;
    applyPickedDate(selected);
  };

  const onIosDatePicked = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    applyPickedDate(selected);
  };

  const printSummary = async () => {
    setPrintingSummary(true);
    try {
      const result = await printService.printDailySummaryReceipt({
        dateFrom,
        dateTo,
        cashierId,
        currencyId,
      });
      if (result.status === 'printed') {
        setSnack('Sales summary printed');
      } else {
        setSnack(result.reason ?? 'Could not print summary');
      }
    } catch (err) {
      setSnack(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrintingSummary(false);
    }
  };

  const sendSmsSummary = async () => {
    setSendingSms(true);
    try {
      const result = await smsService.sendSalesSummarySms({
        dateFrom,
        dateTo,
        cashierId,
        currencyId,
        actorId: actorId ?? null,
      });
      setSnack(result.message);
    } catch (err) {
      setSnack(err instanceof Error ? err.message : 'SMS send failed');
    } finally {
      setSendingSms(false);
    }
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

  const pickerValue =
    pickerTarget === 'from'
      ? parseLocalDate(draftFrom)
      : pickerTarget === 'to'
        ? parseLocalDate(draftTo)
        : new Date();

  const listHeader = (
    <View>
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
          onPress={() => {
            setFiltersOpen((v) => !v);
            if (filtersOpen) setPickerTarget(null);
          }}
          style={[styles.presetChip, filtersOpen && styles.presetChipOn]}
          accessibilityRole="button"
          accessibilityLabel={filtersOpen ? 'Hide filters' : 'Show filters'}
        >
          <MaterialCommunityIcons
            name={filtersOpen ? 'chevron-up' : 'filter-variant'}
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

      {!filtersOpen && preset === 'custom' ? (
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={styles.rangeSummary}
          accessibilityRole="button"
          accessibilityLabel="Edit custom date range"
        >
          <MaterialCommunityIcons
            name="calendar-range"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.rangeSummaryText}>
            {formatDisplayDate(dateFrom)} – {formatDisplayDate(dateTo)}
          </Text>
          <Text style={styles.rangeSummaryEdit}>Edit</Text>
        </Pressable>
      ) : null}

      {filtersOpen ? (
        <View style={styles.filtersPanel}>
          <View style={styles.filtersPanelHeader}>
            <Text style={styles.filtersPanelTitle}>Filters</Text>
            <Pressable
              onPress={() => {
                setFiltersOpen(false);
                setPickerTarget(null);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Hide filters"
            >
              <Text style={styles.filtersHideText}>Hide</Text>
            </Pressable>
          </View>

          <Text style={styles.filterLabel}>Date range</Text>
          <View style={styles.dateRow}>
            <DatePickerField
              label="Start date"
              value={draftFrom}
              onPress={() => {
                setPreset('custom');
                setPickerTarget('from');
              }}
            />
            <DatePickerField
              label="End date"
              value={draftTo}
              onPress={() => {
                setPreset('custom');
                setPickerTarget('to');
              }}
            />
          </View>

          {pickerTarget && Platform.OS === 'ios' ? (
            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={onIosDatePicked}
                maximumDate={parseLocalDate(today)}
                style={styles.iosPicker}
              />
              <Pressable
                onPress={() => setPickerTarget(null)}
                style={styles.iosPickerDone}
              >
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </Pressable>
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

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : !error ? (
        <View style={styles.totalCard}>
          <View style={styles.totalHeader}>
            <Text style={styles.totalLabel}>Totals</Text>
            <Text style={styles.totalCount}>
              {completedCount} sale{completedCount === 1 ? '' : 's'}
            </Text>
          </View>

          {paymentTotals.length === 0 ? (
            <Text style={styles.totalEmpty}>—</Text>
          ) : (
            <>
              <View style={styles.paymentBlock}>
                {paymentTotals.map((row, index) => (
                  <View
                    key={String(row.payment_method_id ?? row.payment_method_name)}
                    style={[
                      styles.paymentRow,
                      index < paymentTotals.length - 1 && styles.paymentRowDivider,
                    ]}
                  >
                    <View style={styles.paymentMeta}>
                      <Text style={styles.paymentName} numberOfLines={1}>
                        {row.payment_method_name}
                      </Text>
                      <Text style={styles.paymentCount}>
                        {row.order_count} sale
                        {row.order_count === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={styles.paymentAmount}>
                      {formatMoney(row.total, row.currency_symbol)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand total</Text>
                <Text style={styles.grandTotalAmount}>
                  {formatMoney(grandTotal.amount, grandTotal.symbol)}
                </Text>
              </View>
            </>
          )}

          <Pressable
            onPress={() => void printSummary()}
            disabled={printingSummary || completedCount === 0}
            style={({ pressed }) => [
              styles.printSummaryBtn,
              pressed && styles.printSummaryBtnPressed,
              (printingSummary || completedCount === 0) &&
                styles.printSummaryBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Print sales summary"
          >
            {printingSummary ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <MaterialCommunityIcons
                name="printer"
                size={18}
                color={colors.onPrimary}
              />
            )}
            <Text style={styles.printSummaryBtnText}>
              {printingSummary ? 'Printing…' : 'Print summary'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void sendSmsSummary()}
            disabled={sendingSms || completedCount === 0}
            style={({ pressed }) => [
              styles.smsSummaryBtn,
              pressed && styles.smsSummaryBtnPressed,
              (sendingSms || completedCount === 0) &&
                styles.printSummaryBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send sales summary by SMS"
          >
            {sendingSms ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color={colors.onPrimary}
              />
            )}
            <Text style={styles.printSummaryBtnText}>
              {sendingSms ? 'Sending…' : 'Send SMS'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {pickerTarget && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={onAndroidDatePicked}
          maximumDate={parseLocalDate(today)}
        />
      ) : null}

      <FlatList
        data={loading ? [] : orders}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? null : (
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
          )
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

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={3200}
      >
        {snack}
      </Snackbar>
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
  filtersPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  filtersHideText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  rangeSummary: {
    marginHorizontal: 16,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  rangeSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  rangeSummaryEdit: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  dateFieldPressed: {
    opacity: 0.88,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.45,
  },
  dateFieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateFieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iosPickerWrap: {
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  iosPicker: {
    alignSelf: 'stretch',
  },
  iosPickerDone: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  iosPickerDoneText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
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
  paymentBlock: {
    borderRadius: 12,
    backgroundColor: 'rgba(27, 67, 50, 0.06)',
    overflow: 'hidden',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(27, 67, 50, 0.14)',
  },
  paymentMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  paymentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    opacity: 0.55,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  grandTotalRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(27, 67, 50, 0.2)',
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.primary,
    opacity: 0.7,
  },
  grandTotalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.4,
  },
  printSummaryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  smsSummaryBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.secondary,
  },
  smsSummaryBtnPressed: {
    opacity: 0.9,
  },
  printSummaryBtnPressed: {
    opacity: 0.9,
  },
  printSummaryBtnDisabled: {
    opacity: 0.45,
  },
  printSummaryBtnText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  error: {
    marginHorizontal: 16,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    paddingBottom: 32,
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
    marginHorizontal: 16,
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
