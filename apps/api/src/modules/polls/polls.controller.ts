import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  PollCreateRequestSchema,
  PollVoteRequestSchema,
  type MessageDto,
  type PollAggregate,
  type PollCreateRequestBody,
  type PollVoteRequestBody,
} from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MessagesGateway } from '../messages/messages.gateway';
import { PollsService } from './polls.service';

/**
 * Polls REST surface (Tranche 2.F — 1-on-1 scope).
 *
 * Routes:
 *   - POST   /chats/:chatId/polls                  create a POLL message + options
 *   - POST   /messages/:messageId/vote             cast / change a vote
 *   - GET    /messages/:messageId/poll             fetch the live aggregate
 *   - POST   /messages/:messageId/poll/close       close the poll (sender-only)
 *
 * Broadcast: every mutating endpoint emits `poll:voted` per-viewer (the
 * gateway iterates the chat members so each receives their own `votedByMe`
 * flags). Create additionally emits `message:new` so non-poll clients still
 * see the bubble appear.
 *
 * The shared route prefix changes across endpoints (chats vs messages), so
 * each handler declares its own `@Controller(<path>)` — same shape Reactions
 * + Forward use.
 */

@UseGuards(JwtAuthGuard)
@Controller('chats/:chatId/polls')
export class PollsCreateController {
  constructor(
    private readonly polls: PollsService,
    private readonly gateway: MessagesGateway,
  ) {}

  /** POST /chats/:chatId/polls → MessageDto (POLL kind, `.poll` populated). */
  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('chatId', new ParseUUIDPipe({ version: '4' })) chatId: string,
    @Body(new ZodValidationPipe(PollCreateRequestSchema)) body: PollCreateRequestBody,
  ): Promise<MessageDto> {
    const { message, broadcastTargets } = await this.polls.createPoll(user.sub, chatId, body);
    // Fan out the new message as a normal `message:new` (non-poll-aware
    // clients still need this to render the bubble), then send personalised
    // `poll:voted` so each member's votedByMe is correct from the start.
    this.gateway.emitMessageNew(message);
    if (broadcastTargets.size > 0) {
      this.gateway.emitPollVoted(message.chatId, message.id, broadcastTargets);
    }
    return message;
  }
}

@UseGuards(JwtAuthGuard)
@Controller('messages/:messageId')
export class PollsMessageController {
  constructor(
    private readonly polls: PollsService,
    private readonly gateway: MessagesGateway,
  ) {}

  /** GET /messages/:messageId/poll → personalised PollAggregate. */
  @Get('poll')
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ): Promise<PollAggregate> {
    return this.polls.getAggregateFor(user.sub, messageId);
  }

  /** POST /messages/:messageId/vote → personalised PollAggregate for the voter. */
  @Post('vote')
  @HttpCode(200)
  async vote(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body(new ZodValidationPipe(PollVoteRequestSchema)) body: PollVoteRequestBody,
  ): Promise<PollAggregate> {
    const { chatId, aggregate, broadcastTargets } = await this.polls.vote(
      user.sub,
      messageId,
      body.optionIds,
    );
    this.gateway.emitPollVoted(chatId, messageId, broadcastTargets);
    return aggregate;
  }

  /** POST /messages/:messageId/poll/close → personalised PollAggregate (sender-only). */
  @Post('poll/close')
  @HttpCode(200)
  async close(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ): Promise<PollAggregate> {
    const { chatId, aggregate, broadcastTargets } = await this.polls.close(user.sub, messageId);
    this.gateway.emitPollVoted(chatId, messageId, broadcastTargets);
    return aggregate;
  }
}
