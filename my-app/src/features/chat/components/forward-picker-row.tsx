import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Thread } from '../types';
import { Avatar } from './avatar';

/** Trailing state for a single picker row — drives the right-hand indicator. */
export type ForwardRowState = 'idle' | 'sending' | 'sent';

type Props = {
  thread: Thread;
  onPress: (thread: Thread) => void;
  /** Trailing indicator: spinner while forwarding, check on success. */
  state?: ForwardRowState;
  disabled?: boolean;
};

/**
 * Single tappable row in the forward picker (Tranche 2.E). Deliberately
 * lighter than `ChatRow` — a forward target only needs avatar + name, not the
 * unread badge / last-message preview / delivery ticks. Single-select: tapping
 * forwards immediately (no checkbox), matching the 1-on-1-only scope.
 */
export function ForwardPickerRow({ thread, onPress, state = 'idle', disabled }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onPress(thread)}
      disabled={disabled || state !== 'idle'}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surfaceMuted },
        pressed && { opacity: 0.85 },
        state === 'sent' && { opacity: 0.9 },
      ]}>
      <Avatar contact={thread.counterpart} size={44} />
      <View style={styles.middle}>
        <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {thread.counterpart.displayName}
        </ThemedText>
      </View>
      {state === 'sending' ? (
        <ActivityIndicator color={theme.text} />
      ) : state === 'sent' ? (
        <Feather name="check-circle" size={20} color={Brand.chatActionLime} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
  middle: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
  },
});
