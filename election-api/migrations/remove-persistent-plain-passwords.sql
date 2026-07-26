-- Voter credentials must only be returned once, at account creation/reset.
-- This migration permanently removes previously stored readable passwords.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS plain_password;
