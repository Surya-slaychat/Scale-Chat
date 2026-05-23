import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'scalechat' });

export const StorageKeys = {
  authCurrentUser: 'auth.currentUser',
  authPendingPhone: 'auth.pendingPhone',
  authAccessToken: 'auth.accessToken',
  authRefreshToken: 'auth.refreshToken',
} as const;

export function setJson<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function getJson<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearKeys(keys: readonly string[]): void {
  keys.forEach((k) => storage.remove(k));
}
