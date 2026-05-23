import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { BrandModal } from '@/features/auth/components/brand-modal';
import { PillButton } from '@/features/auth/components/pill-button';
import { AuthCopy } from '@/features/auth/copy';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function CompleteScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser } = useAuth();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  return (
    <BrandModal visible onRequestClose={() => undefined}>
      <ThemedText style={[styles.greeting, { color: theme.text }]}>
        {AuthCopy.complete.greeting(currentUser?.fullName ?? '')}
      </ThemedText>

      <View style={styles.badgeWrap}>
        <View style={[styles.badgeOuter, { backgroundColor: Brand.primary }]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                {
                  transform: [
                    { rotate: `${i * 30}deg` },
                    { translateY: -52 },
                  ],
                },
              ]}
            />
          ))}
          <Feather name="check" size={48} color="#FFFFFF" />
        </View>
      </View>

      <ThemedText style={[styles.title, { color: theme.text }]}>
        {AuthCopy.complete.title}
      </ThemedText>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        {AuthCopy.complete.body}
      </ThemedText>

      <PillButton
        label={AuthCopy.complete.cta}
        onPress={() => router.replace('/(tabs)')}
      />
    </BrandModal>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgeWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  badgeOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.primary,
    top: '50%',
    left: '50%',
    marginLeft: -3,
    marginTop: -3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
});
