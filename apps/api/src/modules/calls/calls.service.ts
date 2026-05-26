import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallStatus, Prisma } from '@prisma/client';
import type {
  CallEndReason,
  CallKind,
  CallListResponse,
  CallSummary,
  CallTokenResponse,
  SocketCallRing,
} from '@scalechat/shared';
import type { Queue } from 'bullmq';

import { CALL_RING_QUEUE, type CallRingTimeoutJobData } from '../../common/queues/bullmq.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Env } from '../../config/env';
import { BlocksService } from '../blocks/blocks.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { MessagesService } from '../messages/messages.service';
import { HmsClient } from './hms.client';

/**
 * Calls signalling service — Tranche 2.H (1-on-1 scope).
 *
 * Lifecycle (RINGING → ACCEPTED → COMPLETED is the happy path):
 *
 *   POST /calls/token        → CallSession { status: RINGING }
 *                              + emit call:ring on `user:{callee}` room
 *                              + schedule BullMQ ring-timeout (30s)
 *
 *   POST /calls/:id/accept   → CallSession { status: ACCEPTED, startedAt }
 *                              + cancel BullMQ
 *                              + emit call:accepted to both peers
 *                              + emit call:taken on callee's other devices
 *
 *   POST /calls/:id/decline  → CallSession { status: DECLINED, endedAt }
 *                              + cancel BullMQ
 *                              + insert CALL_EVENT ("Declined voice call")
 *                              + emit call:ended { reason: 'declined' }
 *
 *   POST /calls/:id/hangup   → CallSession { status: COMPLETED, endedAt, durationSec }
 *                              + insert CALL_EVENT ("Voice call · 4m 12s")
 *                              + hmsClient.disableRoom
 *                              + emit call:ended { reason: 'hangup', durationSec }
 *
 *   BullMQ timeout fires     → onRingTimeout: if still RINGING → MISSED
 *                              + insert CALL_EVENT ("Missed voice call")
 *                              + emit call:ended { reason: 'missed' }
 *
 * Concurrency: every state-mutating path takes `pg_advisory_xact_lock` keyed
 * on `callIdToAdvisoryKey(callId)` so two devices can't both win first-
 * accept-wins. The key family is disjoint from `chatIdToAdvisoryKey` (which
 * messages.service uses) because both derive from UUIDs in different
 * domains — collision is astronomically unlikely.
 *
 * `pushService.notify` (offline push fan-out for `call:ring`) is intentionally
 * NOT wired here in PR-1 — it lands with the `PushModule` in Tranche 2.I.
 * When 2.I lands, this service should take `@Optional() @Inject(PushService)`
 * and guard `this.pushService?.notify(...)`.
 */
