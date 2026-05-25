import type { Contact as ApiContact } from '@scalechat/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { Avatar } from '@/features/chat/components/avatar';
import { ChatCopy } from '@/features/chat/copy';
import { useContacts } from '@/features/contacts/hooks/use-contacts';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/lib/api-client';

type CreateOneOnOneResponse = { chatId: string };

/**
 * Adapt @scalechat/shared Contact (server shape) to the local Avatar prop shape.
 * Avatar reads only id/avatarUri/(optional) tint+emoji; the rest is filler so the
 * type checks without us widening the Avatar API.
 */
function toAvatarContact(c: ApiContact) {
  return {
    id: c.id,
    displayName: c.displayName,
    phoneE164: c.phoneE164,
    avatarUri: c.avatarUri ?? undefined,
  };
}

export default function NewChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const { contacts, loading } = useContacts({ search: query });
  const [creating, setCreating] = useState<string | null>(null);

  async function openOrCreate(contact: ApiContact) {
    if (creating) return;
    setCreating(contact.id);
    try {
      const body = contact.contactUserId
        ? { contactUserId: contact.contactUserId }
        : { phoneE164: contact.phoneE164 };
      const { chatId } = await apiClient.post<CreateOneOnOneResponse>('/chats/one-on-one', body);
      router.replace({ pathname: '/chat/[id]', params: { id: chatId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open chat.';
      Alert.alert('New chat', message);
    } finally {
      setCreating(null);
    }
  }

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
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={theme.text} />
              </View>
            ) : (
              <View style={styles.empty}>
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {query
                    ? `No contacts match "${query}"`
                    : 'No contacts yet — add one from the menu.'}
                </ThemedText>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openOrCreate(item)}
              disabled={creating === item.id}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surfaceMuted },
                pressed && { opacity: 0.85 },
                creating === item.id && { opacity: 0.6 },
              ]}>
              <Avatar contact={toAvatarContact(item) as never} size={44} />
              <View style={styles.rowText}>
                <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.displayName}
                </ThemedText>
                <ThemedText
                  style={[styles.phone, { color: theme.textSecondary }]}
                  numberOfLines={1}>
                  {item.phoneE164}
                </ThemedText>
              </View>
              {creating === item.id ? <ActivityIndicator color={theme.text} /> : null}
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
  empty: {
    paddingTop: Spacing.six,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
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
