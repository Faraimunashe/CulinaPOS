import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, HelperText, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as orderService from '@/services/orderService';
import * as printService from '@/services/printService';
import { askPrintRestaurantCopy } from '@/services/receiptPrintFlow';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { usePrinterStore } from '@/stores/printerStore';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { Order } from '@/types';

interface CheckoutModalProps {
  visible: boolean;
  currencySymbol: string;
  paymentMethodName: string;
  onDismiss: () => void;
  onCompleted: (order: Order) => void;
}

type Phase = 'confirm' | 'countdown' | 'processing' | 'done' | 'error';

const COUNTDOWN_SECONDS = 5;

export function CheckoutModal({
  visible,
  currencySymbol,
  paymentMethodName,
  onDismiss,
  onCompleted,
}: CheckoutModalProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const lines = useCartStore((s) => s.lines);
  const currencyId = useCartStore((s) => s.currencyId);
  const paymentMethodId = useCartStore((s) => s.paymentMethodId);
  const subtotal = useCartStore((s) => s.subtotal);
  const clearCart = useCartStore((s) => s.clear);

  const [phase, setPhase] = useState<Phase>('confirm');
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const printerConnected = usePrinterStore((s) => s.isConnected);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      clearTimer();
      cancelledRef.current = false;
      setPhase('confirm');
      setSeconds(COUNTDOWN_SECONDS);
      setError(null);
      setOrder(null);
      setPrintNote(null);
    }
  }, [visible]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const startCountdown = () => {
    cancelledRef.current = false;
    setError(null);
    setPhase('countdown');
    setSeconds(COUNTDOWN_SECONDS);

    clearTimer();
    let remaining = COUNTDOWN_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSeconds(remaining);
      if (remaining <= 0) {
        clearTimer();
        void finalizeOrder();
      }
    }, 1000);
  };

  const undoCountdown = () => {
    cancelledRef.current = true;
    clearTimer();
    setPhase('confirm');
    setSeconds(COUNTDOWN_SECONDS);
  };

  const finalizeOrder = async () => {
    if (cancelledRef.current) return;
    if (!user || currencyId == null || paymentMethodId == null) {
      setPhase('error');
      setError('Missing cashier, currency, or payment method');
      return;
    }

    setPhase('processing');
    try {
      const completed = await orderService.processOrder({
        cashierId: user.id,
        currencyId,
        paymentMethodId,
        lines: useCartStore.getState().lines,
      });
      if (cancelledRef.current) return;

      void import('@/services/notificationService')
        .then(({ notifyLowStockForOrder }) => notifyLowStockForOrder(completed.id))
        .catch(() => false);

      const customerPrint = await printService.printCustomerReceipt(completed);
      if (customerPrint.status === 'printed') {
        setPrintNote('Customer receipt printed');
      } else if (customerPrint.status === 'skipped') {
        setPrintNote(
          printerConnected
            ? customerPrint.reason ?? 'Receipts not printed.'
            : 'Sale saved · printer offline, no receipts printed.'
        );
      } else {
        setPrintNote(
          `Sale saved · print issue: ${customerPrint.reason ?? 'unknown'}`
        );
      }

      setOrder(completed);
      clearCart();
      setPhase('done');
      onCompleted(completed);

      if (customerPrint.status === 'printed') {
        const wantsRestaurant = await askPrintRestaurantCopy();
        if (wantsRestaurant) {
          const kitchen = await printService.printRestaurantCopy(completed, {
            force: true,
          });
          if (kitchen.status === 'printed') {
            setPrintNote('Customer and restaurant receipts printed');
          } else {
            setPrintNote(
              `Customer printed · restaurant copy failed: ${
                kitchen.reason ?? 'unknown'
              }`
            );
          }
        }
      }
    } catch (err) {
      if (cancelledRef.current) return;
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  const handleClose = () => {
    if (phase === 'processing') return;
    if (phase === 'countdown') undoCountdown();
    onDismiss();
  };

  const total = subtotal();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {phase === 'confirm' ? (
            <>
              <Text style={styles.title}>Process order?</Text>
              <Text style={styles.body}>
                {lines.length} line{lines.length === 1 ? '' : 's'} ·{' '}
                {formatMoney(total, currencySymbol)} · {paymentMethodName}
              </Text>
              <Text style={styles.hint}>
                After you confirm, there will be a short undo window before the
                sale is saved and stock is deducted.
              </Text>
              <View style={styles.actions}>
                <Button
                  mode="outlined"
                  onPress={onDismiss}
                  style={styles.actionBtn}
                >
                  No
                </Button>
                <Button
                  mode="contained"
                  onPress={startCountdown}
                  style={styles.actionBtn}
                >
                  Yes
                </Button>
              </View>
            </>
          ) : null}

          {phase === 'countdown' ? (
            <>
              <Text style={styles.title}>Completing in</Text>
              <Text style={styles.countdown}>{seconds}</Text>
              <Text style={styles.body}>
                Tap Undo to cancel before the order is saved.
              </Text>
              <Button
                mode="contained"
                buttonColor={colors.secondary}
                onPress={undoCountdown}
                style={styles.undoBtn}
                contentStyle={styles.undoContent}
                labelStyle={styles.undoLabel}
              >
                Undo
              </Button>
            </>
          ) : null}

          {phase === 'processing' ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.body}>Saving order…</Text>
            </View>
          ) : null}

          {phase === 'done' && order ? (
            <>
              <View style={styles.successIcon}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={40}
                  color={colors.success}
                />
              </View>
              <Text style={styles.title}>Order #{order.order_number}</Text>
              <Text style={styles.body}>
                {formatMoney(order.total, order.currency_symbol ?? currencySymbol)}{' '}
                · {order.payment_method_name ?? paymentMethodName}
              </Text>
              <Text style={styles.hint}>
                {printNote ??
                  (printerConnected
                    ? 'Printing receipts…'
                    : 'Sale saved · printer offline, no receipts printed.')}
              </Text>
              <Button mode="contained" onPress={onDismiss} style={styles.doneBtn}>
                Done
              </Button>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text style={styles.title}>Could not complete</Text>
              <HelperText type="error" visible>
                {error}
              </HelperText>
              <View style={styles.actions}>
                <Button mode="outlined" onPress={onDismiss} style={styles.actionBtn}>
                  Close
                </Button>
                <Button
                  mode="contained"
                  onPress={startCountdown}
                  style={styles.actionBtn}
                >
                  Try again
                </Button>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 22,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.onSurface,
    opacity: 0.75,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
  },
  countdown: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 72,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -2,
  },
  undoBtn: {
    marginTop: 20,
    borderRadius: 14,
  },
  undoContent: {
    paddingVertical: 8,
  },
  undoLabel: {
    fontWeight: '800',
    fontSize: 16,
  },
  centerBlock: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 8,
  },
  doneBtn: {
    marginTop: 20,
    borderRadius: 14,
  },
});
