import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatMoney } from '@/utils/formatMoney';
import { colors } from '@/theme';
import type { PosProduct } from '@/types';

interface ProductTileProps {
  product: PosProduct;
  price: number;
  currencySymbol: string;
  inCartQty?: number;
  onPress: () => void;
}

export function ProductTile({
  product,
  price,
  currencySymbol,
  inCartQty = 0,
  onPress,
}: ProductTileProps) {
  const out = !product.in_stock;
  const isRecipe = product.tracking_type === 'RECIPE';

  return (
    <Pressable
      onPress={onPress}
      disabled={out}
      style={({ pressed }) => [
        styles.tile,
        out && styles.tileOut,
        pressed && !out && styles.tilePressed,
        inCartQty > 0 && !out && styles.tileInCart,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: out }}
      accessibilityLabel={`${product.name}, ${formatMoney(price, currencySymbol)}${
        out ? ', out of stock' : ''
      }`}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.typeChip,
            isRecipe ? styles.typeRecipe : styles.typeDirect,
          ]}
        >
          <MaterialCommunityIcons
            name={isRecipe ? 'food-variant' : 'package-variant'}
            size={12}
            color={isRecipe ? colors.primary : colors.secondary}
          />
          <Text
            style={[
              styles.typeText,
              isRecipe ? styles.typeTextRecipe : styles.typeTextDirect,
            ]}
          >
            {isRecipe ? 'Recipe' : 'Retail'}
          </Text>
        </View>

        {inCartQty > 0 && !out ? (
          <View style={styles.cartQty}>
            <Text style={styles.cartQtyText}>×{inCartQty}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, out && styles.nameOut]} numberOfLines={2}>
        {product.name}
      </Text>

      {product.category_name ? (
        <Text style={styles.category} numberOfLines={1}>
          {product.category_name}
        </Text>
      ) : (
        <View style={styles.categorySpacer} />
      )}

      <View style={styles.footer}>
        <Text style={[styles.price, out && styles.priceOut]}>
          {formatMoney(price, currencySymbol)}
        </Text>
        {out ? (
          <View style={styles.outBadge}>
            <Text style={styles.outBadgeText}>Out of stock</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    minHeight: 148,
    borderWidth: 1.5,
    borderColor: 'rgba(196,190,180,0.55)',
    justifyContent: 'space-between',
    shadowColor: '#1B4332',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tilePressed: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
    transform: [{ scale: 0.985 }],
  },
  tileInCart: {
    borderColor: colors.primary,
    backgroundColor: '#F3FAF5',
  },
  tileOut: {
    backgroundColor: '#F4F2EE',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeRecipe: {
    backgroundColor: colors.primaryContainer,
  },
  typeDirect: {
    backgroundColor: colors.secondaryContainer,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  typeTextRecipe: {
    color: colors.primary,
  },
  typeTextDirect: {
    color: colors.secondary,
  },
  cartQty: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cartQtyText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 11,
  },
  name: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    minHeight: 42,
  },
  nameOut: {
    color: colors.onSurface,
    opacity: 0.45,
  },
  category: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
    opacity: 0.45,
  },
  categorySpacer: {
    height: 16,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    flex: 1,
    fontWeight: '800',
    color: colors.onSurface,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  priceOut: {
    opacity: 0.4,
  },
  outBadge: {
    backgroundColor: '#FCE8EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  outBadgeText: {
    color: colors.error,
    fontWeight: '800',
    fontSize: 11,
  },
});
