import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';
import { ModalHeader } from '@/components/modal-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { useTheme } from '@/hooks/use-theme';

export default function CreateSuperGroupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phones, setPhones] = useState('');

  const phoneLines = phones
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const canSave = title.trim().length >= 2 && phoneLines.length >= 2;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ModalHeader title="Create Super Group" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <View style={[styles.banner, { backgroundColor: theme.surfaceMuted, borderColor: theme.divider }]}>
              <Feather name="shield" size={16} color={Brand.primary} />
              <ThemedText style={[styles.bannerText, { color: theme.textSecondary }]}>
                Members can talk together but cannot see each other&apos;s phone numbers. Only
                admins (you) have full visibility.
              </ThemedText>
            </View>

            <View style={styles.fields}>
              <PillInput
                value={title}
                onChangeText={setTitle}
                placeholder="Super group name"
                autoCapitalize="words"
              />
              <PillInput
                value={description}
                onChangeText={setDescription}
                placeholder="Audience description (optional)"
                autoCapitalize="sentences"
              />
              <View style={[styles.multiline, { backgroundColor: theme.surfaceInput }]}>
                <ThemedText
                  style={[styles.multilineLabel, { color: theme.inputPlaceholder }]}
                  numberOfLines={1}>
                  Members · one phone per line
                </ThemedText>
                <TextInput
                  value={phones}
                  onChangeText={setPhones}
                  placeholder={'+91 98765 43210\n+91 90000 11111'}
                  placeholderTextColor={theme.inputPlaceholder}
                  multiline
                  style={[styles.multilineInput, { color: theme.text }]}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.cta}>
            <PillButton
              label="Create Super Group"
              disabled={!canSave}
              onPress={() => {
                Alert.alert(
                  'Super group created',
                  `${title.trim()} · ${phoneLines.length} members invited`,
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  banner: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 0.5,
    alignItems: 'flex-start',
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  fields: {
    gap: Spacing.three,
  },
  multiline: {
    borderRadius: Radius.card,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  multilineLabel: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
    paddingHorizontal: Spacing.three,
  },
  multilineInput: {
    minHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontWeight: FontWeight.regular,
    textAlignVertical: 'top',
  },
  cta: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
});
