import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, FontWeight, Radius, Spacing } from '@/constants/theme';
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
          {/* Three translucent concentric circles → centre lock + check badge. */}
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMiddle]} />
          <View style={[styles.ring, styles.ringInner]}>
            <Feather name="lock" size={42} color="#FFFFFF" />
            <View style={styles.checkBadge}>
              <Feather name="check" size={12} color={Brand.cardWelcome} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <ThemedText style={[styles.line, { color: theme.text }]}>
            {AuthCopy.terms.line1Lead}{' '}
            <ThemedText
              style={[styles.link, { color: Brand.primary }]}
              onPress={() => Linking.openURL(PRIVACY_URL)}>
              {AuthCopy.terms.privacyLabel}
            </ThemedText>{' '}
            {AuthCopy.terms.and}{' '}
            <ThemedText
              style={[styles.link, { color: Brand.primary }]}
              onPress={() => Linking.openURL(TERMS_URL)}>
              {AuthCopy.terms.termsLabel}
            </ThemedText>
            .
          </ThemedText>
          <ThemedText style={[styles.line, { color: theme.text }]}>
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

const ICON_CARD_SIZE = 260;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  iconCard: {
    height: ICON_CARD_SIZE,
    backgroundColor: Brand.cardWelcome,
    borderRadius: Radius.cardLg,
    marginTop: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  ringOuter: {
    width: 180,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  ringMiddle: {
    width: 130,
    height: 130,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  ringInner: {
    width: 92,
    height: 92,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  checkBadge: {
    position: 'absolute',
    right: 4,
    bottom: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  line: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: FontWeight.regular,
    paddingHorizontal: Spacing.two,
    letterSpacing: -0.2,
  },
  link: {
    fontWeight: FontWeight.semibold,
  },
  languageRow: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  languagePill: {
    minWidth: 140,
  },
});
