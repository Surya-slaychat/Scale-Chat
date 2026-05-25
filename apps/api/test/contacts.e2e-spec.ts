/**
 * Contacts module e2e — PR 6 device-contacts sync.
 *
 * PR 6.2 cases (this file):
 *   1. Discovery returns only on-platform matches and never leaks `id`/`userId`.
 *   2. Discovery silently drops the caller's own phone if included in the batch.
 *   3. Empty / malformed bodies are rejected with 400.
 *   4. Rate limit kicks in after 10 successful calls within the window.
 *
 * PR 6.3 cases (POST /contacts/bulk) extend this file when that PR lands.
 */
import {
  authedInject,
  seedUser,
  setupTestApp,
  teardownTestApp,
  truncateAll,
  type SeededUser,
  type TestApp,
} from './setup-e2e';

describe('POST /contacts/discover', () => {
  let testApp: TestApp;
  let alice: SeededUser;
  let bob: SeededUser;
  let carol: SeededUser;

  beforeAll(async () => {
    testApp = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await truncateAll(testApp.prisma);
    // Three platform users + one phone we'll submit that doesn't exist.
    // Each seedUser() call generates a unique phone, so the rate-limit key
    // (`contacts:discover:${user.sub}`) is also unique per test run — leftover
    // Redis state from prior runs can't poison these assertions.
    alice = await seedUser(testApp, { fullName: 'Alice', phoneE164: '+919800010001' });
    bob = await seedUser(testApp, { fullName: 'Bob', phoneE164: '+919800010002' });
    carol = await seedUser(testApp, { fullName: 'Carol', phoneE164: '+919800010003' });
  });

  // ─── Case 1 — happy path + privacy contract ───────────────────────────────

  it('returns matches for on-platform phones and rejects unknown ones', async () => {
    const ghost = '+919800099999'; // not seeded
    const res = await authedInject(testApp, {
      method: 'POST',
      url: '/contacts/discover',
      token: alice.accessToken,
      payload: { phones: [bob.phoneE164, carol.phoneE164, ghost] },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ matches: Array<Record<string, unknown>> }>();
    expect(body.matches).toHaveLength(2);

    // Privacy contract: the response must NOT carry the matched user's `id`
    // or any `userId`-like field. Serialise + grep the whole payload.
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/"id"\s*:/);
    expect(raw).not.toMatch(/userId/i);

    // Each match must carry only the 4 contracted fields.
    for (const m of body.matches) {
      expect(Object.keys(m).sort()).toEqual(
        ['avatarUri', 'displayName', 'isOnPlatform', 'phoneE164'].sort(),
      );
      expect(m.isOnPlatform).toBe(true);
    }

    // The two matches are bob + carol (order is unspecified by the service).
    const phones = body.matches.map((m) => m.phoneE164).sort();
    expect(phones).toEqual([bob.phoneE164, carol.phoneE164].sort());
  });

  // ─── Case 2 — caller's own number is silently dropped ─────────────────────

  it("does not return the caller's own phone even if submitted", async () => {
    const res = await authedInject(testApp, {
      method: 'POST',
      url: '/contacts/discover',
      token: alice.accessToken,
      payload: { phones: [alice.phoneE164, bob.phoneE164] },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ matches: Array<{ phoneE164: string }> }>();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]?.phoneE164).toBe(bob.phoneE164);
  });

  // ─── Case 3 — input validation ────────────────────────────────────────────

  it('rejects an empty phones array', async () => {
    const res = await authedInject(testApp, {
      method: 'POST',
      url: '/contacts/discover',
      token: alice.accessToken,
      payload: { phones: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a malformed E.164 phone', async () => {
    const res = await authedInject(testApp, {
      method: 'POST',
      url: '/contacts/discover',
      token: alice.accessToken,
      payload: { phones: ['9876543210'] }, // missing +91 prefix
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await testApp.inject({
      method: 'POST',
      url: '/contacts/discover',
      headers: { 'content-type': 'application/json' },
      payload: { phones: [bob.phoneE164] },
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Case 4 — rate limit (10 req/min/user) ────────────────────────────────

  it('returns 429 after exceeding the 10 req/min ceiling', async () => {
    // The 10 within-window calls all succeed (status 200). The 11th must
    // return 429 with the documented error code.
    for (let i = 0; i < 10; i += 1) {
      const ok = await authedInject(testApp, {
        method: 'POST',
        url: '/contacts/discover',
        token: alice.accessToken,
        payload: { phones: [bob.phoneE164] },
      });
      expect(ok.statusCode).toBe(200);
    }
    const limited = await authedInject(testApp, {
      method: 'POST',
      url: '/contacts/discover',
      token: alice.accessToken,
      payload: { phones: [bob.phoneE164] },
    });
    expect(limited.statusCode).toBe(429);
    // The global HttpExceptionFilter wraps every HttpException as
    // `{ error: { code, message, requestId } }` — see
    // `apps/api/src/common/filters/http-exception.filter.ts`. Assert the
    // unwrapped shape rather than the controller's raw throw payload.
    expect(limited.json<{ error: { code: string } }>().error.code).toBe('rate_limited');
  });
});
