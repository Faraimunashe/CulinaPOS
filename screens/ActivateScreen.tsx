import { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useLicenseStore } from '@/stores/licenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

export function ActivateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { useSplitPosLayout, width, isLandscape } = useResponsiveLayout();
  const restaurantName = useSettingsStore((s) => s.restaurantName);
  const activate = useLicenseStore((s) => s.activate);
  const isLoading = useLicenseStore((s) => s.isLoading);
  const error = useLicenseStore((s) => s.error);
  const clearError = useLicenseStore((s) => s.clearError);

  const [key, setKey] = useState('');
  const [mounted, setMounted] = useState(false);

  const split = useSplitPosLayout || (width >= 900 && isLandscape);
  const canSubmit = !!key.trim() && !isLoading;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleActivate = async () => {
    clearError();
    if (!key.trim()) return;
    try {
      await activate(key);
      router.replace('/login');
    } catch {
      // handled via licenseStore.error
    }
  };

  const brandBlock = (
    <View style={[styles.brandInner, split && styles.brandInnerSplit]}>
      <Animated.View
        entering={mounted ? FadeIn.duration(500) : undefined}
        style={styles.mark}
      >
        <Image
          source={require('../assets/mylogo-no-bg.png')}
          style={[styles.brandLogo, split && styles.brandLogoSplit]}
          resizeMode="contain"
          accessibilityLabel="Culina POS logo"
        />
      </Animated.View>

      <Animated.Text
        entering={mounted ? FadeInUp.delay(80).duration(520) : undefined}
        style={[styles.brandName, split && styles.brandNameSplit]}
      >
        {restaurantName}
      </Animated.Text>

      <Animated.Text
        entering={mounted ? FadeInUp.delay(160).duration(520) : undefined}
        style={[styles.brandLine, split && styles.brandLineSplit]}
      >
        Enter your production license key to unlock this installation.
      </Animated.Text>
    </View>
  );

  const formBlock = (
    <Animated.View
      entering={mounted ? FadeInDown.delay(120).duration(520) : undefined}
      style={[styles.formWrap, split && styles.formWrapSplit]}
    >
      <Text style={styles.welcome}>License required</Text>
      <Text style={styles.formTitle}>Activate Culina POS</Text>
      <Text style={styles.formHint}>
        Contact your provider for today’s activation key, then enter it below.
      </Text>

      <View style={styles.field}>
        <TextInput
          label="Activation key"
          mode="outlined"
          value={key}
          onChangeText={(value) => {
            clearError();
            setKey(value);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          disabled={isLoading}
          onSubmitEditing={() => void handleActivate()}
        />
      </View>

      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={() => void handleActivate()}
        loading={isLoading}
        disabled={!canSubmit}
        style={styles.submit}
        contentStyle={styles.submitContent}
        labelStyle={styles.submitLabel}
      >
        Activate
      </Button>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.primary, '#2D6A4F', '#40916C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 24),
            },
            split && styles.scrollSplit,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {split ? (
            <View style={styles.splitRow}>
              <View style={styles.splitBrand}>{brandBlock}</View>
              <View style={styles.splitForm}>{formBlock}</View>
            </View>
          ) : (
            <>
              {brandBlock}
              {formBlock}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  scrollSplit: {
    paddingHorizontal: 40,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  splitBrand: { flex: 1 },
  splitForm: { flex: 1, maxWidth: 420 },
  brandInner: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandInnerSplit: {
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  mark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  brandLogo: {
    width: 76,
    height: 76,
  },
  brandLogoSplit: {
    width: 88,
    height: 88,
  },
  brandName: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  brandNameSplit: {
    textAlign: 'left',
    fontSize: 40,
  },
  brandLine: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  brandLineSplit: {
    textAlign: 'left',
    maxWidth: 380,
    fontSize: 16,
  },
  formWrap: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
  },
  formWrapSplit: {
    padding: 28,
  },
  welcome: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  formTitle: {
    marginTop: 6,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.3,
  },
  formHint: {
    marginTop: 8,
    marginBottom: 20,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 14,
    lineHeight: 20,
  },
  field: { marginBottom: 8 },
  input: { backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  error: { marginBottom: 4 },
  submit: {
    marginTop: 12,
    borderRadius: 14,
  },
  submitContent: { paddingVertical: 6 },
  submitLabel: { fontWeight: '800', fontSize: 16 },
});
