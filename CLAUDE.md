# ScaleChat — Monorepo Root

> See [`my-app/CLAUDE.md`](my-app/CLAUDE.md) for the full product / architecture brief. This file is just the map.

## Layout

```
.
├── my-app/                 # Expo mobile app (current dir for frontend work)
├── apps/
│   └── api/                # NestJS backend (Fastify + Prisma + Redis)
├── packages/
│   └── shared/             # zod schemas, branded types, phone helpers
├── docs/                   # BRDs, architecture notes
└── Scalechat Pdf (2).pdf   # canonical product pitch
```

## Common commands

From the repo root:

```bash
# Install everything (npm workspaces)
npm install

# Mobile
cd my-app && npm run start

# API (dev)
npm run api:dev

# API (build + start prod-style)
npm run api:build && npm run api:start

# Prisma
npm --workspace=apps/api run prisma:generate
npm --workspace=apps/api run prisma:migrate

# Shared package (rebuild after editing zod schemas)
npm run shared:build

# One-shot dev DB bootstrap (start docker + apply pending migrations + regen client + rebuild shared)
# Run this once after pulling a branch that touches schema.prisma OR packages/shared.
npm run db:setup
npm run db:setup:dry           # walk through every step without executing it
# Flags: --no-docker (skip docker start), --skip-shared (skip shared:build)
```

## Where backend work lives

`apps/api/` — read its [`README.md`](apps/api/README.md) before changing anything in `apps/api/src/common/` (privacy interceptor, refresh-rotation, JWT). Those are load-bearing for chat once it ships.

## Working principles (coding discipline)

> Behavioral guidelines to reduce common mistakes. These bias toward caution over speed — for trivial tasks, use judgment.

**1. Think before coding** — Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, and ask.

