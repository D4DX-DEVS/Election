const { getSupabase } = require("../../config/supabase");
const { mapVote } = require("./map");
const { isUuid } = require("./users");
const { resolvePublicImageUrl } = require("../spacesStorage");

async function loadNomineeIds(voteIds) {
  const map = new Map();
  if (!voteIds.length) return map;
  voteIds.forEach((id) => map.set(String(id), []));

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vote_nominees")
    .select("vote_id, nominee_id")
    .in("vote_id", voteIds);
  if (error) throw error;

  (data || []).forEach((row) => {
    const key = String(row.vote_id);
    map.get(key).push(row.nominee_id);
  });
  return map;
}

async function mapVotes(rows, { populateNominees = false } = {}) {
  if (!rows.length) return [];
  const nomineeMap = await loadNomineeIds(rows.map((r) => r.id));

  let nomineeDetails = {};
  if (populateNominees) {
    const allNomineeIds = [...new Set([].concat(...Array.from(nomineeMap.values())))];
    if (allNomineeIds.length) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("nominees")
        .select("id, name, photo_url, photo_alt")
        .in("id", allNomineeIds);
      if (error) throw error;
      (data || []).forEach((n) => {
        nomineeDetails[n.id] = {
          _id: n.id,
          id: n.id,
          name: n.name,
          photo: n.photo_url
            ? { url: resolvePublicImageUrl(n.photo_url), alt: n.photo_alt }
            : undefined,
        };
      });
    }
  }

  return rows.map((row) => {
    const nomineeIds = nomineeMap.get(String(row.id)) || [];
    const vote = mapVote(row, nomineeIds);
    if (populateNominees) {
      vote.nominees = nomineeIds.map((nid) => nomineeDetails[nid] || nid);
    }
    return vote;
  });
}

async function create(data) {
  const supabase = getSupabase();
  const { nominees, electionId, voterId, ipAddress, deviceInfo, status } = data;
  const now = new Date().toISOString();

  const voteRow = {
    election_id: electionId,
    voter_id: voterId,
    ip_address: ipAddress || null,
    device_info: deviceInfo || null,
    status: status || "completed",
    voted_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error } = await supabase.from("votes").insert(voteRow).select().single();
  if (error) {
    if (error.code === "23505") {
      const dupErr = new Error("Already voted in this election.");
      dupErr.code = 23505;
      throw dupErr;
    }
    throw error;
  }

  const nomineeIds = (nominees || []).map((n) => (typeof n === "object" ? n._id || n.id : n));
  if (nomineeIds.length) {
    const rows = nomineeIds.map((nomineeId) => ({
      vote_id: created.id,
      nominee_id: nomineeId,
    }));
    const { error: nErr } = await supabase.from("vote_nominees").insert(rows);
    if (nErr) {
      // Do not leave a consumed empty ballot if nominee linking fails.
      await supabase.from("votes").delete().eq("id", created.id);
      throw nErr;
    }
  }

  return mapVote(created, nomineeIds);
}

async function findById(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("votes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [vote] = await mapVotes([data]);
  return vote;
}

async function findOne({ voterId, electionId }) {
  const supabase = getSupabase();
  let query = supabase.from("votes").select("*");
  if (voterId) query = query.eq("voter_id", voterId);
  if (electionId) query = query.eq("election_id", electionId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [vote] = await mapVotes([data], { populateNominees: true });
  return vote;
}

async function findByVoter(voterId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("votes").select("*").eq("voter_id", voterId);
  if (error) throw error;
  return mapVotes(data || []);
}

async function findAll() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("votes").select("*");
  if (error) throw error;
  return mapVotes(data || []);
}

async function updateById(id, data) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const row = { updated_at: new Date().toISOString() };
  if (data.status !== undefined) row.status = data.status;
  if (data.ipAddress !== undefined) row.ip_address = data.ipAddress;
  if (data.deviceInfo !== undefined) row.device_info = data.deviceInfo;

  const { data: updated, error } = await supabase
    .from("votes")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) return null;

  if (data.nominees !== undefined) {
    await supabase.from("vote_nominees").delete().eq("vote_id", id);
    const nomineeIds = data.nominees.map((n) => (typeof n === "object" ? n._id || n.id : n));
    if (nomineeIds.length) {
      const rows = nomineeIds.map((nomineeId) => ({ vote_id: id, nominee_id: nomineeId }));
      const { error: nErr } = await supabase.from("vote_nominees").insert(rows);
      if (nErr) throw nErr;
    }
    return mapVote(updated, nomineeIds);
  }

  const [vote] = await mapVotes([updated]);
  return vote;
}

async function deleteById(id) {
  if (!isUuid(id)) return null;
  const vote = await findById(id);
  if (!vote) return null;

  const supabase = getSupabase();
  await supabase.from("vote_nominees").delete().eq("vote_id", id);
  const { error } = await supabase.from("votes").delete().eq("id", id);
  if (error) throw error;
  return vote;
}

async function countDocuments(filter = {}) {
  const supabase = getSupabase();
  let query = supabase.from("votes").select("id", { count: "exact", head: true });
  if (filter.electionId) query = query.eq("election_id", filter.electionId);
  if (filter.electionIds && filter.electionIds.length) {
    query = query.in("election_id", filter.electionIds);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function findByElection(electionId, { populateNominees = true, populateVoters = true } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("votes")
    .select("*")
    .eq("election_id", electionId)
    .order("voted_at", { ascending: false });
  if (error) throw error;

  const mapped = await mapVotes(data || [], { populateNominees });
  if (!populateVoters || !mapped.length) return mapped;

  const voterIds = [...new Set(mapped.map((v) => v.voterId).filter(Boolean))];
  if (!voterIds.length) return mapped;

  const { data: usersData, error: uErr } = await supabase
    .from("users")
    .select("id, username, full_name, registration_number")
    .in("id", voterIds);
  if (uErr) throw uErr;

  const userMap = {};
  (usersData || []).forEach((u) => {
    userMap[u.id] = {
      _id: u.id,
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      registrationNumber: u.registration_number,
    };
  });

  mapped.forEach((vote) => {
    vote.voter = userMap[vote.voterId] || null;
  });
  return mapped;
}

async function getTallyForElection(electionId) {
  const supabase = getSupabase();
  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("id")
    .eq("election_id", electionId);
  if (vErr) throw vErr;

  const voteIds = (votes || []).map((v) => v.id);
  if (!voteIds.length) return {};

  const { data: links, error: lErr } = await supabase
    .from("vote_nominees")
    .select("nominee_id")
    .in("vote_id", voteIds);
  if (lErr) throw lErr;

  const tallyMap = {};
  (links || []).forEach((row) => {
    const key = String(row.nominee_id);
    tallyMap[key] = (tallyMap[key] || 0) + 1;
  });
  return tallyMap;
}

module.exports = {
  create,
  findById,
  findOne,
  findByVoter,
  findByElection,
  findAll,
  updateById,
  deleteById,
  countDocuments,
  getTallyForElection,
};
