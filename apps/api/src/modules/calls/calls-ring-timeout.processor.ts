import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { type Redis } from 'ioredis';

import {
  CALL_RING_QUEUE_NAME,
  type CallRingTimeoutJobData,
} from '../../common/queues/bullmq.module';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { CallsService } from './calls.service';

/**
 * BullMQ Worker that processes `call-ring-timeout` jobs.
 *
 * Fires 30s after the calls service schedules a ring-timeout (via
 * `CallsService.mintToken`). On fire: delegates to
 * `CallsService.onRingTimeout(callId)` which is idempotent vs. accept/
 * decline races (it checks the lock + status atomically before mutating).
 *
 * **Test ergonomics:** the e2e suite bypasses this Worker entirely and
 * calls `callsService.onRingTimeout(callId)` directly (plan §11 Q1c) —
 * waiting 30s for a real BullMQ delayed job to fire would multiply the
 * suite runtime. The Worker is exercised only by manual smoke + a future
 * dedicated integration test gated on a live Redis.
 */
@Injectable()
export class CallsRingTimeoutProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CallsRingTimeoutProcessor.name);
  private worker: Worker<CallRingTimeoutJobData> | null = null;

  constructor(
    private readonly calls: CallsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<CallRingTimeoutJobData>(
      CALL_RING_QUEUE_NAME,
      async (job: Job<CallRingTimeoutJobData>) => {
        const { callId } = job.data;
        this.log.log({ callId }, 'ring-timeout fired');
        await this.calls.onRingTimeout(callId);
      },
      { connection: this.redis },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error({ jobId: job?.id, err }, 'ring-timeout job failed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close();
  }
}
