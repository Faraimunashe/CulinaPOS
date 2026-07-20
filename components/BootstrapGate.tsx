import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { initializeDatabase } from '@/database';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors } from '@/theme';

interface BootstrapGateProps {
  children: React.ReactNode;
}

export function BootstrapGate({ children }: BootstrapGateProps) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const hydrate = useAuthStore((s) => s.hydrate);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initializeDatabase();
        await Promise.all([hydrate(), loadSettings()]);
        if (!cancelled) {
          setReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to initialize the application database.';
          setBootError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrate, loadSettings]);

  if (bootError) {
    return (
      <View style={styles.center}>
        <Text variant="titleMedium" style={styles.errorTitle}>
          Startup Error
        </Text>
        <Text style={styles.errorBody}>{bootError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingLabel}>Starting Culina POS…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  loadingLabel: {
    marginTop: 16,
    color: colors.onBackground,
  },
  errorTitle: {
    color: colors.error,
    marginBottom: 8,
  },
  errorBody: {
    textAlign: 'center',
    color: colors.onBackground,
  },
});
