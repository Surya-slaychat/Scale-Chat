-- Tranche 2.H — Calls signalling (1-on-1 scope).
--
-- Backend foundation for voice/video calls. `call_sessions` is one row per
-- call lifecycle (RINGING → ACCEPTED → COMPLETED / DECLINED / MISSED). The
-- back-reference to `messages.id` lets the in-thread CALL_EVENT row
-- ("Missed voice call", "Video call · 4m 12s") point at its CallSession for
-- audit, and lets a CallSession discover its companion thread bubble.
--
-- Concurrency: the calls service serialises `accept` under
-- `pg_advisory_xact_lock(callIdToAdvisoryKey(callId))` so two devices can't
-- both win first-accept-wins. The advisory key family is the same shape as
-- `chatIdToAdvisoryKey` in messages.service.ts (signed bigint derived from
-- the UUID's first 8 hex bytes); the distinct UUID domains make collision
-- between chat-locks and call-locks astronomically unlikely.

CREATE TYPE "call_kind"   AS ENUM ('VOICE','VIDEO');
CREATE TYPE "call_status" AS ENUM ('RINGING','ACCEPTED','DECLINED','MISSED','COMPLETED');

CREATE TABLE "call_sessions" (
  "id"                     UUID PRIMARY KEY,
  "chat_id"                UUID NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
  "initiator_user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "callee_user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "kind"                   "call_kind"   NOT NULL,
  "status"                 "call_status" NOT NULL,
  "hms_room_id"            VARCHAR(64) NULL,
  "started_at"             TIMESTAMPTZ(6) NULL,
  "ended_at"               TIMESTAMPTZ(6) NULL,
  "duration_sec"           INT NULL,
  "call_event_message_id"  UUID NULL UNIQUE
                            REFERENCES "messages"("id") ON DELETE SET NULL,
  "created_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX "call_sessions_by_chat_idx"      ON "call_sessions"("chat_id", "created_at" DESC);
CREATE INDEX "call_sessions_by_initiator_idx" ON "call_sessions"("initiator_user_id", "created_at" DESC);
CREATE INDEX "call_sessions_by_callee_idx"    ON "call_sessions"("callee_user_id", "created_at" DESC);
