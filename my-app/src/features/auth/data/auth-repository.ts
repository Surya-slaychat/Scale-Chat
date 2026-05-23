import type {
  CurrentUser,
  OtpRequestResult,
  OtpVerifyResult,
  ProfileUpdate,
} from './types';

/**
 * Seam for the eventual NestJS auth flow:
 *   - requestOtp → POST /auth/otp/request   (MSG91 SMS)
 *   - verifyOtp  → POST /auth/otp/verify    (returns JWT pair + user)
 *   - updateProfile → PATCH /me
 *   - signOut    → revoke refresh family
 *
 * The mock implementation lives in `./mock-auth-repository`. Swap to a real
 * fetch-backed implementation when the backend is up.
 */
export interface AuthRepository {
  requestOtp(phoneE164: string): Promise<OtpRequestResult>;
  verifyOtp(args: { phoneE164: string; code: string; deviceId: string }): Promise<OtpVerifyResult>;
  updateProfile(patch: ProfileUpdate): Promise<CurrentUser>;
  signOut(): Promise<void>;
  getCurrentUser(): CurrentUser | null;
}
