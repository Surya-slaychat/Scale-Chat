UPDATE users
SET "fullName" = 'Surya'
WHERE "phoneE164" = '+919876543210' AND ("fullName" = '' OR "fullName" IS NULL);

SELECT "phoneE164", "fullName" FROM users WHERE "phoneE164" = '+919876543210';
