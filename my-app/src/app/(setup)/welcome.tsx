import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { PillButton } from '@/features/auth/components/pill-button';
import { WelcomeCard } from '@/features/auth/components/welcome-card';
import { AuthCopy } from '@/features/auth/copy';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.cardWrap}>
          <WelcomeCard />
        </View>

        <ThemedText style={[styles.subhead, { color: Brand.primary }]}>
          {AuthCopy.welcome.subheading}
        </ThemedText>

        <View style={styles.encryptionRow}>
          <Feather name="lock" size={14} color={Brand.accent} />
          <ThemedText style={[styles.encryptionText, { color: theme.textSecondary }]}>
            {AuthCopy.welcome.encryptionBadge}
          </ThemedText>
        </View>

        <PillButton label={AuthCopy.welcome.cta} onPress={() => router.push('/terms')} />
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
    gap: Spacing.three,
  },
  cardWrap: {
    flex: 1,
    marginTop: Spacing.three,
  },
  subhead: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  encryptionRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encryptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
