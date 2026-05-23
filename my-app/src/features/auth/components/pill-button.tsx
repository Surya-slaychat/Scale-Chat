import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PillButton({ label, onPress, loading, disabled, style }: Props) {
  const isInactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading, disabled: isInactive }}
      onPress={() => {
        if (isInactive) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed && !isInactive ? Brand.primaryDeep : Brand.accent },
        isInactive && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={Brand.accentText} />
      ) : (
        <ThemedText style={[styles.label, { color: Brand.accentText }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});
