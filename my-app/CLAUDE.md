@AGENTS.md

# ScaleChat — Project Context

> Read this once at the start of every session. The first hard rule below is non-negotiable.

## 1. Product

**ScaleChat** is a privacy-first mobile messaging app for the **Indian market**, built for *intermediaries* — real estate agents, travel agents, recruiters, marketplace operators, consultants, community builders — whose income depends on connecting two parties without being bypassed. The hero feature is the **Super Group**: a group chat where members can talk together but cannot see each other's phone numbers and cannot DM each other. Only the admin (the network owner) has full visibility. **Admins pay; members are free.**

The standard 1-on-1 chat (the WhatsApp-equivalent direct message between two users who already have each other's numbers) is the foundational primitive Super Groups sit on top of. Phone numbers ARE visible in 1-on-1 chats — the disintermediation feature is specifically a Super Group property.

Canonical pitch: `../Scalechat Pdf (2).pdf` (project root).
Design source: Figma file `JYhOHnaEDgGYNxJShD9WDK`, page `0:1`.

**Naming note.** The Figma file is branded **"SlayChat"** — that was an earlier product name. The canonical name is **ScaleChat**. Do not rename anything in Figma; just use "ScaleChat" in code, copy, and docs.

## 2. Tech stack pinning — hard rule

- **Expo SDK 56**
- **expo-router** (file-based routing, typed routes enabled)
- **React Native 0.85**
- **React 19.2**
- **TypeScript strict**

> **Before writing any Expo API call, read `https://docs.expo.dev/versions/v56.0.0/` for that module.**
> Expo APIs shift across major versions. Do not assume APIs from older Expo memory. This rule is enforced by `AGENTS.md`.

See [`../docs/architecture/expo-skills.md`](../docs/architecture/expo-skills.md) for the full enumeration of modules + EAS workflow + reading order.

## 3. Architecture stance

- **Frontend-first.** We build screens against in-memory mock data behind **typed repository interfaces** (`MessagesRepository`, `ThreadsRepository`, `ContactsRepository`). The real backend ships later as a new implementation of the same interface.
- All UI works fully offline against the mock store. **No network code yet.**
- **India-first locale:**
  - Phone numbers default to `+91` (E.164: `+91XXXXXXXXXX`).
  - Time format: `HH:mm`, with `Yesterday` / `DD/MM/YY` relative dates (matches Figma).
  - Currency: `₹` via `Intl.NumberFormat('en-IN')`.
  - English UI now; strings live in designated copy files (`features/*/copy.ts`) so a future i18n layer can lift them without touching screens.
- **Dark-mode-first** — the Figma is dark; light mode is secondary.
- Always go through `useTheme()` and `Spacing` from `src/constants/theme.ts`. **Never hard-code colors or spacing.** Extend the palette in `theme.ts` when designs need a new token.
- **Never use raw `Text` / `View` in screens.** Always `ThemedText` / `ThemedView`.

## 4. Target backend architecture (REFERENCE — NOT YET IMPLEMENTED)

This summarizes the backend architecture designed by the founder's collaborator. The Expo client ships first against mocks; this is where it's heading. Frontend choices on this page (MMKV, zod, secure-store, single-flight refresh) flow from this design — don't drop them just because the backend isn't built yet.

### Stack
- API + WebSocket gateway: **single NestJS binary** running two scaling profiles (REST is short-lived; Socket.IO is long-lived).
- **Postgres on Neon** (Launch tier in prod, always-on).
- **Redis on Upstash** — Socket.IO adapter, presence sets, OTP store, rate-limit buckets, BullMQ queues.
- **BullMQ workers** on a separate Fly process (`worker.ts` entrypoint) — push fan-out, message expiry, Razorpay webhook, RBI pre-debit, media thumbnails.
- **Cloudflare** at the edge — TLS, DNS, WAF, rate-limit, CDN.
- Hosting: **Fly.io in Mumbai (`ap-south-1`)** — same region as Upstash + Neon → sub-ms latency between tiers.
- **Prisma 7** ORM (WASM).
- Monorepo with **`packages/shared`** for zod schemas + branded types.

### Auth flow
- **OTP via MSG91**; 6-digit code, argon2-hashed in Redis, 5-min TTL.
- Rate-limited per phone (5/h) and per IP (20/h); verify endpoint caps at 5 attempts.
- **JWT pair on verify:**
  - Access: RS256, 15 min, has `jti`.
  - Refresh: opaque, 30 d, argon2-hashed in Postgres, has `familyId`.
- **Refresh rotation with family-based replay detection** — using a revoked refresh revokes the entire `familyId` chain, logs a security event, returns 401.
- **Client implication:** The Expo app MUST use a **single-flight refresh mutex** (singleton promise around the refresh call) so concurrent 401s from in-flight requests don't trigger N parallel refreshes — which would look like a replay attack and force re-login.

### Real-time chat protocol
- **Socket.IO over WSS.** JWT in the handshake `auth` payload. Rooms keyed `group:{groupId}`. Presence in Redis sets with TTL refresh on heartbeat.
- **Sending a message:**
  ```
  emit "message:send" { groupId, type, content?, mediaObjectKey?, clientMessageId }
  → server validates via shared zod schema
  → checks membership of (userId, groupId)
  → acquires per-group BigInt sequenceNumber via Postgres advisory lock
  → inserts Message row (idempotent on clientMessageId per sender)
  → emitMasked(groupId, "message:new", message)
  → acks { messageId, sequenceNumber }
  → enqueues BullMQ push for offline members
  ```
- **Replay on reconnect:**
  ```
  emit "session:resume" { groupId, lastSeenSequence }
  → server returns missed messages in order
  → paginated by "session:resume:more"
  ```
- **Client implication:** Store `lastSeenSequence` per group in **MMKV**. The sequence is a `BigInt` — serialize as string.

### Privacy engine (4 layers)
Product invariant: **a non-admin viewer must never receive a payload containing real `userId`, `phone`, or `displayName` of another user.**

- **Layer 0 — lint.** `eslint-plugin-privacy-mask` bans raw `socket.emit()` (must use `emitMasked()`) and raw Prisma entity returns from `.controller.ts` / `.gateway.ts` / `.service.ts` files.
- **Layer 1 — branded types.** `packages/shared/src/branded.ts` defines a `Masked` brand. Only `brandAsMasked()` produces a `Masked*` value. Controllers and gateway handlers declare `Masked*` return types — the compiler refuses any non-masked return.
- **Layer 2 — global response interceptor.** A NestJS interceptor inspects every non-admin payload for residual PII fields (`phone`, `senderUserId`, …) lacking the `__masked` brand → 500 + page on-call. Defensive backstop.
- **Layer 3 — `emitMasked()` socket wrapper.** Iterates connected sockets in a room, resolves each viewer's role, emits a per-viewer payload (admin → full PII, members → aliases). `AnomalyDetector.observe()` runs on every invocation; pages on residual PII leakage.

**Client implication:** the Expo client receives already-masked payloads. The only client obligation is to **not cache PII once received**, and to **not mix admin and member views** in shared state — which is structurally impossible because each socket gets its own per-viewer payload.

### Payments
- **Razorpay** with **RBI pre-debit / mandate** (Indian subscription compliance).
- Webhook idempotency via unique constraint on `razorpayEventId` (from the `x-razorpay-event-id` header). Second insert hits the constraint → 200 OK no-op.

### Scaling triggers (decided up-front)
| Component | Today | Scale when | Action |
|---|---|---|---|
| NestJS API + Gateway | 2 Fly × 2 CPU | ~5k concurrent sockets | `fly scale count` |
| Postgres (Neon) | Launch tier | DB CPU > 70% sustained | Bump compute / read replica |
| Redis (Upstash) | Pay-as-you-go | > 50% bandwidth quota | Upgrade tier |
| Socket.IO | Redis adapter | > 50k concurrent | Shard rooms by group hash |
| BullMQ workers | 1 × 1 CPU | `push` depth > 500 | Add workers (independent of API) |
| Hosting | Fly Mumbai | ~50k DAU | Migrate API to AWS ECS Fargate |

### Frontend implications — never forget these
1. **`react-native-mmkv` from day 1** — store `lastSeenSequence` per group, draft messages, settings.
2. **`zod`** — structure `src/features/*/types.ts` so they can later be replaced by imports from `packages/shared`.
3. **`expo-secure-store` for the refresh token** — NOT MMKV. MMKV is not hardware-backed.
4. **`socket.io-client`** — not raw WebSocket.
5. **Single-flight refresh mutex** on the client.
6. **`clientMessageId`** on every send for idempotency.

## 5. Directory layout

```
my-app/                       # the Expo app (current root)
  src/
    app/                      # expo-router file-based screens
    components/               # shared visual components (themed-text, themed-view, etc.)
    constants/                # theme.ts (Colors, Spacing, Fonts)
    hooks/                    # use-theme, use-color-scheme
    features/                 # PLANNED — feature folders
      chat/
        components/           # MessageBubble, ChatRow, ChatHeader, VoiceNotePlayer
        hooks/                # useThread, useMessages
        data/                 # repositories + mock store + seed (interface-first)
        types.ts              # Message, Thread, Contact (mirror future packages/shared)
        copy.ts               # all strings, ready for future i18n
    lib/                      # PLANNED — pure utilities (formatTimestamp, parsePhone, mmkv-store)
  assets/                     # images, audio, fonts
docs/
  brd/                        # Business Requirements Documents per feature
    1-on-1.md                 # current slice
  architecture/               # contributor reference docs
    expo-skills.md            # the Expo SDK + EAS skills map
    backend.md                # PLANNED — full friend's architecture doc (verbatim)
Scalechat Pdf (2).pdf         # canonical pitch (project root)
```

**Monorepo restructure** (to `apps/mobile`, `apps/api`, `apps/worker`, `packages/shared`) happens when backend work starts. **Not now.**

## 6. Conventions

- **Path aliases** (already in `tsconfig.json`): `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- **File naming:** kebab-case files (`chat-row.tsx`), PascalCase component exports.
- **Theme tokens** live in `src/constants/theme.ts`. Extend, don't sprinkle. New tokens go in there.
- **Components must respect dark mode.**
- **Never use raw `Text` / `View` from `react-native`** in screens — always `ThemedText` / `ThemedView`.
- **Strings** live in `features/<feature>/copy.ts`, not inline JSX.
- **Mock data** is seeded with realistic Indian names + `+91` phones to match the production audience.

## 7. Working agreement

- Default flow: **design intent → BRD → screen skeleton with mock data → polish → swap backend.**
- When you don't have the design context, **fetch it via the Figma MCP** (`get_design_context`) — don't guess from text descriptions.
- **Don't add features outside the current BRD** without updating the BRD first.
- For every Expo module: **read the v56 docs first** (see §2).

## 8. Useful commands

From `my-app/`:

```bash
npm install
npm run start          # expo start (dev server + QR)
npm run android        # open Android emulator/device
npm run ios            # open iOS simulator/device
npm run web            # open web build
npm run lint           # expo lint
npm run reset-project  # nuke starter and start fresh
```

EAS commands (build, update, submit) — see [`../docs/architecture/expo-skills.md`](../docs/architecture/expo-skills.md) §G.

## 9. Key files index

| File | Purpose |
|---|---|
| `AGENTS.md` | Expo 56 version warning — read before any Expo API call |
| `app.json` | Expo config: scheme `myapp`, splash `#208AEF`, EAS projectId, typedRoutes + reactCompiler experiments |
| `eas.json` | development / preview / production build profiles |
| `tsconfig.json` | `@/*` and `@/assets/*` path aliases |
| `src/constants/theme.ts` | Colors, Spacing, Fonts — the only place to add design tokens |
| `src/components/themed-text.tsx` | base text primitive |
| `src/components/themed-view.tsx` | base view primitive |
| `../docs/brd/1-on-1.md` | current BRD (1-on-1 messaging slice) |
| `../docs/architecture/expo-skills.md` | Expo SDK + libraries + EAS workflow map |
| `../Scalechat Pdf (2).pdf` | canonical pitch deck |
