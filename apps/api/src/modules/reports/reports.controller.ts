import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateMessageReportSchema,
  type CreateMessageReportBody,
  type MessageReportAck,
} from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * POST /messages/:messageId/report
   *
   * The reporter is the JWT subject; the reported message id is in the path.
   * The chat id is derived server-side (we look it up from the message row
   * to verify the reporter is a member of that chat). Clients don't need to
   * send chatId on the wire.
   */
  @Post(':messageId/report')
  report(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body(new ZodValidationPipe(CreateMessageReportSchema)) body: CreateMessageReportBody,
  ): Promise<MessageReportAck> {
    return this.reports.createReport(user.sub, messageId, body);
  }
}
