# Progress — 1-on-1 Chat Production Parity

| | |
|---|---|
| **Owner** | Surya (founder) |
| **Slice** | 1-on-1 — production parity (BRD §3.2–§3.8 + WhatsApp parity) |
| **Status** | Tranche 1.A landed 2026-05-25: F1 fixed, F2-F4 fixed, Phase C fully wired (incl. profile-side Block/Unblock + `UserProfileCard.isBlocked`), cold-start read receipts plumbed end-to-end. Phase D (Star / Reactions / Edit) deferred to Tranche 1.B. |
| **Last updated** | 2026-05-25 |
| **Design source** | Figma `JYhOHnaEDgGYNxJShD9WDK`, page `0:1`, frame **"Chat Page"** (`1:2972`) + sub-frames |
| **BRD** | [`docs/brd/1-on-1.md`](../brd/1-on-1.md) |
| **Plan** | `C:\Users\amogh\.claude\plans\understand-the-codebase-and-shimmering-hejlsberg.md` |

---

## Overview

After the Contact Page slice (`contact-page.md`) shipped the chat-list home with live API + multi-select + custom filters, the 1-on-1 thread itself still had several BRD §3 surfaces stubbed (call buttons dead, Contact Profile screen missing, per-message Report absent, per-chat options sheet missing). It also had WhatsApp-parity gaps (reactions, forward, star, search, block, mute) and missing production infra (push, R2 orphan cleanup, edit message, stickers).

This slice closes those gaps in six phases:

- **Phase A** — BRD §3.2 in-thread gaps (Coming-Soon sheet, Report, Select mode, read-receipt audit, voice progressive load)
- **Phase B** — Contact Profile screen (BRD §3.3/§3.4)
- **Phase C** — Per-chat options sheet (BRD §3.6) + Block + Mute
- **Phase D** — Reactions / Forward / Star / In-thread search / Edit / Stickers
- **Phase E** — Push notifications + R2 orphan cleanup worker (`apps/worker/`)
- **Phase F** — Doc sync + light-mode + perf verification

This doc tracks what landed in each phase. Per `my-app/CLAUDE.md` §7, every behavior-changing commit in this slice also updates root `CLAUDE.md` §10.

---

## Phase A — BRD §3.2 in-thread gaps

### Status table

| Sub-item | Frontend | Backend | Notes |
|---|---|---|---|
| **A.1** ComingSoonSheet component | ✅ | n/a | Reusable modal; lime CTA; mirrors action-sheet shell + Brand tokens |
| **A.2** Wire call buttons → Coming-Soon | ✅ | n/a | Voice & video taps now open ComingSoonSheet with BRD §4.19 copy ("free for everyone") |
| **A.3** Per-message Report on counterpart bubble | ✅ | ✅ new Reports module + Prisma model | Full vertical slice; uniqueness on `(messageId, reporterUserId, reason)` |
| **A.4** In-thread Select mode | 🚧 deferred to Phase D | n/a (reuses existing delete endpoint) | Depends on Phase D.2 Forward + D.3 Star bulk actions to be useful |
| **A.5** Read-receipt flow audit + fix | ✅ live path wired | n/a | Cold-start initial state still rests on `delivered`; flip-on-interaction works |
| **A.6** Voice bubble progressive load | ✅ | n/a | `ActivityIndicator` in the play button while `expo-audio` reports `isLoaded === false` |

### Files touched (Phase A.1, A.2, A.5, A.6)

**Frontend (`my-app/`)**

- `src/features/chat/components/coming-soon-sheet.tsx` — NEW. Reusable modal: icon + title + body + optional footnote + lime "Got it" CTA. Will also be used by Phase B (call CTAs on Contact Profile), Phase C (Chat Theme + Export Chat options).
- `src/features/chat/copy.ts` — added `ChatCopy.comingSoon.{voiceCall,videoCall,chatTheme,exportChat}` with title/body/optional footnote keys. Calls footnote explicitly says "free for everyone — not behind any premium plan" per BRD §4.19.
- `src/app/chat/[id].tsx` — added `comingSoonKey` state; passes `onVoiceCall` / `onVideoCall` handlers to `ChatHeader` so the lime header buttons now do something. Imports + renders `ComingSoonSheet`.
- `src/features/chat/data/api-chat-repository.ts` — wired `chatSocket.onReadReceipt` inside `ensureSocketWired()`. When the **peer**'s `lastReadSequence` advances (filtered: `userId === counterpartByChatId.get(chatId)`), every cached message of mine with `sequence ≤ uptoSequence` flips to `status: 'read'` so the bubble's lime double-tick lights up live. Self-reads (my own other devices) and group-member reads (future) are ignored.
- `src/features/chat/components/voice-player.tsx` — `ActivityIndicator` rendered in the circular play button while `useAudioPlayerStatus.isLoaded === false`. Bubble no longer looks unresponsive on the first play over slow Indian connections.

**Backend (`apps/api/`)**

- None touched in this push. The `chat:read` socket broadcast was already wired correctly in `messages.gateway.ts:341`; the gap was purely on the client side (api-chat-repository never subscribed).

### API endpoints touched / added (Phase A so far)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/messages/:messageId/report` | **New.** Body `{ reason: ReportReason, note?: string }`. JWT-guarded; verifies the reporter is a chat member; 400 `cannot_report_self`; 409 `already_reported` (unique `(messageId, reporterUserId, reason)`); never broadcasts. Returns `{ id, status: 'OPEN' }`. |

### Files touched (Phase A.3 — added)

**Database**

