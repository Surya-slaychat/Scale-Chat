import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';
import { SuccessBadge } from '@/features/auth/components/success-badge';
import { AuthCopy } from '@/features/auth/copy';
import { useAuth } from '@/features/auth/hooks/use-auth';

/**
 * Account Setup Complete page — Figma 1:4228.
 *
 * Layout follows the CSS spec exactly. Frame is 392×852 with bg `#0B1014`.
 * Three decorative `#4552E4`-bordered rectangles sit below the dark center
 * card (Group 14), giving the layered-paper feel. The center card is
 * 314×433 at (39, 209) with radius 31 and fill `#222222`; inside it we
 * stack the greeting, the success badge, the title, and the body. A lime
 * `Done` CTA pins at top:580, and the home-indicator bar at the bottom.
 */
export default function CompleteScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const firstName = currentUser?.fullName?.split(' ')[0] ?? '';

  return (
    <View style={styles.root}>
      {/* Decorative layered rectangles (Group 14) — sit behind the card */}
      <View style={[styles.decoRect, styles.decoRect20]} />
      <View style={[styles.decoRect, styles.decoRect16]} />
      <View style={[styles.decoRect, styles.decoRect18]} />

      {/* Center dark card — Group 170 / Rectangle 103 */}
      <View style={styles.card}>
        <ThemedText style={styles.greeting}>
          {AuthCopy.complete.greeting(firstName)}
        </ThemedText>

        <View style={styles.badgeWrap}>
          <SuccessBadge />
        </View>

        <ThemedText style={styles.title}>{AuthCopy.complete.title}</ThemedText>
        <ThemedText style={styles.body}>{AuthCopy.complete.body}</ThemedText>
      </View>

      {/* Lime Done CTA — Group 81 / Rectangle 113 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={AuthCopy.complete.cta}
        onPress={() => router.replace('/(tabs)')}
        style={({ pressed }: { pressed: boolean }) => [
          styles.cta,
          pressed && { opacity: 0.85 },
        ]}>
        <ThemedText style={styles.ctaLabel}>{AuthCopy.complete.cta}</ThemedText>
      </Pressable>

      {/* Home indicator — Rectangle 17 */}
      <View style={styles.homeIndicator} />
    </View>
  );
}

// All coordinates are direct from the Figma 392×852 frame.
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1014',
    position: 'relative',
    overflow: 'hidden',
  },

  // ─── Decorative bordered rectangles (Group 14) ─────────────────────────────
  decoRect: {
    position: 'absolute',
    backgroundColor: '#0B1014',
    borderWidth: 5,
    borderColor: '#4552E4',
  },
  // Rectangle 20 — 392.72×134.19, offset right +36 from center, lower band
  decoRect20: {
    width: 392.72,
    height: 134.19,
    left: 196 - 392.72 / 2 + 36,
    top: 426 - 134.19 / 2 + 220.09,
  },
  // Rectangle 16 — 320.08×158.81, near-center, slightly below
  decoRect16: {
    width: 320.08,
    height: 158.81,
    left: 196 - 320.08 / 2 - 0.32,
    top: 426 - 158.81 / 2 + 286.58,
  },
  // Rectangle 18 — 392.72×158.81, mirrored (`matrix(-1,0,0,1,0,0)`), lowest band
  decoRect18: {
    width: 392.72,
    height: 158.81,
    left: 196 - 392.72 / 2 - 36.64,
    top: 426 - 158.81 / 2 + 366.59,
    transform: [{ scaleX: -1 }],
  },

  // ─── Center dark card (Group 170) ──────────────────────────────────────────
  card: {
    position: 'absolute',
    width: 314,
    height: 433,
    left: 39,
    top: 209,
    backgroundColor: '#222222',
    borderRadius: 31,
    paddingTop: 25,
    paddingHorizontal: 38,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28.73,
    lineHeight: 31, // 109.33% of 28.73 ≈ 31
    fontWeight: FontWeight.medium,
    letterSpacing: -1.44, // -0.05em on 28.73
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badgeWrap: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30.37,
    lineHeight: 33,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.91, // -0.03em on 30.37
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  body: {
    fontSize: 11.11,
    lineHeight: 15.4, // 139% of 11.11
    fontWeight: '300',
    letterSpacing: 0.22, // 0.02em on 11.11
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    width: 186,
  },

  // ─── Lime CTA (Group 81) ───────────────────────────────────────────────────
  cta: {
    position: 'absolute',
    width: 290,
    height: 53,
    left: 392 / 2 - 290 / 2,
    top: 580 + 180.5 - 53 / 2, // matches Figma calc(50% - 53/2 + 180.5)
    backgroundColor: '#E2FA61',
    borderRadius: 26.5,
    alignItems: 'center',
    justifyContent: 'center',
    // drop-shadow(0px 10px 19px rgba(0,0,0,0.1))
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
    letterSpacing: -0.2, // -0.01em on 19.73
    color: '#3F3F3F',
    textAlign: 'center',
  },

  // ─── Home indicator bar (Rectangle 17) ─────────────────────────────────────
  homeIndicator: {
    position: 'absolute',
    width: 142,
    height: 6,
    left: 392 / 2 - 142 / 2,
    top: 841,
    backgroundColor: '#000000',
    borderRadius: 3,
  },
});
