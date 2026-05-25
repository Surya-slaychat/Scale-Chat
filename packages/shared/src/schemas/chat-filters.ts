import { z } from 'zod';

import { ChatKindEnum } from './chats.js';

/**
 * User-defined filter criteria stored on `UserChatFilter.criteria` (JSONB).
 *
 * `.strict()` keeps the door shut on future client versions smuggling unknown
 * keys past the validator. Evaluation happens server-side (folded into the
 * Prisma `where` for /chats) so pagination cursors stay deterministic.
 */
export const ChatFilterCriteriaSchema = z
  .object({
    kinds: z.array(ChatKindEnum).optional(),
    unread: z.boolean().optional(),
    favourite: z.boolean().optional(),
    archived: z.boolean().optional(),
    mutedExcluded: z.boolean().optional(),
  })
  .strict();
export type ChatFilterCriteria = z.infer<typeof ChatFilterCriteriaSchema>;

export const CreateChatFilterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  criteria: ChatFilterCriteriaSchema,
});
export type CreateChatFilterBody = z.infer<typeof CreateChatFilterSchema>;

export const ChatFilterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  criteria: ChatFilterCriteriaSchema,
  createdAt: z.string().datetime(),
});
export type ChatFilterRow = z.infer<typeof ChatFilterSchema>;

export const ChatFiltersListResponseSchema = z.object({
  items: z.array(ChatFilterSchema),
});
export type ChatFiltersListResponse = z.infer<typeof ChatFiltersListResponseSchema>;
