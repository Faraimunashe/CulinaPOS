import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import * as orderService from '@/services/orderService';
import * as saleDeleteAdminService from '@/services/saleDeleteAdminService';
import { useAuthStore } from '@/stores/authStore';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { Order } from '@/types';

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SaleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = Number(params.id);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError('Invalid sale');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [row, deleteAllowed] = await Promise.all([
        orderService.getOrderById(orderId),
        user?.id
          ? saleDeleteAdminService.canDeleteSales(user.id)
          : Promise.resolve(false),
      ]);
      setCanDelete(deleteAllowed);
      if (!row) {
        setError('Sale not found');
        setOrder(null);
      } else {
        setOrder(row);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale');
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onReprint = async () => {
    if (!order) return;
    setReprinting(true);
    try {
      const message = await orderService.reprintOrder(order.id);
      setSnack(message);
    } catch (err) {
      setSnack(err instanceof Error ? err.message : 'Could not reprint');
    } finally {
      setReprinting(false);
    }
  };

  const onConfirmReverse = async () => {
    if (!order || !user) return;
    setReversing(true);
    try {
      const updated = await orderService.reverseOrder(order.id, user.id);
      setOrder(updated);
      setReverseOpen(false);
      setSnack(`Sale #${updated.order_number} reversed · stock restored`);
    } catch (err) {
      Alert.alert(
        'Could not reverse',
        err instanceof Error ? err.message : 'Unexpected error'
      );
    } finally {
      setReversing(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!order || !user) return;
    setDeleting(true);
    try {
      const result = await orderService.deleteOrder(order.id, user.id);
      setDeleteOpen(false);
      setSnack(`Sale #${result.order_number} deleted`);
      router.replace('/(app)/sales');
    } catch (err) {
      Alert.alert(
        'Could not delete',
        err instanceof Error ? err.message : 'Unexpected error'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <HelperText type="error" visible>
          {error ?? 'Sale not found'}
        </HelperText>
        <Button mode="outlined" onPress={() => router.back()}>
          Go back
        </Button>
      </View>
    );
  }

  const symbol = order.currency_symbol ?? '$';
  const isReversed = order.status === 'REVERSED';
  const items = order.items ?? [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Back to sales"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.backText}>Sales</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.orderNum}>Sale #{order.order_number}</Text>
            <View
              style={[
                styles.statusBadge,
                isReversed ? styles.statusReversed : styles.statusCompleted,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isReversed
                    ? styles.statusTextReversed
                    : styles.statusTextCompleted,
                ]}
              >
                {isReversed ? 'Reversed' : 'Completed'}
              </Text>
            </View>
          </View>
          <Text style={styles.total}>
            {formatMoney(order.total, symbol)}
          </Text>
          <Text style={styles.meta}>
            {order.order_date}
            {order.cashier_name ? ` · ${order.cashier_name}` : ''}
          </Text>
          <Text style={styles.metaMuted}>
            {order.payment_method_name ?? 'Payment unknown'}
            {order.currency_name ? ` · ${order.currency_name}` : ''}
          </Text>
          <Text style={styles.metaMuted}>
            {formatCreatedAt(order.created_at)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsCard}>
          {items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineCopy}>
                <Text style={styles.lineName}>{item.product_name}</Text>
                <Text style={styles.lineQty}>
                  {item.quantity} × {formatMoney(item.unit_price, symbol)}
                </Text>
              </View>
              <Text style={styles.lineTotal}>
                {formatMoney(item.line_total, symbol)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatMoney(order.total, symbol)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="printer"
            onPress={() => void onReprint()}
            loading={reprinting}
            disabled={reprinting}
            style={styles.actionBtn}
            contentStyle={styles.actionContent}
          >
            Reprint receipt
          </Button>

          {isAdmin && !isReversed ? (
            <Button
              mode="outlined"
              icon="undo-variant"
              textColor={colors.error}
              onPress={() => setReverseOpen(true)}
              style={[styles.actionBtn, styles.reverseBtn]}
              contentStyle={styles.actionContent}
            >
              Reverse sale
            </Button>
          ) : null}

          {canDelete ? (
            <Button
              mode="outlined"
              icon="delete-outline"
              textColor={colors.error}
              onPress={() => setDeleteOpen(true)}
              style={[styles.actionBtn, styles.reverseBtn]}
              contentStyle={styles.actionContent}
            >
              Delete sale
            </Button>
          ) : null}

          {isAdmin && isReversed ? (
            <Text style={styles.reversedNote}>
              This sale was reversed. Inventory from this order has been restored.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <BottomSheetModal
        visible={reverseOpen}
        title="Reverse this sale?"
        onDismiss={() => !reversing && setReverseOpen(false)}
        primaryLabel="Reverse sale"
        onPrimary={() => void onConfirmReverse()}
        primaryLoading={reversing}
        primaryDisabled={reversing}
        secondaryLabel="Cancel"
      >
        <Text style={styles.confirmBody}>
          Sale #{order.order_number} for {formatMoney(order.total, symbol)} will
          be marked reversed and stock deducted for this order will be put
          back. This cannot be undone.
        </Text>
      </BottomSheetModal>

      <BottomSheetModal
        visible={deleteOpen}
        title="Delete this sale?"
        onDismiss={() => !deleting && setDeleteOpen(false)}
        primaryLabel="Delete permanently"
        onPrimary={() => void onConfirmDelete()}
        primaryLoading={deleting}
        primaryDisabled={deleting}
        secondaryLabel="Cancel"
      >
        <Text style={styles.confirmBody}>
          Sale #{order.order_number} for {formatMoney(order.total, symbol)} will
          be permanently removed from history
          {isReversed
            ? '.'
            : ' and any stock from this sale will be restored.'}{' '}
          This cannot be undone.
        </Text>
      </BottomSheetModal>

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={3500}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: colors.primaryContainer,
  },
  statusReversed: {
    backgroundColor: '#FCE8EC',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextCompleted: {
    color: colors.success,
  },
  statusTextReversed: {
    color: colors.error,
  },
  total: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    opacity: 0.7,
  },
  metaMuted: {
    marginTop: 4,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.45,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.4,
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  lineCopy: {
    flex: 1,
    minWidth: 0,
  },
  lineName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  lineQty: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.5,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onSurface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
    opacity: 0.6,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    borderRadius: 14,
  },
  actionContent: {
    paddingVertical: 6,
  },
  reverseBtn: {
    borderColor: colors.error,
  },
  reversedNote: {
    textAlign: 'center',
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
    opacity: 0.75,
  },
});
