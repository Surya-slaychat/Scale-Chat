import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { formatThreadRowTime } from '@/lib/format-time';
import { useTheme } from '@/hooks/use-theme';

import type { Thread } from '../types';
import { Avatar } from './avatar';

type Props = {
  thread: Thread;
  onPress: (thread: Thread) => void;
};

/** Single chat row in the chat-list — Figma 1:2390 / 1:2574. */
export function ChatRow({ thread, onPress }: Props) {
  const theme = useTheme();
  const preview = previewText(thread);
  const isVoice = thread.lastMessage.type === 'voice';
  const isMine = thread.lastMessage.senderId === 'me';
  const showDoubleTick = isMine && thread.lastMessage.status === 'read';
  const showSingleTick = isMine && thread.lastMessage.status === 'delivered';

  return (
    <Pressable
      onPress={() => onPress(thread)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surfaceMuted },
        pressed && { opacity: 0.85 },
      ]}>
      <Avatar contact={thread.counterpart} size={48} />

      <View style={styles.middle}>
        <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {thread.counterpart.displayName}
        </ThemedText>
        <View style={styles.previewRow}>
          {isVoice ? (
            <Feather name="mic" size={12} color={theme.textSecondary} style={styles.previewIcon} />
          ) : showDoubleTick ? (
            <DoubleTick color={Brand.primary} />
          ) : showSingleTick ? (
            <Feather name="check" size={12} color={theme.textSecondary} style={styles.previewIcon} />
          ) : null}
          <ThemedText
            style={[styles.preview, { color: theme.textSecondary }]}
            numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>
      </View>

      <View style={styles.right}>
        <ThemedText
          style={[
            styles.time,
            { color: thread.unreadCount > 0 ? Brand.accent : theme.textSecondary },
          ]}>
          {formatThreadRowTime(thread.lastMessage.createdAt)}
        </ThemedText>
        {thread.unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: Brand.accent }]}>
            <ThemedText style={[styles.badgeText, { color: Brand.accentText }]}>
              {thread.unreadCount}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function previewText(thread: Thread): string {
  const m = thread.lastMessage;
  if (m.type === 'text') return m.text;
  if (m.type === 'voice') {
    const mins = Math.floor(m.durationSec / 60);
    const secs = (m.durationSec % 60).toString().padStart(2, '0');
    return `Voice note · ${mins}:${secs}`;
  }
  return '';
}

function DoubleTick({ color }: { color: string }) {
  return (
    <View style={styles.tickGroup}>
      <Feather name="check" size={12} color={color} style={{ marginRight: -6 }} />
      <Feather name="check" size={12} color={color} />
    </View>
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
  middle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewIcon: {
    marginRight: 2,
  },
  preview: {
    flex: 1,
    fontSize: 12,
    fontWeight: FontWeight.regular,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  tickGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
