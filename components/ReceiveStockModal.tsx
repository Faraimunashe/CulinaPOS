import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import * as inventoryService from '@/services/inventoryService';
import { colors } from '@/theme';
import { COMMON_PACK_SIZES, type InventoryItem } from '@/types';

interface ReceiveStockModalProps {
  visible: boolean;
  item: InventoryItem | null;
  actorId: number | undefined;
  onDismiss: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ReceiveStockModal({
  visible,
  item,
  actorId,
  onDismiss,
  onSuccess,
  onError,
}: ReceiveStockModalProps) {
  const insets = useSafeAreaInsets();
  const [packCount, setPackCount] = useState('1');
  const [packSize, setPackSize] = useState('6');
  const [mode, setMode] = useState<'packs' | 'units'>('packs');
  const [units, setUnits] = useState('');
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!item) return;
    setPackSize(String(item.pack_size > 1 ? item.pack_size : 6));
    setMode(item.item_kind === 'RETAIL' ? 'packs' : 'units');
    setPackCount('1');
    setUnits('');
  }, [item?.id]);

  // Android Modal ignores KeyboardAvoidingView; lift with keyboard height.
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  const effectivePackSize = useMemo(() => {
    if (!item) return 1;
    if (mode === 'units') return 1;
    const parsed = Number.parseInt(packSize, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return Math.max(1, item.pack_size || 1);
  }, [item, mode, packSize]);

  const previewUnits = useMemo(() => {
    if (mode === 'units') {
      const n = Number.parseFloat(units);
      return Number.isFinite(n) ? n : 0;
    }
    const packs = Number.parseFloat(packCount);
    return Number.isFinite(packs) ? packs * effectivePackSize : 0;
  }, [mode, units, packCount, effectivePackSize]);

  const resetAndClose = () => {
    onDismiss();
  };

  const handleSave = async () => {
    if (!actorId || !item) return;
    setSaving(true);
    try {
      if (mode === 'packs' && item.item_kind === 'RETAIL') {
        await inventoryService.receivePacks(
          item.id,
          Number.parseFloat(packCount),
          actorId,
          effectivePackSize
        );
        onSuccess(`Added ${previewUnits} ${item.unit} to ${item.name}`);
      } else {
        await inventoryService.receiveStock(
          item.id,
          Number.parseFloat(units),
          actorId,
          `Purchase · ${units} ${item.unit}`
        );
        onSuccess(`Added ${units} ${item.unit} to ${item.name}`);
      }
      resetAndClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add stock');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const isRetail = item.item_kind === 'RETAIL';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={resetAndClose} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              marginBottom: keyboardHeight,
              maxHeight: keyboardHeight > 0 ? '55%' : '88%',
            },
          ]}
        >
          <Text variant="headlineSmall" style={styles.title}>
            Add stock
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text variant="titleMedium" style={styles.itemName}>
              {item.name}
            </Text>
            <Text variant="bodyMedium" style={styles.current}>
              On hand: {inventoryService.formatStockLabel(item)}
            </Text>

            {isRetail ? (
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => setMode('packs')}
                  style={[
                    styles.modeChip,
                    mode === 'packs' && styles.modeChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === 'packs' && styles.modeTextOn,
                    ]}
                  >
                    By packs
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('units')}
                  style={[
                    styles.modeChip,
                    mode === 'units' && styles.modeChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === 'units' && styles.modeTextOn,
                    ]}
                  >
                    By units
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'packs' && isRetail ? (
              <>
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
                        effectivePackSize === size && styles.packChipOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.packText,
                          effectivePackSize === size && styles.packTextOn,
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
                <TextInput
                  label="Packs"
                  mode="outlined"
                  keyboardType="decimal-pad"
                  value={packCount}
                  onChangeText={setPackCount}
                  style={styles.input}
                />
              </>
            ) : (
              <TextInput
                label={`Quantity (${item.unit})`}
                mode="outlined"
                keyboardType="decimal-pad"
                value={units}
                onChangeText={setUnits}
                style={styles.input}
              />
            )}

            <View style={styles.preview}>
              <Text variant="labelLarge" style={styles.previewLabel}>
                Adding
              </Text>
              <Text variant="headlineSmall" style={styles.previewValue}>
                +{previewUnits} {item.unit}
              </Text>
              <Text variant="bodySmall" style={styles.previewNext}>
                New total: {item.quantity + previewUnits} {item.unit}
              </Text>
            </View>

            {previewUnits <= 0 ? (
              <HelperText type="error" visible>
                Enter a quantity greater than zero
              </HelperText>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={resetAndClose}
              style={styles.actionBtn}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              loading={saving}
              disabled={saving || previewUnits <= 0}
              onPress={handleSave}
              style={styles.actionBtn}
            >
              Add stock
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  itemName: {
    color: colors.primary,
    fontWeight: '700',
  },
  current: {
    marginTop: 4,
    marginBottom: 16,
    opacity: 0.7,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
  },
  modeChipOn: {
    backgroundColor: colors.primary,
  },
  modeText: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  modeTextOn: {
    color: colors.onPrimary,
  },
  label: {
    marginBottom: 8,
  },
  packRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  packChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
  },
  packChipOn: {
    backgroundColor: colors.primaryContainer,
  },
  packText: {
    fontWeight: '600',
  },
  packTextOn: {
    color: colors.primary,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  preview: {
    marginTop: 4,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
  },
  previewLabel: {
    color: colors.primary,
  },
  previewValue: {
    color: colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  previewNext: {
    marginTop: 4,
    opacity: 0.75,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
  },
});
