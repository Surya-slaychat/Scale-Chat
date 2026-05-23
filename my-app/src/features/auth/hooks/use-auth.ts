import { useMMKVString } from 'react-native-mmkv';

import { StorageKeys, storage } from '@/lib/mmkv';

import { mockAuthRepository } from '../data/mock-auth-repository';
import type { CurrentUser, ProfileUpdate } from '../data/types';

/**
 * Reactive auth state — re-renders consumers when the persisted user changes.
 * Uses react-native-mmkv's `useMMKVString` hook so MMKV writes propagate.
 */
export function useAuth() {
  const [currentUserRaw] = useMMKVString(StorageKeys.authCurrentUser, storage);
  const currentUser: CurrentUser | null = currentUserRaw ? safeParse<CurrentUser>(currentUserRaw) : null;

  return {
    currentUser,
    isAuthenticated: currentUser !== null && currentUser.fullName.length > 0,
    hasVerifiedPhone: currentUser !== null, // verified but maybe missing profile
    signOut: () => mockAuthRepository.signOut(),
    updateProfile: (patch: ProfileUpdate) => mockAuthRepository.updateProfile(patch),
  };
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
