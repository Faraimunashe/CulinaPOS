import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
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
  const [booting, setBooting] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        const category = await categoryService.getCategoryById(Number(id));
        if (cancelled) return;
        if (!category) {
          setError('Category not found');
          return;
        }
        setName(category.name);
        setSortOrder(String(category.sort_order));
        setActive(category.active === 1);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load category'
          );
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

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootLabel}>Loading category…</Text>
      </View>
    );
  }

  const previewName = name.trim() || 'Untitled category';
  const orderNum = Number.parseInt(sortOrder, 10) || 0;

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
            <Text style={styles.heroBadgeText}>Category</Text>
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            {isEdit ? 'Edit category' : 'New category'}
          </Text>
          <Text style={styles.subtitle}>
            {isEdit
              ? 'Rename, reorder, or show/hide this group on the POS.'
              : 'Group menu items so cashiers can find them quickly.'}
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
                Sort {orderNum} · {active ? 'Visible on POS' : 'Hidden'}
              </Text>
            </View>
            <View style={styles.previewChip}>
              <Text style={styles.previewChipText}>{orderNum}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Details</Text>
          <TextInput
            label="Category name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meals, Drinks"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            label="Sort order"
            mode="outlined"
            keyboardType="number-pad"
            value={sortOrder}
            onChangeText={setSortOrder}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <Text style={styles.fieldHint}>
            Lower numbers appear first in category lists and on the POS.
          </Text>
        </View>

        <View style={styles.switchCard}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Active on POS</Text>
            <Text style={styles.switchHint}>
              Inactive categories are hidden from cashiers.
            </Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            color={colors.primary}
          />
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
            disabled={loading || !name.trim()}
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
                : 'Add category'}
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
  previewChipText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 18,
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
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    gap: 12,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontWeight: '800',
    color: colors.primary,
    fontSize: 15,
  },
  switchHint: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.55,
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
