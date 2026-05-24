import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  leadingIcon?: React.ComponentProps<typeof Feather>['name'];
  /** Show the trailing chevron-down. */
  showChevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Pill picker for "India" (country) and "English" (language) — Figma frames 1:1614 / 1:1593. */
export function PickerPill({ label, leadingIcon, showChevron = true, onPress, style }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.surfaceInput },
        pressed && { opacity: 0.75 },
        style,
      ]}>
      <View style={styles.left}>
        {leadingIcon ? <Feather name={leadingIcon} size={16} color={theme.text} /> : null}
        <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
      </View>
      {showChevron ? (
        <Feather name="chevron-down" size={18} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 15,
    fontWeight: FontWeight.regular,
  },
});
