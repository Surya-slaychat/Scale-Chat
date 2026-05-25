-- Seed messages so the chat list rows have last-message previews + unread counts.

DO $$
DECLARE
  surya_id UUID;
  chat_row RECORD;
  msg_id UUID;
  counterpart_id UUID;
  seq BIGINT;
  preview TEXT;
BEGIN
  SELECT id INTO surya_id FROM users WHERE "phoneE164" = '+919876543210';

  FOR chat_row IN
    SELECT c.id AS chat_id
    FROM chats c
    JOIN chat_members cm ON cm."chatId" = c.id
    WHERE cm."userId" = surya_id AND c.kind = 'ONE_ON_ONE'
  LOOP
    SELECT "userId" INTO counterpart_id
    FROM chat_members
    WHERE "chatId" = chat_row.chat_id AND "userId" <> surya_id;

    -- Skip if this chat already has messages.
    IF EXISTS (SELECT 1 FROM messages WHERE "chatId" = chat_row.chat_id) THEN
      CONTINUE;
    END IF;

    -- Counterpart sends a "Hey, how's it going?" — Surya sees this as unread.
    msg_id := gen_random_uuid();
    preview := 'Hey ' || (SELECT split_part("fullName", ' ', 1) FROM users WHERE id = surya_id) || ', how''s it going?';
    INSERT INTO messages (id, "chatId", "senderUserId", "clientMessageId", sequence, kind, text, "createdAt")
    VALUES (msg_id, chat_row.chat_id, counterpart_id, gen_random_uuid()::text, 1, 'TEXT', preview, NOW() - INTERVAL '5 minutes');

    UPDATE chats
    SET "lastMessageId" = msg_id, "lastMessageAt" = NOW() - INTERVAL '5 minutes'
    WHERE id = chat_row.chat_id;

    -- Surya stays unread on this one.
    RAISE NOTICE 'Seeded message in chat %', chat_row.chat_id;
  END LOOP;
END $$;

SELECT
  c.id,
  (SELECT u."fullName" FROM users u
   JOIN chat_members cm ON cm."userId" = u.id
   WHERE cm."chatId" = c.id AND u."phoneE164" <> '+919876543210' LIMIT 1) AS counterpart,
  (SELECT text FROM messages WHERE "chatId" = c.id ORDER BY sequence DESC LIMIT 1) AS last_preview
FROM chats c
JOIN chat_members cm ON cm."chatId" = c.id
WHERE cm."userId" = (SELECT id FROM users WHERE "phoneE164" = '+919876543210');
