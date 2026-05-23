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
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const PillInput = forwardRef<TextInputType, Props>(function PillInput(
  { prefix, containerStyle, style, ...rest },
  ref
) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceMuted }, containerStyle]}>
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
    height: 56,
    borderRadius: 28,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
});
