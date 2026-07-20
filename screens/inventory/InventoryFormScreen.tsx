import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
  Text,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReceiveStockModal } from '@/components/ReceiveStockModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as inventoryService from '@/services/inventoryService';
import { colors } from '@/theme';
import {
  COMMON_PACK_SIZES,
  INVENTORY_UNITS,
  type InventoryUnit,
  type StockMovement,
} from '@/types';

const UNIT_META: Record<
  InventoryUnit,
  { label: string; short: string; hint: string }
> = {
  kg: { label: 'Kilograms', short: 'kg', hint: 'Bulk dry goods' },
  grams: { label: 'Grams', short: 'g', hint: 'Small measures' },
  litres: { label: 'Litres', short: 'L', hint: 'Liquids & oils' },
  ml: { label: 'Millilitres', short: 'ml', hint: 'Sauces & portions' },
  units: { label: 'Units', short: 'u', hint: 'Countable pieces' },
};

function formatMovementDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InventoryFormScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';
  const actorId = useAuthStore((s) => s.user?.id);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('kg');
  const [quantity, setQuantity] = useState('0');
  const [minimum, setMinimum] = useState('0');
  const [cost, setCost] = useState('0');
  const [packSize, setPackSize] = useState('1');
  const [itemKind, setItemKind] = useState<'INGREDIENT' | 'RETAIL'>('INGREDIENT');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [snackHint, setSnackHint] = useState<string | null>(null);

  const reloadItem = async (itemId: number) => {
    const item = await inventoryService.getInventoryItemById(itemId);
    if (!item) return;
    setName(item.name);
    setUnit(item.unit);
    setQuantity(String(item.quantity));
    setMinimum(String(item.minimum_quantity));
    setCost(String(item.cost));
    setPackSize(String(item.pack_size || 1));
    setItemKind(item.item_kind);
    setCurrentItemId(item.id);
    setMovements(await inventoryService.listStockMovements(item.id));
  };

  useEffect(() => {
    if (!isEdit || !isAdmin) return;
    (async () => {
      try {
        await reloadItem(Number(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setBooting(false);
      }
    })();
  }, [id, isEdit, isAdmin]);

  const previewName = name.trim() || 'Untitled ingredient';
  const openingQty = Number.parseFloat(quantity) || 0;
  const unitMeta = UNIT_META[unit];

  const title = useMemo(() => {
    if (!isEdit) return 'New ingredient';
    return itemKind === 'RETAIL' ? 'Retail stock' : 'Ingredient';
  }, [isEdit, itemKind]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        await inventoryService.updateInventoryItem(
          Number(id),
          {
            name,
            unit,
            minimum_quantity: Number.parseFloat(minimum),
            cost: Number.parseFloat(cost),
            pack_size: Number.parseInt(packSize, 10) || 1,
            item_kind: itemKind,
          },
          actorId
        );
      } else {
        await inventoryService.createInventoryItem(
          {
            name,
            unit,
            quantity: Number.parseFloat(quantity),
            minimum_quantity: Number.parseFloat(minimum),
            cost: Number.parseFloat(cost),
            pack_size: 1,
            item_kind: 'INGREDIENT',
          },
          actorId
        );
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
        <Text style={styles.bootLabel}>Loading…</Text>
      </View>
    );
  }

  const liveItem =
    currentItemId != null
      ? {
          id: currentItemId,
          name,
          unit,
          quantity: Number.parseFloat(quantity) || 0,
          minimum_quantity: Number.parseFloat(minimum) || 0,
          cost: Number.parseFloat(cost) || 0,
          pack_size: Number.parseInt(packSize, 10) || 1,
          item_kind: itemKind,
          created_at: '',
          updated_at: '',
        }
      : null;

  const showUnitPicker = itemKind === 'INGREDIENT' || !isEdit;

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
              {itemKind === 'RETAIL' ? 'Retail' : 'Ingredient'}
            </Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            {title}
          </Text>
          {!isEdit ? (
            <Text style={styles.subtitle}>
              Add a raw material used in recipes — potatoes, oil, flour, and so
              on.
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Update details, thresholds, and cost. Stock changes use Add stock
              or Adjust.
            </Text>
          )}
        </View>

        {!isEdit ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewName} numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={styles.previewMeta}>
                {openingQty} {unitMeta.short} on hand · alert at {minimum || '0'}{' '}
                {unitMeta.short}
              </Text>
            </View>
            <View style={styles.previewChip}>
              <Text style={styles.previewChipText}>{unitMeta.short}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Basics</Text>
          <TextInput
            label="Ingredient name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken fillet"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {showUnitPicker ? (
            <View style={styles.unitBlock}>
              <Text style={styles.fieldLabel}>Unit of measure</Text>
              <Text style={styles.fieldHint}>{unitMeta.hint}</Text>
              <View style={styles.unitGrid}>
                {INVENTORY_UNITS.map((option) => {
                  const selected = unit === option;
                  const meta = UNIT_META[option];
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setUnit(option)}
                      style={[styles.unitChip, selected && styles.unitChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.unitChipShort,
                          selected && styles.unitChipShortOn,
                        ]}
                      >
                        {meta.short}
                      </Text>
                      <Text
                        style={[
                          styles.unitChipLabel,
                          selected && styles.unitChipLabelOn,
                        ]}
                        numberOfLines={1}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isEdit && itemKind === 'RETAIL' ? (
            <View style={styles.unitBlock}>
              <Text style={styles.fieldLabel}>Pack size</Text>
              <Text style={styles.fieldHint}>
                How many units come in one pack when you receive stock.
              </Text>
              <View style={styles.packRow}>
                {COMMON_PACK_SIZES.map((size) => {
                  const selected = Number.parseInt(packSize, 10) === size;
                  return (
                    <Pressable
                      key={size}
                      onPress={() => setPackSize(String(size))}
                      style={[styles.packChip, selected && styles.packChipOn]}
                    >
                      <Text
                        style={[
                          styles.packChipText,
                          selected && styles.packChipTextOn,
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
            </View>
          ) : null}
        </View>

        {!isEdit ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Opening stock</Text>
            <Text style={styles.fieldHint}>
              Optional — leave at 0 and add stock later from the list.
            </Text>
            <TextInput
              label={`Quantity (${unitMeta.short})`}
              mode="outlined"
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
          </View>
        ) : (
          <View style={styles.onHand}>
            <View style={styles.onHandTop}>
              <View>
                <Text style={styles.onHandLabel}>On hand</Text>
                <Text style={styles.onHandValue}>
                  {quantity}{' '}
                  <Text style={styles.onHandUnit}>{unitMeta.short}</Text>
                </Text>
                {itemKind === 'RETAIL' && Number.parseInt(packSize, 10) > 1 ? (
                  <Text style={styles.onHandMeta}>
                    ≈{' '}
                    {(
                      (Number.parseFloat(quantity) || 0) /
                      (Number.parseInt(packSize, 10) || 1)
                    ).toFixed(1)}{' '}
                    packs of {packSize}
                  </Text>
                ) : null}
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
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Alerts & cost</Text>
          <View style={styles.rowFields}>
            <TextInput
              label={`Low stock (${unitMeta.short})`}
              mode="outlined"
              keyboardType="decimal-pad"
              value={minimum}
              onChangeText={setMinimum}
              style={[styles.input, styles.halfInput]}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              label="Cost / unit"
              mode="outlined"
              keyboardType="decimal-pad"
              value={cost}
              onChangeText={setCost}
              style={[styles.input, styles.halfInput]}
              outlineStyle={styles.inputOutline}
            />
          </View>
          <Text style={styles.fieldHint}>
            You’ll get a low-stock flag when quantity drops to the alert level.
          </Text>
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
            {isEdit ? 'Save changes' : 'Add ingredient'}
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

        {isEdit && movements.length > 0 ? (
          <View style={styles.history}>
            <Text style={styles.historyTitle}>Recent movements</Text>
            <FlatList
              data={movements}
              scrollEnabled={false}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={styles.historyDivider} />}
              renderItem={({ item }) => {
                const positive = item.quantity_change > 0;
                return (
                  <View style={styles.historyRow}>
                    <View
                      style={[
                        styles.historyDot,
                        {
                          backgroundColor: positive
                            ? colors.success
                            : colors.secondary,
                        },
                      ]}
                    />
                    <View style={styles.historyBody}>
                      <View style={styles.historyTop}>
                        <Text style={styles.historyType}>
                          {item.movement_type}
                        </Text>
                        <Text
                          style={[
                            styles.historyDelta,
                            {
                              color: positive
                                ? colors.success
                                : colors.secondary,
                            },
                          ]}
                        >
                          {positive ? '+' : ''}
                          {item.quantity_change}
                        </Text>
                      </View>
                      <Text style={styles.historyDesc}>
                        {item.quantity_before} → {item.quantity_after}
                        {item.reason ? ` · ${item.reason}` : ''}
                      </Text>
                      <Text style={styles.historyDate}>
                        {formatMovementDate(item.created_at)}
                        {item.user_name ? ` · ${item.user_name}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        ) : null}

        <ReceiveStockModal
          visible={receiveOpen}
          item={liveItem}
          actorId={actorId}
          onDismiss={() => setReceiveOpen(false)}
          onSuccess={(message) => {
            setSnackHint(message);
            if (currentItemId) void reloadItem(currentItemId);
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
  previewChipText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
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
    marginBottom: 4,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 12,
  },
  fieldLabel: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  fieldHint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  unitBlock: {
    marginTop: 12,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    width: '31.5%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  unitChipOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  unitChipShort: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 2,
  },
  unitChipShortOn: {
    color: colors.primary,
  },
  unitChipLabel: {
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.65,
  },
  unitChipLabelOn: {
    color: colors.primary,
    opacity: 0.9,
    fontWeight: '600',
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
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
  },
  packChipOn: {
    backgroundColor: colors.primary,
  },
  packChipText: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  packChipTextOn: {
    color: colors.onPrimary,
  },
  onHand: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  onHandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  onHandLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  onHandValue: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  onHandUnit: {
    fontSize: 18,
    fontWeight: '700',
  },
  onHandMeta: {
    marginTop: 2,
    opacity: 0.7,
    color: colors.primary,
  },
  addStockBtn: {
    borderRadius: 12,
  },
  addStockContent: {
    paddingHorizontal: 4,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
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
  history: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  historyTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 12,
  },
  historyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outline,
    marginVertical: 12,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  historyBody: {
    flex: 1,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyType: {
    fontWeight: '700',
    color: colors.onSurface,
    textTransform: 'capitalize',
  },
  historyDelta: {
    fontWeight: '800',
    fontSize: 15,
  },
  historyDesc: {
    marginTop: 2,
    color: colors.onSurface,
    opacity: 0.7,
    fontSize: 13,
  },
  historyDate: {
    marginTop: 4,
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.45,
  },
});
