import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { useSplitPosLayout, width, isLandscape } = useResponsiveLayout();
  const restaurantName = useSettingsStore((s) => s.restaurantName);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const split = useSplitPosLayout || (width >= 900 && isLandscape);
  const canSubmit = !!username.trim() && !!password && !isLoading;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async () => {
    clearError();
    if (!username.trim() || !password) return;

    try {
      await login(username, password);
      router.replace('/(app)');
    } catch {
      // handled via authStore.error
    }
  };

  const brandBlock = (
    <View style={[styles.brandInner, split && styles.brandInnerSplit]}>
      <Animated.View
        entering={mounted ? FadeIn.duration(500) : undefined}
        style={styles.mark}
      >
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={split ? 36 : 30}
          color={colors.onPrimary}
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
        Fast service. Offline-ready. Built for the floor.
      </Animated.Text>

      {split ? (
        <Animated.View
          entering={mounted ? FadeIn.delay(280).duration(600) : undefined}
          style={styles.brandMeta}
        >
          <View style={styles.metaPill}>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>Works without internet</Text>
          </View>
          <View style={styles.metaPill}>
            <MaterialCommunityIcons
              name="tablet-dashboard"
              size={14}
              color="rgba(255,255,255,0.85)"
            />
            <Text style={styles.metaText}>Tablet & phone ready</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );

  const formBlock = (
    <Animated.View
      entering={mounted ? FadeInDown.delay(120).duration(520) : undefined}
      style={[styles.formWrap, split && styles.formWrapSplit]}
    >
      <Text style={styles.welcome}>Welcome back</Text>
      <Text style={styles.formTitle}>Sign in to continue</Text>
      <Text style={styles.formHint}>
        Use your staff username and password to open the till.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          mode="outlined"
          value={username}
          onChangeText={(value) => {
            clearError();
            setUsername(value);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          activeOutlineColor={colors.primary}
          outlineColor={colors.outline}
          left={<TextInput.Icon icon="account-outline" color={colors.primary} />}
          disabled={isLoading}
          returnKeyType="next"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          mode="outlined"
          value={password}
          onChangeText={(value) => {
            clearError();
            setPassword(value);
          }}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          activeOutlineColor={colors.primary}
          outlineColor={colors.outline}
          left={<TextInput.Icon icon="lock-outline" color={colors.primary} />}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setShowPassword((v) => !v)}
              forceTextInputFocus={false}
            />
          }
          disabled={isLoading}
          onSubmitEditing={() => {
            if (canSubmit) void handleLogin();
          }}
          returnKeyType="go"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color={colors.error}
          />
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={() => void handleLogin()}
        loading={isLoading}
        disabled={!canSubmit}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        buttonColor={colors.primary}
      >
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>

      <View style={styles.footerNote}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={16}
          color={colors.tertiary}
        />
        <Text style={styles.footerNoteText}>
          Session stays on this device · no cloud required
        </Text>
      </View>
    </Animated.View>
  );

  if (split) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0D2818', colors.primary, '#2D6A4F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroPane, { paddingTop: insets.top + 32 }]}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroPattern} />
          {brandBlock}
          <Text style={[styles.heroFooter, { paddingBottom: insets.bottom + 20 }]}>
            Culina POS
          </Text>
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.formPane}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.formScroll,
              {
                paddingTop: Math.max(insets.top, 40),
                paddingBottom: Math.max(insets.bottom, 32),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formBlock}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#E8F5E9', colors.background, '#F7F4EF']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.mobileScroll,
          {
            paddingTop: Math.max(insets.top, 28),
            paddingBottom: Math.max(insets.bottom, 28),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#0D2818', colors.primary, '#40916C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mobileHero}
        >
          <View style={styles.heroGlow} />
          {brandBlock}
        </LinearGradient>

        <View style={styles.mobileFormCard}>{formBlock}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  heroPane: {
    flex: 1.05,
    paddingHorizontal: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(216,243,220,0.14)',
    top: '18%',
    right: -60,
  },
  heroPattern: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    bottom: -80,
    left: -100,
  },
  brandInner: {
    alignItems: 'center',
  },
  brandInnerSplit: {
    alignItems: 'flex-start',
    maxWidth: 420,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  brandName: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 40,
  },
  brandNameSplit: {
    fontSize: 44,
    lineHeight: 50,
    textAlign: 'left',
  },
  brandLine: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 280,
  },
  brandLineSplit: {
    textAlign: 'left',
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 360,
  },
  brandMeta: {
    marginTop: 28,
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#95D5B2',
  },
  metaText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroFooter: {
    position: 'absolute',
    left: 40,
    bottom: 0,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  formPane: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  formScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  formWrap: {
    width: '100%',
    maxWidth: 400,
  },
  formWrapSplit: {
    alignSelf: 'center',
  },
  welcome: {
    color: colors.tertiary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  formTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  formHint: {
    marginTop: 8,
    marginBottom: 28,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    marginBottom: 6,
    marginLeft: 2,
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 13,
    opacity: 0.7,
  },
  input: {
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FCE8EC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    margin: 0,
    paddingVertical: 4,
  },
  button: {
    marginTop: 10,
    borderRadius: 14,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  buttonLabel: {
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  footerNote: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerNoteText: {
    color: colors.onSurface,
    opacity: 0.45,
    fontSize: 12,
    fontWeight: '600',
  },
  mobileScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 18,
  },
  mobileHero: {
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 36,
    overflow: 'hidden',
    minHeight: 210,
    justifyContent: 'center',
  },
  mobileFormCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    shadowColor: '#1B4332',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
});
