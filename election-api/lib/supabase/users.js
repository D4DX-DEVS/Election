const { getSupabase } = require("../../config/supabase");
const { mapUser, userToRow } = require("./map");
const { matchesVoterSearch } = require("./searchHelpers");
const { decryptCredential } = require("../credentialVault");

const { isEntityId, isUuid } = require("../entityId");

async function getElectionAccessForUsers(userIds) {
  const map = new Map();
  if (!userIds.length) return map;
  userIds.forEach((id) => map.set(String(id), []));

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_election_access")
    .select("user_id, election_id")
    .in("user_id", userIds);

  if (error) throw error;
  (data || []).forEach((row) => {
    const key = String(row.user_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row.election_id);
  });
  return map;
}

async function attachElectionAccess(users) {
  if (!users.length) return users;
  const ids = users.map((u) => u.id || u._id);
  const accessMap = await getElectionAccessForUsers(ids);
  return users.map((u) => {
    const id = String(u.id || u._id);
    return { ...u, electionAccess: accessMap.get(id) || [] };
  });
}

async function attachFranchiseDetails(users) {
  if (!users.length) return users;
  const franchiseIds = [
    ...new Set(users.map((u) => u.franchiseId).filter(Boolean).map(String)),
  ];
  if (!franchiseIds.length) return users;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("franchises")
    .select("id, name")
    .in("id", franchiseIds);
  if (error) throw error;

  const nameById = new Map((data || []).map((row) => [String(row.id), row.name]));
  return users.map((user) => {
    const franchiseId = user.franchiseId ? String(user.franchiseId) : null;
    if (!franchiseId) return user;
    const name = nameById.get(franchiseId);
    return {
      ...user,
      franchiseDetails: name ? { _id: franchiseId, name } : { _id: franchiseId },
    };
  });
}

function stripPassword(user) {
  if (!user) return user;
  const { password, plainPassword, ...rest } = user;
  return rest;
}

async function findById(id, { includePassword = true } = {}) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const accessMap = await getElectionAccessForUsers([id]);
  const user = mapUser(data, { electionAccess: accessMap.get(String(id)) || [] });
  return includePassword ? user : stripPassword(user);
}

async function getPrintableCredential(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("credential_ciphertext")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.credential_ciphertext) return null;
  return decryptCredential(data.credential_ciphertext);
}

async function findByUsername(username) {
  const normalized = String(username || "").trim();
  if (!normalized) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("username", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const accessMap = await getElectionAccessForUsers([data.id]);
  return mapUser(data, { electionAccess: accessMap.get(String(data.id)) || [] });
}

async function findByEmail(email) {
  const normalized = String(email || "").trim();
  if (!normalized) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const accessMap = await getElectionAccessForUsers([data.id]);
  return mapUser(data, { electionAccess: accessMap.get(String(data.id)) || [] });
}

async function findOne({ username }) {
  if (username) return findByUsername(username);
  return null;
}

async function findAll(filter = {}) {
  const supabase = getSupabase();
  let query = supabase.from("users").select("*");

  if (filter.role) query = query.eq("role", filter.role);
  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.isVoter !== undefined) query = query.eq("is_voter", filter.isVoter);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw error;
  const users = (data || []).map((row) => mapUser(row));
  return attachElectionAccess(users);
}

async function findPaginated(filter = {}, { page = 1, limit = 10 } = {}) {
  const supabase = getSupabase();
  let query = supabase.from("users").select("*", { count: "exact" });

  if (filter.role) query = query.eq("role", filter.role);
  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.isVoter !== undefined) query = query.eq("is_voter", filter.isVoter);
  if (filter.status) query = query.eq("status", filter.status);

  const pageNum = Math.max(page, 1);
  const pageSize = Math.max(limit, 1);
  query = query.order("created_at", { ascending: false });
  query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  const users = (data || []).map((row) => mapUser(row));
  const withAccess = await attachElectionAccess(users);
  return { users: withAccess, total: count || 0 };
}

