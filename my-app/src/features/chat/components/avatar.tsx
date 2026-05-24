import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight } from '@/constants/theme';

import type { Contact } from '../types';

type Props = {
  contact: Contact;
  size?: number;
};

/**
 * Circular avatar — photo if present, else an emoji on a tinted disc.
 * Matches the chat list / chat header avatar in the Figma.
 */
export function Avatar({ contact, size = 48 }: Props) {
  const radius = size / 2;
  if (contact.avatarUri) {
    return (
      <View style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
        <Image source={{ uri: contact.avatarUri }} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: contact.tint ?? '#6F7FE8',
        },
      ]}>
      <ThemedText style={[styles.emoji, { fontSize: size * 0.5, lineHeight: size }]}>
        {contact.emoji ?? defaultEmoji(contact)}
      </ThemedText>
    </View>
  );
}

function defaultEmoji(contact: Contact): string {
  // Stable per-id selection from a small palette.
  const palette = ['🧑🏽', '👩🏽', '🧑🏽‍💼', '👨🏽', '🧒🏽'];
  let hash = 0;
  for (const ch of contact.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length] ?? '🧑🏽';
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    fontWeight: FontWeight.regular,
    textAlign: 'center',
  },
});
