-- Database-level protection against concurrent or repeated ballot submission.
-- This fails safely if duplicate historical rows exist and must be reviewed first.
CREATE UNIQUE INDEX IF NOT EXISTS votes_one_per_voter_and_election
  ON public.votes (voter_id, election_id);
