import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Searchbar,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { BottomSheetModal } from '@/components/BottomSheetModal';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as userService from '@/services/userService';
import { colors } from '@/theme';
import type { SafeUser } from '@/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UsersListScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await userService.listUsers();
      setUsers(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  if (!isAdmin) return null;

  const filtered = users.filter((user) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      user.full_name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    );
  });

  const goNew = () => router.push('/(app)/users/new' as Href);

  const toggleStatus = async (user: SafeUser) => {
    if (!actorId) return;
    try {
      const next = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await userService.setUserStatus(user.id, next, actorId);
      setSnack(next === 'ACTIVE' ? 'User enabled' : 'User disabled');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const handleResetPassword = async () => {
    if (!actorId || !resetTarget) return;
    setResetting(true);
    try {
      await userService.resetUserPassword(
        resetTarget.id,
        newPassword,
        actorId
      );
      setSnack(`Password reset for ${resetTarget.username}`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Users
        </Text>
        <Pressable
          onPress={goNew}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && styles.addBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add user"
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <Searchbar
        placeholder="Search…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No users</Text>}
          renderItem={({ item }) => {
            const active = item.status === 'ACTIVE';
            const isSelf = item.id === actorId;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/(app)/users/${item.id}` as Href)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(item.full_name)}</Text>
                  </View>
                  <View style={styles.cardText}>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {item.full_name}
                    </Text>
                    <Text style={styles.cardMeta}>@{item.username}</Text>
                  </View>
                  <View style={styles.badges}>
                    <View
                      style={[
                        styles.badge,
                        item.role === 'ADMIN'
                          ? styles.badgeRoleAdmin
                          : styles.badgeRoleCashier,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          item.role === 'ADMIN'
                            ? styles.badgeRoleAdminText
                            : styles.badgeRoleCashierText,
                        ]}
                      >
                        {item.role === 'ADMIN' ? 'Admin' : 'Cashier'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        active ? styles.badgeOn : styles.badgeOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          !active && styles.badgeTextOff,
                        ]}
                      >
                        {active ? 'Active' : 'Off'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    compact
                    disabled={isSelf}
                    onPress={() => void toggleStatus(item)}
                    style={styles.actionBtn}
                  >
                    {active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => {
                      setNewPassword('');
                      setResetTarget(item);
                    }}
                    style={styles.actionBtn}
                  >
                    Reset PW
                  </Button>
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() =>
                      router.push(`/(app)/users/${item.id}` as Href)
                    }
                    style={styles.actionBtn}
                  >
                    Edit
                  </Button>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      <BottomSheetModal
        visible={!!resetTarget}
        title="Reset password"
        onDismiss={() => {
          setResetTarget(null);
          setNewPassword('');
        }}
        primaryLabel="Reset"
        onPrimary={() => void handleResetPassword()}
        primaryDisabled={newPassword.length < 6}
        primaryLoading={resetting}
      >
        {resetTarget ? (
          <Text variant="titleMedium" style={styles.sheetName}>
            {resetTarget.full_name}
          </Text>
        ) : null}
        <TextInput
          label="New password"
          mode="outlined"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.sheetInput}
        />
      </BottomSheetModal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTitle: {
    color: colors.primary,
    fontWeight: '800',
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  addBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  search: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
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
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: '700' },
  cardMeta: {
    marginTop: 2,
    opacity: 0.6,
    fontSize: 13,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeRoleAdmin: { backgroundColor: colors.secondaryContainer },
  badgeRoleCashier: { backgroundColor: colors.surfaceVariant },
  badgeRoleAdminText: { color: colors.secondary },
  badgeRoleCashierText: { color: colors.onSurface, opacity: 0.7 },
  badgeOn: { backgroundColor: colors.primaryContainer },
  badgeOff: { backgroundColor: colors.surfaceVariant },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeTextOff: {
    color: colors.onSurface,
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: { borderRadius: 10 },
  error: { marginHorizontal: 16 },
  sheetName: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetInput: {
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
});
