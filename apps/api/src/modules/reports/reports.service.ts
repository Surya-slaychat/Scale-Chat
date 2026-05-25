import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateMessageReportBody, MessageReportAck } from '@scalechat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Per-message moderation reports.
 *
 * Privacy invariant: a report row is server-side only. We never broadcast it
 * back to chat sockets, never return it to a non-admin DTO, and never
 * surface the reporter's identity to the reported user. The acknowledgement
 * to the reporter carries only the report id + an OPEN status.
 *
 * Re-reporting the same message with the SAME reason is rejected via the
 * unique constraint `(messageId, reporterUserId, reason)` so accidental
 * double-taps don't spam moderation. Reporting with a *different* reason is
 * allowed (a user might first hit "Spam" and later realise it's also
 * "Harassment").
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(
    reporterUserId: string,
    messageId: string,
    body: CreateMessageReportBody,
  ): Promise<MessageReportAck> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, senderUserId: true, deletedAt: true },
    });
    if (!message) {
      throw new NotFoundException({ code: 'message_not_found', message: 'Message not found.' });
    }

    // Membership in the chat is the gate. Without it a stranger with a
    // leaked message id could report any message.
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId: reporterUserId } },
      select: { id: true, leftAt: true },
    });
    if (!member || member.leftAt !== null) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'You are not a member of this chat.',
      });
    }

    if (message.senderUserId === reporterUserId) {
      throw new BadRequestException({
        code: 'cannot_report_self',
        message: 'You cannot report your own message.',
      });
    }

    // Reporting a tombstone is allowed (the reason for the report may itself
    // be relevant to moderation), but most clients hide Report on tombstones
    // anyway. No special handling here.

    try {
      const row = await this.prisma.messageReport.create({
        data: {
          messageId,
          reporterUserId,
          reason: body.reason,
          note: body.note ?? null,
        },
        select: { id: true, status: true },
      });
      return { id: row.id, status: 'OPEN' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Unique violation on (messageId, reporterUserId, reason).
        throw new ConflictException({
          code: 'already_reported',
          message: 'You have already reported this message for that reason.',
        });
      }
      throw err;
    }
  }
}
