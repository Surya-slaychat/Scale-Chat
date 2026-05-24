import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { StoriesCopy } from '@/features/stories/copy';
import { useTheme } from '@/hooks/use-theme';

type Audience = 'contacts' | 'selected' | 'public';

const OPTIONS: { key: Audience; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'contacts', label: StoriesCopy.composer.audienceContacts, icon: 'users' },
  { key: 'selected', label: StoriesCopy.composer.audienceSelected, icon: 'user-check' },
  { key: 'public', label: StoriesCopy.composer.audiencePublic, icon: 'globe' },
];

/**
 * Story composer — shell screen. Real impl in PR 3 swaps the gradient preview
 * for `expo-camera` + `expo-image-picker` and posts via storiesRepository.
 */
export default function StoryComposer() {
  const router = useRouter();
  const theme = useTheme();
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('contacts');

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: theme.surfaceMuted },
              pressed && { opacity: 0.7 },
            ]}>
            <Feather name="x" size={18} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{StoriesCopy.sectionTitle}</ThemedText>
          <View style={[styles.headerBtn, { opacity: 0 }]} />
        </View>

        <View style={[styles.preview, { backgroundColor: Brand.cardWelcome }]}>
          <Feather name="camera" size={48} color="#FFFFFF" />
          <ThemedText style={styles.previewHint}>Tap to capture (next ticket)</ThemedText>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.controls}>
          <PillInput
            value={caption}
            onChangeText={setCaption}
            placeholder={StoriesCopy.composer.captionPlaceholder}
          />

          <View style={styles.audienceRow}>
            {OPTIONS.map((option) => {
              const isSelected = option.key === audience;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setAudience(option.key)}
                  style={({ pressed }) => [
                    styles.audience,
                    {
                      backgroundColor: isSelected ? theme.text : theme.surfaceMuted,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Feather
                    name={option.icon}
                    size={14}
                    color={isSelected ? theme.background : theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.audienceLabel,
                      { color: isSelected ? theme.background : theme.textSecondary },
                    ]}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <PillButton
            label={StoriesCopy.composer.post}
            onPress={() =>
              Alert.alert('Story posted', `Audience: ${audience}`, [
                { text: 'OK', onPress: () => router.back() },
              ])
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: FontWeight.semibold,
  },
  preview: {
    flex: 1,
    margin: Spacing.three,
    borderRadius: Radius.cardLg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  previewHint: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: FontWeight.medium,
    opacity: 0.85,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  audience: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  audienceLabel: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },
});
