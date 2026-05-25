import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useReducer, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, FontWeight, Radius, Shadow, Spacing } from '@/constants/theme';
import { ChatRow } from '@/features/chat/components/chat-row';
import { ChatsMoreMenu } from '@/features/chat/components/chats-more-menu';
import { FilterMenu } from '@/features/chat/components/filter-menu';
import { NewChatMenu } from '@/features/chat/components/new-chat-menu';
import { SelectModeBar } from '@/features/chat/components/select-mode-bar';
import { ChatCopy } from '@/features/chat/copy';
import { chatRepository } from '@/features/chat/data';
import { useBulkChatActions } from '@/features/chat/hooks/use-bulk-chat-actions';
import { useChatFilters } from '@/features/chat/hooks/use-chat-filters';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { ChatFilters, type ChatFilter } from '@/features/chat/types';
import { StatusRow } from '@/features/stories/components/status-row';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/hooks/use-theme-mode';

type SelectState = { mode: 'browse' | 'select'; ids: ReadonlySet<string> };
type SelectAction =
  | { type: 'enter'; id?: string }
  | { type: 'toggle'; id: string }
  | { type: 'clear' }
  | { type: 'exit' };

function selectReducer(state: SelectState, action: SelectAction): SelectState {
  switch (action.type) {
    case 'enter': {
      const ids = new Set(state.ids);
      if (action.id) ids.add(action.id);
      return { mode: 'select', ids };
    }
    case 'toggle': {
      const ids = new Set(state.ids);
      if (ids.has(action.id)) ids.delete(action.id);
      else ids.add(action.id);
      return { mode: 'select', ids };
    }
    case 'clear':
      return { mode: 'select', ids: new Set() };
    case 'exit':
      return { mode: 'browse', ids: new Set() };
  }
}

/**
 * Contact Page — Figma "Contact Page" frame (1on1 default + 3-dot / + / filter
 * popover variants). Composed against mock data; swaps to the real repo via
 * `EXPO_PUBLIC_USE_MOCKS=false` (see plan §10).
 */
