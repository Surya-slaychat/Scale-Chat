import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { BrandModal } from '@/features/auth/components/brand-modal';
import { OutlinedPillButton } from '@/features/auth/components/outlined-pill-button';
import { PickerPill } from '@/features/auth/components/picker-pill';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { AuthCopy } from '@/features/auth/copy';
import { useOtpMock } from '@/features/auth/hooks/use-otp-mock';
import { useTheme } from '@/hooks/use-theme';
import { digitsOnly, formatIndianMobile, isValidIndianMobile, toE164India } from '@/lib/phone';

export default function PhoneScreen() {
  const router = useRouter();
  const theme = useTheme();
  const inputRef = useRef<TextInput | null>(null);
  const { requestOtp, isSending } = useOtpMock();

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isValid = isValidIndianMobile(value);

  function handleNext() {
    setError(null);
    if (!isValid) {
      setError(AuthCopy.phone.invalidNumber);
      return;
    }
    setConfirmOpen(true);
  }

  async function handleGetCode() {
    const e164 = toE164India(value);
    if (!e164) return;
    setConfirmOpen(false);
    const result = await requestOtp(e164);
    if (result.ok) {
      router.push({ pathname: '/otp', params: { phone: e164 } });
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: Brand.primary }]}>
            {AuthCopy.phone.title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {AuthCopy.phone.subtitle(AuthCopy.brand)}
          </ThemedText>
        </View>

        <View style={styles.fields}>
          <PickerPill leadingIcon="map-pin" label={AuthCopy.phone.countryLabel} />
          <PillInput
            ref={inputRef}
            prefix="+91"
            keyboardType="number-pad"
            value={value}
            onChangeText={(t) => {
              setValue(digitsOnly(t).slice(0, 10));
              if (error) setError(null);
            }}
            placeholder={AuthCopy.phone.inputPlaceholder}
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={handleNext}
            autoFocus
          />
          {error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />

        <PillButton
          label={AuthCopy.phone.cta}
          onPress={handleNext}
          disabled={value.length !== 10}
        />
      </SafeAreaView>

      <BrandModal
        visible={confirmOpen}
        onRequestClose={() => setConfirmOpen(false)}
        dismissOnBackdrop>
        <ThemedText style={[styles.modalLine, { color: theme.text }]}>
          {AuthCopy.phone.confirmTitle}
        </ThemedText>
        <ThemedText style={[styles.modalNumber, { color: Brand.primary }]}>
          {formatIndianMobile(value)}
        </ThemedText>
        <ThemedText style={[styles.modalLine, { color: theme.textSecondary }]}>
          {AuthCopy.phone.confirmQuestion}
        </ThemedText>
        <View style={styles.modalActions}>
          <OutlinedPillButton
            label={AuthCopy.phone.confirmEdit}
            onPress={() => {
              setConfirmOpen(false);
              setTimeout(() => inputRef.current?.focus(), 250);
            }}
            style={styles.modalCta}
          />
          <PillButton
            label={AuthCopy.phone.confirmGetCode}
            onPress={handleGetCode}
            loading={isSending}
            style={styles.modalCta}
          />
        </View>
      </BrandModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  fields: {
    gap: Spacing.two,
  },
  errorText: {
    color: '#E54848',
    fontSize: 13,
    paddingHorizontal: Spacing.three,
  },
  modalLine: {
    fontSize: 15,
    textAlign: 'center',
  },
  modalNumber: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  modalCta: {
    flex: 1,
    height: 50,
  },
});
