import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text variant="headlineSmall" style={styles.heading}>
        Change Password
      </Text>

      <TextInput
        label="Current password"
        mode="outlined"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        style={styles.input}
        disabled={loading}
      />
      <TextInput
        label="New password"
        mode="outlined"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
        disabled={loading}
      />
      <TextInput
        label="Confirm new password"
        mode="outlined"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
        disabled={loading}
      />

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      {success ? (
        <HelperText type="info" visible style={styles.success}>
          Password updated
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Update
      </Button>
      <Button mode="text" onPress={() => router.back()} disabled={loading}>
        Back
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  button: {
    marginTop: 8,
    marginBottom: 8,
  },
  success: {
    color: colors.success,
  },
});
