-- Hide existing free cases so the owner can create their own replacements.
-- Existing inventory and case contents are preserved.
UPDATE cases SET active = 0 WHERE is_free = 1;
