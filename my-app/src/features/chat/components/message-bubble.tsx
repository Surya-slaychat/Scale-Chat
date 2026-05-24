import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Spacing } from '@/constants/theme';
import { formatBubbleTime, formatDuration } from '@/lib/format-time';

import type { Message } from '../types';

type Props = {
  message: Message;
  isMine: boolean;
  /** When true, draw a tail at the bottom corner (last in a streak). */
  hasTail?: boolean;
  /** Optional source message this bubble replies to (for the inline quote). */
  replyTarget?: Message | null;
  /** Counterpart display name — used as the "From: ..." label in reply quotes. */
  counterpartName?: string;
  /** Long-press tap → open action sheet. */
  onLongPress?: (m: Message) => void;
};

/**
 * Message bubble — Figma 1:2972.
 *
 * Variants handled here:
 *   - **Text** — plain text content with timestamp + delivery ticks.
 *   - **Voice** — play disc + waveform + duration.
 *   - **Reply** — when `replyTarget` is provided, a quoted preview renders
 *     above the body. Tapping the quote could scroll to the source (left as
 *     a future enhancement; we'd need the FlatList ref + an id→index map).
 *   - **Deleted** — when `message.deletedAt` is set, the bubble shrinks to
 *     a single italic "This message was deleted" line (the server zeroes
 *     content so there's nothing else to render).
 *
 * Long-press on any non-tombstone bubble opens the action sheet wired
 * from the parent screen.
 */
export function MessageBubble({
  message,
  isMine,
  hasTail,
  replyTarget,
  counterpartName,
  onLongPress,
}: Props) {
  const bg = isMine ? Brand.chatBubbleMine : Brand.chatBubbleTheirs;
  const color = isMine ? Brand.chatBubbleMineText : Brand.chatBubbleTheirsText;
  const isTombstone = message.deletedAt != null;

  return (
    <View style={[styles.outer, { alignItems: isMine ? 'flex-end' : 'flex-start' }]}>
      <Pressable
        onLongPress={() => {
          if (isTombstone) return;
          onLongPress?.(message);
        }}
        delayLongPress={250}
        accessibilityRole="button"
        accessibilityHint="Long press for message actions"
        style={({ pressed }: { pressed: boolean }) => [
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          {
            backgroundColor: bg,
            borderBottomRightRadius: isMine && hasTail ? 4 : 22,
            borderBottomLeftRadius: !isMine && hasTail ? 4 : 22,
          },
          isTombstone && styles.bubbleTombstone,
          pressed && { opacity: 0.92 },
        ]}>
        {/* Reply quote — appears above the body when this message replies to another. */}
        {replyTarget && !isTombstone ? (
          <View
            style={[
              styles.replyQuote,
              { borderLeftColor: isMine ? 'rgba(255,255,255,0.55)' : Brand.chatHeaderTop },
            ]}>
            <ThemedText
              style={[
                styles.replyAuthor,
                { color: isMine ? 'rgba(255,255,255,0.85)' : Brand.chatHeaderTop },
              ]}
              numberOfLines={1}>
              {replyTarget.senderId === 'me' ? 'You' : counterpartName ?? 'Them'}
            </ThemedText>
            <ThemedText
              style={[
                styles.replyBody,
                { color: isMine ? 'rgba(255,255,255,0.75)' : '#5C6068' },
              ]}
              numberOfLines={2}>
              {replyTarget.deletedAt
                ? 'This message was deleted'
                : replyTarget.type === 'text'
                  ? replyTarget.text
                  : `🎤 Voice note · ${formatDuration(replyTarget.durationSec)}`}
            </ThemedText>
          </View>
        ) : null}

        {isTombstone ? (
          <View style={styles.tombstoneRow}>
            <Feather
              name="slash"
              size={12}
              color={isMine ? 'rgba(255,255,255,0.7)' : '#7A7E86'}
            />
            <ThemedText
              style={[
                styles.tombstoneText,
                { color: isMine ? 'rgba(255,255,255,0.75)' : '#7A7E86' },
              ]}>
              This message was deleted
            </ThemedText>
          </View>
        ) : message.type === 'text' ? (
          <ThemedText style={[styles.text, { color }]}>{message.text}</ThemedText>
        ) : (
          <VoiceBlock message={message} isMine={isMine} />
        )}
      </Pressable>
      <View
        style={[
          styles.metaRow,
          isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
        ]}>
        {isMine && !isTombstone ? <DeliveryTicks status={message.status} /> : null}
        <ThemedText style={styles.meta}>{formatBubbleTime(message.createdAt)}</ThemedText>
      </View>
    </View>
  );
}

function VoiceBlock({
  message,
  isMine,
}: {
  message: Extract<Message, { type: 'voice' }>;
  isMine: boolean;
}) {
  const tint = isMine ? '#EDEDED' : Brand.chatHeaderTop;
  return (
    <View style={styles.voiceRow}>
      <View style={[styles.playBtn, { borderColor: tint }]}>
        <Feather name="play" size={14} color={tint} style={{ marginLeft: 2 }} />
      </View>
      <View style={styles.waveform}>
        {message.waveform.map((peak, i) => (
          <View
            key={`peak-${i}`}
            style={[
              styles.bar,
              {
                backgroundColor: tint,
                height: Math.max(4, peak * 26),
                opacity: i < message.waveform.length * 0.45 ? 1 : 0.45,
              },
            ]}
          />
        ))}
      </View>
      <ThemedText style={[styles.voiceTime, { color: tint }]}>
        {formatDuration(message.durationSec)}
      </ThemedText>
    </View>
  );
}

function DeliveryTicks({ status }: { status: Message['status'] }) {
  if (status === 'sending') {
    return (
      <Feather name="clock" size={11} color={Brand.chatTimestamp} style={styles.tickIcon} />
    );
  }
  if (status === 'failed') {
    return (
      <Feather name="alert-circle" size={11} color="#FF5C5C" style={styles.tickIcon} />
    );
  }
  const color = status === 'read' ? Brand.chatReadTick : Brand.chatTimestamp;
  if (status === 'sent') {
    return <Feather name="check" size={11} color={color} style={styles.tickIcon} />;
  }
  return (
    <View style={styles.doubleTick}>
      <Feather name="check" size={11} color={color} style={{ marginRight: -5 }} />
      <Feather name="check" size={11} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: Spacing.three + 2,
    marginBottom: 6,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleMine: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  bubbleTheirs: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  bubbleTombstone: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.14,
  },
  tombstoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tombstoneText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: FontWeight.regular,
  },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 6,
    maxWidth: '100%',
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.1,
  },
  replyBody: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeight.regular,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
  },
  meta: {
    fontSize: 10,
    fontWeight: FontWeight.regular,
    color: Brand.chatTimestamp,
    letterSpacing: -0.1,
  },
  tickIcon: {
    marginRight: 4,
  },
  doubleTick: {
    flexDirection: 'row',
    marginRight: 4,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 220,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  voiceTime: {
    fontSize: 12,
    fontWeight: FontWeight.medium,
    letterSpacing: -0.12,
  },
});
