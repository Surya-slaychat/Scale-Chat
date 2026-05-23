import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { AvatarPicker } from '@/features/auth/components/avatar-picker';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { AuthCopy } from '@/features/auth/copy';
import { ProfileUpdateSchema } from '@/features/auth/data/auth-schemas';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { formatIndianMobile, localDigitsFromE164 } from '@/lib/phone';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.fullName ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(currentUser?.avatarUri);
  const [submitting, setSubmitting] = useState(false);

  const phonePretty = currentUser?.phoneE164
    ? formatIndianMobile(localDigitsFromE164(currentUser.phoneE164))
    : '';

  async function handleDone() {
    const parsed = ProfileUpdateSchema.safeParse({ fullName, bio: bio || undefined, avatarUri });
    if (!parsed.success) {
      Alert.alert(AuthCopy.brand, parsed.error.issues[0]?.message ?? AuthCopy.profile.nameRequired);
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile(parsed.data);
      router.replace('/complete');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ThemedText style={[styles.title, { color: Brand.primary }]}>
          {AuthCopy.profile.title}
        </ThemedText>

        <View style={styles.avatarBlock}>
          <AvatarPicker
            uri={avatarUri}
            onPicked={setAvatarUri}
            label={AuthCopy.profile.addPhotoLabel}
          />
        </View>

        <View style={styles.fields}>
          <PillInput
            placeholder={AuthCopy.profile.fullName}
            value={fullName}
            onChangeText={setFullName}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <PillInput
            placeholder={AuthCopy.profile.mobile}
            value={phonePretty}
            editable={false}
            style={{ color: theme.textSecondary }}
          />
          <PillInput
            placeholder={AuthCopy.profile.bio}
            value={bio}
            onChangeText={setBio}
            maxLength={160}
            multiline
          />
        </View>

        <View style={{ flex: 1 }} />

        <PillButton
          label={AuthCopy.profile.cta}
          onPress={handleDone}
          loading={submitting}
          disabled={fullName.trim().length === 0}
        />
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
    paddingTop: Spacing.six,
    gap: Spacing.four,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  avatarBlock: {
    alignItems: 'center',
  },
  fields: {
    gap: Spacing.two,
  },
});
