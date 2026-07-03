const { getSupabase } = require("../../config/supabase");
const { mapVoterGroup, voterGroupToRow } = require("./map");
const { addElectionAccessToUsers, isUuid } = require("./users");

async function loadRelations(groupIds) {
  const votersMap = new Map();
  const electionsMap = new Map();
  if (!groupIds.length) return { votersMap, electionsMap };

  const supabase = getSupabase();
  const [votersRes, electionsRes] = await Promise.all([
    supabase.from("voter_group_voters").select("voter_group_id, user_id").in("voter_group_id", groupIds),
    supabase.from("voter_group_elections").select("voter_group_id, election_id").in("voter_group_id", groupIds),
  ]);
  if (votersRes.error) throw votersRes.error;
  if (electionsRes.error) throw electionsRes.error;

  groupIds.forEach((id) => {
    votersMap.set(String(id), []);
    electionsMap.set(String(id), []);
  });

  (votersRes.data || []).forEach((r) => {
    const key = String(r.voter_group_id);
    votersMap.get(key).push(r.user_id);
  });
  (electionsRes.data || []).forEach((r) => {
    const key = String(r.voter_group_id);
    electionsMap.get(key).push(r.election_id);
  });

  return { votersMap, electionsMap };
}

async function mapGroups(rows, { populateElections = false, populateVoters = false } = {}) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { votersMap, electionsMap } = await loadRelations(ids);

  let electionDetails = {};
  if (populateElections) {
    const allElectionIds = [...new Set([].concat(...Array.from(electionsMap.values())))];
    if (allElectionIds.length) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("elections")
        .select("id, title, organization")
        .in("id", allElectionIds);
      if (error) throw error;
      (data || []).forEach((e) => {
        electionDetails[e.id] = { _id: e.id, id: e.id, title: e.title, organization: e.organization };
      });
    }
  }

  let voterDetails = {};
  if (populateVoters) {
    const allVoterIds = [...new Set([].concat(...Array.from(votersMap.values())))];
    if (allVoterIds.length) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("users")
        .select("id, username, status, registration_number, voter_prefix, voter_sequence_number, plain_password")
        .in("id", allVoterIds);
      if (error) throw error;

      const { attachElectionAccess } = require("./users");
      const mapped = (data || []).map((u) => ({
        _id: u.id,
        id: u.id,
        username: u.username,
        status: u.status,
        registrationNumber: u.registration_number,
        plainPassword: u.plain_password || undefined,
        voterMetadata:
          u.voter_prefix || u.voter_sequence_number
            ? { prefix: u.voter_prefix, sequenceNumber: u.voter_sequence_number }
            : undefined,
      }));
      const withAccess = await attachElectionAccess(mapped);
      withAccess.forEach((v) => {
        voterDetails[v.id] = v;
      });
    }
  }

  return rows.map((row) => {
    const id = String(row.id);
    const voterIds = votersMap.get(id) || [];
    const electionIds = electionsMap.get(id) || [];
    const extras = {
      voters: populateVoters ? voterIds.map((vid) => voterDetails[vid] || vid) : voterIds,
      elections: populateElections
        ? electionIds.map((eid) => electionDetails[eid] || eid)
        : electionIds,
    };
    return mapVoterGroup(row, extras);
  });
}

async function syncGroupVotersAccess(group) {
  if (!group) return;
  const voters = group.voters || [];
  const elections = group.elections || [];
  if (voters.length === 0 || elections.length === 0) return;

  const voterIds = voters.map((v) => (typeof v === "object" ? v._id || v.id : v));
  const electionIds = elections.map((e) => (typeof e === "object" ? e._id || e.id : e));
  await addElectionAccessToUsers(voterIds, electionIds);
}

async function syncJunctionTables(groupId, { voters, elections }) {
  const supabase = getSupabase();

  if (voters !== undefined) {
    await supabase.from("voter_group_voters").delete().eq("voter_group_id", groupId);
    const voterIds = (voters || []).map((v) => (typeof v === "object" ? v._id || v.id : v)).filter(isUuid);
    if (voterIds.length) {
      const rows = voterIds.map((userId) => ({ voter_group_id: groupId, user_id: userId }));
      const { error } = await supabase.from("voter_group_voters").insert(rows);
      if (error) throw error;
    }
  }

  if (elections !== undefined) {
    await supabase.from("voter_group_elections").delete().eq("voter_group_id", groupId);
    const electionIds = (elections || [])
      .map((e) => (typeof e === "object" ? e._id || e.id : e))
      .filter(isUuid);
    if (electionIds.length) {
      const rows = electionIds.map((electionId) => ({
        voter_group_id: groupId,
        election_id: electionId,
      }));
      const { error } = await supabase.from("voter_group_elections").insert(rows);
      if (error) throw error;
    }
  }
}

async function create(data) {
  const supabase = getSupabase();
  const { voters, elections, ...rest } = data;
  const row = voterGroupToRow(rest);
  row.created_at = new Date().toISOString();
  row.updated_at = row.created_at;

  const { data: created, error } = await supabase.from("voter_groups").insert(row).select().single();
  if (error) throw error;

  await syncJunctionTables(created.id, { voters: voters || [], elections: elections || [] });
  const [group] = await mapGroups([created], { populateElections: true, populateVoters: true });
  return group;
}

async function findById(id, options = {}) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("voter_groups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [group] = await mapGroups([data], options);
  return group;
}

