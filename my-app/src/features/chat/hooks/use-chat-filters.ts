import type { ChatFilterRow } from '@scalechat/shared';
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { getJson, setJson, StorageKeys } from '@/lib/mmkv';

type State = {
  filters: ChatFilterRow[];
  loading: boolean;
};

type ListResponse = { items: ChatFilterRow[] };

/**
 * Live list of the user's custom chat filters. Hydrates instantly from MMKV
 * cache (versioned key `chat.filters.cache.v1`) so the menu paints without
 * waiting for a round-trip; then refreshes from the server in the background.
 *
 * `useMocks` mode short-circuits to an empty list — custom filters need real
 * backend persistence to be useful, and the in-memory mock would just lose
 * them on reload.
 */
export function useChatFilters(): State & {
  refresh: () => Promise<void>;
  createFilter: typeof createFilter;
  deleteFilter: typeof deleteFilter;
} {
  const [filters, setFilters] = useState<ChatFilterRow[]>(
    () => getJson<ChatFilterRow[]>(StorageKeys.chatFiltersCache) ?? [],
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.get<ListResponse>('/chats/filters');
      setFilters(res.items);
      setJson(StorageKeys.chatFiltersCache, res.items);
    } catch {
      // Stay on cached value — empty list shows "Add" path so the user can recover.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { filters, loading, refresh, createFilter, deleteFilter };
}

export async function createFilter(name: string, criteria: ChatFilterRow['criteria']): Promise<ChatFilterRow> {
  return apiClient.post<ChatFilterRow>('/chats/filters', { name, criteria });
}

export async function deleteFilter(id: string): Promise<void> {
  await apiClient.del<void>(`/chats/filters/${id}`);
}
