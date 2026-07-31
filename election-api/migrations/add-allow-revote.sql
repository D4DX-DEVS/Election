-- Admin option: let voters change (recast) their vote while voting is open.
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS allow_revote boolean DEFAULT false;
