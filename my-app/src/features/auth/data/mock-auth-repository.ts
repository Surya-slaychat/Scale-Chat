import { Platform } from 'react-native';

import { StorageKeys, clearKeys, getJson, setJson, storage } from '@/lib/mmkv';

import type { AuthRepository } from './auth-repository';
import type {
  CurrentUser,
  OtpRequestResult,
  OtpVerifyResult,
  ProfileUpdate,
} from './types';

const MOCK_LATENCY_MS = 800;
/** Test OTP code accepted in mock mode. Matches `OTP_DIGITS` in auth-schemas. */
const MOCK_OTP_CODE = '1234';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuid(): string {
  // Crypto.randomUUID is available on Hermes/RN 0.74+; fall back if missing.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function deviceTagline(): string {
  return `${Platform.OS}-mock`;
}

export const mockAuthRepository: AuthRepository = {
  async requestOtp(phoneE164) {
    await sleep(MOCK_LATENCY_MS);
    if (__DEV__) {
      console.log(`[mock-auth] OTP for ${phoneE164}: ${MOCK_OTP_CODE}`);
    }
    storage.set(StorageKeys.authPendingPhone, phoneE164);
    return {
      requestId: uuid(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    } satisfies OtpRequestResult;
  },

  async verifyOtp({ phoneE164, code }) {
    await sleep(MOCK_LATENCY_MS);

    if (code !== MOCK_OTP_CODE) {
      return { ok: false, kind: 'invalid_otp', message: 'Wrong OTP. Check your message again.' };
    }

    const existing = mockAuthRepository.getCurrentUser();
    const user: CurrentUser =
      existing && existing.phoneE164 === phoneE164
        ? existing
        : {
            id: uuid(),
            fullName: '',
            phoneE164,
            isPremium: false,
            createdAt: new Date().toISOString(),
          };

    setJson(StorageKeys.authCurrentUser, user);
    storage.set(StorageKeys.authAccessToken, `mock-access-${uuid()}`);
    storage.set(StorageKeys.authRefreshToken, `mock-refresh-${uuid()}-${deviceTagline()}`);

    return {
      ok: true,
      accessToken: storage.getString(StorageKeys.authAccessToken) ?? '',
      refreshToken: storage.getString(StorageKeys.authRefreshToken) ?? '',
      user,
      isNewUser: !existing || existing.phoneE164 !== phoneE164 || !existing.fullName,
    } satisfies OtpVerifyResult;
  },

  async updateProfile(patch: ProfileUpdate) {
    await sleep(MOCK_LATENCY_MS / 2);
    const current = mockAuthRepository.getCurrentUser();
    if (!current) {
      throw new Error('No current user to update — call verifyOtp first.');
    }
    const updated: CurrentUser = {
      ...current,
      fullName: patch.fullName,
      bio: patch.bio,
      avatarUri: patch.avatarUri ?? current.avatarUri,
    };
    setJson(StorageKeys.authCurrentUser, updated);
    return updated;
  },

  async signOut() {
    clearKeys([
      StorageKeys.authCurrentUser,
      StorageKeys.authAccessToken,
      StorageKeys.authRefreshToken,
      StorageKeys.authPendingPhone,
    ]);
  },

  getCurrentUser() {
    return getJson<CurrentUser>(StorageKeys.authCurrentUser);
  },
};

export const MOCK_OTP_FOR_DEV = MOCK_OTP_CODE;
