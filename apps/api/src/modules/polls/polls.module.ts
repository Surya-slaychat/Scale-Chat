import { Module } from '@nestjs/common';

import { MessagesModule } from '../messages/messages.module';
import { PollsCreateController, PollsMessageController } from './polls.controller';
import { PollsService } from './polls.service';

@Module({
  imports: [MessagesModule],
  controllers: [PollsCreateController, PollsMessageController],
  providers: [PollsService],
})
export class PollsModule {}
