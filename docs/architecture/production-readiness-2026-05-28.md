# ScaleChat — Production-Readiness Research Doc & Launch Plan

> **Author:** Claude Code (Opus 4.7, 1M ctx) — for surya
> **Date:** 2026-05-28
> **Status:** Draft for review. Locks in service decisions and production roadmap before more code accumulates.

---

## Context — why this doc exists

ScaleChat's 1-on-1 chat slice is functionally complete (messaging, replies, deletes, media, voice notes, calls, polls, contact profile P1+P2, blocks, mutes, presence, typing, read receipts). The next move is **production launch**, and surya wants to lock in service choices NOW so that future code doesn't pile on assumptions that have to be ripped out later.

User's stated constraints (resolved via two clarifying rounds):

| Decision | Resolution |
|---|---|
| Market | Private-beta worldwide in 2-3 wk (whitelist gated), public worldwide in v1.1 |
| Budget | Moderate (~$200-400/mo); wants AWS-vs-current-stack comparison written into this doc |
| Timeline | 2-3 weeks to private beta |
| E2E encryption | Defer to v1.1+ (existing docs stance) |
| Target | iOS + Android, both via Expo dev-client → EAS Build |

What's **already decided in the codebase** (so this doc validates rather than re-litigates them):

- **OTP** — Twilio Verify (provider seam wired; docs at `docs/progress/otp-research.md`)
- **Calls (A/V)** — LiveKit Cloud (live + verified 2026-05-26; docs at `docs/architecture/calls-provider-poc.md` §8.1)
- **Media storage** — Cloudflare R2 (presigned PUTs, zero egress, global CDN)
- **Messages DB** — Postgres on Neon (Prisma 7, autoscaling)
- **Cache/queue/PubSub** — Redis on Upstash (Socket.IO adapter, BullMQ, OTP store, rate limits)
- **Backend deploy** — Fly.io (`apps/api/fly.toml` scaffolded for Bombay)

**Correction from user's tentative list:** "LiveKit for media (PDFs, videos, audio, pictures)" is incorrect — LiveKit is a real-time WebRTC SFU (for live calls), not a file store. The codebase correctly uses Cloudflare R2 for media. We keep R2.

---

## 0. TL;DR — the recommendation

1. **Stay on Fly + Neon + Upstash + R2 + LiveKit Cloud + Twilio Verify + Expo Push.** Migrate to AWS at the 50k-DAU scaling trigger, NOT now. At 10k DAU, AWS is ~2.5× more expensive (~$1,000 vs ~$400/mo with everything wired) AND costs 4-6 weeks of code rewrite. Detailed comparison in §1. Private-beta cost ~$120/mo (§5.1).
2. **Private-beta worldwide (whitelist) in 2-3 weeks.** This is the realistic ASAP path. Public worldwide ships in v1.1 once Twilio per-market carrier registrations clear and i18n framework lands.
3. **10 production-hygiene gaps to close before private beta** (each ≤1 day of work; ~10 engineering days total over 3 calendar weeks): Sentry, `worker.ts` process split, `expo-server-sdk`, GitHub Actions CI/CD, multi-region Fly, Apple Dev Program enrollment + APNs `.p8`, OTP whitelist, edge WAF rules at Cloudflare, deep `/ready` health check, backup/DR runbook.
4. **No code refactors needed.** Every gap is additive — new files, env vars, infra config. Existing code stays.

---

## 1. AWS vs current stack — full comparison

This is the question surya explicitly asked be settled. I'm going to be a top-1% advisor here: the cost math says current stack wins decisively at 10k DAU, but there are 3 specific situations where AWS would actually win.

### 1.1 Cost at 10k DAU, ~100k msg/day, ~200k call-min/mo video

| Component | Current stack | AWS equivalent | AWS premium |
|---|---:|---:|---:|
| API host (2 CPU × 1 GB × 3 regions) | Fly Machines: **$40** | ECS Fargate (0.5 vCPU × 1 GB × 3 task × 3 region): **$130** | +225% |
| Worker process | Fly Machines (1×): **$10** | ECS Fargate (1×): **$25** | +150% |
| Postgres (single primary + 1 read replica) | Neon Launch: **$19** + **$30 storage/compute** | RDS db.t4g.small Multi-AZ + 1 read replica: **$140** | +180% |
| Redis | Upstash Pay-as-go: **$30** | ElastiCache cache.t4g.small Multi-AZ: **$50** | +66% |
| Object store (~500 GB at rest, ~1 TB egress) | R2: **$8** ($0 egress) | S3: **$12** + **$92 egress** = **$104** | +1200% |
| Real-time A/V (~200k video-min) | LiveKit Cloud: **$100** | Chime SDK Video: **$340** | +240% |
| OTP | Twilio Verify: **$120** (3k sign-ups @ $0.04) | Same (Twilio runs on AWS too): **$120** | 0% |
| CDN edge | Cloudflare (free) | CloudFront: **$30** | +∞ |
| Observability | Sentry Team: **$26** | CloudWatch + X-Ray: **~$50** | +92% |
| Push notifications | Expo Push: **$0** | Same (Expo backed by FCM/APNs): **$0** | 0% |
| **Total ($/mo)** | **~$383** | **~$1,001** | **+161%** |

