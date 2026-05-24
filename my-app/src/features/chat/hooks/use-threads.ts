import { useEffect, useState } from 'react';

import { chatRepository } from '../data';
import type { Thread } from '../types';

/**
 * React hook reflecting the live thread list from the active chat repository
 * (mock in dev, real API in prod — see `features/chat/data/index.ts`).
 */
export function useThreads(): { threads: Thread[]; loading: boolean } {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const next = await chatRepository.listThreads();
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
  }, []);

  return { threads, loading };
}
