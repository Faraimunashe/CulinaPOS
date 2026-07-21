import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useDrawerStore } from '@/stores/drawerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface NavItem {
  label: string;
  href: Href;
  icon: IconName;
  adminOnly?: boolean;
  disabled?: boolean;
  match?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      {
        label: 'Home',
        href: '/(app)' as Href,
        icon: 'home-outline',
        match: 'home',
      },
      {
        label: 'Point of Sale',
        href: '/(app)/pos' as Href,
        icon: 'point-of-sale',
        match: '/pos',
      },
      {
        label: 'Sales',
        href: '/(app)/sales' as Href,
        icon: 'receipt-text-outline',
        match: '/sales',
      },
      {
        label: 'Printer',
        href: '/(app)/printer' as Href,
        icon: 'printer-outline',
        match: '/printer',
      },
    ],
  },
  {
    title: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/(app)/products' as Href,
        icon: 'food',
        adminOnly: true,
        match: '/products',
      },
      {
        label: 'Categories',
        href: '/(app)/categories' as Href,
        icon: 'shape-outline',
        adminOnly: true,
        match: '/categories',
      },
      {
        label: 'Inventory',
        href: '/(app)/inventory' as Href,
        icon: 'package-variant',
        adminOnly: true,
        match: '/inventory',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Currencies',
        href: '/(app)/currencies' as Href,
        icon: 'cash-multiple',
        adminOnly: true,
        match: '/currencies',
      },
      {
        label: 'Users',
        href: '/(app)/users' as Href,
        icon: 'account-group-outline',
        adminOnly: true,
        match: '/users',
      },
      {
        label: 'Reports',
        href: '/(app)/reports' as Href,
        icon: 'chart-box-outline',
        adminOnly: true,
        match: '/reports',
      },
      {
        label: 'Settings',
        href: '/(app)/settings' as Href,
        icon: 'cog-outline',
        adminOnly: true,
        match: '/settings',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        label: 'Profile',
        href: '/(app)/profile' as Href,
        icon: 'account-outline',
        match: '/profile',
      },
      {
        label: 'Change password',
        href: '/(app)/change-password' as Href,
        icon: 'lock-outline',
        match: '/change-password',
      },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isRouteActive(pathname: string, item: NavItem): boolean {
  if (item.disabled || !item.match) return false;
  if (item.match === 'home') {
    return (
      pathname === '/' ||
      pathname === '/(app)' ||
      pathname.endsWith('/(app)') ||
      pathname === '' ||
      pathname === '/index'
    );
  }
  return pathname.includes(item.match);
}

/** Portrait: ~86% width capped. Landscape: compact side panel for tablets/phones. */
function getDrawerWidth(width: number, height: number): number {
  const landscape = width > height;
  if (landscape) {
    return Math.min(380, Math.max(300, Math.round(width * 0.34)));
  }
  return Math.min(320, Math.round(width * 0.86));
}

export function AppDrawer() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const isOpen = useDrawerStore((s) => s.isOpen);
  const close = useDrawerStore((s) => s.close);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const restaurantName = useSettingsStore((s) => s.restaurantName);

  const drawerWidth = useMemo(
    () => getDrawerWidth(windowWidth, windowHeight),
    [windowWidth, windowHeight]
  );
  const drawerWidthRef = useRef(drawerWidth);
  drawerWidthRef.current = drawerWidth;
  const mountedRef = useRef(false);

  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  mountedRef.current = mounted;

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  // Re-anchor only when screen size/orientation changes.
  useEffect(() => {
    if (!mountedRef.current) return;
    translateX.setValue(
      useDrawerStore.getState().isOpen ? 0 : -drawerWidth
    );
  }, [drawerWidth, translateX]);

  useEffect(() => {
    if (!mounted) return;

    if (isOpen) {
      translateX.setValue(-drawerWidthRef.current);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const hiddenX = -drawerWidthRef.current;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: hiddenX,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !useDrawerStore.getState().isOpen) {
        setMounted(false);
      }
    });
  }, [isOpen, mounted, translateX, backdrop]);

  if (!mounted || !user) return null;

  const isAdmin = user.role === 'ADMIN';

  const go = (item: NavItem) => {
    if (item.disabled) return;
    close();
    requestAnimationFrame(() => {
      router.push(item.href);
    });
  };

  const handleLogout = async () => {
    close();
    await logout();
    router.replace('/login');
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View
        style={[styles.overlay, { width: windowWidth, height: windowHeight }]}
      >
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdrop.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.45],
              }),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              height: windowHeight,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
              paddingLeft: Math.max(insets.left, 16),
              paddingRight: 16,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Image
                source={require('../assets/mylogo-no-bg.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityLabel="Culina POS logo"
              />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName} numberOfLines={1}>
                {restaurantName}
              </Text>
              <Text style={styles.brandTag}>Restaurant POS</Text>
            </View>
            <Pressable
              onPress={close}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={colors.onSurface}
              />
            </Pressable>
          </View>

          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.full_name)}</Text>
            </View>
            <View style={styles.userCopy}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.full_name}
              </Text>
              <Text style={styles.userRole}>
                {user.role === 'ADMIN' ? 'Administrator' : 'Cashier'}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.navScroll}
            contentContainerStyle={styles.navContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {NAV_SECTIONS.map((section) => {
              const items = section.items.filter(
                (item) => !item.adminOnly || isAdmin
              );
              if (items.length === 0) return null;
              return (
                <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {items.map((item) => {
                    const active = isRouteActive(pathname, item);
                    return (
                      <Pressable
                        key={item.label}
                        onPress={() => go(item)}
                        disabled={item.disabled}
                        style={({ pressed }) => [
                          styles.navItem,
                          active && styles.navItemActive,
                          pressed && !item.disabled && styles.navItemPressed,
                          item.disabled && styles.navItemDisabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: !!item.disabled,
                          selected: active,
                        }}
                      >
                        <View
                          style={[
                            styles.navIcon,
                            active && styles.navIconActive,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={item.icon}
                            size={20}
                            color={
                              item.disabled
                                ? colors.outline
                                : active
                                  ? colors.onPrimary
                                  : colors.primary
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.navLabel,
                            active && styles.navLabelActive,
                            item.disabled && styles.navLabelDisabled,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.disabled ? (
                          <View style={styles.soonBadge}>
                            <Text style={styles.soonText}>Soon</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => void handleLogout()}
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <MaterialCommunityIcons
              name="logout"
              size={20}
              color={colors.error}
            />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: colors.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogo: {
    width: 42,
    height: 42,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  brandTag: {
    marginTop: 1,
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  userRole: {
    marginTop: 2,
    color: colors.primary,
    opacity: 0.7,
    fontSize: 12,
    fontWeight: '600',
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginLeft: 10,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: colors.primaryContainer,
  },
  navItemPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  navItemDisabled: {
    opacity: 0.55,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  navLabelDisabled: {
    color: colors.onSurface,
  },
  soonBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FCE8EC',
  },
  logoutBtnPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: colors.error,
    fontWeight: '800',
    fontSize: 15,
  },
});
