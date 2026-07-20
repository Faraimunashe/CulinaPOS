import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  List,
  Menu,
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
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
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
        <Text>Loading…</Text>
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

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.title}>
        {isEdit
          ? itemKind === 'RETAIL'
            ? 'Retail stock'
            : 'Ingredient'
          : 'New ingredient'}
      </Text>

      <TextInput
        label="Name"
        mode="outlined"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      {itemKind === 'INGREDIENT' || !isEdit ? (
        <>
          <Text variant="titleSmall" style={styles.section}>
            Unit
          </Text>
          <Menu
            visible={unitMenuOpen}
            onDismiss={() => setUnitMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setUnitMenuOpen(true)}
                style={styles.menuButton}
              >
                {unit}
              </Button>
            }
          >
            {INVENTORY_UNITS.map((option) => (
              <Menu.Item
                key={option}
                onPress={() => {
                  setUnit(option);
                  setUnitMenuOpen(false);
                }}
                title={option}
              />
            ))}
          </Menu>
        </>
      ) : null}

      {isEdit && itemKind === 'RETAIL' ? (
        <>
          <Text variant="titleSmall" style={styles.section}>
            Pack size
          </Text>
          <View style={styles.packRow}>
            {COMMON_PACK_SIZES.map((size) => (
              <Button
                key={size}
                mode={
                  Number.parseInt(packSize, 10) === size
                    ? 'contained'
                    : 'outlined'
                }
                compact
                onPress={() => setPackSize(String(size))}
              >
                {size === 1 ? 'Single' : `${size}`}
              </Button>
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
        </>
      ) : null}

      {!isEdit ? (
        <TextInput
          label="Opening quantity"
          mode="outlined"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          style={styles.input}
        />
      ) : (
        <View style={styles.onHand}>
          <Text style={styles.onHandLabel}>On hand</Text>
          <Text style={styles.onHandValue}>
            {quantity} {unit}
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
          <Button
            mode="contained"
            icon="plus"
            style={styles.addStockBtn}
            onPress={() => setReceiveOpen(true)}
          >
            Add stock
          </Button>
        </View>
      )}

      <TextInput
        label="Low stock alert"
        mode="outlined"
        keyboardType="decimal-pad"
        value={minimum}
        onChangeText={setMinimum}
        style={styles.input}
      />
      <TextInput
        label="Cost per unit"
        mode="outlined"
        keyboardType="decimal-pad"
        value={cost}
        onChangeText={setCost}
        style={styles.input}
      />

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      {snackHint ? (
        <HelperText type="info" visible>
          {snackHint}
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

      {isEdit && movements.length > 0 ? (
        <View style={styles.history}>
          <Text variant="titleMedium" style={styles.historyTitle}>
            Recent movements
          </Text>
          <FlatList
            data={movements}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <List.Item
                title={`${item.movement_type}: ${item.quantity_change > 0 ? '+' : ''}${item.quantity_change}`}
                description={`${item.quantity_before} → ${item.quantity_after}${
                  item.reason ? ` · ${item.reason}` : ''
                }`}
              />
            )}
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
    marginBottom: 8,
  },
  menuButton: {
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  packRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  onHand: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  onHandLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  onHandValue: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  onHandMeta: {
    marginTop: 2,
    opacity: 0.75,
  },
  addStockBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 10,
  },
  save: {
    marginTop: 8,
    marginBottom: 8,
  },
  history: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyTitle: {
    padding: 16,
    paddingBottom: 4,
    color: colors.primary,
    fontWeight: '700',
  },
});
