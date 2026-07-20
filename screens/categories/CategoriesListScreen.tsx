import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Searchbar,
  Snackbar,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { useAuthStore } from '@/stores/authStore';
import * as categoryService from '@/services/categoryService';
import { colors } from '@/theme';
import type { Category } from '@/types';

export function CategoriesListScreen() {
  const isAdmin = useRequireAdmin();
  const router = useRouter();
  const actorId = useAuthStore((s) => s.user?.id);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await categoryService.listCategories());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
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

  const filtered = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const goNew = () => router.push('/(app)/categories/new' as Href);

  const toggleActive = async (category: Category) => {
    if (!actorId) return;
    try {
      await categoryService.setCategoryActive(
        category.id,
        category.active !== 1,
        actorId
      );
      setSnack(category.active === 1 ? 'Category disabled' : 'Category enabled');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.heroTitle}>
          Categories
        </Text>
        <Pressable
          onPress={goNew}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && styles.addBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add category"
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
          ListEmptyComponent={
            <Text style={styles.empty}>No categories</Text>
          }
          renderItem={({ item }) => {
            const active = item.active === 1;
            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push(`/(app)/categories/${item.id}` as Href)
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconWrap}>
                    <MaterialCommunityIcons
                      name="shape-outline"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.cardText}>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardMeta}>Order {item.sort_order}</Text>
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

                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => toggleActive(item)}
                    style={styles.actionBtn}
                  >
                    {active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() =>
                      router.push(`/(app)/categories/${item.id}` as Href)
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: '700' },
  cardMeta: {
    marginTop: 2,
    opacity: 0.6,
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
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
    gap: 8,
    marginTop: 14,
  },
  actionBtn: { borderRadius: 10 },
  error: { marginHorizontal: 16 },
});
