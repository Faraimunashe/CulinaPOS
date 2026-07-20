import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  IconButton,
  Menu,
  Text,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as inventoryService from '@/services/inventoryService';
import * as productService from '@/services/productService';
import * as recipeService from '@/services/recipeService';
import { colors } from '@/theme';
import type { InventoryItem } from '@/types';

interface DraftLine {
  key: string;
  inventory_item_id: number | null;
  quantity: string;
}

export function RecipeEditorScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const actorId = useAuthStore((s) => s.user?.id);

  const [productName, setProductName] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', inventory_item_id: null, quantity: '' },
  ]);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !productId) return;
    (async () => {
      try {
        const [product, items, recipe] = await Promise.all([
          productService.getProductById(Number(productId)),
          inventoryService.listInventoryItems(),
          recipeService.getRecipeForProduct(Number(productId)),
        ]);
        if (!product) {
          setError('Product not found');
          setBooting(false);
          return;
        }
        if (product.tracking_type !== 'RECIPE') {
          setError('This product is not recipe-based');
          setBooting(false);
          return;
        }
        setProductName(product.name);
        setInventory(items);
        if (recipe?.items.length) {
          setLines(
            recipe.items.map((item, index) => ({
              key: String(item.id ?? index),
              inventory_item_id: item.inventory_item_id,
              quantity: String(item.quantity),
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipe');
      } finally {
        setBooting(false);
      }
    })();
  }, [isAdmin, productId]);

  const inventoryById = useMemo(() => {
    const map = new Map<number, InventoryItem>();
    for (const item of inventory) map.set(item.id, item);
    return map;
  }, [inventory]);

  if (!isAdmin) return null;

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: `${Date.now()}`, inventory_item_id: null, quantity: '' },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const handleSave = async () => {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = lines.map((line) => ({
        inventory_item_id: line.inventory_item_id as number,
        quantity: Number.parseFloat(line.quantity),
      }));
      if (payload.some((p) => !p.inventory_item_id)) {
        throw new Error('Select an ingredient for every line');
      }
      await recipeService.saveRecipeForProduct(
        Number(productId),
        payload,
        actorId
      );
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
        Recipe · {productName}
      </Text>

      {lines.map((line) => {
        const selected = line.inventory_item_id
          ? inventoryById.get(line.inventory_item_id)
          : null;
        return (
          <View key={line.key} style={styles.line}>
            <Menu
              visible={openMenuKey === line.key}
              onDismiss={() => setOpenMenuKey(null)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setOpenMenuKey(line.key)}
                  style={styles.ingredientButton}
                  contentStyle={styles.ingredientButtonContent}
                >
                  {selected
                    ? `${selected.name} (${selected.unit})`
                    : 'Select ingredient'}
                </Button>
              }
            >
              {inventory.map((item) => (
                <Menu.Item
                  key={item.id}
                  onPress={() => {
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, inventory_item_id: item.id }
                          : l
                      )
                    );
                    setOpenMenuKey(null);
                  }}
                  title={`${item.name} (${item.unit})`}
                />
              ))}
            </Menu>
            <View style={styles.qtyRow}>
              <TextInput
                label="Qty"
                mode="outlined"
                keyboardType="decimal-pad"
                value={line.quantity}
                onChangeText={(value) =>
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key ? { ...l, quantity: value } : l
                    )
                  )
                }
                style={styles.qtyInput}
              />
              <IconButton
                icon="delete"
                onPress={() => removeLine(line.key)}
                disabled={lines.length <= 1}
              />
            </View>
          </View>
        );
      })}

      <Button mode="outlined" onPress={addLine} style={styles.addLine}>
        Add ingredient
      </Button>

      {inventory.length === 0 ? (
        <HelperText type="info" visible>
          No ingredients in inventory
        </HelperText>
      ) : null}

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
        Save recipe
      </Button>
      <Button onPress={() => router.back()} disabled={loading}>
        Cancel
      </Button>
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
    fontWeight: '700',
    marginBottom: 16,
  },
  line: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  ingredientButton: {
    marginBottom: 8,
  },
  ingredientButtonContent: {
    justifyContent: 'flex-start',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyInput: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  addLine: {
    marginBottom: 12,
  },
  save: {
    marginTop: 8,
    marginBottom: 8,
  },
});
