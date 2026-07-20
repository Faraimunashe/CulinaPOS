import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useDrawerStore } from '@/stores/drawerStore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

export function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openDrawer = useDrawerStore((s) => s.open);
  const isAdmin = user?.role === 'ADMIN';
  const { useSplitPosLayout } = useResponsiveLayout();
  const firstName = user?.full_name.split(' ')[0] ?? 'Staff';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        useSplitPosLayout && styles.contentWide,
      ]}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {user?.role === 'ADMIN' ? 'Administrator' : 'Cashier'}
        </Text>
        <Text variant="headlineMedium" style={styles.heading}>
          Welcome, {firstName}
        </Text>
        <Text style={styles.subheading}>
          Open Point of Sale to take orders, or use the menu for inventory and
          settings.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(app)/pos' as Href)}
        style={({ pressed }) => [
          styles.posCard,
          pressed && styles.posCardPressed,
        ]}
      >
        <View style={styles.posIcon}>
          <MaterialCommunityIcons
            name="point-of-sale"
            size={28}
            color={colors.onPrimary}
          />
        </View>
        <View style={styles.posCopy}>
          <Text style={styles.posTitle}>Point of Sale</Text>
          <Text style={styles.posBody}>
            Search products, build a cart, and complete a sale.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.onPrimary}
        />
      </Pressable>

      <Pressable
        onPress={() => router.push('/(app)/sales' as Href)}
        style={({ pressed }) => [
          styles.salesCard,
          pressed && styles.salesCardPressed,
        ]}
      >
        <View style={styles.salesIcon}>
          <MaterialCommunityIcons
            name="receipt-text-outline"
            size={24}
            color={colors.primary}
          />
        </View>
        <View style={styles.posCopy}>
          <Text style={styles.salesTitle}>Sales</Text>
          <Text style={styles.salesBody}>
            Find past orders, reprint receipts, or reverse a sale.
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.primary}
        />
      </Pressable>

      {isAdmin ? (
        <View style={styles.quickGrid}>
          <Text style={styles.sectionLabel}>Quick links</Text>
          <View style={styles.quickRow}>
            {(
              [
                {
                  label: 'Products',
                  icon: 'food' as const,
                  href: '/(app)/products',
                },
                {
                  label: 'Inventory',
                  icon: 'package-variant' as const,
                  href: '/(app)/inventory',
                },
                {
                  label: 'Reports',
                  icon: 'chart-box-outline' as const,
                  href: '/(app)/reports',
                },
                {
                  label: 'Settings',
                  icon: 'cog-outline' as const,
                  href: '/(app)/settings',
                },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.href as Href)}
                style={({ pressed }) => [
                  styles.quickCard,
                  pressed && styles.quickCardPressed,
                ]}
              >
                <View style={styles.quickIcon}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Pressable
          onPress={openDrawer}
          style={({ pressed }) => [
            styles.menuHint,
            pressed && styles.quickCardPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="menu"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.menuHintText}>Open menu for profile options</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  contentWide: {
    paddingHorizontal: 32,
  },
  hero: {
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 8,
  },
  heading: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subheading: {
    marginTop: 8,
    color: colors.onBackground,
    opacity: 0.65,
    lineHeight: 22,
    fontSize: 15,
    maxWidth: 520,
  },
  posCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  posCardPressed: {
    opacity: 0.92,
  },
  posIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posCopy: {
    flex: 1,
  },
  posTitle: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  posBody: {
    marginTop: 4,
    color: colors.onPrimary,
    opacity: 0.8,
    fontSize: 13,
    lineHeight: 18,
  },
  salesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  salesCardPressed: {
    opacity: 0.9,
    backgroundColor: colors.primaryContainer,
  },
  salesIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salesTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  salesBody: {
    marginTop: 4,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
  },
  quickGrid: {
    gap: 12,
  },
  sectionLabel: {
    color: colors.onSurface,
    opacity: 0.45,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  quickCardPressed: {
    opacity: 0.88,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLabel: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  menuHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  menuHintText: {
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
});
