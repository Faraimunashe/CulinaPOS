import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Searchbar,
  Snackbar,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { ReceiveStockModal } from '@/components/ReceiveStockModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as inventoryService from '@/services/inventoryService';
import * as productService from '@/services/productService';
import { formatPrimaryPrice } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { InventoryItem, Product } from '@/types';

export function ProductsListScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [receiveItem, setReceiveItem] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await productService.listProducts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
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

  const filtered = products.filter((product) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) ||
      (product.category_name ?? '').toLowerCase().includes(q)
    );
  });

  const openAddStock = async (product: Product) => {
    if (!product.inventory_item_id) {
      setError('No stock record for this product');
      return;
    }
    const item = await inventoryService.getInventoryItemById(
      product.inventory_item_id
    );
    if (!item) {
      setError('Stock record not found');
      return;
    }
    setReceiveItem(item);
  };

  const goNewProduct = () => router.push('/(app)/products/new' as Href);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Text variant="headlineSmall" style={styles.heroTitle}>
            Products
          </Text>
          <Pressable
            onPress={goNewProduct}
            style={({ pressed }) => [
              styles.addProductBtn,
              pressed && styles.addProductBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add product"
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={colors.onPrimary}
            />
            <Text style={styles.addProductBtnText}>Add product</Text>
          </Pressable>
        </View>
      </View>

      <Searchbar
        placeholder="Search…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
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
                No products yet
              </Text>
              <Pressable
                onPress={goNewProduct}
                style={({ pressed }) => [
                  styles.addProductBtn,
                  styles.emptyCta,
                  pressed && styles.addProductBtnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color={colors.onPrimary}
                />
                <Text style={styles.addProductBtnText}>Add product</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const isDirect = item.tracking_type === 'DIRECT';
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/(app)/products/${item.id}` as Href)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardText}>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.category_name ?? 'Uncategorized'} ·{' '}
                      {isDirect ? 'Direct' : 'Recipe'} ·{' '}
                      {formatPrimaryPrice(item.prices ?? [])}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      item.active === 1 ? styles.badgeOn : styles.badgeOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.active !== 1 && styles.badgeTextOff,
                      ]}
                    >
                      {item.active === 1 ? 'Active' : 'Off'}
                    </Text>
                  </View>
                </View>

                {isDirect ? (
                  <View style={styles.stockRow}>
                    <Text style={styles.stockLabel}>On hand</Text>
                    <Text style={styles.stockValue}>
                      {item.inventory_quantity ?? 0}{' '}
                      {item.inventory_unit ?? 'units'}
                      {item.inventory_pack_size && item.inventory_pack_size > 1
                        ? ` · ${item.inventory_pack_size}-packs`
                        : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {isDirect ? (
                    <Button
                      mode="contained"
                      compact
                      icon="plus"
                      onPress={() => void openAddStock(item)}
                      style={styles.addBtn}
                    >
                      Add stock
                    </Button>
                  ) : (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() =>
                        router.push(
                          `/(app)/products/${item.id}/recipe` as Href
                        )
                      }
                    >
                      Recipe
                    </Button>
                  )}
                  <Button
                    mode="outlined"
                    compact
                    onPress={() =>
                      router.push(`/(app)/products/${item.id}` as Href)
                    }
                  >
                    Edit
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

      <ReceiveStockModal
        visible={!!receiveItem}
        item={receiveItem}
        actorId={actorId}
        onDismiss={() => setReceiveItem(null)}
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
    paddingBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
    flex: 1,
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addProductBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  addProductBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  search: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  loader: { marginTop: 40 },
  empty: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontWeight: '700',
  },
  cardMeta: {
    marginTop: 4,
    opacity: 0.65,
    fontSize: 13,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOn: {
    backgroundColor: colors.primaryContainer,
  },
  badgeOff: {
    backgroundColor: colors.surfaceVariant,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeTextOff: {
    color: colors.onSurface,
    opacity: 0.6,
  },
  stockRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    opacity: 0.6,
    fontWeight: '600',
  },
  stockValue: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  addBtn: {
    borderRadius: 10,
  },
  error: { marginHorizontal: 16 },
});
