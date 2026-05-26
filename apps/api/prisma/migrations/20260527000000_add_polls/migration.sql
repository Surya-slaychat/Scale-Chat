-- Tranche 2.F — Polls (1-on-1 scope).
--
-- Three tables back the POLL message kind. The Message row itself stays narrow
-- (no JSON column, no per-kind sparse fields beyond what Tranche 2.B already
-- added); the poll-specific state lives in `poll_messages` (1:1 with Message),
-- `poll_options` (N:1 with poll_messages), and `poll_votes` (N:1 with both,
-- plus a voter user).
--
-- The natural-key uniqueness on `poll_votes (poll_message_id, voter_user_id,
-- poll_option_id)` lets the service swallow Prisma P2002 on a vote retry
-- (idempotency without an extra round-trip).
--
-- Concurrency: the service serialises concurrent votes on the same poll under
-- `pg_advisory_xact_lock(hash(poll_message_id))`. Different polls in the same
-- chat don't contend; different chats certainly don't.

CREATE TABLE "poll_messages" (
  "id"           UUID PRIMARY KEY,
  "message_id"   UUID NOT NULL UNIQUE REFERENCES "messages"("id") ON DELETE CASCADE,
  "question"     VARCHAR(300) NOT NULL,
  "anonymous"    BOOLEAN NOT NULL DEFAULT FALSE,
  "multi_select" BOOLEAN NOT NULL DEFAULT FALSE,
  "closed_at"    TIMESTAMPTZ(6) NULL,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "poll_options" (
  "id"              UUID PRIMARY KEY,
  "poll_message_id" UUID NOT NULL REFERENCES "poll_messages"("id") ON DELETE CASCADE,
  "ordinal"         INT NOT NULL,
  "label"           VARCHAR(120) NOT NULL,
  CONSTRAINT "poll_options_poll_message_id_ordinal_key" UNIQUE ("poll_message_id", "ordinal")
);

CREATE TABLE "poll_votes" (
  "id"              UUID PRIMARY KEY,
  "poll_message_id" UUID NOT NULL REFERENCES "poll_messages"("id") ON DELETE CASCADE,
  "poll_option_id"  UUID NOT NULL REFERENCES "poll_options"("id") ON DELETE CASCADE,
  "voter_user_id"   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "poll_votes_poll_message_id_voter_user_id_poll_option_id_key"
    UNIQUE ("poll_message_id", "voter_user_id", "poll_option_id")
);

CREATE INDEX "poll_votes_by_option_idx" ON "poll_votes"("poll_option_id");
CREATE INDEX "poll_votes_by_voter_idx"  ON "poll_votes"("poll_message_id", "voter_user_id");
