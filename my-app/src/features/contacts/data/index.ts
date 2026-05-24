import { apiContactsRepository } from './api-contacts-repository';
import type { ContactsRepository } from './contacts-repository';
import { mockContactsRepository } from './mock-contacts-repository';

/**
 * Env-driven selector. `EXPO_PUBLIC_USE_MOCKS=true` (or unset in dev) → mock,
 * otherwise the real API client. Single switch, used by every screen via
 * `contactsRepository`.
 */
const useMocks =
  (process.env.EXPO_PUBLIC_USE_MOCKS ?? (__DEV__ ? 'true' : 'false')).toLowerCase() === 'true';

export const contactsRepository: ContactsRepository = useMocks
  ? mockContactsRepository
  : apiContactsRepository;

export { mockContactsRepository, apiContactsRepository };
export type { ContactsRepository } from './contacts-repository';
