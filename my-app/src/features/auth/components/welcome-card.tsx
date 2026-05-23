import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { AuthCopy } from '../copy';

/**
 * The big purple welcome card with floating cartoon avatars (Figma 1:1554).
 * Avatars are emoji-based placeholders until real illustration assets land.
 */
export function WelcomeCard() {
  return (
    <View style={[styles.card, { backgroundColor: Brand.cardWelcome }]}>
      <View style={styles.titleBlock}>
        <ThemedText style={styles.headline}>{AuthCopy.welcome.headline}</ThemedText>
        <ThemedText style={styles.brand}>{AuthCopy.brand}</ThemedText>
      </View>

      {/* Decorative swooshing line */}
      <View style={styles.swoosh} />

      {/* Floating avatars */}
      <View style={[styles.avatar, styles.avatarA]}>
        <ThemedText style={styles.avatarEmoji}>👨🏽</ThemedText>
      </View>
      <View style={[styles.avatar, styles.avatarB, { backgroundColor: '#F07070' }]}>
        <ThemedText style={styles.avatarEmoji}>👧🏼</ThemedText>
      </View>
      <View style={[styles.avatar, styles.avatarC, { backgroundColor: '#64C5FF' }]}>
        <ThemedText style={styles.avatarEmoji}>🧑🏽‍💻</ThemedText>
      </View>
      <View style={[styles.avatar, styles.avatarD, { backgroundColor: '#7CE5B3' }]}>
        <ThemedText style={styles.avatarEmoji}>🧓🏽</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 28,
    padding: Spacing.four,
    overflow: 'hidden',
    position: 'relative',
  },
  titleBlock: {
    marginTop: Spacing.five,
    gap: 2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 54,
  },
  swoosh: {
    position: 'absolute',
    left: -40,
    bottom: 120,
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 18,
    borderColor: 'rgba(75, 90, 200, 0.55)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-25deg' }],
  },
  avatar: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F4C66A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  avatarA: {
    left: Spacing.four,
    bottom: 60,
  },
  avatarB: {
    left: '40%',
    bottom: 110,
  },
  avatarC: {
    left: '32%',
    bottom: 28,
  },
  avatarD: {
    right: Spacing.four,
    bottom: 70,
  },
});
