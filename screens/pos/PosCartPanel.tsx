import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCartStore } from '@/stores/cartStore';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { Currency, PaymentMethod } from '@/types';

interface PosCartPanelProps {
  currencies: Currency[];
  paymentMethods: PaymentMethod[];
  currencySymbol: string;
  onCheckout: () => void;
  compact?: boolean;
}

export function PosCartPanel({
  currencies,
  paymentMethods,
  currencySymbol,
  onCheckout,
  compact = false,
}: PosCartPanelProps) {
  const lines = useCartStore((s) => s.lines);
  const currencyId = useCartStore((s) => s.currencyId);
  const paymentMethodId = useCartStore((s) => s.paymentMethodId);
  const setCurrencyId = useCartStore((s) => s.setCurrencyId);
  const setPaymentMethodId = useCartStore((s) => s.setPaymentMethodId);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const removeLine = useCartStore((s) => s.removeLine);
  const clear = useCartStore((s) => s.clear);
  const subtotal = useCartStore((s) => s.subtotal);
  const itemCount = useCartStore((s) => s.itemCount);

  const total = subtotal();
  const count = itemCount();
  const canCheckout =
    lines.length > 0 && currencyId != null && paymentMethodId != null;

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cart</Text>
          <Text style={styles.meta}>
            {count} item{count === 1 ? '' : 's'}
          </Text>
        </View>
        {lines.length > 0 ? (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {lines.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="cart-outline"
              size={36}
              color={colors.outline}
            />
            <Text style={styles.emptyTitle}>Cart is empty</Text>
            <Text style={styles.emptyBody}>
              Tap a product to add it here.
            </Text>
          </View>
        ) : (
          lines.map((line) => (
            <View key={line.product_id} style={styles.line}>
              <View style={styles.lineTop}>
                <Text style={styles.lineName} numberOfLines={2}>
                  {line.product_name}
                </Text>
                <Pressable
                  onPress={() => removeLine(line.product_id)}
                  hitSlop={8}
                  accessibilityLabel="Remove item"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={colors.onSurface}
                  />
                </Pressable>
              </View>
              <Text style={styles.linePrice}>
                {formatMoney(line.unit_price, currencySymbol)} each
              </Text>
              <View style={styles.lineBottom}>
                <View style={styles.qtyControls}>
                  <Pressable
                    onPress={() => decrement(line.product_id)}
                    style={styles.qtyBtn}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      size={18}
                      color={colors.primary}
                    />
                  </Pressable>
                  <Text style={styles.qtyValue}>{line.quantity}</Text>
                  <Pressable
                    onPress={() => increment(line.product_id)}
                    style={[
                      styles.qtyBtn,
                      line.quantity >= line.max_quantity && styles.qtyBtnDisabled,
                    ]}
                    disabled={line.quantity >= line.max_quantity}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={18}
                      color={
                        line.quantity >= line.max_quantity
                          ? colors.outline
                          : colors.primary
                      }
                    />
                  </Pressable>
                </View>
                <Text style={styles.lineTotal}>
                  {formatMoney(
                    line.unit_price * line.quantity,
                    currencySymbol
                  )}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.sectionLabel}>Currency</Text>
        <View style={styles.chipRow}>
          {currencies.map((currency) => {
            const selected = currencyId === currency.id;
            return (
              <Pressable
                key={currency.id}
                onPress={() => setCurrencyId(currency.id)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {currency.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Payment</Text>
        <View style={styles.chipRow}>
          {paymentMethods.length === 0 ? (
            <Text style={styles.warn}>No payment methods enabled</Text>
          ) : (
            paymentMethods.map((method) => {
              const selected = paymentMethodId === method.id;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setPaymentMethodId(method.id)}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextOn]}
                  >
                    {method.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatMoney(total, currencySymbol)}
          </Text>
        </View>

        <Button
          mode="contained"
          disabled={!canCheckout}
          onPress={onCheckout}
          style={styles.checkoutBtn}
          contentStyle={styles.checkoutContent}
          labelStyle={styles.checkoutLabel}
        >
          Process order
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.outline,
  },
  rootCompact: {
    borderLeftWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  meta: {
    marginTop: 2,
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 12,
    fontWeight: '600',
  },
  clear: {
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyBody: {
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
  },
  line: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  lineName: {
    flex: 1,
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  linePrice: {
    marginTop: 4,
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.55,
  },
  lineBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  qtyBtnDisabled: {
    backgroundColor: colors.surfaceVariant,
  },
  qtyValue: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.primary,
    fontSize: 16,
  },
  lineTotal: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 15,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.45,
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  chipText: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.primary,
  },
  warn: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  totalLabel: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  totalValue: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  checkoutBtn: {
    borderRadius: 14,
  },
  checkoutContent: {
    paddingVertical: 6,
  },
  checkoutLabel: {
    fontWeight: '800',
    fontSize: 16,
  },
});