async function countDocuments(filter = {}) {
  const supabase = getSupabase();
  let query = supabase.from("users").select("id", { count: "exact", head: true });

  if (filter.role) query = query.eq("role", filter.role);
  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.isVoter !== undefined) query = query.eq("is_voter", filter.isVoter);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.electionId) {
    const ids = await getUserIdsWithElectionAccess(filter.electionId);
    if (ids.length === 0) return 0;
    query = query.in("id", ids);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function getUserIdsWithElectionAccess(electionId) {
  const supabase = getSupabase();
  const ids = new Set();

  const { data: direct, error: dErr } = await supabase
    .from("user_election_access")
    .select("user_id")
    .eq("election_id", electionId);
  if (dErr) throw dErr;
  (direct || []).forEach((r) => ids.add(r.user_id));

  const { data: groupLinks, error: gErr } = await supabase
    .from("voter_group_elections")
    .select("voter_group_id")
    .eq("election_id", electionId);
  if (gErr) throw gErr;

  const groupIds = (groupLinks || []).map((r) => r.voter_group_id);
  if (groupIds.length) {
    const { data: groupVoters, error: gvErr } = await supabase
      .from("voter_group_voters")
      .select("user_id")
      .in("voter_group_id", groupIds);
    if (gvErr) throw gvErr;
    (groupVoters || []).forEach((r) => ids.add(r.user_id));
  }

  if (!ids.size) return [];

  // user_election_access is also used to scope election_admins to elections
  // they manage; only role="voter" rows count as actual eligible voters.
  const { data: voterRows, error: uErr } = await supabase
    .from("users")
    .select("id")
    .in("id", Array.from(ids))
    .eq("role", "voter");
  if (uErr) throw uErr;

  return (voterRows || []).map((r) => r.id);
}

async function getAssignedVoterIdsForElection(electionId) {
  return getUserIdsWithElectionAccess(electionId);
}

async function setElectionAccess(userId, electionIds) {
  const supabase = getSupabase();
  const ids = [...new Set((electionIds || []).map(String))].filter(isUuid);
  if (!ids.length) return;

  const rows = ids.map((electionId) => ({ user_id: userId, election_id: electionId }));
  const { error } = await supabase.from("user_election_access").upsert(rows, {
    onConflict: "user_id,election_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

async function addElectionAccessToUsers(userIds, electionIds) {
  const supabase = getSupabase();
  const uIds = [...new Set((userIds || []).map(String))].filter(isUuid);
  const eIds = [...new Set((electionIds || []).map(String))].filter(isUuid);
  if (!uIds.length || !eIds.length) return { modifiedCount: 0 };

  const rows = [];
  uIds.forEach((userId) => {
    eIds.forEach((electionId) => rows.push({ user_id: userId, election_id: electionId }));
  });

  const { data: existing, error: exErr } = await supabase
    .from("user_election_access")
    .select("user_id, election_id")
    .in("user_id", uIds)
    .in("election_id", eIds);
  if (exErr) throw exErr;

  const existingSet = new Set(
    (existing || []).map((r) => `${r.user_id}:${r.election_id}`)
  );
  const newRows = rows.filter((r) => !existingSet.has(`${r.user_id}:${r.election_id}`));
  if (!newRows.length) return { modifiedCount: 0 };

  const { error } = await supabase.from("user_election_access").insert(newRows);
  if (error) throw error;
  return { modifiedCount: newRows.length };
}

async function create(data) {
  const supabase = getSupabase();
  const { electionAccess, voterMetadata, ...rest } = data;
  if (rest.username) rest.username = String(rest.username).trim();
  if (rest.email) rest.email = String(rest.email).trim();
  const row = userToRow(rest);
  if (voterMetadata) {
    if (voterMetadata.prefix !== undefined) row.voter_prefix = voterMetadata.prefix;
    if (voterMetadata.sequenceNumber !== undefined) {
      row.voter_sequence_number = voterMetadata.sequenceNumber;
    }
  }
  row.created_at = new Date().toISOString();
  row.updated_at = row.created_at;
  if (!row.status) row.status = "active";

  const { data: created, error } = await supabase.from("users").insert(row).select().single();
  if (error) {
    if (error.code === "23505") {
      const dup = new Error("Username or email already exists.");
      dup.statusCode = 409;
      throw dup;
    }
    throw error;
  }

  const access = Array.isArray(electionAccess) ? electionAccess : [];
  if (access.length) await setElectionAccess(created.id, access);

  const user = mapUser(created, { electionAccess: access });
  return user;
}

async function insertMany(docs) {
  const created = [];
  for (const doc of docs) {
    const { electionAccess, voterGroupId, voterMetadata, ...rest } = doc;
    const user = await create({
      ...rest,
      electionAccess,
      voterMetadata,
    });
    created.push(user);
  }
  return created;
}

async function updateById(id, data) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { electionAccess, voterMetadata, ...rest } = data;
  const row = userToRow(rest);
  if (voterMetadata) {
    if (voterMetadata.prefix !== undefined) row.voter_prefix = voterMetadata.prefix;
    if (voterMetadata.sequenceNumber !== undefined) {
      row.voter_sequence_number = voterMetadata.sequenceNumber;
    }
  }

  const { data: updated, error } = await supabase
    .from("users")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) return null;

  if (electionAccess !== undefined) {
    await supabase.from("user_election_access").delete().eq("user_id", id);
    if (Array.isArray(electionAccess) && electionAccess.length) {
      await setElectionAccess(id, electionAccess);
    }
  }

  const accessMap = await getElectionAccessForUsers([id]);
  return mapUser(updated, { electionAccess: accessMap.get(String(id)) || [] });
}

async function deleteById(id) {
  if (!isUuid(id)) return null;
  const user = await findById(id);
  if (!user) return null;

  const supabase = getSupabase();
  await supabase.from("user_election_access").delete().eq("user_id", id);
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
  return user;
}

async function findByUsernames(usernames) {
  const normalized = usernames.map((u) => String(u).trim()).filter(Boolean);
  if (!normalized.length) return [];
  const supabase = getSupabase();
  const orFilter = normalized.map((u) => `username.ilike.${u}`).join(",");
  const { data, error } = await supabase.from("users").select("username").or(orFilter);
  if (error) throw error;
  return (data || []).map((r) => mapUser(r));
}

async function getAllVoters({
  page = 1,
  pageSize = 10,
  status,
  search,
  electionId,
  notInElection,
  notInGroup,
  forElectionId,
  franchiseId,
}) {
  const supabase = getSupabase();
  const searchTerm = String(search || "").trim();

  let assignedSet = null;
  if (forElectionId && isUuid(forElectionId)) {
    const assigned = await getAssignedVoterIdsForElection(forElectionId);
    assignedSet = new Set(assigned.map(String));
  }

  /** Reliable text search: filter in Node (PostgREST ilike.or is flaky). */
  if (searchTerm) {
    let poolQuery = supabase
      .from("users")
      .select("id, username, full_name, registration_number, created_at")
      .eq("is_voter", true)
      .order("created_at", { ascending: false });

    if (status) poolQuery = poolQuery.eq("status", status);
    if (franchiseId) poolQuery = poolQuery.eq("franchise_id", franchiseId);

    if (electionId && electionId !== "all") {
      const ids = await getUserIdsWithElectionAccess(electionId);
      if (ids.length === 0) return { voters: [], total: 0 };
      poolQuery = poolQuery.in("id", ids);
    }

    if (notInElection && notInElection !== "all" && !forElectionId) {
      if (!isUuid(notInElection)) {
        const err = new Error("Invalid notInElection id.");
        err.statusCode = 400;
        throw err;
      }
      const assignedIds = await getAssignedVoterIdsForElection(notInElection);
      if (assignedIds.length) {
        poolQuery = poolQuery.not("id", "in", `(${assignedIds.join(",")})`);
      }
    }

    if (notInGroup && isUuid(notInGroup)) {
      const { data: groupVoters, error: gvErr } = await supabase
        .from("voter_group_voters")
        .select("user_id")
        .eq("voter_group_id", notInGroup);
      if (gvErr) throw gvErr;
      const excludeIds = (groupVoters || []).map((r) => r.user_id);
      if (excludeIds.length) {
        poolQuery = poolQuery.not("id", "in", `(${excludeIds.join(",")})`);
      }
    }

    const { data: pool, error: poolError } = await poolQuery;
    if (poolError) throw poolError;

    const filtered = (pool || []).filter((row) => matchesVoterSearch(row, searchTerm));
    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const pageSlice = filtered.slice(from, from + pageSize);

    if (pageSlice.length === 0) {
      return { voters: [], total };
    }

    const pageIds = pageSlice.map((r) => r.id);
    const { data, error } = await supabase.from("users").select("*").in("id", pageIds);
    if (error) throw error;

    const byId = new Map((data || []).map((row) => [row.id, row]));
    let voters = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((row) => stripPassword(mapUser(row)));
    voters = await attachElectionAccess(voters);

    if (assignedSet) {
      voters = voters.map((v) => ({
        ...v,
        isAssignedToElection: assignedSet.has(String(v.id || v._id)),
      }));
    }

    return { voters, total };
  }

  let query = supabase.from("users").select("*", { count: "exact" }).eq("is_voter", true);

  if (status) query = query.eq("status", status);
  if (franchiseId) query = query.eq("franchise_id", franchiseId);

  if (electionId && electionId !== "all") {
    const ids = await getUserIdsWithElectionAccess(electionId);
    if (ids.length === 0) {
      return { voters: [], total: 0 };
    }
    query = query.in("id", ids);
  }

  if (notInElection && notInElection !== "all" && !forElectionId) {
    if (!isUuid(notInElection)) {
      const err = new Error("Invalid notInElection id.");
      err.statusCode = 400;
      throw err;
    }
    const assignedIds = await getAssignedVoterIdsForElection(notInElection);
    if (assignedIds.length) {
      query = query.not("id", "in", `(${assignedIds.join(",")})`);
    }
  }

  if (notInGroup && isUuid(notInGroup)) {
    const { data: groupVoters, error } = await supabase
      .from("voter_group_voters")
      .select("user_id")
      .eq("voter_group_id", notInGroup);
    if (error) throw error;
    const excludeIds = (groupVoters || []).map((r) => r.user_id);
    if (excludeIds.length) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }
  }

  query = query.order("created_at", { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  let voters = (data || []).map((row) => stripPassword(mapUser(row)));
  voters = await attachElectionAccess(voters);

  if (assignedSet) {
    voters = voters.map((v) => ({
      ...v,
      isAssignedToElection: assignedSet.has(String(v.id || v._id)),
    }));
  }

  return { voters, total: count || 0 };
}

async function assignVotersToElection(voterIds, electionId) {
  return addElectionAccessToUsers(voterIds, [electionId]);
}

async function userHasElectionAccess(userId, electionId) {
  const ids = await getUserIdsWithElectionAccess(electionId);
  return ids.includes(String(userId));
}

module.exports = {
  isEntityId,
  isUuid,
  findById,
  findByUsername,
  findByEmail,
  findOne,
  findAll,
  findPaginated,
  countDocuments,
  create,
  insertMany,
  updateById,
  deleteById,
  findByUsernames,
  getAllVoters,
  getAssignedVoterIdsForElection,
  addElectionAccessToUsers,
  assignVotersToElection,
  setElectionAccess,
  getElectionAccessForUsers,
  attachElectionAccess,
  attachFranchiseDetails,
  userHasElectionAccess,
  getPrintableCredential,
  stripPassword,
};
