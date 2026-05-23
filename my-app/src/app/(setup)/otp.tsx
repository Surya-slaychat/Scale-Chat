import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { BrandModal } from '@/features/auth/components/brand-modal';
import {
  OtpInputGroup,
  type OtpInputGroupHandle,
} from '@/features/auth/components/otp-input-group';
import { OutlinedPillButton } from '@/features/auth/components/outlined-pill-button';
import { PillButton } from '@/features/auth/components/pill-button';
import { AuthCopy } from '@/features/auth/copy';
import { useOtpMock } from '@/features/auth/hooks/use-otp-mock';
import { useTheme } from '@/hooks/use-theme';
import { formatIndianMobile, localDigitsFromE164 } from '@/lib/phone';

const RESEND_COOLDOWN_SECONDS = 30;

export default function OtpScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const phoneE164 = phone ?? '';
  const otpRef = useRef<OtpInputGroupHandle>(null);

  const { verifyOtp, requestOtp, isVerifying, isSending } = useOtpMock();
  const [code, setCode] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleVerify(value: string = code) {
    if (value.length !== 6) return;
    const result = await verifyOtp(phoneE164, value, 'mock-device');
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (result.user.fullName) {
        router.replace('/(tabs)');
      } else {
        router.replace('/profile');
      }
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setErrorOpen(true);
  }

  async function handleResend() {
    if (cooldown > 0 || isSending) return;
    await requestOtp(phoneE164);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: Brand.primary }]}>
            {AuthCopy.otp.title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            We have sent a verification code on your phone number{'\n'}
            <ThemedText style={{ color: theme.text, fontWeight: '700' }}>
              {formatIndianMobile(localDigitsFromE164(phoneE164))}
            </ThemedText>
            .{'\n'}
            <ThemedText style={{ color: theme.text, fontWeight: '600' }}>Check your Messages.</ThemedText>
          </ThemedText>
        </View>

        <OtpInputGroup
          ref={otpRef}
          onChange={setCode}
          onComplete={handleVerify}
        />

        <View style={styles.resendRow}>
          <ThemedText style={[styles.resendMuted, { color: theme.textSecondary }]}>
            {AuthCopy.otp.didNotReceive}
          </ThemedText>
          <Pressable onPress={handleResend} disabled={cooldown > 0 || isSending}>
            <ThemedText
              style={[
                styles.resendCta,
                { color: cooldown > 0 ? theme.textSecondary : Brand.primary },
              ]}>
              {cooldown > 0
                ? AuthCopy.otp.resendInSeconds(cooldown)
                : isSending
                  ? AuthCopy.otp.resending
                  : AuthCopy.otp.resend}
            </ThemedText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.ctaStack}>
          <PillButton
            label={AuthCopy.otp.cta}
            onPress={() => handleVerify(code)}
            loading={isVerifying}
            disabled={code.length !== 6}
          />
          <OutlinedPillButton
            label={AuthCopy.otp.callCta}
            onPress={() => Alert.alert(AuthCopy.brand, AuthCopy.otp.callComingSoon)}
          />
        </View>
      </SafeAreaView>

      <BrandModal
        visible={errorOpen}
        onRequestClose={() => setErrorOpen(false)}
        dismissOnBackdrop>
        <View style={styles.errorBlock}>
          <View style={[styles.errorEmojiCircle, { borderColor: Brand.accent }]}>
            <Feather name="frown" size={48} color={Brand.accent} />
          </View>
          <ThemedText style={[styles.errorTitle, { color: theme.text }]}>
            {AuthCopy.otp.error.title}
          </ThemedText>
          <ThemedText style={[styles.errorHeading, { color: theme.text }]}>
            {AuthCopy.otp.error.heading}
          </ThemedText>
          <ThemedText style={[styles.errorBody, { color: theme.textSecondary }]}>
            {AuthCopy.otp.error.body}
          </ThemedText>
          <PillButton
            label={AuthCopy.otp.error.cta}
            onPress={() => {
              setErrorOpen(false);
              otpRef.current?.clear();
            }}
            style={styles.errorCta}
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
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  resendRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendMuted: {
    fontSize: 13,
  },
  resendCta: {
    fontSize: 13,
    fontWeight: '700',
  },
  ctaStack: {
    gap: Spacing.two,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorEmojiCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  errorHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorCta: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    height: 50,
  },
});
