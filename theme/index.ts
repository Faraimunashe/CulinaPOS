import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export const colors = {
  primary: '#1B4332',
  primaryContainer: '#D8F3DC',
  secondary: '#BC6C25',
  secondaryContainer: '#FAEDCD',
  tertiary: '#40916C',
  background: '#F7F4EF',
  surface: '#FFFFFF',
  surfaceVariant: '#E8E4DC',
  error: '#B00020',
  onPrimary: '#FFFFFF',
  onBackground: '#1A1A1A',
  onSurface: '#1A1A1A',
  outline: '#C4BEB4',
  success: '#2D6A4F',
  warning: '#C1121F',
  printerConnected: '#2D6A4F',
  printerDisconnected: '#C1121F',
} as const;

const fontConfig = configureFonts({ config: { fontFamily: 'System' } });

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryContainer,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryContainer,
    tertiary: colors.tertiary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    error: colors.error,
    onPrimary: colors.onPrimary,
    onBackground: colors.onBackground,
    onSurface: colors.onSurface,
    outline: colors.outline,
  },
  roundness: 8,
};
