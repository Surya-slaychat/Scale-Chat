import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInput as TextInputType } from 'react-native';

import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** OTP length used across the auth flow. Figma shows 4 large boxes. */
export const OTP_LENGTH = 4;

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
    const cleaned = raw.replace(/\D/g, '');

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < cleaned.length && index + i < OTP_LENGTH; i += 1) {
        next[index + i] = cleaned[i] ?? '';
      }
      setDigits(next);
      const joined = next.join('');
      onChange?.(joined);
      const focusTarget = Math.min(index + cleaned.length, OTP_LENGTH - 1);
      inputs.current[focusTarget]?.focus();
      if (next.every((d) => d.length === 1)) onComplete?.(joined);
      return;
    }

    setDigitAt(index, cleaned);
    if (cleaned.length === 1 && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, e: { nativeEvent: { key: string } }) {
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
            maxLength={OTP_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            selectTextOnFocus
            style={[
              styles.box,
              {
                backgroundColor: theme.surfaceInput,
                color: theme.text,
                borderColor: filled ? Brand.primary : 'transparent',
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
    gap: 13, // Figma Group 164: 4 boxes (73px) across 330px width → 13px gaps
    justifyContent: 'center',
  },
  box: {
    width: 73,
    height: 87,
    borderRadius: 16,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: FontWeight.bold,
  },
});
