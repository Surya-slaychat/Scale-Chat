import type { Message, SendMessageInput, Thread } from '../types';

export type LoadOlderResult = {
  /** Older messages prepended (chronological ASC). */
  items: Message[];
  /** False once there's nothing older to fetch. */
  hasMore: boolean;
};

/**
 * Seam for the NestJS chat backend. Both REST and Socket.IO flow through here so
 * screens see one shape:
 *   - listThreads / getThread     → GET  /chats, /chats/:id
 *   - listMessages                → GET  /chats/:id/messages?direction=desc
 *   - loadOlder                   → GET  /chats/:id/messages?direction=desc&cursor=…
 *   - sendMessage                 → socket `message:send` (REST fallback)
 *   - markThreadRead / markAllRead → PATCH /chats/:id/read | /chats/read-all
 *   - toggleFavourite             → PATCH /chats/:id/favourite
 *
 * The api implementation also maintains an in-memory cache fed by both REST
 * responses and socket `message:new` events, so screens never need to refetch
 * to see an incoming message — they just `subscribe()` and re-read.
 */
export interface ChatRepository {
  listThreads(): Promise<Thread[]>;
  getThread(threadId: string): Promise<Thread | null>;
  listMessages(threadId: string): Promise<Message[]>;
  /** Fetch older messages (before the oldest one currently cached). */
  loadOlder?(threadId: string): Promise<LoadOlderResult>;
  /**
   * Insert a local "pending" message immediately and dispatch the send.
   * The returned promise resolves with the durable message once the server
   * acks; intermediate states (sending → sent / failed) are pushed via
   * `subscribe()` so the UI doesn't have to await.
   */
  sendMessage(input: SendMessageInput): Promise<Message>;
  /** Delete-for-everyone — soft-deletes server-side, broadcasts a tombstone. */
  deleteMessage?(threadId: string, messageId: string): Promise<void>;
  markThreadRead(threadId: string): Promise<void>;
  markAllRead(): Promise<void>;
  toggleFavourite(threadId: string): Promise<void>;
  /** Subscribe to repository changes (any thread/message update). */
  subscribe(listener: () => void): () => void;
}
