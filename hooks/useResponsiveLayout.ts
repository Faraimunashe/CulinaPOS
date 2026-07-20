import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 768;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH || width >= 900;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    useSplitPosLayout: isTablet && isLandscape,
  };
}
