import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import {
  ProfileUpdateSchema,
  type ProfileUpdateBody,
  type SelfUser,
  type UserProfileCard,
} from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

/**
 * Self-view profile endpoints. Both are JWT-guarded — there is no path to read
 * /me without a verified access token.
 */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AccessTokenPayload): Promise<SelfUser> {
    return this.users.getSelf(user.sub);
  }

  @Patch()
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(ProfileUpdateSchema)) body: ProfileUpdateBody,
  ): Promise<SelfUser> {
    return this.users.updateProfile(user.sub, body);
  }
}

/**
 * Other-user reads. Mounted at `/users` so `/me` can keep its self-view
 * idiom. Privacy: every endpoint here verifies viewer↔target visibility
 * inside the service (shared chat OR contact entry), 403 otherwise.
 */
@UseGuards(JwtAuthGuard)
@Controller('users')
export class OtherUsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id/profile-card')
  profileCard(
    @CurrentUser() viewer: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
  ): Promise<UserProfileCard> {
    return this.users.getProfileCard(viewer.sub, targetUserId);
  }
}
