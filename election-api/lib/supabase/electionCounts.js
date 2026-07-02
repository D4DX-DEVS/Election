const { getSupabase } = require("../../config/supabase");

function initCountMap(electionIds) {
  const map = {};
  electionIds.forEach((id) => {
    map[String(id)] = 0;
  });
  return map;
}

async function countNomineesByElectionIds(electionIds) {
  const counts = initCountMap(electionIds);
  if (!electionIds.length) return counts;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("nominees")
    .select("election_id")
    .in("election_id", electionIds);
  if (error) throw error;

  (data || []).forEach((row) => {
    const key = String(row.election_id);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

async function countVotersByElectionIds(electionIds) {
  if (!electionIds.length) return initCountMap(electionIds);

  const supabase = getSupabase();
  const voterSets = new Map();
  electionIds.forEach((id) => voterSets.set(String(id), new Set()));

  const { data: direct, error: dErr } = await supabase
    .from("user_election_access")
    .select("election_id, user_id")
    .in("election_id", electionIds);
  if (dErr) throw dErr;

  (direct || []).forEach((row) => {
    voterSets.get(String(row.election_id))?.add(row.user_id);
  });

  const { data: groupLinks, error: gErr } = await supabase
    .from("voter_group_elections")
    .select("election_id, voter_group_id")
    .in("election_id", electionIds);
  if (gErr) throw gErr;

  const groupIds = [...new Set((groupLinks || []).map((r) => r.voter_group_id))];
  if (groupIds.length) {
    const { data: groupVoters, error: gvErr } = await supabase
      .from("voter_group_voters")
      .select("voter_group_id, user_id")
      .in("voter_group_id", groupIds);
    if (gvErr) throw gvErr;

    const votersByGroup = new Map();
    (groupVoters || []).forEach((row) => {
      const key = String(row.voter_group_id);
      if (!votersByGroup.has(key)) votersByGroup.set(key, new Set());
      votersByGroup.get(key).add(row.user_id);
    });

    (groupLinks || []).forEach((link) => {
      const electionKey = String(link.election_id);
      const set = voterSets.get(electionKey);
      const groupSet = votersByGroup.get(String(link.voter_group_id));
      if (set && groupSet) {
        groupSet.forEach((userId) => set.add(userId));
      }
    });
  }

  const allIds = new Set();
  voterSets.forEach((set) => set.forEach((id) => allIds.add(id)));

  // user_election_access also scopes election_admins to elections they manage;
  // only role="voter" rows count as actual eligible voters.
  let voterRoleIds = new Set();
  if (allIds.size) {
    const { data: voterRows, error: vErr } = await supabase
      .from("users")
      .select("id")
      .in("id", Array.from(allIds))
      .eq("role", "voter");
    if (vErr) throw vErr;
    voterRoleIds = new Set((voterRows || []).map((r) => r.id));
  }

  const counts = initCountMap(electionIds);
  voterSets.forEach((set, electionId) => {
    let count = 0;
    set.forEach((id) => {
      if (voterRoleIds.has(id)) count += 1;
    });
    counts[electionId] = count;
  });
  return counts;
}

async function enrichElectionsWithCounts(electionDocs) {
  if (!electionDocs.length) return electionDocs;

  const electionIds = electionDocs.map((e) => e._id || e.id).filter(Boolean);
  const [nomineeCounts, voterCounts] = await Promise.all([
    countNomineesByElectionIds(electionIds),
    countVotersByElectionIds(electionIds),
  ]);

  return electionDocs.map((election) => {
    const id = String(election._id || election.id);
    return {
      ...election,
      nomineeCount: nomineeCounts[id] ?? 0,
      voterCount: voterCounts[id] ?? 0,
    };
  });
}

module.exports = {
  countNomineesByElectionIds,
  countVotersByElectionIds,
  enrichElectionsWithCounts,
};
