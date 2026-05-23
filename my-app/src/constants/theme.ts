/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    surfaceMuted: '#F3F4F8',
    surfaceModal: '#FFFFFF',
    inputPlaceholder: '#8A8A92',
    divider: '#E5E6EA',
  },
  dark: {
    text: '#ffffff',
    background: '#0F0F11',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    surfaceMuted: '#1F1F22',
    surfaceModal: '#15151A',
    inputPlaceholder: '#8A8A92',
    divider: '#2A2A2F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Brand tokens — constant across light/dark mode.
 * Reference: Figma file JYhOHnaEDgGYNxJShD9WDK (Account Setup pages).
 */
export const Brand = {
  primary: '#5B6BEE',        // purple — headers, welcome card base, badge
  primaryDeep: '#4757D9',    // pressed state
  accent: '#C7F73B',         // lime — primary CTA fill
  accentText: '#101012',     // dark text on lime
  cardWelcome: '#6F7FE8',    // lighter purple for the welcome card
  outlineDark: '#FFFFFF',    // outlined CTA border on dark background
  outlineLight: '#101012',   // outlined CTA border on light background
} as const;

export type BrandColor = keyof typeof Brand;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