export default function ChatsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { mode: themeMode, cycle: cycleThemeMode } = useThemeMode();
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  /** When set, custom filter overrides preset. id matches one in useChatFilters().filters. */
  const [activeCustomFilterId, setActiveCustomFilterId] = useState<string | null>(null);
  const { filters: customFilters } = useChatFilters();
  const activeCustom = activeCustomFilterId
    ? customFilters.find((f) => f.id === activeCustomFilterId) ?? null
    : null;

  const { threads, loading } = useThreads({ customFilterId: activeCustomFilterId });

  const moreAnchorRef = useRef<View>(null);
  const plusAnchorRef = useRef<View>(null);
  const filterAnchorRef = useRef<View>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [select, dispatch] = useReducer(selectReducer, {
    mode: 'browse',
    ids: new Set<string>(),
  });
  const [busy, setBusy] = useState(false);
  const bulk = useBulkChatActions(select.ids);
  const inSelectMode = select.mode === 'select';

  async function runBulk(action: () => Promise<void>) {
    if (busy || select.ids.size === 0) return;
    setBusy(true);
    try {
      await action();
      dispatch({ type: 'exit' });
    } finally {
      setBusy(false);
    }
  }

  const firstName = currentUser?.fullName?.split(' ')[0] ?? '';
  const greeting = firstName ? ChatCopy.list.greeting(firstName) : ChatCopy.list.greetingFallback;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (!matchesFilter(t, filter)) return false;
      if (q.length === 0) return true;
      const inName = t.counterpart.displayName.toLowerCase().includes(q);
      const inText = t.lastMessage.type === 'text' && t.lastMessage.text.toLowerCase().includes(q);
      return inName || inText;
    });
  }, [threads, query, filter]);

  return (
    <ThemedView style={styles.root}>
      <View style={[styles.headerCard, { backgroundColor: theme.headerCard }]}>
        <SafeAreaView edges={['top']}>
          {inSelectMode ? (
            <SelectModeBar
              count={select.ids.size}
              onCancel={() => dispatch({ type: 'exit' })}
              onMarkRead={() => runBulk(bulk.bulkMarkRead)}
              onFavourite={() => runBulk(bulk.bulkFavourite)}
              onArchive={() => runBulk(bulk.bulkArchive)}
              busy={busy}
            />
          ) : null}
          {!inSelectMode ? (
          <View style={styles.greetingRow}>
            <ThemedText style={[styles.greeting, { color: theme.headerCardText }]}>
              {greeting}
            </ThemedText>
            <View style={styles.headerIcons}>
              <Pressable
                onPress={cycleThemeMode}
                accessibilityRole="switch"
                accessibilityLabel={`Theme mode: ${themeMode}. Tap to change.`}
                style={({ pressed }) => [
                  styles.toggle,
                  { backgroundColor: theme.headerCardIconBg },
                  pressed && { opacity: 0.75 },
                ]}>
                <View
                  style={[
                    styles.toggleKnob,
                    { backgroundColor: theme.headerCardText },
                    themeMode === 'system' && styles.toggleKnobCenter,
                    themeMode === 'light' && styles.toggleKnobLeft,
                  ]}
                />
              </Pressable>
              <Pressable
                ref={plusAnchorRef}
                onPress={() => setPlusOpen(true)}
                accessibilityLabel="Create chat or group"
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: theme.headerCardIconBg },
                  pressed && { opacity: 0.7 },
                ]}>
                <Feather name="plus" size={18} color={theme.headerCardText} />
              </Pressable>
              <Pressable
                ref={moreAnchorRef}
                onPress={() => setMoreOpen(true)}
                accessibilityLabel="More options"
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: theme.headerCardIconBg },
                  pressed && { opacity: 0.7 },
                ]}>
                <Feather name="more-horizontal" size={18} color={theme.headerCardText} />
              </Pressable>
            </View>
          </View>
          ) : null}
          {!inSelectMode ? (
          <View style={styles.searchRow}>
            <View style={[styles.searchPill, { backgroundColor: theme.headerCardIconBg }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={ChatCopy.list.searchPlaceholder}
                placeholderTextColor="rgba(255,255,255,0.7)"
                style={[styles.searchInput, { color: theme.headerCardText }]}
              />
              <Feather name="mic" size={16} color={theme.headerCardText} />
            </View>
            <Pressable
              accessibilityLabel="Search filters"
              style={[styles.searchAction, { backgroundColor: theme.headerCardIconBg }]}>
              <Feather name="sliders" size={16} color={theme.headerCardText} />
            </Pressable>
          </View>
          ) : null}
          {!inSelectMode ? (
          <View style={styles.statusWrap}>
            <StatusRow onLightBackground />
          </View>
          ) : null}
        </SafeAreaView>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          ref={filterAnchorRef}
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filter chats"
          style={({ pressed }) => [
            styles.filterPill,
            { backgroundColor: theme.surfaceMuted },
            Shadow.small,
            pressed && { opacity: 0.85 },
          ]}>
          <Feather name="filter" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.filterLabel, { color: theme.text }]}>
            {activeCustom
              ? activeCustom.name
              : filter === 'all'
              ? ChatCopy.list.filter
              : ChatFilters[filter]}
          </ThemedText>
          <Feather name="chevron-down" size={14} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/edit-filters')}
          accessibilityLabel="Edit filters"
          style={[styles.filterTrash, { backgroundColor: theme.surfaceMuted }]}>
          <Feather name="edit-2" size={14} color={theme.textSecondary} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatRow
            thread={item}
            selected={inSelectMode ? select.ids.has(item.id) : undefined}
            onPress={(t) => {
              if (inSelectMode) {
                dispatch({ type: 'toggle', id: t.id });
              } else {
                router.push({ pathname: '/chat/[id]', params: { id: t.id } });
              }
            }}
            onLongPress={(t) => dispatch({ type: 'enter', id: t.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                {ChatCopy.list.empty}
              </ThemedText>
              <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
                {ChatCopy.list.emptyBody}
              </ThemedText>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: BottomTabInset + Spacing.six }} />}
      />

      <ChatsMoreMenu
        visible={moreOpen}
        onDismiss={() => setMoreOpen(false)}
        anchorRef={moreAnchorRef}
        onSelectChats={() => dispatch({ type: 'enter' })}
        onReadAll={() => {
          void chatRepository.markAllRead();
        }}
      />

      <NewChatMenu visible={plusOpen} onDismiss={() => setPlusOpen(false)} anchorRef={plusAnchorRef} />

      <FilterMenu
        visible={filterOpen}
        onDismiss={() => setFilterOpen(false)}
        anchorRef={filterAnchorRef}
        active={activeCustom ? null : filter}
        customFilters={customFilters}
        activeCustomId={activeCustomFilterId}
        onSelect={(next) => {
          setActiveCustomFilterId(null);
          setFilter(next);
        }}
        onSelectCustom={(id) => setActiveCustomFilterId(id)}
        onAddCustom={() => router.push('/edit-filters')}
      />
    </ThemedView>
  );
}

function matchesFilter(thread: { kind: string; unreadCount: number; isFavourite?: boolean }, filter: ChatFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return thread.unreadCount > 0;
    case 'group':
      return thread.kind === 'group' || thread.kind === 'super';
    case 'super':
      return thread.kind === 'super';
    case 'favourites':
      return Boolean(thread.isFavourite);
    default:
      return true;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerCard: {
    paddingBottom: Spacing.three,
    borderBottomLeftRadius: Radius.cardLg,
    borderBottomRightRadius: Radius.cardLg,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  greeting: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.3,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignSelf: 'flex-end',
  },
  toggleKnobCenter: {
    alignSelf: 'center',
  },
  toggleKnobLeft: {
    alignSelf: 'flex-start',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: FontWeight.medium,
    paddingVertical: 0,
  },
  searchAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusWrap: {
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 36,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
  },
  filterTrash: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.three,
  },
  empty: {
    paddingTop: Spacing.six,
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: FontWeight.semibold,
  },
  emptyBody: {
    fontSize: 13,
  },
});
