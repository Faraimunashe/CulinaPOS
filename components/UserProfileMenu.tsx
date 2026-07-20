import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Menu, Divider, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';
import type { SafeUser } from '@/types';

interface UserProfileMenuProps {
  user: SafeUser;
}

export function UserProfileMenu({ user }: UserProfileMenuProps) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user.role === 'ADMIN';

  const close = () => setVisible(false);

  const handleLogout = async () => {
    close();
    await logout();
    router.replace('/login');
  };

  const go = (href: Href) => {
    close();
    router.push(href);
  };

  return (
    <Menu
      visible={visible}
      onDismiss={close}
      anchor={
        <Pressable
          onPress={() => setVisible(true)}
          style={styles.anchor}
          accessibilityRole="button"
          accessibilityLabel="User menu"
        >
          <IconButton
            icon="account-circle"
            size={28}
            iconColor={colors.primary}
            style={styles.avatar}
          />
          <View>
            <Text variant="titleSmall" style={styles.name}>
              {user.full_name}
            </Text>
            <Text variant="bodySmall" style={styles.role}>
              {user.role === 'ADMIN' ? 'Administrator' : 'Cashier'}
            </Text>
          </View>
          <IconButton
            icon="menu-down"
            size={20}
            iconColor={colors.onSurface}
            style={styles.chevron}
          />
        </Pressable>
      }
      contentStyle={styles.menu}
    >
      <Menu.Item
        leadingIcon="account"
        onPress={() => go('/(app)/profile' as Href)}
        title="Profile"
      />
      <Menu.Item
        leadingIcon="lock-reset"
        onPress={() => go('/(app)/change-password' as Href)}
        title="Change Password"
      />
      {isAdmin ? (
        <>
          <Divider />
          <Menu.Item
            leadingIcon="account-group"
            onPress={() => go('/(app)/users' as Href)}
            title="User Management"
          />
          <Menu.Item
            leadingIcon="food"
            onPress={() => go('/(app)/products' as Href)}
            title="Products"
          />
          <Menu.Item
            leadingIcon="shape"
            onPress={() => go('/(app)/categories' as Href)}
            title="Categories"
          />
          <Menu.Item
            leadingIcon="package-variant"
            onPress={() => go('/(app)/inventory' as Href)}
            title="Inventory"
          />
          <Menu.Item
            leadingIcon="cash-multiple"
            onPress={() => go('/(app)/currencies' as Href)}
            title="Currencies & Rates"
          />
          <Menu.Item
            leadingIcon="cog"
            onPress={() => {
              close();
            }}
            title="Settings"
            disabled
          />
        </>
      ) : null}
      <Divider />
      <Menu.Item leadingIcon="logout" onPress={handleLogout} title="Logout" />
    </Menu>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  avatar: {
    margin: 0,
  },
  chevron: {
    margin: 0,
  },
  name: {
    color: colors.onSurface,
  },
  role: {
    color: colors.primary,
  },
  menu: {
    minWidth: 220,
  },
});
