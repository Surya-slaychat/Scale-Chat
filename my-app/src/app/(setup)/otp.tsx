import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';
import {
  OtpInputGroup,
  type OtpInputGroupHandle,
  OTP_LENGTH,
} from '@/features/auth/components/otp-input-group';
import { SadFace } from '@/features/auth/components/sad-face';
import { AuthCopy } from '@/features/auth/copy';
import { useOtpMock } from '@/features/auth/hooks/use-otp-mock';
import { formatIndianMobile, localDigitsFromE164 } from '@/lib/phone';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Account Setup page 6 — Figma 1:2773 "Verify Phone Number".
 *
 * Absolute layout against the 392×852 design:
 *   - Title at top 189, brand-blue `#636FF5`, Poppins-SemiBold 33.18px
 *   - Subtitle at top 271 (Poppins-Light 11.11px) + bold "Check your Messages." at top 307
 *   - 4 OTP boxes (73×87 each, `#383838`, radius 16) at top 333
 *   - "Didn't Received yet?" + "Resend Code" at top 433 / 454
 *   - Lime "Done" CTA at top 697, outlined "Get Code on call" at top 760
 *   - Error modal mirrors the phone-screen invalid sheet
 */
export default function OtpScreen() {
  const router = useRouter();
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
    if (value.length !== OTP_LENGTH) return;
    const result = await verifyOtp(phoneE164, value, 'mock-device');
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace(result.user.fullName ? '/(tabs)' : '/profile');
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

  const formattedPhone = formatIndianMobile(localDigitsFromE164(phoneE164)) || '+91 XXXXXXXXXX';

  return (
    <View style={styles.root}>
      {/* Title — Figma top 189 */}
      <ThemedText style={styles.title}>{AuthCopy.otp.title}</ThemedText>

      {/* Subtitle — Figma top 271 */}
      <ThemedText style={styles.subtitle}>
        We have sent a verification code on your phone number {formattedPhone}.
      </ThemedText>

      {/* "Check your Messages." — Figma top 307, slightly bolder */}
      <ThemedText style={styles.checkMessages}>Check your Messages.</ThemedText>

      {/* OTP boxes — Figma Group 164 top 333 */}
      <View style={styles.otpWrap}>
        <OtpInputGroup ref={otpRef} onChange={setCode} onComplete={handleVerify} />
      </View>

      {/* Resend block — Figma top 433 / 454 */}
      <ThemedText style={styles.didntReceive}>{AuthCopy.otp.didNotReceive}</ThemedText>
      <Pressable
        onPress={handleResend}
        disabled={cooldown > 0 || isSending}
        style={styles.resendHit}>
        <ThemedText style={[styles.resend, cooldown > 0 && { color: '#6E6E6E' }]}>
          {cooldown > 0
            ? AuthCopy.otp.resendInSeconds(cooldown)
            : isSending
              ? AuthCopy.otp.resending
              : AuthCopy.otp.resend}
        </ThemedText>
      </Pressable>

      {/* "Done" lime CTA — Figma Group 82, top 697 */}
      <Pressable
        onPress={() => handleVerify(code)}
        disabled={code.length !== OTP_LENGTH || isVerifying}
        accessibilityRole="button"
        accessibilityLabel={AuthCopy.otp.cta}
        style={({ pressed }: { pressed: boolean }) => [
          styles.ctaDone,
          (code.length !== OTP_LENGTH || isVerifying) && { opacity: 0.6 },
          pressed && { opacity: 0.85 },
        ]}>
        <ThemedText style={styles.ctaDoneLabel}>{AuthCopy.otp.cta}</ThemedText>
      </Pressable>

      {/* "Get Code on call" outlined CTA — Figma Group 81, top 760 */}
      <Pressable
        onPress={() => Alert.alert(AuthCopy.brand, AuthCopy.otp.callComingSoon)}
        accessibilityRole="button"
        accessibilityLabel={AuthCopy.otp.callCta}
        style={({ pressed }: { pressed: boolean }) => [
          styles.ctaCall,
          pressed && { opacity: 0.75 },
        ]}>
        <ThemedText style={styles.ctaCallLabel}>{AuthCopy.otp.callCta}</ThemedText>
      </Pressable>

      {/* Invalid OTP modal */}
      <Modal visible={errorOpen} transparent animationType="fade" onRequestClose={() => setErrorOpen(false)}>
        <Pressable style={errStyles.backdrop} onPress={() => setErrorOpen(false)}>
          <Pressable onPress={() => undefined}>
            <View style={errStyles.card}>
              <SadFace />
              <ThemedText style={errStyles.title}>{AuthCopy.otp.error.title}</ThemedText>
              <ThemedText style={errStyles.heading}>{AuthCopy.otp.error.heading}</ThemedText>
              <ThemedText style={errStyles.body}>{AuthCopy.otp.error.body}</ThemedText>
              <Pressable
                onPress={() => {
                  setErrorOpen(false);
                  otpRef.current?.clear();
                }}
                style={({ pressed }: { pressed: boolean }) => [
                  errStyles.cta,
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={errStyles.ctaLabel}>{AuthCopy.otp.error.cta}</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1014',
    position: 'relative',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 189,
    textAlign: 'center',
    fontSize: 33.18,
    lineHeight: 35,
    fontWeight: FontWeight.semibold,
    letterSpacing: -1.66,
    color: '#636FF5',
  },
  subtitle: {
    position: 'absolute',
    left: '14.54%',
    right: '14.29%',
    top: 271,
    textAlign: 'center',
    fontSize: 11.11,
    lineHeight: 15.4,
    fontWeight: '300',
    letterSpacing: -0.11,
    color: '#FFFFFF',
  },
  checkMessages: {
    position: 'absolute',
    left: '33.93%',
    right: '33.93%',
    top: 307,
    textAlign: 'center',
    fontSize: 11.11,
    lineHeight: 15.4,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.11,
    color: '#FFFFFF',
  },
  otpWrap: {
    position: 'absolute',
    left: 31,
    right: 31,
    top: 333,
    alignItems: 'center',
  },
  didntReceive: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 433,
    textAlign: 'center',
    fontSize: 11.11,
    lineHeight: 15.4,
    fontWeight: '300',
    letterSpacing: 0.22,
    color: '#A9B0FF',
  },
  resendHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 454,
    alignItems: 'center',
  },
  resend: {
    fontSize: 11.11,
    lineHeight: 15.4,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ctaDone: {
    position: 'absolute',
    left: 55,
    right: 54,
    top: 697,
    height: 53,
    backgroundColor: '#E2FA61',
    borderRadius: 26.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 6,
  },
  ctaDoneLabel: {
    fontSize: 19.73,
    lineHeight: 30,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.2,
    color: '#3F3F3F',
  },
  ctaCall: {
    position: 'absolute',
    left: 55,
    right: 54,
    top: 760,
    height: 53,
    borderRadius: 26.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 4,
  },
  ctaCallLabel: {
    fontSize: 19.73,
    lineHeight: 30,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});

const errStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 307,
    backgroundColor: '#272727',
    borderRadius: 31,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.69,
    shadowRadius: 27.4,
    elevation: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
  },
  heading: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  body: {
    fontSize: 13.33,
    lineHeight: 19,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cta: {
    marginTop: 12,
    width: 220,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E2FA61',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: FontWeight.medium,
    color: '#3F3F3F',
  },
});
