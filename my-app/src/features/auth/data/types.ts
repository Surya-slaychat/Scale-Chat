/**
 * Auth domain types — mirror the eventual backend contract from CLAUDE.md §4.
 * Fields the mock doesn't use are kept so the swap to real NestJS later is a no-op
 * for screens. See [[project-backend-reference]].
 */

export type CurrentUser = {
  id: string;
  fullName: string;
  phoneE164: string;
  bio?: string;
  avatarUri?: string;
  isPremium: boolean;
  createdAt: string;
};

export type OtpRequestResult = {
  requestId: string;
  expiresAt: string;
};

export type OtpVerifySuccess = {
  ok: true;
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
  isNewUser: boolean;
};

export type OtpVerifyFailure = {
  ok: false;
  kind: 'invalid_otp' | 'expired' | 'rate_limited' | 'unknown';
  message?: string;
};

export type OtpVerifyResult = OtpVerifySuccess | OtpVerifyFailure;

export type ProfileUpdate = {
  fullName: string;
  bio?: string;
  avatarUri?: string;
};

/** State held during the onboarding flow before the user is persisted. */
export type OnboardingDraft = {
  phoneE164: string;
  acceptedTermsAt: string;
  language: 'en';
};
