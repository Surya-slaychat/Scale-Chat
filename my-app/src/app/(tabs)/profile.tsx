import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, FontWeight, Spacing } from '@/constants/theme';
import { OutlinedPillButton } from '@/features/auth/components/outlined-pill-button';
import { Avatar } from '@/features/chat/components/avatar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser, signOut } = useAuth();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.body}>
          <Avatar
            contact={{
              id: currentUser?.id ?? 'me',
              displayName: currentUser?.fullName || 'Me',
              avatarUri: currentUser?.avatarUri,
            }}
            size={96}
          />
          <ThemedText style={styles.name}>{currentUser?.fullName || 'Set up profile'}</ThemedText>
          {currentUser?.phoneE164 ? (
            <ThemedText style={[styles.phone, { color: theme.textSecondary }]}>
              {currentUser.phoneE164}
            </ThemedText>
          ) : null}

          <View style={styles.spacer} />

          <View style={[styles.notice, { backgroundColor: theme.surfaceMuted }]}>
            <Feather name="info" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.noticeText, { color: theme.textSecondary }]}>
              Full profile screen lands in the next ticket. Use Sign Out to reset onboarding.
            </ThemedText>
          </View>

          <OutlinedPillButton
            label="Sign Out"
            onPress={() => {
              Alert.alert(
                'Sign out?',
                'You will return to the welcome screen and need to verify your phone again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: async () => {
                      await signOut();
                      router.replace('/welcome');
                    },
                  },
                ]
              );
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
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.two,
  },
  name: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.three,
  },
  phone: {
    fontSize: 14,
  },
  spacer: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    marginBottom: Spacing.three,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
