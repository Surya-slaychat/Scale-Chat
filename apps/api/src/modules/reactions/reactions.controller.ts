import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AddReactionSchema,
  ReactionEmojiSchema,
  type AddReactionBody,
  type ReactionsList,
} from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MessagesGateway } from '../messages/messages.gateway';
import { ReactionsService } from './reactions.service';

@UseGuards(JwtAuthGuard)
@Controller('messages/:messageId/reactions')
export class ReactionsController {
  constructor(
    private readonly reactions: ReactionsService,
    private readonly gateway: MessagesGateway,
  ) {}

  /**
   * POST /messages/:messageId/reactions
   * Body: { emoji: string }
   *
   * Idempotent on `(messageId, userId, emoji)` — a duplicate add returns the
   * current aggregate without erroring.
   */
  @Post()
  async add(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body(new ZodValidationPipe(AddReactionSchema)) body: AddReactionBody,
  ): Promise<ReactionsList> {
    const { chatId } = await this.reactions.assertCanReact(user.sub, messageId);
    await this.reactions.add(user.sub, messageId, body.emoji);
    const list = await this.reactions.aggregateForMessage(messageId, user.sub);
    this.gateway.emitReactionUpdated({ chatId, messageId, reactions: list });
    return { messageId, reactions: list };
  }

  /**
   * DELETE /messages/:messageId/reactions/:emoji
   *
   * Idempotent: removing a non-existent reaction returns the current aggregate.
   * The `emoji` path param is validated via the shared zod schema so a request
   * with a 200-byte string never hits the database.
   */
  @Delete(':emoji')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Param('emoji') emojiRaw: string,
  ): Promise<ReactionsList> {
    const emoji = ReactionEmojiSchema.parse(decodeURIComponent(emojiRaw));
    const { chatId } = await this.reactions.assertCanReact(user.sub, messageId);
    await this.reactions.remove(user.sub, messageId, emoji);
    const list = await this.reactions.aggregateForMessage(messageId, user.sub);
    this.gateway.emitReactionUpdated({ chatId, messageId, reactions: list });
    return { messageId, reactions: list };
  }
}
