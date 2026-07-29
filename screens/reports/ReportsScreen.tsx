import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, HelperText, Snackbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import * as reportService from '@/services/reportService';
import * as printService from '@/services/printService';
import { formatStockLabel } from '@/services/inventoryService';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { InventoryItem } from '@/types';
import type {
  CashierSalesRow,
  CurrencyTotalRow,
  DailySalesRow,
  PaymentSalesRow,
  ProductSalesRow,
  SalesSummary,
} from '@/services/reportService';

type TabKey =
  | 'overview'
  | 'daily'
  | 'products'
  | 'cashiers'
  | 'payments'
  | 'inventory'
  | 'lowstock';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { key: 'daily', label: 'Daily', icon: 'calendar-month-outline' },
  { key: 'products', label: 'Products', icon: 'food' },
  { key: 'cashiers', label: 'Cashiers', icon: 'account-cash-outline' },
  { key: 'payments', label: 'Payments', icon: 'credit-card-outline' },
  { key: 'inventory', label: 'Stock', icon: 'package-variant' },
  { key: 'lowstock', label: 'Low', icon: 'alert-outline' },
];

function formatReportDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function ReportsScreen() {
  const isAdmin = useRequireAdmin();
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [today, setToday] = useState<SalesSummary | null>(null);
  const [month, setMonth] = useState<SalesSummary | null>(null);
  const [daily, setDaily] = useState<DailySalesRow[]>([]);
  const [products, setProducts] = useState<ProductSalesRow[]>([]);
  const [cashiers, setCashiers] = useState<CashierSalesRow[]>([]);
  const [payments, setPayments] = useState<PaymentSalesRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [todayByCurrency, setTodayByCurrency] = useState<CurrencyTotalRow[]>(
    []
  );
  const [printingDay, setPrintingDay] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
    try {
      const [
        todaySummary,
        monthSummary,
        dailyRows,
        productRows,
        cashierRows,
        paymentRows,
        inventoryRows,
        lowRows,
        closeSummary,
      ] = await Promise.all([
        reportService.getTodaySalesSummary(),
        reportService.getMonthlySalesSummary(),
        reportService.getDailySales({ days: 30 }),
        reportService.getSalesByProduct({ days: 30 }),
        reportService.getSalesByCashier({ days: 30 }),
        reportService.getSalesByPaymentMethod({ days: 30 }),
        reportService.getInventoryReport(),
        reportService.getLowStockReport(),
        reportService.getDailyCloseSummary(),
      ]);
      setToday(todaySummary);
      setMonth(monthSummary);
      setDaily(dailyRows);
      setProducts(productRows);
      setCashiers(cashierRows);
      setPayments(paymentRows);
      setInventory(inventoryRows);
      setLowStock(lowRows);
      setTodayByCurrency(closeSummary.by_currency);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  const maxProductTotal = useMemo(
    () => Math.max(...products.map((p) => p.total), 0),
    [products]
  );
  const maxDailyTotal = useMemo(
    () => Math.max(...daily.map((d) => d.total), 0),
    [daily]
  );
  const maxCashierTotal = useMemo(
    () => Math.max(...cashiers.map((c) => c.total), 0),
    [cashiers]
  );
  const maxPaymentTotal = useMemo(
    () => Math.max(...payments.map((p) => p.total), 0),
    [payments]
  );

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  if (!isAdmin) return null;

  const printTodaySummary = async () => {
    setPrintingDay(true);
    try {
      const result = await printService.printDailySummaryReceipt();
      if (result.status === 'printed') {
        setSnack("Today's summary printed");
      } else {
        setSnack(result.reason ?? 'Could not print summary');
      }
    } catch (err) {
      setSnack(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrintingDay(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Analytics</Text>
            </View>
            <Text variant="headlineMedium" style={styles.heroTitle}>
              Reports
            </Text>
          </View>
          {!loading ? (
            <Pressable
              onPress={() => void load({ soft: true })}
              style={({ pressed }) => [
                styles.refreshBtn,
                pressed && styles.refreshBtnPressed,
              ]}
              accessibilityLabel="Refresh reports"
            >
              <MaterialCommunityIcons
                name="refresh"
                size={20}
                color={colors.primary}
              />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.heroSubtitle}>
          Live sales and stock performance across the last 30 days.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((item) => {
          const on = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={18}
                color={on ? colors.onPrimary : colors.primary}
              />
              <Text
                style={[styles.tabText, on && styles.tabTextOn]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.boot}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.bootLabel}>Building reports…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load({ soft: true })}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{activeTab.label}</Text>
            <Text style={styles.sectionHint}>
              {tab === 'overview'
                ? 'Snapshot of today and this month'
                : tab === 'lowstock'
                  ? `${lowStock.length} item${lowStock.length === 1 ? '' : 's'} below minimum`
                  : tab === 'inventory'
                    ? `${inventory.length} tracked items`
                    : 'Last 30 days'}
            </Text>
          </View>

          {tab === 'overview' ? (
            <View style={styles.overview}>
              <View style={styles.heroStat}>
                <View style={styles.heroStatIcon}>
                  <MaterialCommunityIcons
                    name="cash-fast"
                    size={22}
                    color={colors.onPrimary}
                  />
                </View>
                <View style={styles.heroStatCopy}>
                  <Text style={styles.heroStatLabel}>Today’s sales</Text>
                  {todayByCurrency.length > 1 ? (
                    todayByCurrency.map((row) => (
                      <Text
                        key={String(row.currency_id ?? row.currency_name)}
                        style={styles.heroStatValue}
                      >
                        {formatMoney(row.total, row.currency_symbol)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.heroStatValue}>
                      {formatMoney(
                        todayByCurrency[0]?.total ?? today?.total ?? 0,
                        todayByCurrency[0]?.currency_symbol
                      )}
                    </Text>
                  )}
                  <Text style={styles.heroStatMeta}>
                    {today?.order_count ?? 0} orders · {today?.item_count ?? 0}{' '}
                    items sold
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => void printTodaySummary()}
                disabled={printingDay}
                style={({ pressed }) => [
                  styles.printDayBtn,
                  pressed && styles.printDayBtnPressed,
                  printingDay && styles.printDayBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Print today's summary receipt"
              >
                {printingDay ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <MaterialCommunityIcons
                    name="printer"
                    size={20}
                    color={colors.onPrimary}
                  />
                )}
                <Text style={styles.printDayBtnText}>
                  {printingDay ? 'Printing…' : "Print today's summary"}
                </Text>
              </Pressable>

              <View style={styles.metricGrid}>
                <MetricCard
                  icon="calendar-blank-outline"
                  label="This month"
                  value={formatMoney(month?.total ?? 0)}
                  meta={`${month?.order_count ?? 0} orders`}
                />
                <MetricCard
                  icon="cart-outline"
                  label="Items sold"
                  value={String(month?.item_count ?? 0)}
                  meta="Month to date"
                />
                <MetricCard
                  icon="alert-circle-outline"
                  label="Low stock"
                  value={String(lowStock.length)}
                  meta="Needs attention"
                  tone={lowStock.length > 0 ? 'warn' : 'ok'}
                />
                <MetricCard
                  icon="package-variant-closed"
                  label="Inventory"
                  value={String(inventory.length)}
                  meta="All items"
                />
              </View>

              {products.length > 0 ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Top products</Text>
                  {products.slice(0, 3).map((item, index) => (
                    <RankedRow
                      key={item.product_id}
                      rank={index + 1}
                      title={item.product_name}
                      subtitle={`${item.quantity} sold`}
                      value={formatMoney(item.total)}
                      ratio={
                        maxProductTotal > 0 ? item.total / maxProductTotal : 0
                      }
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {tab === 'daily' ? (
            <ReportList
              emptyTitle="No daily sales yet"
              emptyBody="Completed orders will appear here day by day."
              emptyIcon="calendar-blank-outline"
              data={daily}
              keyExtractor={(item) => item.order_date}
              renderItem={(item, index) => (
                <RankedRow
                  rank={index + 1}
                  title={formatReportDate(item.order_date)}
                  subtitle={`${item.order_count} order${item.order_count === 1 ? '' : 's'}`}
                  value={formatMoney(item.total)}
                  ratio={maxDailyTotal > 0 ? item.total / maxDailyTotal : 0}
                />
              )}
            />
          ) : null}

          {tab === 'products' ? (
            <ReportList
              emptyTitle="No product sales"
              emptyBody="Sell items on the POS to populate this report."
              emptyIcon="food-off"
              data={products}
              keyExtractor={(item) => String(item.product_id)}
              renderItem={(item, index) => (
                <RankedRow
                  rank={index + 1}
                  title={item.product_name}
                  subtitle={`${item.quantity} sold`}
                  value={formatMoney(item.total)}
                  ratio={
                    maxProductTotal > 0 ? item.total / maxProductTotal : 0
                  }
                />
              )}
            />
          ) : null}

          {tab === 'cashiers' ? (
            <ReportList
              emptyTitle="No cashier activity"
              emptyBody="Sales by staff will show here once orders are taken."
              emptyIcon="account-off-outline"
              data={cashiers}
              keyExtractor={(item) => String(item.cashier_id)}
              renderItem={(item, index) => (
                <RankedRow
                  rank={index + 1}
                  title={item.cashier_name}
                  subtitle={`${item.order_count} order${item.order_count === 1 ? '' : 's'}`}
                  value={formatMoney(item.total)}
                  ratio={
                    maxCashierTotal > 0 ? item.total / maxCashierTotal : 0
                  }
                />
              )}
            />
          ) : null}

          {tab === 'payments' ? (
            <ReportList
              emptyTitle="No payment breakdown"
              emptyBody="Payment methods used at checkout will appear here."
              emptyIcon="credit-card-off-outline"
              data={payments}
              keyExtractor={(item) =>
                String(item.payment_method_id ?? item.payment_method_name)
              }
              renderItem={(item, index) => (
                <RankedRow
                  rank={index + 1}
                  title={item.payment_method_name}
                  subtitle={`${item.order_count} order${item.order_count === 1 ? '' : 's'}`}
                  value={formatMoney(item.total)}
                  ratio={
                    maxPaymentTotal > 0 ? item.total / maxPaymentTotal : 0
                  }
                />
              )}
            />
          ) : null}

          {tab === 'inventory' ? (
            <ReportList
              emptyTitle="Inventory is empty"
              emptyBody="Add ingredients or retail stock to track levels here."
              emptyIcon="package-variant-closed"
              data={inventory}
              keyExtractor={(item) => String(item.id)}
              renderItem={(item) => (
                <StockRow
                  title={item.name}
                  badge={item.item_kind === 'RETAIL' ? 'Retail' : 'Ingredient'}
                  subtitle={formatStockLabel(item)}
                  value={`${item.quantity} ${item.unit}`}
                />
              )}
            />
          ) : null}

          {tab === 'lowstock' ? (
            <ReportList
              emptyTitle="All stock looks healthy"
              emptyBody="Nothing is at or below its minimum level right now."
              emptyIcon="check-circle-outline"
              data={lowStock}
              keyExtractor={(item) => String(item.id)}
              renderItem={(item) => (
                <StockRow
                  title={item.name}
                  badge="Low"
                  subtitle={`Minimum ${item.minimum_quantity} ${item.unit}`}
                  value={`${item.quantity} ${item.unit}`}
                  danger
                />
              )}
            />
          ) : null}
        </ScrollView>
      )}

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

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

function MetricCard({
  icon,
  label,
  value,
  meta,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  value: string;
  meta: string;
  tone?: 'default' | 'warn' | 'ok';
}) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === 'warn' && styles.metricCardWarn,
        tone === 'ok' && styles.metricCardOk,
      ]}
    >
      <View
        style={[
          styles.metricIcon,
          tone === 'warn' && styles.metricIconWarn,
          tone === 'ok' && styles.metricIconOk,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={
            tone === 'warn'
              ? colors.secondary
              : tone === 'ok'
                ? colors.success
                : colors.primary
          }
        />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'warn' && styles.metricValueWarn,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.metricMeta}>{meta}</Text>
    </View>
  );
}

function RankedRow({
  rank,
  title,
  subtitle,
  value,
  ratio,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: string;
  ratio: number;
}) {
  const width = `${Math.max(8, Math.round(Math.min(1, ratio) * 100))}%`;
  return (
    <View style={styles.rankedRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View style={styles.rankedCopy}>
        <View style={styles.rankedTop}>
          <Text style={styles.rankedTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rankedValue}>{value}</Text>
        </View>
        <Text style={styles.rankedSubtitle}>{subtitle}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: width as `${number}%` }]} />
        </View>
      </View>
    </View>
  );
}

function StockRow({
  title,
  subtitle,
  value,
  badge,
  danger,
}: {
  title: string;
  subtitle: string;
  value: string;
  badge: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.stockRow, danger && styles.stockRowDanger]}>
      <View style={styles.stockCopy}>
        <View style={styles.stockTitleRow}>
          <Text style={styles.rankedTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.kindChip, danger && styles.kindChipDanger]}>
            <Text
              style={[styles.kindChipText, danger && styles.kindChipTextDanger]}
            >
              {badge}
            </Text>
          </View>
        </View>
        <Text style={styles.rankedSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.rankedValue, danger && styles.rankedValueDanger]}>
        {value}
      </Text>
    </View>
  );
}

function ReportList<T>({
  data,
  emptyTitle,
  emptyBody,
  emptyIcon,
  keyExtractor,
  renderItem,
}: {
  data: T[];
  emptyTitle: string;
  emptyBody: string;
  emptyIcon: IconName;
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  if (!data.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons
            name={emptyIcon}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyBody}>{emptyBody}</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {data.map((item, index) => (
        <View key={keyExtractor(item)}>{renderItem(item, index)}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
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
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: 8,
    color: colors.onBackground,
    opacity: 0.62,
    lineHeight: 20,
    fontSize: 14,
    maxWidth: 520,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnPressed: { opacity: 0.8 },
  tabs: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  tab: {
    width: 88,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(196,190,180,0.7)',
  },
  tabOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 11,
    textAlign: 'center',
    width: '100%',
  },
  tabTextOn: {
    color: colors.onPrimary,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootLabel: {
    opacity: 0.65,
    color: colors.onBackground,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHead: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: -0.2,
  },
  sectionHint: {
    marginTop: 4,
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
  },
  overview: { gap: 12 },
  heroStat: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
  },
  heroStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatCopy: { flex: 1 },
  heroStatLabel: {
    color: colors.onPrimary,
    opacity: 0.75,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    marginTop: 4,
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -0.8,
  },
  heroStatMeta: {
    marginTop: 4,
    color: colors.onPrimary,
    opacity: 0.8,
    fontSize: 13,
  },
  printDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  printDayBtnPressed: {
    opacity: 0.9,
  },
  printDayBtnDisabled: {
    opacity: 0.7,
  },
  printDayBtnText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  metricCardWarn: {
    backgroundColor: colors.secondaryContainer,
    borderColor: 'transparent',
  },
  metricCardOk: {
    backgroundColor: colors.primaryContainer,
    borderColor: 'transparent',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricIconWarn: {
    backgroundColor: '#F5E6D0',
  },
  metricIconOk: {
    backgroundColor: '#C8E6D0',
  },
  metricLabel: {
    color: colors.onSurface,
    opacity: 0.55,
    fontWeight: '600',
    fontSize: 12,
  },
  metricValue: {
    marginTop: 4,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  metricValueWarn: {
    color: colors.secondary,
  },
  metricMeta: {
    marginTop: 4,
    color: colors.onSurface,
    opacity: 0.45,
    fontSize: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    gap: 10,
  },
  panelTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 2,
  },
  list: { gap: 10 },
  rankedRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rankText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  rankedCopy: { flex: 1, minWidth: 0 },
  rankedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rankedTitle: {
    flex: 1,
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  rankedValue: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 14,
  },
  rankedValueDanger: {
    color: colors.error,
  },
  rankedSubtitle: {
    marginTop: 3,
    opacity: 0.5,
    fontSize: 12,
  },
  barTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  stockRowDanger: {
    backgroundColor: '#FCE8EC',
    borderColor: 'transparent',
  },
  stockCopy: { flex: 1, minWidth: 0 },
  stockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.primaryContainer,
  },
  kindChipDanger: {
    backgroundColor: '#F5D0D6',
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  kindChipTextDanger: {
    color: colors.error,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  emptyBody: {
    marginTop: 6,
    textAlign: 'center',
    color: colors.onSurface,
    opacity: 0.55,
    lineHeight: 20,
    fontSize: 14,
  },
  error: { marginHorizontal: 16 },
});
