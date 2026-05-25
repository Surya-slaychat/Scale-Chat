import { Feather } from '@expo/vector-icons';
import type { ChatFilterCriteria, ChatKind } from '@scalechat/shared';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useChatFilters } from '@/features/chat/hooks/use-chat-filters';
import { useTheme } from '@/hooks/use-theme';

type ToggleKey = 'unread' | 'favourite' | 'archived' | 'group' | 'super';

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'unread', label: 'Unread only' },
  { key: 'favourite', label: 'Favourites only' },
  { key: 'archived', label: 'Archived only' },
  { key: 'group', label: 'Groups only' },
  { key: 'super', label: 'Super Groups only' },
];

function buildCriteria(name: string, toggles: Record<ToggleKey, boolean>): ChatFilterCriteria | null {
  if (!name.trim()) return null;
  const kinds: ChatKind[] = [];
  if (toggles.group) kinds.push('GROUP');
  if (toggles.super) kinds.push('SUPER_GROUP');
  const criteria: ChatFilterCriteria = {
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(toggles.unread ? { unread: true } : {}),
    ...(toggles.favourite ? { favourite: true } : {}),
    ...(toggles.archived ? { archived: true } : {}),
  };
  // Reject filters that match everything — at least one toggle must be set.
  if (Object.keys(criteria).length === 0) return null;
  return criteria;
}

export default function EditFiltersScreen() {
  const theme = useTheme();
  const { filters, refresh, createFilter, deleteFilter } = useChatFilters();
  const [name, setName] = useState('');
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    unread: false,
    favourite: false,
    archived: false,
    group: false,
    super: false,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const criteria = buildCriteria(name, toggles);
    if (!criteria) {
      Alert.alert('Filter incomplete', 'Pick a name and at least one rule.');
      return;
    }
    setBusy(true);
    try {
      await createFilter(name.trim(), criteria);
      await refresh();
      setName('');
      setToggles({ unread: false, favourite: false, archived: false, group: false, super: false });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    Alert.alert('Delete filter?', `Remove "${label}" from your filter chips.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFilter(id);
            await refresh();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ModalHeader title="Edit filters" />

        <FlatList
          data={filters}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
          ListHeaderComponent={
            <View style={styles.creator}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>New filter</ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name (e.g. Unread groups)"
                placeholderTextColor={theme.inputPlaceholder}
                style={[
                  styles.input,
                  { backgroundColor: theme.surfaceInput, color: theme.text },
                ]}
              />
              {TOGGLES.map(({ key, label }) => (
                <Pressable
                  key={key}
                  onPress={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                  style={({ pressed }) => [
                    styles.toggleRow,
                    { backgroundColor: theme.surfaceMuted },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: toggles[key] ? Brand.accent : theme.textSecondary,
                        backgroundColor: toggles[key] ? Brand.accent : 'transparent',
                      },
                    ]}>
                    {toggles[key] ? <Feather name="check" size={14} color={Brand.accentText} /> : null}
                  </View>
                  <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>{label}</ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={save}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: Brand.primary },
                  pressed && { opacity: 0.85 },
                  busy && { opacity: 0.5 },
                ]}>
                <ThemedText style={[styles.saveText, { color: '#fff' }]}>
                  {busy ? 'Saving…' : 'Save filter'}
                </ThemedText>
              </Pressable>

              <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.four }]}>
                Your filters
              </ThemedText>
              {filters.length === 0 ? (
                <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>
                  No custom filters yet.
                </ThemedText>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.filterRow, { backgroundColor: theme.surfaceMuted }]}>
              <View style={styles.filterRowText}>
                <ThemedText style={[styles.filterName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText style={[styles.filterDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                  {describeCriteria(item.criteria)}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => remove(item.id, item.name)}
                accessibilityLabel={`Delete ${item.name}`}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}>
                <Feather name="trash-2" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function describeCriteria(c: ChatFilterCriteria): string {
  const parts: string[] = [];
  if (c.kinds?.length) parts.push(c.kinds.join(' + '));
  if (c.unread) parts.push('unread');
  if (c.favourite) parts.push('favourites');
  if (c.archived) parts.push('archived');
  if (c.mutedExcluded) parts.push('not muted');
  return parts.join(' · ') || 'all chats';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  creator: { gap: Spacing.two, marginBottom: Spacing.three },
  sectionTitle: { fontSize: 13, fontWeight: FontWeight.semibold, marginBottom: 4 },
  input: {
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.pill,
    fontSize: 14,
    fontWeight: FontWeight.medium,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { fontSize: 14, fontWeight: FontWeight.medium },
  saveBtn: {
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  saveText: { fontSize: 14, fontWeight: FontWeight.semibold },
  empty: { fontSize: 13, paddingVertical: Spacing.two },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
  filterRowText: { flex: 1, gap: 2, minWidth: 0 },
  filterName: { fontSize: 15, fontWeight: FontWeight.semibold },
  filterDesc: { fontSize: 12 },
  deleteBtn: { padding: Spacing.two },
});