> Egress is the dagger. R2's zero-egress pricing means a chat app pushing media to users costs nothing in bandwidth. S3 charges $0.09/GB egress — at 1 TB/mo (very modest for 10k DAU watching shared videos) that's $92 in egress alone, before any compute.

### 1.2 Beyond cost — what AWS actually buys you

✅ **Unified IAM** — one identity provider for everything (real benefit at 5+ engineers)
✅ **Single bill, single support contract** — useful for SOC2 audits
✅ **Savings Plans / Reserved Instances** — at ~50k DAU sustained, kick in ~30% discount
✅ **Access to Bedrock, Kendra, Comprehend** — if you ever want to add AI features
✅ **VPC peering** — enterprise-grade network isolation
❌ **Egress fees** — eats the cost advantage at any media-heavy workload
❌ **Cold-start latency on Fargate** — Fly Machines wake in <1s, Fargate in 10-30s
❌ **Complexity tax** — IAM policies, security groups, NAT gateways, VPC endpoints… every action is a YAML file
❌ **Chime SDK is expensive and Indian-region thin** (no Mumbai SFU edge as of writing)

### 1.3 Code-rewrite cost of moving to AWS now

| Subsystem | Current code | AWS rewrite required |
|---|---|---|
| Media | `apps/api/src/modules/media/r2.client.ts` uses `@aws-sdk/client-s3` against R2's S3-compatible API | **None** (S3 is the original target — just swap endpoint). ✅ trivially portable |
| Database | Prisma 7 → Postgres | **None** if RDS Postgres. Migrate Neon → RDS via `pg_dump`/`pg_restore` (~30 min for <10 GB) |
| Cache | `ioredis` against Upstash | **None** — ElastiCache speaks Redis protocol |
| Calls | LiveKit Cloud client | **Major.** Either self-host LiveKit on EKS ($200/mo for k8s + 2 SFU nodes minimum) or rip out LiveKit and adopt Chime SDK (different API, different React Native SDK, different webhook shape). ~3-4 wk rewrite |
| Deploy | `apps/api/fly.toml` (~50 lines, declarative) | ECS task def + ALB + target group + IAM roles + CloudFormation/Terraform. ~1-2 wk |
| CI/CD | Future GitHub Actions calling `fly deploy` | GitHub Actions calling `aws ecs update-service` + CodeDeploy. Equal effort either way |

> **Net rewrite cost to move to AWS now: 4-6 weeks of engineering** that doesn't add a single user-visible feature. At 10k DAU you're paying ~$600/mo MORE for the privilege of having spent that time.

### 1.4 The three situations where AWS does win

1. **Enterprise sales motion at sub-50k DAU.** If you go B2B and sell to a Fortune 500 that requires "all our vendors run on AWS with SOC2 in our AWS Organization," fly+neon doesn't fit.
2. **Compliance pinning.** Some Indian/EU markets require data residency proof via specific certifications that AWS provides natively (BIS, ISO 27018). Fly, Neon, Upstash all have SOC2 but not BIS.
3. **Sustained 50k+ DAU with Savings Plans.** Reserved Instance pricing for 3-year commitment cuts AWS cost ~50%. At sustained 50k DAU the math flips.

None of those apply at ScaleChat's launch.

### 1.5 Recommendation

**Stay on current stack for v1 and v1.1.** Re-evaluate AWS migration at the 50k-DAU trigger documented in `CLAUDE.md` scaling table. Pre-write the migration playbook now (estimated 4-6 weeks when triggered), so the decision is mechanical when revenue justifies it.

The hybrid option (AWS compute + Neon-equivalent on RDS, keep R2 + LiveKit Cloud) saves money vs full-AWS but loses the "single bill / unified IAM" pitch — defeating the only reason to switch. **Not recommended.**

---

## 2. Service-by-service decisions for production

### 2.1 OTP — Twilio Verify ✅ (no change)

