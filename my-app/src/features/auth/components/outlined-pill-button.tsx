import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function OutlinedPillButton({ label, onPress, disabled, style }: Props) {
  const scheme = useColorScheme();
  const theme = useTheme();
  const border = scheme === 'dark' ? Brand.outlineDark : Brand.outlineLight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { borderColor: border, backgroundColor: pressed ? theme.surfaceMuted : 'transparent' },
        disabled && styles.disabled,
        style,
      ]}>
      <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
});
