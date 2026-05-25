-- Seed chats + messages for account +919398730633.
DO $$
DECLARE
  owner_id UUID;
  friend RECORD;
  chat_id UUID;
  msg_id UUID;
BEGIN
  SELECT id INTO owner_id FROM users WHERE "phoneE164" = '+919398730633';

  FOR friend IN
    SELECT * FROM (VALUES
      ('+919812345678', 'Megha Ahuja',  'Hey Surya, are you coming Friday?'),
      ('+919976654321', 'Anand Gupta',  'Sent the docs. Lemme know.'),
      ('+919885511122', 'Naman Singh',  'Voice note · 0:24'),
      ('+919811112222', 'Aanya Sharma', 'OK done!'),
      ('+919844445555', 'Arjun Mehta',  'Tomorrow 7pm works?')
    ) AS t(phone, name, preview)
  LOOP
    INSERT INTO users (id, "phoneE164", "fullName", "isPremium", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), friend.phone, friend.name, false, NOW(), NOW())
    ON CONFLICT ("phoneE164") DO NOTHING;

    UPDATE contacts
    SET "contactUserId" = (SELECT id FROM users WHERE "phoneE164" = friend.phone)
    WHERE "ownerUserId" = owner_id AND "phoneE164" = friend.phone AND "contactUserId" IS NULL;

    SELECT c.id INTO chat_id FROM chats c
    WHERE c.kind = 'ONE_ON_ONE'
      AND EXISTS (SELECT 1 FROM chat_members WHERE "chatId" = c.id AND "userId" = owner_id)
      AND EXISTS (SELECT 1 FROM chat_members WHERE "chatId" = c.id AND "userId" = (SELECT id FROM users WHERE "phoneE164" = friend.phone));
    IF chat_id IS NULL THEN
      chat_id := gen_random_uuid();
      INSERT INTO chats (id, kind, "createdByUserId", "createdAt", "updatedAt")
      VALUES (chat_id, 'ONE_ON_ONE', owner_id, NOW(), NOW());
      INSERT INTO chat_members (id, "chatId", "userId", role, "joinedAt", "lastReadSequence")
      VALUES (gen_random_uuid(), chat_id, owner_id, 'MEMBER', NOW(), 0);
      INSERT INTO chat_members (id, "chatId", "userId", role, "joinedAt", "lastReadSequence")
      VALUES (gen_random_uuid(), chat_id, (SELECT id FROM users WHERE "phoneE164" = friend.phone), 'MEMBER', NOW(), 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM messages WHERE "chatId" = chat_id) THEN
      msg_id := gen_random_uuid();
      INSERT INTO messages (id, "chatId", "senderUserId", "clientMessageId", sequence, kind, text, "createdAt")
      VALUES (
        msg_id,
        chat_id,
        (SELECT id FROM users WHERE "phoneE164" = friend.phone),
        gen_random_uuid()::text,
        1,
        'TEXT',
        friend.preview,
        NOW() - (RANDOM() * INTERVAL '120 minutes')
      );
      UPDATE chats SET "lastMessageId" = msg_id, "lastMessageAt" = (SELECT "createdAt" FROM messages WHERE id = msg_id) WHERE id = chat_id;
    END IF;

    RAISE NOTICE 'Ready: %', friend.name;
  END LOOP;
END $$;
