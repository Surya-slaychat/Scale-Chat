import { z } from 'zod';

/**
 * Polls (Tranche 2.F — 1-on-1 scope).
 *
 * Scope note: Polls in a 1-on-1 chat have at most 2 voters (sender + counterpart),
 * so the UI defaults to single-select and hides the anonymous toggle. The schema
 * is intentionally general so a future Super Groups BRD can reuse it without a
 * second migration.
 *
 * Wire shapes:
 *   - POST /chats/:chatId/polls           body: PollCreateRequest → MessageDto (POLL)
 *   - POST /messages/:id/vote             body: PollVoteRequest   → PollAggregate (viewer-personalised)
 *   - GET  /messages/:id/poll             →                          PollAggregate (viewer-personalised)
 *   - POST /messages/:id/poll/close       (sender-only)           → PollAggregate
 *
 * Read shape — server folds the live aggregate onto `MessageDto.poll` on read
 * for `kind === 'POLL'` messages; non-POLL messages carry `poll: null`.
 *
 * Authoring: `POLL` is in `SERVER_ONLY_KINDS`, so the public `SendMessageSchema`
 * rejects it. POLL `Message` rows are authored by the polls module via the
 * server-only path on `MessagesService.createServerAuthored`.
 */

export const POLL_QUESTION_MAX = 300;
export const POLL_OPTION_LABEL_MAX = 120;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 10;

/**
 * Per-option line on the wire. `votedByMe` is personalised per recipient: the
 * server computes it against the calling user for REST reads and against each
 * member for the socket fan-out.
 */
export const PollOptionSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().min(0),
  label: z.string().min(1).max(POLL_OPTION_LABEL_MAX),
  count: z.number().int().nonnegative(),
  votedByMe: z.boolean(),
});
export type PollOption = z.infer<typeof PollOptionSchema>;

/**
 * The full poll state — inlined on `MessageDto.poll` for POLL messages and
 * also returned by the vote / close endpoints + the `poll:voted` socket event.
 * `totalVoters` is the distinct voter count (independent of options chosen)
 * and drives the "N voted" subline on the bubble.
 */
export const PollAggregateSchema = z.object({
  pollMessageId: z.string().uuid(),
  question: z.string().min(1).max(POLL_QUESTION_MAX),
  multiSelect: z.boolean(),
  anonymous: z.boolean(),
  closedAt: z.string().datetime().nullable(),
  totalVoters: z.number().int().nonnegative(),
  options: z
    .array(PollOptionSchema)
    .min(POLL_OPTIONS_MIN)
    .max(POLL_OPTIONS_MAX),
});
export type PollAggregate = z.infer<typeof PollAggregateSchema>;

/**
 * Create-poll request. `clientMessageId` is the idempotency key for the
 * underlying POLL `Message` row — a retry with the same id returns the
 * existing row.
 *
 * Options are case-insensitively deduplicated to stop "Yes" / "yes" / "YES"
 * from creating three indistinguishable rows; the bubble renders the original
 * casing the user typed (we keep the supplied form).
 */
export const PollCreateRequestSchema = z.object({
  clientMessageId: z.string().min(1).max(64),
  question: z.string().trim().min(1).max(POLL_QUESTION_MAX),
  options: z
    .array(z.string().trim().min(1).max(POLL_OPTION_LABEL_MAX))
    .min(POLL_OPTIONS_MIN)
    .max(POLL_OPTIONS_MAX)
    .refine(
      (arr) => new Set(arr.map((s) => s.toLowerCase())).size === arr.length,
      { message: 'duplicate_options_not_allowed' },
    ),
  multiSelect: z.boolean().default(false),
  anonymous: z.boolean().default(false),
});
export type PollCreateRequestBody = z.infer<typeof PollCreateRequestSchema>;

/**
 * Vote request. `optionIds` is the AUTHORITATIVE post-vote selection set:
 *   - single-select polls: exactly one id.
 *   - multi-select polls: 1..N ids; the server diff-applies (createMany with
 *     skipDuplicates + deleteMany for the complement).
 *
 * Empty `optionIds` is rejected (`min(1)`). To retract from multi-select,
 * send the remaining selection; to retract a single-select vote there is no
 * v1 affordance (deferred to Super Groups BRD).
 */
export const PollVoteRequestSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1).max(POLL_OPTIONS_MAX),
});
export type PollVoteRequestBody = z.infer<typeof PollVoteRequestSchema>;

/**
 * Server → client broadcast on the chat room when:
 *   - any voter changes their selection
 *   - the poll is closed (closedAt flips non-null)
 *
 * The payload is **personalised per recipient**: server iterates the chat
 * members and emits one event per viewer with that viewer's `votedByMe`
 * flags. Clients reconcile by `messageId` and splice the new aggregate onto
 * the cached message.
 */
export const SocketPollVotedSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  poll: PollAggregateSchema,
});
export type SocketPollVoted = z.infer<typeof SocketPollVotedSchema>;
