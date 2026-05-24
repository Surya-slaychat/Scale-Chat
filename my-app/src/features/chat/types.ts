/**
 * Chat domain types — mirror the eventual backend contract from CLAUDE.md §4.
 *
 * Once `packages/shared` exists, these will be re-exports of branded zod schemas.
 * For now we type the mock store the way the masked socket payloads will look.
 */

export type ThreadKind = 'direct' | 'group' | 'super';

/**
 * A contact / chat participant. For Super Groups, members will receive `Masked`
 * versions of this where `phoneE164` is omitted and `displayName` is an alias.
 */
export type Contact = {
  id: string;
  displayName: string;
  phoneE164?: string;
  avatarUri?: string;
  /** Optional emoji fallback when no photo is set (mock seed). */
  emoji?: string;
  /** Background tint used when no photo is set. */
  tint?: string;
  isOnline?: boolean;
};

/** A single 1-on-1 thread (and the same shape will represent groups when added). */
export type Thread = {
  id: string;
  kind: ThreadKind;
  counterpart: Contact;
  lastMessage: Message;
  unreadCount: number;
  /** Sequence of the last message the user has read — drives "delivered" vs "read" ticks. */
  lastReadSequence: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isFavourite?: boolean;
};

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageBase = {
  id: string;
  threadId: string;
  /** Author id; `me` is the current device user. */
  senderId: string;
  /** Server-assigned ordering; `BigInt` in the real backend (serialised as string). */
  sequence: number;
  /** ISO timestamp. Format with `formatBubbleTime` / `formatDayLabel`. */
  createdAt: string;
  /** Status from the sender's perspective. */
  status: MessageStatus;
  /**
   * Client-generated idempotency key. Present on every send (optimistic AND
   * durable rows the server returns) so the cache can match the durable row
   * back to the optimistic insert regardless of whether the ack or the socket
   * `message:new` broadcast arrives first.
   */
  clientMessageId?: string;
  /** Set when this message replies to another in the same thread. */
  replyToMessageId?: string | null;
  /**
   * Non-null when the message was deleted-for-everyone. Renders as a
   * "This message was deleted" tombstone; the original `text`/voice payload
   * is zeroed server-side.
   */
  deletedAt?: string | null;
};

export type TextMessage = MessageBase & {
  type: 'text';
  text: string;
};

export type VoiceMessage = MessageBase & {
  type: 'voice';
  /** Duration in seconds. */
  durationSec: number;
  /** Waveform peaks (0..1). */
  waveform: number[];
};

export type Message = TextMessage | VoiceMessage;

export type SendMessageInput =
  | {
      threadId: string;
      type: 'text';
      text: string;
      clientMessageId: string;
      replyToMessageId?: string;
    }
  | {
      threadId: string;
      type: 'voice';
      durationSec: number;
      waveform: number[];
      clientMessageId: string;
      replyToMessageId?: string;
    };

/**
 * Filter pill state on the Contact Page. Mirrors the future
 * `filter=ALL|UNREAD|GROUP|SUPER_GROUP|FAVOURITES` query string on
 * `GET /chats` (`packages/shared/src/schemas/chats.ts`).
 */
export type ChatFilter = 'all' | 'unread' | 'group' | 'super' | 'favourites';

export const ChatFilters: Record<ChatFilter, string> = {
  all: 'All',
  unread: 'Unread',
  group: 'Group',
  super: 'Super Group',
  favourites: 'Favourites',
};
