import { z } from 'zod';

/**
 * Per-message moderation report.
 *
 * Reporter (the reader of a counterpart's bubble) submits a reason; the row
 * stays server-side only and is never broadcast back to chat sockets. A user
 * can re-report the same message with a *different* reason but the unique
 * constraint `(messageId, reporterUserId, reason)` stops repeated taps from
 * spamming the moderation queue.
 */
export const ReportReasonEnum = z.enum([
  'SPAM',
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'IMPERSONATION',
  'OTHER',
]);
export type ReportReason = z.infer<typeof ReportReasonEnum>;

/** POST /messages/:id/report body. */
export const CreateMessageReportSchema = z.object({
  reason: ReportReasonEnum,
  /** Optional free-form note (≤500 chars). Useful when `reason === 'OTHER'`. */
  note: z.string().trim().max(500).optional(),
});
export type CreateMessageReportBody = z.infer<typeof CreateMessageReportSchema>;

/** Ack returned to the client — intentionally tiny; the moderation surface
 *  itself never leaks back to the reporter. */
export const MessageReportAckSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('OPEN'),
});
export type MessageReportAck = z.infer<typeof MessageReportAckSchema>;
