import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';
import { SadFace } from '@/features/auth/components/sad-face';
import { AuthCopy } from '@/features/auth/copy';
import { useOtpMock } from '@/features/auth/hooks/use-otp-mock';
import { digitsOnly, formatIndianMobile, isValidIndianMobile, toE164India } from '@/lib/phone';

/**
 * Account Setup page 3 / 5 — Figma 1:2390 / 1:2574.
 *
 * Layout follows the CSS spec exactly against the 392×852 design canvas:
 * dark frame, the brand-purple title, a Poppins-Light subtitle, two
 * stacked dark pills (country picker + phone input) at top 326/392, and
 * a lime `Next` CTA pinned at bottom 41. Tapping `Next` opens the
 * confirmation modal (page 5) — a 307×232 dark card centered on a blurred
 * scrim, with "Edit" (outlined) and "Get Code" (lime) actions.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInputType | null>(null);
  const { requestOtp, isSending } = useOtpMock();

  const [value, setValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [invalidOpen, setInvalidOpen] = useState(false);

  const isValid = isValidIndianMobile(value);

  function handleNext() {
    if (!isValid) {
      setInvalidOpen(true);
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
    <View style={styles.root}>
      {/* Title — Figma top 189, brand purple */}
      <ThemedText style={styles.title}>{AuthCopy.phone.title}</ThemedText>

      {/* Subtitle — Figma top 271 */}
      <ThemedText style={styles.subtitle}>
        {AuthCopy.phone.subtitle(AuthCopy.brand)}
      </ThemedText>

      {/* Country picker pill — Figma top 326 */}
      <Pressable style={[styles.pill, { top: 326 }]} accessibilityRole="button">
        <ThemedText style={styles.pillLabel}>{AuthCopy.phone.countryLabel}</ThemedText>
        <ChevronDown />
      </Pressable>

      {/* Phone input pill — Figma top 392 */}
      <View style={[styles.pill, { top: 392 }]}>
        <ThemedText style={styles.prefix}>+91</ThemedText>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => setValue(digitsOnly(t).slice(0, 10))}
          placeholder={AuthCopy.phone.inputPlaceholder}
          placeholderTextColor="#6E6E6E"
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={handleNext}
          style={styles.input}
          autoFocus
        />
      </View>

      {/* Next CTA — Figma bottom 41, height 53 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={AuthCopy.phone.cta}
        onPress={handleNext}
        style={({ pressed }: { pressed: boolean }) => [
          styles.cta,
          pressed && { opacity: 0.85 },
        ]}>
        <ThemedText style={styles.ctaLabel}>{AuthCopy.phone.cta}</ThemedText>
      </Pressable>

      {/* Phone confirmation modal — Figma page 5 */}
      <PhoneConfirmModal
        visible={confirmOpen}
        phone={value}
        loading={isSending}
        onClose={() => setConfirmOpen(false)}
        onEdit={() => {
          setConfirmOpen(false);
          setTimeout(() => inputRef.current?.focus(), 200);
        }}
        onGetCode={handleGetCode}
      />

      {/* Invalid number modal — Figma page 4 */}
      <InvalidPhoneModal
        visible={invalidOpen}
        onClose={() => setInvalidOpen(false)}
        onRetry={() => {
          setInvalidOpen(false);
          setTimeout(() => inputRef.current?.focus(), 200);
        }}
      />
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M5 7 L9 11 L13 7"
        stroke="#5E5E5E"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function PhoneConfirmModal({
  visible,
  phone,
  loading,
  onClose,
  onEdit,
  onGetCode,
}: {
  visible: boolean;
  phone: string;
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onGetCode: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined}>
          <View style={modalStyles.card}>
            <ThemedText style={modalStyles.lead}>
              {AuthCopy.phone.confirmTitle}
            </ThemedText>
            <ThemedText style={modalStyles.number}>{formatIndianMobile(phone)}</ThemedText>
            <ThemedText style={modalStyles.question}>
              {AuthCopy.phone.confirmQuestion}
            </ThemedText>
            <View style={modalStyles.actions}>
              <Pressable
                onPress={onEdit}
                style={({ pressed }: { pressed: boolean }) => [
                  modalStyles.btn,
                  modalStyles.btnEdit,
                  pressed && { opacity: 0.7 },
                ]}>
                <ThemedText style={modalStyles.btnEditLabel}>
                  {AuthCopy.phone.confirmEdit}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onGetCode}
                disabled={loading}
                style={({ pressed }: { pressed: boolean }) => [
                  modalStyles.btn,
                  modalStyles.btnGetCode,
                  pressed && { opacity: 0.85 },
                  loading && { opacity: 0.6 },
                ]}>
                <ThemedText style={modalStyles.btnGetCodeLabel}>
                  {loading ? '…' : AuthCopy.phone.confirmGetCode}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InvalidPhoneModal({
  visible,
  onClose,
  onRetry,
}: {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined}>
          <View style={[modalStyles.card, { height: 'auto', paddingVertical: 28 }]}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <SadFace />
              <ThemedText style={modalStyles.errorTitle}>
                {AuthCopy.phone.invalidModal.title}
              </ThemedText>
              <ThemedText style={modalStyles.errorHeading}>
                {AuthCopy.phone.invalidModal.heading}
              </ThemedText>
              <ThemedText style={modalStyles.errorBody}>
                {AuthCopy.phone.invalidModal.body}
              </ThemedText>
              <Pressable
                onPress={onRetry}
                style={({ pressed }: { pressed: boolean }) => [
                  modalStyles.btn,
                  modalStyles.btnGetCode,
                  { width: 200, marginTop: 8 },
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={modalStyles.btnGetCodeLabel}>
                  {AuthCopy.phone.invalidModal.cta}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
    height: 67,
    width: '100%',
    textAlign: 'center',
    fontSize: 33.18,
    lineHeight: 35, // 104% of 33.18
    fontWeight: FontWeight.semibold,
    letterSpacing: -1.66, // -0.05em on 33.18
    color: '#6F7AFC',
  },
  subtitle: {
    position: 'absolute',
    left: '20.92%',
    right: '20.92%',
    top: 271,
    textAlign: 'center',
    fontSize: 13.33,
    lineHeight: 19, // 139% of 13.33
    fontWeight: '300',
    letterSpacing: 0.27, // 0.02em on 13.33
    color: '#FFFFFF',
  },
  pill: {
    position: 'absolute',
    left: 31,
    right: 31,
    height: 54,
    backgroundColor: '#383838',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  pillLabel: {
    flex: 1,
    fontSize: 13.33,
    lineHeight: 20,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.27,
    color: '#EDEDED',
  },
  prefix: {
    fontSize: 13.33,
    lineHeight: 20,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.27,
    color: '#EDEDED',
    marginRight: 13, // Figma `+91` ends at left 81, input starts at left 99 → 18px - some padding
  },
  input: {
    flex: 1,
    fontSize: 13.33,
    lineHeight: 20,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.27,
    color: '#EDEDED',
    padding: 0, // strip Android's default vertical padding so it aligns with the prefix
  },
  cta: {
    position: 'absolute',
    left: 55,
    right: 54,
    bottom: 41,
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
  ctaLabel: {
    fontSize: 19.73,
    lineHeight: 30,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.2,
    color: '#3F3F3F',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.37)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 307,
    height: 232,
    backgroundColor: '#272727',
    borderRadius: 31,
    paddingTop: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    // box-shadow: 0px 24px 27.4px rgba(0,0,0,0.69)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.69,
    shadowRadius: 27.4,
    elevation: 14,
  },
  lead: {
    fontSize: 13.33,
    lineHeight: 19,
    fontWeight: '300',
    letterSpacing: 0.27,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  number: {
    marginTop: 8,
    fontSize: 17.33,
    lineHeight: 24,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.35, // 0.02em on 17.33
    color: '#6976FF',
    textAlign: 'center',
  },
  question: {
    marginTop: 12,
    fontSize: 13.33,
    lineHeight: 19,
    fontWeight: '300',
    letterSpacing: 0.27,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 26,
  },
  btn: {
    width: 117,
    height: 38.53,
    borderRadius: 25.55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEdit: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  btnEditLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.32,
    color: '#FFFFFF',
  },
  btnGetCode: {
    backgroundColor: '#E2FA61',
  },
  btnGetCodeLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.32,
    color: '#3F3F3F',
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorHeading: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  errorBody: {
    fontSize: 13.33,
    lineHeight: 19,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 14,
  },
});
