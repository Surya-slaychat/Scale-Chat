import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/modal-header';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PillButton } from '@/features/auth/components/pill-button';
import { PillInput } from '@/features/auth/components/pill-input';
import { contactsRepository } from '@/features/contacts/data';
import { ApiError } from '@/lib/api-client';
import { isValidIndianMobile, toE164India } from '@/lib/phone';

export default function AddContactScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const phoneValid = isValidIndianMobile(phone);
  const canSave = name.trim().length >= 2 && phoneValid && !saving;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ModalHeader title="Add Contact" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.body}>
          <View style={styles.fields}>
            <PillInput
              value={name}
              onChangeText={setName}
              placeholder="Display name"
              autoCapitalize="words"
              returnKeyType="next"
            />
            <PillInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              prefix="+91"
              keyboardType="phone-pad"
              maxLength={12}
            />
          </View>

          <PillButton
            label={saving ? 'Saving…' : 'Save Contact'}
            disabled={!canSave}
            loading={saving}
            onPress={async () => {
              const e164 = toE164India(phone);
              if (!e164) return;
              setSaving(true);
              try {
                await contactsRepository.add({ phoneE164: e164, displayName: name.trim() });
                Alert.alert('Contact saved', `${name.trim()} · ${e164}`, [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } catch (err) {
                const msg = err instanceof ApiError ? err.message : 'Could not save contact.';
                Alert.alert("Couldn't save", msg);
              } finally {
                setSaving(false);
              }
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
    justifyContent: 'space-between',
  },
  fields: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
});
