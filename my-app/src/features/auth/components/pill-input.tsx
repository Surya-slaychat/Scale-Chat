import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInput as TextInputType,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Pill-shaped text input — matches Figma phone / profile field:
 * 54-tall, radius 32, fill #383838, placeholder #6E6E6E.
 */
export const PillInput = forwardRef<TextInputType, Props>(function PillInput(
  { prefix, containerStyle, style, ...rest },
  ref
) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceInput }, containerStyle]}>
      {prefix ? (
        <ThemedText style={[styles.prefix, { color: theme.text }]}>{prefix}</ThemedText>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.inputPlaceholder}
        style={[styles.input, { color: theme.text }, style]}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 54,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  prefix: {
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.regular,
    paddingVertical: 0,
  },
});
