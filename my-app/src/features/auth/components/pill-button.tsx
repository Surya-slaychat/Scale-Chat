import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The lime "Get Started / Next / Done" CTA — pixel-spec from Figma:
 * height 53, radius 26.5, fill #E2FA61, label Poppins-Medium 19.7.
 */
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
    height: 53,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.5,
  },
});
