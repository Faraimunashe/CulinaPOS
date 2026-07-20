import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import * as inventoryService from '@/services/inventoryService';
import { colors } from '@/theme';
import { ADJUSTMENT_REASONS, type InventoryItem } from '@/types';

interface AdjustStockModalProps {
  visible: boolean;
  item: InventoryItem | null;
  actorId: number | undefined;
  onDismiss: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdjustStockModal({
  visible,
  item,
  actorId,
  onDismiss,
  onSuccess,
  onError,
}: AdjustStockModalProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[2]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setQuantity(String(item.quantity));
    setReason(ADJUSTMENT_REASONS[2]);
  }, [item?.id, item?.quantity, visible]);

  const parsedQty = useMemo(() => {
    const n = Number.parseFloat(quantity);
    return Number.isFinite(n) ? n : NaN;
  }, [quantity]);

  const isValid = Number.isFinite(parsedQty) && parsedQty >= 0 && reason.trim().length > 0;
  const delta = item && Number.isFinite(parsedQty) ? parsedQty - item.quantity : 0;

  const handleSave = async () => {
    if (!actorId || !item || !isValid) return;
    setSaving(true);
    try {
      await inventoryService.adjustStock(
        item.id,
        parsedQty,
        reason.trim(),
        actorId
      );
      onSuccess(`Updated ${item.name}`);
      onDismiss();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <BottomSheetModal
      visible={visible}
      title="Adjust stock"
      onDismiss={onDismiss}
      primaryLabel="Save"
      onPrimary={() => void handleSave()}
      primaryDisabled={!isValid}
      primaryLoading={saving}
    >
      <Text variant="titleMedium" style={styles.itemName}>
        {item.name}
      </Text>
      <Text variant="bodyMedium" style={styles.current}>
        On hand: {inventoryService.formatStockLabel(item)}
      </Text>

      <TextInput
        label={`Quantity (${item.unit})`}
        mode="outlined"
        keyboardType="decimal-pad"
        value={quantity}
        onChangeText={setQuantity}
        style={styles.input}
      />

      <Text variant="labelLarge" style={styles.label}>
        Reason
      </Text>
      <View style={styles.reasonRow}>
        {ADJUSTMENT_REASONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setReason(option)}
            style={[
              styles.reasonChip,
              reason === option && styles.reasonChipOn,
            ]}
          >
            <Text
              style={[
                styles.reasonText,
                reason === option && styles.reasonTextOn,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        label="Reason"
        mode="outlined"
        value={reason}
        onChangeText={setReason}
        style={styles.input}
      />

      <View style={styles.preview}>
        <Text variant="labelLarge" style={styles.previewLabel}>
          Change
        </Text>
        <Text variant="headlineSmall" style={styles.previewValue}>
          {Number.isFinite(parsedQty)
            ? `${delta > 0 ? '+' : ''}${delta} ${item.unit}`
            : `— ${item.unit}`}
        </Text>
        <Text variant="bodySmall" style={styles.previewNext}>
          New total:{' '}
          {Number.isFinite(parsedQty) ? parsedQty : '—'} {item.unit}
        </Text>
      </View>

      {!isValid && quantity.length > 0 ? (
        <HelperText type="error" visible>
          Enter a valid quantity
        </HelperText>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  itemName: {
    color: colors.primary,
    fontWeight: '700',
  },
  current: {
    marginTop: 4,
    marginBottom: 16,
    opacity: 0.7,
  },
  label: {
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
  },
  reasonChipOn: {
    backgroundColor: colors.primaryContainer,
  },
  reasonText: {
    fontWeight: '600',
  },
  reasonTextOn: {
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
});
