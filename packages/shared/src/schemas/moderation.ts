import { z } from 'zod';

/**
 * Body for `PATCH /chats/:id/mute` — Mute notifications for a chat.
 *
 *   - `until: ISO string` → mute until that instant (the client passes
 *     `Date.now() + 8h | 1w | …` so the server doesn't have to know presets).
 *   - `until: null`       → unmute (clears `ChatMember.mutedUntil`).
 */
export const MuteChatSchema = z.object({
  until: z.string().datetime().nullable(),
});
export type MuteChatBody = z.infer<typeof MuteChatSchema>;

export const MuteChatResponseSchema = z.object({
  chatId: z.string().uuid(),
  mutedUntil: z.string().datetime().nullable(),
});
export type MuteChatResponse = z.infer<typeof MuteChatResponseSchema>;

/**
 * `PATCH /chats/:id/clear` — Per-user "Clear chat". Sets the caller's
 * `ChatMember.clearedAt` to now; subsequent message-list reads filter to
 * `createdAt > clearedAt`. Counterpart's history is untouched.
 *
 * No body; idempotent — re-calling resets the cutoff to the new now.
 */
export const ClearChatResponseSchema = z.object({
  chatId: z.string().uuid(),
  clearedAt: z.string().datetime(),
});
export type ClearChatResponse = z.infer<typeof ClearChatResponseSchema>;

/**
 * `POST /users/:id/block`  → block
 * `DELETE /users/:id/block` → unblock
 *
 * Both 204-style — no body in / no body out (status only). The server enforces
 * symmetric blocking at the message layer: once either party has blocked the
 * other, sends and broadcasts between them are dropped.
 */
export const BlockStatusResponseSchema = z.object({
  blockedUserId: z.string().uuid(),
  isBlocked: z.boolean(),
});
export type BlockStatusResponse = z.infer<typeof BlockStatusResponseSchema>;
