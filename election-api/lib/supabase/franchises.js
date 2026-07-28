const { getSupabase } = require("../../config/supabase");
const { mapFranchise, franchiseToRow } = require("./map");
const { isUuid } = require("./users");
const { deleteFranchiseCascade, getFranchiseDataCounts } = require("./deleteFranchiseCascade");

async function create(data) {
  const supabase = getSupabase();
  const row = franchiseToRow(data);
  row.created_at = new Date().toISOString();
  row.updated_at = row.created_at;
  if (!row.status) row.status = "active";

  const { data: created, error } = await supabase.from("franchises").insert(row).select().single();
  if (error) throw error;
  return mapFranchise(created);
}

async function findById(id) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from("franchises").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return mapFranchise(data);
}

async function findByName(name, excludeId) {
  if (!name) return null;
  const supabase = getSupabase();
  let query = supabase.from("franchises").select("*").ilike("name", name.trim()).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return mapFranchise((data && data[0]) || null);
}

async function updateById(id, data) {
  if (!isUuid(id)) return null;
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("franchises")
    .select("settings")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;

  const row = franchiseToRow(data, existing?.settings || {});

  const { data: updated, error } = await supabase
    .from("franchises")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return mapFranchise(updated);
}

async function deleteById(id) {
  if (!isUuid(id)) return null;
  const franchise = await findById(id);
  if (!franchise) return null;

  const cascadeDeleted = await deleteFranchiseCascade(id);
  return { franchise, cascadeDeleted };
}

async function countDocuments() {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("franchises")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

async function findAll({ page, limit, franchiseId } = {}) {
  const supabase = getSupabase();
  let query = supabase.from("franchises").select("*", { count: page !== undefined ? "exact" : undefined });

  if (franchiseId) query = query.eq("id", franchiseId);

  if (page !== undefined) {
    const pageNum = Math.max(page, 1);
    const pageSize = Math.max(limit || 10, 1);
    query = query.order("created_at", { ascending: false });
    query = query.range((pageNum - 1) * pageSize, pageNum * pageSize - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { franchises: (data || []).map(mapFranchise), total: count };
}

async function findLean() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("franchises")
    .select("id, name, settings, logo_url, logo_alt, status, created_at, updated_at");
  if (error) throw error;
  return (data || []).map(mapFranchise);
}

module.exports = {
  create,
  findById,
  findByName,
  updateById,
  deleteById,
  getFranchiseDataCounts,
  countDocuments,
  findAll,
  findLean,
};
