const { sameFranchise } = require("./roles");
const { canAccessElection } = require("./electionAccess");

function fail(message, statusCode = 403) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function requireFranchiseId(franchiseId) {
  if (!franchiseId) fail("franchiseId is required.", 400);
  return String(franchiseId);
}

function resourceFranchiseId(resource) {
  const value = resource?.franchiseId ?? resource?.franchise_id;
  if (value && typeof value === "object") {
    return value._id || value.id || "";
  }
  return value || "";
}

async function assertElectionIdsScoped({
  actor,
  franchiseId,
  electionIds,
  findElectionById,
}) {
  const tenantId = requireFranchiseId(franchiseId);
  const ids = [...new Set((electionIds || []).filter(Boolean).map(String))];

  for (const id of ids) {
    const election = await findElectionById(id);
    if (!election) fail("One or more selected elections do not exist.", 404);
    if (!sameFranchise(tenantId, resourceFranchiseId(election))) {
      fail("An election from another organization cannot be assigned.");
    }
    if (actor?.role !== "super_admin" && !(await canAccessElection(actor, election))) {
      fail("You are not allowed to assign one or more selected elections.");
    }
  }

  return ids;
}

async function assertUserIdsScoped({
  actor,
  franchiseId,
  userIds,
  findUserById,
  requireVoter = true,
}) {
  const tenantId = requireFranchiseId(franchiseId);
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];

  for (const id of ids) {
    const user = await findUserById(id);
    if (!user) fail("One or more selected users do not exist.", 404);
    if (requireVoter && user.role !== "voter") {
      fail("Only voters can be assigned.", 400);
    }
    if (!sameFranchise(tenantId, resourceFranchiseId(user))) {
      fail("A user from another organization cannot be assigned.");
    }
    if (actor && actor.role !== "super_admin") {
      const { canManageUser } = require("./roles");
      if (!canManageUser(actor, user)) {
        fail("You are not allowed to assign one or more selected users.");
      }
    }
  }

  return ids;
}

module.exports = {
  requireFranchiseId,
  resourceFranchiseId,
  assertElectionIdsScoped,
  assertUserIdsScoped,
};