**2. Simplicity first** — Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked; no abstractions for single-use code.
- No "flexibility"/"configurability" that wasn't requested; no error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**3. Surgical changes** — Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting; don't refactor what isn't broken.
- Match existing style, even if you'd do it differently.
- Remove imports/variables/functions that *your* changes orphaned; leave pre-existing dead code alone (mention it, don't delete it).
- The test: every changed line should trace directly to the request.

**4. Goal-driven execution** — Define success criteria, then loop until verified.
- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.
- For multi-step tasks, state a brief plan with a verify step for each item.

## Status snapshot

> Per `my-app/CLAUDE.md` §7 working agreement, every behavior-changing commit must update this table AND the matching `docs/progress/<slice>.md` file in the same PR, or include `[skip-claudemd] <reason>` in the message. Self-learning loop — see `docs/progress/contact-page.md` for the canonical example.
>
> **1-on-1 slice handoff:** Tranche 1.A landed 2026-05-25. Remaining work (Phases 1–6, ~13 PRs) is enumerated as a checklist in [`docs/progress/1-on-1-production.md` § Tranche 1.B+ — Remaining-work handoff](docs/progress/1-on-1-production.md#tranche-1b--remaining-work-handoff-planned-2026-05-25). Any contributor (human or Claude) picking up this slice should read that section first and tick `[ ]` → `[x]` in the PR that lands each item.
>
> **Per-tranche history** (BRD, design decisions, migrations, knowledge-base gotchas K1–K13, file lists, e2e counts, sequencing) lives in the progress docs — don't duplicate it here:
> - 1-on-1 chat expansion (Tranches 2.0–2.I): [`docs/progress/1-on-1-chat-expansion.md`](docs/progress/1-on-1-chat-expansion.md)
> - 1-on-1 production hardening (PRs 2–4, Phases 1–6): [`docs/progress/1-on-1-production.md`](docs/progress/1-on-1-production.md)
> - Profile Page v2 (P1 + P2 slices): [`docs/progress/profile-page-v2.md`](docs/progress/profile-page-v2.md)
> - Contact Page (canonical self-learning loop example): [`docs/progress/contact-page.md`](docs/progress/contact-page.md)
> - Device Contacts Sync (PR 6.1–6.4): [`docs/progress/device-contacts.md`](docs/progress/device-contacts.md)
> - Calls provider POC (100ms → LiveKit decision + live-test checklist): [`docs/architecture/calls-provider-poc.md`](docs/architecture/calls-provider-poc.md)
> - iOS push/CallKit enablement checklist: [`docs/architecture/ios-enablement-checklist.md`](docs/architecture/ios-enablement-checklist.md)

| Slice | Mobile | Backend | Notes |
|---|---|---|---|
| Welcome / Terms / Phone | ✅ | n/a | UI only |
| Contact Page (chat list home) | ✅ live | ✅ live | Figma "Contact Page" frame; theme toggle, `/new-chat` → real `/contacts`, multi-select bulk actions, user-defined filters. See `docs/progress/contact-page.md`. |
| Device Contacts Sync | ✅ live | ✅ live | Backend: `/contacts/discover` (stateless, rate-limited 10/min, no `userId` leak) + `/contacts/bulk` (idempotent batch save, 5/min, transactional dedup). Frontend: `expo-contacts`, `useDeviceContacts` hook (chunked, 24h MMKV cache), `/import-contacts` modal, WhatsApp-style auto-import + A→Z `SectionList` New Chat picker with tap-to-chat, shared `useStartChat()` + `ChatRepository.createOneOnOne`. Requires `expo prebuild` for native module. See `docs/progress/device-contacts.md`. |
| OTP request | ✅ (mock) | ✅ worldwide | Provider seam (`OtpVerificationProvider`): **TwilioVerifyProvider** (prod) or **DevVerifyProvider** (argon2 + Redis + MSG91/console fallback). Country allow-list gate (`OTP_ALLOWED_COUNTRIES`, libphonenumber) rejects unsupported markets with 400 `country_not_supported` before provider spend. `OTP_COUNTRY_BLOCKED` security event. Per-phone + per-IP rate limits. See `docs/progress/otp-research.md`. |
| OTP verify | ✅ mock + real | ✅ provider seam | `OtpService.verify()` → bound provider. **Twilio path:** delegates code gen/storage/attempts to Twilio Verify; maps 60202 → `attempts_exceeded`, 60600 → `provider_error`; Redis key `otp-session:<phone>` correlates `sessionRef` to audit row. **Dev path:** argon2-compares against Redis, attempts counter with lockout, burns key on success. Both upsert User + mint JWT pair + mark `otp_requests` VERIFIED + tag `provider` for audit. |
| Profile (`/me`) | ✅ (mock + real) | ✅ | JWT-guarded GET + PATCH |
| Refresh / signout | ✅ (mock + real) | ✅ | Family rotation, replay detect |
| 1-on-1 chat (Figma) | ✅ pixel-tuned | n/a | gradient header, lime call buttons, purple/cream bubble pair, dark composer, day-divider pill, tombstones |
| 1-on-1 chat (live) | ✅ optimistic + reverse paginated | ✅ REST + Socket.IO | GET/POST `/chats/:id/messages?direction=desc&cursor=…`; Socket.IO `/chat` namespace with Redis adapter; REST send broadcasts via gateway so both transports see the same `message:new`; in-memory cache fed by socket; `sending`/`failed` tick state; FlatList reverse pagination. Keyboard fix — see `docs/progress/1-on-1-production.md`. |
| Typing indicator | ✅ live | ✅ Redis TTL | Gateway `typing:ping` (5s TTL) → `typing:update`; client emits at most every 2.5s while typing; receiver shows animated three-dot indicator under the counterpart name |
| Presence (online/last seen) | ✅ live | ✅ Redis counters | `presence:count:{userId}` INCR on connect, DECR on disconnect; on `count==0` server writes `lastSeenAt` and broadcasts. Client header subline shows "Online" / "last seen 5m ago" |
| Read receipts | ✅ live + cold-start | ✅ | `chat:read` broadcast on REST mark-read. Api repo subscribes to `chatSocket.onReadReceipt` and flips cached mine-messages with `sequence ≤ uptoSequence` to `status: 'read'` (peer-only filter). Cold-start: `ChatDetailSchema.counterpartLastReadSequence` flips already-read mine-bubbles to lime double-tick on initial load. |
| Voice / Video calls (1-on-1) | ✅ live (2.I) | ✅ live (2.H PR-2, **LiveKit**) | Header voice/video → `startCall` → `POST /calls/token` → `chat/call.tsx` LiveKit `<LiveKitRoom>` (mute/camera/hangup; abnormal-termination → hangup). Incoming via `call:ring` socket (+ Expo push wakeup) → `chat/incoming-call.tsx`. Server: full lifecycle (RINGING→ACCEPTED/DECLINED/MISSED/COMPLETED, advisory-locked first-accept-wins, BullMQ 30s ring-timeout, block-aware), CALL_EVENT thread pill, LiveKit `WebhookReceiver`. Push: `UserDevice` + `POST /push/tokens` + `notifyCall` (mute-bypassed). iOS — see `docs/architecture/ios-enablement-checklist.md`. Post-QA fixes + 2-party live verification — see `docs/progress/1-on-1-production.md`. |
| Voice progressive load | ✅ | n/a | `ActivityIndicator` in the voice-bubble play button while `useAudioPlayerStatus.isLoaded === false` so the bubble doesn't look unresponsive during the first R2 stream. |
| Reply to message | ✅ | ✅ | `replyToMessageId` plumbed through send (REST + socket); composer reply-preview banner with dismiss; quoted preview rendered inside the reply bubble. |
| Delete for everyone | ✅ + tombstones | ✅ | `DELETE /chats/:id/messages/:msgId?scope=everyone`, sender-only, 60-min edit window; soft-delete + `message:deleted` broadcast; client renders "This message was deleted". |
| Long-press action sheet | ✅ | n/a | Reply / Pin·Unpin / Forward / Copy (text) / Delete for everyone (mine) / Report (counterpart, non-tombstone). Pin/Forward gated on durable `status` (optimistic id == clientMessageId would 404). |
| Pin / Unpin message | ✅ (2.E-front-pin) | ✅ (2.E-back) | `PATCH/DELETE /chats/:id/messages/:mid/pin` (+ `GET /chats/:id/pins`); 3-pin cap → 409 `pin_cap_exceeded` (advisory-locked), cross-chat 404. Mobile: optimistic `pinnedAt` flip + bubble pin pip, live via `message:pinned`/`unpinned` socket. Pinned strip deferred. See `docs/progress/1-on-1-chat-expansion.md`. |
| Forward message | ✅ (2.E-front-forward) | ✅ (2.E-back) | `POST /messages/:id/forward { targetChatIds[1..20] }` — per-target partial success `{items, skipped}`; clones content, drops reply + reactions, sets `forwardedFromMessageId`; idempotent (`forwardCount` bumps on created copies only). Mobile: single-select modal picker, source excluded, "↪ Forwarded" label. See `docs/progress/1-on-1-chat-expansion.md`. |
| Report message | ✅ | ✅ new Reports module | `POST /messages/:id/report` (JWT, body `{ reason, note? }`); reporter must be chat member. 400 `cannot_report_self`, 409 `already_reported` (unique `(messageId, reporterUserId, reason)`). Never broadcasts. Picker: Spam/Harassment/Inappropriate/Impersonation/Other. |
| Contact Profile screen | ✅ live · **v2 redesign P1 landed 2026-05-27** | ✅ 3 endpoints + `isBlocked` in profile-card | **Profile Page v2 (Figma `1:3877`)** — P1: purple banner + ringed avatar, 4 dark action tiles (Voice/Video → `startCall`, Notifications → `MutePickerSheet`, Search), grouped options list, destructive footer (Clear/Block). **P2 landed 2026-05-27**: Search (`GET /chats/:id/messages/search` + overlay), Manage Storage (`Message.mediaSizeBytes` migration + `GET /chats/:id/storage`), Chat Theme (`ChatMember.chatTheme` migration + `PATCH /chats/:chatId/theme` + picker, themes bg+bubbles), Privacy sub-screen. Also: `GET /users/:id/profile-card` (privacy-filtered, 403 unless shared chat/contact; `isBlocked`), `GET /chats/:chatId/media?kind=`, `GET /contacts/:contactUserId/common-groups`. See `docs/superpowers/plans/2026-05-27-profile-page-v2.md` + `docs/progress/profile-page-v2.md`. |
| Image messages | ✅ pick + capture + bubble + viewer | ✅ R2 + key validation | Figma `1:3098` attachment sheet → `expo-image-picker` → presigned PUT to R2 → `POST /chats/:id/messages` with `mediaObjectKey`. Bubble uses intrinsic dims, tap → pinch-zoom viewer. Optimistic `uploading → sending → delivered` ticks. |
| Voice notes (record + play) | ✅ recorder overlay + playable bubble | ✅ R2 + key validation | Figma `1:3698` recorder overlay (`expo-audio` `useAudioRecorder`, m4a/AAC HIGH_QUALITY, waveform, 5-min cap). Bubble uses `useAudioPlayer` with progressive lime fill. Unmount-crash fix (2026-05-26): wrap `player.pause()` in try/catch — see `docs/progress/1-on-1-chat-expansion.md` K13. |
| Location + Contact messages | ✅ (2.D) pickers + cards | ✅ (2.B) validators | **Tranche 2.D** — Location: `expo-location` (timeout + last-known fallback) + `reverseGeocodeAsync` → **LocationCard** (faux-map gradient, "Open in Maps" universal `https` URL, no Maps API key). Contact: `chat/pick-contact.tsx` (`expo-contacts/legacy`, `toE164Loose`) → **ContactCard** (`tel:`). Both TEXT-like send via shared `InfoCardBubble`. Real map preview deferred. |
| Document + Video messages | ✅ (2.C) pick + bubbles + viewer | ✅ (2.B) R2 + validators | **Tranche 2.C** — first tranche needing native deps (`expo-document-picker` + `expo-video`) + prebuild. Gallery tile branches photos/videos via `mediaTypes:['images','videos']`; Document tile → `expo-document-picker`. Client `validateMediaPick` guard (MIME + size + filename≤255) before presign. DOC bubble (icon+name+size, tap → `expo-web-browser`); VIDEO bubble (play + duration pill) → full-screen `expo-video` `VideoViewer`. Caps DOC 100MB / VIDEO 80MB. |
| Media uploads | ✅ presigned PUT | ✅ Cloudflare R2 | `POST /media/upload-url` returns `{ objectKey, uploadUrl, publicUrl, expiresAt }` (5-min TTL). Server validates `mediaObjectKey` carries sender's `userIdFirst8` prefix + correct extension per kind. |
| Per-chat options sheet (3-dot) | ✅ wired | ✅ | BRD §3.6. Chat-header `more-vertical` opens `PerChatOptionsSheet`: View contact / Search / Mute (→ `MutePickerSheet` 8h/1w/Always) / Starred / Wallpaper / Clear chat / Export chat / Block. Mute bell-off pip on header avatar. |
| Block / Unblock (1-on-1) | ✅ wired | ✅ `BlocksModule` | `POST /users/:id/block` + `DELETE /users/:id/block` (idempotent, JWT-guarded). `BlocksService.isBlockedEitherWay` rejects sends both directions with 403 `peer_blocked`. State on `UserProfileCard.isBlocked` drives destructive-footer label (optimistic toggle + revert). |
| Mute chat | ✅ wired | ✅ | `PATCH /chats/:id/mute` body `{ until: ISO\|null }` (null = unmute). Presets 8h/1w/Always. Push worker (Phase E) reads `ChatMember.mutedUntil` to skip muted memberships. |
| Clear chat | ✅ wired | ✅ | `PATCH /chats/:id/clear` writes `ChatMember.clearedAt = NOW()`. Per-user only — counterpart still sees history. `GET /chats/:id/messages` filters `createdAt > clearedAt`. |
| Polls (1-on-1) | ✅ (2.F-front) | ✅ (2.F-back) | Paperclip → Poll tile → compose-poll modal (question + 2–10 options + multi-select switch) → `PollBubble` (radio/checkbox + count + fill bar; disabled when closed) → action-sheet "Close poll" for own polls. Optimistic vote (single-replace vs multi-diff matches server); mock parity ✓. Backend: `PollsModule` (4 endpoints), Migration B (`poll_messages`/`poll_options`/`poll_votes`), `pg_advisory_xact_lock(pollMessageId)` for race-safe voting, per-viewer `poll:voted` via `user:{userId}` room. |
| Voice/Video calls (signalling backend) | 🚫 queued (2.I) | ✅ (2.H-back, PR-1 stub) | `CallsModule`: `POST /calls/token` (initiator + ring), `POST /calls/:id/accept` under `pg_advisory_xact_lock(callId)` for first-accept-wins (409 `call_already_accepted` for losers), `POST /calls/:id/decline`, `POST /calls/:id/hangup`, `POST /calls/webhooks/100ms` (HMAC-SHA256-signed), `GET /chats/:chatId/calls`. BullMQ 30s ring-timeout (jobId=callId, survives Fly blue-green per BRD R5). `CallSession` table + `call_event_message_id` UNIQUE back-ref. **PR-1 stub**: `HmsClient.createRoom` synthetic; real 100ms HTTP + HMAC verify in PR-2 (gated on `docs/architecture/calls-provider-poc.md` §6). |
| Super Groups | 🚫 | 🚫 | After 1-on-1 |

## Chat backend (REST shape today)

| Endpoint | Purpose |
|---|---|
| `GET /chats` | Contact-page list |
| `POST /chats/one-on-one` | Create-or-return 1-on-1 chat (advisory-locked on user-pair) |
| `GET /chats/:chatId` | Full thread detail (counterpart, lastReadSequence) |
| `GET /chats/:chatId/messages?cursor=&limit=` | Paginated message history |
| `POST /chats/:chatId/messages` | Send. Idempotent on `(senderUserId, clientMessageId)` |
| `PATCH /chats/:id/read` | Bump `lastReadSequence` (monotonic) |
| `PATCH /chats/read-all` | Mark every membership read |
| `PATCH /chats/:id/favourite`, `/archive` | Toggles |
| `DELETE /chats/:id/messages/:msgId?scope=everyone` | Soft-delete. Sender-only, 60-min edit window; broadcasts `message:deleted` |
| `POST /media/upload-url` | Mint 5-min presigned R2 PUT. Body `{ kind: 'IMAGE'\|'VOICE', contentType, sizeBytes }`; caps 10 MB image / 5 MB voice. Returns `{ objectKey, uploadUrl, publicUrl, expiresAt }`. Rate-limited 30/min/user; 503 if `R2_*` unset. |
| `POST /messages/:messageId/report` | File moderation report. Body `{ reason: ReportReason, note? }`. JWT-guarded, member-gated. 400 `cannot_report_self`, 409 `already_reported`. |
| `GET /users/:id/profile-card` | Privacy-filtered `UserProfileCard`. 403 `profile_not_visible` unless shared chat or saved contact. |
| `GET /chats/:chatId/media?kind=IMAGE\|VOICE&cursor=&limit=&direction=` | Per-chat media gallery; filters tombstones; limit clamped to 60. |
| `GET /chats/:chatId/messages/search?q=&cursor=&limit=` | **Profile v2 P2.** In-chat search (case-insensitive `contains`). Member-gated (403 `not_a_member`); excludes tombstones + pre-`clearedAt`; 400 on empty/over-100-char `q`. Returns `{ items: MessageSearchHit[], meta }`. |
| `GET /chats/:chatId/storage` | **Profile v2 P2.** Per-chat storage summary by kind, heaviest-first. Member-gated. |
| `PATCH /chats/:chatId/theme` | **Profile v2 P2.** Set/reset caller's theme. Body `{ theme: 'default'\|'midnight'\|'forest'\|'sunset'\|null }`. Member-scoped (404 `chat_not_found`), 400 `unknown_theme`. Per-user. |
| `GET /contacts/:contactUserId/common-groups` | Shared GROUP/SUPER_GROUP chats. Returns `{ items: [] }` until groups ship. |
| `POST /chats/:chatId/polls` | Create poll. Body `{ clientMessageId, question, options[2..10], multiSelect?, anonymous? }`. Server-authored POLL; idempotent on `clientMessageId`. Returns `MessageDto`. |
| `POST /messages/:messageId/vote` | Cast/change vote. Body `{ optionIds[1..10] }` (full post-vote set; server diffs). 409 `poll_closed`, 403 `not_a_member`, 400 `unknown_option` / `single_select_violation`. Returns `PollAggregate`. |
| `GET /messages/:messageId/poll` | Fetch personalised `PollAggregate`. 403 `not_a_member`, 404 `not_a_poll`. |
| `POST /messages/:messageId/poll/close` | Close poll. Sender-only (403 `not_sender`); idempotent. Emits `poll:voted` with `closedAt`. |
| `POST /calls/token` | Mint 100ms token + ring callee. Body `{ chatId, kind: 'VOICE'\|'VIDEO' }`. 403 `not_a_member`, 403 `peer_blocked` (Tranche 2.H). Returns `{ callId, hmsRoomId, hmsToken, expiresAt }`. Schedules 30s BullMQ ring-timeout. |
| `POST /calls/:callId/accept` | Accept under `pg_advisory_xact_lock(callId)` (first-accept-wins). 409 `call_already_accepted`. Emits `call:accepted` + `call:taken`. |
| `POST /calls/:callId/decline` | Decline. 409 `call_not_ringing`. Inserts CALL_EVENT; emits `call:ended { reason: 'declined' }`. |
| `POST /calls/:callId/hangup` | Hangup after ACCEPTED. 409 `call_not_active`. Persists `durationSec`, inserts CALL_EVENT, disables room, emits `call:ended { reason: 'hangup', durationSec }`. |
| `POST /calls/webhooks/100ms` | 100ms webhook. HMAC-SHA256-signed (`x-hms-signature`). PR-1 stub 403s all; real verify + `durationSec` sync in PR-2. |
| `GET /chats/:chatId/calls` | Per-chat call history (DESC). 403 `not_a_member`. Returns `{ items: CallSummary[] }`. |

### Chat Socket.IO gateway (`/chat` namespace)

| Event | Direction | Purpose |
|---|---|---|
| `message:send` | C→S | Send message (incl. `replyToMessageId`); persists with idempotent advisory-locked sequence; acks durable `MessageDto` |
| `message:new` | S→C | Broadcast on `chat:{chatId}` room when a message lands (socket OR REST) |
| `message:deleted` | S→C | Broadcast on tombstone — clients flip cached row to "This message was deleted" |
| `session:resume` | C→S | "Catch me up since `lastSeenSequence`" — replies with missed messages in order |
| `chat:read` | S→C | A peer's `lastReadSequence` advanced (REST mark-read triggers this) |
| `typing:ping` | C→S | Client emits while typing (at most every 2.5s); server stores `typing:{chatId}:{userId}` with 5s TTL and re-broadcasts |
| `typing:update` | S→C | Peer is typing — client expires after 4.5s without a refresh |
| `presence:request` | C→S | Bootstrap: returns `{ isOnline, lastSeenAt }` for given userIds and subscribes caller to future updates |
| `presence:update` | S→C | A user's presence changed (connect ↔ disconnect edge) |
| `poll:voted` | S→C | Tranche 2.F. Personalised per viewer (`options[].votedByMe` per-recipient); emitted on poll create/vote/close via `user:{userId}` room (reused by 2.H) |
| `call:ring` | S→C | Tranche 2.H. Fans out on callee's `user:{calleeUserId}` room (ALL devices). Payload `{ callId, chatId, hmsRoomId, kind, initiator, ringExpiresAt }`; IncomingCallScreen counts down to `ringExpiresAt` |
| `call:accepted` | S→C | Tranche 2.H. Emitted to both peers' `user:{userId}` rooms; initiator transitions Incoming→CallScreen, accepting device navigates to CallScreen |
| `call:ended` | S→C | Tranche 2.H. Emitted to both peers on every terminal transition (missed/declined/hangup/webhook); carries `reason` + `durationSec` (null for missed/declined) |
| `call:taken` | S→C | Tranche 2.H. Fans out on callee's `user:{calleeUserId}` room after accept commits — other devices dismiss Incoming (accepting device self-ignores) |

Connection: `io(${API_URL}/chat, { auth: { token: <jwt> } })`. JWT verified in `handleConnection`; user auto-joins `chat:{chatId}` rooms for every active membership. Horizontal scaling via Upstash Redis adapter. Mobile picks mock vs real via `EXPO_PUBLIC_USE_MOCKS` (mock default in `__DEV__`); both satisfy `ChatRepository`, real impl keeps an in-memory message cache fed by socket events.

### Media wire-format additions

`MessageDto` adds three fields for `IMAGE`/`VOICE`:

- `mediaUrl: string | null` — public R2 CDN URL from `mediaObjectKey`; null on TEXT/SYSTEM/deleted.
- `imageWidth` / `imageHeight: number | null` — IMAGE only; drive aspect-ratio reservation so layout doesn't shift on load.

Send payloads:
- IMAGE: `{ kind: 'IMAGE', mediaObjectKey, imageWidth, imageHeight }`
- VOICE: `{ kind: 'VOICE', mediaObjectKey, durationSec, waveform }`

Server validates `mediaObjectKey` carries the sender's user-id prefix before persisting (stops a client pasting an arbitrary key).
