-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageKind" ADD VALUE 'DOCUMENT';
ALTER TYPE "MessageKind" ADD VALUE 'VIDEO';
ALTER TYPE "MessageKind" ADD VALUE 'LOCATION';
ALTER TYPE "MessageKind" ADD VALUE 'LOCATION_LIVE';
ALTER TYPE "MessageKind" ADD VALUE 'CONTACT_CARD';
ALTER TYPE "MessageKind" ADD VALUE 'POLL';
ALTER TYPE "MessageKind" ADD VALUE 'CALL_EVENT';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "contactName" VARCHAR(120),
ADD COLUMN     "contactPhoneE164" VARCHAR(20),
ADD COLUMN     "documentSizeBytes" BIGINT,
ADD COLUMN     "documentTitle" VARCHAR(255),
ADD COLUMN     "forwardCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forwardedFromMessageId" UUID,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "liveLocationExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "locationName" VARCHAR(120),
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mediaMimeType" VARCHAR(80),
ADD COLUMN     "pinnedAt" TIMESTAMPTZ(6),
ADD COLUMN     "pinnedByUserId" UUID,
ADD COLUMN     "videoDurationSec" INTEGER,
ADD COLUMN     "videoHeight" INTEGER,
ADD COLUMN     "videoWidth" INTEGER;

-- CreateIndex
CREATE INDEX "messages_forwardedFromMessageId_idx" ON "messages"("forwardedFromMessageId");

-- CreateIndex
CREATE INDEX "messages_chatId_pinnedAt_idx" ON "messages"("chatId", "pinnedAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwardedFromMessageId_fkey" FOREIGN KEY ("forwardedFromMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_pinnedByUserId_fkey" FOREIGN KEY ("pinnedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
