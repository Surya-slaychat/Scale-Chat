import { useEffect, useState } from 'react';

import { chatRepository } from '../data';
import type { Thread } from '../types';

type Args = {
  /** Optional UserChatFilter id. When set, server applies its criteria. */
  customFilterId?: string | null;
};

/**
 * React hook reflecting the live thread list from the active chat repository
 * (mock in dev, real API in prod — see `features/chat/data/index.ts`).
 *
 * `customFilterId` is passed through to the API repo's `?customFilterId=`
 * query param. Changing it re-fetches.
 */
export function useThreads(args: Args = {}): { threads: Thread[]; loading: boolean } {
  const { customFilterId } = args;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const next = await chatRepository.listThreads(
          customFilterId ? { customFilterId } : undefined,
        );
        if (!active) return;
        setThreads(next);
      } catch {
        // Surface zero threads on error — the UI shows the empty state.
        if (active) setThreads([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    refresh();
    const unsubscribe = chatRepository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [customFilterId]);

  return { threads, loading };
}
