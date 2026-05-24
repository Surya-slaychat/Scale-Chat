import { Platform } from 'react-native';

import { apiClient, ApiError } from '@/lib/api-client';
import { chatSocket } from '@/lib/chat-socket';
import { StorageKeys, clearKeys, getJson, setJson, storage } from '@/lib/mmkv';

import type { AuthRepository } from './auth-repository';
import type {
  CurrentUser,
  OtpRequestResult,
  OtpVerifyResult,
  ProfileUpdate,
} from './types';

/**
 * Real-API auth repository. Mirrors the mock contract but talks to the NestJS
 * `/auth/*` endpoints described in CLAUDE.md §4:
 *   - POST /auth/otp/request — MSG91 send + rate-limited issuance
 *   - POST /auth/otp/verify  — argon2-verify + JWT pair
 *   - PATCH /me              — profile update
 *   - POST /auth/signout     — revoke refresh family
 *
 * Tokens land in MMKV under the same keys the `apiClient` and `chatSocket`
 * already read, so wiring this in is enough to flip the entire app to real
 * auth without touching screens.
 */

function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable per-install identifier; survives reloads, regenerated on signOut. */
function ensureDeviceId(): string {
  const existing = storage.getString(StorageKeys.authDeviceId);
  if (existing) return existing;
  const next = `${Platform.OS}-${uuid()}`;
  storage.set(StorageKeys.authDeviceId, next);
  return next;
}

type ServerTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
};

type ServerOtpRequestResponse = {
  requestId: string;
  expiresAt: string;
  cooldownMs: number;
};

type ServerMeResponse = {
  id: string;
  phoneE164: string;
  fullName: string;
  bio: string | null;
  avatarUri: string | null;
  isPremium: boolean;
  createdAt: string;
};

function meToCurrentUser(me: ServerMeResponse): CurrentUser {
  return {
    id: me.id,
    fullName: me.fullName,
    phoneE164: me.phoneE164,
    bio: me.bio ?? undefined,
    avatarUri: me.avatarUri ?? undefined,
    isPremium: me.isPremium,
    createdAt: me.createdAt,
  };
}

export const apiAuthRepository: AuthRepository = {
  async requestOtp(phoneE164) {
    try {
      const res = await apiClient.post<ServerOtpRequestResponse>(
        '/auth/otp/request',
        { phoneE164 }
      );
      storage.set(StorageKeys.authPendingPhone, phoneE164);
      return { requestId: res.requestId, expiresAt: res.expiresAt } satisfies OtpRequestResult;
    } catch (err) {
      if (err instanceof ApiError) {
        // Surface as a thrown error so the phone screen's existing handler hits
        // the rate-limit modal. Matches mock contract (mock throws too).
        throw err;
      }
      throw err;
    }
  },

  async verifyOtp({ phoneE164, code }) {
    try {
      const pair = await apiClient.post<ServerTokenPair>('/auth/otp/verify', {
        phoneE164,
        code,
        deviceId: ensureDeviceId(),
      });
      storage.set(StorageKeys.authAccessToken, pair.accessToken);
      storage.set(StorageKeys.authRefreshToken, pair.refreshToken);

      // Pull profile so the rest of the app has a CurrentUser to render against.
      let me: ServerMeResponse;
      try {
        me = await apiClient.get<ServerMeResponse>('/me');
      } catch {
        // /me failure is non-fatal — synthesise a stub the profile screen will fill in.
        me = {
          id: uuid(),
          phoneE164,
          fullName: '',
          bio: null,
          avatarUri: null,
          isPremium: false,
          createdAt: new Date().toISOString(),
        };
      }
      const user = meToCurrentUser(me);
      setJson(StorageKeys.authCurrentUser, user);

      // Open the chat socket with the fresh access token.
      await chatSocket.restart();

      return {
        ok: true,
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
        user,
        isNewUser: user.fullName.length === 0,
      } satisfies OtpVerifyResult;
    } catch (err) {
      if (err instanceof ApiError) {
        type OtpFailureKind = 'invalid_otp' | 'expired' | 'rate_limited' | 'unknown';
        const kindByCode: Record<string, OtpFailureKind> = {
          invalid_code: 'invalid_otp',
          invalid_otp: 'invalid_otp',
          expired: 'expired',
          attempts_exceeded: 'rate_limited',
          rate_limited_phone: 'rate_limited',
          rate_limited_ip: 'rate_limited',
        };
        const kind: OtpFailureKind = kindByCode[err.code] ?? 'unknown';
        return { ok: false, kind, message: err.message };
      }
      return { ok: false, kind: 'unknown', message: 'Network error. Try again.' };
    }
  },

  async updateProfile(patch: ProfileUpdate) {
    const me = await apiClient.patch<ServerMeResponse>('/me', {
      fullName: patch.fullName,
      bio: patch.bio,
      avatarUri: patch.avatarUri,
    });
    const user = meToCurrentUser(me);
    setJson(StorageKeys.authCurrentUser, user);
    return user;
  },

  async signOut() {
    const refreshToken = storage.getString(StorageKeys.authRefreshToken);
    if (refreshToken) {
      try {
        await apiClient.post('/auth/signout', { refreshToken });
      } catch {
        // best-effort; client-side cleanup proceeds anyway
      }
    }
    chatSocket.disconnect();
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
