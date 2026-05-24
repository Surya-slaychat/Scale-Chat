import { useMMKVString } from 'react-native-mmkv';

import { StorageKeys, storage } from '@/lib/mmkv';

import { authRepository } from '../data';
import type { CurrentUser, ProfileUpdate } from '../data/types';

/**
 * Reactive auth state — re-renders consumers when the persisted user changes.
 * Uses react-native-mmkv's `useMMKVString` hook so MMKV writes propagate.
 *
 * The seam underneath (`authRepository`) flips between mock and real-API impls
 * via `EXPO_PUBLIC_USE_MOCKS`. Both write `auth.currentUser` to MMKV so this
 * hook's contract is identical regardless of which impl is active.
 */
export function useAuth() {
  const [currentUserRaw] = useMMKVString(StorageKeys.authCurrentUser, storage);
  const currentUser: CurrentUser | null = currentUserRaw ? safeParse<CurrentUser>(currentUserRaw) : null;

  return {
    currentUser,
    isAuthenticated: currentUser !== null && currentUser.fullName.length > 0,
    hasVerifiedPhone: currentUser !== null, // verified but maybe missing profile
    signOut: () => authRepository.signOut(),
    updateProfile: (patch: ProfileUpdate) => authRepository.updateProfile(patch),
  };
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
