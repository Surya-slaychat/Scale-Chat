import type {
  AddContactBody,
  Contact,
  UpdateContactBody,
} from '@scalechat/shared';

/**
 * Seam for the eventual `/contacts` REST endpoints. Mocked in dev with
 * `EXPO_PUBLIC_USE_MOCKS=true`; otherwise served by `api-contacts-repository`.
 */
export interface ContactsRepository {
  list(cursor?: string): Promise<{ items: Contact[]; nextCursor: string | null }>;
  add(body: AddContactBody): Promise<Contact>;
  update(id: string, body: UpdateContactBody): Promise<Contact>;
  remove(id: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}
