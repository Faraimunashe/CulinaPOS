import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { ReceiveStockModal } from '@/components/ReceiveStockModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as categoryService from '@/services/categoryService';
import * as currencyService from '@/services/currencyService';
import * as inventoryService from '@/services/inventoryService';
import * as productService from '@/services/productService';
import { convertFromPrimary } from '@/services/currencyService';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import {
  COMMON_PACK_SIZES,
  type Category,
  type Currency,
  type InventoryItem,
  type TrackingType,
} from '@/types';

const TRACKING_OPTIONS: {
  value: TrackingType;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    value: 'RECIPE',
    title: 'Recipe',
    subtitle: 'Deducts ingredients when sold',
    icon: 'food-variant',
  },
  {
    value: 'DIRECT',
    title: 'Direct stock',
    subtitle: 'Sold as packaged retail items',
    icon: 'package-variant',
  },
];

export function ProductFormScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';
  const actorId = useAuthStore((s) => s.user?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trackingType, setTrackingType] = useState<TrackingType>('RECIPE');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [inventoryItemId, setInventoryItemId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [basePrice, setBasePrice] = useState('');
  const [packSize, setPackSize] = useState('6');
  const [openingQty, setOpeningQty] = useState('');
  const [openingPacks, setOpeningPacks] = useState('');
  const [qtyMode, setQtyMode] = useState<'packs' | 'units'>('packs');
  const [minQty, setMinQty] = useState('12');
  const [categories, setCategories] = useState<Category[]>([]);
  const [primary, setPrimary] = useState<Currency | null>(null);
  const [otherCurrencies, setOtherCurrencies] = useState<Currency[]>([]);
  const [linkedStock, setLinkedStock] = useState<InventoryItem | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackHint, setSnackHint] = useState<string | null>(null);

  const loadLinkedStock = async (invId: number | null) => {
    if (!invId) {
      setLinkedStock(null);
      return;
    }
    setStockLoading(true);
    try {
      const item = await inventoryService.getInventoryItemById(invId);
      setLinkedStock(item);
      if (item) {
        setPackSize(String(item.pack_size || 6));
        setMinQty(String(item.minimum_quantity));
      }
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        const [cats, primaryCurrency, enabled] = await Promise.all([
          categoryService.listCategories({ activeOnly: !isEdit }),
          currencyService.getPrimaryCurrency(),
          currencyService.listCurrencies({ enabledOnly: true }),
        ]);
        if (cancelled) return;

        setCategories(cats);
        setPrimary(primaryCurrency);
        setOtherCurrencies(
          enabled.filter((c) => c.id !== primaryCurrency.id)
        );

        if (isEdit) {
          const product = await productService.getProductById(Number(id));
          if (cancelled) return;
          if (!product) {
            setError('Product not found');
            return;
          }
          setName(product.name);
          setDescription(product.description ?? '');
          setTrackingType(product.tracking_type);
          setCategoryId(product.category_id);
          setInventoryItemId(product.inventory_item_id);
          setActive(product.active === 1);
          setBasePrice(String(product.base_price ?? 0));
          await loadLinkedStock(product.inventory_item_id);
          if (
            product.category_id &&
            !cats.some((c) => c.id === product.category_id)
          ) {
            const orphan = await categoryService.getCategoryById(
              product.category_id
            );
            if (orphan && !cancelled) {
              setCategories((prev) => [...prev, orphan]);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load form');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, isAdmin]);

  const selectedCategoryName = useMemo(() => {
    if (categoryId == null) return 'Uncategorized';
    return categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
  }, [categories, categoryId]);

  const parsedPrice = Number.parseFloat(basePrice);
  const previewRate = Number.isFinite(parsedPrice) ? parsedPrice : 0;
  const packSizeNum = Math.max(1, Number.parseInt(packSize, 10) || 1);
  const openingUnitsTotal = useMemo(() => {
    if (qtyMode === 'packs') {
      const packs = Number.parseFloat(openingPacks);
      return Number.isFinite(packs) && packs > 0 ? packs * packSizeNum : 0;
    }
    const units = Number.parseFloat(openingQty);
    return Number.isFinite(units) && units > 0 ? units : 0;
  }, [qtyMode, openingPacks, openingQty, packSizeNum]);

  const previewName = name.trim() || 'Untitled product';
  const primarySymbol = primary?.symbol ?? '$';
  const primaryName = primary?.name ?? 'Primary';

  if (!isAdmin) return null;

  const handleSave = async () => {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        description,
        tracking_type: trackingType,
        category_id: categoryId,
        active,
        base_price: Number.parseFloat(basePrice),
        inventory_item_id: inventoryItemId,
        retail_stock:
          trackingType === 'DIRECT'
            ? {
                pack_size: packSizeNum,
                opening_quantity: isEdit ? undefined : openingUnitsTotal,
                minimum_quantity: Number.parseFloat(minQty) || 0,
              }
            : undefined,
      };

      if (isEdit) {
        await productService.updateProduct(Number(id), payload, actorId);
      } else {
        await productService.createProduct(payload, actorId);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootLabel}>
          {isEdit ? 'Loading product…' : 'Preparing form…'}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {trackingType === 'RECIPE' ? 'Recipe product' : 'Retail product'}
            </Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            {isEdit ? 'Edit product' : 'New product'}
          </Text>
          <Text style={styles.subtitle}>
            {isEdit
              ? 'Update menu item details, pricing, and stock settings.'
              : 'Create a menu item customers can buy at the till.'}
          </Text>
        </View>

        {!isEdit ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewName} numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={styles.previewMeta}>
                {selectedCategoryName} ·{' '}
                {formatMoney(previewRate, primarySymbol)} ·{' '}
                {trackingType === 'RECIPE' ? 'Recipe' : 'Direct stock'}
              </Text>
            </View>
            <View style={styles.previewChip}>
              <MaterialCommunityIcons
                name={
                  trackingType === 'RECIPE' ? 'food-variant' : 'package-variant'
                }
                size={24}
                color={colors.onPrimary}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Basics</Text>
          <TextInput
            label="Product name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken Burger"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            label="Description (optional)"
            mode="outlined"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            placeholder="Short note for staff"
            style={[styles.input, styles.multiline]}
            outlineStyle={styles.inputOutline}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <Text style={styles.fieldHint}>
            Groups products on the POS for faster picking.
          </Text>
          <View style={styles.chipWrap}>
            <Pressable
              onPress={() => setCategoryId(null)}
              style={[
                styles.choiceChip,
                categoryId == null && styles.choiceChipOn,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipText,
                  categoryId == null && styles.choiceChipTextOn,
                ]}
              >
                Uncategorized
              </Text>
            </Pressable>
            {categories.map((category) => {
              const selected = categoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.choiceChip, selected && styles.choiceChipOn]}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      selected && styles.choiceChipTextOn,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {categories.length === 0 ? (
            <Text style={styles.emptyHint}>
              No categories yet — you can still save as Uncategorized.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Inventory type</Text>
          <Text style={styles.fieldHint}>
            Choose how stock is tracked when this product is sold.
          </Text>
          <View style={styles.trackingList}>
            {TRACKING_OPTIONS.map((option) => {
              const selected = trackingType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setTrackingType(option.value)}
                  style={[
                    styles.trackingCard,
                    selected && styles.trackingCardOn,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.trackingIcon,
                      selected && styles.trackingIconOn,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={22}
                      color={selected ? colors.onPrimary : colors.primary}
                    />
                  </View>
                  <View style={styles.trackingCopy}>
                    <Text
                      style={[
                        styles.trackingTitle,
                        selected && styles.trackingTitleOn,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.trackingSubtitle,
                        selected && styles.trackingSubtitleOn,
                      ]}
                    >
                      {option.subtitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioDot,
                      selected && styles.radioDotOn,
                    ]}
                  >
                    {selected ? <View style={styles.radioDotInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {trackingType === 'RECIPE' && isEdit ? (
            <Button
              mode="contained-tonal"
              icon="food-variant"
              style={styles.recipeButton}
              contentStyle={styles.recipeButtonContent}
              onPress={() =>
                router.push(`/(app)/products/${id}/recipe` as Href)
              }
            >
              Edit recipe ingredients
            </Button>
          ) : null}

          {trackingType === 'RECIPE' && !isEdit ? (
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.infoBannerText}>
                After saving, open the product to add its recipe ingredients.
              </Text>
            </View>
          ) : null}
        </View>

        {trackingType === 'DIRECT' ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Retail stock</Text>
            <Text style={styles.fieldHint}>
              Pack size and opening quantity for this sellable item.
            </Text>

            <Text style={styles.fieldLabel}>Pack size</Text>
            <View style={styles.chipWrap}>
              {COMMON_PACK_SIZES.map((size) => {
                const selected = packSizeNum === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setPackSize(String(size))}
                    style={[styles.choiceChip, selected && styles.choiceChipOn]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        selected && styles.choiceChipTextOn,
                      ]}
                    >
                      {size === 1 ? 'Single' : `${size}-pack`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              label="Custom pack size"
              mode="outlined"
              keyboardType="number-pad"
              value={packSize}
              onChangeText={setPackSize}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            {!isEdit ? (
              <View style={styles.qtyPanel}>
                <Text style={styles.fieldLabel}>Opening quantity</Text>
                <View style={styles.qtyModeRow}>
                  <Pressable
                    onPress={() => setQtyMode('packs')}
                    style={[
                      styles.qtyModeChip,
                      qtyMode === 'packs' && styles.qtyModeChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.qtyModeText,
                        qtyMode === 'packs' && styles.qtyModeTextOn,
                      ]}
                    >
                      Packs
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setQtyMode('units')}
                    style={[
                      styles.qtyModeChip,
                      qtyMode === 'units' && styles.qtyModeChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.qtyModeText,
                        qtyMode === 'units' && styles.qtyModeTextOn,
                      ]}
                    >
                      Units
                    </Text>
                  </Pressable>
                </View>

                {qtyMode === 'packs' ? (
                  <TextInput
                    label="Number of packs"
                    mode="outlined"
                    keyboardType="decimal-pad"
                    value={openingPacks}
                    onChangeText={setOpeningPacks}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                  />
                ) : (
                  <TextInput
                    label="Number of units"
                    mode="outlined"
                    keyboardType="decimal-pad"
                    value={openingQty}
                    onChangeText={setOpeningQty}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                  />
                )}

                <View style={styles.qtyPreview}>
                  <Text style={styles.qtyPreviewLabel}>On hand</Text>
                  <Text style={styles.qtyPreviewValue}>
                    {openingUnitsTotal}{' '}
                    <Text style={styles.qtyPreviewUnit}>units</Text>
                  </Text>
                  {qtyMode === 'packs' && packSizeNum > 1 ? (
                    <Text style={styles.qtyPreviewMeta}>
                      {openingPacks || '0'} × {packSizeNum}-pack
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.onHandBox}>
                {stockLoading ? (
                  <View style={styles.stockLoading}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.stockLoadingText}>
                      Updating stock…
                    </Text>
                  </View>
                ) : linkedStock ? (
                  <View style={styles.onHandTop}>
                    <View style={styles.onHandCopy}>
                      <Text style={styles.onHandLabel}>On hand</Text>
                      <Text style={styles.onHandValue}>
                        {linkedStock.quantity}{' '}
                        <Text style={styles.onHandUnit}>
                          {linkedStock.unit}
                        </Text>
                      </Text>
                      <Text style={styles.onHandMeta}>
                        {inventoryService.formatStockLabel(linkedStock)}
                      </Text>
                    </View>
                    <Button
                      mode="contained"
                      icon="plus"
                      style={styles.addStockBtn}
                      contentStyle={styles.addStockContent}
                      onPress={() => setReceiveOpen(true)}
                    >
                      Add stock
                    </Button>
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>
                    No linked stock record yet. Save to create one.
                  </Text>
                )}
              </View>
            )}

            <TextInput
              label="Low stock alert (units)"
              mode="outlined"
              keyboardType="decimal-pad"
              value={minQty}
              onChangeText={setMinQty}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Pricing</Text>
          <Text style={styles.fieldHint}>
            Enter the price in {primaryName}. Other currencies convert from this
            rate.
          </Text>
          <TextInput
            label={`Price (${primarySymbol})`}
            mode="outlined"
            keyboardType="decimal-pad"
            value={basePrice}
            onChangeText={setBasePrice}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

          {otherCurrencies.length > 0 ? (
            <View style={styles.currencyBox}>
              <Text style={styles.currencyTitle}>Converted prices</Text>
              {otherCurrencies.map((currency) => (
                <View key={currency.id} style={styles.currencyRow}>
                  <Text style={styles.currencyName}>{currency.name}</Text>
                  <Text style={styles.currencyValue}>
                    {formatMoney(
                      convertFromPrimary(previewRate, currency.rate_to_primary),
                      currency.symbol
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.switchCard}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Active on POS</Text>
            <Text style={styles.switchHint}>
              Inactive products stay hidden from cashiers.
            </Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            color={colors.primary}
          />
        </View>

        {error ? (
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}
        {snackHint ? (
          <HelperText type="info" visible>
            {snackHint}
          </HelperText>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading || !name.trim()}
            style={styles.save}
            contentStyle={styles.saveContent}
            labelStyle={styles.saveLabel}
          >
            {loading
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Add product'}
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            disabled={loading}
            textColor={colors.primary}
          >
            Cancel
          </Button>
        </View>

        <ReceiveStockModal
          visible={receiveOpen}
          item={linkedStock}
          actorId={actorId}
          onDismiss={() => setReceiveOpen(false)}
          onSuccess={(message) => {
            setSnackHint(message);
            if (inventoryItemId) void loadLinkedStock(inventoryItemId);
          }}
          onError={setError}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: colors.background,
    flexGrow: 1,
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
  bootLabel: {
    color: colors.onBackground,
    opacity: 0.7,
  },
  hero: {
    marginBottom: 16,
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
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  previewCopy: {
    flex: 1,
  },
  previewLabel: {
    color: colors.onPrimary,
    opacity: 0.7,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewName: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  previewMeta: {
    color: colors.onPrimary,
    opacity: 0.8,
    marginTop: 4,
    fontSize: 13,
  },
  previewChip: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
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
  input: {
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 88,
  },
  inputOutline: {
    borderRadius: 12,
  },
  fieldLabel: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 4,
  },
  fieldHint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  choiceChipOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  choiceChipText: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  choiceChipTextOn: {
    color: colors.primary,
  },
  emptyHint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    marginTop: 4,
  },
  trackingList: {
    gap: 10,
  },
  trackingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  trackingCardOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  trackingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingIconOn: {
    backgroundColor: colors.primary,
  },
  trackingCopy: {
    flex: 1,
  },
  trackingTitle: {
    fontWeight: '800',
    color: colors.onSurface,
    fontSize: 15,
  },
  trackingTitleOn: {
    color: colors.primary,
  },
  trackingSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.6,
  },
  trackingSubtitleOn: {
    color: colors.primary,
    opacity: 0.8,
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotOn: {
    borderColor: colors.primary,
  },
  radioDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  recipeButton: {
    marginTop: 14,
    borderRadius: 12,
  },
  recipeButtonContent: {
    paddingVertical: 4,
  },
  infoBanner: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  qtyPanel: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    marginTop: 4,
  },
  qtyModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  qtyModeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  qtyModeChipOn: {
    backgroundColor: colors.primary,
  },
  qtyModeText: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  qtyModeTextOn: {
    color: colors.onPrimary,
  },
  qtyPreview: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  qtyPreviewLabel: {
    opacity: 0.7,
    fontWeight: '600',
    color: colors.primary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  qtyPreviewValue: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  qtyPreviewUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  qtyPreviewMeta: {
    marginTop: 2,
    opacity: 0.7,
    color: colors.primary,
  },
  onHandBox: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    marginTop: 4,
  },
  onHandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  onHandCopy: {
    flex: 1,
  },
  onHandLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  onHandValue: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  onHandUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  onHandMeta: {
    opacity: 0.75,
    marginTop: 2,
    color: colors.primary,
  },
  addStockBtn: {
    borderRadius: 12,
  },
  addStockContent: {
    paddingHorizontal: 4,
  },
  stockLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  stockLoadingText: {
    color: colors.primary,
    fontWeight: '600',
  },
  currencyBox: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    gap: 8,
  },
  currencyTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyName: {
    color: colors.primary,
    opacity: 0.8,
    fontWeight: '600',
  },
  currencyValue: {
    color: colors.primary,
    fontWeight: '800',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    gap: 12,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 15,
  },
  switchHint: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.55,
  },
  errorText: {
    marginBottom: 4,
  },
  actions: {
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
  },
  save: {
    borderRadius: 14,
  },
  saveContent: {
    paddingVertical: 6,
  },
  saveLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
});
