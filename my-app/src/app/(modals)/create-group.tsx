import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';
import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontWeight, Radius, Spacing } from '@/constants/theme';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { Avatar } from '@/features/chat/components/avatar';
import { SEED_CONTACTS } from '@/features/chat/data/seed';
import { useTheme } from '@/hooks/use-theme';

export default function CreateGroupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const contacts = useMemo(() => SEED_CONTACTS.filter((c) => !c.id.startsWith('g-')), []);
  const canSave = title.trim().length >= 2 && selected.size >= 2;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ModalHeader title="Create Group" />

        <View style={styles.titleField}>
          <PillInput
            value={title}
            onChangeText={setTitle}
            placeholder="Group name"
            autoCapitalize="words"
          />
        </View>

        <ThemedText style={[styles.section, { color: theme.textSecondary }]}>
          Members · {selected.size} selected
        </ThemedText>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.surfaceMuted },
                  pressed && { opacity: 0.85 },
                ]}>
                <Avatar contact={item} size={40} />
                <ThemedText style={[styles.name, { color: theme.text }]}>
                  {item.displayName}
                </ThemedText>
                <View
                  style={[
                    styles.check,
                    { borderColor: theme.divider, backgroundColor: isSelected ? theme.text : 'transparent' },
                  ]}>
                  {isSelected ? <Feather name="check" size={14} color={theme.background} /> : null}
                </View>
              </Pressable>
            );
          }}
        />

        <View style={styles.cta}>
          <PillButton
            label="Create Group"
            disabled={!canSave}
            onPress={() => {
              Alert.alert('Group created', `${title.trim()} · ${selected.size} members`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  titleField: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  section: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  list: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
});
