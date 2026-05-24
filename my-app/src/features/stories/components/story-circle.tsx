import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight, Spacing } from '@/constants/theme';
import { Avatar } from '@/features/chat/components/avatar';
import type { Contact } from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  contact?: Contact;
  /** Show as the "add your story" tile. Ignored when `contact` is set. */
  variant?: 'add' | 'story';
  label: string;
  hasUnviewed?: boolean;
  onPress?: () => void;
  /** Label colour override — useful when displayed on the blue header card. */
  labelColor?: string;
};

const RING_SIZE = 64;
const AVATAR_SIZE = 54;

/** Single status / story circle — used in the Status row on the Contact Page. */
export function StoryCircle({
  contact,
  variant = 'story',
  label,
  hasUnviewed,
  onPress,
  labelColor,
}: Props) {
  const theme = useTheme();
  const ringColor =
    variant === 'add'
      ? theme.statusRingMuted
      : hasUnviewed
        ? theme.statusRingActive
        : theme.statusRingMuted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.7 }]}>
      <View
        style={[
          styles.ring,
          {
            borderColor: ringColor,
            backgroundColor: variant === 'add' ? theme.surfaceMuted : 'transparent',
          },
        ]}>
        {variant === 'add' ? (
          <Feather name="plus" size={22} color={theme.text} />
        ) : contact ? (
          <Avatar contact={contact} size={AVATAR_SIZE} />
        ) : null}
      </View>
      <ThemedText
        numberOfLines={1}
        style={[styles.label, { color: labelColor ?? theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: RING_SIZE + 12,
    gap: Spacing.one,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});
