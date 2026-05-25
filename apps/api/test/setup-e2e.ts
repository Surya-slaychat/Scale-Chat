/**
 * Per-suite e2e harness.
 *
 * Boots a Nest app (Fastify adapter) bound to the isolated `test_e2e` schema,
 * exposes the Prisma client + a `Fastify.inject()` helper, and provides small
 * factories for users + JWTs.
 *
 * Each spec file should:
 *   - call `setupTestApp()` once in a `beforeAll`
 *   - call `truncateAll()` in `beforeEach` to start with empty tables
 *   - call `teardownTestApp()` in `afterAll`
 *
 * Why `light-my-request` and not supertest:
 *   `@nestjs/platform-fastify` ships with Fastify; Fastify ships with
 *   light-my-request as `app.inject()`. Zero new deps. Same API surface.
 */
import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { PrismaClient } from '@prisma/client';
import type { InjectOptions, Response as InjectResponse } from 'light-my-request';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AppJwtService } from '../src/common/auth/jwt.service';

export type TestApp = {
  app: NestFastifyApplication & INestApplication;
  prisma: PrismaClient;
  jwt: AppJwtService;
  inject: (opts: InjectOptions) => Promise<InjectResponse>;
};

let cached: TestApp | null = null;

export async function setupTestApp(): Promise<TestApp> {
  if (cached) return cached;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: false, bodyLimit: 256 * 1024 })
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService) as unknown as PrismaClient;
  const jwt = app.get(AppJwtService);

  cached = {
    app,
    prisma,
    jwt,
    inject: (opts) => app.getHttpAdapter().getInstance().inject(opts),
  };
  return cached;
}

export async function teardownTestApp(): Promise<void> {
  if (!cached) return;
  await cached.app.close();
  cached = null;
}

/**
 * Truncate every Prisma-managed table. Safe to call between tests — keeps the
 * schema definition intact, just empties the rows. Faster than re-running
 * migrations per test.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  // Discover tables from Postgres rather than maintaining a hard-coded list
  // (the migration set grows over time; the list would drift). Excludes
  // Prisma's internal `_prisma_migrations` row so migration state survives.
  const rows: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='test_e2e' AND tablename <> '_prisma_migrations'`
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"test_e2e"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

// ─── Factories ─────────────────────────────────────────────────────────────

export type SeededUser = {
  id: string;
  phoneE164: string;
  fullName: string;
  accessToken: string;
};

let phoneSeq = 9000_000_000;

export async function seedUser(
  testApp: TestApp,
  overrides: Partial<{ fullName: string; phoneE164: string; isPremium: boolean }> = {}
): Promise<SeededUser> {
  const phoneE164 = overrides.phoneE164 ?? `+91${(phoneSeq += 1)}`;
  const fullName = overrides.fullName ?? `User ${phoneSeq}`;
  const user = await testApp.prisma.user.create({
    data: { phoneE164, fullName, isPremium: overrides.isPremium ?? false },
  });
  const { token } = testApp.jwt.signAccessToken(user.id);
  return { id: user.id, phoneE164, fullName, accessToken: token };
}

// ─── Inject helpers ────────────────────────────────────────────────────────

export type InjectAuthedOptions = Omit<InjectOptions, 'headers'> & {
  token: string;
  headers?: Record<string, string>;
};

export function authedInject(
  testApp: TestApp,
  opts: InjectAuthedOptions
): Promise<InjectResponse> {
  // Fastify rejects bodyless requests carrying `content-type: application/json`
  // with `400 bad_request: "Body cannot be empty…"` (the same F6 bug captured
  // in `docs/progress/1-on-1-production.md`). Only set the header when we are
  // actually sending a body.
  const hasPayload = opts.payload !== undefined && opts.payload !== null;
  return testApp.inject({
    ...opts,
    headers: {
      authorization: `Bearer ${opts.token}`,
      ...(hasPayload ? { 'content-type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
}
