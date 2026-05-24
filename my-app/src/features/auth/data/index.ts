import { apiAuthRepository } from './api-auth-repository';
import type { AuthRepository } from './auth-repository';
import { mockAuthRepository } from './mock-auth-repository';

/**
 * Env-driven auth seam, mirroring `features/chat/data/index.ts`. Defaults to
 * mocks in dev so contributors can drive the onboarding flow without a running
 * backend. Flip to the real backend with `EXPO_PUBLIC_USE_MOCKS=false`.
 */
const useMocks =
  (process.env.EXPO_PUBLIC_USE_MOCKS ?? (__DEV__ ? 'true' : 'false')).toLowerCase() === 'true';

export const authRepository: AuthRepository = useMocks ? mockAuthRepository : apiAuthRepository;

export { apiAuthRepository, mockAuthRepository };
export type { AuthRepository } from './auth-repository';
