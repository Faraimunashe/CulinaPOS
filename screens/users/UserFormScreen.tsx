import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as userService from '@/services/userService';
import { colors } from '@/theme';
import type { UserRole } from '@/types';

const ROLE_OPTIONS: {
  value: UserRole;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    value: 'CASHIER',
    title: 'Cashier',
    subtitle: 'Process sales and view products',
    icon: 'cash-register',
  },
  {
    value: 'ADMIN',
    title: 'Administrator',
    subtitle: 'Full access to users, stock, and settings',
    icon: 'shield-account',
  },
];

export function UserFormScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';
  const actorId = useAuthStore((s) => s.user?.id);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        const user = await userService.getUserById(Number(id));
        if (cancelled) return;
        if (!user) {
          setError('User not found');
          return;
        }
        setFullName(user.full_name);
        setUsername(user.username);
        setRole(user.role);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load user');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, isAdmin]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        await userService.updateUser(
          Number(id),
          { full_name: fullName, username, role },
          actorId
        );
      } else {
        await userService.createUser(
          { full_name: fullName, username, password, role },
          actorId
        );
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootLabel}>Loading user…</Text>
      </View>
    );
  }

  const previewName = fullName.trim() || 'New staff member';
  const previewUsername = username.trim()
    ? `@${username.trim().toLowerCase()}`
    : 'No username yet';
  const canSave =
    !!fullName.trim() &&
    !!username.trim() &&
    (isEdit || password.length >= 6);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {role === 'ADMIN' ? 'Administrator' : 'Cashier'}
            </Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            {isEdit ? 'Edit user' : 'New user'}
          </Text>
          <Text style={styles.subtitle}>
            {isEdit
              ? 'Update name, username, or role for this account.'
              : 'Create a login for a cashier or another administrator.'}
          </Text>
        </View>

        {!isEdit ? (
          <View style={styles.previewCard}>
            <View style={styles.previewCopy}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewName} numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={styles.previewMeta}>
                {previewUsername} · {role === 'ADMIN' ? 'Admin' : 'Cashier'}
              </Text>
            </View>
            <View style={styles.previewChip}>
              <MaterialCommunityIcons
                name={role === 'ADMIN' ? 'shield-account' : 'cash-register'}
                size={24}
                color={colors.onPrimary}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Account</Text>
          <TextInput
            label="Full name"
            mode="outlined"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Jane Moyo"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            label="Username"
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            placeholder="login name"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            returnKeyType={isEdit ? 'done' : 'next'}
          />
          {!isEdit ? (
            <>
              <TextInput
                label="Password"
                mode="outlined"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
              />
              <Text style={styles.fieldHint}>
                At least 6 characters. Staff can change it later from their
                profile.
              </Text>
            </>
          ) : (
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.infoBannerText}>
                To reset this user’s password, use Reset password on the users
                list.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Role</Text>
          <Text style={styles.fieldHint}>
            Controls what this person can open in the app.
          </Text>
          <View style={styles.roleList}>
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setRole(option.value)}
                  style={[styles.roleCard, selected && styles.roleCardOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[styles.roleIcon, selected && styles.roleIconOn]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={22}
                      color={selected ? colors.onPrimary : colors.primary}
                    />
                  </View>
                  <View style={styles.roleCopy}>
                    <Text
                      style={[
                        styles.roleTitle,
                        selected && styles.roleTitleOn,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.roleSubtitle,
                        selected && styles.roleSubtitleOn,
                      ]}
                    >
                      {option.subtitle}
                    </Text>
                  </View>
                  <View
                    style={[styles.radioDot, selected && styles.radioDotOn]}
                  >
                    {selected ? <View style={styles.radioDotInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading || !canSave}
            style={styles.save}
            contentStyle={styles.saveContent}
            labelStyle={styles.saveLabel}
          >
            {loading
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Add user'}
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            disabled={loading}
            textColor={colors.primary}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: colors.background,
    flexGrow: 1,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  bootLabel: {
    color: colors.onBackground,
    opacity: 0.7,
  },
  hero: {
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    color: colors.onBackground,
    opacity: 0.65,
    lineHeight: 22,
    fontSize: 15,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  previewCopy: {
    flex: 1,
  },
  previewLabel: {
    color: colors.onPrimary,
    opacity: 0.7,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewName: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  previewMeta: {
    color: colors.onPrimary,
    opacity: 0.8,
    marginTop: 4,
    fontSize: 13,
  },
  previewChip: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardHeading: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 12,
  },
  fieldHint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  infoBanner: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  roleList: {
    gap: 10,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleCardOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconOn: {
    backgroundColor: colors.primary,
  },
  roleCopy: {
    flex: 1,
  },
  roleTitle: {
    fontWeight: '800',
    color: colors.onSurface,
    fontSize: 15,
  },
  roleTitleOn: {
    color: colors.primary,
  },
  roleSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.6,
  },
  roleSubtitleOn: {
    color: colors.primary,
    opacity: 0.8,
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotOn: {
    borderColor: colors.primary,
  },
  radioDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  errorText: {
    marginBottom: 4,
  },
  actions: {
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
  },
  save: {
    borderRadius: 14,
  },
  saveContent: {
    paddingVertical: 6,
  },
  saveLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
});
