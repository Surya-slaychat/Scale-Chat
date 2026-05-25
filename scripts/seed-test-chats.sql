-- Seed script: turn 5 of Surya's contacts into real ScaleChat users and create
-- 1-on-1 chats with each so the Contact Page chat list has rows to test against.
--
-- Idempotent: ON CONFLICT clauses skip rows that already exist.
--
-- Owner phone: +919876543210 (test account for this dev session)

DO $$
DECLARE
  surya_id UUID;
  friend RECORD;
  chat_id UUID;
BEGIN
  SELECT id INTO surya_id FROM users WHERE "phoneE164" = '+919876543210';
  IF surya_id IS NULL THEN RAISE EXCEPTION 'owner user not found'; END IF;

  FOR friend IN
    SELECT * FROM (VALUES
      ('+919812345678', 'Megha Ahuja'),
      ('+919976654321', 'Anand Gupta'),
      ('+919885511122', 'Naman Singh'),
      ('+919811112222', 'Aanya Sharma'),
      ('+919844445555', 'Arjun Mehta')
    ) AS t(phone, name)
  LOOP
    -- 1. Ensure a User row exists for this friend.
    INSERT INTO users (id, "phoneE164", "fullName", "isPremium", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), friend.phone, friend.name, false, NOW(), NOW())
    ON CONFLICT ("phoneE164") DO NOTHING;

    -- 2. Link Surya's Contact row for that phone to the now-existing User.
    UPDATE contacts
    SET "contactUserId" = (SELECT id FROM users WHERE "phoneE164" = friend.phone)
    WHERE "ownerUserId" = surya_id AND "phoneE164" = friend.phone
      AND "contactUserId" IS NULL;

    -- 3. Skip if a 1-on-1 chat between Surya and this friend already exists.
    SELECT c.id INTO chat_id
    FROM chats c
    WHERE c.kind = 'ONE_ON_ONE'
      AND EXISTS (SELECT 1 FROM chat_members WHERE "chatId" = c.id AND "userId" = surya_id)
      AND EXISTS (SELECT 1 FROM chat_members WHERE "chatId" = c.id AND "userId" = (SELECT id FROM users WHERE "phoneE164" = friend.phone));
    IF chat_id IS NOT NULL THEN CONTINUE; END IF;

    -- 4. Create the chat + both memberships.
    chat_id := gen_random_uuid();
    INSERT INTO chats (id, kind, "createdByUserId", "createdAt", "updatedAt")
    VALUES (chat_id, 'ONE_ON_ONE', surya_id, NOW(), NOW());

    INSERT INTO chat_members (id, "chatId", "userId", role, "joinedAt", "lastReadSequence")
    VALUES (gen_random_uuid(), chat_id, surya_id, 'MEMBER', NOW(), 0);

    INSERT INTO chat_members (id, "chatId", "userId", role, "joinedAt", "lastReadSequence")
    VALUES (gen_random_uuid(), chat_id, (SELECT id FROM users WHERE "phoneE164" = friend.phone), 'MEMBER', NOW(), 0);

    RAISE NOTICE 'Created chat with %', friend.name;
  END LOOP;
END $$;

SELECT
  c.id,
  c.kind,
  (SELECT u."fullName" FROM users u
   JOIN chat_members cm ON cm."userId" = u.id
   WHERE cm."chatId" = c.id AND u."phoneE164" <> '+919876543210' LIMIT 1) AS counterpart
FROM chats c
JOIN chat_members cm ON cm."chatId" = c.id
WHERE cm."userId" = (SELECT id FROM users WHERE "phoneE164" = '+919876543210');
