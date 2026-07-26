require("dotenv").config({ path: "./.env" });
const { getSupabase } = require("../config/supabase");

async function fetchAll(table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await getSupabase()
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function tenantMap(rows) {
  return new Map(
    rows.map((row) => [String(row.id), String(row.franchise_id || "")])
  );
}

function countInvalidLinks(rows, leftColumn, leftTenants, rightColumn, rightTenants) {
  return rows.filter((row) => {
    const left = leftTenants.get(String(row[leftColumn]));
    const right = rightTenants.get(String(row[rightColumn]));
    return !left || !right || left !== right;
  }).length;
}

function countDuplicateVotes(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const vote of rows) {
    const key = `${vote.voter_id}:${vote.election_id}`;
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
}

async function run() {
  const [
    users,
    elections,
    voterGroups,
    electionGroups,
    userElectionAccess,
    voterGroupVoters,
    voterGroupElections,
    electionGroupElections,
    votes,
  ] = await Promise.all([
    fetchAll("users", "id, franchise_id"),
    fetchAll("elections", "id, franchise_id"),
    fetchAll("voter_groups", "id, franchise_id"),
    fetchAll("election_groups", "id, franchise_id"),
    fetchAll("user_election_access", "user_id, election_id"),
    fetchAll("voter_group_voters", "voter_group_id, user_id"),
    fetchAll("voter_group_elections", "voter_group_id, election_id"),
    fetchAll("election_group_elections", "election_group_id, election_id"),
    fetchAll("votes", "voter_id, election_id"),
  ]);

  const userTenants = tenantMap(users);
  const electionTenants = tenantMap(elections);
  const voterGroupTenants = tenantMap(voterGroups);
  const electionGroupTenants = tenantMap(electionGroups);

  const checks = {
    userElectionAccess: countInvalidLinks(
      userElectionAccess,
      "user_id",
      userTenants,
      "election_id",
      electionTenants
    ),
    voterGroupVoters: countInvalidLinks(
      voterGroupVoters,
      "voter_group_id",
      voterGroupTenants,
      "user_id",
      userTenants
    ),
    voterGroupElections: countInvalidLinks(
      voterGroupElections,
      "voter_group_id",
      voterGroupTenants,
      "election_id",
      electionTenants
    ),
    electionGroupElections: countInvalidLinks(
      electionGroupElections,
      "election_group_id",
      electionGroupTenants,
      "election_id",
      electionTenants
    ),
    votes: countInvalidLinks(
      votes,
      "voter_id",
      userTenants,
      "election_id",
      electionTenants
    ),
    duplicateVotes: countDuplicateVotes(votes),
  };

  const invalidTotal = Object.values(checks).reduce((sum, count) => sum + count, 0);
  console.log(JSON.stringify({ invalidTotal, checks }, null, 2));
  if (invalidTotal > 0) {
    throw new Error(
      "Tenant integrity audit found cross-organization or orphaned relationships."
    );
  }
  console.log("Live tenant integrity audit passed.");
}

run().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
