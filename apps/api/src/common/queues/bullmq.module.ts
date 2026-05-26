import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type RedisOptions } from 'bullmq';
import { type Redis } from 'ioredis';

import type { Env } from '../../config/env';
import { REDIS_CLIENT } from '../redis/redis.module';

export const CALL_RING_QUEUE = Symbol('CALL_RING_QUEUE');
export const CALL_RING_QUEUE_NAME = 'call-ring-timeout';

/**
 * BullMQ module — global, exports the `call-ring-timeout` queue used by the
 * calls module (Tranche 2.H) to schedule the 30s ring-timeout job.
 *
 * Why BullMQ + Upstash Redis (not `setTimeout` or `@nestjs/schedule`):
 *   - An in-process timer is lost when the API restarts (Fly blue-green
 *     deploy mid-ring would orphan the call in RINGING state forever).
 *   - `@nestjs/schedule` is cron-based, not suited for one-shot delayed jobs
 *     scheduled per-call with cancellation.
 *   - BullMQ delayed jobs persist in Redis with `delay` + `jobId` semantics.
 *     `jobId: callId` means accept/decline can cancel the timeout by id.
 *     Survives any API restart.
 *
 * The Worker that processes ring-timeout jobs is wired in `CallsModule`
 * (`CallsRingTimeoutProcessor`) so this module stays domain-agnostic.
 *
 * Connection: reuses the existing `REDIS_CLIENT` ioredis instance which is
 * already configured with `maxRetriesPerRequest: null` (BullMQ's hard
 * requirement for the blocking poll connection).
 */
@Global()
@Module({
  providers: [
    {
      provide: CALL_RING_QUEUE,
      inject: [REDIS_CLIENT, ConfigService],
      useFactory: (redis: Redis, _config: ConfigService<Env, true>): Queue => {
        return new Queue(CALL_RING_QUEUE_NAME, {
          connection: redis,
          defaultJobOptions: {
            // Remove successful + failed jobs so Redis doesn't grow unbounded.
            // Failed jobs are kept briefly for debugging.
            removeOnComplete: { age: 60 },
            removeOnFail: { age: 3_600 },
            // No retries — the timeout firing is the failure mode; reattempting
            // would double-MISS the call.
            attempts: 1,
          },
        });
      },
    },
  ],
  exports: [CALL_RING_QUEUE],
})
export class BullMQModule implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BullMQModule.name);

  constructor(@Inject(CALL_RING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    this.log.log(`BullMQ queue ready: ${CALL_RING_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    // Gracefully close the queue (not the underlying ioredis — that's owned
    // by RedisModule).
    await this.queue.close();
  }
}

/**
 * Type-narrowed payload for a `call-ring-timeout` job. `jobId` is the
 * callId (so cancellation by accept/decline is a single `queue.remove(callId)`
 * call).
 */
export type CallRingTimeoutJobData = {
  callId: string;
};

/** Re-exported for callers; alias for `RedisOptions` lest a future migration
 *  to a different connection style needs to change in one place. */
export type BullMQRedisOptions = RedisOptions;
