import type { PrismaClient } from '@prisma/client';
import type { PollAggregate } from '@scalechat/shared';

/**
 * Load `PollAggregate`s for a set of POLL message ids, personalised for a
 * specific viewer (drives `options[].votedByMe`).
 *
 * Returned shape: `Map<messageId, PollAggregate>` — entries are only present
 * for messages that have an associated `poll_messages` row. Callers that pass
 * non-POLL message ids in the input get a partial map back; folding into
 * DTOs is `result.get(m.id) ?? null`.
 *
 * Lives in its own file (not inside `polls.service.ts`) so `MessagesService`
 * can inject poll aggregates into list/send paths without a circular module
 * dependency on the polls module.
 */
export async function loadPollAggregateMap(
  prisma: Pick<PrismaClient, 'pollMessage'>,
  viewerUserId: string,
  messageIds: string[],
): Promise<Map<string, PollAggregate>> {
  if (messageIds.length === 0) return new Map();

  const rows = await prisma.pollMessage.findMany({
    where: { messageId: { in: messageIds } },
    include: {
      options: { orderBy: { ordinal: 'asc' } },
      votes: { select: { pollOptionId: true, voterUserId: true } },
    },
  });

  const out = new Map<string, PollAggregate>();
  for (const pm of rows) {
    const countsByOption = new Map<string, number>();
    const optionsVotedByViewer = new Set<string>();
    const distinctVoters = new Set<string>();
    for (const v of pm.votes) {
      countsByOption.set(v.pollOptionId, (countsByOption.get(v.pollOptionId) ?? 0) + 1);
      distinctVoters.add(v.voterUserId);
      if (v.voterUserId === viewerUserId) optionsVotedByViewer.add(v.pollOptionId);
    }
    out.set(pm.messageId, {
      pollMessageId: pm.id,
      question: pm.question,
      multiSelect: pm.multiSelect,
      anonymous: pm.anonymous,
      closedAt: pm.closedAt ? pm.closedAt.toISOString() : null,
      totalVoters: distinctVoters.size,
      options: pm.options.map((o) => ({
        id: o.id,
        ordinal: o.ordinal,
        label: o.label,
        count: countsByOption.get(o.id) ?? 0,
        votedByMe: optionsVotedByViewer.has(o.id),
      })),
    });
  }
  return out;
}

/**
 * Convenience wrapper for a single message id. Returns `null` if the message
 * isn't a poll (or doesn't exist). Used by `PollsService.getAggregateFor` and
 * the `MessageDto.poll` injection on POLL message returns from create/vote.
 */
export async function loadPollAggregateFor(
  prisma: Pick<PrismaClient, 'pollMessage'>,
  viewerUserId: string,
  messageId: string,
): Promise<PollAggregate | null> {
  const map = await loadPollAggregateMap(prisma, viewerUserId, [messageId]);
  return map.get(messageId) ?? null;
}
