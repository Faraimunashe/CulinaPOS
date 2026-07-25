import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
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
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckoutModal } from '@/screens/pos/CheckoutModal';
import { PosCartPanel } from '@/screens/pos/PosCartPanel';
import { ProductTile } from '@/screens/pos/ProductTile';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import * as categoryService from '@/services/categoryService';
import * as currencyService from '@/services/currencyService';
import * as orderService from '@/services/orderService';
import * as paymentMethodService from '@/services/paymentMethodService';
import { useCartStore } from '@/stores/cartStore';
import { colors } from '@/theme';
import type {
  CartLine,
  Category,
  Currency,
  Order,
  PaymentMethod,
  PosProduct,
} from '@/types';

function unitPriceForCurrency(
  product: PosProduct,
  currencyId: number | null
): number {
  if (currencyId == null) {
    const primary = product.prices?.find((p) => p.is_primary);
    return primary?.price ?? product.base_price ?? 0;
  }
  const match = product.prices?.find((p) => p.currency_id === currencyId);
  return match?.price ?? product.base_price ?? 0;
}

export function PosScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { useSplitPosLayout, isTablet } = useResponsiveLayout();

  const currencyId = useCartStore((s) => s.currencyId);
  const paymentMethodId = useCartStore((s) => s.paymentMethodId);
  const setCurrencyId = useCartStore((s) => s.setCurrencyId);
  const setPaymentMethodId = useCartStore((s) => s.setPaymentMethodId);
  const addProduct = useCartStore((s) => s.addProduct);
  const itemCount = useCartStore((s) => s.itemCount);
  const lines = useCartStore((s) => s.lines);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [snackIsError, setSnackIsError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, currs, payments] = await Promise.all([
        categoryService.listCategories({ activeOnly: true }),
        currencyService.listCurrencies({ enabledOnly: true }),
        paymentMethodService.listPaymentMethods({ enabledOnly: true }),
      ]);
      setCategories(cats);
      setCurrencies(currs);
      setPaymentMethods(payments);

      const state = useCartStore.getState();
      if (state.currencyId == null && currs.length > 0) {
        const primary = await currencyService.getPrimaryCurrency();
        const match = currs.find((c) => c.id === primary.id) ?? currs[0];
        setCurrencyId(match.id);
      }
      if (state.paymentMethodId == null && payments.length > 0) {
        setPaymentMethodId(payments[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load POS');
    } finally {
      setLoading(false);
    }
  }, [setCurrencyId, setPaymentMethodId]);

  const refreshProducts = useCallback(async () => {
    try {
      const rows = await orderService.listPosProducts({
        search,
        categoryId,
      });
      setProducts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    }
  }, [search, categoryId]);

  useFocusEffect(
    useCallback(() => {
      void loadBootstrap();
    }, [loadBootstrap])
  );

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  // When currency changes, refresh line prices
  useEffect(() => {
    if (currencyId == null || products.length === 0) return;
    const { lines: cartLines } = useCartStore.getState();
    if (!cartLines.length) return;
    for (const line of cartLines) {
      const product = products.find((p) => p.id === line.product_id);
      if (!product) continue;
      const price = unitPriceForCurrency(product, currencyId);
      useCartStore.setState({
        lines: useCartStore.getState().lines.map((l) =>
          l.product_id === line.product_id
            ? {
                ...l,
                unit_price: price,
                max_quantity: product.max_quantity,
              }
            : l
        ),
      });
    }
  }, [currencyId, products]);

  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.id === currencyId) ?? currencies[0],
    [currencies, currencyId]
  );
  const currencySymbol = selectedCurrency?.symbol ?? '$';
  const selectedPayment = useMemo(
    () =>
      paymentMethods.find((p) => p.id === paymentMethodId) ??
      paymentMethods[0],
    [paymentMethods, paymentMethodId]
  );

  const columns = useSplitPosLayout ? 3 : width >= 700 ? 3 : 2;
  const count = itemCount();

  const showInsufficientStock = (
    item: Pick<
      CartLine,
      'product_name' | 'limiting_stock_name' | 'max_quantity'
    >
  ) => {
    const stockName = item.limiting_stock_name ?? item.product_name;
    const availability =
      item.max_quantity <= 0
        ? 'out of stock'
        : `only ${item.max_quantity} unit${
            item.max_quantity === 1 ? '' : 's'
          } of ${item.product_name} available`;
    setSnackIsError(true);
    setSnack(`Insufficient ${stockName}: ${availability}.`);
  };

  const handleAdd = (product: PosProduct) => {
    const inCartQty =
      useCartStore
        .getState()
        .lines.find((line) => line.product_id === product.id)?.quantity ?? 0;
    if (!product.in_stock || inCartQty >= product.max_quantity) {
      showInsufficientStock({
        product_name: product.name,
        limiting_stock_name: product.limiting_stock_name,
        max_quantity: product.max_quantity,
      });
      return;
    }
    const price = unitPriceForCurrency(product, currencyId);
    addProduct(product, price);
  };

  const handleCheckout = () => {
    if (!lines.length) return;
    if (currencyId == null || paymentMethodId == null) {
      setSnackIsError(true);
      setSnack('Select currency and payment method');
      return;
    }
    setCheckoutOpen(true);
  };

  const handleCompleted = (order: Order) => {
    setSnackIsError(false);
    setSnack(`Order #${order.order_number} completed`);
    setCartOpen(false);
    void refreshProducts();
  };

  const cartPanel = (
    <PosCartPanel
      currencies={currencies}
      paymentMethods={paymentMethods}
      currencySymbol={currencySymbol}
      onCheckout={handleCheckout}
      compact={!useSplitPosLayout}
    />
  );

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.main,
          useSplitPosLayout && styles.mainSplit,
        ]}
      >
        <View style={styles.catalog}>
          <View style={styles.toolbar}>
            <Searchbar
              placeholder="Search products…"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              inputStyle={styles.searchInput}
            />
            {!useSplitPosLayout ? (
              <Pressable
                onPress={() => setCartOpen(true)}
                style={({ pressed }) => [
                  styles.cartFab,
                  pressed && styles.cartFabPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open cart"
              >
                <MaterialCommunityIcons
                  name="cart"
                  size={22}
                  color={colors.onPrimary}
                />
                {count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.categories}>
            <FlatList
              horizontal
              data={[{ id: -1, name: 'All' } as Category, ...categories]}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => {
                const selected =
                  item.id === -1 ? categoryId == null : categoryId === item.id;
                return (
                  <Pressable
                    onPress={() =>
                      setCategoryId(item.id === -1 ? null : item.id)
                    }
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selected && styles.categoryTextOn,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {loading && products.length === 0 ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : (
            <FlatList
              data={products}
              key={columns}
              keyExtractor={(item) => String(item.id)}
              numColumns={columns}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptyBody}>
                    Try another search or category.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const price = unitPriceForCurrency(item, currencyId);
                const inCartQty =
                  lines.find((l) => l.product_id === item.id)?.quantity ?? 0;
                return (
                  <View style={styles.tileWrap}>
                    <ProductTile
                      product={item}
                      price={price}
                      currencySymbol={currencySymbol}
                      inCartQty={inCartQty}
                      onPress={() => handleAdd(item)}
                    />
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
        </View>

        {useSplitPosLayout ? (
          <View style={[styles.cartPane, isTablet && styles.cartPaneWide]}>
            {cartPanel}
          </View>
        ) : null}
      </View>

      {!useSplitPosLayout ? (
        <Modal
          visible={cartOpen}
          animationType="slide"
          onRequestClose={() => setCartOpen(false)}
          supportedOrientations={[
            'portrait',
            'portrait-upside-down',
            'landscape',
            'landscape-left',
            'landscape-right',
          ]}
        >
          <View
            style={[
              styles.mobileCart,
              {
                paddingTop: Math.max(insets.top, 8),
                paddingBottom: Math.max(insets.bottom, 0),
              },
            ]}
          >
            <View style={styles.mobileCartHeader}>
              <Text style={styles.mobileCartTitle}>Cart</Text>
              <Pressable
                onPress={() => setCartOpen(false)}
                style={styles.closeCartBtn}
                accessibilityLabel="Close cart"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.primary}
                />
              </Pressable>
            </View>
            {cartPanel}
          </View>
        </Modal>
      ) : null}

      <CheckoutModal
        visible={checkoutOpen}
        currencySymbol={currencySymbol}
        paymentMethodName={selectedPayment?.name ?? 'Payment'}
        onDismiss={() => setCheckoutOpen(false)}
        onCompleted={handleCompleted}
      />

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={3500}
        style={snackIsError ? styles.errorSnackbar : undefined}
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
  main: {
    flex: 1,
  },
  mainSplit: {
    flexDirection: 'row',
  },
  catalog: {
    flex: 1,
    minWidth: 0,
  },
  cartPane: {
    width: 340,
  },
  cartPaneWide: {
    width: 380,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    elevation: 0,
  },
  searchInput: {
    minHeight: 0,
  },
  cartFab: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartFabPressed: {
    opacity: 0.88,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  categories: {
    marginTop: 10,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.outline,
    marginRight: 8,
  },
  categoryChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 13,
  },
  categoryTextOn: {
    color: colors.onPrimary,
  },
  loader: {
    marginTop: 48,
  },
  grid: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  tileWrap: {
    flex: 1,
  },
  empty: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  emptyBody: {
    marginTop: 6,
    opacity: 0.55,
  },
  error: {
    marginHorizontal: 16,
  },
  errorSnackbar: {
    backgroundColor: colors.error,
  },
  mobileCart: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  mobileCartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mobileCartTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 20,
  },
  closeCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