async function updateById(id, data) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { voters, elections, ...rest } = data;
  const row = voterGroupToRow(rest);

  const { data: updated, error } = await supabase
    .from("voter_groups")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) return null;

  if (voters !== undefined) await syncJunctionTables(id, { voters });
  if (elections !== undefined) await syncJunctionTables(id, { elections });

  const [group] = await mapGroups([updated], { populateElections: true, populateVoters: true });
  return group;
}

async function deleteById(id) {
  if (!isUuid(id)) return null;
  const group = await findById(id);
  if (!group) return null;

  const supabase = getSupabase();
  await supabase.from("voter_group_voters").delete().eq("voter_group_id", id);
  await supabase.from("voter_group_elections").delete().eq("voter_group_id", id);
  const { error } = await supabase.from("voter_groups").delete().eq("id", id);
  if (error) throw error;
  return group;
}

async function countDocuments() {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("voter_groups")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

async function findAll({ page, limit, populateElections = true, franchiseId } = {}) {
  const supabase = getSupabase();
  let query = supabase.from("voter_groups").select("*", { count: page !== undefined ? "exact" : undefined });
  if (franchiseId) query = query.eq("franchise_id", franchiseId);

  if (page !== undefined) {
    const pageNum = Math.max(page, 1);
    const pageSize = Math.max(limit || 10, 1);
    query = query.order("created_at", { ascending: false });
    query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  const groups = await mapGroups(data || [], { populateElections });
  return { groups, total: count };
}

async function addVotersToGroup(groupId, voterIds) {
  if (!isUuid(groupId)) return null;
  const supabase = getSupabase();
  const ids = [...new Set(voterIds.map(String))].filter(isUuid);
  if (!ids.length) return findById(groupId, { populateElections: true, populateVoters: true });

  const { data: existing, error: exErr } = await supabase
    .from("voter_group_voters")
    .select("user_id")
    .eq("voter_group_id", groupId);
  if (exErr) throw exErr;

  const existingSet = new Set((existing || []).map((r) => r.user_id));
  const newRows = ids.filter((id) => !existingSet.has(id)).map((userId) => ({
    voter_group_id: groupId,
    user_id: userId,
  }));

  if (newRows.length) {
    const { error } = await supabase.from("voter_group_voters").insert(newRows);
    if (error) throw error;
  }

  const group = await findById(groupId, { populateElections: true, populateVoters: true });
  if (group && group.elections?.length) {
    await addElectionAccessToUsers(ids, group.elections.map((e) => (typeof e === "object" ? e._id || e.id : e)));
  }
  return group;
}

async function removeVotersFromGroup(groupId, voterIds) {
  if (!isUuid(groupId)) return null;
  const supabase = getSupabase();
  const ids = voterIds.map(String).filter(isUuid);

  const { error } = await supabase
    .from("voter_group_voters")
    .delete()
    .eq("voter_group_id", groupId)
    .in("user_id", ids);
  if (error) throw error;

  return findById(groupId, { populateElections: true, populateVoters: true });
}

async function findVoterIdsByGroupId(groupId) {
  if (!isUuid(groupId)) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("voter_group_voters")
    .select("user_id")
    .eq("voter_group_id", groupId);
  if (error) throw error;
  return (data || []).map((r) => r.user_id);
}

async function findGroupVotersPaginated(groupId, { page = 1, limit = 10 } = {}) {
  if (!isUuid(groupId)) return { voters: [], total: 0 };

  const supabase = getSupabase();
  const pageNum = Math.max(page, 1);
  const pageSize = Math.max(limit, 1);
  const from = (pageNum - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: junction, count, error } = await supabase
    .from("voter_group_voters")
    .select("user_id", { count: "exact" })
    .eq("voter_group_id", groupId)
    .range(from, to);
  if (error) throw error;

  const voterIds = (junction || []).map((r) => r.user_id);
  if (!voterIds.length) {
    return { voters: [], total: count || 0 };
  }

  const { data: userRows, error: userErr } = await supabase
    .from("users")
    .select("id, username, status, registration_number, voter_prefix, voter_sequence_number, plain_password")
    .in("id", voterIds);
  if (userErr) throw userErr;

  const { attachElectionAccess } = require("./users");
  const mapped = (userRows || []).map((u) => ({
    _id: u.id,
    id: u.id,
    username: u.username,
    status: u.status,
    registrationNumber: u.registration_number,
    plainPassword: u.plain_password || undefined,
    voterMetadata:
      u.voter_prefix || u.voter_sequence_number
        ? { prefix: u.voter_prefix, sequenceNumber: u.voter_sequence_number }
        : undefined,
  }));
  const withAccess = await attachElectionAccess(mapped);
  const byId = new Map(withAccess.map((v) => [String(v.id || v._id), v]));
  const voters = voterIds.map((id) => byId.get(String(id))).filter(Boolean);

  return { voters, total: count || 0 };
}

async function findGroupsByElection(electionId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("voter_group_elections")
    .select("voter_group_id")
    .eq("election_id", electionId);
  if (error) throw error;
  const groupIds = (data || []).map((r) => r.voter_group_id);
  if (!groupIds.length) return [];

  const { data: groups, error: gErr } = await supabase.from("voter_groups").select("*").in("id", groupIds);
  if (gErr) throw gErr;
  return mapGroups(groups || [], { populateVoters: true });
}

module.exports = {
  create,
  findById,
  updateById,
  deleteById,
  countDocuments,
  findAll,
  addVotersToGroup,
  removeVotersFromGroup,
  syncGroupVotersAccess,
  findVoterIdsByGroupId,
  findGroupVotersPaginated,
  findGroupsByElection,
};
