import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatMemberSince(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface DetailRowProps {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}

function DetailRow({ icon, label, value, last = false }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return null;
  }

  const isAdmin = user.role === 'ADMIN';
  const isActive = user.status === 'ACTIVE';
  const memberSince = formatMemberSince(user.created_at);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.full_name)}</Text>
        </View>
        <Text style={styles.name}>{user.full_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeCashier]}>
            <MaterialCommunityIcons
              name={isAdmin ? 'shield-crown-outline' : 'account-cash-outline'}
              size={14}
              color={isAdmin ? colors.primary : colors.secondary}
            />
            <Text
              style={[
                styles.badgeText,
                isAdmin ? styles.badgeTextAdmin : styles.badgeTextCashier,
              ]}
            >
              {isAdmin ? 'Administrator' : 'Cashier'}
            </Text>
          </View>
          <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeDisabled]}>
            <View
              style={[styles.statusDot, isActive ? styles.dotActive : styles.dotDisabled]}
            />
            <Text
              style={[
                styles.badgeText,
                isActive ? styles.badgeTextActive : styles.badgeTextDisabled,
              ]}
            >
              {isActive ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Account details</Text>
      <View style={styles.card}>
        <DetailRow icon="account-outline" label="Full name" value={user.full_name} />
        <DetailRow icon="at" label="Username" value={user.username} />
        <DetailRow
          icon="shield-account-outline"
          label="Role"
          value={isAdmin ? 'Administrator' : 'Cashier'}
        />
        {memberSince ? (
          <DetailRow
            icon="calendar-outline"
            label="Member since"
            value={memberSince}
            last
          />
        ) : (
          <DetailRow
            icon="check-circle-outline"
            label="Status"
            value={isActive ? 'Active' : 'Disabled'}
            last
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>Security</Text>
      <Pressable
        onPress={() => router.push('/(app)/change-password' as Href)}
        style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
        accessibilityRole="button"
        accessibilityLabel="Change password"
      >
        <View style={styles.actionIcon}>
          <MaterialCommunityIcons name="lock-reset" size={22} color={colors.primary} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>Change password</Text>
          <Text style={styles.actionBody}>Keep your account secure</Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={colors.outline}
        />
      </Pressable>
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
    paddingBottom: 40,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 30,
    letterSpacing: 0.5,
  },
  name: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  username: {
    marginTop: 4,
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeAdmin: {
    backgroundColor: colors.primaryContainer,
  },
  badgeCashier: {
    backgroundColor: colors.secondaryContainer,
  },
  badgeActive: {
    backgroundColor: colors.primaryContainer,
  },
  badgeDisabled: {
    backgroundColor: '#FCE8EC',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeTextAdmin: {
    color: colors.primary,
  },
  badgeTextCashier: {
    color: colors.secondary,
  },
  badgeTextActive: {
    color: colors.success,
  },
  badgeTextDisabled: {
    color: colors.error,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.success,
  },
  dotDisabled: {
    backgroundColor: colors.error,
  },
  sectionTitle: {
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
    opacity: 0.45,
  },
  detailValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  actionCardPressed: {
    backgroundColor: colors.primaryContainer,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  actionBody: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.5,
  },
});
