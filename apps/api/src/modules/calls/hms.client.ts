import { createHmac, randomUUID } from 'node:crypto';

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env';

/**
 * 100ms management client + HS256 token mint (Tranche 2.H).
 *
 * **PR-1 status:** stub mode. When `HMS_*` env vars are unset (the default
 * for local dev + e2e), `createRoom` returns a deterministic synthetic room
 * id and `mintClientToken` returns a self-signed dev token. Real HTTP calls
 * to the 100ms management API + real HS256 signing land in **PR-2** after
 * the founder's live-test checklist clears the provider POC.
 *
 * The stub fabricates the same shape the real client will return, so the
 * calls service + controller + e2e suite are bit-identical between PR-1 and
 * PR-2. Provider swap (100ms → LiveKit) renames this file + the env-var
 * prefix; everything else in the calls module stays put.
 *
 * Webhook signature verification + `disableRoom` land in PR-2 too.
 */

export interface HmsRoom {
  id: string;
  name: string;
}

export interface HmsClientToken {
  token: string;
  expiresAt: string;
}

@Injectable()
export class HmsClient {
  private readonly log = new Logger(HmsClient.name);
  private readonly managementToken: string | null;
  private readonly appAccessKey: string | null;
  private readonly appSecret: string | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const mgmt = config.get('HMS_MANAGEMENT_TOKEN', { infer: true });
    const access = config.get('HMS_APP_ACCESS_KEY', { infer: true });
    const secret = config.get('HMS_APP_SECRET', { infer: true });
    this.managementToken = mgmt ?? null;
    this.appAccessKey = access ?? null;
    this.appSecret = secret ?? null;
    if (!this.isConfigured()) {
      this.log.warn(
        'HMS_* env vars not set — calls module running in STUB MODE. ' +
          '`/calls/token` will mint synthetic room ids + dev tokens. ' +
          'Set HMS_MANAGEMENT_TOKEN, HMS_APP_ACCESS_KEY, HMS_APP_SECRET, HMS_WEBHOOK_SECRET for real 100ms wiring (Tranche 2.H PR-2).',
      );
    }
  }

  /** True when all HS256-relevant env vars are present. */
  isConfigured(): boolean {
    return Boolean(this.managementToken && this.appAccessKey && this.appSecret);
  }

  /**
   * Create a 100ms room. PR-1 stub returns a synthetic id derived from the
   * caller-supplied name. PR-2 will POST to `https://api.100ms.live/v2/rooms`
   * with bearer `managementToken`.
   */
  async createRoom(input: { name: string; description?: string }): Promise<HmsRoom> {
    if (!this.isConfigured()) {
      // Stub: a deterministic-shaped id so e2e assertions stay stable.
      const id = `stub-${randomUUID()}`;
      this.log.debug({ name: input.name, id }, 'stub createRoom');
      return { id, name: input.name };
    }
    // PR-2: real HTTP wiring.
    throw new ServiceUnavailableException({
      code: 'calls_not_configured',
      message: '100ms management API wiring lands in Tranche 2.H PR-2.',
    });
  }

  /**
   * Disable a 100ms room — best-effort cleanup on hangup so subsequent
   * peers can't reuse the room id. PR-1 stub is a no-op; PR-2 PATCHes
   * `/rooms/{id}` with `{ enabled: false }`.
   */
  async disableRoom(roomId: string): Promise<void> {
    if (!this.isConfigured()) {
      this.log.debug({ roomId }, 'stub disableRoom');
      return;
    }
    // PR-2: real HTTP wiring.
  }

  /**
   * Mint a 100ms client token. Payload shape mirrors the 100ms docs
   * (verified via the POC desk research — `access_key`, `room_id`, `user_id`,
   * `role: 'peer'`, `type: 'app'`, `version: 2`, `iat`, `nbf`, `exp`, `jti`).
   *
   * **PR-1 stub:** signs with a development-only secret derived from the
   * call id so tests can verify the shape without provisioning 100ms creds.
   * The token is NOT valid against 100ms's edges — it's purely a wire-format
   * placeholder.
   *
   * **PR-2:** sign with `HMS_APP_SECRET` (HS256). Same payload shape.
   */
  mintClientToken(input: {
    hmsRoomId: string;
    userId: string;
    role?: 'peer' | 'host';
    ttlSec?: number;
  }): HmsClientToken {
    const ttlSec = input.ttlSec ?? 900; // 15 min default
    const role = input.role ?? 'peer';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttlSec;
    const payload = {
      access_key: this.appAccessKey ?? 'stub-access-key',
      room_id: input.hmsRoomId,
      user_id: input.userId,
      role,
      type: 'app',
      version: 2,
      iat: now,
      nbf: now,
      exp,
      jti: randomUUID(),
    };
    const secret = this.appSecret ?? 'stub-dev-secret';
    const token = signHs256(payload, secret);
    return { token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /**
   * Verify a webhook signature (HMAC-SHA256 over the raw body).
   *
   * **PR-1 stub:** rejects every signature when not configured (so the
   * `webhook bad signature → 401` e2e case passes). PR-2 swaps in real
   * constant-time HMAC compare against `HMS_WEBHOOK_SECRET`.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get('HMS_WEBHOOK_SECRET', { infer: true });
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return constantTimeEqual(expected, signature);
  }
}

/**
 * HS256 sign — base64url(header).base64url(payload).base64url(HMAC-SHA256).
 * Standalone helper (no `jsonwebtoken` dep) so the stub + production paths
 * share one code path that's auditable.
 */
function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  const encodedSig = b64url(sig);
  return `${signingInput}.${encodedSig}`;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
