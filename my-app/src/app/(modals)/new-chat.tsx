import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { Avatar } from '@/features/chat/components/avatar';
import { ChatCopy } from '@/features/chat/copy';
import { SEED_CONTACTS } from '@/features/chat/data/seed';
import { useTheme } from '@/hooks/use-theme';

export default function NewChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEED_CONTACTS.filter(
      (c) => !c.id.startsWith('g-') && (q.length === 0 || c.displayName.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ModalHeader title="New Chat" />

        <View style={[styles.search, { backgroundColor: theme.surfaceInput }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={ChatCopy.list.searchPlaceholder}
            placeholderTextColor={theme.inputPlaceholder}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                // Mock impl: navigate to the existing seeded thread for this contact.
                // Real impl (api-chat-repository.createOneOnOne) will be wired in PR 2.
                const threadId = `t-${item.id.replace('c-', '')}`;
                router.replace({ pathname: '/chat/[id]', params: { id: threadId } });
              }}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surfaceMuted },
                pressed && { opacity: 0.85 },
              ]}>
              <Avatar contact={item} size={44} />
              <View style={styles.rowText}>
                <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.displayName}
                </ThemedText>
                {item.phoneE164 ? (
                  <ThemedText
                    style={[styles.phone, { color: theme.textSecondary }]}
                    numberOfLines={1}>
                    {item.phoneE164}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  search: {
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  searchInput: {
    fontSize: 14,
    fontWeight: FontWeight.medium,
    paddingVertical: 0,
  },
  list: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
  rowText: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  phone: {
    fontSize: 12,
  },
});
