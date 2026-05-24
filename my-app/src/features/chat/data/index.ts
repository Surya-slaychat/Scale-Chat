import { apiChatRepository } from './api-chat-repository';
import type { ChatRepository } from './chat-repository';
import { mockChatRepository } from './mock-chat-repository';

/**
 * Env-driven selector — same pattern as `features/contacts/data/index.ts`.
 *
 * Defaults to mocks when running under `__DEV__` so contributors can drive the
 * Contact Page without running the API locally. Override with
 * `EXPO_PUBLIC_USE_MOCKS=false` to point at the live backend.
 */
const useMocks =
  (process.env.EXPO_PUBLIC_USE_MOCKS ?? (__DEV__ ? 'true' : 'false')).toLowerCase() === 'true';

export const chatRepository: ChatRepository = useMocks ? mockChatRepository : apiChatRepository;

export { apiChatRepository, mockChatRepository };
export type { ChatRepository } from './chat-repository';
