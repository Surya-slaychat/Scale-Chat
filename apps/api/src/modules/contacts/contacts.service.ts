import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddContactBody,
  CommonGroupsListResponse,
  Contact,
  ContactsListQuery,
  ContactsListResponse,
  UpdateContactBody,
} from '@scalechat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { buildPage, decodeCursor, encodeCursor } from '../../common/pagination/cursor';

type ContactCursor = { favouriteAt: string | null; displayName: string; id: string };

function isContactCursor(raw: unknown): raw is ContactCursor {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    (r.favouriteAt === null || typeof r.favouriteAt === 'string') &&
    typeof r.displayName === 'string' &&
    typeof r.id === 'string'
  );
}

type ContactRow = {
  id: string;
  contactUserId: string | null;
  phoneE164: string;
  displayName: string;
  favouriteAt: Date | null;
  createdAt: Date;
  contactUser: { avatarUri: string | null } | null;
};

function toDto(row: ContactRow): Contact {
  return {
    id: row.id,
    contactUserId: row.contactUserId,
    phoneE164: row.phoneE164,
    displayName: row.displayName,
    favouriteAt: row.favouriteAt ? row.favouriteAt.toISOString() : null,
    avatarUri: row.contactUser?.avatarUri ?? null,
    isOnPlatform: row.contactUserId !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerUserId: string, query: ContactsListQuery): Promise<ContactsListResponse> {
    const { cursor, limit, search } = query;
    const c = decodeCursor(cursor, isContactCursor);

    // Search predicate: case-insensitive substring against displayName OR phone number.
    // Both columns are already indexed by the unique `(ownerUserId, phoneE164)` and the
    // implicit `displayName` btree on ordering — adequate for the Contact Page page sizes.
    const searchWhere = search
      ? {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { phoneE164: { contains: search } },
          ],
        }
      : {};

    // Two-tier sort: favourites first (NULLS LAST), then alphabetical by name, id as tie-breaker.
    const rows = await this.prisma.contact.findMany({
      where: { ownerUserId, ...searchWhere },
      orderBy: [{ favouriteAt: { sort: 'desc', nulls: 'last' } }, { displayName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(c
        ? {
            // Cursor pagination on a composite sort key is approximate with Prisma's keyset
            // cursor; for production we'd want a raw SQL where-clause. For the Contact Page
            // initial page sizes (≤100) Prisma's `skip:1, cursor` is sufficient and stable.
            skip: 1,
            cursor: { id: c.id },
          }
        : {}),
      include: { contactUser: { select: { avatarUri: true } } },
    });

    return buildPage(rows.map(toDto), limit, (last) =>
      encodeCursor<ContactCursor>({
        favouriteAt: last.favouriteAt,
        displayName: last.displayName,
        id: last.id,
      })
    );
  }

  async add(ownerUserId: string, body: AddContactBody): Promise<Contact> {
    // Self-add guard — saving your own phone is meaningless and breaks several invariants downstream.
    const self = await this.prisma.user.findUnique({ where: { id: ownerUserId } });
    if (self && self.phoneE164 === body.phoneE164) {
      throw new ConflictException({
        code: 'cannot_add_self',
        message: "You can't add your own phone number as a contact.",
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { phoneE164: body.phoneE164 },
      select: { id: true, avatarUri: true },
    });

    const existing = await this.prisma.contact.findUnique({
      where: { ownerUserId_phoneE164: { ownerUserId, phoneE164: body.phoneE164 } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'contact_exists',
        message: 'You already have this phone number saved.',
      });
    }

    const created = await this.prisma.contact.create({
      data: {
        ownerUserId,
        contactUserId: targetUser?.id ?? null,
        phoneE164: body.phoneE164,
        displayName: body.displayName,
      },
      include: { contactUser: { select: { avatarUri: true } } },
    });

    return toDto(created);
  }

  async update(ownerUserId: string, contactId: string, patch: UpdateContactBody): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, ownerUserId },
    });
    if (!contact) {
      throw new NotFoundException({ code: 'contact_not_found', message: 'Contact not found.' });
    }

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.favourite !== undefined
          ? { favouriteAt: patch.favourite ? new Date() : null }
          : {}),
      },
      include: { contactUser: { select: { avatarUri: true } } },
    });

    return toDto(updated);
  }

  async remove(ownerUserId: string, contactId: string): Promise<void> {
    const result = await this.prisma.contact.deleteMany({
      where: { id: contactId, ownerUserId },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: 'contact_not_found', message: 'Contact not found.' });
    }
  }

  /**
   * Group + Super Group chats both the caller and the target user are active
   * members of. Returns an empty list today — groups land in a later slice;
   * the shape exists so the Contact Profile screen can render against it now.
   */
  async listCommonGroups(
    callerUserId: string,
    contactUserId: string,
  ): Promise<CommonGroupsListResponse> {
    if (callerUserId === contactUserId) return { items: [] };
    const rows = await this.prisma.chat.findMany({
      where: {
        kind: { in: ['GROUP', 'SUPER_GROUP'] },
        AND: [
          { members: { some: { userId: callerUserId, leftAt: null } } },
          { members: { some: { userId: contactUserId, leftAt: null } } },
        ],
      },
      select: {
        id: true,
        title: true,
        avatarUri: true,
        _count: { select: { members: { where: { leftAt: null } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
    return {
      items: rows.map((r) => ({
        chatId: r.id,
        title: r.title ?? 'Group',
        avatarUri: r.avatarUri ?? null,
        memberCount: r._count.members,
      })),
    };
  }
}
