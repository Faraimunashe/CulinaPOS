import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePrinterStore } from '@/stores/printerStore';
import { useAuthStore } from '@/stores/authStore';
import { useDrawerStore } from '@/stores/drawerStore';
import { useAppClock } from '@/hooks/useAppClock';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

interface AppHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AppHeader({ showBack = false, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const restaurantName = useSettingsStore((s) => s.restaurantName);
  const isConnected = usePrinterStore((s) => s.isConnected);
  const user = useAuthStore((s) => s.user);
  const openDrawer = useDrawerStore((s) => s.open);
  const clock = useAppClock();
  const { isTablet } = useResponsiveLayout();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={showBack ? onBack : openDrawer}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={showBack ? 'Go back' : 'Open menu'}
        >
          <MaterialCommunityIcons
            name={showBack ? 'arrow-left' : 'menu'}
            size={22}
            color={colors.primary}
          />
        </Pressable>

        <View style={styles.brand}>
          <Text style={styles.title} numberOfLines={1}>
            {restaurantName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {clock}
          </Text>
        </View>

        <View style={styles.right}>
          <Pressable
            onPress={() => router.push('/(app)/printer' as Href)}
            style={[
              styles.printerPill,
              isConnected ? styles.printerOn : styles.printerOff,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isConnected ? 'Printer connected' : 'Printer disconnected'
            }
          >
            <MaterialCommunityIcons
              name={isConnected ? 'printer-check' : 'printer-off'}
              size={16}
              color={isConnected ? colors.success : colors.printerDisconnected}
            />
            {isTablet ? (
              <Text
                style={[
                  styles.printerText,
                  {
                    color: isConnected
                      ? colors.success
                      : colors.printerDisconnected,
                  },
                ]}
              >
                {isConnected ? 'Printer' : 'Offline'}
              </Text>
            ) : (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isConnected
                      ? colors.success
                      : colors.printerDisconnected,
                  },
                ]}
              />
            )}
          </Pressable>

          {user ? (
            <Pressable
              onPress={openDrawer}
              style={({ pressed }) => [
                styles.avatarBtn,
                pressed && styles.iconBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <Text style={styles.avatarText}>{initials(user.full_name)}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  bar: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.85,
  },
  brand: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 1,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 12,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  printerOn: {
    backgroundColor: colors.primaryContainer,
  },
  printerOff: {
    backgroundColor: '#FCE8EC',
  },
  printerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
});
