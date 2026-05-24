import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';
import { WelcomeCard } from '@/features/auth/components/welcome-card';
import { AuthCopy } from '@/features/auth/copy';

/**
 * Account Setup page 1 — Figma 1:1554.
 *
 * Layout is absolute against the Figma 392 × 852 design canvas. Phones in the
 * iPhone 14 / Pixel 7 class are 390-414px wide, so the screen reads as
 * pixel-perfect. The dark `#0B1014` frame sits behind a 359-wide purple
 * gradient card; a lime CTA pins to the bottom with the encryption hint above
 * it. Strings live in `AuthCopy` so a future i18n pass is a single-file change.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Hero card — fills the area between top 64px and bottom 250px */}
      <View style={styles.cardSlot}>
        <WelcomeCard />
      </View>

      {/* "Let's Setup your account" — Figma left 117 (centered), top 623 */}
      <ThemedText style={styles.subhead}>{AuthCopy.welcome.subheading}</ThemedText>

      {/* "End to End Encrypted" with the lime shield-check — Figma top 729 */}
      <View style={styles.encryptionRow}>
        <EncryptionGlyph />
        <ThemedText style={styles.encryptionText}>
          {AuthCopy.welcome.encryptionBadge}
        </ThemedText>
      </View>

      {/* Get Started CTA — Figma left 17, right 16, bottom 41, height 53 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={AuthCopy.welcome.cta}
        onPress={() => router.push('/terms')}
        style={({ pressed }: { pressed: boolean }) => [
          styles.cta,
          pressed && { opacity: 0.85 },
        ]}>
        <ThemedText style={styles.ctaLabel}>{AuthCopy.welcome.cta}</ThemedText>
      </Pressable>

      {/* Home indicator bar — Figma Rectangle 17, top 841 */}
      <View style={styles.homeIndicator} />
    </View>
  );
}

/** Lime shield-check next to the encryption badge. The Figma asset is the
 *  outlined glyph with a 1.375px stroke in `#E2FA61`. */
function EncryptionGlyph() {
  return (
    <Svg width={11} height={12.38} viewBox="0 0 11 12.38" fill="none">
      <Path
        d="M5.5 0.7 L10.2 2.4 V5.9 C10.2 8.7 8.2 11.0 5.5 11.7 C2.8 11.0 0.8 8.7 0.8 5.9 V2.4 L5.5 0.7 Z"
        stroke="#E2FA61"
        strokeWidth={1.375}
        strokeLinejoin="round"
      />
      <Path
        d="M3.6 6.0 L5.0 7.4 L7.6 4.8"
        stroke="#E2FA61"
        strokeWidth={1.375}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1014',
    position: 'relative',
  },
  cardSlot: {
    position: 'absolute',
    left: 17,
    right: 16,
    top: 64,
    bottom: 250,
  },
  subhead: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 623,
    textAlign: 'center',
    fontSize: 13.33,
    lineHeight: 13.5, // 101% of 13.33
    fontWeight: FontWeight.regular,
    letterSpacing: -0.4, // -0.03em on 13.33
    color: '#A9B0FF',
  },
  encryptionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 729,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  encryptionText: {
    fontSize: 13.33,
    lineHeight: 13.5,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.4,
    color: '#D6D6DA',
  },
  cta: {
    position: 'absolute',
    left: 17,
    right: 16,
    bottom: 41,
    height: 53,
    backgroundColor: '#E2FA61',
    borderRadius: 26.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 19.73,
    lineHeight: 30,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.2, // -0.01em on 19.73
    color: '#1B1B1B',
    textAlign: 'center',
  },
  homeIndicator: {
    position: 'absolute',
    left: '50%',
    marginLeft: -71,
    bottom: 11, // 852 - 841 = 11px from bottom
    width: 142,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
});
