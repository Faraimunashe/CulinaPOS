import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Menu,
  RadioButton,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
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
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLinkedStock = async (invId: number | null) => {
    if (!invId) {
      setLinkedStock(null);
      return;
    }
    const item = await inventoryService.getInventoryItemById(invId);
    setLinkedStock(item);
    if (item) {
      setPackSize(String(item.pack_size || 6));
      setMinQty(String(item.minimum_quantity));
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [cats, primaryCurrency, enabled] = await Promise.all([
          categoryService.listCategories({ activeOnly: !isEdit }),
          currencyService.getPrimaryCurrency(),
          currencyService.listCurrencies({ enabledOnly: true }),
        ]);
        setCategories(cats);
        setPrimary(primaryCurrency);
        setOtherCurrencies(
          enabled.filter((c) => c.id !== primaryCurrency.id)
        );

        if (isEdit) {
          const product = await productService.getProductById(Number(id));
          if (!product) {
            setError('Product not found');
            setBooting(false);
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
            if (orphan) setCategories((prev) => [...prev, orphan]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setBooting(false);
      }
    })();
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
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.title}>
        {isEdit ? 'Edit product' : 'New product'}
      </Text>

      <TextInput
        label="Name"
        mode="outlined"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        label="Description"
        mode="outlined"
        multiline
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      <Text variant="titleSmall" style={styles.section}>
        Category
      </Text>
      <Menu
        visible={categoryMenuOpen}
        onDismiss={() => setCategoryMenuOpen(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setCategoryMenuOpen(true)}
            style={styles.menuButton}
            contentStyle={styles.menuButtonContent}
          >
            {selectedCategoryName}
          </Button>
        }
      >
        <Menu.Item
          onPress={() => {
            setCategoryId(null);
            setCategoryMenuOpen(false);
          }}
          title="Uncategorized"
        />
        {categories.map((category) => (
          <Menu.Item
            key={category.id}
            onPress={() => {
              setCategoryId(category.id);
              setCategoryMenuOpen(false);
            }}
            title={category.name}
          />
        ))}
      </Menu>

      <Text variant="titleSmall" style={styles.section}>
        Type
      </Text>
      <RadioButton.Group
        onValueChange={(value) => setTrackingType(value as TrackingType)}
        value={trackingType}
      >
        <View style={styles.radioBox}>
          <RadioButton.Item label="Recipe" value="RECIPE" />
          <RadioButton.Item label="Direct stock" value="DIRECT" />
        </View>
      </RadioButton.Group>

      {trackingType === 'DIRECT' ? (
        <View style={styles.retailPanel}>
          <Text variant="titleSmall" style={styles.retailTitle}>
            Stock
          </Text>

          <Text variant="labelLarge" style={styles.label}>
            Pack size
          </Text>
          <View style={styles.packRow}>
            {COMMON_PACK_SIZES.map((size) => (
              <Pressable
                key={size}
                onPress={() => setPackSize(String(size))}
                style={[
                  styles.packChip,
                  packSizeNum === size && styles.packChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.packText,
                    packSizeNum === size && styles.packTextOn,
                  ]}
                >
                  {size === 1 ? 'Single' : `${size}-pack`}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            label="Pack size"
            mode="outlined"
            keyboardType="number-pad"
            value={packSize}
            onChangeText={setPackSize}
            style={styles.input}
          />

          {!isEdit ? (
            <View style={styles.qtyPanel}>
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
                  label="Packs"
                  mode="outlined"
                  keyboardType="decimal-pad"
                  value={openingPacks}
                  onChangeText={setOpeningPacks}
                  style={styles.input}
                />
              ) : (
                <TextInput
                  label="Units"
                  mode="outlined"
                  keyboardType="decimal-pad"
                  value={openingQty}
                  onChangeText={setOpeningQty}
                  style={styles.input}
                />
              )}

              <View style={styles.qtyPreview}>
                <Text style={styles.qtyPreviewLabel}>On hand</Text>
                <Text style={styles.qtyPreviewValue}>
                  {openingUnitsTotal} units
                </Text>
                {qtyMode === 'packs' && packSizeNum > 1 ? (
                  <Text style={styles.qtyPreviewMeta}>
                    {openingPacks || '0'} × {packSizeNum}-pack
                  </Text>
                ) : null}
              </View>
            </View>
          ) : linkedStock ? (
            <View style={styles.onHandBox}>
              <Text style={styles.onHandLabel}>On hand</Text>
              <Text style={styles.onHandValue}>
                {linkedStock.quantity} {linkedStock.unit}
              </Text>
              <Text style={styles.onHandMeta}>
                {inventoryService.formatStockLabel(linkedStock)}
              </Text>
              <Button
                mode="contained"
                icon="plus"
                style={styles.addStockBtn}
                onPress={() => setReceiveOpen(true)}
              >
                Add stock
              </Button>
            </View>
          ) : null}

          <TextInput
            label="Low stock alert"
            mode="outlined"
            keyboardType="decimal-pad"
            value={minQty}
            onChangeText={setMinQty}
            style={styles.input}
          />
        </View>
      ) : null}

      {trackingType === 'RECIPE' && isEdit ? (
        <Button
          mode="contained-tonal"
          icon="food-variant"
          style={styles.recipeButton}
          onPress={() => router.push(`/(app)/products/${id}/recipe` as Href)}
        >
          Recipe
        </Button>
      ) : null}

      <Text variant="titleSmall" style={styles.section}>
        Price ({primary?.name ?? 'Primary'})
      </Text>
      <TextInput
        label={`Price (${primary?.symbol ?? ''})`}
        mode="outlined"
        keyboardType="decimal-pad"
        value={basePrice}
        onChangeText={setBasePrice}
        style={styles.input}
      />

      {otherCurrencies.length > 0 ? (
        <View style={styles.previewBox}>
          <Text variant="labelLarge" style={styles.previewTitle}>
            Other currencies
          </Text>
          {otherCurrencies.map((currency) => (
            <Text key={currency.id} variant="bodyMedium">
              {currency.name}:{' '}
              {formatMoney(
                convertFromPrimary(previewRate, currency.rate_to_primary),
                currency.symbol
              )}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.switchRow}>
        <Text variant="bodyLarge">Active</Text>
        <Switch value={active} onValueChange={setActive} />
      </View>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        disabled={loading}
        style={styles.save}
      >
        Save
      </Button>
      <Button onPress={() => router.back()} disabled={loading}>
        Cancel
      </Button>

      <ReceiveStockModal
        visible={receiveOpen}
        item={linkedStock}
        actorId={actorId}
        onDismiss={() => setReceiveOpen(false)}
        onSuccess={() => {
          if (inventoryItemId) void loadLinkedStock(inventoryItemId);
        }}
        onError={setError}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 20,
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
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.onSurface,
    fontWeight: '700',
  },
  label: {
    marginBottom: 8,
  },
  menuButton: {
    marginBottom: 12,
    borderColor: colors.outline,
  },
  menuButtonContent: {
    justifyContent: 'flex-start',
  },
  radioBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  retailPanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  retailTitle: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: 14,
  },
  qtyPanel: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
  },
  qtyPreviewValue: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  qtyPreviewMeta: {
    marginTop: 2,
    opacity: 0.7,
  },
  packRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  packChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
  },
  packChipOn: {
    backgroundColor: colors.primaryContainer,
  },
  packText: {
    fontWeight: '700',
  },
  packTextOn: {
    color: colors.primary,
  },
  onHandBox: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  onHandLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  onHandValue: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  onHandMeta: {
    opacity: 0.75,
    marginTop: 2,
  },
  addStockBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 10,
  },
  recipeButton: {
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  previewTitle: {
    marginBottom: 4,
    color: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  save: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
});
