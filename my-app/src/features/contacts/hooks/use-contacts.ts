import type { Contact } from '@scalechat/shared';
import { useDeferredValue, useEffect, useState } from 'react';

import { contactsRepository } from '../data';

type Args = {
  /** Free-text predicate. Debounced internally via React 19's useDeferredValue. */
  search?: string;
};

type State = {
  contacts: Contact[];
  loading: boolean;
};

/**
 * Reactive contacts list. Mirrors the useThreads() pattern: imperative load +
 * repository.subscribe(refresh) for invalidation on add/update/remove.
 *
 * `search` is debounced inside the hook (not in the caller) so every consumer
 * gets the same network rhythm — useDeferredValue yields to higher-priority
 * renders before issuing the API call.
 */
export function useContacts({ search = '' }: Args = {}): State {
  const deferredSearch = useDeferredValue(search.trim());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const { items } = await contactsRepository.list(
          deferredSearch ? { search: deferredSearch } : undefined,
        );
        if (!active) return;
        setContacts(items);
      } catch {
        if (active) setContacts([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    refresh();
    const unsubscribe = contactsRepository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [deferredSearch]);

  return { contacts, loading };
}
