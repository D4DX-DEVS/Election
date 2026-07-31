const { getSupabase } = require("../../config/supabase");
const { mapElection, electionToRow } = require("./map");
const { isUuid } = require("./users");
const { resolvePublicImageUrl } = require("../spacesStorage");

async function create(data) {
  const supabase = getSupabase();
  const row = electionToRow(data);
  row.created_at = new Date().toISOString();
  row.updated_at = row.created_at;

  const { data: created, error } = await supabase.from("elections").insert(row).select().single();
  if (error) throw error;
  return mapElection(created);
}

async function findByOrganization(organization, franchiseId, excludeId) {
  if (!organization || !franchiseId) return null;
  const supabase = getSupabase();
  let query = supabase
    .from("elections")
    .select("id, organization, franchise_id")
    .eq("franchise_id", franchiseId)
    .ilike("organization", organization.trim())
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data && data[0]) || null;
}

async function findById(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("elections").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return mapElection(data);
}

async function updateById(id, data) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const row = electionToRow(data);

  const { data: updated, error } = await supabase
    .from("elections")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return mapElection(updated);
}

async function deleteById(id) {
  if (!isUuid(id)) return null;
  const election = await findById(id);
  if (!election) return null;

  const supabase = getSupabase();
  const { error } = await supabase.from("elections").delete().eq("id", id);
  if (error) throw error;
  return election;
}

function buildFilterQuery(supabase, filter = {}) {
  let query = supabase.from("elections").select("*");

  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.ids !== undefined) {
    if (!filter.ids.length) return null;
    query = query.in("id", filter.ids);
  }
  if (filter.votingOpen !== undefined) query = query.eq("voting_open", filter.votingOpen);
  if (filter.electionGroupId) query = query.eq("election_group_id", filter.electionGroupId);

  return query;
}

async function countDocuments(filter = {}) {
  if (filter.ids !== undefined && !filter.ids.length) return 0;
  const supabase = getSupabase();
  let query = supabase.from("elections").select("id", { count: "exact", head: true });
  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.ids !== undefined && filter.ids.length) query = query.in("id", filter.ids);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function find(filter = {}, { page, limit, sortByCreated = false } = {}) {
  if (filter.ids !== undefined && !filter.ids.length) return [];
  const supabase = getSupabase();
  let query = buildFilterQuery(supabase, filter);
  if (!query) return [];

  if (sortByCreated) query = query.order("created_at", { ascending: false });
  if (page !== undefined) {
    const pageNum = Math.max(page, 1);
    const pageSize = Math.max(limit || 10, 1);
    query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapElection);
}

async function findWithPagination(filter = {}, page = 1, limit = 10) {
  if (filter.ids !== undefined && !filter.ids.length) {
    return { elections: [], total: 0 };
  }
  const supabase = getSupabase();
  let query = buildFilterQuery(supabase, filter);
  if (!query) return { elections: [], total: 0 };
  query = query.select("*", { count: "exact" }).order("created_at", { ascending: false });

  const pageNum = Math.max(page, 1);
  const pageSize = Math.max(limit, 1);
  query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { elections: (data || []).map(mapElection), total: count || 0 };
}

async function findByIdsWithFranchise(ids, { votingOpen } = {}) {
  if (!ids.length) return [];
  const supabase = getSupabase();
  let query = supabase
    .from("elections")
    .select("*, franchises(id, name, logo_url, logo_alt)")
    .in("id", ids);
  if (votingOpen !== undefined) query = query.eq("voting_open", votingOpen);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => {
    const election = mapElection(row);
    if (row.franchises) {
      election.franchiseId = {
        _id: row.franchises.id,
        id: row.franchises.id,
        name: row.franchises.name,
        logo: row.franchises.logo_url
          ? {
              url: resolvePublicImageUrl(row.franchises.logo_url),
              alt: row.franchises.logo_alt,
            }
          : undefined,
      };
    }
    return election;
  });
}

async function countByFranchise() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("elections").select("franchise_id");
  if (error) throw error;

  const countMap = {};
  (data || []).forEach((row) => {
    if (row.franchise_id) {
      const key = String(row.franchise_id);
      countMap[key] = (countMap[key] || 0) + 1;
    }
  });
  return countMap;
}

async function findLean(filter = {}) {
  const supabase = getSupabase();
  let query = supabase.from("elections").select(
    "id, title, status, voting_open, franchise_id, created_at, election_date, results_published, results_published_at, organization"
  );
  if (filter.franchiseId) query = query.eq("franchise_id", filter.franchiseId);
  if (filter.ids !== undefined) {
    if (!filter.ids.length) return [];
    query = query.in("id", filter.ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => ({
    _id: r.id,
    id: r.id,
    title: r.title,
    organization: r.organization,
    status: r.status,
    votingOpen: r.voting_open,
    franchiseId: r.franchise_id,
    electionDate: r.election_date,
    resultsPublished: r.results_published,
    resultsPublishedAt: r.results_published_at,
    createdAt: r.created_at,
  }));
}

module.exports = {
  create,
  findById,
  updateById,
  deleteById,
  countDocuments,
  find,
  findWithPagination,
  findByIdsWithFranchise,
  countByFranchise,
  findLean,
  findByOrganization,
};
