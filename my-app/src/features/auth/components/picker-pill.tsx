import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  leadingIcon?: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PickerPill({ label, leadingIcon, onPress, style }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.surfaceMuted },
        pressed && { opacity: 0.75 },
        style,
      ]}>
      <View style={styles.left}>
        {leadingIcon ? <Feather name={leadingIcon} size={18} color={theme.text} /> : null}
        <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
      </View>
      <Feather name="chevron-down" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 28,
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
    fontSize: 16,
    fontWeight: '500',
  },
});
