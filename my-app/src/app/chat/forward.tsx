import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ForwardPickerRow, type ForwardRowState } from '@/features/chat/components/forward-picker-row';
import { ChatCopy } from '@/features/chat/copy';
import { chatRepository } from '@/features/chat/data';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { useTheme } from '@/hooks/use-theme';

import type { Thread } from '@/features/chat/types';

/**
 * Forward picker (Tranche 2.E) — opened from a message's action sheet as a
 * modal sibling of `chat/[id]` (so dismissing returns to the source thread,
 * which stays mounted underneath).
 *
 * Single-select: tapping a chat forwards immediately, shows a brief "Sent ✓"
 * on that row, then auto-dismisses back to the source conversation. No
 * multi-select / checkboxes (the app is 1-on-1 only) and no destination-jump.
 */
export default function ForwardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { messageId, fromThreadId } = useLocalSearchParams<{
    messageId?: string;
    fromThreadId?: string;
  }>();
  const { threads, loading } = useThreads();

  // `sendingId` = the target currently in flight; `sentId` = the target that
  // just succeeded (drives the row's "Sent ✓"); `failed` = inline error.
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Defensive: a cold deep-link to /chat/forward with no messageId can't do
  // anything useful — dismiss rather than render an inert picker.
  useEffect(() => {
    if (!messageId) router.back();
  }, [messageId, router]);

  // Can't forward to the chat the message already lives in.
  const targets = threads.filter((t) => t.id !== fromThreadId);
  const locked = sendingId !== null || sentId !== null;

  async function handlePick(thread: Thread) {
    if (!messageId || locked) return;
    const fn = chatRepository.forwardMessage;
    if (!fn) return;
    setFailed(false);
    setSendingId(thread.id);
    try {
      await fn.call(chatRepository, messageId, [thread.id]);
      setSendingId(null);
      setSentId(thread.id);
      // Brief success beat, then return to the source thread.
      setTimeout(() => router.back(), 700);
    } catch {
      setSendingId(null);
      setFailed(true);
    }
  }

  function rowState(threadId: string): ForwardRowState {
    if (sentId === threadId) return 'sent';
    if (sendingId === threadId) return 'sending';
    return 'idle';
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ModalHeader title={ChatCopy.forward.pickerTitle} />

        {failed ? (
          <ThemedText style={[styles.error, { color: '#FF5C5C' }]}>
            {ChatCopy.forward.failed}
          </ThemedText>
        ) : null}

        <FlatList
          data={targets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={theme.text} />
              </View>
            ) : (
              <View style={styles.empty}>
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {ChatCopy.forward.empty}
                </ThemedText>
              </View>
            )
          }
          renderItem={({ item }) => (
            <ForwardPickerRow
              thread={item}
              onPress={handlePick}
              state={rowState(item.id)}
              disabled={locked}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.four,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingTop: Spacing.six,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