@Injectable()
export class CallsService {
  private readonly log = new Logger(CallsService.name);
  private readonly ringTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly blocks: BlocksService,
    private readonly gateway: MessagesGateway,
    private readonly hms: HmsClient,
    private readonly config: ConfigService<Env, true>,
    @Inject(CALL_RING_QUEUE) private readonly ringQueue: Queue,
  ) {
    this.ringTimeoutMs = this.config.get('BULLMQ_RING_TIMEOUT_MS', { infer: true }) ?? 30_000;
  }

  // ─── Token mint (initiator) ────────────────────────────────────────────────

  async mintToken(
    initiatorUserId: string,
    chatId: string,
    kind: CallKind,
  ): Promise<CallTokenResponse> {
    // 503 fallback when the HMS stub isn't even wired (env vars unset → stub
    // mode is fine, but if anyone ever ripped `HmsClient` we'd never get here).
    // For PR-1 the stub IS configured-by-default, so this is dead code; PR-2
    // tightens it.

    // 1. Membership + counterpart resolution.
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: initiatorUserId } },
      include: {
        chat: { select: { kind: true } },
      },
    });
    if (!member || member.leftAt !== null) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'You are not a member of this chat.',
      });
    }
    if (member.chat.kind !== 'ONE_ON_ONE') {
      throw new BadRequestException({
        code: 'not_one_on_one',
        message: 'Calls are only supported in 1-on-1 chats.',
      });
    }
    const counterpart = await this.prisma.chatMember.findFirst({
      where: { chatId, userId: { not: initiatorUserId }, leftAt: null },
      select: { userId: true },
    });
    if (!counterpart) {
      throw new BadRequestException({
        code: 'no_counterpart',
        message: 'No counterpart in this chat.',
      });
    }
    const calleeUserId = counterpart.userId;

    // 2. Block-aware: 403 if either party blocks the other.
    if (await this.blocks.isBlockedEitherWay(initiatorUserId, calleeUserId)) {
      throw new ForbiddenException({
        code: 'peer_blocked',
        message: 'Calls are blocked between you two.',
      });
    }

    // 3. Mint a fresh callId BEFORE creating the room so the room name can
    //    carry it (debugging — `chat-{chatId}-{callId}` makes 100ms dashboard
    //    rooms greppable).
    const callId = randomUUID();
    const room = await this.hms.createRoom({
      name: `chat-${chatId}-${callId}`.slice(0, 64),
      description: `1-on-1 ${kind.toLowerCase()} call`,
    });

    // 4. Insert CallSession in RINGING.
    await this.prisma.callSession.create({
      data: {
        id: callId,
        chatId,
        initiatorUserId,
        calleeUserId,
        kind,
        status: 'RINGING',
        hmsRoomId: room.id,
      },
    });

    // 5. Mint the initiator's HS256 client token.
    const initiatorToken = this.hms.mintClientToken({
      hmsRoomId: room.id,
      userId: initiatorUserId,
    });

    // 6. Fan ring out to the callee's user:{id} room. Resolve the initiator
    //    profile inline so the IncomingCallScreen can render the caller card
    //    without a follow-up fetch.
    const initiatorProfile = await this.prisma.user.findUnique({
      where: { id: initiatorUserId },
      select: { id: true, fullName: true, avatarUri: true },
    });
    const ringExpiresAt = new Date(Date.now() + this.ringTimeoutMs);
    const ringPayload: SocketCallRing = {
      callId,
      chatId,
      hmsRoomId: room.id,
      kind,
      initiator: {
        id: initiatorProfile?.id ?? initiatorUserId,
        displayName: initiatorProfile?.fullName ?? 'Unknown',
        avatarUri: initiatorProfile?.avatarUri ?? null,
      },
      ringExpiresAt: ringExpiresAt.toISOString(),
    };
    this.gateway.emitCallRing(calleeUserId, ringPayload);

    // 7. Schedule the ring-timeout — BullMQ delayed job, survives Fly deploy.
    //    jobId = callId so accept/decline can cancel by id.
    await this.ringQueue.add(
      'ring-timeout',
      { callId } satisfies CallRingTimeoutJobData,
      {
        delay: this.ringTimeoutMs,
        jobId: callId,
      },
    );

    // 8. (Future / Tranche 2.I): push wakeup for offline devices.
    //    `pushService?.notify({ userIds: [calleeUserId], payload: { type: 'call:ring', ... } })`.

    return {
      callId,
      hmsRoomId: room.id,
      hmsToken: initiatorToken.token,
      expiresAt: initiatorToken.expiresAt,
    };
  }

  // ─── Accept (callee) ───────────────────────────────────────────────────────

  async accept(acceptingUserId: string, callId: string): Promise<{
    hmsToken: string;
    expiresAt: string;
  }> {
    const row = await this.loadCallForWrite(callId, acceptingUserId, 'callee');

    // pg_advisory_xact_lock + state-check inside the transaction. Two
    // concurrent accepts from two devices both pass the outer load but
    // serialise here — the loser sees status != 'RINGING' and 409s.
    let acceptedRoom: { hmsRoomId: string };
    try {
      acceptedRoom = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          callIdToAdvisoryKey(callId),
        );
        const fresh = await tx.callSession.findUnique({
          where: { id: callId },
          select: { status: true, hmsRoomId: true },
        });
        if (!fresh) {
          throw new NotFoundException({ code: 'call_not_found', message: 'Call not found.' });
        }
        if (fresh.status !== CallStatus.RINGING) {
          throw new ConflictException({
            code: 'call_already_accepted',
            message: `Call is ${fresh.status.toLowerCase()}, not RINGING.`,
          });
        }
        await tx.callSession.update({
          where: { id: callId },
          data: { status: 'ACCEPTED', startedAt: new Date() },
        });
        return { hmsRoomId: fresh.hmsRoomId! };
      });
    } catch (err) {
      // Rethrow Nest exceptions; wrap unexpected.
      if (err instanceof ConflictException || err instanceof NotFoundException) throw err;
      throw err;
    }

    // Cancel the BullMQ ring-timeout (no-op if already fired).
    await this.cancelRingTimeout(callId);

    // Broadcast: both peers transition; the callee's OTHER devices receive
    // call:taken and dismiss the IncomingCallScreen.
    this.gateway.emitCallAccepted(row.initiatorUserId, { callId });
    this.gateway.emitCallAccepted(row.calleeUserId, { callId });
    this.gateway.emitCallTaken(row.calleeUserId, { callId });

    // Mint the callee's HS256 client token for the same room.
    const calleeToken = this.hms.mintClientToken({
      hmsRoomId: acceptedRoom.hmsRoomId,
      userId: acceptingUserId,
    });
    return { hmsToken: calleeToken.token, expiresAt: calleeToken.expiresAt };
  }

  // ─── Decline (callee) ──────────────────────────────────────────────────────

  async decline(acceptingUserId: string, callId: string): Promise<void> {
    const row = await this.loadCallForWrite(callId, acceptingUserId, 'callee');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1::bigint)`,
        callIdToAdvisoryKey(callId),
      );
      const fresh = await tx.callSession.findUnique({
        where: { id: callId },
        select: { status: true },
      });
      if (!fresh) {
        throw new NotFoundException({ code: 'call_not_found', message: 'Call not found.' });
      }
      if (fresh.status !== CallStatus.RINGING) {
        throw new ConflictException({
          code: 'call_not_ringing',
          message: 'Call is not ringing — cannot decline.',
        });
      }
      await tx.callSession.update({
        where: { id: callId },
        data: { status: 'DECLINED', endedAt: new Date() },
      });
      // Insert CALL_EVENT thread row.
      await this.insertCallEvent(tx, row.chatId, row.initiatorUserId, callId, row.kind, 'declined', null);
    });
    await this.cancelRingTimeout(callId);
    this.broadcastEnded(row.initiatorUserId, row.calleeUserId, callId, 'declined', null);
  }

  // ─── Hangup (either peer) ──────────────────────────────────────────────────

  async hangup(callerUserId: string, callId: string): Promise<void> {
    const row = await this.loadCallForWrite(callId, callerUserId, 'either');
    const summary = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock($1::bigint)`,
        callIdToAdvisoryKey(callId),
      );
      const fresh = await tx.callSession.findUnique({
        where: { id: callId },
        select: { status: true, startedAt: true, hmsRoomId: true },
      });
      if (!fresh) {
        throw new NotFoundException({ code: 'call_not_found', message: 'Call not found.' });
      }
      if (fresh.status !== CallStatus.ACCEPTED) {
        throw new ConflictException({
          code: 'call_not_active',
          message: `Call is ${fresh.status.toLowerCase()}, not ACCEPTED.`,
        });
      }
      const endedAt = new Date();
      const durationSec = fresh.startedAt
        ? Math.max(0, Math.floor((endedAt.getTime() - fresh.startedAt.getTime()) / 1000))
        : 0;
      await tx.callSession.update({
        where: { id: callId },
        data: { status: 'COMPLETED', endedAt, durationSec },
      });
      await this.insertCallEvent(tx, row.chatId, row.initiatorUserId, callId, row.kind, 'hangup', durationSec);
      return { durationSec, hmsRoomId: fresh.hmsRoomId };
    });

    // Best-effort: disable the 100ms room so it can't be re-joined.
    if (summary.hmsRoomId) {
      try {
        await this.hms.disableRoom(summary.hmsRoomId);
      } catch (err) {
        this.log.warn({ err, callId }, 'hms.disableRoom failed (non-fatal)');
      }
    }
    this.broadcastEnded(row.initiatorUserId, row.calleeUserId, callId, 'hangup', summary.durationSec);
  }

  // ─── Ring-timeout (BullMQ processor entry point) ───────────────────────────

  /**
   * Fires 30s after `mintToken` if accept/decline didn't cancel the job.
   * Flips RINGING → MISSED + inserts CALL_EVENT + broadcasts call:ended.
   * Idempotent: if accept/decline raced the timeout to commit, this returns
   * cleanly without mutating state.
   *
   * Exposed publicly so the e2e suite can call it directly (faster than
   * waiting for a real BullMQ delayed job to fire — see plan §11 Q1c).
   */
  async onRingTimeout(callId: string): Promise<void> {
    let result: {
      ok: true;
      chatId: string;
      initiatorUserId: string;
      calleeUserId: string;
      kind: CallKind;
    } | { ok: false };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          callIdToAdvisoryKey(callId),
        );
        const row = await tx.callSession.findUnique({ where: { id: callId } });
        if (!row || row.status !== CallStatus.RINGING) {
          return { ok: false as const };
        }
        await tx.callSession.update({
          where: { id: callId },
          data: { status: 'MISSED', endedAt: new Date() },
        });
        await this.insertCallEvent(
          tx,
          row.chatId,
          row.initiatorUserId,
          callId,
          row.kind,
          'missed',
          null,
        );
        return {
          ok: true as const,
          chatId: row.chatId,
          initiatorUserId: row.initiatorUserId,
          calleeUserId: row.calleeUserId,
          kind: row.kind,
        };
      });
    } catch (err) {
      this.log.error({ err, callId }, 'ring-timeout processor failed');
      return;
    }
    if (!result.ok) return; // already accepted/declined; nothing to do
    this.broadcastEnded(result.initiatorUserId, result.calleeUserId, callId, 'missed', null);
  }

  // ─── Webhook (100ms) ───────────────────────────────────────────────────────

  /**
   * 100ms webhook handler. PR-1 stub: verifies signature with HmsClient.
   * Real event handling (sync `durationSec` from `session.close.success`)
   * lands in PR-2.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!this.hms.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException({
        code: 'invalid_webhook_signature',
        message: 'Webhook signature verification failed.',
      });
    }
    // PR-2 will parse the event + sync durationSec on session.close.success.
  }

  // ─── List (per-chat history) ───────────────────────────────────────────────

  async listForChat(userId: string, chatId: string): Promise<CallListResponse> {
    await this.assertMember(userId, chatId);
    const rows = await this.prisma.callSession.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
    });
    const items: CallSummary[] = rows.map((r) => ({
      callId: r.id,
      chatId: r.chatId,
      kind: r.kind as CallKind,
      status: r.status as CallSummary['status'],
      initiatorUserId: r.initiatorUserId,
      calleeUserId: r.calleeUserId,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      endedAt: r.endedAt ? r.endedAt.toISOString() : null,
      durationSec: r.durationSec,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Load the CallSession + assert the caller's role (callee for accept/
   * decline; either for hangup). Used by every state-mutating endpoint.
   */
  private async loadCallForWrite(
    callId: string,
    callerUserId: string,
    requiredRole: 'callee' | 'either',
  ): Promise<{
    chatId: string;
    initiatorUserId: string;
    calleeUserId: string;
    kind: CallKind;
  }> {
    const row = await this.prisma.callSession.findUnique({ where: { id: callId } });
    if (!row) {
      throw new NotFoundException({ code: 'call_not_found', message: 'Call not found.' });
    }
    if (requiredRole === 'callee' && callerUserId !== row.calleeUserId) {
      throw new ForbiddenException({
        code: 'not_callee',
        message: 'Only the callee can perform this action.',
      });
    }
    if (
      requiredRole === 'either' &&
      callerUserId !== row.initiatorUserId &&
      callerUserId !== row.calleeUserId
    ) {
      throw new ForbiddenException({
        code: 'not_a_participant',
        message: 'You are not a participant in this call.',
      });
    }
    return {
      chatId: row.chatId,
      initiatorUserId: row.initiatorUserId,
      calleeUserId: row.calleeUserId,
      kind: row.kind as CallKind,
    };
  }

  private async assertMember(userId: string, chatId: string): Promise<void> {
    const m = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { leftAt: true },
    });
    if (!m || m.leftAt !== null) {
      throw new ForbiddenException({
        code: 'not_a_member',
        message: 'You are not a member of this chat.',
      });
    }
  }

  /**
   * Insert the CALL_EVENT thread row + back-reference the CallSession.
   * Server-authored — uses `MessagesService.createServerAuthored` (introduced
   * in 2.F PR-1). Idempotent on `(senderUserId, clientMessageId)`.
   */
  private async insertCallEvent(
    tx: Prisma.TransactionClient,
    chatId: string,
    initiatorUserId: string,
    callId: string,
    kind: CallKind,
    reason: CallEndReason,
    durationSec: number | null,
  ): Promise<void> {
    const text = humanCallEventLabel(kind, reason, durationSec);
    const created = await this.messages.createServerAuthored(tx, {
      chatId,
      senderUserId: initiatorUserId,
      clientMessageId: `call-${callId}-${reason}`,
      kind: 'CALL_EVENT',
      text,
    });
    await tx.callSession.update({
      where: { id: callId },
      data: { callEventMessageId: created.id },
    });
  }

  private async cancelRingTimeout(callId: string): Promise<void> {
    try {
      const job = await this.ringQueue.getJob(callId);
      if (job) await job.remove();
    } catch (err) {
      this.log.warn({ err, callId }, 'failed to cancel ring-timeout (non-fatal)');
    }
  }

  private broadcastEnded(
    initiatorUserId: string,
    calleeUserId: string,
    callId: string,
    reason: CallEndReason,
    durationSec: number | null,
  ): void {
    this.gateway.emitCallEnded(initiatorUserId, { callId, reason, durationSec });
    this.gateway.emitCallEnded(calleeUserId, { callId, reason, durationSec });
  }
}

/**
 * Stable bigint advisory-lock key derived from a call UUID. Mirrors
 * `chatIdToAdvisoryKey` in messages.service.ts. Disjoint domain — call
 * UUIDs are minted by `randomUUID()` so collision with a chat-lock is
 * astronomically unlikely.
 */
export function callIdToAdvisoryKey(callId: string): bigint {
  const hex = callId.replace(/-/g, '').slice(0, 16);
  const unsigned = BigInt(`0x${hex}`);
  const signed = unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
  return signed;
}

/** Human-readable label for the CALL_EVENT thread row. */
function humanCallEventLabel(
  kind: CallKind,
  reason: CallEndReason,
  durationSec: number | null,
): string {
  const verb = kind === 'VOICE' ? 'voice call' : 'video call';
  if (reason === 'missed') return `Missed ${verb}`;
  if (reason === 'declined') return `Declined ${verb}`;
  if (durationSec !== null) {
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const tail = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
    return `${kind === 'VOICE' ? 'Voice' : 'Video'} call · ${tail}`;
  }
  return `${kind === 'VOICE' ? 'Voice' : 'Video'} call`;
}

// Silence unused-import warning if the stub path is taken.
void ServiceUnavailableException;
