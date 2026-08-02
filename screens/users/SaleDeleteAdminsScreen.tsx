import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as saleDeleteAdminService from '@/services/saleDeleteAdminService';
import type { SaleDeleteAdminRow } from '@/services/saleDeleteAdminService';
import { colors } from '@/theme';
import type { SafeUser } from '@/types';

export function SaleDeleteAdminsScreen() {
  const isAdmin = useRequireAdmin();
  const actorId = useAuthStore((s) => s.user?.id);

  const [admins, setAdmins] = useState<SaleDeleteAdminRow[]>([]);
  const [eligible, setEligible] = useState<SafeUser[]>([]);
  const [empty, setEmpty] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!actorId) return;
    setLoading(true);
    try {
      const [rows, emptyTable, manage, deletePriv, candidates] =
        await Promise.all([
          saleDeleteAdminService.listSaleDeleteAdmins(),
          saleDeleteAdminService.isSaleDeleteAdminsEmpty(),
          saleDeleteAdminService.canManageSaleDeleteAdmins(actorId),
          saleDeleteAdminService.canDeleteSales(actorId),
          saleDeleteAdminService.listEligibleAdmins(),
        ]);
      setAdmins(rows);
      setEmpty(emptyTable);
      setCanManage(manage);
      setCanDelete(deletePriv);
      setEligible(candidates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load])
  );

  if (!isAdmin) return null;

  const selfGrant = async () => {
    if (!actorId) return;
    setBusy(true);
    try {
      await saleDeleteAdminService.grantSaleDeleteAdmin(actorId, actorId);
      setSnack('You can now delete sales');
      await load();
    } catch (err) {
      Alert.alert(
        'Could not grant',
        err instanceof Error ? err.message : 'Unexpected error'
      );
    } finally {
      setBusy(false);
    }
  };

  const grant = async (user: SafeUser) => {
    if (!actorId) return;
    setBusy(true);
    try {
      await saleDeleteAdminService.grantSaleDeleteAdmin(user.id, actorId);
      setSnack(`${user.full_name} can now delete sales`);
      await load();
    } catch (err) {
      Alert.alert(
        'Could not grant',
        err instanceof Error ? err.message : 'Unexpected error'
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (row: SaleDeleteAdminRow) => {
    if (!actorId) return;
    Alert.alert(
      'Remove delete access?',
      `Remove ${row.full_name} from sale-delete admins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await saleDeleteAdminService.revokeSaleDeleteAdmin(
                  row.user_id,
                  actorId
                );
                setSnack(`Removed ${row.full_name}`);
                await load();
              } catch (err) {
                Alert.alert(
                  'Could not remove',
                  err instanceof Error ? err.message : 'Unexpected error'
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.title}>
          Sale delete access
        </Text>
        <Text style={styles.subtitle}>
          Only these admins can permanently delete sales. Reverse stays
          available to every admin.
        </Text>
      </View>

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {empty && canManage ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No delete admins yet</Text>
                  <Text style={styles.emptyBody}>
                    Any admin can claim this privilege for themselves once.
                    After that, only delete admins can add others.
                  </Text>
                  <Button
                    mode="contained"
                    onPress={() => void selfGrant()}
                    loading={busy}
                    disabled={busy}
                    style={styles.selfBtn}
                  >
                    Become a sale-delete admin
                  </Button>
                </View>
              ) : null}

              {!empty && !canDelete ? (
                <Text style={styles.lockedNote}>
                  You can view this list, but only existing sale-delete admins
                  can change who has access.
                </Text>
              ) : null}

              {admins.length > 0 ? (
                <Text style={styles.sectionLabel}>Delete admins</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            empty ? null : (
              <Text style={styles.emptyBody}>No delete admins listed.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name="shield-account"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>{item.full_name}</Text>
                <Text style={styles.rowMeta}>@{item.username}</Text>
              </View>
              {canDelete && admins.length > 1 ? (
                <Pressable
                  onPress={() => void revoke(item)}
                  disabled={busy}
                  hitSlop={8}
                >
                  <Text style={styles.revokeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            canDelete && eligible.length > 0 ? (
              <View style={styles.footerBlock}>
                <Text style={styles.sectionLabel}>Add admin</Text>
                {eligible.map((user) => (
                  <Pressable
                    key={user.id}
                    onPress={() => void grant(user)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <MaterialCommunityIcons
                        name="account-plus-outline"
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowName}>{user.full_name}</Text>
                      <Text style={styles.rowMeta}>@{user.username}</Text>
                    </View>
                    <Text style={styles.addText}>Add</Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
        />
      )}

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={2800}
      >
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 14,
    lineHeight: 20,
  },
  error: { marginHorizontal: 16 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  headerBlock: { gap: 12, marginBottom: 8 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    gap: 10,
  },
  emptyTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.primary,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
    opacity: 0.55,
  },
  selfBtn: { borderRadius: 12, marginTop: 4 },
  lockedNote: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurface,
    opacity: 0.5,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  rowPressed: { opacity: 0.9 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowName: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.onSurface,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.45,
  },
  revokeText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
  addText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  footerBlock: { marginTop: 8 },
});