- `apps/api/prisma/schema.prisma` — added `MessageReport` model + `ReportReason` enum + `ReportStatus` enum; back-ref on `User.reportsFiled` and `Message.reports`.
- `apps/api/prisma/migrations/20260525090000_add_message_report/migration.sql` — NEW. Manually authored (Postgres wasn't reachable for `migrate dev --create-only`). Apply with `npm --workspace=apps/api run prisma:migrate` against a running DB.

**Shared (`packages/shared/`)**

- `src/schemas/reports.ts` — NEW. `ReportReasonEnum`, `CreateMessageReportSchema` (body), `MessageReportAckSchema` (response).
- `src/schemas/index.ts` — re-export `reports.js`.

**Backend (`apps/api/`)**

- `src/modules/reports/reports.service.ts` — NEW. Look up the message → assert reporter is a chat member → reject self-reports (400) → create row; maps Prisma `P2002` (unique violation) to 409 `already_reported`. Never returns reporter info in the ack.
- `src/modules/reports/reports.controller.ts` — NEW. `@Controller('messages')` + `@Post(':messageId/report')` with `ZodValidationPipe(CreateMessageReportSchema)`.
- `src/modules/reports/reports.module.ts` — NEW. Plain module; no special exports.
- `src/app.module.ts` — registered `ReportsModule`.

**Frontend (`my-app/`)**

- `src/features/chat/data/chat-repository.ts` — `reportMessage(input)` added to the `ChatRepository` interface as an optional method; imports `ReportReason` from `@scalechat/shared`.
- `src/features/chat/data/api-chat-repository.ts` — implements `reportMessage` via `apiClient.post('/messages/:id/report', body)`.
- `src/features/chat/data/mock-chat-repository.ts` — mock implementation: `await sleep()` no-op so the mock UI flow still shows the success state.
- `src/features/chat/hooks/use-thread.ts` — exposes `reportMessage(messageId, reason, note?)` to the screen.
- `src/features/chat/components/message-action-sheet.tsx` — added optional `onReport` prop; renders a destructive "Report" row when `!isMine && !isTombstone && onReport`.
- `src/features/chat/components/message-report-sheet.tsx` — NEW. Picker modal: title + body explaining the report is private + 5 reason rows (Spam / Harassment / Inappropriate content / Impersonation / Something else) + cancel. Transitions through `pick → submitting → done | error`. Maps the 409 `already_reported` code to a clear copy in the error state.
- `src/app/chat/[id].tsx` — added `reportTarget` state; wires the action sheet's `onReport` → opens `MessageReportSheet` → submit calls `reportMessage`.

### How to verify (Phase A so far)

```
npm run db:setup                                # one-shot: docker up, apply migrations, regen Prisma client, rebuild shared
npm run api:dev                                 # NestJS on :4000
cd my-app && npx expo start --dev-client       # Metro on :8081
```

The Phase A.3 Report endpoint needs the `20260525090000_add_message_report` migration applied — `npm run db:setup` does that idempotently. Pass `--dry-run` to walk through the steps without executing, or `--no-docker` if your Postgres + Redis live outside Docker.

On `emulator-5554` (sign in with `+91…` + dev OTP `1234`), open any 1-on-1 chat:

1. **Coming-Soon (calls):** tap the lime video button in the header → "Video calls launching soon" sheet with the footnote "free for everyone — not behind any premium plan". Tap the phone button → same shape with voice copy. Dismiss with "Got it".
2. **Read receipts:** send a text from device A to device B. On device A the bubble shows the grey double-tick (`delivered`). Open the chat on device B → device A's bubble flips to lime double-tick within ~1s. Send 3 more messages from A, mark-read on B → all four flip. Killing the socket on A (toggle airplane mode briefly), having B read, restoring the socket → on reconnect the `session:resume` catches missed `message:new`s but receipts that fired while disconnected are NOT replayed; the bubbles will catch up on B's next mark-read.
3. **Voice progressive load:** send a voice note from A to B. On B, the bubble shows a spinner in the play button until the m4a streams from R2; then the play arrow appears. Hot-reload to force a re-mount → spinner visible again briefly.
4. **Report a counterpart's message:** long-press a bubble that's NOT yours → action sheet shows a red "Report" row alongside Reply/Copy. Tap it → reason picker appears. Tap "Spam" → success screen "Report received". API logs show `POST /messages/<uuid>/report 200`. Tap "Report → Spam" again on the same bubble → error screen "You have already reported this message for that reason." (409). Long-press a MINE bubble → no Report row visible.
5. **Self-learning doc loop:** this file + root CLAUDE.md §10 updated in the same commit.

### Known limitations (Phase A)

1. **Cold-start read state is stale.** When you open a thread the first time, every message of yours that the peer has already read shows up as `delivered` (grey) instead of `read` (lime) until either you send a new message or the peer touches the chat. Root cause: `ChatDetailSchema` doesn't include `counterpartLastReadSequence`. Proper fix requires:
   - Adding `counterpartLastReadSequence: string | null` to `packages/shared/src/schemas/messages.ts` `ChatDetailSchema`
   - Loading the counterpart's `ChatMember.lastReadSequence` in `MessagesService.getChat` (apps/api)
   - Using it in mobile `dtoToMessage` / `listMessages` to flip rows on initial load
   - Filed as a follow-up; live-flow fix lands now since it's the more visible bug.

2. **Phase A.3 (Report) and A.4 (Select mode) are deferred to the next push** in this same slice. Report needs a new `MessageReport` Prisma model + a `reports` NestJS module + a small reason-picker UI. Select mode benefits from waiting until Phase D.2 (Forward) and D.3 (Star) so the bulk-action bar has real actions to dispatch.

### Next-developer pickup notes

1. **ComingSoonSheet is reusable.** Phase B's Voice/Video call CTAs on the Contact Profile and Phase C's "Chat Theme" / "Export Chat" rows in the options sheet should call into it with the existing `ChatCopy.comingSoon.{key}` payloads. Don't duplicate the modal.
2. **Read-receipt filter is intentional.** Only `userId === counterpartByChatId.get(chatId)` flips bubbles. When 1-on-1 grows into group/super-group rooms, this needs to be revisited — a multi-member room has more than one reader, and "delivered to all" / "read by all" semantics differ.
3. **`status: 'read'` mutation skips already-`read` rows** so the cache iteration is cheap even with thousands of cached messages.

---

## Phase B — Contact Profile screen ✅ shipped (F1 fixed 2026-05-25)

> **2026-05-25 verify result: PASS (post-fix).** The CONVERSATION section now stays reachable across cold-start, scroll cycles, and warm re-entry (router.back() + re-tap avatar). See [Tranche 1.A — F1 fix verify — 2026-05-25](#tranche-1a--f1-fix-verify--2026-05-25) below.

**Scope:** BRD §3.3 (unsubscribed) + §3.4 (subscribed/premium). Tap the chat header avatar → push to `/contact/<counterpartUserId>` with hero, call CTAs, options list, contact details, common groups (empty for now), premium gating, and a media-gallery sub-route.

### Status table

| Surface | Frontend | Backend | Notes |
|---|---|---|---|
| Hero (avatar / name / phone / bio) | ✅ | ✅ `GET /users/:id/profile-card` | Privacy: 403 unless viewer shares a chat OR has target saved as a contact |
| Voice / Video CTAs → Coming-Soon | ✅ | n/a | Reuses `ComingSoonSheet` + `ChatCopy.comingSoon.{voice,video}Call` |
| Options list (Media, Theme, Encryption) | ✅ | ✅ media uses `/chats/:id/media` | Theme + Encryption open `ComingSoonSheet` |
| Contact details (phone, joined-on) | ✅ | ✅ baked into profile-card DTO | `createdAt` formatted as "Mon YYYY" via `Intl.DateTimeFormat('en-IN')` |
| Common Groups | ✅ empty-state | ✅ `GET /contacts/:contactUserId/common-groups` | Server returns real GROUP / SUPER_GROUP intersections; empty until groups ship |
| Premium-only "Add to Super Group" | ✅ gated on `useAuth().currentUser.isPremium` | n/a | Hidden when `isPremium === false` (BRD §3.4) |
| Destructive footer (Block, Report) | ✅ visible | 🚧 Block lands Phase C; Report links to per-message flow | Tap shows the "Coming Soon" hint inline |
| Media gallery sub-route | ✅ `/contact/[id]/media` | ✅ `GET /chats/:id/media?kind=IMAGE\|VOICE&cursor=` | Two-tab layout (Media grid / Voice notes list), filters tombstones |

### API endpoints added (Phase B)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/users/:id/profile-card` | Privacy-filtered public profile of another user. 403 `profile_not_visible` if viewer doesn't share a chat AND has no Contact row pointing at target. Returns `{ id, fullName, phoneE164, avatarUri, bio, isPremium, createdAt, commonChatId }`. |
| `GET` | `/chats/:chatId/media?kind=IMAGE\|VOICE&cursor=&limit=&direction=` | Per-chat gallery for the profile screen. Filters tombstones; reuses message cursor scheme; limit clamped to 60. |
| `GET` | `/contacts/:contactUserId/common-groups` | GROUP / SUPER_GROUP chats both users are active in. Returns `{ items: [] }` until groups ship. |

### Files touched (Phase B)

**Database / shared**

- `packages/shared/src/schemas/profile-card.ts` — NEW. `UserProfileCardSchema`, `CommonGroupRowSchema`, `CommonGroupsListResponseSchema`.
- `packages/shared/src/schemas/messages.ts` — added `ChatMediaListQuerySchema` (kind + cursor + limit + direction).
- `packages/shared/src/schemas/index.ts` — re-export `profile-card.js`.
- No Prisma schema change (Phase B reuses existing tables).

**Backend (`apps/api/`)**

- `src/modules/users/users.controller.ts` — added `OtherUsersController` mounted at `/users` (separate from the existing `/me`). One route: `GET :id/profile-card`.
- `src/modules/users/users.module.ts` — register the new controller.
- `src/modules/users/users.service.ts` — added `getProfileCard(viewerUserId, targetUserId)`. Pulls the target user, the shared 1-on-1 chat (if any), and the Contact row in parallel; 403 if none exists; 200 + `commonChatId` otherwise. New `toProfileCard` shaping helper.
- `src/modules/messages/messages.controller.ts` — added `@Get('media')` mounted under `/chats/:chatId/media`.
- `src/modules/messages/messages.service.ts` — added `listMedia` reusing the existing cursor pattern; filters `deletedAt: null` + `kind in [IMAGE, VOICE]`.
- `src/modules/contacts/contacts.controller.ts` — added `@Get(':contactUserId/common-groups')`.
- `src/modules/contacts/contacts.service.ts` — added `listCommonGroups`. Filters by `kind in [GROUP, SUPER_GROUP]` and active membership on both sides.

**Frontend (`my-app/`)**

- `src/app/_layout.tsx` — registered the new `contact` stack alongside `chat`.
- `src/app/contact/_layout.tsx` — NEW. Stack, headerShown:false, slide-from-right.
- `src/app/contact/[id].tsx` — NEW. Main profile screen. Loads `/users/:id/profile-card`, renders hero + call CTAs + sections (Conversation / Contact details / Groups in common / Premium options / Destructive footer). Handles 403 with an empty state instead of a fake card. Premium-gated via `useAuth().currentUser.isPremium`.
- `src/app/contact/[id]/media.tsx` — NEW. Two-tab gallery — `Media` (3-col image grid via `expo-image`) and `Voice notes` (list of bubbles with duration + date). Reads `chatRepository.listMedia({ kind })`.
- `src/app/chat/[id].tsx` — wired `ChatHeader.onOpenProfile` → `router.push('/contact/<counterpartUserId>')`.
- `src/features/chat/data/chat-repository.ts` — `getProfileCard`, `listMedia`, `getCommonGroups` added to `ChatRepository` interface.
- `src/features/chat/data/api-chat-repository.ts` — implementations: `apiClient.get` for the three new endpoints; `listMedia` maps `MessageDto[]` → domain `Message[]` via the existing `dtoToMessage`.
- `src/features/chat/data/mock-chat-repository.ts` — mock impls so dev mode still works offline: synthesises a card from the contact seed; media filters from the existing thread store; common-groups returns `[]`.
- `.expo/types/router.d.ts` — manually added `/contact/[id]` and `/contact/[id]/media` to the typed-routes union as a temporary bridge. Metro regenerates this file on next start so the edit washes away cleanly.

### How to verify (Phase B)

```
npm run db:setup        # one-shot stack bootstrap
npm run api:dev         # NestJS on :4000 — three new endpoints are mounted
cd my-app && npx expo start --dev-client
```

On `emulator-5554`:

1. **Header avatar tap:** open any 1-on-1 chat → tap the avatar in the gradient header → routes to `/contact/<id>`. Profile screen renders with the counterpart's avatar, name, formatted `+91` phone, and the date they joined.
2. **Call CTAs:** tap Voice Call → "Voice calls launching soon" sheet with the free-for-everyone footnote. Same for Video Call.
3. **Encryption notice:** tap the Encryption row → modal explaining TLS in transit + "E2E ships in a later release".
4. **Media gallery:** tap "Media, Links & Docs" → 3-column grid of every IMAGE message in the chat. If empty, the empty-state icon + copy appears. Switch to "Voice notes" tab → list of voice messages with duration + date. (Note: tap-to-jump back to the message lands with Phase D.4 in-thread search.)
5. **Common groups:** "No groups in common yet" — will populate once Group chats ship.
6. **Premium gate:** by default `currentUser.isPremium === false` so the "Premium options" section is hidden. Toggle a dev override (manual `prisma` row update) to true → the section appears with "Add to Super Group".
7. **Privacy boundary:** sign in as a third user who shares no chat with the counterpart, navigate to `/contact/<theirUserId>` directly → screen shows "Profile unavailable — you can only view profiles of people you share a chat with."
8. **Open chat shortcut:** when arriving from a chat, the `message-circle` icon in the hero top-right swaps the route to the chat thread (`router.replace`), so the back-stack stays clean.

### Known limitations (Phase B)

1. **Media-gallery tap doesn't deep-link to the message yet.** That requires the FlatList `scrollToItem(messageId)` infrastructure that Phase D.4 (in-thread search) builds. Logged as a TODO comment in `media.tsx`.
2. **"Block" / "Report contact" buttons are visible but stubbed.** They open the same Coming-Soon hint until Phase C wires the block endpoint. Per-message Report (Phase A.3) is already live — the user-level report is a separate moderation surface.
3. **Pagination on the media gallery isn't wired.** The screen loads the first page (30 items) and stops. Most 1-on-1 chats hit far below this cap; if it becomes a problem we add `loadOlder` mirroring the chat thread pattern.

### Phase B emulator verification — 2026-05-25

Verifier: Claude (Opus 4.7), driving `emulator-5554` via `adb` + `uiautomator dump`. Account: `mokshith` (`+919000125356`). Counterpart `Priya Test` (`+919000000002`, seed-uuid `b2b2b2b2-…0002`) was inserted directly into `users` along with a `contacts` row mokshith → Priya so the user appears in `/new-chat` search. (`AskUserQuestion` was used to authorize the seed in lieu of going through the OTP signup pipeline.)

Screenshots stored under [`screenshots/1-on-1-production/`](./screenshots/1-on-1-production/) — each finding cites the file.

**Verdict: FAIL** — one ship-blocker layout bug. Surfaces individually pass when reachable, but the bug makes Phase B.3 / B.4 / Chat Theme entry points **unreachable on warm re-entry**.

| # | Surface | Result | Screenshot | Notes |
|---|---|---|---|---|
| B.1 | Header avatar tap → `/contact/[id]` | ✅ PASS | `10-profile-hero.png` | Identity Pressable bounds `[196,158][971,340]`. Hero renders with avatar, name, "+91 90000 00002", "Designer · Bangalore", and two lime call CTAs. First tap after the voice ComingSoonSheet was swallowed — finding F1 below. |
| B.2 | Voice / Video CTAs → Coming-Soon sheet | ✅ PASS (from chat header) | `08-voice-coming-soon.png`, `09-voice-coming-soon.png` | Tested via chat-thread header buttons rather than profile-hero CTAs (same sheet component). Copy matches BRD §4.19 incl. "Calls will be free for everyone — not behind any premium plan." |
| B.3 | Encryption row → modal | ✅ PASS (cold start only) | `22-encryption-modal.png`, `23-encryption-modal.png` | "Messages secured in transit" + TLS body + "E2E ships in a later release." See finding F1 — unreachable on warm re-entry. |
| B.4 | "Media, Links & Docs" → `/contact/[id]/media` | ⚠️ PARTIAL | `24-media-gallery.png`, `25-voice-notes-tab.png` | Gallery + tab switcher work; empty states render correctly. **But:** header says "Media, Links & Docs", tabs are only "Media" / "Voice notes" — Links/Docs not shipped. Either rename the entry point or ship the two missing tabs. Also unreachable on warm re-entry (finding F1). |
| B.5 | Common Groups empty state | ✅ PASS | `12-profile-scrolled.png` | "GROUPS IN COMMON" header + "No groups in common yet" body. `GET /contacts/:contactUserId/common-groups` returns `{ items: [] }` as expected. |
| B.6 | Premium gate hides "Add to Super Group" | ✅ PASS | `12-profile-scrolled.png` | mokshith.isPremium = false → Premium options section absent. Not toggle-tested with `isPremium=true` in this run; recommend a follow-up flip via `UPDATE users SET "isPremium"=true WHERE id='…'` to confirm the section materialises. |
| B.7 | Privacy boundary (third user with no shared chat → 403) | 🚫 NOT VERIFIED | — | Skipped through UI to keep scope contained. Recommended follow-up: seed a third user, mint a JWT, `curl /users/<mokshith-id>/profile-card` from that user → expect 403 `profile_not_visible`. The endpoint logic is in `users.service.ts:getProfileCard` and looks correct on inspection. |
| B.8 | Top-right open-chat shortcut | 🚫 NOT VERIFIED | — | The `message-circle` icon is rendered (screenshots `10`, `13`, `14`, `16`, `17`) but I didn't tap it this run. The wiring (`handleOpenChat` → `router.replace('/chat/[id]')`) is in `contact/[id]/index.tsx:101`. |

#### Findings

⚠️ **F1 — SHIP BLOCKER: CONVERSATION section becomes invisible / un-tappable after first interaction on the Contact Profile screen.**
On cold-start (`am force-stop` then re-launch + first tap into profile), the section renders correctly with Media / Chat Theme / Encryption rows tappable. After **any** subsequent navigation back into the screen — even after `router.back()` + re-tap of the header avatar — the section is in the UI tree (`uiautomator dump` confirms `text="CONVERSATION"`, `text="Encryption"`, `text="In transit"`, etc.) but is laid out with **negative height**, so it visually collapses and overlays the area immediately under the hero. CONTACT DETAILS becomes the first visible section.

Bounds dump for the four affected rows (warm-state, `screenshots/.../16-profile-fresh.png`):

```
CONVERSATION:        [56,1348][1384, 704]   ← bottom(704)  < top(1348)
Media, Links & Docs: [238,1348][1054, 837]
Chat Theme:          [238,1348][1007,1020]
Encryption:          [238,1348][ 973,1203]
CONTACT DETAILS:     [56,1348][1384,1442]   ← first row with positive height
```

Reproduces 100% on `emulator-5554` (Pixel-class 1440×3120, density 560). Open profile → scroll down → scroll up → CONVERSATION gone. Even leaving via `router.back()` and re-entering shows the bug; only `am force-stop` + cold start clears it.

Impact: Users cannot reach Encryption details, the Chat Theme picker, or the Media gallery via the profile screen on any *return* visit. First-time UX is fine.

Probable cause: ScrollView contentSize miscalculation on re-mount under React Native 0.85 + react-native-screens + react-native-safe-area-context. Worth bisecting:
  1. Try replacing `<ScrollView style={{ flex: 1 }}>` with `<ScrollView contentContainerStyle={{ flexGrow: 1 }}>`.
  2. Or move the hero into `ListHeaderComponent` of a `FlatList`/`SectionList` instead of a sibling-of-ScrollView layout.
  3. Or wrap the sections in a single non-flex `<View>` to give the ScrollView a definite content height.

Code location: `my-app/src/app/contact/[id]/index.tsx:150-205` (hero + ScrollView layout).

🔍 **F2 — UX leakage: destructive footer caption "Coming in Phase C".** The "Block contact" row's hint reads literally `"Coming in Phase C"` — an internal slice label visible to users. Swap to "Available soon" or similar before any external build. Location: `contact/[id]/index.tsx` (search for `Coming in Phase C`).

🔍 **F3 — Copy mismatch on media gallery.** Profile entry-point label is "Media, Links & Docs" but the gallery screen only has Media / Voice notes tabs. Either:
  - rename profile entry to "Media & Voice", or
  - ship Links + Docs tabs (mirror Media's empty-state pattern).

🔍 **F4 — UX nit: empty header subline on first-contact thread.** When you open a chat with a counterpart who has never been online (`lastSeenAt = null`), the chat header shows only the name with no subline. Consider a "available on ScaleChat" or hide the gap entirely so the layout doesn't shift the moment the first presence event lands. Repro: any brand-new contact. (Captured in `07-thread-loaded.png`.)

🔍 **F5 — Modal-dismiss can swallow the next tap.** After dismissing the voice ComingSoonSheet with "Got it", the very next tap on the header avatar did nothing; the second identical tap routed to the profile screen. Likely a fade-out animation still consuming events. Captured between screenshots `09` and `10`. Low priority — but if you instrument with `console.log` on `onOpenProfile`, you'll see only the second tap fires.

#### Surfaces NOT exercised this run

- Phase A.3 — per-message Report flow (counterpart bubble long-press → action sheet → reason picker → 409 already_reported re-tap). Requires an *incoming* message from Priya which would need either a second emulator or another DB insert into `messages`.
- Phase A.5 — read-receipt lime flip on peer mark-read (requires Priya client).
- Phase A.6 — voice progressive-load spinner (requires sending + re-loading a voice note).
- Phase B.7 — 403 privacy boundary (requires a third synthetic user with a JWT).
- Phase B.8 — open-chat shortcut tap.

These are next-session items; the F1 bug should be fixed first so the rest can be exercised cleanly.

#### Seed used for this run

Idempotent — safe to re-run.

```sql
INSERT INTO users (id, "phoneE164", "fullName", bio, "isPremium", "createdAt", "updatedAt")
VALUES ('b2b2b2b2-0000-4000-8000-000000000002', '+919000000002', 'Priya Test',  'Designer · Bangalore', false, NOW(), NOW()),
       ('c3c3c3c3-0000-4000-8000-000000000003', '+919000000003', 'Rahul Stranger', 'Trekker · Manali',  false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO contacts (id, "ownerUserId", "contactUserId", "phoneE164", "displayName", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '<mokshith-userId>', 'b2b2b2b2-0000-4000-8000-000000000002', '+919000000002', 'Priya Test', NOW(), NOW())
ON CONFLICT ("ownerUserId", "phoneE164") DO NOTHING;
```

---

## Tranche 1.A — F1 fix verify — 2026-05-25

Driver: Claude (Opus 4.7) on `emulator-5554`. Verifies the F1 ship-blocker is gone and that F2-F4 nits + Phase C profile wiring landed cleanly. Screenshots in `screenshots/1-on-1-production/26`–`36`.

| # | Check | Result | Screenshot | Bounds dump |
|---|---|---|---|---|
| F1 cold-start | Tap header avatar → CONVERSATION + Media & Voice / Chat Theme / Encryption rows visible | ✅ PASS | `32-after-fix2.png` | `CONVERSATION: [56,1432][1384,1537]` — positive height (was `[56,1348][1384,704]`) |
| F1 scroll cycle | Scroll down → scroll up → CONVERSATION still visible | ✅ PASS | `33-after-scroll-cycle.png` | n/a |
| F1 warm re-entry | `router.back()` to chat → re-tap avatar → CONVERSATION still visible & tappable | ✅ PASS | `34-warm-reentry.png` | `Encryption: [56,1903][1384,2086]` — positive height (was `[56,1348][1384,1203]`) |
| F1 modal trigger | Tap Encryption row on warm-reentry view → modal opens with TLS copy | ✅ PASS | `35-encryption-after-fix.png` | Modal title "Messages secured in transit" |
| F2 caption | "Block contact" hint reads "Available soon" or "Currently blocked" (was "Coming in Phase C") | ✅ PASS | `36-footer-after-fix.png` | "Available soon" hint visible |
| F3 label | Profile entry row label is "Media & Voice" (was "Media, Links & Docs") | ✅ PASS | `32-after-fix2.png` | "Media & Voice" visible |
| F4 subline | Chat header subline reserves height when no presence signal | ✅ code-only | `chat-header.tsx:184-186` + style `presencePlaceholder` `{ height:14, marginTop:1 }` | Verified via code; visual nit confirms after next cold-start |
| F5 modal dismiss | First-tap-swallow after sheet dismiss | 🚫 deferred | documented in Known limits | Low-prio RN animation timing |

### Code landed in Tranche 1.A

**F1 — ScrollView → FlatList shell**
- `my-app/src/app/contact/[id]/index.tsx` — hero moved into `FlatList.ListHeaderComponent`; sections rendered as `renderItem`. The new `useMemo` sits **above** the `if (loading)` / `if (error)` early-returns so the hook count stays stable. Bug repro is gone.

**F2 + F3 (same commit as F1)**
- Block-contact caption: "Coming in Phase C" → "Available soon" (then dynamically swapped to "Currently blocked" once Phase C wired, see below).
- Media row label: "Media, Links & Docs" → "Media & Voice" (gallery only has those two tabs; Links/Docs tabs ship in Tranche 2).

**F4 — Subline placeholder**
- `my-app/src/features/chat/components/chat-header.tsx` — `PresenceLine` now returns `<View style={styles.presencePlaceholder} />` when no presence signal is known, reserving the 14px line so the header doesn't shift when the first presence event lands.

**Phase C closeout (profile-side Block/Unblock)**
- `packages/shared/src/schemas/profile-card.ts` — added `isBlocked: z.boolean()` to `UserProfileCardSchema`.
- `apps/api/src/modules/users/users.service.ts` — `getProfileCard` now resolves `BlocksService.isBlocked(viewer, target)` in parallel with the existing privacy lookups; `toProfileCard` includes it.
- `apps/api/src/modules/users/users.module.ts` — imports `BlocksModule` so `UsersService` can `BlocksService.isBlocked`.
- `my-app/src/features/chat/data/mock-chat-repository.ts` — mock returns `isBlocked: false` so dev mode stays consistent.
- `my-app/src/app/contact/[id]/index.tsx` — destructive footer renders "Block contact" / "Unblock contact" + "Currently blocked" hint based on `card.isBlocked`; tap fires a confirmation `Alert.alert` then optimistically toggles + calls `chatRepository.blockUser` / `unblockUser`. Reverts on failure.
- Chat-thread block enforcement (`messages.service.ts:337` `isBlockedEitherWay`) was already wired pre-Tranche 1; no change needed.

**Phase A.5 — Cold-start read receipts**
- `packages/shared/src/schemas/messages.ts` — `ChatDetailSchema.counterpartLastReadSequence: z.string().regex(/^\d+$/).nullable()` added.
- `apps/api/src/modules/messages/messages.service.ts` — `getChat` returns the counterpart's `ChatMember.lastReadSequence` alongside the caller's (no extra query — the existing `include.chat.include.members` row already carries it).
- `my-app/src/features/chat/data/api-chat-repository.ts` — new `counterpartLastReadByChatId: Map<string, bigint>` cache populated in `fetchDetail`; `listMessages` flips every mine-message with `sequence ≤ counterpartLastReadSequence` from `delivered` → `read` on initial load so lime double-ticks paint immediately on cold-start.

### Surfaces NOT exercised in Tranche 1.A (deferred to next pass)

- **Phase C end-to-end on emulator** — backend + frontend are wired and the API auto-reloaded; needs a manual driver pass: open Priya chat → 3-dot → Mute / Clear / Block. The 3-dot button is confirmed visible (`chat-header.tsx:133-145`).
- **Cold-start read receipts on emulator** — needs DB-injected messages-from-Priya + Priya-mark-read, then app kill + cold-start. Backend + client landed and typechecked; functional verify pending.

### Tranche 1.A live verify — Phase C, 2026-05-25 (continued)

Driver: Claude (Opus 4.7) on `emulator-5554`. Screenshots `37`–`40`.

| Surface | Result | Evidence |
|---|---|---|
| 3-dot button visible in chat header | ✅ PASS | `chat-header.tsx:133-145` renders the Pressable when `onOpenOverflow` is passed; uiautomator confirms `Button` with `content-desc="More options"` at bounds `[1286,193][1384,305]` |
| 3-dot tap opens `PerChatOptionsSheet` | ✅ PASS | All 8 rows render: View contact / Search in chat / Mute notifications / Starred messages / Wallpaper & chat theme / Clear chat / Export chat / Block Priya Test |
| Mute → picker → "For 8 hours" | ✅ PASS | DB row: `mokshith.mutedUntil = 2026-05-25 18:20:03+00`. Bell-off pip visible on Priya's avatar (`38-after-mute.png`). |
| Mute label flips to "Unmute notifications" on re-open | ✅ PASS | Per-chat-options-sheet props plumb `isMuted={isMuted}` from `chat/[id].tsx:251`. After mute → re-open → row label flipped. |
| Clear chat → confirmation Alert | ✅ PASS | Alert title "Clear this chat?", body "Messages will be hidden from your view. The other person will still see them.", buttons CANCEL / CLEAR CHAT. Per-user semantics correctly surfaced to copy. |
| Clear chat endpoint server-side | ✅ PASS via curl | `PATCH /chats/<id>/clear` with body `{}` + auth returns 200. Without auth: 401 (route reachable). Without body: 400 `bad_request` ("Body cannot be empty when content-type is set to 'application/json'") — Fastify's strictness, see finding F6 below. |
| Clear chat end-to-end through emulator UI | 🚧 BLOCKED on Metro cache | Client fix applied (`api-chat-repository.ts:685` now sends `{}`); two reloads + cold-restart did not pick up the edit; Metro process was killed mid-session and restart from this session never bound to 8081. Re-verify pending a clean Metro restart by the user. Server-side is proven via curl. |
| Profile-side Block / Unblock | 🚧 DEFERRED to next session | Blocked behind the same Metro issue above. Code + endpoint are live. |
| Cold-start read receipts | 🚧 DEFERRED to next session | Same. Requires DB-inject of messages from Priya + advancing Priya's `lastReadSequence` to verify the lime-flip on initial paint. |

#### Tranche 1.A new finding

⚠️ **F6 (real bug — bodyless PATCH on Fastify).** `PATCH /chats/:chatId/clear` is bodyless on the server, but RN's `fetch` adds `content-type: application/json` for any PATCH/POST/PUT call even when the body is undefined. Fastify rejects with 400 `bad_request: "Body cannot be empty when content-type is set to 'application/json'"`. **Fix applied client-side** in `my-app/src/features/chat/data/api-chat-repository.ts:685` — `clearChat` now sends an explicit `{}` body so the request matches its declared content-type. Recommend auditing other bodyless PATCH calls for the same pattern; alternative is to relax Fastify's body-parser to allow empty `application/json` bodies (riskier — silent 400s elsewhere become silent successes).

#### Tranche 1.A new finding (UX)

🔍 **F2b** — same kind as F2: "Search in chat" row in the per-chat options sheet shows hint `"Coming in Phase D"` to end users. Same recommendation as F2 — swap to "Available soon" before any external build. Will batch with F2 in the Phase D ship.

### Tranche 1.B — queued for next session

- Phase D.3 Star messages (StarredMessage Prisma model + module + UI bubble indicator + (tabs)/starred screen).
- Phase D.1 Reactions (MessageReaction model + module + reaction picker bar + pill row + Socket.IO broadcasts).
- Phase D.5 Edit message (Message.editedAt + 15-min edit window endpoint + composer edit mode + bubble "edited" suffix).

### How completion looks now

Per the plan's weighting (lets-add-them-as-radiant-firefly.md):

- Pre-Tranche 1.A: **~73%** (Phase B ship-blocker + Phase C uncommitted + Phase D/E/F missing).
- Post-Tranche 1.A: **~81%** — closes the F1 ship-blocker (+5%), Phase C end-to-end backend/frontend wiring (+8%), Phase A.5 cold-start read receipts (+1%). Counts as +13% (not +14%) because Phase C's emulator verify is still pending.
- After Tranche 1.B (Star + Reactions + Edit): projected **~93%**.
- After Tranche 2 (Forward + Search + Stickers + Push + R2 cleanup + light-mode + perf): **100%**.

---

## Phase C — Per-chat options sheet + Block + Mute ✅ wired (verify pending)

Tranche 1.A landed the missing wiring: `UserProfileCard.isBlocked` plumbed through the backend; profile destructive footer now calls real `POST /users/:id/block` / `DELETE /users/:id/block` with optimistic UI. Backend block enforcement (`isBlockedEitherWay` rejects sends in either direction) was already live pre-tranche. Per-chat options sheet + Mute picker components are wired into the 3-dot menu on the chat header. **Emulator verify of the in-thread 3-dot path is pending.**

## Phase D — Reactions / Forward / Star / Search / Edit / Stickers (NOT STARTED)

Six WhatsApp-parity features, each independently mergeable. See plan file for schema + endpoint details.

## Phase E — Push + R2 orphan cleanup (NOT STARTED)

Requires scaffolding `apps/worker/` BullMQ workspace.

## Phase F — Doc sync + light-mode + perf (ONGOING)

This file IS the Phase F doc-sync output. Light-mode + perf audit happens once Phases A–E close.

---

## Tranche 1.B+ — Remaining-work handoff (planned 2026-05-25)

> **Read this first if you're picking up the slice.** This section is the complete remaining-work checklist for finishing 1-on-1 to WhatsApp-parity + tests + push. It's mirrored from the plan at `C:\Users\amogh\.claude\plans\see-till-one-on-temporal-hamming.md` (held by the planner). Tick `[ ]` → `[x]` in the same PR that lands each item, and update root `CLAUDE.md` §10 simultaneously per the §7 working agreement.

### Scope decisions captured during planning (do NOT re-litigate)

1. **WhatsApp-parity, NOT Figma-only.** The Figma file has no frames for Reactions / Forward / Edit / Stickers / Starred-list / in-thread Search — only icon labels in the per-chat options sheet. The user explicitly chose WhatsApp-parity, so all of these ship as **invented UI** matching the existing dark-first `Brand` / `Spacing` / `Radius` tokens + the long-press action-sheet + per-chat-options-sheet visual idiom.
2. **Tests this slice.** NestJS e2e for the ~12 1-on-1 endpoints + Jest unit tests for pure helpers + a checked-in `adb` manual-verify checklist. No Detox/Maestro yet (queued for the slice after super-groups).
3. **Push + R2 cleanup this slice.** Stand up `apps/worker/` BullMQ workspace, Expo Push project + APNs/FCM creds, R2 orphan cleanup worker.

### Sequencing (one mergeable PR per row)

| PR | Phase | Scope | Status |
|---|---|---|---|
| 0 | Handoff | This section + checklist below. No code. | [x] (2026-05-25) |
| 1 | Phase 1 | Emulator close-out for Tranche 1.A wiring (Mute/Clear/Block in thread, cold-start reads, B.7, B.8) | [ ] |
| 2 | Phase 4.2 | Frontend Jest harness + 4 unit suites | [x] (2026-05-25) |
| 3 | Phase 4.1 | Backend e2e covering Phase A+B+C endpoints already live | [x] (2026-05-25, REST cases; socket cases queued) |
| 4 | Phase 2.1 | Reactions | [~] (2026-05-25, backend + e2e shipped; mobile UI queued) |
| 5 | Phase 2.2 | Edit message (15-min window) | [ ] |
| 6 | Phase 2.3 | Star + Starred list screen | [ ] |
| 7 | Phase 2.4 | Forward | [ ] |
| 8 | Phase 2.5 | In-thread search + jump-to-message infra | [ ] |
| 9 | Phase 2.6 | Stickers | [ ] |
| 10 | Phase 3.1 + 3.3 | `apps/worker/` scaffold + R2 cleanup | [ ] |
| 11 | Phase 3.2 | Expo Push fan-out (APNs + FCM creds) | [ ] |
| 12 | Phase 5 | Light mode + perf audit | [ ] |
| 13 | Phase 6 | F5 modal-dismiss tap-swallow fix + final doc sync | [ ] |

### Phase 1 — Emulator close-out for Tranche 1.A wiring

**Goal:** verify the surfaces that landed wired but never driven on a real device, before layering new code on top.

Drive on `emulator-5554`:

- [ ] **3-dot → Mute (8h / 1w / Always)** — assert bell-off pip on header avatar; row label flips to "Unmute notifications" on re-open. Files: `chat-header.tsx:133-145`, `per-chat-options-sheet.tsx`, `mute-picker-sheet.tsx`, `PATCH /chats/:id/mute`.
- [ ] **3-dot → Clear chat** — confirmation Alert "Messages will be hidden from your view…"; `GET /chats/:id/messages` for caller returns 0; peer still sees history. F6 client `{}` body fix already landed.
- [ ] **3-dot → Block / Unblock** — label flips on `isBlocked`; counterpart send → 403 `peer_blocked` (`BlocksService.isBlockedEitherWay` rejects both directions).
- [ ] **Cold-start read receipts** — DB-inject messages-from-Priya + advance her `ChatMember.lastReadSequence` + cold-start the app → mine-bubbles paint lime double-tick on first render.
- [ ] **B.7 privacy 403** — third synthetic user (no shared chat) hits `/users/:id/profile-card` via `curl` with minted JWT → 403 `profile_not_visible`.
- [ ] **B.8 open-chat shortcut** — `message-circle` icon top-right on profile → `router.replace('/chat/[id]')`.

**Output:** append `## Tranche 1.B — Phase C emulator verify — <YYYY-MM-DD>` section here, screenshots under `docs/progress/screenshots/1-on-1-production/tranche-1b/`. No code changes if everything passes. New findings → F<n>.

### Phase 2 — WhatsApp-parity vertical slices

#### Phase 2.1 — Reactions — backend ✅ shipped 2026-05-25 / mobile UI 🚧 queued

- [x] `apps/api/prisma/schema.prisma` — `MessageReaction` (id, messageId, userId, emoji str ≤ 16 utf8, createdAt). Unique `(messageId, userId, emoji)` + index on `messageId` for the aggregate read path.
- [x] `apps/api/prisma/migrations/20260525120000_add_message_reactions/migration.sql` — applied via `prisma migrate deploy` against the e2e schema; will roll forward in dev/prod via the standard `db:setup` path.
- [x] `packages/shared/src/schemas/reactions.ts` — `ReactionEmojiSchema` (1–16 utf8 bytes), `AddReactionSchema`, `ReactionAggregateSchema`, `ReactionsListSchema`, `SocketReactionUpdatedSchema`. Re-exported from `schemas/index.ts`.
- [x] `packages/shared/src/schemas/messages.ts` — `MessageDto.reactions: ReactionAggregate[]` (defaulted to `[]`). Default keeps existing wire shape backwards compatible.
- [x] `packages/shared/src/schemas/messages.ts` — added `SocketEvents.reactionUpdated`.
- [x] `apps/api/src/modules/reactions/{module,service,controller}.ts`. Service handles idempotent add (swallows Prisma P2002), idempotent remove (`deleteMany`), and the per-message aggregator that sorts by count then emoji (stable UI render). Controller validates the path emoji via the shared `ReactionEmojiSchema` after URL-decoding.
- [x] `POST /messages/:id/reactions` body `{ emoji }` — chat-member assertion + tombstone rejection (`message_deleted` 403) + 403 `not_a_member` for outsiders. Returns the new aggregate.
- [x] `DELETE /messages/:id/reactions/:emoji` — same guards; returns the new aggregate.
- [x] `MessagesGateway.emitReactionUpdated({ chatId, messageId, reactions })` — broadcasts to `chat:{chatId}` room. Triggered from both endpoints.
- [x] `MessagesService` row → DTO sets `reactions: []` by default. Hot read paths (`GET messages`) can later batch-load via `ReactionsService.aggregateForMessage` and inject without changing the wire shape.
- [x] e2e: Case 10 `POST/DELETE /messages/:id/reactions aggregates correctly + rejects non-members` — verifies idempotent add, multi-emoji aggregation, sort order, non-member 403, decoded path emoji, and DB-level row count after remove.
- [ ] **Mobile UI (queued for next session):** `reaction-picker.tsx` (modal pill row with 👍 ❤️ 😂 😮 😢 🙏 + more tray), `reaction-row.tsx` (pills under bubble; tap own = remove, tap others = add), `message-bubble.tsx` renders ReactionRow when `reactions[].length`, `message-action-sheet.tsx` adds "React" row at top, `api-chat-repository.ts` `addReaction/removeReaction` + `reaction:updated` subscription that patches the cached message.

**Run:** `npm run db:setup` (applies the new migration on dev DB; idempotent) + `npm run api:test:e2e`. 8 REST cases now pass.

#### Phase 2.2 — Edit message (15-min window)

- [ ] `Message.editedAt: DateTime?` + `editVersion: Int @default(0)` + migration.
- [ ] `MessageDto.editedAt: string | null`.
- [ ] `PATCH /chats/:chatId/messages/:messageId` body `{ content }` — sender-only, 15-min window, TEXT only. Broadcasts `message:edited`.
- [ ] Action sheet "Edit" row on own non-tombstone TEXT bubble within 15min.
- [ ] Composer edit mode: Save/Cancel pair + "Editing message…" banner.
- [ ] Bubble " (edited)" italic-grey suffix when `editedAt` present.
- [ ] `api-chat-repository.ts` `editMessage` + `message:edited` subscription.

#### Phase 2.3 — Star messages + Starred list screen

- [ ] `StarredMessage` (id, userId, messageId, chatId, createdAt) unique `(userId, messageId)` + migration.
- [ ] `POST/DELETE /messages/:id/star` toggle.
- [ ] `GET /me/starred?cursor=&limit=` — paginated across chats, returns `MessageDto` + `chatId` + counterpart preview.
- [ ] Action sheet "Star"/"Unstar" row.
- [ ] ⭐ glyph on starred bubbles.
- [ ] `src/app/starred.tsx` push route under root stack (NOT a tab). `FlatList` grouped by chat, tap → `/chat/[chatId]` then jump (Phase 2.5 infra).
- [ ] Wire 3-dot → Starred row in `per-chat-options-sheet.tsx` → `router.push('/starred')`. Drop the "Coming in Phase D" hint.

#### Phase 2.4 — Forward message

- [ ] `Message.forwardedFromMessageId: String?` + `forwardedHopCount: Int @default(0)` + migration. Cap hop 3.
- [ ] `POST /chats/:chatId/messages/forward` body `{ sourceMessageId, targetChatIds: string[] }` — member-of-source-and-each-target; bumps hop.
- [ ] IMAGE/VOICE forwards reuse `mediaObjectKey` (no re-upload); server validates source ownership.
- [ ] Action sheet "Forward" row.
- [ ] `forward-sheet.tsx` modal — contact-page row pattern + multi-select + Send footer.
- [ ] Post-send snackbar "Forwarded to N chats".

#### Phase 2.5 — In-thread search + jump-to-message infra

- [ ] `GET /chats/:chatId/messages/search?q=&cursor=` — paginated `ILIKE` against `Message.content`. Filter `deletedAt:null`, `kind in TEXT|IMAGE`.
- [ ] Add Postgres trigram index `messages_content_trgm_idx` if perf needed (>5k msg/chat).
- [ ] New query param: `GET /chats/:id/messages?aroundSequence=X&limit=40` to seed cache around a target.
- [ ] 3-dot → "Search in chat" replaces ComingSoon stub → top search-bar overlay; bolded-query hit list.
- [ ] Tap result → `FlatList.scrollToIndex({ animated: true, viewPosition: 0.5 })`. Fetch-around-the-message if not cached. Landed bubble gets 1s yellow-glow (`Reanimated.withSequence`).
- [ ] Unblocks: starred-list jump + media-gallery jump (Phase B B.4 known limit).

#### Phase 2.6 — Stickers

- [ ] `Message.kind` enum gains `STICKER`.
- [ ] `StickerPack` + `Sticker` Prisma models + migration.
- [ ] Seed script for one default pack of ~20 stickers in R2 `stickers/` prefix.
- [ ] `GET /stickers` cacheable; client caches in MMKV.
- [ ] Send path: `{ kind:'STICKER', mediaObjectKey, imageWidth, imageHeight }`; server validates `mediaObjectKey` is in `stickers/` prefix.
- [ ] `sticker-picker.tsx` bottom-sheet (horizontal pack tabs + grid).
- [ ] `attachment-sheet.tsx` adds Stickers row.
- [ ] `sticker-bubble.tsx` borderless `<Image>` intrinsic dims max 200×200dp.

### Phase 3 — Push notifications + R2 orphan cleanup

#### Phase 3.1 — `apps/worker/` workspace bootstrap

- [ ] New workspace `apps/worker/` (`bullmq`, `ioredis`, `@prisma/client`, `@scalechat/shared`).
- [ ] `apps/worker/src/index.ts` — connects to same Postgres + Redis; spawns workers.
- [ ] `apps/worker/Dockerfile` + `fly.toml` — separate Fly app `scalechat-worker`, 1-CPU machine in `ap-south-1`.
- [ ] Root `package.json` — `worker:dev` / `worker:start`.
- [ ] `apps/api/src/modules/queues/` — shared Bull config + connection helpers (API enqueues, worker consumes).

#### Phase 3.2 — Expo Push fan-out

- [ ] `PushToken` Prisma model (id, userId, expoPushToken, platform, lastSeenAt). Unique `(userId, expoPushToken)`.
- [ ] `POST /me/push-tokens` upsert; `DELETE /me/push-tokens/:token` on sign-out.
- [ ] `MessagesService` after INSERT — enqueue `push:fan-out { messageId, chatId, recipientUserIds, excludeUserId }` (excludes sender + socket-connected).
- [ ] `apps/worker/src/jobs/push-fan-out.ts` — skip muted; batch Expo Push in chunks of 100; handle `DeviceNotRegistered` by deleting the token.
- [ ] Mobile: `expo-notifications` registration on signed-in app open → `POST /me/push-tokens`. **Read https://docs.expo.dev/versions/v56.0.0/ for the v56-specific API before any of this.**
- [ ] `app.json` — `expo.notifications.icon`, Android `googleServicesFile`, iOS `aps-environment`.
- [ ] Notification tap → deep-link to `/chat/[id]`.

#### Phase 3.3 — R2 orphan cleanup worker

- [ ] New queue `media:cleanup`.
- [ ] Triggers: on `DELETE /chats/:id/messages/:msgId?scope=everyone` for IMAGE/VOICE; nightly cron for `deletedAt < NOW() - INTERVAL '30 days'`.
- [ ] `apps/worker/src/jobs/media-cleanup.ts` — `DeleteObjectCommand`; tolerate 404s.

### Phase 4 — Testing layer

#### Phase 4.1 — Backend e2e (`apps/api/`) — ✅ REST cases shipped 2026-05-25

- [x] `apps/api/jest-e2e.config.js` — `ts-jest` + Node env + global setup/teardown; `@scalechat/shared` mapped to the built `dist/` so the source's `.js` ESM re-exports resolve under CommonJS Jest.
- [x] `apps/api/test/global-setup.ts` — sets `DATABASE_URL=…?schema=test_e2e`, runs `npx prisma migrate deploy` against the test schema. Schema is created implicitly by Prisma's migration engine.
- [x] `apps/api/test/global-teardown.ts` — `DROP SCHEMA test_e2e CASCADE` (override with `KEEP_TEST_SCHEMA=1` when debugging).
- [x] `apps/api/test/setup-e2e.ts` — `setupTestApp()` boots Nest+Fastify and caches the app; `truncateAll()` clears every prisma-managed table between tests via `pg_tables`; `seedUser({ phoneE164, fullName })` factory; `authedInject(...)` wraps Fastify's `app.inject()` with bearer auth. **F6 fix mirrored:** the helper only sets `content-type: application/json` when there's a payload, otherwise Fastify rejects bodyless requests with 400 (same root cause as the mobile `clearChat` fix).
- [x] `apps/api/test/chat.e2e-spec.ts` cases (extend as Phase 2 lands):
  1. [x] `POST /chats/one-on-one` A→B (idempotent on retry).
  2. [x] `POST /chats/:id/messages` text (idempotent on `clientMessageId`).
  3. [ ] Socket: A connects, B sends, A receives `message:new` — `it.todo`, needs in-test `socket.io-client` harness.
  4. [ ] `PATCH /chats/:id/read` from B → A's socket receives `chat:read` — `it.todo`.
  5. [ ] `DELETE /chats/:id/messages/:msgId?scope=everyone` socket broadcast — `it.todo`.
  6. [x] `POST /messages/:msgId/report` — 201, then 409 `already_reported`.
  7. [x] `POST /users/:id/block` — subsequent peer send → 403 `peer_blocked`. `DELETE` un-blocks.
  8. [x] `PATCH /chats/:id/mute { until }` → `ChatMember.mutedUntil` set.
  9. [x] `PATCH /chats/:id/clear` — `clearedAt`; caller `GET messages` returns 0; peer still sees history.
  10. [ ] Phase 2.1 — reactions add/remove cycle — `it.todo`.
  11. [ ] Phase 2.2 — edit within 15min; outside → 400 `edit_window_expired` — `it.todo`.
  12. [ ] Phase 2.4 — forward hop count + ownership rules — `it.todo`.
  13. [ ] Phase 2.5 — search returns matched messages — `it.todo`.
- [x] Plus one negative case: a non-member (Mallory) cannot send to a chat she didn't join (403).

**Run:** `npm run db:setup` (once) + `npm run api:test:e2e` from the repo root — currently **7 cases passing, 7 todo, 0 failing in ~23s**. The Socket.IO + reactions/edit/forward/search cases land alongside their Phase 2 PRs (each Phase 2 PR adds an e2e case as part of its DoD).

**Known limit:** the Nest app holds the Socket.IO server + Redis adapter open after tests, so we run with `--forceExit`. When the socket cases land (case 3-5), they'll need an explicit `app.close()` that disposes the gateway — at which point `--forceExit` becomes optional.

#### Phase 4.2 — Frontend unit tests (`my-app/`) — ✅ shipped 2026-05-25

- [x] `my-app/jest.config.js` — **lightweight** `babel-jest` + `babel-preset-expo` config, `testEnvironment: node`. Deliberately NOT using `preset: 'jest-expo'`: that preset's setup.js imports raw TS (`expo-modules-core/src/polyfill/dangerous-internal.ts`) and crashes under Jest's default transformer. Our pure unit tests don't need RN runtime, so the minimal path is correct. When component-level RN tests land, add a separate config file using `jest-expo/universal`.
- [x] `my-app/jest.setup.ts` — intentionally empty; pure tests don't need RN/native mocks. Add `jest.mock(...)` here if a future test pulls one in.
- [x] `src/lib/__tests__/format-time.test.ts` — bubble HH:mm, 12-hour AM/PM at noon + midnight, Today/Yesterday/weekday/DD/MM/YY transitions, midnight rollover, year-boundary, day-divider, voice duration incl. negative clamp.
- [x] `src/lib/__tests__/phone.test.ts` — digitsOnly sanitiser, +91 mobile validation (6-9 prefix), landline rejection, formatIndianMobile progressive format, toE164India round-trip, localDigitsFromE164.
- [x] `src/features/chat/data/__tests__/dto-to-message.test.ts` — TEXT/VOICE/IMAGE branches, senderId resolution (me vs counterpart), tombstone deletedAt pass-through, replyToMessageId, clientMessageId reconciliation, missing-field defaults. STICKER/reactions/edited/forwarded cases extend as Phase 2.x lands.
- [x] `src/features/chat/__tests__/copy.test.ts` — top-level structure, no-empty-string leaves, callable leaves return non-empty, comingSoon shape, structural snapshot.
- [x] Refactor: extracted `dtoToMessage` from `api-chat-repository.ts` → `src/features/chat/data/dto-to-message.ts` (pure module) so the test imports a clean function without dragging MMKV / socket.io / expo-constants into the test runtime. Re-exported from the repo for backwards compat.
- [x] Defensive fix found via the test: `formatDuration` now clamps negative inputs to `0` (was rendering `"-1:59"` for `-1`).

**Run:** `cd my-app && npm test` — currently **4 suites / 45 tests passing in ~6s**. Cases for `reactions / edited / forwarded / stickers` will be added to `dto-to-message.test.ts` as those features land in Phases 2.1 / 2.2 / 2.4 / 2.6.

#### Phase 4.3 — Manual verify checklist (checked in)

- [ ] `docs/progress/manual-verify-1-on-1.md` — NEW. Step-by-step `adb shell input` + `uiautomator dump` for every 1-on-1 surface so a next contributor can replay the run. Mirrors `docs/progress/screenshots/` naming.

### Phase 5 — Light mode + perf

- [ ] Light mode pass: `adb shell cmd uimode night no`; walk every 1-on-1 surface; capture hardcoded-`Brand.*` color leaks on white. Expect 4–8 small `useTheme()` swaps.
- [ ] Perf on Pixel 3a class: `FlatList windowSize={11}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews`. Verify `ImageBubble aspectRatio` reservation pre-load. Memoize `VoicePlayer` waveform.
- [ ] `npx expo-doctor` clean; no unused autolinked native modules.

### Phase 6 — F5 polish + final doc sync

- [ ] F5 fix: ComingSoonSheet dismiss-tap swallow on chat-header avatar (RN fade-out timing). Add `pointerEvents="none"` to backdrop during closing animation, OR debounce the next-sheet opener. Repro between Tranche 1.A screenshots `09` → `10`.
- [ ] Sweep `docs/progress/1-on-1-production.md` + root `CLAUDE.md` §10 for any drift; close out any remaining F<n> findings.

### Critical files (representative — phases repeat the pattern)

```
# Phase 1 — no code expected
docs/progress/1-on-1-production.md                                # Tranche 1.B verify section

# Phase 2.1 Reactions
apps/api/prisma/schema.prisma                                     # MessageReaction model
apps/api/prisma/migrations/<ts>_add_message_reaction/migration.sql
apps/api/src/modules/reactions/{module,service,controller}.ts     # NEW module
apps/api/src/modules/messages/messages.gateway.ts                 # reaction:updated broadcast
packages/shared/src/schemas/messages.ts                           # MessageDto.reactions[]
my-app/src/features/chat/components/{reaction-picker,reaction-row}.tsx  # NEW
my-app/src/features/chat/components/{message-bubble,message-action-sheet}.tsx
my-app/src/features/chat/data/api-chat-repository.ts              # addReaction/removeReaction + sub

# Phase 2.2 Edit / 2.3 Star / 2.4 Forward / 2.5 Search / 2.6 Stickers — same shape:
#   Prisma + migration + endpoint + gateway broadcast (if real-time) + UI sheet/picker + repo wiring

# Phase 3 — new workspace
apps/worker/                                                      # NEW workspace
apps/worker/{package.json,Dockerfile,fly.toml,tsconfig.json}
apps/worker/src/{index.ts,queues/*,jobs/{push-fan-out,media-cleanup}.ts}
apps/api/prisma/schema.prisma                                     # PushToken model
apps/api/src/modules/{push,queues}/*.ts                           # NEW modules
my-app/app.json                                                   # Expo Push config
my-app/src/lib/push.ts                                            # NEW — token registration

# Phase 4 — tests
apps/api/test/{setup.ts,chat.e2e-spec.ts}                         # NEW
my-app/jest.config.js, jest.setup.ts                              # NEW
my-app/src/lib/__tests__/*.test.ts                                # NEW
my-app/src/features/chat/data/__tests__/*.test.ts                 # NEW
docs/progress/manual-verify-1-on-1.md                             # NEW

# Phase 5 — likely 4-8 small useTheme() swaps
# Phase 6 — coming-soon-sheet.tsx + any sheet that opens a follow-up
```

### How to verify each phase

```bash
# Phase 1 — emulator close-out
npm run db:setup
npm run api:dev
cd my-app && npx expo start --dev-client
# Drive the 6 Phase 1 surfaces, screenshot to docs/progress/screenshots/1-on-1-production/tranche-1b/

# Phase 2 — per sub-phase
# Each new endpoint: curl test then drive the UI flow on emulator
# Each migration: npm --workspace=apps/api run prisma:migrate

# Phase 3 — push + R2 cleanup
npm run worker:dev                                                # bootstrap worker locally
# Send a message from device A while device B is offline → push delivered
# Delete-for-everyone an image → R2 object disappears within job poll interval

# Phase 4 — tests
npm --workspace=apps/api run test:e2e                             # backend
cd my-app && npm test                                             # frontend unit
# manual checklist: docs/progress/manual-verify-1-on-1.md

# Phase 5 — light mode + perf
adb shell cmd uimode night no                                     # force light
# walk every surface, capture screenshots, fix hardcoded-color leaks
```

### What's out of scope (do not build in this slice)

- Super Groups (separate slice — `docs/brd/` will gain a new BRD when that starts).
- Voice / Video call screens — Figma has only the icon labels. ComingSoonSheet treatment is the design intent (BRD §4.19 "free for everyone").
- Chat Theme picker — Figma has the icon row but no picker design. ComingSoonSheet.
- Export Chat — Figma row only. ComingSoonSheet.
- Wallpaper picker — Figma row only. ComingSoonSheet.
- Group / Super Group reactions / mentions / admin tools — wait for the Super Groups slice.
- Razorpay integration — separate slice.

Estimated wall-clock for one engineer driving + this Claude: **3–4 weeks** including external coordination on APNs cert + Expo Push project setup.

---

## Figma-verify pass — 2026-05-25

> Driver: Claude (Opus 4.7). Goal: confirm each Figma frame for the 1-on-1 slice matches what's built. Reference material lives at `docs/progress/screenshots/1-on-1-production/figma-verify-2026-05-25/` — `figma-NN-*.png` are pulled from Figma file `JYhOHnaEDgGYNxJShD9WDK`; `tranche1a-*.png` are the matching implementation screenshots reused from the Tranche 1.A run.

### What I could verify by direct visual comparison

| Figma frame | Implementation evidence | Verdict |
|---|---|---|
| **Chat Page** (`1:2972`) — gradient header, lime call buttons, cream/purple bubbles, voice waveform, day-divider pill, dark composer | `tranche1a-07-thread-loaded.png` | ✅ **MATCH** on gradient, lime call buttons, name placement, composer layout. (Thread was empty in screenshot so bubble pair, day pill, voice waveform weren't side-by-side checked but those are present in earlier Tranche 1.A captures.) |
| **Attachment sheet** (`1:3098`) — 7 tiles: Photos, Camera, Location, Contact, Documents, Poll, Schedule | `attachment-sheet.tsx` source inspection | ⚠️ **DRIFT** — only 5 tiles (Camera, Gallery, Document, Contact, Location). **Missing: Poll, Schedule.** "Gallery" should read "Photos". Order doesn't match. See follow-up task #16. |
| **Voice recorder overlay** (`1:3698`) — red stop button + duration + waveform + send + cancel chevron | `voice-recorder-overlay.tsx` source (lines 51-54: "Discard"/"Send" buttons + auto-stop) | ✅ **STRUCTURAL MATCH**. Visual comparison deferred (Tranche 1.A didn't capture a recorder-active screenshot). |
| **Contact Profile** (`1:6560`) — purple top + hero overlapping into white body, **outlined** Voice/Video Call pills with **purple** icons, 4 rows (Media,Links&Docs / Chat Theme / Encryption / Contact Details), Common Groups populated | `tranche1a-32-after-fix2.png` (F1 fix verified) | ⚠️ **DRIFT** — (a) Voice/Video Call pills are **lime** in impl, should be muted outlined per Figma. (b) Row "Media & Voice" (impl) vs "Media, Links & Docs" (Figma) — known limitation, Links/Docs deferred to Tranche 2. (c) Theme: impl is dark-first per `my-app/CLAUDE.md` §3 (intentional). See follow-up task #17. |
| **Encryption modal** | `tranche1a-22-encryption-modal.png` | ✅ Modal renders with "Messages secured in transit" + TLS body, matches the in-line description in the row. |
| **Media gallery** sub-route | `tranche1a-24-media-gallery.png` | ✅ Empty-state grid renders correctly; Voice notes tab also captured (`25-voice-notes-tab.png`). |
| **Mute applied** — bell-off pip on header avatar | `tranche1a-38-after-mute.png` | ✅ Pip visible on the avatar. |
| **Coming Soon sheet** — call CTA copy ("free for everyone…") | `tranche1a-08-voice-coming-soon.png` | ✅ Modal + copy + lime CTA match the dark-slab visual idiom. |
| **Per-chat options sheet (3-dot)** — 8 rows | code: `per-chat-options-sheet.tsx` (8 rows confirmed) | ⚠️ Figma has no design for this — invented in code per the slice's WhatsApp-parity scope. Structure verified to match the BRD §3.6 list. "Search in chat" + "Starred messages" still leak the "Coming in Phase D" hint label — should be ComingSoonSheet (separate row in the handoff). |

### What's NOT in Figma but built (WhatsApp-parity additions)

- Per-chat options sheet (3-dot menu) — Figma's chat header has no 3-dot button; we added it for BRD §3.6 features. **By design.**
- Reactions backend (PR 4a) — no Figma frame; UI to be invented in PR 4b. **By design per scope decision.**
- Block/Unblock destructive footer — Figma doesn't show this; per BRD. **By design.**

### What's in Figma but NOT (yet) built

| Surface | State |
|---|---|
| Attachment tiles **Poll** + **Schedule** | not built — task #16 |
| Profile call-CTA outlined pill style | drift — task #17 |
| Contact Profile "Media, Links & Docs" row → only "Media & Voice" today | F3 known limitation, deferred to Tranche 2 |
| Common Groups populated state | requires Groups feature — not in 1-on-1 slice |

### What I could NOT verify dynamically on the emulator this session

The Expo Dev Client on `emulator-5554` would not reliably load the bundle:

1. Auto-detected LAN IP (`192.168.1.138:8081`) failed — needs manual entry of `10.0.2.2:8081` via the URL input field.
2. After entering the URL + tapping Connect, the bundle began loading but crashed back to the Android home screen before the JS root mounted. No `FATAL` log line — looks like a silent JS execution failure or a stale cached bundle.
3. `adb exec-out screencap -p` produced multi-tiled / garbled PNGs (a known Android emulator GPU rendering artifact under certain driver combinations).

Net effect: the following surfaces remain **wired-but-not-driven-on-emulator** and need a follow-up verify session once the emulator is healthy (see task #18):

- 3-dot → Mute (8h/1w/Always) flow end-to-end
- 3-dot → Clear chat end-to-end
- 3-dot → Block/Unblock from inside the chat
- Cold-start read receipts (lime double-tick on initial paint of mine messages the peer has already read)
- B.7 privacy 403 via curl with a third synthetic user JWT
- B.8 top-right open-chat shortcut on the profile screen
- Reactions UI (waiting on PR 4b anyway)

### Recommended next-session prep (emulator fix)

To unblock the dynamic verify:

```bash
# 1. Kill the current emulator and relaunch with software rendering
adb -s emulator-5554 emu kill
emulator @<avd-name> -gpu swiftshader_indirect -no-snapshot -no-audio &

# 2. Confirm screencap is no longer garbled
adb exec-out screencap -p > /tmp/test.png
python -c "from PIL import Image; print(Image.open(r'/tmp/test.png').size)"
# Should show 1440x3120 with normal content — not the tiled artifact

# 3. Bring up the stack as before
npm run db:setup
npm run api:dev
cd my-app && npx expo start --dev-client
adb reverse tcp:8081 tcp:8081
adb reverse tcp:4000 tcp:4000

# 4. Open the dev client and paste `10.0.2.2:8081` (NOT the LAN IP)
```

If `-gpu swiftshader_indirect` is still slow, `scrcpy` (a separate tool — `winget install scrcpy`) mirrors the display via H.264 and provides clean screen captures.

---

## Working-agreement reminder

Every commit that ships user-visible behavior MUST update root `CLAUDE.md` §10 + this file (or include `[skip-claudemd] <reason>` in the message). See `my-app/CLAUDE.md` §7. The Phase A coming-soon-sheet + read-receipt commit will carry both updates in the same PR.
