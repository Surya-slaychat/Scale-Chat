import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInput as TextInputType } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const OTP_LENGTH = 6;

export type OtpInputGroupHandle = {
  clear: () => void;
  focus: () => void;
};

type Props = {
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
};

export const OtpInputGroup = forwardRef<OtpInputGroupHandle, Props>(function OtpInputGroup(
  { onChange, onComplete },
  ref
) {
  const theme = useTheme();
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const inputs = useRef<(TextInputType | null)[]>([]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    },
    focus: () => inputs.current[0]?.focus(),
  }));

  function setDigitAt(index: number, value: string) {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    const joined = next.join('');
    onChange?.(joined);
    if (joined.length === OTP_LENGTH && next.every((d) => d.length === 1)) {
      onComplete?.(joined);
    }
  }

  function handleChange(index: number, raw: string) {
    // Strip non-digits the user may have typed.
    const cleaned = raw.replace(/\D/g, '');

    // Pasted multi-digit value: spread across boxes from the current index.
    if (cleaned.length > 1) {
      const next = [...digits];
      const startsAt = index;
      for (let i = 0; i < cleaned.length && startsAt + i < OTP_LENGTH; i += 1) {
        next[startsAt + i] = cleaned[i] ?? '';
      }
      setDigits(next);
      const joined = next.join('');
      onChange?.(joined);
      const filledLen = next.filter((d) => d.length === 1).length;
      const focusTarget = Math.min(startsAt + cleaned.length, OTP_LENGTH - 1);
      inputs.current[focusTarget]?.focus();
      if (filledLen === OTP_LENGTH) onComplete?.(joined);
      return;
    }

    setDigitAt(index, cleaned);
    if (cleaned.length === 1 && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(
    index: number,
    e: { nativeEvent: { key: string } }
  ) {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigitAt(index - 1, '');
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((value, i) => {
        const filled = value.length === 1;
        return (
          <TextInput
            key={`otp-${i}`}
            ref={(node) => {
              inputs.current[i] = node;
            }}
            value={value}
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={(e) => handleKeyPress(i, e)}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH /* allow paste; we slice ourselves */}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            selectTextOnFocus
            style={[
              styles.box,
              {
                backgroundColor: theme.surfaceMuted,
                color: theme.text,
                borderColor: filled ? Brand.primary : 'transparent',
                borderWidth: filled ? 1.5 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
});
