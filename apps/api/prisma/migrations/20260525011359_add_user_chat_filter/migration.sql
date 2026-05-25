-- CreateTable
CREATE TABLE "user_chat_filters" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_chat_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_chat_filters_userId_idx" ON "user_chat_filters"("userId");

-- AddForeignKey
ALTER TABLE "user_chat_filters" ADD CONSTRAINT "user_chat_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
