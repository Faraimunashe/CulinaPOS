import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  HelperText,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { changePassword } from '@/services/authService';
import { colors } from '@/theme';

export function ChangePasswordScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;
  const canSubmit =
    !!currentPassword &&
    newPassword.length >= 6 &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!user) {
      setError('Not signed in');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePassword(user.id, currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.heroBadgeText}>Security</Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            Change password
          </Text>
          <Text style={styles.subtitle}>
            {user
              ? `Update the login password for ${user.full_name}.`
              : 'Update your login password.'}
          </Text>
        </View>

        {success ? (
          <View style={styles.successCard}>
            <MaterialCommunityIcons
              name="check-circle"
              size={28}
              color={colors.success}
            />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successBody}>
                Use your new password the next time you sign in.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Current password</Text>
          <TextInput
            label="Current password"
            mode="outlined"
            secureTextEntry={!showCurrent}
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              setSuccess(false);
            }}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            disabled={loading}
            autoCapitalize="none"
            autoCorrect={false}
            right={
              <TextInput.Icon
                icon={showCurrent ? 'eye-off' : 'eye'}
                onPress={() => setShowCurrent((v) => !v)}
                disabled={loading}
              />
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>New password</Text>
          <Text style={styles.fieldHint}>
            Choose something at least 6 characters long.
          </Text>
          <TextInput
            label="New password"
            mode="outlined"
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setSuccess(false);
            }}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            disabled={loading}
            autoCapitalize="none"
            autoCorrect={false}
            right={
              <TextInput.Icon
                icon={showNew ? 'eye-off' : 'eye'}
                onPress={() => setShowNew((v) => !v)}
                disabled={loading}
              />
            }
          />
          <TextInput
            label="Confirm new password"
            mode="outlined"
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setSuccess(false);
            }}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            disabled={loading}
            autoCapitalize="none"
            autoCorrect={false}
            right={
              <TextInput.Icon
                icon={showConfirm ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirm((v) => !v)}
                disabled={loading}
              />
            }
          />
          {confirmPassword.length > 0 ? (
            <View style={styles.matchRow}>
              <MaterialCommunityIcons
                name={passwordsMatch ? 'check-circle' : 'alert-circle'}
                size={16}
                color={passwordsMatch ? colors.success : colors.secondary}
              />
              <Text
                style={[
                  styles.matchText,
                  {
                    color: passwordsMatch ? colors.success : colors.secondary,
                  },
                ]}
              >
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.save}
            contentStyle={styles.saveContent}
            labelStyle={styles.saveLabel}
          >
            {loading ? 'Updating…' : 'Update password'}
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            disabled={loading}
            textColor={colors.primary}
          >
            Back
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
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
  successCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primaryContainer,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  successCopy: {
    flex: 1,
  },
  successTitle: {
    color: colors.success,
    fontWeight: '800',
    fontSize: 16,
  },
  successBody: {
    marginTop: 4,
    color: colors.primary,
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
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
  fieldHint: {
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '600',
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
