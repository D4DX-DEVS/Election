/**
 * Role hierarchy (low → high): voter < election_admin < franchise_admin < super_admin
 */
const ROLE_RANK = {
  voter: 1,
  election_admin: 2,
  franchise_admin: 3,
  super_admin: 4,
};

const ADMIN_ROLES = ["super_admin", "franchise_admin", "election_admin"];

function roleRank(role) {
  return ROLE_RANK[role] || 0;
}

function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

function isHigherRole(actorRole, targetRole) {
  return roleRank(actorRole) > roleRank(targetRole);
}

function canAssignRole(actorRole, targetRole) {
  if (!isAdmin(actorRole)) return false;
  if (!targetRole || !ROLE_RANK[targetRole]) return false;
  return isHigherRole(actorRole, targetRole);
}

function sameFranchise(a, b) {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a) === String(b);
}

function sharesElectionAccess(actor, target) {
  const actorElections = new Set((actor.electionAccess || []).map(String));
  return (target.electionAccess || []).some((id) => actorElections.has(String(id)));
}

function canManageUser(actor, target, { allowSelf = false } = {}) {
  if (!actor?.role || !target?.role) return false;

  const actorId = String(actor._id || actor.id || "");
  const targetId = String(target._id || target.id || "");

  if (allowSelf && actorId && actorId === targetId) {
    return true;
  }

  if (!isHigherRole(actor.role, target.role)) return false;

  // Super admins manage franchises/franchise admins only — election admins are
  // created by, and stay scoped to, their franchise admin.
  if (actor.role === "super_admin") return target.role !== "election_admin";

  if (actor.role === "franchise_admin") {
    return sameFranchise(actor.franchiseId, target.franchiseId);
  }

  if (actor.role === "election_admin") {
    if (target.role !== "voter") return false;
    return (
      sameFranchise(actor.franchiseId, target.franchiseId) ||
      sharesElectionAccess(actor, target)
    );
  }

  return false;
}

function assertCanAssignRole(actor, targetRole) {
  if (!canAssignRole(actor?.role, targetRole)) {
    const err = new Error(
      `Role ${actor?.role || "unknown"} cannot create or assign the ${targetRole} role.`
    );
    err.statusCode = 403;
    throw err;
  }
}

function assertCanManageUser(actor, target) {
  if (!canManageUser(actor, target)) {
    const err = new Error("You are not allowed to manage this user.");
    err.statusCode = 403;
    throw err;
  }
}

function resolveFranchiseIdForActor(actor, bodyFranchiseId) {
  if (actor.role === "super_admin") return bodyFranchiseId;
  return actor.franchiseId || undefined;
}

function filterUsersForActor(actor, list) {
  if (actor.role === "super_admin") return list.filter((u) => u.role !== "election_admin");
  if (actor.role === "franchise_admin") {
    return list.filter((u) => sameFranchise(actor.franchiseId, u.franchiseId));
  }
  if (actor.role === "election_admin") {
    return list.filter(
      (u) =>
        u.role === "voter" &&
        (sameFranchise(actor.franchiseId, u.franchiseId) || sharesElectionAccess(actor, u))
    );
  }
  return [];
}

function normalizeUsername(username) {
  if (username == null) return "";
  return String(username).trim();
}

module.exports = {
  ROLE_RANK,
  ADMIN_ROLES,
  roleRank,
  isAdmin,
  isHigherRole,
  canAssignRole,
  canManageUser,
  assertCanAssignRole,
  assertCanManageUser,
  resolveFranchiseIdForActor,
  filterUsersForActor,
  normalizeUsername,
  sameFranchise,
};
