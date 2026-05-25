import { useCallback } from 'react';
import { useMMKVString } from 'react-native-mmkv';

import { storage, StorageKeys } from '@/lib/mmkv';

export type ThemeMode = 'system' | 'light' | 'dark';

const VALID: readonly ThemeMode[] = ['system', 'light', 'dark'];

function parse(raw: string | undefined): ThemeMode {
  return raw && (VALID as readonly string[]).includes(raw) ? (raw as ThemeMode) : 'system';
}

/**
 * Manual theme override. Reactive across components — MMKV v4 (Nitro) wires
 * cross-component sync via useMMKVString. Default is 'system' which means
 * useTheme() falls back to useColorScheme().
 */
export function useThemeMode(): { mode: ThemeMode; cycle: () => void; set: (next: ThemeMode) => void } {
  const [raw, setRaw] = useMMKVString(StorageKeys.themeMode, storage);
  const mode = parse(raw);

  const set = useCallback(
    (next: ThemeMode) => {
      setRaw(next);
    },
    [setRaw],
  );

  const cycle = useCallback(() => {
    const idx = VALID.indexOf(mode);
    const next = VALID[(idx + 1) % VALID.length];
    setRaw(next);
  }, [mode, setRaw]);

  return { mode, cycle, set };
}
