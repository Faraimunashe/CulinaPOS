import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BootstrapGate } from '@/components/BootstrapGate';
import { appTheme } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PaperProvider
          theme={appTheme}
          settings={{
            icon: ({ name, color, size, ...rest }) => (
              <MaterialCommunityIcons
                name={name as keyof typeof MaterialCommunityIcons.glyphMap}
                color={color}
                size={size}
                {...rest}
              />
            ),
          }}
        >
          <BootstrapGate>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(app)" />
            </Stack>
          </BootstrapGate>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
