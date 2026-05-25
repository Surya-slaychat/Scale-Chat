/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeMode } from '@/hooks/use-theme-mode';

export function useTheme() {
  const scheme = useColorScheme();
  const { mode } = useThemeMode();
  const resolved =
    mode === 'system' ? (scheme === 'unspecified' ? 'light' : scheme) : mode;

  return Colors[resolved];
}
