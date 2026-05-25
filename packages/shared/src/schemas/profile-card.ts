import { z } from 'zod';

/**
 * Public profile of *another* user, returned by `GET /users/:id/profile-card`.
 *
 * Distinct from `SelfUser`:
 *   - No `updatedAt` (not relevant for a viewer).
 *   - `phoneE164` IS included for 1-on-1 viewers because, per CLAUDE.md §1,
 *     phone numbers are visible in 1-on-1 chats. Super Group viewers will get
 *     a *masked* variant of this DTO in a later slice — the brand on that one
 *     is the privacy gate.
 *   - `commonChatId` lets the client deep-link "Open chat" from the profile.
 *     Null if no 1-on-1 chat exists yet (e.g. the contact is in the directory
 *     but you haven't messaged them).
 */
export const UserProfileCardSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  phoneE164: z.string(),
  avatarUri: z.string().nullable(),
  bio: z.string().nullable(),
  isPremium: z.boolean(),
  createdAt: z.string().datetime(),
  /** ID of an existing 1-on-1 chat with this user, if any. Null otherwise. */
  commonChatId: z.string().uuid().nullable(),
  /**
   * True if the viewer has blocked this user (one-way: viewer → target).
   * Drives the "Block contact / Unblock contact" CTA on the Contact Profile
   * screen. The server populates this from `BlocksService.isBlocked` in the
   * same query that returns the rest of the card.
   */
  isBlocked: z.boolean(),
});
export type UserProfileCard = z.infer<typeof UserProfileCardSchema>;

/**
 * Stub response for `GET /contacts/:contactUserId/common-groups`. Empty until
 * group chats ship. The shape exists today so the client can write the screen
 * against it and the server's later fill is wire-compatible.
 */
export const CommonGroupRowSchema = z.object({
  chatId: z.string().uuid(),
  title: z.string(),
  avatarUri: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
});
export type CommonGroupRow = z.infer<typeof CommonGroupRowSchema>;

export const CommonGroupsListResponseSchema = z.object({
  items: z.array(CommonGroupRowSchema),
});
export type CommonGroupsListResponse = z.infer<typeof CommonGroupsListResponseSchema>;
