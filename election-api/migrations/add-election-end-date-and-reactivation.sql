-- Multi-day elections: optional end date. When set, the election runs from
-- election_date through end_date (inclusive) instead of a single day.
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS end_date date;

-- Set when an admin manually reactivates a completed election. While true, the
-- lifecycle auto-completion (triggered by the election/end date passing) is
-- skipped so the manual "Active" status sticks instead of being immediately
-- reverted on the next read. Cleared once the admin explicitly completes or
-- archives the election again.
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS auto_complete_disabled boolean NOT NULL DEFAULT false;

-- Whether results auto-publish to voters the moment an election completes
-- ("auto"), or require the admin to explicitly hit "Publish" ("manual").
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS result_generation_mode text NOT NULL DEFAULT 'manual';

ALTER TABLE public.elections
  DROP CONSTRAINT IF EXISTS elections_result_generation_mode_check;

ALTER TABLE public.elections
  ADD CONSTRAINT elections_result_generation_mode_check
  CHECK (result_generation_mode IN ('auto', 'manual'));
