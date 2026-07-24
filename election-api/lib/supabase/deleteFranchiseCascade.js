const { getSupabase } = require("../../config/supabase");
const { isUuid } = require("./users");

const IN_CHUNK = 200;

async function selectIds(table, column, value) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(table).select("id").eq(column, value);
  if (error) throw error;
  return (data || []).map((row) => row.id);
}

async function deleteInChunks(table, column, ids) {
  if (!ids.length) return;
  const supabase = getSupabase();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
}

/**
 * Count the content a franchise owns (elections, voters, voter/election groups).
 * Used to block deleting an in-use franchise until its admin clears the data.
 * Franchise/election admins are not counted — they are managed by the super admin.
 */
async function getFranchiseDataCounts(franchiseId) {
  if (!isUuid(franchiseId)) {
    const err = new Error("Invalid franchise id.");
    err.statusCode = 400;
    throw err;
  }
  const supabase = getSupabase();
  const [elections, voters, voterGroups, electionGroups] = await Promise.all([
    supabase.from("elections").select("id", { count: "exact", head: true }).eq("franchise_id", franchiseId),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("franchise_id", franchiseId)
      .eq("is_voter", true),
    supabase.from("voter_groups").select("id", { count: "exact", head: true }).eq("franchise_id", franchiseId),
    supabase.from("election_groups").select("id", { count: "exact", head: true }).eq("franchise_id", franchiseId),
  ]);
  for (const r of [elections, voters, voterGroups, electionGroups]) {
    if (r.error) throw r.error;
  }
  return {
    elections: elections.count || 0,
    voters: voters.count || 0,
    voterGroups: voterGroups.count || 0,
    electionGroups: electionGroups.count || 0,
  };
}

/**
 * Permanently remove a franchise and all scoped data:
 * elections, nominees, votes, analytics, groups, and users.
 */
async function deleteFranchiseCascade(franchiseId) {
  if (!isUuid(franchiseId)) {
    const err = new Error("Invalid franchise id.");
    err.statusCode = 400;
    throw err;
  }

  const supabase = getSupabase();

  const [electionIds, userIds, voterGroupIds, electionGroupIds] = await Promise.all([
    selectIds("elections", "franchise_id", franchiseId),
    selectIds("users", "franchise_id", franchiseId),
    selectIds("voter_groups", "franchise_id", franchiseId),
    selectIds("election_groups", "franchise_id", franchiseId),
  ]);

  let allVoterGroupIds = [...new Set(voterGroupIds)];
  let allElectionGroupIds = [...new Set(electionGroupIds)];

  if (electionIds.length) {
    const [{ data: linkedGroups, error: linkedErr }, { data: linkedEg, error: linkedEgErr }] =
      await Promise.all([
        supabase
          .from("voter_group_elections")
          .select("voter_group_id")
          .in("election_id", electionIds),
        supabase
          .from("election_group_elections")
          .select("election_group_id")
          .in("election_id", electionIds),
      ]);
    if (linkedErr) throw linkedErr;
    if (linkedEgErr) throw linkedEgErr;

    const linkedVgIds = (linkedGroups || []).map((row) => row.voter_group_id);
    const linkedEgIds = (linkedEg || []).map((row) => row.election_group_id);
    allVoterGroupIds = [...new Set([...allVoterGroupIds, ...linkedVgIds])];
    allElectionGroupIds = [...new Set([...allElectionGroupIds, ...linkedEgIds])];
  }

  if (electionIds.length) {
    const { data: votes, error: votesErr } = await supabase
      .from("votes")
      .select("id")
      .in("election_id", electionIds);
    if (votesErr) throw votesErr;

    const voteIds = (votes || []).map((row) => row.id);
    await deleteInChunks("vote_nominees", "vote_id", voteIds);
    await deleteInChunks("votes", "election_id", electionIds);
    await deleteInChunks("nominees", "election_id", electionIds);
    await deleteInChunks("election_analytics", "election_id", electionIds);
    await deleteInChunks("voter_group_elections", "election_id", electionIds);
    await deleteInChunks("election_group_elections", "election_id", electionIds);
    await deleteInChunks("user_election_access", "election_id", electionIds);
    await deleteInChunks("elections", "id", electionIds);
  }

  if (allVoterGroupIds.length) {
    await deleteInChunks("voter_group_voters", "voter_group_id", allVoterGroupIds);
    await deleteInChunks("voter_group_elections", "voter_group_id", allVoterGroupIds);
    await deleteInChunks("voter_groups", "id", allVoterGroupIds);
  }

  if (allElectionGroupIds.length) {
    await deleteInChunks("election_group_elections", "election_group_id", allElectionGroupIds);
    await deleteInChunks("election_groups", "id", allElectionGroupIds);
  }

  if (userIds.length) {
    const { data: userVotes, error: userVotesErr } = await supabase
      .from("votes")
      .select("id")
      .in("voter_id", userIds);
    if (userVotesErr) throw userVotesErr;

    const userVoteIds = (userVotes || []).map((row) => row.id);
    await deleteInChunks("vote_nominees", "vote_id", userVoteIds);
    await deleteInChunks("votes", "voter_id", userIds);
    await deleteInChunks("user_election_access", "user_id", userIds);
    await deleteInChunks("voter_group_voters", "user_id", userIds);
    await deleteInChunks("users", "id", userIds);
  }

  const { error: franchiseErr } = await supabase.from("franchises").delete().eq("id", franchiseId);
  if (franchiseErr) throw franchiseErr;

  return {
    elections: electionIds.length,
    users: userIds.length,
    voterGroups: allVoterGroupIds.length,
    electionGroups: allElectionGroupIds.length,
  };
}

module.exports = { deleteFranchiseCascade, getFranchiseDataCounts };
