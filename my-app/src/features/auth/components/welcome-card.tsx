import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';
import { AuthCopy } from '../copy';

/**
 * Hero purple card on the welcome screen — Figma 1:1554 "Account Setup page 1".
 *
 * The CSS spec lays out the entire frame in absolute coordinates against a
 * 392 × 852 design canvas. We mirror that here: the card is positioned 17px
 * from the left, 16px from the right, 64px from the top, with the body
 * extending 538px tall (= 852 - 64 - 250). All children are absolutely
 * positioned at their Figma offsets so they read as a pixel-by-pixel match
 * on devices in the iPhone 14 / Pixel 7 size class.
 *
 * Gradient: `linear-gradient(180deg, #7B86FF 0%, #4552E4 103.72%)`.
 *
 * The four colored circles approximate the illustrated characters from Figma
 * (Groups 76 / 44 / 48 / 45). The actual character renders ship in a follow-up
 * once the artwork is exported — until then the colored ellipses + emoji
 * placeholders preserve the layout's read.
 */

const CARD_BORDER_RADIUS = 44;

// Absolute Y offsets are the Figma `top` values minus the card's own top (64).
const CARD_TOP_OFFSET = 64;

const AVATARS: Array<{
  size: number;
  bg: string;
  emoji: string;
  left: number;
  top: number;
}> = [
  // Group 76 — yellow, 54×54 at (45, 472)
  { size: 54, bg: '#FAD161', emoji: '🧓🏽', left: 45 - 17, top: 472 - CARD_TOP_OFFSET },
  // Group 44 — red, 75×75 at (208, 411)
  { size: 75, bg: '#FF5B5D', emoji: '👧🏽', left: 208 - 17, top: 411 - CARD_TOP_OFFSET },
  // Group 48 — cyan, 54×54 at (154, 529)
  { size: 54, bg: '#61D9FA', emoji: '🧑🏽', left: 154 - 17, top: 529 - CARD_TOP_OFFSET },
  // Group 45 — green, 59×59 at (283, 499)
  { size: 59, bg: '#92FFA6', emoji: '👨🏽', left: 283 - 17, top: 499 - CARD_TOP_OFFSET },
];

export function WelcomeCard() {
  return (
    <LinearGradient
      colors={['#7B86FF', '#4552E4']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.card}>
      {/* Title block — "Welcome to" + "ScaleChat", positioned at Figma top:256 */}
      <View style={styles.titleBlock}>
        <ThemedText style={styles.headline}>{AuthCopy.welcome.headline}</ThemedText>
        <ThemedText style={styles.brand}>{AuthCopy.brand}</ThemedText>
      </View>

      {/* Subtract ribbon — the deep-purple swirl behind the avatars
          (Figma "Subtract": linear-gradient 119.41deg #2C3BD0 21.47% → #111EA2 39.63%).
          A single rotated half-pill approximates the cut-out shape. */}
      <View pointerEvents="none" style={styles.swirlWrap}>
        <LinearGradient
          colors={['#2C3BD0', '#111EA2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.swirl}
        />
      </View>

      {/* Character avatars — 4 ellipses laid out per Group 254 spec */}
      {AVATARS.map((a, i) => (
        <View
          key={`avatar-${i}`}
          style={[
            styles.avatar,
            {
              width: a.size,
              height: a.size,
              borderRadius: a.size / 2,
              backgroundColor: a.bg,
              left: a.left,
              top: a.top,
            },
          ]}>
          <ThemedText style={[styles.avatarEmoji, { fontSize: a.size * 0.6 }]}>
            {a.emoji}
          </ThemedText>
        </View>
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  titleBlock: {
    position: 'absolute',
    // Figma frame coords: left 31, top 256. Card coord = (31 - 17, 256 - 64).
    left: 31 - 17,
    top: 256 - CARD_TOP_OFFSET,
    width: 330,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 42.3,
    fontWeight: FontWeight.heavy,
    lineHeight: 36, // 86% of 42.3 ≈ 36
    letterSpacing: -1.27, // -0.03em on 42.3
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 73.83,
    fontWeight: FontWeight.heavy,
    lineHeight: 63, // 86% of 73.83 ≈ 63
    letterSpacing: -2.21, // -0.03em on 73.83
    marginTop: 5,
  },
  swirlWrap: {
    position: 'absolute',
    left: -41 - (-17),    // Figma Vector 52 left = -41 frame → -24 card
    top: 286 - CARD_TOP_OFFSET,
    width: 473,
    height: 229,
  },
  swirl: {
    width: '100%',
    height: '100%',
    borderRadius: 200,
    transform: [{ rotate: '-15deg' }],
    opacity: 0.55,
  },
  avatar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    textAlign: 'center',
  },
});
