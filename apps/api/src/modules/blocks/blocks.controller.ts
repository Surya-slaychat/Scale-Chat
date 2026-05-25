import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { BlockStatusResponse } from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { BlocksService } from './blocks.service';

/**
 * Per-user block list. Mounted at `/users/:id/block` so the URL reads as
 * "block this user". Both verbs idempotent: re-blocking returns 200 without
 * a second row.
 */
@UseGuards(JwtAuthGuard)
@Controller('users/:id/block')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Post()
  async block(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
  ): Promise<BlockStatusResponse> {
    await this.blocks.block(user.sub, targetUserId);
    return { blockedUserId: targetUserId, isBlocked: true };
  }

  @Delete()
  @HttpCode(200)
  async unblock(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
  ): Promise<BlockStatusResponse> {
    await this.blocks.unblock(user.sub, targetUserId);
    return { blockedUserId: targetUserId, isBlocked: false };
  }
}
