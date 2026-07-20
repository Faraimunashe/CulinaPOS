import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  RadioButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as userService from '@/services/userService';
import { colors } from '@/theme';
import type { UserRole } from '@/types';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !isAdmin) return;
    (async () => {
      try {
        const user = await userService.getUserById(Number(id));
        if (!user) {
          setError('User not found');
          return;
        }
        setFullName(user.full_name);
        setUsername(user.username);
        setRole(user.role);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      }
    })();
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

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.title}>
        {isEdit ? 'Edit user' : 'New user'}
      </Text>

      <TextInput
        label="Full name"
        mode="outlined"
        value={fullName}
        onChangeText={setFullName}
        style={styles.input}
      />
      <TextInput
        label="Username"
        mode="outlined"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      {!isEdit ? (
        <TextInput
          label="Password"
          mode="outlined"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
      ) : null}

      <Text variant="titleSmall" style={styles.section}>
        Role
      </Text>
      <RadioButton.Group
        onValueChange={(value) => setRole(value as UserRole)}
        value={role}
      >
        <View style={styles.radioRow}>
          <RadioButton.Item label="Cashier" value="CASHIER" />
          <RadioButton.Item label="Admin" value="ADMIN" />
        </View>
      </RadioButton.Group>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        disabled={loading}
        style={styles.save}
      >
        Save
      </Button>
      <Button onPress={() => router.back()} disabled={loading}>
        Cancel
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 20,
    backgroundColor: colors.background,
    flexGrow: 1,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
    color: colors.onSurface,
  },
  radioRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 12,
  },
  save: {
    marginTop: 8,
    marginBottom: 8,
  },
});
