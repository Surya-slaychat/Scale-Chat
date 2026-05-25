import { Module } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';
import { OtherUsersController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [BlocksModule],
  controllers: [UsersController, OtherUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
