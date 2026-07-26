-- Reprintable voter credentials are encrypted by the application before storage.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credential_ciphertext text;
