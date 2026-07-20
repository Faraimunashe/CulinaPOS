import { View, StyleSheet } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePrinterStore } from '@/stores/printerStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppClock } from '@/hooks/useAppClock';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { colors } from '@/theme';

interface AppHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
}

export function AppHeader({ showBack = false, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const restaurantName = useSettingsStore((s) => s.restaurantName);
  const isConnected = usePrinterStore((s) => s.isConnected);
  const user = useAuthStore((s) => s.user);
  const clock = useAppClock();

  return (
    <Appbar.Header
      style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 4 }]}
      elevated
    >
      {showBack ? <Appbar.BackAction onPress={onBack} /> : null}
      <Appbar.Content
        title={restaurantName}
        titleStyle={styles.title}
        subtitle={clock}
        subtitleStyle={styles.subtitle}
      />

      <View style={styles.right}>
        <View style={styles.printerStatus}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: isConnected
                  ? colors.printerConnected
                  : colors.printerDisconnected,
              },
            ]}
          />
          <Text variant="labelMedium" style={styles.printerLabel}>
            {isConnected ? 'Printer on' : 'Printer off'}
          </Text>
        </View>
        {user ? <UserProfileMenu user={user} /> : null}
      </View>
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  title: {
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    color: colors.onSurface,
    opacity: 0.7,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  printerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  printerLabel: {
    color: colors.onSurface,
  },
});
