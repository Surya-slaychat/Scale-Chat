import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { PickerPill } from '@/features/auth/components/picker-pill';
import { PillButton } from '@/features/auth/components/pill-button';
import { AuthCopy } from '@/features/auth/copy';
import { useTheme } from '@/hooks/use-theme';

const PRIVACY_URL = 'https://scalechat.app/privacy';
const TERMS_URL = 'https://scalechat.app/terms';

export default function TermsScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.iconCard}>
          <View style={styles.lockBg}>
            <Feather name="lock" size={40} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.body}>
          <ThemedText style={[styles.line, { color: theme.text }]}>
            By signing up, you agree to {AuthCopy.brand}&apos;s{' '}
            <ThemedText
              style={[styles.link, { color: Brand.primary }]}
              onPress={() => Linking.openURL(PRIVACY_URL)}>
              {AuthCopy.terms.privacyLabel}
            </ThemedText>{' '}
            and{' '}
            <ThemedText
              style={[styles.link, { color: Brand.primary }]}
              onPress={() => Linking.openURL(TERMS_URL)}>
              {AuthCopy.terms.termsLabel}
            </ThemedText>
            .
          </ThemedText>
          <ThemedText style={[styles.line, { color: theme.textSecondary }]}>
            {AuthCopy.terms.line2(AuthCopy.brand)}{' '}
            <Pressable
              onPress={() => Linking.openURL(PRIVACY_URL)}
              accessibilityRole="link">
              <ThemedText style={[styles.link, { color: Brand.primary }]}>
                {AuthCopy.terms.learnMore}
              </ThemedText>
            </Pressable>
          </ThemedText>

          <View style={styles.languageRow}>
            <PickerPill
              leadingIcon="globe"
              label={AuthCopy.terms.languageLabel}
              style={styles.languagePill}
            />
          </View>
        </View>

        <PillButton label={AuthCopy.terms.cta} onPress={() => router.push('/phone')} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  iconCard: {
    height: 240,
    backgroundColor: Brand.cardWelcome,
    borderRadius: 28,
    marginTop: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  line: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
  },
  link: {
    fontWeight: '600',
  },
  languageRow: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  languagePill: {
    minWidth: 160,
  },
});
