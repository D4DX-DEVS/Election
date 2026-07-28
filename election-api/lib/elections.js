/**
 * Unified elections store — routes to Supabase (UUID) or legacy MongoDB (24-char hex).
 */
const { isUuid, isLegacyMongoId } = require("./entityId");
const { isMongoEnabled } = require("../config/mongo");
const supabase = require("./supabase/elections");

function supabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getMongo() {
  if (!isMongoEnabled()) return null;
  return require("./mongo/elections");
}

function storeForId(id) {
  if (id && isLegacyMongoId(id) && isMongoEnabled()) return getMongo();
  if (supabaseEnabled()) return supabase;
  if (isMongoEnabled()) return getMongo();
  return supabase;
}

function storeForList() {
  if (isMongoEnabled() && !supabaseEnabled()) return getMongo();
  if (supabaseEnabled() && !isMongoEnabled()) return supabase;
  if (supabaseEnabled()) return supabase;
  return getMongo();
}

async function mergeMongoLegacyList(supabaseRows, filter) {
  const mongo = getMongo();
  if (!mongo || !isMongoEnabled()) return supabaseRows;

  const legacyIds = filter.ids?.filter(isLegacyMongoId) || [];
  const mongoFilter = { ...filter };
  if (legacyIds.length) mongoFilter.ids = legacyIds;
  else if (filter.ids?.length) return supabaseRows;

  const mongoRows = await mongo.find(mongoFilter, { sortByCreated: true });
  const seen = new Set(supabaseRows.map((e) => String(e._id || e.id)));
  const merged = [...supabaseRows];
  for (const row of mongoRows) {
    const id = String(row._id || row.id);
    if (!seen.has(id)) merged.push(row);
  }
  return merged;
}

async function create(data) {
  return storeForList().create(data);
}

async function findById(id) {
  return storeForId(id).findById(id);
}

async function updateById(id, data) {
  return storeForId(id).updateById(id, data);
}

async function deleteById(id) {
  return storeForId(id).deleteById(id);
}

async function find(filter = {}, options = {}) {
  const store = storeForList();
  if (store === supabase && isMongoEnabled()) {
    const rows = await supabase.find(filter, options);
    return mergeMongoLegacyList(rows, filter);
  }
  return store.find(filter, options);
}

async function findWithPagination(filter = {}, page = 1, limit = 10) {
  const store = storeForList();
  if (store === supabase && isMongoEnabled()) {
    const { elections, total } = await supabase.findWithPagination(filter, page, limit);
    const merged = await mergeMongoLegacyList(elections, filter);
    if (merged.length === elections.length) {
      return { elections: merged, total };
    }
    const all = await mergeMongoLegacyList(await supabase.find(filter, { sortByCreated: true }), filter);
    const pageNum = Math.max(page, 1);
    const pageSize = Math.max(limit, 1);
    const start = (pageNum - 1) * pageSize;
    return { elections: all.slice(start, start + pageSize), total: all.length };
  }
  return store.findWithPagination(filter, page, limit);
}

async function countDocuments(filter = {}) {
  return storeForList().countDocuments(filter);
}

async function findByIdsWithFranchise(ids, options = {}) {
  const uuidIds = ids.filter(isUuid);
  const legacyIds = ids.filter(isLegacyMongoId);
  const results = [];
  if (uuidIds.length && supabaseEnabled()) {
    results.push(...(await supabase.findByIdsWithFranchise(uuidIds, options)));
  }
  const mongo = getMongo();
  if (legacyIds.length && mongo) {
    results.push(...(await mongo.findByIdsWithFranchise(legacyIds, options)));
  }
  return results;
}

async function countByFranchise() {
  const store = storeForList();
  const counts = await store.countByFranchise();
  if (store === supabase && isMongoEnabled()) {
    const mongoCounts = await getMongo().countByFranchise();
    return { ...mongoCounts, ...counts };
  }
  return counts;
}

async function findLean(filter = {}) {
  const store = storeForList();
  if (store === supabase && isMongoEnabled()) {
    const rows = await supabase.findLean(filter);
    return mergeMongoLegacyList(rows, filter);
  }
  return store.findLean(filter);
}

async function findByOrganization(organization, franchiseId, excludeId) {
  return supabase.findByOrganization(organization, franchiseId, excludeId);
}

module.exports = {
  create,
  findById,
  updateById,
  deleteById,
  find,
  findWithPagination,
  countDocuments,
  findByIdsWithFranchise,
  countByFranchise,
  findLean,
  findByOrganization,
};
