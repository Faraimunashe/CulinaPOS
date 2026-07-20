import { Redirect, Stack, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { AppDrawer } from '@/components/AppDrawer';
import { AppHeader } from '@/components/AppHeader';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          header: ({ route, navigation }) => {
            const isHome = route.name === 'index';
            return (
              <AppHeader
                showBack={!isHome && navigation.canGoBack()}
                onBack={() => router.back()}
              />
            );
          },
        }}
      />
      <AppDrawer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