**Status:** Already wired (`docs/progress/otp-research.md`). Provider seam in `apps/api/src/modules/auth/services/providers/`. Country allow-list gate (`OTP_ALLOWED_COUNTRIES`) blocks unsupported markets BEFORE Twilio is hit (primary SMS-pumping defense).

**Private-beta gating (2-3 wk path):**
- Set `OTP_ALLOWED_COUNTRIES=IN,US,GB,AE,SG` (your top-5 known-friendly markets).
- Twilio default sender works without per-market carrier registration up to ~50 SMS/day/sender. Fine for ~500-user beta.
- Cost: $0.04/sign-up on average; 500 users × 1.5 retries ≈ $30 over 4 weeks.

**v1.1 (public worldwide):**
- File **US 10DLC brand + campaign** (Twilio Console → Messaging → Regulatory Compliance). Takes 5-10 business days for carrier approval.
- File **India DLT** registration if going public in India (KYC + entity proof).
- File **Brazil ANATEL** if launching there (much slower, ~4 wk).
- Enable Twilio Fraud Guard (on by default; verify settings).
- Cost at 10k DAU (3k new sign-ups/mo): ~$120/mo.

**Open risk:** Twilio per-market pricing varies wildly. Brazil SMS is $0.058 (15× India). If you want Brazil at launch, budget for it.

### 2.2 Calls (A/V) — LiveKit Cloud ✅ (no change)

**Status:** Live + verified 2026-05-26 with a 94-second 2-party call across two emulators. Backend (`apps/api/src/modules/calls/`), mobile UI (`my-app/src/app/chat/call.tsx`), webhooks, push wakeup all wired. Documented at `docs/architecture/calls-provider-poc.md`.

**Why LiveKit Cloud over self-host or alternatives:**
- 8× cheaper than Agora and Chime SDK for video ($0.0005/min vs $0.004/min)
- Apache 2.0 license — self-host escape valve if cloud pricing changes adversely
- React Native SDK (`@livekit/react-native`) actively maintained
- WebhookReceiver for server-side call lifecycle already wired

**Production checklist:**
- [ ] Confirm LiveKit Cloud project region matches Fly primary region (US East = `iad`, EU = `fra`). Latency-sensitive.
- [ ] Set `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` as Fly secrets (not env files in repo).
- [ ] Test 3 simultaneous calls under load (BullMQ ring-timeout race when 3 callers ring same user).
- [ ] Add LiveKit dashboard alerts: failed publish > 5%, room-end abnormal > 2%.

**iOS gating:** Calls work in the dev client today. For App Store ship, need CallKit native UI integration (`react-native-callkeep`) + VoIP push cert. **Deferred to v1.1** per `docs/architecture/ios-enablement-checklist.md`. Beta users on iOS will see in-app call screen only (no lock-screen native UI).

### 2.3 Media storage — Cloudflare R2 ✅ (no change)

**Status:** Live for images + voice + documents + video. Presigned PUT URLs (5-min TTL), key validation against sender's `userIdFirst8` prefix prevents key collision attacks. Documented at `docs/architecture/production-deployment.md` §1.

**Why R2 beats S3 for chat:**
- **Zero egress fees** — your bandwidth bill stays at $0 regardless of how many users open shared media
- S3-compatible API — `@aws-sdk/client-s3` works against R2 with endpoint swap (already done)
- Global edge CDN baked in
- $0.015/GB-month storage vs S3's $0.023/GB

**Production checklist:**
- [ ] Add `media:cleanup` BullMQ worker (Phase 3.3 queued per CLAUDE.md). Enqueues `DeleteObjectCommand` when messages are tombstoned >30 days OR when users delete account. Without this, R2 grows indefinitely.
- [ ] Configure R2 lifecycle rule: auto-delete `chat-media/` objects unreferenced in DB after 90 days (defensive cleanup if worker fails).
- [ ] Profile avatars: implement `profile-media/{userIdFirst8}/avatar.{ext}` prefix (Phase B follow-up, not shipped yet — surya mentioned profile pics in the original list).
- [ ] Set bucket-level R2 access policy: PUT only via presigned URL (no public PUT), GET public.

### 2.4 Messages storage — Postgres on Neon ✅ (no change)

**Status:** Live. Schema mature (`apps/api/prisma/schema.prisma`). Indexed for keyset pagination. Migrations via `prisma migrate deploy`.

**Why Neon over RDS for v1:**
- $19/mo Launch tier vs $70/mo RDS Multi-AZ minimum
- **Branching** — preview environments can fork the prod DB in seconds (massive dev velocity win)
- Bottomless storage (no provisioning)
- Built-in connection pooler (PgBouncer-equivalent)
- Single-region default — sufficient for v1 + v1.1

