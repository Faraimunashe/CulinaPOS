import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

interface ModuleLink {
  title: string;
  href: string;
  adminOnly?: boolean;
  disabled?: boolean;
}

const MODULES: ModuleLink[] = [
  { title: 'Inventory', href: '/(app)/inventory', adminOnly: true },
  { title: 'Products', href: '/(app)/products', adminOnly: true },
  { title: 'Categories', href: '/(app)/categories', adminOnly: true },
  { title: 'Currencies', href: '/(app)/currencies', adminOnly: true },
  { title: 'Users', href: '/(app)/users', adminOnly: true },
  { title: 'Point of Sale', href: '/(app)', disabled: true },
  { title: 'Profile', href: '/(app)/profile' },
  { title: 'Change Password', href: '/(app)/change-password' },
];

export function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const { useSplitPosLayout } = useResponsiveLayout();

  const visibleModules = MODULES.filter(
    (module) => !module.adminOnly || isAdmin
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        useSplitPosLayout && styles.contentWide,
      ]}
    >
      <Text variant="headlineMedium" style={styles.heading}>
        Welcome, {user?.full_name.split(' ')[0] ?? 'Staff'}
      </Text>

      <View style={styles.grid}>
        {visibleModules.map((module) => (
          <View key={module.title} style={styles.module}>
            <Text variant="titleMedium" style={styles.moduleTitle}>
              {module.title}
            </Text>
            <Button
              mode="contained-tonal"
              disabled={module.disabled}
              onPress={() => router.push(module.href as Href)}
              style={styles.moduleButton}
            >
              {module.disabled ? 'Coming soon' : 'Open'}
            </Button>
          </View>
        ))}
      </View>
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
  heading: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 24,
  },
  grid: {
    gap: 12,
  },
  module: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  moduleTitle: {
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  moduleButton: {
    alignSelf: 'center',
  },
});
