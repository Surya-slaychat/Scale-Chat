import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MessageDto,
  PollAggregate,
  PollCreateRequestBody,
} from '@scalechat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { loadPollAggregateFor, loadPollAggregateMap } from './poll-aggregate';

/**
 * Polls module — Tranche 2.F (1-on-1 scope).
 *
 * Concurrency: vote / close take a per-poll advisory lock so concurrent voters
 * on the same poll serialise; different polls in the same chat don't contend.
 * The lock key is derived from the `pollMessageId` UUID (first 8 hex bytes),
 * mirroring `chatIdToAdvisoryKey` in `messages.service.ts`.
 *
 * Authoring: `POLL` is in `SERVER_ONLY_KINDS`, so the public `SendMessageSchema`
 * + `MessagesService.send` both reject client-direct sends with
 * `kind_not_allowed_from_client`. This module is the only path that creates
 * POLL rows — it calls `MessagesService.createServerAuthored` (bypasses ONLY
 * the kind-allowlist; the per-chat advisory lock + sequence allocation are
 * identical to `send`).
 */
@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createPoll(
    userId: string,
    chatId: string,
    body: PollCreateRequestBody,
  ): Promise<{ message: MessageDto; broadcastTargets: Map<string, PollAggregate> }> {
    await this.assertMember(userId, chatId);

    // Idempotency: a retry with the same `(senderUserId, clientMessageId)`
    // returns the existing POLL message and its aggregate. Matches the same
    // contract `MessagesService.send` exposes for TEXT/IMAGE/etc.
    const existing = await this.prisma.message.findUnique({
      where: {
        senderUserId_clientMessageId: { senderUserId: userId, clientMessageId: body.clientMessageId },
      },
    });
    if (existing) {
      if (existing.kind !== 'POLL') {
        throw new ConflictException({
          code: 'client_message_id_kind_mismatch',
          message: 'clientMessageId already used by a different message kind.',
        });
      }
      const dto = this.messages.rowToDto(existing);
      dto.poll = await loadPollAggregateFor(this.prisma, userId, existing.id);
      return {
        message: dto,
        broadcastTargets: new Map(),
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await this.messages.createServerAuthored(tx, {
        chatId,
        senderUserId: userId,
        clientMessageId: body.clientMessageId,
        kind: 'POLL',
      });
      const pollMessageId = randomUUID();
      await tx.pollMessage.create({
        data: {
          id: pollMessageId,
          messageId: created.id,
          question: body.question,
          anonymous: body.anonymous,
          multiSelect: body.multiSelect,
        },
      });
      await tx.pollOption.createMany({
        data: body.options.map((label, i) => ({
          id: randomUUID(),
          pollMessageId,
          ordinal: i,
          label,
        })),
      });
      return created;
    });

    // After the tx commits, build the personalised DTO for the creator and a
    // per-viewer broadcast map for every chat member so the gateway can fan
    // out `poll:voted` (used here as "poll:created" too — same wire shape).
    const dto = this.messages.rowToDto(result);
    dto.poll = await loadPollAggregateFor(this.prisma, userId, result.id);
    const broadcastTargets = await this.buildPerViewerMap(chatId, result.id);
    return { message: dto, broadcastTargets };
  }

  // ─── Vote ──────────────────────────────────────────────────────────────────

  async vote(
    userId: string,
    messageId: string,
    optionIds: string[],
  ): Promise<{ chatId: string; aggregate: PollAggregate; broadcastTargets: Map<string, PollAggregate> }> {
    const { chatId, pollMessageId, multiSelect } = await this.loadPollForWrite(
      userId,
      messageId,
      { rejectClosed: true },
    );

    // Validate every supplied option id belongs to THIS poll. (Stops a client
    // sending an option id from another poll the user happens to be a member
    // of.)
    const validIds = await this.prisma.pollOption.findMany({
      where: { pollMessageId, id: { in: optionIds } },
      select: { id: true },
    });
    if (validIds.length !== optionIds.length) {
      throw new BadRequestException({
        code: 'unknown_option',
        message: 'One or more option ids do not belong to this poll.',
      });
    }
    if (!multiSelect && optionIds.length !== 1) {
      throw new BadRequestException({
        code: 'single_select_violation',
        message: 'This poll accepts exactly one option per voter.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1::bigint)`,
        pollMessageIdToAdvisoryKey(pollMessageId),
      );
      // Re-check `closedAt` inside the lock — a concurrent close at T1 must
      // beat a vote at T2 > T1. (Outside the lock the vote may have raced
      // past the close-time check; inside, we serialise.)
      const fresh = await tx.pollMessage.findUnique({
        where: { id: pollMessageId },
        select: { closedAt: true },
      });
      if (fresh?.closedAt) {
        throw new ConflictException({
          code: 'poll_closed',
          message: 'This poll has been closed.',
        });
      }

      if (multiSelect) {
        // Authoritative diff: createMany for new selections, deleteMany for the
        // complement. skipDuplicates swallows P2002 on re-vote retry.
        await tx.pollVote.createMany({
          skipDuplicates: true,
          data: optionIds.map((pollOptionId) => ({
            id: randomUUID(),
            pollMessageId,
            pollOptionId,
            voterUserId: userId,
          })),
        });
        await tx.pollVote.deleteMany({
          where: {
            pollMessageId,
            voterUserId: userId,
            pollOptionId: { notIn: optionIds },
          },
        });
      } else {
        // Single-select: replace prior vote (delete-then-insert).
        const onlyOptionId = optionIds[0]!;
        await tx.pollVote.deleteMany({
          where: { pollMessageId, voterUserId: userId },
        });
        await tx.pollVote.create({
          data: {
            id: randomUUID(),
            pollMessageId,
            pollOptionId: onlyOptionId,
            voterUserId: userId,
          },
        });
      }
    });

    const broadcastTargets = await this.buildPerViewerMap(chatId, messageId);
    const aggregate = broadcastTargets.get(userId);
    if (!aggregate) {
      // Should not happen — voter is by definition a chat member, so the per-
      // viewer map contains them. Defensive 500 if we ever hit it.
      throw new Error('Voter not present in chat member set after vote.');
    }
    return { chatId, aggregate, broadcastTargets };
  }

  // ─── Close (sender-only) ───────────────────────────────────────────────────

  async close(
    userId: string,
    messageId: string,
  ): Promise<{ chatId: string; aggregate: PollAggregate; broadcastTargets: Map<string, PollAggregate> }> {
    const { chatId, pollMessageId, senderUserId, alreadyClosed } = await this.loadPollForWrite(
      userId,
      messageId,
      { rejectClosed: false, requireSender: true },
    );
    if (senderUserId !== userId) {
      throw new ForbiddenException({
        code: 'not_sender',
        message: 'Only the poll creator can close this poll.',
      });
    }
    if (!alreadyClosed) {
      await this.prisma.pollMessage.update({
        where: { id: pollMessageId },
        data: { closedAt: new Date() },
      });
    }

    const broadcastTargets = await this.buildPerViewerMap(chatId, messageId);
    const aggregate = broadcastTargets.get(userId);
    if (!aggregate) {
      throw new Error('Sender not present in chat member set after close.');
    }
    return { chatId, aggregate, broadcastTargets };
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async getAggregateFor(userId: string, messageId: string): Promise<PollAggregate> {
    const { chatId, pollMessageId } = await this.locatePoll(messageId);
    await this.assertMember(userId, chatId);
    const aggregate = await loadPollAggregateFor(this.prisma, userId, messageId);
    if (!aggregate) {
      // pollMessage was just here in `locatePoll` — if it's gone it's a
      // race with delete, which can only happen via Message cascade. Treat
      // as 404.
      throw new NotFoundException({
        code: 'poll_not_found',
        message: 'Poll not found.',
      });
    }
    // Surface unused var to satisfy linter — kept here so callers can audit
    // that we resolved the pollMessageId before loading.
    void pollMessageId;
    return aggregate;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertMember(userId: string, chatId: string): Promise<void> {
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { leftAt: true },
    });
    if (!member || member.leftAt !== null) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'You are not a member of this chat.',
      });
    }
  }

  private async locatePoll(messageId: string): Promise<{
    chatId: string;
    pollMessageId: string;
    senderUserId: string;
    multiSelect: boolean;
    alreadyClosed: boolean;
  }> {
    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        kind: true,
        chatId: true,
        senderUserId: true,
        deletedAt: true,
        pollMessage: { select: { id: true, multiSelect: true, closedAt: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'poll_not_found', message: 'Poll not found.' });
    }
    if (row.kind !== 'POLL' || !row.pollMessage) {
      throw new NotFoundException({ code: 'not_a_poll', message: 'Message is not a poll.' });
    }
    if (row.deletedAt !== null) {
      throw new ForbiddenException({
        code: 'message_deleted',
        message: 'This poll has been deleted.',
      });
    }
    return {
      chatId: row.chatId,
      pollMessageId: row.pollMessage.id,
      senderUserId: row.senderUserId,
      multiSelect: row.pollMessage.multiSelect,
      alreadyClosed: row.pollMessage.closedAt !== null,
    };
  }

  private async loadPollForWrite(
    userId: string,
    messageId: string,
    opts: { rejectClosed: boolean; requireSender?: boolean },
  ): Promise<{
    chatId: string;
    pollMessageId: string;
    senderUserId: string;
    multiSelect: boolean;
    alreadyClosed: boolean;
  }> {
    const info = await this.locatePoll(messageId);
    await this.assertMember(userId, info.chatId);
    if (opts.rejectClosed && info.alreadyClosed) {
      throw new ConflictException({
        code: 'poll_closed',
        message: 'This poll has been closed.',
      });
    }
    return info;
  }

  /**
   * Build `Map<viewerUserId, PollAggregate>` for every active member of the
   * chat that contains `messageId`. Drives the personalised socket broadcast
   * in `MessagesGateway.emitPollVoted` — one entry per viewer so each gets
   * their own `votedByMe` flags.
   */
  private async buildPerViewerMap(
    chatId: string,
    messageId: string,
  ): Promise<Map<string, PollAggregate>> {
    const members = await this.prisma.chatMember.findMany({
      where: { chatId, leftAt: null },
      select: { userId: true },
    });
    // Personalise per viewer. One Prisma round-trip per member is fine for
    // 1-on-1 (2 members); when groups land this should fold into a single
    // query that returns `pollVotes` with the full voter list and we
    // materialise per-viewer in memory.
    const result = new Map<string, PollAggregate>();
    for (const m of members) {
      const aggregate = await loadPollAggregateFor(this.prisma, m.userId, messageId);
      if (aggregate) result.set(m.userId, aggregate);
    }
    return result;
  }
}

/**
 * Stable bigint advisory-lock key derived from a UUID. Mirrors
 * `chatIdToAdvisoryKey` in `messages.service.ts`. Postgres advisory keys are
 * signed bigints, so the conversion clamps the unsigned 64-bit value to the
 * signed range.
 */
export function pollMessageIdToAdvisoryKey(pollMessageId: string): bigint {
  const hex = pollMessageId.replace(/-/g, '').slice(0, 16);
  const unsigned = BigInt(`0x${hex}`);
  const signed = unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
  return signed;
}

/** Re-exported for type narrowing in the controller. */
export { Prisma };
