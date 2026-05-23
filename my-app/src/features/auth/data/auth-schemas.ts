import { z } from 'zod';

const E164India = z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian mobile in E.164 form');

export const OtpRequestSchema = z.object({
  phoneE164: E164India,
});

export const OtpVerifyArgsSchema = z.object({
  phoneE164: E164India,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  deviceId: z.string().min(1),
});

export const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
  bio: z.string().trim().max(160, 'Bio is too long').optional(),
  avatarUri: z.string().optional(),
});

export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyArgsInput = z.infer<typeof OtpVerifyArgsSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
