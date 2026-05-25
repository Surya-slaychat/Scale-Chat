import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdateBody, SelfUser, UserProfileCard } from '@scalechat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async getSelf(userId: string): Promise<SelfUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'user_not_found', message: 'User not found.' });
    }
    return toSelfDto(user);
  }

  /**
   * Public profile of another user — what the Contact Profile screen renders.
   *
   * Privacy: returning *any* other user's record is opt-in. The viewer must
   * either (a) share an active 1-on-1 chat with the target, OR (b) have the
   * target saved as a `Contact`. Anything else → 403. This prevents random
   * user enumeration by uuid guessing.
   *
   * `commonChatId` is filled when a 1-on-1 chat exists so the client can
   * deep-link "Open chat" from the profile.
   */
  async getProfileCard(viewerUserId: string, targetUserId: string): Promise<UserProfileCard> {
    if (viewerUserId === targetUserId) {
      // Self-views go through GET /me — but if the client lands here we still
      // return a valid card. It's the same row; just no privacy gate.
      const self = await this.prisma.user.findUnique({ where: { id: viewerUserId } });
      if (!self) {
        throw new NotFoundException({ code: 'user_not_found', message: 'User not found.' });
      }
      return toProfileCard(self, null, false);
    }

    const [target, sharedChat, contactRow, isBlocked] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetUserId } }),
      // 1-on-1 chat where both are active members.
      this.prisma.chat.findFirst({
        where: {
          kind: 'ONE_ON_ONE',
          members: { every: { leftAt: null }, some: { userId: viewerUserId } },
          AND: { members: { some: { userId: targetUserId, leftAt: null } } },
        },
        select: { id: true },
      }),
      this.prisma.contact.findFirst({
        where: { ownerUserId: viewerUserId, contactUserId: targetUserId },
        select: { id: true },
      }),
      this.blocks.isBlocked(viewerUserId, targetUserId),
    ]);

    if (!target) {
      throw new NotFoundException({ code: 'user_not_found', message: 'User not found.' });
    }
    if (!sharedChat && !contactRow) {
      // Don't leak that the user exists. 403 is the privacy boundary.
      throw new ForbiddenException({
        code: 'profile_not_visible',
        message: 'You can only view profiles of people you share a chat with or have saved as a contact.',
      });
    }

    return toProfileCard(target, sharedChat?.id ?? null, isBlocked);
  }

  async updateProfile(userId: string, patch: ProfileUpdateBody): Promise<SelfUser> {
    // `undefined` skips the field; `null` clears it. The zod schema enforces shape.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: patch.fullName,
        ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        ...(patch.avatarUri !== undefined ? { avatarUri: patch.avatarUri } : {}),
      },
    });

    await this.prisma.securityEvent.create({
      data: {
        kind: 'PROFILE_UPDATED',
        userId,
        metadata: { fields: Object.keys(patch) },
      },
    });

    return toSelfDto(updated);
  }
}

// Pulled out so the controller never invents the shape of `SelfUser`.
function toSelfDto(row: {
  id: string;
  phoneE164: string;
  fullName: string;
  bio: string | null;
  avatarUri: string | null;
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SelfUser {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    fullName: row.fullName,
    bio: row.bio,
    avatarUri: row.avatarUri,
    isPremium: row.isPremium,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProfileCard(
  row: {
    id: string;
    phoneE164: string;
    fullName: string;
    bio: string | null;
    avatarUri: string | null;
    isPremium: boolean;
    createdAt: Date;
  },
  commonChatId: string | null,
  isBlocked: boolean,
): UserProfileCard {
  return {
    id: row.id,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
    avatarUri: row.avatarUri,
    bio: row.bio,
    isPremium: row.isPremium,
    createdAt: row.createdAt.toISOString(),
    commonChatId,
    isBlocked,
  };
}