**Production checklist:**
- [ ] Add `@@index([deletedAt])` on `Message` (currently missing per explorer report — tombstone queries scan full chat history).
- [ ] Enable Neon **Point-in-Time Recovery** in Console (free on Launch tier, 7-day window).
- [ ] Set Neon autoscaling **max** to a sane ceiling (e.g., 2 CU = ~$200/mo cap) so a runaway query doesn't bankrupt you.
- [ ] Enable Neon **read replica in EU region** when adding the `fra` Fly region.

**v1.1 / scale concern:** If a market demands strict data residency (EU citizens' data stays in EU), Neon supports regional databases. You'd shard `User` by `regionCode` and route the API request to the region-local Neon. Defer until a market formally demands it.

### 2.5 Cache / queue / PubSub — Redis on Upstash ✅ (no change)

**Status:** Live. Socket.IO Redis adapter, BullMQ queues, OTP store, rate-limit buckets, presence/typing TTLs.

**Production checklist:**
- [ ] Upgrade to **Upstash Global** (multi-region replicated) when adding 2nd Fly region. ~$30/mo.
- [ ] Set BullMQ retry policy: 3 attempts with exponential backoff for push fan-out.
- [ ] Add `BullMQ.Queue.metrics` export to a Prometheus endpoint (gives queue depth + processing rate without paying for Datadog).

### 2.6 Push notifications — Expo Push ✅ (no change)

**Status:** Android live. iOS scaffolded but blocked on Apple Dev Program enrollment.

**Why Expo Push over direct FCM/APNs:**
- Free at all scales (subsidized by Expo)
- Single API for iOS + Android + Web
- Handles APNs/FCM token rotation automatically
- Built-in batching (100 messages per request)

**Critical gap:** `apps/api/src/modules/push/push.service.ts` calls Expo HTTP directly with `fetch`. No batching, no retry, no queue. At 10k DAU this is a **bottleneck** — a single call notification fan-out blocks the API thread.

**Fix (1-day):**
- [ ] Add `expo-server-sdk` to `apps/api/package.json`
- [ ] Move push fan-out into BullMQ queue
- [ ] Run BullMQ workers in **separate Fly process** (`apps/api/src/worker.ts` entrypoint, declared in `fly.toml` `[processes]` table)

### 2.7 Backend deploy — Fly.io ✅ (no change)

**Status:** `apps/api/fly.toml` scaffolded for Bombay. Multi-region add documented at `docs/architecture/production-deployment.md`.

**Private-beta deploy (3 regions):**
- `bom` (Mumbai) — India primary
- `fra` (Frankfurt) — EU
- `iad` (US East — Ashburn) — Americas

**Why these three:** covers ~80% of internet population at <100ms p99 latency. Fly anycast routes users to nearest region automatically.

**v1.1 expansion:**
- Add `sin` (Singapore) for SE Asia after 1k+ DAU there
- Add `gru` (São Paulo) for Brazil/LATAM if Brazil market is in scope

**Production checklist:**
- [ ] Set Fly secrets (`fly secrets set`) for all `apps/api/.env.example` items
- [ ] Configure `[processes]` group to split API + worker
- [ ] Enable `[deploy] strategy = "bluegreen"` for zero-downtime rollouts
- [ ] Configure Fly health check to hit `/ready` (deep — DB+Redis+LiveKit ping) not just `/health`

### 2.8 Observability — Sentry ✅ (new — adding now)

**Status:** None today. Pino logger writes to stdout; Fly captures but no error aggregation, no release tracking, no source maps.

**Why Sentry over Datadog/NewRelic at this scale:**
- $26/mo Team tier covers backend + mobile + 50k events/mo
- React Native SDK + NestJS SDK are first-class
- Source-map upload on EAS Build is documented
- Datadog APM is $31/host/mo just for tracing — overkill at 3 Fly Machines

**Production checklist (~1 day):**
- [ ] Add `@sentry/node` to `apps/api`, wire in `main.ts` before `app.listen()`
- [ ] Add `@sentry/react-native` to `my-app`, wire in `_layout.tsx`
- [ ] Configure release tracking via EAS Build hooks (auto-uploads source maps on each build)
- [ ] Set Sentry sample rate: 100% errors, 10% traces, 0% session replays (privacy)
- [ ] Create Sentry alert: error rate > 5% over 5min → email + Slack

### 2.9 CI/CD — GitHub Actions ✅ (new — adding now)

**Status:** Empty `.github/workflows/`. Commits land without automated checks. Manual `fly deploy` from a dev machine.

**Minimum viable CI/CD (~1 day):**
- `.github/workflows/ci.yml` — runs on PR: lint + `jest` (api+mobile) + `e2e` (api supertest)
- `.github/workflows/deploy.yml` — runs on `main` merge: `fly deploy --strategy=bluegreen` after CI passes
- `.github/workflows/mobile-build.yml` — runs on `main` merge: `eas build --platform=all --profile=preview` to TestFlight + Play Console Internal

**Branch protection:** main requires CI green before merge (one-click enable in Settings).

### 2.10 Compliance + privacy ⚠️ (partial — needs work for public worldwide)

**Today:** Privacy interceptor + Masked branded types + audit logs (4-layer privacy engine in `apps/api/src/common/`). TLS in transit. R2 server-side encryption at rest. No E2E.

**Private beta (2-3 wk):**
- Add `PRIVACY_POLICY_URL` + `TERMS_URL` env vars (or static MD pages served from `apps/api/src/legal/`)
- Implement `DELETE /me` for account deletion (GDPR Article 17 right to erasure). Cascades to `Message`, `ChatMember`, `Contact`, `OtpRequest`. Soft-delete user + hard-delete PII (`phoneE164`, `fullName`, `avatarUri`) after 30 days. **Required by Apple/Google in 2026.**
- Add `GET /me/export` for data portability (GDPR Article 20). Returns ZIP of user's messages + profile.

**v1.1 (public worldwide):**
- Sign **DPA with Twilio** (data processing agreement) — required for EU users
- Sign **DPA with Cloudflare** (R2 + Workers)
- Sign **DPA with Neon** (Postgres)
- Publish privacy policy with sub-processor list
- Optional: get a privacy review from a third-party (€2-5k EU lawyer one-off)

---

## 3. Private-beta worldwide plan (2-3 weeks)

### 3.1 Week 1 — production hygiene + iOS unblock

| Day | Task | Output | Owner |
|---:|---|---|---|
| 1 | Sentry backend + mobile wired | Errors aggregating | Eng |
| 2 | `expo-server-sdk` + `apps/api/src/worker.ts` + Fly `[processes]` split | Push fan-out async/batched | Eng |
| 3 | GitHub Actions: ci.yml + deploy.yml + branch protection | Automated PR gates + main→prod deploy | Eng |
| 1-5 | **Apple Developer Program enrollment ($99)** — runs in parallel (calendar bottleneck) | Apple Dev Team ID | surya |
| 4 | `/ready` deep health check (DB ping + Redis ping + LiveKit ping) | Fly LB rolls out only when API is truly ready | Eng |
| 5 | Cloudflare in front of Fly: WAF rules (block known bots, geo-restrict if needed), edge rate limit | Edge protection in place | Eng |

### 3.2 Week 2 — multi-region + iOS push + whitelist

| Day | Task | Output | Owner |
|---:|---|---|---|
| 6 | `fly regions add fra iad` + Neon EU read replica | 3-region API live | Eng |
| 7 | Once Apple Dev approved → mint APNs `.p8` → `eas credentials` upload | iOS push tokens deliverable | Eng |
| 8 | First iOS EAS Build → TestFlight | iOS dev client installable on physical device | Eng |
| 9 | OTP whitelist toggle: `OTP_BETA_ALLOWLIST_E164` env (comma-list); OTP request rejects with 403 `not_in_beta` for non-list phones | Whitelist gating live | Eng |
| 10 | Backup/DR runbook (`docs/architecture/backup-dr.md`): Neon PITR window, restore steps, Redis-loss acceptance criteria, RTO 1h / RPO 5min | Documented disaster procedure | Eng |

### 3.3 Week 3 — load test, beta cohort, store assets

| Day | Task | Output | Owner |
|---:|---|---|---|
| 11-12 | Load test: artillery script simulating 1k concurrent sockets sending 10 msg/min each; observe p99 latency, Neon CPU, Redis ops/sec | Confidence at ~1k concurrent; identify bottlenecks before users | Eng |
| 13 | App Store / Play Store metadata: screenshots, descriptions, privacy labels, ratings questionnaire | Store listings draft-ready | surya + Eng |
| 14 | Submit iOS TestFlight build for review (1-2 day Apple turnaround); Play Internal Track upload | iOS in TestFlight; Android in Internal Track | Eng |
| 15 | First ~50 beta users (whitelisted) onboarded; Slack channel for feedback | Live data flowing | surya |

### 3.4 Critical-path dependencies

```
Apple Dev Program enrollment ($99, day 1) ─┬─→ APNs .p8 (day 7) ─→ iOS EAS Build (day 8) ─→ TestFlight (day 14)
                                            │
Twilio Verify config (day 1)               └─→ already wired
                                            
GitHub Actions (day 3) ───────────────────────→ deploy.yml gates everything from day 6+
                                            
Multi-region Fly + Neon (day 6) ───────────→ load test (day 11-12)
```

The single biggest schedule risk is **Apple Developer Program enrollment** taking >5 business days (it can take up to 14 if Apple flags the account). Mitigation: surya enrolls TODAY before any other work starts.

---

## 4. v1.1 public worldwide expansion (6-8 weeks after beta)

### 4.1 Parallel workstreams

**WS-A: i18n framework (~1-2 wk)**
- Adopt `i18next` + `expo-localization`
- Extract all `features/*/copy.ts` strings into `locales/{en,hi,ar,es,pt}.json`
- Add country picker UI to phone screen (replaces `+91` hardcoded default)
- Locale-aware time formatting (`Intl.DateTimeFormat` driven by device locale)
- Replace `₹` hardcode with `Intl.NumberFormat(locale, { style: 'currency' })`

**WS-B: Twilio market registrations (~2-4 wk calendar; ~1 day of work each)**
- US 10DLC brand + campaign → ~5-10 business days carrier approval
- India DLT → KYC + entity proof, ~2 wk
- UK / EU → built into Twilio Verify, no separate registration
- Brazil ANATEL (only if launching there) → ~4 wk

**WS-C: iOS CallKit (~1 wk eng + 1 wk Apple review)**
- Mint VoIP push cert (separate from regular APNs `.p8`)
- Integrate `react-native-callkeep`
- Wire backend to send VoIP push via separate Expo channel
- Test on real device (CallKit doesn't work in simulators)

**WS-D: Public sign-up (depends on WS-A + WS-B)**
- Remove `OTP_BETA_ALLOWLIST_E164` env (or set empty)
- Trigger marketing push
- Monitor Sentry + Fly metrics closely for 72 hours

**WS-E: Compliance closeout (~1-2 wk, mostly legal)**
- Privacy policy publication
- DPAs with Twilio, Cloudflare, Neon, Upstash
- (Optional) SOC2 Type 1 readiness audit (~$5-10k via Vanta)
- (Optional) third-party privacy review (~€2-5k EU lawyer)

### 4.2 v1.1 region expansion

Once 1k+ DAU in a region, add the nearest Fly region:
- SE Asia (Singapore traffic > 500 DAU) → `fly regions add sin`
- LATAM (Brazil traffic > 500 DAU) → `fly regions add gru`
- Australia (>200 DAU) → `fly regions add syd`

Each new region adds ~$10/mo Fly + Neon read replica cost.

---

## 5. Cost projections

### 5.1 Private beta (~500 active users, 5k msg/day, 1k call-min/day)

| Line item | Monthly |
|---|---:|
| Fly Machines (3 regions × small) | $30 |
| Neon Launch + EU read replica | $25 |
| Upstash Pay-as-go | $10 |
| Cloudflare R2 (~50 GB) | $1 |
| LiveKit Cloud | $5 |
| Twilio Verify (500 sign-ups @ avg $0.04) | $20 |
| Expo Push | $0 |
| Sentry Team | $26 |
| Cloudflare (free tier) | $0 |
| **Total** | **~$117/mo** |

### 5.2 v1.1 public — 10k DAU (~3k new sign-ups/mo, 100k msg/day, 200k video-min/mo)

| Line item | Monthly |
|---|---:|
| Fly Machines (3 regions) | $120 |
| Neon Launch + read replica + storage | $50 |
| Upstash Global | $30 |
| R2 (~500 GB + free egress) | $8 |
| LiveKit Cloud (200k video-min) | $100 |
| Twilio Verify (3k sign-ups + per-market fees) | $150 |
| Expo Push | $0 |
| Sentry Team | $26 |
| Apple Developer Program ($99/yr amortized) | $9 |
| Google Play Developer ($25 one-time amortized) | $0 |
| **Total** | **~$493/mo** |

### 5.3 v2 scale point (50k DAU)

Estimate: ~$2,000-2,500/mo on current stack. AWS migration becomes credible here — re-evaluate at that point with the playbook this doc unlocks.

---

## 6. Production-readiness gaps — final checklist

Tick these off before private-beta launch. Each line item is ≤1 day of engineering work.

- [ ] **Sentry backend** — `@sentry/node` in `apps/api/src/main.ts` before `app.listen()`. DSN as Fly secret.
- [ ] **Sentry mobile** — `@sentry/react-native` in `my-app/src/app/_layout.tsx`. DSN as EAS env var.
- [ ] **`expo-server-sdk`** — add to `apps/api/package.json`. Replace inline `fetch` calls in `push.service.ts` with batched `ExpoPushSdk.chunkPushNotifications`.
- [ ] **`worker.ts` entrypoint** — `apps/api/src/worker.ts` bootstraps `BullMQ.Worker` for `push:fan-out`, `media:cleanup`, `call:ring-timeout`. Run in separate Fly process via `[processes] api = "node dist/main.js"; worker = "node dist/worker.js"`.
- [ ] **GitHub Actions ci.yml** — runs `npm run lint && npm test && npm run test:e2e` on PR. Branch protection requires green.
- [ ] **GitHub Actions deploy.yml** — runs `fly deploy --strategy=bluegreen` on main merge. `FLY_API_TOKEN` as GH secret.
- [ ] **Multi-region Fly** — `fly regions add fra iad`. Verify with `fly status` showing 3 regions.
- [ ] **Neon EU read replica** — enable in Neon Console. Add `NEON_READ_REPLICA_URL` env. Add Prisma read replica via `@prisma/extension-read-replicas`.
- [ ] **Apple Developer Program enrollment** ($99) — surya enrolls **TODAY**. Calendar bottleneck of ~5-10 days.
- [ ] **APNs `.p8` key** — generate in Apple Dev Console, upload via `eas credentials`.
- [ ] **iOS first EAS Build** — `eas build --platform=ios --profile=development`. Install on physical device via TestFlight.
- [ ] **OTP whitelist** — `OTP_BETA_ALLOWLIST_E164` env. Reject `OTP request` with 403 `not_in_beta` for non-list phones. Quick toggle to disable for public launch.
- [ ] **Cloudflare in front of Fly** — point DNS at Cloudflare proxy. Add WAF managed rules (OWASP, bot management). Set edge rate limit `60 req/min/IP` on `/auth/*` paths.
- [ ] **Deep `/ready` health check** — `apps/api/src/health/ready.controller.ts` returns 200 only when DB ping + Redis ping + LiveKit reachable all succeed. Fly LB hits this not `/health`.
- [ ] **Backup/DR runbook** — `docs/architecture/backup-dr.md`. Neon PITR window, restore steps, Redis-loss acceptance, RTO 1h / RPO 5min.
- [ ] **`DELETE /me` endpoint** — GDPR right to erasure. Soft-delete user, hard-delete PII after 30 days.
- [ ] **`GET /me/export` endpoint** — GDPR data portability. Returns ZIP of user's messages + profile.
- [ ] **R2 media cleanup worker** — BullMQ job triggered on `message:deleted` and nightly cron for tombstones >30d.
- [ ] **Privacy policy + ToS** — static MD served from `apps/api/src/legal/`. Linked from Settings.
- [ ] **App Store + Play Store metadata** — screenshots (Figma + simulator), descriptions, privacy labels, age ratings.

Total: ~10 engineering days (parallelizable to ~3 calendar weeks alongside Apple enrollment).

---

## 7. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Apple Dev Program enrollment delayed >2 wk | Medium | High (blocks iOS launch) | surya enrolls TODAY, before any other work |
| LiveKit Cloud price hike or outage | Low | Medium | Apache 2.0 license = self-host escape valve (~3 wk to migrate) |
| Twilio per-market spend balloons (SMS pumping in Brazil/Vietnam) | Medium | Medium-High | Country allow-list already gates this. Set `OTP_ALLOWED_COUNTRIES` conservatively for beta |
| Single-primary Neon goes down | Low | High (chat unusable) | Neon PITR + a documented runbook to promote read replica → primary in ~10 min |
| Push notification fan-out bottlenecks under load | Medium | Medium | Worker process split fixes this (item #4 in checklist) |
| Cloudflare R2 outage (rare but happens) | Low | Medium | Media access fails but text chat continues. Acceptable. |
| App Store rejection on privacy labels | Medium | Medium | Match Apple's data-collection questionnaire precisely. Use `expo-tracking-transparency` even though not tracking. |
| Beta whitelist leaks (someone shares the QR/link) | Low | Low | Whitelist gates at phone-number layer (env list); even if app installed, OTP request returns 403 |
| Neon free tier auto-suspend during low traffic | High (in early beta) | Low | Neon Launch tier ($19) keeps DB always-on. Already specced. |

---

## 8. Verification — how to know we're ready to launch

**Mechanical checks (pass = green):**
- [ ] `fly status` shows 3 regions all healthy
- [ ] `curl https://api.scalechat.live/ready` returns 200 with `{db: 'ok', redis: 'ok', livekit: 'ok'}`
- [ ] `gh pr create` triggers CI; CI is green; merging triggers prod deploy
- [ ] Sentry shows the deploy event with source maps; test error from prod appears within 30s
- [ ] iOS TestFlight build installable on real iPhone; OTP login succeeds; calls work
- [ ] Android Play Internal Track build installable; OTP login succeeds; calls work
- [ ] Whitelisted phone gets OTP within 30s; non-whitelisted phone gets 403 `not_in_beta`
- [ ] Load test (1k concurrent sockets, 10 msg/min each) sustains p99 latency <500ms for 30 min

**Behavioral checks (5 humans testing for 30 min each):**
- [ ] Send/receive text, image, voice note, document, video — all bidirectional
- [ ] 1-on-1 voice call from iOS to Android — accept, talk 2 min, hang up, see CALL_EVENT pill
- [ ] 1-on-1 video call — same
- [ ] Block + Unblock cycle works; muted notifications don't ring; cleared chat doesn't reappear
- [ ] Force-quit app, reopen — session resumes, last 50 messages render in <2s
- [ ] Kill network mid-send — message shows `sending`, retries on reconnect

**Process checks:**
- [ ] Backup runbook tested at least once (restore a Neon branch from PITR, confirm data integrity)
- [ ] On-call rotation defined (even if it's just surya for the first month)
- [ ] Sentry alert thresholds set; one test alert fires and routes to email

---

## 9. What this doc does NOT cover (call-outs for future)

These are explicitly out of scope for v1 / v1.1 to keep the doc focused, but flagged so they're not forgotten:

- **Group chat / Super Groups** (the actual product differentiator per `docs/brd/`). Slot in behind existing interfaces after 1-on-1 stabilizes.
- **Payments / Razorpay** integration. The product's monetization model. Sketched in `my-app/CLAUDE.md` §4 but not in v1 scope.
- **E2E encryption (Signal Protocol).** Deferred to v1.1+ per user decision. When implemented, requires backend key server + per-device prekey bundle + mobile libsignal bindings.
- **SOC2 audit.** Not needed for B2C launch. Becomes relevant if B2B sales motion opens.
- **Web client.** Mobile-only for v1 + v1.1.
- **AI features (smart replies, translation, search).** Possible v2 product expansion using Anthropic API (codebase has Claude API skill available); out of scope here.

---

## 10. Decisions to lock in (no further re-litigation)

Surya: by approving this doc, you're agreeing that the following are FROZEN for v1 + v1.1, freeing the codebase to move forward without re-architecting:

| Decision | Lock-in |
|---|---|
| OTP provider | Twilio Verify |
| Calls provider | LiveKit Cloud |
| Media storage | Cloudflare R2 |
| Database | Postgres on Neon |
| Cache/queue | Redis on Upstash |
| Backend host | Fly.io (multi-region) |
| Mobile build | EAS Build → TestFlight + Play Internal Track |
| Push notifications | Expo Push |
| Observability | Sentry Team |
| Edge / WAF | Cloudflare |
| E2E encryption | Deferred to v1.1+ |
| Cloud provider migration trigger | 50k DAU (NOT now) |

Anything else that becomes a question later — debate it in a new doc, don't re-open these.

---

## Appendix A — files this doc references

For re-reading and cross-checking:

- `CLAUDE.md` — repo map + status snapshot
- `my-app/CLAUDE.md` — mobile architecture brief + working agreement
- `docs/progress/otp-research.md` — Twilio decision rationale
- `docs/architecture/calls-provider-poc.md` — LiveKit decision rationale §8.1
- `docs/architecture/ios-enablement-checklist.md` — iOS / APNs / CallKit blockers
- `docs/architecture/production-deployment.md` — deploy options (Fly vs GCP) + media architecture
- `docs/progress/1-on-1-production.md` — Phase 3.2 push worker, Phase 3.3 R2 cleanup
- `apps/api/fly.toml` — current Fly config (Bombay only)
- `apps/api/.env.example` — env var reference (62 lines, comprehensive)
- `apps/api/prisma/schema.prisma` — DB schema
- `apps/api/Dockerfile` — multi-stage build (already production-quality)
- `my-app/eas.json` — EAS Build profiles (iOS dev profile exists, not yet credentialed)
- `my-app/app.json` — Expo app config (bundle ID, splash, plugins)
