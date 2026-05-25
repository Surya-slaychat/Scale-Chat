/**
 * Jest global teardown — runs ONCE after the last test.
 *
 * Drops the `test_e2e` schema via raw Prisma so a follow-up run starts clean.
 * Set `KEEP_TEST_SCHEMA=1` to preserve it (useful when debugging a fail).
 */
import { PrismaClient } from '@prisma/client';

const TEST_DB_BASE =
  process.env.TEST_DATABASE_URL_BASE ??
  'postgresql://scalechat:scalechat@localhost:5433/scalechat';

export default async function globalTeardown(): Promise<void> {
  if (process.env.KEEP_TEST_SCHEMA === '1') return;
  // Connect against the default `public` schema so the DROP doesn't fight
  // with the search_path we use during tests.
  const prisma = new PrismaClient({
    datasources: { db: { url: `${TEST_DB_BASE}?schema=public` } },
  });
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "test_e2e" CASCADE');
  } finally {
    await prisma.$disconnect();
  }
}
