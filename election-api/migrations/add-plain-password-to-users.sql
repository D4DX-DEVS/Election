-- Persist the plaintext password admins set/generate for a user, so it can be
-- viewed again later (e.g. reprinting a voter's credentials slip). Cleared to
-- NULL whenever the user changes their own password (self-service change or
-- forgot-password flow), so admins can no longer see a password the user
-- picked themselves.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plain_password TEXT;
