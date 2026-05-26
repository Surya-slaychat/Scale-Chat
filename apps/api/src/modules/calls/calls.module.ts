import { Module } from '@nestjs/common';

import { BullMQModule } from '../../common/queues/bullmq.module';
import { BlocksModule } from '../blocks/blocks.module';
import { MessagesModule } from '../messages/messages.module';
import {
  CallsController,
  CallsHistoryController,
  CallsWebhookController,
} from './calls.controller';
import { CallsRingTimeoutProcessor } from './calls-ring-timeout.processor';
import { CallsService } from './calls.service';
import { HmsClient } from './hms.client';

@Module({
  imports: [MessagesModule, BlocksModule, BullMQModule],
  controllers: [CallsController, CallsWebhookController, CallsHistoryController],
  providers: [CallsService, HmsClient, CallsRingTimeoutProcessor],
  exports: [CallsService],
})
export class CallsModule {}
