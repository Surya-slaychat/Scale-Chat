import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ReactionAggregate } from '@scalechat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Emoji reactions on messages (Phase 2.1).
 *
 * Behaviour:
 *   - `(messageId, userId, emoji)` is unique. A second add with the same
 *     triple is a no-op (treated as idempotent — we swallow the Prisma P2002).
 *   - A user can hold MULTIPLE distinct emojis on one message.
 *   - Reads aggregate per emoji: `{ emoji, count, reactedByMe }[]`.
 *   - All write paths verify the caller is a member of the chat the message
 *     belongs to; non-members get 403 `not_a_member`.
 *
 * Privacy: reactions are visible to every chat member, including the
 * counterpart. There's no anonymous-reaction mode in v1 (matches WhatsApp).
 */
@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find the chat the message belongs to + assert caller is a member.
   * Returns the message's chatId, used by the controller to broadcast the
   * `reaction:updated` event to the right room.
   */
  async assertCanReact(userId: string, messageId: string): Promise<{ chatId: string }> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, deletedAt: true },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'message_not_found',
        message: 'Message not found.',
      });
    }
    if (message.deletedAt !== null) {
      throw new ForbiddenException({
        code: 'message_deleted',
        message: 'Cannot react to a deleted message.',
      });
    }
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
      select: { id: true, leftAt: true },
    });
    if (!member || member.leftAt !== null) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'You are not a member of this chat.',
      });
    }
    return { chatId: message.chatId };
  }

  async add(userId: string, messageId: string, emoji: string): Promise<void> {
    try {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    } catch (err) {
      // Idempotent on (messageId, userId, emoji) — a duplicate add is a
      // no-op, not an error. Matches the optimistic-tap UX where the user
      // may double-tap while the network is in flight.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      throw err;
    }
  }

  async remove(userId: string, messageId: string, emoji: string): Promise<void> {
    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });
  }

  /**
   * Aggregate the reactions on a message for a specific viewer. Returns one
   * entry per distinct emoji with the count and whether the viewer is among
   * the reactors.
   */
  async aggregateForMessage(messageId: string, viewerUserId: string): Promise<ReactionAggregate[]> {
    const rows = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });
    const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of rows) {
      const e = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
      e.count += 1;
      if (r.userId === viewerUserId) e.reactedByMe = true;
      byEmoji.set(r.emoji, e);
    }
    // Stable order: most-reacted first, then alphabetical so UI rendering is
    // deterministic across reloads.
    return Array.from(byEmoji.entries())
      .map(([emoji, v]) => ({ emoji, count: v.count, reactedByMe: v.reactedByMe }))
      .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  }
}
