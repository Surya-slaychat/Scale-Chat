import type {
  AddContactBody,
  Contact,
  ContactsListResponse,
  UpdateContactBody,
} from '@scalechat/shared';

import { apiClient } from '@/lib/api-client';

import type { ContactsRepository } from './contacts-repository';

const listeners = new Set<() => void>();
function notify(): void {
  listeners.forEach((l) => l());
}

export const apiContactsRepository: ContactsRepository = {
  async list(args) {
    const params = new URLSearchParams();
    if (args?.cursor) params.set('cursor', args.cursor);
    if (args?.limit !== undefined) params.set('limit', String(args.limit));
    if (args?.search) params.set('search', args.search);
    const qs = params.toString();
    const res = await apiClient.get<ContactsListResponse>(`/contacts${qs ? `?${qs}` : ''}`);
    return { items: res.items, nextCursor: res.meta.nextCursor };
  },
  async add(body: AddContactBody) {
    const out = await apiClient.post<Contact>('/contacts', body);
    notify();
    return out;
  },
  async update(id: string, patch: UpdateContactBody) {
    const out = await apiClient.patch<Contact>(`/contacts/${id}`, patch);
    notify();
    return out;
  },
  async remove(id: string) {
    await apiClient.del<void>(`/contacts/${id}`);
    notify();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
