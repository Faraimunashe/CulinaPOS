import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  FAB,
  HelperText,
  Searchbar,
  Snackbar,
  Text,
} from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { AdjustStockModal } from '@/components/AdjustStockModal';
import { ReceiveStockModal } from '@/components/ReceiveStockModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as inventoryService from '@/services/inventoryService';
import { colors } from '@/theme';
import type { InventoryItem, InventoryItemKind } from '@/types';

type TabKey = 'RETAIL' | 'INGREDIENT';

export function InventoryListScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<TabKey>('RETAIL');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<InventoryItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await inventoryService.listInventoryItems({
        kind: tab,
      });
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  if (!isAdmin) return null;

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.linked_product_name ?? '').toLowerCase().includes(q)
    );
  });

  const lowCount = items.filter((i) => inventoryService.isLowStock(i)).length;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Inventory
        </Text>
        {lowCount > 0 ? (
          <View style={styles.lowBanner}>
            <Text style={styles.lowBannerText}>{lowCount} low stock</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['RETAIL', 'Retail'],
            ['INGREDIENT', 'Ingredients'],
          ] as [InventoryItemKind, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Searchbar
        placeholder="Search…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        inputStyle={styles.searchInput}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {tab === 'RETAIL' ? 'No retail stock' : 'No ingredients'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const low = inventoryService.isLowStock(item);
            return (
              <Pressable
                style={[styles.card, low && styles.cardLow]}
                onPress={() =>
                  router.push(`/(app)/inventory/${item.id}` as Href)
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardText}>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {item.name}
                    </Text>
                    {item.linked_product_name ? (
                      <Text style={styles.cardMeta}>
                        {item.linked_product_name}
                      </Text>
                    ) : (
                      <Text style={styles.cardMeta}>
                        {item.item_kind === 'RETAIL'
                          ? `Pack: ${item.pack_size}`
                          : item.unit}
                      </Text>
                    )}
                  </View>
                  <View style={styles.qtyBlock}>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <Text style={styles.qtyUnit}>{item.unit}</Text>
                  </View>
                </View>

                <Text style={styles.stockLine}>
                  {inventoryService.formatStockLabel(item)}
                  {low ? ' · Low' : ''}
                </Text>

                <View style={styles.cardActions}>
                  <Button
                    mode="contained"
                    compact
                    icon="plus"
                    onPress={() => setReceiveTarget(item)}
                    style={styles.addBtn}
                  >
                    Add stock
                  </Button>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => setAdjustTarget(item)}
                  >
                    Adjust
                  </Button>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      {tab === 'INGREDIENT' ? (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push('/(app)/inventory/new' as Href)}
        />
      ) : null}

      <ReceiveStockModal
        visible={!!receiveTarget}
        item={receiveTarget}
        actorId={actorId}
        onDismiss={() => setReceiveTarget(null)}
        onSuccess={(message) => {
          setSnack(message);
          void load();
        }}
        onError={setError}
      />

      <AdjustStockModal
        visible={!!adjustTarget}
        item={adjustTarget}
        actorId={actorId}
        onDismiss={() => setAdjustTarget(null)}
        onSuccess={(message) => {
          setSnack(message);
          void load();
        }}
        onError={setError}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2800}>
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
  lowBanner: {
    marginTop: 12,
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  lowBannerText: {
    color: colors.secondary,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  tabTextOn: {
    color: colors.onPrimary,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  searchInput: {
    minHeight: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 12,
  },
  loader: { marginTop: 48 },
  empty: {
    marginTop: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardLow: {
    borderColor: colors.secondary,
    backgroundColor: '#FFFBF5',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardMeta: {
    marginTop: 2,
    opacity: 0.6,
    fontSize: 13,
  },
  qtyBlock: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  qtyValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 32,
  },
  qtyUnit: {
    fontSize: 12,
    opacity: 0.65,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stockLine: {
    marginTop: 10,
    opacity: 0.7,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  addBtn: {
    borderRadius: 10,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: colors.primary,
  },
  error: { marginHorizontal: 16 },
});
