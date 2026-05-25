import { useCallback, useMemo } from 'react';

import { apiClient } from '@/lib/api-client';

import { chatRepository } from '../data';

const MAX_CONCURRENT = 8;

/**
 * Run an async mapper over `items` with at most `limit` in flight at once.
 * Hand-rolled to avoid pulling in p-limit — chat-list multi-select tops out
 * around 50 items, far below the threshold where a real limiter library earns
 * its weight.
 */
async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Bulk fan-out actions for chat multi-select mode. Each method maps the
 * selected chat-ids through the per-chat endpoint via the parallel pool.
 *
 * `bulkMarkRead` is idempotent on the server (`PATCH /chats/:id/read`
 * is monotonic by sequence). `bulkFavourite` and `bulkArchive` use the new
 * `PUT /chats/:id/{favourite,archive} { value }` setters, NOT the toggles —
 * spam-tap safety, per the architectural decision in the plan.
 */
export function useBulkChatActions(ids: ReadonlySet<string>) {
  const idList = useMemo(() => Array.from(ids), [ids]);

  const bulkMarkRead = useCallback(async () => {
    // markThreadRead lives on the repo and figures out the upto-sequence per
    // chat itself; reuse it rather than re-implementing.
    await poolMap(idList, MAX_CONCURRENT, async (id) => {
      await chatRepository.markThreadRead(id);
    });
  }, [idList]);

  const setFavouriteAll = useCallback(
    async (value: boolean) => {
      await poolMap(idList, MAX_CONCURRENT, async (id) => {
        await apiClient.put(`/chats/${id}/favourite`, { value });
      });
    },
    [idList],
  );

  const setArchiveAll = useCallback(
    async (value: boolean) => {
      await poolMap(idList, MAX_CONCURRENT, async (id) => {
        await apiClient.put(`/chats/${id}/archive`, { value });
      });
    },
    [idList],
  );

  return {
    bulkMarkRead,
    bulkFavourite: () => setFavouriteAll(true),
    bulkUnfavourite: () => setFavouriteAll(false),
    bulkArchive: () => setArchiveAll(true),
    bulkUnarchive: () => setArchiveAll(false),
  };
}
