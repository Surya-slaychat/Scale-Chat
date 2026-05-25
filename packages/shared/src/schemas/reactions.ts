import { z } from 'zod';

/**
 * Emoji reactions on messages (Phase 2.1).
 *
 * Wire shapes:
 *   - POST   /messages/:id/reactions  body: { emoji }     → ReactionsListSchema
 *   - DELETE /messages/:id/reactions/:emoji               → ReactionsListSchema
 *
 * Read shape — server aggregates per emoji and inlines on `MessageDto.reactions`:
 *   `{ emoji, count, reactedByMe }[]`
 *
 * Validation:
 *   - `emoji` is 1–16 UTF-8 bytes. Sixteen covers every multi-codepoint emoji
 *     (skin-tone + ZWJ + variation selector sequences) we care about. We do
 *     NOT validate the unicode category — the picker on the client gates the
 *     input, and a determined attacker writing arbitrary strings here only
 *     pollutes their own reaction row.
 */
export const ReactionEmojiSchema = z
  .string()
  .min(1)
  .max(16, 'emoji must be ≤16 UTF-8 bytes');

export const AddReactionSchema = z.object({
  emoji: ReactionEmojiSchema,
});
export type AddReactionBody = z.infer<typeof AddReactionSchema>;

export const ReactionAggregateSchema = z.object({
  emoji: ReactionEmojiSchema,
  count: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
});
export type ReactionAggregate = z.infer<typeof ReactionAggregateSchema>;

/** Returned by add/remove endpoints + broadcast as `reaction:updated`. */
export const ReactionsListSchema = z.object({
  messageId: z.string().uuid(),
  reactions: z.array(ReactionAggregateSchema),
});
export type ReactionsList = z.infer<typeof ReactionsListSchema>;

/** Server → client socket event when a message's reactions change. */
export const SocketReactionUpdatedSchema = ReactionsListSchema.extend({
  chatId: z.string().uuid(),
});
export type SocketReactionUpdated = z.infer<typeof SocketReactionUpdatedSchema>;
