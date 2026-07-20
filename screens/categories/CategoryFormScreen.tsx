import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as categoryService from '@/services/categoryService';
import { colors } from '@/theme';

export function CategoryFormScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id && id !== 'new';
  const actorId = useAuthStore((s) => s.user?.id);

  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !isAdmin) return;
    (async () => {
      try {
        const category = await categoryService.getCategoryById(Number(id));
        if (!category) {
          setError('Category not found');
          return;
        }
        setName(category.name);
        setSortOrder(String(category.sort_order));
        setActive(category.active === 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load category');
      }
    })();
  }, [id, isEdit, isAdmin]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    if (!actorId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        sort_order: Number.parseInt(sortOrder, 10) || 0,
        active,
      };
      if (isEdit) {
        await categoryService.updateCategory(Number(id), payload, actorId);
      } else {
        await categoryService.createCategory(payload, actorId);
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
        {isEdit ? 'Edit category' : 'New category'}
      </Text>

      <TextInput
        label="Name"
        mode="outlined"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        label="Sort order"
        mode="outlined"
        keyboardType="number-pad"
        value={sortOrder}
        onChangeText={setSortOrder}
        style={styles.input}
      />

      <View style={styles.switchRow}>
        <Text variant="bodyLarge">Active</Text>
        <Switch value={active} onValueChange={setActive} />
      </View>

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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  save: {
    marginTop: 8,
    marginBottom: 8,
  },
});
