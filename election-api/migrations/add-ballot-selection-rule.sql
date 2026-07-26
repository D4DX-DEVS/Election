-- Per-election ballot rule. Existing elections default to the portal's historic
-- behavior: voters must select exactly the configured number of nominees.
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS ballot_selection_rule text NOT NULL DEFAULT 'exact';

ALTER TABLE public.elections
  DROP CONSTRAINT IF EXISTS elections_ballot_selection_rule_check;

ALTER TABLE public.elections
  ADD CONSTRAINT elections_ballot_selection_rule_check
  CHECK (ballot_selection_rule IN ('exact', 'up_to'));
