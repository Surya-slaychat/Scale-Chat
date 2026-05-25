import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Per-user block list — one row per (blocker → blocked) direction.
 *
 * Symmetric enforcement: a message is dropped if EITHER direction has a row
 * (so a blocker can't be DM'd by the blocked user, and a blocked user can't
 * silently be DM'd-back by their blocker either). Existing messages stay in
 * each user's history — matches WhatsApp's "no retroactive purge".
 */
@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerUserId: string, blockedUserId: string): Promise<void> {
    if (blockerUserId === blockedUserId) {
      throw new BadRequestException({
        code: 'cannot_block_self',
        message: 'You cannot block yourself.',
      });
    }
    // Idempotent — re-blocking is a no-op, not an error.
    try {
      await this.prisma.blockedUser.create({
        data: { blockerUserId, blockedUserId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return; // already blocked
      }
      throw err;
    }
  }

  async unblock(blockerUserId: string, blockedUserId: string): Promise<void> {
    // deleteMany with composite key — returns 0 rows when not blocked, which
    // is the idempotent shape we want.
    await this.prisma.blockedUser.deleteMany({
      where: { blockerUserId, blockedUserId },
    });
  }

  /** True if the caller has blocked the target. Cheap point-lookup on PK. */
  async isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const row = await this.prisma.blockedUser.findUnique({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
      select: { blockerUserId: true },
    });
    return row !== null;
  }

  /**
   * True if EITHER direction has a block. Used by `MessagesService.send` to
   * reject inbound messages on blocked relationships.
   */
  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const row = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerUserId: userA, blockedUserId: userB },
          { blockerUserId: userB, blockedUserId: userA },
        ],
      },
      select: { blockerUserId: true },
    });
    return row !== null;
  }
}
