import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AddContactSchema,
  ContactsListQuerySchema,
  UpdateContactSchema,
  type AddContactBody,
  type CommonGroupsListResponse,
  type Contact,
  type ContactsListQuery,
  type ContactsListResponse,
  type UpdateContactBody,
} from '@scalechat/shared';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../../common/auth/jwt.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContactsService } from './contacts.service';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(ContactsListQuerySchema)) query: ContactsListQuery
  ): Promise<ContactsListResponse> {
    return this.contacts.list(user.sub, query);
  }

  @Post()
  add(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(AddContactSchema)) body: AddContactBody
  ): Promise<Contact> {
    return this.contacts.add(user.sub, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) body: UpdateContactBody
  ): Promise<Contact> {
    return this.contacts.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ): Promise<void> {
    await this.contacts.remove(user.sub, id);
  }

  /**
   * `GET /contacts/:contactUserId/common-groups`
   *
   * Group chats both the caller and the target user are active members of.
   * Returns `{ items: [] }` until group / super-group chats ship — the shape
   * is stable so the Contact Profile screen can render against it today.
   */
  @Get(':contactUserId/common-groups')
  commonGroups(
    @CurrentUser() user: AccessTokenPayload,
    @Param('contactUserId', new ParseUUIDPipe({ version: '4' })) contactUserId: string,
  ): Promise<CommonGroupsListResponse> {
    return this.contacts.listCommonGroups(user.sub, contactUserId);
  }
}
