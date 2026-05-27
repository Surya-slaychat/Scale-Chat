/**
 * P2-Search — GET /chats/:chatId/messages/search e2e suite.
 *
 * 5 cases:
 *   1. Match found, case-insensitive
 *   2. Tombstoned message excluded (DELETE ?scope=everyone)
 *   3. Message before clear excluded; message after clear included
 *   4. Non-member → 403 not_a_member
 *   5. Empty q → 400
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

let cliSeq = 0;
function cli(): string {
  return `search-cli-${Date.now()}-${(cliSeq += 1)}`;
}

describe('GET /chats/:chatId/messages/search', () => {
  let testApp: TestApp;
  let alice: SeededUser;
  let bob: SeededUser;
  let mallory: SeededUser;

  beforeAll(async () => {
    testApp = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    await truncateAll(testApp.prisma);
    alice = await seedUser(testApp, { fullName: 'Alice', phoneE164: '+919111110001' });
    bob = await seedUser(testApp, { fullName: 'Bob', phoneE164: '+919111110002' });
    mallory = await seedUser(testApp, { fullName: 'Mallory', phoneE164: '+919111110003' });
  });

  /** Helper — create a 1-on-1 chat between alice and bob, return chatId. */
  async function openChat(initiator: SeededUser, peer: SeededUser): Promise<string> {
    const res = await authedInject(testApp, {
      method: 'POST',
      url: '/chats/one-on-one',
      token: initiator.accessToken,
      payload: { contactUserId: peer.id },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ chatId: string }>().chatId;
  }

  /** Helper — send a TEXT message, return the message id. */
  async function sendText(
    sender: SeededUser,
    chatId: string,
    text: string,
  ): Promise<string> {
    const res = await authedInject(testApp, {
      method: 'POST',
      url: `/chats/${chatId}/messages`,
      token: sender.accessToken,
      payload: { kind: 'TEXT', text, clientMessageId: cli() },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  // ─── Case 1 — match found, case-insensitive ─────────────────────────────

  it('Case 1 — returns hits case-insensitively, correct shape', async () => {
    const chatId = await openChat(alice, bob);
    await sendText(alice, chatId, 'Hello world');
    await sendText(bob, chatId, 'HELLO there');
    await sendText(alice, chatId, 'nothing matches');

    const res = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=hello`,
      token: alice.accessToken,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      items: Array<{
        messageId: string;
        sequence: string;
        snippet: string;
        createdAt: string;
        senderUserId: string;
      }>;
      meta: { nextCursor: string | null; hasMore: boolean };
    }>();

    // Both messages containing "hello" (case-insensitive) must appear.
    expect(body.items).toHaveLength(2);
    // Ordered desc by sequence — highest sequence first.
    const seqs = body.items.map((h) => BigInt(h.sequence));
    expect(seqs[0]).toBeGreaterThan(seqs[1]);

    // Each hit has required fields.
    for (const hit of body.items) {
      expect(hit.messageId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(hit.sequence).toMatch(/^\d+$/);
      expect(typeof hit.snippet).toBe('string');
      expect(hit.snippet.length).toBeGreaterThan(0);
      expect(typeof hit.createdAt).toBe('string');
      expect(hit.senderUserId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }

    // The "nothing matches" message should NOT appear.
    expect(body.items.every((h) => /hello/i.test(h.snippet))).toBe(true);

    // No next page for only 2 hits.
    expect(body.meta.hasMore).toBe(false);
    expect(body.meta.nextCursor).toBeNull();
  });

  // ─── Case 2 — tombstoned message excluded ───────────────────────────────

  it('Case 2 — deleted (tombstoned) messages are excluded from search results', async () => {
    const chatId = await openChat(alice, bob);
    const msgId = await sendText(alice, chatId, 'secret keyword');

    // Delete for everyone (within the 60-min edit window — we just created it).
    const del = await authedInject(testApp, {
      method: 'DELETE',
      url: `/chats/${chatId}/messages/${msgId}?scope=everyone`,
      token: alice.accessToken,
    });
    expect(del.statusCode).toBe(204);

    const res = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=keyword`,
      token: alice.accessToken,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[] }>();
    expect(body.items).toHaveLength(0);
  });

  // ─── Case 3 — message before clear excluded; after-clear included ────────

  it('Case 3 — messages sent before clearedAt are excluded; after-clear messages included', async () => {
    const chatId = await openChat(alice, bob);
    // Alice sends a message BEFORE she clears the chat.
    await sendText(alice, chatId, 'old searchable text');

    // Alice clears the chat — sets her clearedAt = NOW().
    const clearRes = await authedInject(testApp, {
      method: 'PATCH',
      url: `/chats/${chatId}/clear`,
      token: alice.accessToken,
    });
    expect(clearRes.statusCode).toBe(200);

    // Bob sends a message AFTER alice cleared — alice should see it in search.
    await sendText(bob, chatId, 'new searchable text');

    // Alice searches: should see only the post-clear message.
    const res = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=searchable`,
      token: alice.accessToken,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: Array<{ snippet: string }> }>();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].snippet).toMatch(/new searchable/i);
  });

  // ─── Case 4 — non-member → 403 ───────────────────────────────────────────

  it('Case 4 — non-member receives 403 not_a_member', async () => {
    const chatId = await openChat(alice, bob);
    await sendText(alice, chatId, 'some text');

    const res = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=some`,
      token: mallory.accessToken,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('not_a_member');
  });

  // ─── Case 5 — empty q → 400 ──────────────────────────────────────────────

  it('Case 5 — empty or missing q returns 400', async () => {
    const chatId = await openChat(alice, bob);

    // Empty string.
    const emptyRes = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=`,
      token: alice.accessToken,
    });
    expect(emptyRes.statusCode).toBe(400);

    // Whitespace-only (should be trimmed to empty by zod .trim()).
    const wsRes = await authedInject(testApp, {
      method: 'GET',
      url: `/chats/${chatId}/messages/search?q=${encodeURIComponent('   ')}`,
      token: alice.accessToken,
    });
    expect(wsRes.statusCode).toBe(400);
  });
});
